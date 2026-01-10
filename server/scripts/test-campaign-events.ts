import { db } from "../db";
import { 
  orchestratorCampaigns, 
  campaignContacts, 
  campaignEvents,
  campaignAuditLogs,
  contacts,
  companies,
  users
} from "@shared/schema";
import { emitCampaignEvent } from "../services/campaign-events";
import { eq, and, sql } from "drizzle-orm";

const TEST_COMPANY_ID = "test-events-company-" + Date.now();
const TEST_CAMPAIGN_ID = "test-events-campaign-" + Date.now();
const TEST_CONTACT_ID = "test-events-contact-" + Date.now();
const TEST_USER_ID = "test-events-user-" + Date.now();
const TEST_ENROLLMENT_ID = "test-events-enroll-" + Date.now();

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
    await db.delete(campaignAuditLogs).where(eq(campaignAuditLogs.companyId, TEST_COMPANY_ID));
    await db.delete(campaignEvents).where(eq(campaignEvents.companyId, TEST_COMPANY_ID));
    await db.delete(campaignContacts).where(eq(campaignContacts.companyId, TEST_COMPANY_ID));
    await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID));
    await db.delete(contacts).where(eq(contacts.companyId, TEST_COMPANY_ID));
    await db.delete(users).where(eq(users.companyId, TEST_COMPANY_ID));
    await db.delete(companies).where(eq(companies.id, TEST_COMPANY_ID));
  } catch (e) {}
}

async function setupTestData() {
  await cleanupTestData();
  
  await db.insert(companies).values({
    id: TEST_COMPANY_ID,
    name: "Test Events Company",
    slug: "test-events-" + Date.now(),
    email: "test@events.com",
    timezone: "America/New_York"
  });
  
  await db.insert(users).values({
    id: TEST_USER_ID,
    companyId: TEST_COMPANY_ID,
    email: "testevents" + Date.now() + "@events.com",
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
    phoneNormalized: "+17865551234"
  });
  
  await db.insert(orchestratorCampaigns).values({
    id: TEST_CAMPAIGN_ID,
    companyId: TEST_COMPANY_ID,
    createdBy: TEST_USER_ID,
    name: "Test Events Campaign",
    status: "active",
    policyJson: {}
  });
  
  await db.insert(campaignContacts).values({
    id: TEST_ENROLLMENT_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    companyId: TEST_COMPANY_ID,
    state: "ATTEMPTING",
    attemptsTotal: 0
  });
}

async function getEnrollment() {
  const [enrollment] = await db.select()
    .from(campaignContacts)
    .where(eq(campaignContacts.id, TEST_ENROLLMENT_ID))
    .limit(1);
  return enrollment;
}

async function runTests() {
  console.log("\n=== Campaign Event Emitter Tests ===\n");
  
  console.log("1) Create event => row inserted");
  
  await setupTestData();
  
  let result = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_SENT",
    channel: "sms",
    provider: "twilio",
    payload: { message: "Hello" }
  });
  
  assert(!("error" in result), "Event creation: no error");
  if (!("error" in result)) {
    assert(!!result.event.id, "Event creation: event has id");
    assert(result.event.eventType === "MESSAGE_SENT", "Event creation: eventType is MESSAGE_SENT");
    assert(result.event.channel === "sms", "Event creation: channel is sms");
    assert(result.wasIdempotent === false, "Event creation: wasIdempotent is false");
  }
  
  console.log("\n2) externalId idempotency => second call no duplica");
  
  await setupTestData();
  
  const externalId = "provider-msg-" + Date.now();
  
  const first = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_SENT",
    channel: "sms",
    externalId
  });
  
  const second = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_SENT",
    channel: "sms",
    externalId
  });
  
  assert(!("error" in first) && !("error" in second), "Idempotency: both calls succeed");
  if (!("error" in first) && !("error" in second)) {
    assert(first.event.id === second.event.id, "Idempotency: same event id returned");
    assert(second.wasIdempotent === true, "Idempotency: second call wasIdempotent is true");
  }
  
  console.log("\n3) attempt event increments campaign_contacts.attempts_total");
  
  await setupTestData();
  
  let enrollment = await getEnrollment();
  const initialAttempts = enrollment.attemptsTotal;
  
  await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_SENT",
    channel: "sms"
  });
  
  enrollment = await getEnrollment();
  assert(enrollment.attemptsTotal === initialAttempts + 1, `Attempt increment: attemptsTotal increased from ${initialAttempts} to ${enrollment.attemptsTotal}`);
  assert(enrollment.lastAttemptAt !== null, "Attempt increment: lastAttemptAt is set");
  
  await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "CALL_PLACED",
    channel: "voice"
  });
  
  enrollment = await getEnrollment();
  assert(enrollment.attemptsTotal === initialAttempts + 2, `Attempt increment: attemptsTotal is ${enrollment.attemptsTotal} after second attempt`);
  
  console.log("\n4) OPT_OUT sets campaign_contacts state DO_NOT_CONTACT");
  
  await setupTestData();
  
  result = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "OPT_OUT",
    channel: "sms"
  });
  
  enrollment = await getEnrollment();
  assert(enrollment.state === "DO_NOT_CONTACT", `OPT_OUT: state is ${enrollment.state}`);
  if (!("error" in result)) {
    assert(result.stateTransition?.after === "DO_NOT_CONTACT", "OPT_OUT: stateTransition.after is DO_NOT_CONTACT");
  }
  
  console.log("\n5) COMPLAINT sets campaign_contacts state DO_NOT_CONTACT");
  
  await setupTestData();
  
  result = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "COMPLAINT",
    channel: "sms"
  });
  
  enrollment = await getEnrollment();
  assert(enrollment.state === "DO_NOT_CONTACT", `COMPLAINT: state is ${enrollment.state}`);
  
  console.log("\n6) MESSAGE_REPLIED sets state ENGAGED");
  
  await setupTestData();
  
  result = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_REPLIED",
    channel: "sms"
  });
  
  enrollment = await getEnrollment();
  assert(enrollment.state === "ENGAGED", `MESSAGE_REPLIED: state is ${enrollment.state}`);
  if (!("error" in result)) {
    assert(result.stateTransition?.after === "ENGAGED", "MESSAGE_REPLIED: stateTransition.after is ENGAGED");
  }
  
  console.log("\n7) CALL_ANSWERED sets state ENGAGED");
  
  await setupTestData();
  
  await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "CALL_ANSWERED",
    channel: "voice"
  });
  
  enrollment = await getEnrollment();
  assert(enrollment.state === "ENGAGED", `CALL_ANSWERED: state is ${enrollment.state}`);
  
  console.log("\n8) Engagement event does NOT change state if already STOPPED");
  
  await setupTestData();
  
  await db.update(campaignContacts)
    .set({ state: "STOPPED" })
    .where(eq(campaignContacts.id, TEST_ENROLLMENT_ID));
  
  await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_REPLIED",
    channel: "sms"
  });
  
  enrollment = await getEnrollment();
  assert(enrollment.state === "STOPPED", `No transition from STOPPED: state is ${enrollment.state}`);
  
  console.log("\n9) Audit log created for event");
  
  await setupTestData();
  
  await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_SENT",
    channel: "sms"
  });
  
  const [auditLog] = await db.select()
    .from(campaignAuditLogs)
    .where(eq(campaignAuditLogs.companyId, TEST_COMPANY_ID))
    .limit(1);
  
  assert(!!auditLog, "Audit log: log exists");
  assert(auditLog?.logType === "event_emitted", "Audit log: logType is event_emitted");
  
  console.log("\n10) Error cases");
  
  result = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: "non-existent",
    contactId: TEST_CONTACT_ID,
    eventType: "MESSAGE_SENT"
  });
  assert("error" in result && result.status === 404, "Error: campaign not found returns 404");
  
  result = await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    contactId: "non-existent",
    eventType: "MESSAGE_SENT"
  });
  assert("error" in result && result.status === 404, "Error: contact not found returns 404");
  
  console.log("\n11) Race-safe idempotency (10 parallel inserts with same externalId)");
  
  await cleanupTestData();
  await setupTestData();
  
  const raceExternalId = `twilio:race-test-${Date.now()}`;
  
  // Fire 10 parallel inserts with same externalId
  const racePromises = Array.from({ length: 10 }, () =>
    emitCampaignEvent({
      companyId: TEST_COMPANY_ID,
      campaignId: TEST_CAMPAIGN_ID,
      contactId: TEST_CONTACT_ID,
      eventType: "MESSAGE_SENT",
      channel: "sms",
      provider: "twilio",
      externalId: raceExternalId
    })
  );
  
  const raceResults = await Promise.all(racePromises);
  
  // All should succeed (no errors)
  const successResults = raceResults.filter(r => !("error" in r));
  assert(successResults.length === 10, `Race: all 10 calls succeeded (got ${successResults.length})`);
  
  // All should return the same event ID
  const eventIds = successResults.map(r => (r as any).event.id);
  const uniqueIds = Array.from(new Set(eventIds));
  assert(uniqueIds.length === 1, `Race: all calls return same event id (got ${uniqueIds.length} unique)`);
  
  // Exactly 1 should be wasIdempotent=false (the winner), rest should be true
  const newInserts = successResults.filter(r => !(r as any).wasIdempotent);
  const idempotentHits = successResults.filter(r => (r as any).wasIdempotent);
  assert(newInserts.length === 1, `Race: exactly 1 new insert (got ${newInserts.length})`);
  assert(idempotentHits.length === 9, `Race: exactly 9 idempotent hits (got ${idempotentHits.length})`);
  
  // Verify only 1 row in DB
  const [raceCount] = await db.select({ count: sql<number>`count(*)` })
    .from(campaignEvents)
    .where(and(
      eq(campaignEvents.companyId, TEST_COMPANY_ID),
      eq(campaignEvents.externalId, raceExternalId)
    ));
  assert(Number(raceCount.count) === 1, `Race: only 1 row in DB (got ${raceCount.count})`);
  
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
