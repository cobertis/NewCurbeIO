import { db } from "../db";
import { 
  orchestratorCampaigns, 
  campaignContacts, 
  campaignEvents,
  contactConsents,
  contactSuppressions,
  contacts,
  companies,
  users
} from "@shared/schema";
import { calculateAllowedActions } from "../services/policy-engine";
import { eq } from "drizzle-orm";

const TEST_COMPANY_ID = "test-policy-engine-company-" + Date.now();
const TEST_CAMPAIGN_ID = "test-policy-engine-campaign-" + Date.now();
const TEST_CONTACT_ID = "test-policy-engine-contact-" + Date.now();
const TEST_USER_ID = "test-policy-engine-user-" + Date.now();
const TEST_ENROLLMENT_ID = "test-enrollment-" + Date.now();

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

async function cleanupTestData() {
  try {
    await db.delete(campaignEvents).where(eq(campaignEvents.companyId, TEST_COMPANY_ID));
    await db.delete(contactConsents).where(eq(contactConsents.companyId, TEST_COMPANY_ID));
    await db.delete(contactSuppressions).where(eq(contactSuppressions.companyId, TEST_COMPANY_ID));
    await db.delete(campaignContacts).where(eq(campaignContacts.companyId, TEST_COMPANY_ID));
    await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID));
    await db.delete(contacts).where(eq(contacts.companyId, TEST_COMPANY_ID));
    await db.delete(users).where(eq(users.companyId, TEST_COMPANY_ID));
    await db.delete(companies).where(eq(companies.id, TEST_COMPANY_ID));
  } catch (e) {}
}

async function setupTestData(options: {
  suppressionStatus?: "none" | "opted_out" | "complaint" | "dnc";
  consents?: { channel: string; status: "opt_in" | "opt_out" | "unknown" }[];
  policyOverrides?: Record<string, any>;
  contactPhone?: string;
  attemptsTotal?: number;
  createEvents?: { eventType: string; channel: string; createdAt?: Date }[];
}) {
  await cleanupTestData();
  
  await db.insert(companies).values({
    id: TEST_COMPANY_ID,
    name: "Test Policy Engine Company",
    slug: "test-policy-engine-" + Date.now(),
    email: "test@policy.com",
    timezone: "America/New_York"
  });
  
  await db.insert(users).values({
    id: TEST_USER_ID,
    companyId: TEST_COMPANY_ID,
    email: "testuser" + Date.now() + "@policy.com",
    password: "hashed",
    firstName: "Test",
    lastName: "User",
    role: "admin"
  });
  
  await db.insert(contacts).values({
    id: TEST_CONTACT_ID,
    companyId: TEST_COMPANY_ID,
    firstName: "Test",
    lastName: "Contact",
    phoneNormalized: options.contactPhone || "+17865551234"
  });
  
  const policyJson = {
    maxAttemptsTotal: 10,
    maxAttemptsPerDay: 3,
    maxAttemptsPerChannel: {
      sms: 3, mms: 2, imessage: 3, whatsapp: 2, voice: 5, voicemail: 2, rvm: 2
    },
    quietHours: { enabled: false, startHour: 21, endHour: 8, timezone: "America/New_York" },
    allowedChannels: ["sms", "mms", "imessage", "whatsapp", "voice", "voicemail", "rvm"],
    dncTargets: [],
    ...options.policyOverrides
  };
  
  await db.insert(orchestratorCampaigns).values({
    id: TEST_CAMPAIGN_ID,
    companyId: TEST_COMPANY_ID,
    createdBy: TEST_USER_ID,
    name: "Test Campaign",
    status: "active",
    policyJson
  });
  
  await db.insert(campaignContacts).values({
    id: TEST_ENROLLMENT_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    companyId: TEST_COMPANY_ID,
    state: "ATTEMPTING",
    attemptsTotal: options.attemptsTotal || 0
  });
  
  if (options.suppressionStatus && options.suppressionStatus !== "none") {
    await db.insert(contactSuppressions).values({
      contactId: TEST_CONTACT_ID,
      companyId: TEST_COMPANY_ID,
      suppressionStatus: options.suppressionStatus,
      reason: "Test suppression"
    });
  }
  
  if (options.consents) {
    for (const consent of options.consents) {
      await db.insert(contactConsents).values({
        contactId: TEST_CONTACT_ID,
        companyId: TEST_COMPANY_ID,
        channel: consent.channel as any,
        status: consent.status
      });
    }
  }
  
  if (options.createEvents) {
    for (const event of options.createEvents) {
      await db.insert(campaignEvents).values({
        campaignId: TEST_CAMPAIGN_ID,
        campaignContactId: TEST_ENROLLMENT_ID,
        contactId: TEST_CONTACT_ID,
        companyId: TEST_COMPANY_ID,
        eventType: event.eventType as any,
        channel: event.channel as any,
        createdAt: event.createdAt || new Date()
      });
    }
  }
}

async function runTests() {
  console.log("\n=== Policy Engine Tests ===\n");
  
  console.log("1) Suppression Status Tests");
  
  await setupTestData({ suppressionStatus: "opted_out" });
  let result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  assert(!("error" in result), "suppression_status=opted_out: no error");
  if (!("error" in result)) {
    assert(result.allowedActions.length === 0, "suppression_status=opted_out: blocks ALL channels (0 allowed)");
    assert(result.blocked.length === 7, "suppression_status=opted_out: 7 blocked");
    assert(result.blocked.every(b => b.reasons.some(r => r.includes("SUPPRESSED"))), "suppression_status=opted_out: all have SUPPRESSED reason");
  }
  
  await setupTestData({ suppressionStatus: "complaint" });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  if (!("error" in result)) {
    assert(result.allowedActions.length === 0, "suppression_status=complaint: blocks ALL channels");
  }
  
  await setupTestData({ suppressionStatus: "dnc" });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  if (!("error" in result)) {
    assert(result.allowedActions.length === 0, "suppression_status=dnc: blocks ALL channels");
  }
  
  console.log("\n2) Consent Unknown Defaults (Conservative)");
  
  await setupTestData({ suppressionStatus: "none" });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  if (!("error" in result)) {
    const blockedChannels = result.blocked.map(b => b.channel);
    assert(blockedChannels.includes("sms"), "consent=unknown: blocks sms");
    assert(blockedChannels.includes("mms"), "consent=unknown: blocks mms");
    assert(blockedChannels.includes("imessage"), "consent=unknown: blocks imessage");
    assert(blockedChannels.includes("whatsapp"), "consent=unknown: blocks whatsapp");
    assert(blockedChannels.includes("rvm"), "consent=unknown: blocks rvm");
    const allowedChannels = result.allowedActions.map(a => a.channel);
    assert(allowedChannels.includes("voice"), "consent=unknown: allows voice");
    assert(allowedChannels.includes("voicemail"), "consent=unknown: allows voicemail");
  }
  
  console.log("\n3) DNC Check");
  
  await setupTestData({
    suppressionStatus: "none",
    contactPhone: "+17865559999",
    policyOverrides: { dncTargets: ["+17865559999"] }
  });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  if (!("error" in result)) {
    const blockedChannels = result.blocked.map(b => b.channel);
    assert(blockedChannels.includes("voice"), "DNC: blocks voice");
    assert(blockedChannels.includes("voicemail"), "DNC: blocks voicemail");
    const voiceBlock = result.blocked.find(b => b.channel === "voice");
    assert(voiceBlock?.reasons.some(r => r.includes("DNC")) ?? false, "DNC: voice has DNC reason");
  }
  
  console.log("\n4) Quiet Hours");
  
  const now = new Date();
  const currentHour = now.getUTCHours();
  await setupTestData({
    suppressionStatus: "none",
    consents: [
      { channel: "sms", status: "opt_in" },
      { channel: "voice", status: "opt_in" }
    ],
    policyOverrides: {
      quietHours: {
        enabled: true,
        startHour: currentHour,
        endHour: (currentHour + 2) % 24,
        timezone: "UTC"
      }
    }
  });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  if (!("error" in result)) {
    assert(result.allowedActions.length === 0, "Quiet hours: blocks all channels");
    const smsBlock = result.blocked.find(b => b.channel === "sms");
    const voiceBlock = result.blocked.find(b => b.channel === "voice");
    assert(smsBlock?.reasons.some(r => r.includes("QUIET_HOURS")) ?? false, "Quiet hours: sms (with opt_in) has QUIET_HOURS reason");
    assert(voiceBlock?.reasons.some(r => r.includes("QUIET_HOURS")) ?? false, "Quiet hours: voice has QUIET_HOURS reason");
  }
  
  console.log("\n5) Caps 24h");
  
  await setupTestData({
    suppressionStatus: "none",
    consents: [{ channel: "sms", status: "opt_in" }],
    policyOverrides: { maxAttemptsPerDay: 2 },
    createEvents: [
      { eventType: "MESSAGE_SENT", channel: "sms" },
      { eventType: "MESSAGE_SENT", channel: "sms" }
    ]
  });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  if (!("error" in result)) {
    const smsBlock = result.blocked.find(b => b.channel === "sms");
    assert(smsBlock?.reasons.some(r => r.includes("CAP_24H")) ?? false, "Caps 24h: sms has CAP_24H reason");
  }
  
  console.log("\n6) Caps Total");
  
  await setupTestData({
    suppressionStatus: "none",
    consents: [{ channel: "sms", status: "opt_in" }],
    policyOverrides: { maxAttemptsTotal: 5 },
    attemptsTotal: 5
  });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, TEST_CONTACT_ID);
  if (!("error" in result)) {
    const smsBlock = result.blocked.find(b => b.channel === "sms");
    assert(smsBlock?.reasons.some(r => r.includes("CAP_TOTAL")) ?? false, "Caps total: sms has CAP_TOTAL reason");
  }
  
  console.log("\n7) Not Enrolled");
  
  await setupTestData({ suppressionStatus: "none" });
  result = await calculateAllowedActions(TEST_COMPANY_ID, TEST_CAMPAIGN_ID, "non-existent-contact");
  assert("error" in result, "Not enrolled: returns error");
  if ("error" in result) {
    assert(result.status === 404, "Not enrolled: status 404");
  }
  
  console.log("\n8) Campaign Not Found");
  
  result = await calculateAllowedActions(TEST_COMPANY_ID, "non-existent-campaign", TEST_CONTACT_ID);
  assert("error" in result, "Campaign not found: returns error");
  if ("error" in result) {
    assert(result.status === 404, "Campaign not found: status 404");
  }
  
  await cleanupTestData();
  
  console.log("\n=== Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
