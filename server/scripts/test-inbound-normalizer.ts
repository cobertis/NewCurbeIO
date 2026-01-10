/**
 * Test: Inbound Normalizer v1
 * Tests intent detection, consent updates, suppression updates, and event emission.
 * 
 * Run: npx tsx server/scripts/test-inbound-normalizer.ts
 */

import { db } from "../db";
import { 
  contacts,
  contactConsents,
  contactSuppressions,
  campaignContacts,
  campaignEvents,
  orchestratorCampaigns
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { processInboundMessage, detectIntent, InboundChannel } from "../services/inbound-normalizer";

const testResults: { name: string; passed: boolean; error?: string }[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    testResults.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (error: any) {
    testResults.push({ name, passed: false, error: error.message });
    console.log(`  ✗ ${name}: ${error.message}`);
  }
}

async function cleanup(companyId: string): Promise<void> {
  await db.delete(campaignEvents).where(eq(campaignEvents.companyId, companyId));
  await db.delete(campaignContacts).where(eq(campaignContacts.companyId, companyId));
  await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, companyId));
  await db.delete(contactSuppressions).where(eq(contactSuppressions.companyId, companyId));
  await db.delete(contactConsents).where(eq(contactConsents.companyId, companyId));
  await db.delete(contacts).where(eq(contacts.companyId, companyId));
}

async function setupTestData(companyId: string, scenario: string): Promise<{
  contactId: string;
  campaignId: string;
  campaignContactId: string;
  phone: string;
}> {
  const phone = `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, "0")}`;
  
  const [contact] = await db.insert(contacts)
    .values({
      companyId,
      firstName: `Inbound-${scenario}`,
      lastName: "Test",
      phoneNormalized: phone,
      email: `inbound-${scenario}-${Date.now()}@test.com`
    })
    .returning();
  
  const [campaign] = await db.insert(orchestratorCampaigns)
    .values({
      companyId,
      name: `Inbound Test Campaign ${scenario}`,
      status: "active",
      policyJson: { maxAttemptsTotal: 10 }
    })
    .returning();
  
  const [campaignContact] = await db.insert(campaignContacts)
    .values({
      companyId,
      campaignId: campaign.id,
      contactId: contact.id,
      state: "ATTEMPTING"
    })
    .returning();
  
  return {
    contactId: contact.id,
    campaignId: campaign.id,
    campaignContactId: campaignContact.id,
    phone
  };
}

async function runTests(): Promise<void> {
  console.log("\n=== Inbound Normalizer Tests ===\n");
  
  const testCompanyId = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";
  
  await cleanup(testCompanyId);
  
  console.log("1) Intent Detection (Unit Tests)");
  
  await test("STOP => OPT_OUT", async () => {
    assert(detectIntent("STOP") === "OPT_OUT", "Expected OPT_OUT");
  });
  
  await test("stop (lowercase) => OPT_OUT", async () => {
    assert(detectIntent("stop") === "OPT_OUT", "Expected OPT_OUT");
  });
  
  await test("UNSUBSCRIBE => OPT_OUT", async () => {
    assert(detectIntent("UNSUBSCRIBE") === "OPT_OUT", "Expected OPT_OUT");
  });
  
  await test("PARAR => OPT_OUT", async () => {
    assert(detectIntent("PARAR") === "OPT_OUT", "Expected OPT_OUT");
  });
  
  await test("NO MOLESTAR => OPT_OUT", async () => {
    assert(detectIntent("no molestar") === "OPT_OUT", "Expected OPT_OUT");
  });
  
  await test("not interested => NOT_INTERESTED", async () => {
    assert(detectIntent("I am not interested") === "NOT_INTERESTED", "Expected NOT_INTERESTED");
  });
  
  await test("no gracias => NOT_INTERESTED", async () => {
    assert(detectIntent("no gracias") === "NOT_INTERESTED", "Expected NOT_INTERESTED");
  });
  
  await test("Hello there => MESSAGE_REPLIED", async () => {
    assert(detectIntent("Hello there") === "MESSAGE_REPLIED", "Expected MESSAGE_REPLIED");
  });
  
  await test("Thanks for the info => MESSAGE_REPLIED", async () => {
    assert(detectIntent("Thanks for the info") === "MESSAGE_REPLIED", "Expected MESSAGE_REPLIED");
  });
  
  console.log("\n2) OPT_OUT Processing (Full Flow)");
  
  await test("STOP => emits OPT_OUT + updates consent + updates suppression + DNC", async () => {
    await cleanup(testCompanyId);
    const { contactId, campaignId, campaignContactId, phone } = await setupTestData(testCompanyId, "stop");
    
    const result = await processInboundMessage({
      provider: "bridge",
      channel: "sms",
      from: phone,
      text: "STOP"
    });
    
    assert(result.success === true, "Expected success");
    assert(result.intent === "OPT_OUT", `Expected intent=OPT_OUT, got ${result.intent}`);
    assert(result.eventsEmitted >= 1, `Expected at least 1 event, got ${result.eventsEmitted}`);
    
    // Check consent updated
    const [consent] = await db.select()
      .from(contactConsents)
      .where(and(
        eq(contactConsents.contactId, contactId),
        eq(contactConsents.channel, "sms")
      ))
      .limit(1);
    
    assert(!!consent, "Consent record should exist");
    assert(consent.status === "opt_out", `Expected consent status=opt_out, got ${consent.status}`);
    
    // Check suppression updated
    const [suppression] = await db.select()
      .from(contactSuppressions)
      .where(eq(contactSuppressions.contactId, contactId))
      .limit(1);
    
    assert(!!suppression, "Suppression record should exist");
    assert(suppression.suppressionStatus === "opted_out", `Expected suppression=opted_out, got ${suppression.suppressionStatus}`);
    
    // Check campaign_contact state is DO_NOT_CONTACT
    const [cc] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);
    
    assert(cc.state === "DO_NOT_CONTACT", `Expected state=DO_NOT_CONTACT, got ${cc.state}`);
    
    // Check OPT_OUT event emitted
    const events = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "OPT_OUT")
      ));
    
    assert(events.length === 1, `Expected 1 OPT_OUT event, got ${events.length}`);
  });
  
  console.log("\n3) MESSAGE_REPLIED Processing (Full Flow)");
  
  await test("Normal reply => emits MESSAGE_REPLIED + sets ENGAGED", async () => {
    await cleanup(testCompanyId);
    const { contactId, campaignId, campaignContactId, phone } = await setupTestData(testCompanyId, "reply");
    
    const result = await processInboundMessage({
      provider: "bridge",
      channel: "imessage",
      from: phone,
      text: "Hi, I got your message"
    });
    
    assert(result.success === true, "Expected success");
    assert(result.intent === "MESSAGE_REPLIED", `Expected intent=MESSAGE_REPLIED, got ${result.intent}`);
    assert(result.eventsEmitted >= 1, `Expected at least 1 event, got ${result.eventsEmitted}`);
    
    // Check campaign_contact state is ENGAGED
    const [cc] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);
    
    assert(cc.state === "ENGAGED", `Expected state=ENGAGED, got ${cc.state}`);
    
    // Check MESSAGE_REPLIED event emitted
    const events = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "MESSAGE_REPLIED")
      ));
    
    assert(events.length === 1, `Expected 1 MESSAGE_REPLIED event, got ${events.length}`);
  });
  
  console.log("\n4) Unknown Contact");
  
  await test("Unknown phone => success=true but no events", async () => {
    await cleanup(testCompanyId);
    
    const result = await processInboundMessage({
      provider: "twilio",
      channel: "sms",
      from: "+15550000000",
      text: "Hello"
    });
    
    assert(result.success === true, "Expected success (graceful handling)");
    assert(result.eventsEmitted === 0, `Expected 0 events for unknown contact, got ${result.eventsEmitted}`);
    assert(!!result.error && result.error.includes("Unknown contact"), "Expected unknown contact message");
  });
  
  console.log("\n5) Multiple Enrollments");
  
  await test("STOP affects all active enrollments", async () => {
    await cleanup(testCompanyId);
    
    // Create contact with 2 active campaigns
    const phone = `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, "0")}`;
    
    const [contact] = await db.insert(contacts)
      .values({
        companyId: testCompanyId,
        firstName: "MultiEnroll",
        lastName: "Test",
        phoneNormalized: phone,
        email: `multi-${Date.now()}@test.com`
      })
      .returning();
    
    // Campaign 1
    const [campaign1] = await db.insert(orchestratorCampaigns)
      .values({
        companyId: testCompanyId,
        name: "Multi Campaign 1",
        status: "active",
        policyJson: {}
      })
      .returning();
    
    const [cc1] = await db.insert(campaignContacts)
      .values({
        companyId: testCompanyId,
        campaignId: campaign1.id,
        contactId: contact.id,
        state: "ATTEMPTING"
      })
      .returning();
    
    // Campaign 2
    const [campaign2] = await db.insert(orchestratorCampaigns)
      .values({
        companyId: testCompanyId,
        name: "Multi Campaign 2",
        status: "active",
        policyJson: {}
      })
      .returning();
    
    const [cc2] = await db.insert(campaignContacts)
      .values({
        companyId: testCompanyId,
        campaignId: campaign2.id,
        contactId: contact.id,
        state: "NEW"
      })
      .returning();
    
    const result = await processInboundMessage({
      provider: "bridge",
      channel: "sms",
      from: phone,
      text: "STOP"
    });
    
    assert(result.enrollmentsUpdated === 2, `Expected 2 enrollments updated, got ${result.enrollmentsUpdated}`);
    assert(result.eventsEmitted === 2, `Expected 2 events emitted, got ${result.eventsEmitted}`);
    
    // Both should be DO_NOT_CONTACT
    const [updated1] = await db.select().from(campaignContacts).where(eq(campaignContacts.id, cc1.id));
    const [updated2] = await db.select().from(campaignContacts).where(eq(campaignContacts.id, cc2.id));
    
    assert(updated1.state === "DO_NOT_CONTACT", `Expected cc1 DO_NOT_CONTACT, got ${updated1.state}`);
    assert(updated2.state === "DO_NOT_CONTACT", `Expected cc2 DO_NOT_CONTACT, got ${updated2.state}`);
  });
  
  console.log("\n6) Spanish Keywords");
  
  await test("ALTO => OPT_OUT", async () => {
    await cleanup(testCompanyId);
    const { phone } = await setupTestData(testCompanyId, "alto");
    
    const result = await processInboundMessage({
      provider: "bridge",
      channel: "sms",
      from: phone,
      text: "ALTO"
    });
    
    assert(result.intent === "OPT_OUT", `Expected OPT_OUT, got ${result.intent}`);
  });
  
  await test("BASTA => OPT_OUT", async () => {
    await cleanup(testCompanyId);
    const { phone } = await setupTestData(testCompanyId, "basta");
    
    const result = await processInboundMessage({
      provider: "bridge",
      channel: "sms",
      from: phone,
      text: "BASTA"
    });
    
    assert(result.intent === "OPT_OUT", `Expected OPT_OUT, got ${result.intent}`);
  });
  
  await cleanup(testCompanyId);
  
  console.log("\n=== Results ===");
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${testResults.length}`);
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
  
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
});
