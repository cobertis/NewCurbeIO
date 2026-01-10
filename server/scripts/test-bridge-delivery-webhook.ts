/**
 * TICKET 5.4 VERIFICATION: Bridge Delivery Status Webhook Tests
 * Tests: delivered, failed, invalid token, idempotency
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  orchestratorCampaigns,
  contacts 
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const BASE_URL = "http://localhost:5000";
const VALID_TOKEN = process.env.BRIDGE_WEBHOOK_TOKEN || "test-bridge-token-12345";
const CURBE_COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function setupTestData() {
  // Get existing campaign and contact
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, CURBE_COMPANY_ID))
    .limit(1);
  
  if (!campaign) {
    throw new Error("No test campaign found. Run orchestrator tests first.");
  }
  
  const [cc] = await db.select()
    .from(campaignContacts)
    .where(eq(campaignContacts.campaignId, campaign.id))
    .limit(1);
  
  if (!cc) {
    throw new Error("No campaign contacts found.");
  }
  
  // Create a MESSAGE_SENT event to simulate an outbound message
  const testExternalId = `test:bridge:${Date.now()}`;
  const testProviderId = `provider-msg-${Date.now()}`;
  
  const [sentEvent] = await db.insert(campaignEvents)
    .values({
      companyId: CURBE_COMPANY_ID,
      campaignId: campaign.id,
      campaignContactId: cc.id,
      contactId: cc.contactId,
      eventType: "MESSAGE_SENT",
      channel: "sms",
      provider: "twilio",
      externalId: testExternalId,
      payload: { 
        text: "Test message for delivery tracking",
        providerId: testProviderId
      }
    })
    .returning();
  
  console.log(`Created test MESSAGE_SENT event: ${sentEvent.id}`);
  console.log(`  externalId: ${testExternalId}`);
  console.log(`  providerId in payload: ${testProviderId}`);
  
  return { campaign, cc, sentEvent, testExternalId, testProviderId };
}

async function testInvalidToken() {
  console.log("\n[TEST 1] Invalid token (should return 401)");
  
  const res = await fetch(`${BASE_URL}/api/webhooks/bridge-delivery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Token": "wrong-token-12345"
    },
    body: JSON.stringify({
      provider: "twilio",
      messageId: "test123",
      status: "delivered"
    })
  });
  
  const passed = res.status === 401;
  const body = await res.json();
  
  results.push({
    name: "Invalid token returns 401",
    passed,
    details: `Status: ${res.status}, Body: ${JSON.stringify(body)}`
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${JSON.stringify(body)}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testDelivered(testExternalId: string) {
  console.log("\n[TEST 2] Delivered status (should emit MESSAGE_DELIVERED)");
  
  const res = await fetch(`${BASE_URL}/api/webhooks/bridge-delivery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Token": VALID_TOKEN
    },
    body: JSON.stringify({
      provider: "twilio",
      externalId: testExternalId,
      status: "delivered",
      timestamp: new Date().toISOString()
    })
  });
  
  const body = await res.json();
  const passed = res.status === 200 && body.success && body.eventType === "MESSAGE_DELIVERED";
  
  results.push({
    name: "Delivered status creates MESSAGE_DELIVERED event",
    passed,
    details: `Status: ${res.status}, EventId: ${body.eventId}, EventType: ${body.eventType}`
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${JSON.stringify(body, null, 2)}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return body.eventId;
}

async function testIdempotency(testExternalId: string, firstEventId: string) {
  console.log("\n[TEST 3] Idempotency (duplicate delivered should not create new event)");
  
  const res = await fetch(`${BASE_URL}/api/webhooks/bridge-delivery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Token": VALID_TOKEN
    },
    body: JSON.stringify({
      provider: "twilio",
      externalId: testExternalId,
      status: "delivered",
      timestamp: new Date().toISOString()
    })
  });
  
  const body = await res.json();
  const passed = res.status === 200 && body.idempotent === true && body.eventId === firstEventId;
  
  results.push({
    name: "Duplicate delivery is idempotent (same event ID)",
    passed,
    details: `Idempotent: ${body.idempotent}, SameEventId: ${body.eventId === firstEventId}`
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${JSON.stringify(body, null, 2)}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testFailed(testExternalId: string) {
  console.log("\n[TEST 4] Failed status (should emit MESSAGE_FAILED with isFinal)");
  
  // Create another MESSAGE_SENT for the failed test
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, CURBE_COMPANY_ID))
    .limit(1);
  
  const [cc] = await db.select()
    .from(campaignContacts)
    .where(eq(campaignContacts.campaignId, campaign!.id))
    .limit(1);
  
  const failedExternalId = `test:failed:${Date.now()}`;
  
  await db.insert(campaignEvents)
    .values({
      companyId: CURBE_COMPANY_ID,
      campaignId: campaign!.id,
      campaignContactId: cc!.id,
      contactId: cc!.contactId,
      eventType: "MESSAGE_SENT",
      channel: "sms",
      provider: "twilio",
      externalId: failedExternalId,
      payload: { text: "This message will fail" }
    });
  
  const res = await fetch(`${BASE_URL}/api/webhooks/bridge-delivery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Token": VALID_TOKEN
    },
    body: JSON.stringify({
      provider: "twilio",
      externalId: failedExternalId,
      status: "failed",
      error: "Carrier rejected: Invalid number",
      timestamp: new Date().toISOString()
    })
  });
  
  const body = await res.json();
  const passed = res.status === 200 && body.success && body.eventType === "MESSAGE_FAILED";
  
  results.push({
    name: "Failed status creates MESSAGE_FAILED event",
    passed,
    details: `Status: ${res.status}, EventType: ${body.eventType}`
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${JSON.stringify(body, null, 2)}`);
  
  // Verify the event has isFinal in payload
  if (body.eventId) {
    const [event] = await db.select()
      .from(campaignEvents)
      .where(eq(campaignEvents.id, body.eventId))
      .limit(1);
    
    const hasFinalFlag = (event?.payload as any)?.isFinal === true;
    console.log(`isFinal in payload: ${hasFinalFlag}`);
    
    if (!hasFinalFlag) {
      results[results.length - 1].passed = false;
      results[results.length - 1].details += ", isFinal flag missing";
    }
  }
  
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testMissingEvent() {
  console.log("\n[TEST 5] Unknown messageId (should return 404)");
  
  const res = await fetch(`${BASE_URL}/api/webhooks/bridge-delivery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Token": VALID_TOKEN
    },
    body: JSON.stringify({
      provider: "twilio",
      messageId: "non-existent-message-id-12345",
      status: "delivered"
    })
  });
  
  const body = await res.json();
  const passed = res.status === 404;
  
  results.push({
    name: "Unknown message returns 404",
    passed,
    details: `Status: ${res.status}`
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${JSON.stringify(body)}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testMatchByProviderId(testProviderId: string) {
  console.log("\n[TEST 6] Match by providerId in payload");
  
  // Create a new MESSAGE_SENT with providerId for this test
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, CURBE_COMPANY_ID))
    .limit(1);
  
  const [cc] = await db.select()
    .from(campaignContacts)
    .where(eq(campaignContacts.campaignId, campaign!.id))
    .limit(1);
  
  const providerMsgId = `provider-lookup-${Date.now()}`;
  
  await db.insert(campaignEvents)
    .values({
      companyId: CURBE_COMPANY_ID,
      campaignId: campaign!.id,
      campaignContactId: cc!.id,
      contactId: cc!.contactId,
      eventType: "MESSAGE_SENT",
      channel: "sms",
      provider: "twilio",
      externalId: `unique:${Date.now()}`,
      payload: { 
        text: "Test providerId lookup",
        providerId: providerMsgId
      }
    });
  
  const res = await fetch(`${BASE_URL}/api/webhooks/bridge-delivery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Token": VALID_TOKEN
    },
    body: JSON.stringify({
      provider: "twilio",
      messageId: providerMsgId,  // Using messageId (providerId lookup)
      status: "delivered"
    })
  });
  
  const body = await res.json();
  const passed = res.status === 200 && body.success;
  
  results.push({
    name: "Match by payload.providerId works",
    passed,
    details: `Status: ${res.status}, Found: ${body.success}`
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${JSON.stringify(body, null, 2)}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function showDeliveryEvents() {
  console.log("\n[EVIDENCE] Recent delivery events in campaign_events:");
  
  const events = await db.select({
    id: campaignEvents.id,
    eventType: campaignEvents.eventType,
    externalId: campaignEvents.externalId,
    payload: campaignEvents.payload,
    createdAt: campaignEvents.createdAt
  })
    .from(campaignEvents)
    .where(sql`event_type IN ('MESSAGE_DELIVERED', 'MESSAGE_FAILED')`)
    .orderBy(desc(campaignEvents.createdAt))
    .limit(5);
  
  for (const e of events) {
    console.log(`  ${e.eventType}: ${e.externalId}`);
    console.log(`    payload.isFinal: ${(e.payload as any)?.isFinal}`);
    console.log(`    created: ${e.createdAt}`);
  }
}

async function runTests() {
  console.log("=".repeat(70));
  console.log("TICKET 5.4 VERIFICATION: Bridge Delivery Status Webhook");
  console.log("=".repeat(70));
  
  // Setup
  const { testExternalId, testProviderId } = await setupTestData();
  
  // Run tests
  await testInvalidToken();
  const eventId = await testDelivered(testExternalId);
  await testIdempotency(testExternalId, eventId);
  await testFailed(testExternalId);
  await testMissingEvent();
  await testMatchByProviderId(testProviderId);
  
  // Show evidence
  await showDeliveryEvents();
  
  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("TEST SUMMARY");
  console.log("=".repeat(70));
  
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    console.log(`${r.passed ? "✓" : "✗"} ${r.name}`);
    if (r.passed) passed++; else failed++;
  }
  
  console.log(`\nTotal: ${passed}/${results.length} passed`);
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.name}: ${r.details}`);
    }
  }
  
  console.log("=".repeat(70));
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
