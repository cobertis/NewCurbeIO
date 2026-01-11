/**
 * Test Suite for Telnyx Call Webhook Handler (Ticket 11.2)
 * Tests:
 * 1. call.answered -> job done + CALL_ANSWERED event
 * 2. call.hangup (normal_clearing) -> job done + CALL_ANSWERED
 * 3. call.hangup (no_answer) -> job done + CALL_NO_ANSWER
 * 4. call.hangup (user_busy) -> job done + CALL_BUSY
 * 5. Idempotency: same event processed twice doesn't duplicate
 * 6. Job not found -> action="not_found"
 */

import { db } from "../db";
import { 
  orchestratorJobs, 
  campaignEvents, 
  orchestratorCampaigns,
  campaignContacts
} from "@shared/schema";
import { eq, and, like } from "drizzle-orm";
import { 
  processCallWebhook, 
  mapTelnyxEventToOutcome,
  decodeClientState,
  TelnyxWebhookPayload 
} from "../services/telnyx-call-webhook";
import { emitCampaignEvent } from "../services/campaign-events";
import { nanoid } from "nanoid";

const TEST_COMPANY_ID = "test-webhook-company-" + nanoid(6);
const TEST_CONTACT_ID = "test-webhook-contact-" + nanoid(6);
const TEST_CAMPAIGN_ID = "test-webhook-campaign-" + nanoid(6);
const TEST_ENROLLMENT_ID = "test-webhook-enroll-" + nanoid(6);

async function setupTestData() {
  const [existingCampaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.id, TEST_CAMPAIGN_ID))
    .limit(1);
  
  if (!existingCampaign) {
    const testSlug = `testwh${nanoid(4)}`.toLowerCase();
    await db.execute(`
      INSERT INTO companies (id, name, email, slug)
      VALUES ('${TEST_COMPANY_ID}', 'Test Webhook Company', 'test@webhook.test', '${testSlug}')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(`
      INSERT INTO contacts (id, company_id, first_name, last_name, phone_normalized)
      VALUES ('${TEST_CONTACT_ID}', '${TEST_COMPANY_ID}', 'Test', 'Webhook', '+15559876543')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(`
      INSERT INTO orchestrator_campaigns (id, company_id, name, status, policy_json)
      VALUES ('${TEST_CAMPAIGN_ID}', '${TEST_COMPANY_ID}', 'Test Webhook Campaign', 'running', '{}')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(`
      INSERT INTO campaign_contacts (id, company_id, campaign_id, contact_id, state)
      VALUES ('${TEST_ENROLLMENT_ID}', '${TEST_COMPANY_ID}', '${TEST_CAMPAIGN_ID}', '${TEST_CONTACT_ID}', 'NEW')
      ON CONFLICT (id) DO NOTHING
    `);
  }
}

async function cleanupTestData() {
  await db.delete(campaignEvents)
    .where(eq(campaignEvents.companyId, TEST_COMPANY_ID));
  
  await db.delete(orchestratorJobs)
    .where(eq(orchestratorJobs.companyId, TEST_COMPANY_ID));
}

async function createTestJob(externalId: string, providerCallId: string) {
  const [job] = await db.insert(orchestratorJobs)
    .values({
      companyId: TEST_COMPANY_ID,
      campaignId: TEST_CAMPAIGN_ID,
      campaignContactId: TEST_ENROLLMENT_ID,
      contactId: TEST_CONTACT_ID,
      channel: "voice",
      status: "processing",
      runAt: new Date(Date.now() - 1000),
      startedAt: new Date(),
      externalId,
      payload: { to: "+15559876543" },
      retryCount: 0
    })
    .returning();
  
  await emitCampaignEvent({
    companyId: TEST_COMPANY_ID,
    campaignId: TEST_CAMPAIGN_ID,
    campaignContactId: TEST_ENROLLMENT_ID,
    contactId: TEST_CONTACT_ID,
    eventType: "CALL_PLACED",
    channel: "voice",
    provider: "telnyx",
    externalId: `job:${externalId}:call_placed`,
    payload: { providerCallId, provider: "telnyx" }
  });
  
  return job;
}

function createWebhookPayload(
  eventType: string, 
  callControlId: string, 
  hangupCause?: string
): TelnyxWebhookPayload {
  return {
    data: {
      event_type: eventType,
      id: `evt_${nanoid(10)}`,
      occurred_at: new Date().toISOString(),
      payload: {
        call_control_id: callControlId,
        call_leg_id: `leg_${nanoid(8)}`,
        call_session_id: `session_${nanoid(8)}`,
        from: "+15551234567",
        to: "+15559876543",
        hangup_cause: hangupCause,
        state: eventType === "call.answered" ? "active" : "ended"
      },
      record_type: "event"
    }
  };
}

async function runTests() {
  console.log("============================================================");
  console.log("TICKET 11.2: Telnyx Call Webhook Handler - Test Suite");
  console.log("============================================================\n");
  
  let passed = 0;
  let failed = 0;
  
  await setupTestData();
  
  // TEST 1: call.answered -> job done + CALL_ANSWERED
  console.log("[TEST 1] call.answered -> job done + CALL_ANSWERED event");
  try {
    await cleanupTestData();
    
    const externalId = `test-wh-1-${nanoid(6)}`;
    const callControlId = `call_${nanoid(12)}`;
    await createTestJob(externalId, callControlId);
    
    const payload = createWebhookPayload("call.answered", callControlId);
    const result = await processCallWebhook(payload);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const [event] = await db.select()
      .from(campaignEvents)
      .where(like(campaignEvents.externalId, `telnyx:${callControlId}:%`))
      .limit(1);
    
    if (result.action === "job_updated" && result.outcome === "answered" && 
        job?.status === "done" && event?.eventType === "CALL_ANSWERED") {
      console.log(`  Result: action=${result.action}, outcome=${result.outcome}`);
      console.log(`  Job status: ${job.status}`);
      console.log(`  Event: ${event.eventType}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Result: ${JSON.stringify(result)}`);
      console.log(`  Job: ${job?.status}, Event: ${event?.eventType}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 2: call.hangup (normal_clearing) -> job done + CALL_ANSWERED
  console.log("[TEST 2] call.hangup (normal_clearing) -> job done + CALL_ANSWERED");
  try {
    await cleanupTestData();
    
    const externalId = `test-wh-2-${nanoid(6)}`;
    const callControlId = `call_${nanoid(12)}`;
    await createTestJob(externalId, callControlId);
    
    const payload = createWebhookPayload("call.hangup", callControlId, "normal_clearing");
    const result = await processCallWebhook(payload);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    if (result.action === "job_updated" && result.outcome === "answered" && job?.status === "done") {
      console.log(`  Result: action=${result.action}, outcome=${result.outcome}`);
      console.log(`  Job status: ${job.status}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Result: ${JSON.stringify(result)}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 3: call.hangup (no_answer) -> job done + CALL_NO_ANSWER
  console.log("[TEST 3] call.hangup (no_answer) -> job done + CALL_NO_ANSWER");
  try {
    await cleanupTestData();
    
    const externalId = `test-wh-3-${nanoid(6)}`;
    const callControlId = `call_${nanoid(12)}`;
    await createTestJob(externalId, callControlId);
    
    const payload = createWebhookPayload("call.hangup", callControlId, "no_answer");
    const result = await processCallWebhook(payload);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const [event] = await db.select()
      .from(campaignEvents)
      .where(like(campaignEvents.externalId, `telnyx:${callControlId}:%`))
      .limit(1);
    
    if (result.outcome === "no_answer" && job?.status === "done" && event?.eventType === "CALL_NO_ANSWER") {
      console.log(`  Result: outcome=${result.outcome}`);
      console.log(`  Job: ${job.status}, Event: ${event.eventType}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Result: ${JSON.stringify(result)}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 4: call.hangup (user_busy) -> job done + CALL_BUSY
  console.log("[TEST 4] call.hangup (user_busy) -> job done + CALL_BUSY");
  try {
    await cleanupTestData();
    
    const externalId = `test-wh-4-${nanoid(6)}`;
    const callControlId = `call_${nanoid(12)}`;
    await createTestJob(externalId, callControlId);
    
    const payload = createWebhookPayload("call.hangup", callControlId, "user_busy");
    const result = await processCallWebhook(payload);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const [event] = await db.select()
      .from(campaignEvents)
      .where(like(campaignEvents.externalId, `telnyx:${callControlId}:%`))
      .limit(1);
    
    if (result.outcome === "busy" && job?.status === "done" && event?.eventType === "CALL_BUSY") {
      console.log(`  Result: outcome=${result.outcome}`);
      console.log(`  Job: ${job.status}, Event: ${event.eventType}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Result: ${JSON.stringify(result)}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 5: Idempotency - same event processed twice
  console.log("[TEST 5] Idempotency - same event processed twice doesn't duplicate");
  try {
    await cleanupTestData();
    
    const externalId = `test-wh-5-${nanoid(6)}`;
    const callControlId = `call_${nanoid(12)}`;
    await createTestJob(externalId, callControlId);
    
    const payload = createWebhookPayload("call.answered", callControlId);
    
    const result1 = await processCallWebhook(payload);
    const result2 = await processCallWebhook(payload);
    
    const events = await db.select()
      .from(campaignEvents)
      .where(like(campaignEvents.externalId, `telnyx:${callControlId}:%`));
    
    if (result1.action === "job_updated" && result2.action === "no_op" && events.length === 1) {
      console.log(`  First call: ${result1.action}`);
      console.log(`  Second call: ${result2.action} (idempotent)`);
      console.log(`  Event count: ${events.length}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  result1=${result1.action}, result2=${result2.action}, events=${events.length}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 6: Job not found -> action="not_found"
  console.log("[TEST 6] Unknown call_control_id -> action=not_found");
  try {
    await cleanupTestData();
    
    const unknownCallId = `call_unknown_${nanoid(12)}`;
    const payload = createWebhookPayload("call.answered", unknownCallId);
    
    const result = await processCallWebhook(payload);
    
    if (result.action === "not_found" && result.success === false) {
      console.log(`  Result: action=${result.action}, success=${result.success}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Result: ${JSON.stringify(result)}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 7: Unit test - mapTelnyxEventToOutcome
  console.log("[TEST 7] Unit test - mapTelnyxEventToOutcome mapping");
  try {
    const tests = [
      { event: "call.answered", hangup: undefined, expected: "answered" },
      { event: "call.hangup", hangup: "normal_clearing", expected: "answered" },
      { event: "call.hangup", hangup: "no_answer", expected: "no_answer" },
      { event: "call.hangup", hangup: "user_busy", expected: "busy" },
      { event: "call.hangup", hangup: "unallocated_number", expected: "failed" },
      { event: "call.ringing", hangup: undefined, expected: null },
      { event: "call.initiated", hangup: undefined, expected: null },
    ];
    
    let allPassed = true;
    for (const t of tests) {
      const result = mapTelnyxEventToOutcome(t.event, t.hangup);
      if (result !== t.expected) {
        console.log(`  FAIL: ${t.event}/${t.hangup} -> ${result} (expected ${t.expected})`);
        allPassed = false;
      }
    }
    
    if (allPassed) {
      console.log(`  All ${tests.length} mappings correct`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 8: Unit test - decodeClientState
  console.log("[TEST 8] Unit test - decodeClientState base64 decoding");
  try {
    const testState = { companyId: "test-123", jobId: "job-456" };
    const encoded = Buffer.from(JSON.stringify(testState)).toString("base64");
    
    const decoded = decodeClientState(encoded);
    const nullResult = decodeClientState(undefined);
    const invalidResult = decodeClientState("not-valid-base64!!!");
    
    if (decoded?.companyId === "test-123" && decoded?.jobId === "job-456" &&
        nullResult === null && invalidResult === null) {
      console.log(`  Decoded: companyId=${decoded.companyId}, jobId=${decoded.jobId}`);
      console.log(`  Null input: ${nullResult}`);
      console.log(`  Invalid input: ${invalidResult}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  decoded=${JSON.stringify(decoded)}, null=${nullResult}, invalid=${invalidResult}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 9: SECURITY - Cross-tenant attack blocked
  console.log("[TEST 9] SECURITY - Cross-tenant attack blocked (forged client_state)");
  try {
    await cleanupTestData();
    
    const externalId = `test-wh-9-${nanoid(6)}`;
    const callControlId = `call_${nanoid(12)}`;
    await createTestJob(externalId, callControlId);
    
    const forgedClientState = { companyId: "other-company-id", jobId: "some-other-job" };
    const forgedBase64 = Buffer.from(JSON.stringify(forgedClientState)).toString("base64");
    
    const payload = createWebhookPayload("call.answered", callControlId);
    payload.data.payload.client_state = forgedBase64;
    
    const result = await processCallWebhook(payload);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    if (result.action === "not_found" && job?.status === "processing") {
      console.log(`  Forged company attack: action=${result.action}`);
      console.log(`  Job still in processing (not updated): ${job.status}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Result: ${JSON.stringify(result)}`);
      console.log(`  Job status: ${job?.status} (should be processing)`);
      console.log("RESULT: FAIL ✗ - Cross-tenant attack NOT blocked!\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // Cleanup
  await cleanupTestData();
  
  console.log("============================================================");
  console.log("SUMMARY");
  console.log("============================================================");
  console.log(`Total: ${passed}/${passed + failed} tests passed`);
  console.log("============================================================");
  
  return passed === 9;
}

runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
