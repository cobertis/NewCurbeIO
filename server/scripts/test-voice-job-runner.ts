/**
 * Test Suite for Voice/Voicemail Job Runner (Ticket 11.1)
 * Tests:
 * 1. Voice success answered -> job done + CALL_PLACED + CALL_ANSWERED
 * 2. Voice no answer -> job done + CALL_PLACED + CALL_NO_ANSWER
 * 3. Voice provider error -> retry + CALL_FAILED (attempt) + final fail
 * 4. Voicemail drop ok -> VOICEMAIL_DROPPED
 * 5. Idempotency: run twice doesn't duplicate events
 */

import { db } from "../db";
import { 
  orchestratorJobs, 
  campaignEvents, 
  orchestratorCampaigns,
  campaignContacts,
  contacts
} from "@shared/schema";
import { eq, and, like } from "drizzle-orm";
import { runJobsOnce } from "../workers/job-runner";
import { MockVoiceAdapter } from "../services/channel-adapters/voice-adapter";
import { MockBridgeAdapter } from "../services/channel-adapters/bridge-imessage-sms";
import { nanoid } from "nanoid";

const TEST_COMPANY_ID = "test-voice-company-" + nanoid(6);
const TEST_CONTACT_ID = "test-voice-contact-" + nanoid(6);
const TEST_CAMPAIGN_ID = "test-voice-campaign-" + nanoid(6);
const TEST_ENROLLMENT_ID = "test-voice-enroll-" + nanoid(6);

async function setupTestData() {
  const [existingCampaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.id, TEST_CAMPAIGN_ID))
    .limit(1);
  
  if (!existingCampaign) {
    const testSlug = `testvoice${nanoid(4)}`.toLowerCase();
    await db.execute(`
      INSERT INTO companies (id, name, email, slug)
      VALUES ('${TEST_COMPANY_ID}', 'Test Voice Company', 'test@voice.test', '${testSlug}')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(`
      INSERT INTO contacts (id, company_id, first_name, last_name, phone_normalized)
      VALUES ('${TEST_CONTACT_ID}', '${TEST_COMPANY_ID}', 'Test', 'Voice', '+15551234567')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(`
      INSERT INTO orchestrator_campaigns (id, company_id, name, status, policy_json)
      VALUES ('${TEST_CAMPAIGN_ID}', '${TEST_COMPANY_ID}', 'Test Voice Campaign', 'running', '{}')
      ON CONFLICT (id) DO NOTHING
    `);
    
    await db.execute(`
      INSERT INTO campaign_contacts (id, company_id, campaign_id, contact_id, state)
      VALUES ('${TEST_ENROLLMENT_ID}', '${TEST_COMPANY_ID}', '${TEST_CAMPAIGN_ID}', '${TEST_CONTACT_ID}', 'NEW')
      ON CONFLICT (id) DO NOTHING
    `);
  }
}

async function cleanupTestJobs() {
  await db.delete(campaignEvents)
    .where(eq(campaignEvents.companyId, TEST_COMPANY_ID));
  
  await db.delete(orchestratorJobs)
    .where(eq(orchestratorJobs.companyId, TEST_COMPANY_ID));
}

async function createTestJob(channel: string, externalId: string, payload: Record<string, any> = {}) {
  const [job] = await db.insert(orchestratorJobs)
    .values({
      companyId: TEST_COMPANY_ID,
      campaignId: TEST_CAMPAIGN_ID,
      campaignContactId: TEST_ENROLLMENT_ID,
      contactId: TEST_CONTACT_ID,
      channel,
      status: "queued",
      runAt: new Date(Date.now() - 1000),
      externalId,
      payload: {
        to: "+15551234567",
        ...payload
      },
      retryCount: 0
    })
    .returning();
  
  return job;
}

async function getEventsByExternalIdPrefix(prefix: string) {
  return db.select()
    .from(campaignEvents)
    .where(and(
      eq(campaignEvents.companyId, TEST_COMPANY_ID),
      like(campaignEvents.externalId, `${prefix}%`)
    ));
}

async function runTests() {
  console.log("============================================================");
  console.log("TICKET 11.1: Voice/Voicemail Job Runner - Test Suite");
  console.log("============================================================\n");
  
  let passed = 0;
  let failed = 0;
  
  const mockVoiceAdapter = new MockVoiceAdapter();
  const mockBridgeAdapter = new MockBridgeAdapter();
  
  await setupTestData();
  
  // TEST 1: Voice success answered -> job done + CALL_PLACED + CALL_ANSWERED
  console.log("[TEST 1] Voice call answered -> job done + CALL_PLACED + CALL_ANSWERED");
  try {
    await cleanupTestJobs();
    mockVoiceAdapter.reset();
    mockVoiceAdapter.setOutcome("answered");
    
    const externalId = `test-voice-1-${nanoid(6)}`;
    await createTestJob("voice", externalId);
    
    const result = await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const events = await getEventsByExternalIdPrefix(`job:${externalId}`);
    const callPlaced = events.find(e => e.eventType === "CALL_PLACED");
    const callAnswered = events.find(e => e.eventType === "CALL_ANSWERED");
    
    if (job?.status === "done" && callPlaced && callAnswered) {
      console.log(`  Job status: ${job.status}`);
      console.log(`  Events: CALL_PLACED, CALL_ANSWERED`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Job status: ${job?.status}, Events: ${events.map(e => e.eventType).join(", ")}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 2: Voice no answer -> job done + CALL_PLACED + CALL_NO_ANSWER
  console.log("[TEST 2] Voice call no answer -> job done + CALL_PLACED + CALL_NO_ANSWER");
  try {
    await cleanupTestJobs();
    mockVoiceAdapter.reset();
    mockVoiceAdapter.setOutcome("no_answer");
    
    const externalId = `test-voice-2-${nanoid(6)}`;
    await createTestJob("voice", externalId);
    
    await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const events = await getEventsByExternalIdPrefix(`job:${externalId}`);
    const callPlaced = events.find(e => e.eventType === "CALL_PLACED");
    const callNoAnswer = events.find(e => e.eventType === "CALL_NO_ANSWER");
    
    if (job?.status === "done" && callPlaced && callNoAnswer) {
      console.log(`  Job status: ${job.status}`);
      console.log(`  Events: CALL_PLACED, CALL_NO_ANSWER`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Job status: ${job?.status}, Events: ${events.map(e => e.eventType).join(", ")}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 3: Voice provider error -> retry + CALL_FAILED (attempt) + final fail
  console.log("[TEST 3] Voice provider error -> retry + CALL_FAILED attempt + final fail");
  try {
    await cleanupTestJobs();
    mockVoiceAdapter.reset();
    mockVoiceAdapter.shouldFail = true;
    
    const externalId = `test-voice-3-${nanoid(6)}`;
    await createTestJob("voice", externalId);
    
    // First run - should retry
    await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    let [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const firstStatus = job?.status;
    const firstRetryCount = job?.retryCount || 0;
    
    // Force runAt to past for second run
    if (job) {
      await db.update(orchestratorJobs)
        .set({ runAt: new Date(Date.now() - 1000) })
        .where(eq(orchestratorJobs.id, job.id));
    }
    
    // Second run - should fail finally
    await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const events = await getEventsByExternalIdPrefix(`job:${externalId}`);
    const callFailedEvents = events.filter(e => e.eventType === "CALL_FAILED");
    const callPlacedEvents = events.filter(e => e.eventType === "CALL_PLACED");
    
    if (firstStatus === "queued" && firstRetryCount === 1 && job?.status === "failed" && callFailedEvents.length >= 1 && callPlacedEvents.length === 0) {
      console.log(`  First run: status=queued, retryCount=1`);
      console.log(`  Final status: ${job.status}`);
      console.log(`  CALL_FAILED events: ${callFailedEvents.length}, CALL_PLACED: 0 (correct)`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  First: status=${firstStatus}, retryCount=${firstRetryCount}`);
      console.log(`  Final: status=${job?.status}, CALL_FAILED count=${callFailedEvents.length}, CALL_PLACED=${callPlacedEvents.length}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 4: Voicemail drop ok -> VOICEMAIL_DROPPED
  console.log("[TEST 4] Voicemail drop success -> job done + VOICEMAIL_DROPPED");
  try {
    await cleanupTestJobs();
    mockVoiceAdapter.reset();
    
    const externalId = `test-vm-4-${nanoid(6)}`;
    await createTestJob("voicemail", externalId, {
      recordingUrl: "https://example.com/recording.mp3"
    });
    
    await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const events = await getEventsByExternalIdPrefix(`job:${externalId}`);
    const vmDropped = events.find(e => e.eventType === "VOICEMAIL_DROPPED");
    
    if (job?.status === "done" && vmDropped) {
      console.log(`  Job status: ${job.status}`);
      console.log(`  Event: VOICEMAIL_DROPPED`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Job status: ${job?.status}, Events: ${events.map(e => e.eventType).join(", ")}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 5: Pending outcome (undefined) keeps job in processing for webhook
  console.log("[TEST 5] Pending outcome (undefined) -> job stays in processing for webhook");
  try {
    await cleanupTestJobs();
    mockVoiceAdapter.reset();
    mockVoiceAdapter.callOutcome = undefined as any;
    
    const externalId = `test-voice-5-${nanoid(6)}`;
    await createTestJob("voice", externalId);
    
    await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(like(orchestratorJobs.externalId, externalId))
      .limit(1);
    
    const events = await getEventsByExternalIdPrefix(`job:${externalId}`);
    const callPlaced = events.find(e => e.eventType === "CALL_PLACED");
    const hasOutcome = events.some(e => ["CALL_ANSWERED", "CALL_NO_ANSWER", "CALL_BUSY", "CALL_FAILED"].includes(e.eventType));
    
    if (job?.status === "processing" && callPlaced && !hasOutcome) {
      console.log(`  Job status: ${job.status} (pending webhook)`);
      console.log(`  Events: CALL_PLACED only (no outcome yet)`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Job status: ${job?.status}, Events: ${events.map(e => e.eventType).join(", ")}`);
      console.log("RESULT: FAIL ✗\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // TEST 6: Idempotency - running twice doesn't duplicate events
  console.log("[TEST 6] Idempotency - running twice doesn't duplicate events");
  try {
    await cleanupTestJobs();
    mockVoiceAdapter.reset();
    mockVoiceAdapter.setOutcome("answered");
    
    const externalId = `test-voice-5-${nanoid(6)}`;
    await createTestJob("voice", externalId);
    
    // First run
    await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    const eventsAfterFirst = await getEventsByExternalIdPrefix(`job:${externalId}`);
    const countAfterFirst = eventsAfterFirst.length;
    
    // Second run (job should already be done, nothing to process)
    await runJobsOnce({
      companyId: TEST_COMPANY_ID,
      adapter: mockBridgeAdapter,
      voiceAdapter: mockVoiceAdapter
    });
    
    const eventsAfterSecond = await getEventsByExternalIdPrefix(`job:${externalId}`);
    const countAfterSecond = eventsAfterSecond.length;
    
    if (countAfterFirst === countAfterSecond && countAfterFirst === 2) {
      console.log(`  Events after first run: ${countAfterFirst}`);
      console.log(`  Events after second run: ${countAfterSecond}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  After first: ${countAfterFirst}, After second: ${countAfterSecond}`);
      console.log("RESULT: FAIL ✗ - Events were duplicated or wrong count\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }
  
  // Cleanup
  await cleanupTestJobs();
  
  console.log("============================================================");
  console.log("SUMMARY");
  console.log("============================================================");
  console.log(`✓ Test 1: Voice answered`);
  console.log(`✓ Test 2: Voice no answer`);
  console.log(`✓ Test 3: Voice provider error with retry`);
  console.log(`✓ Test 4: Voicemail drop success`);
  console.log(`✓ Test 5: Pending outcome (webhook)`);
  console.log(`✓ Test 6: Idempotency`);
  console.log(`\nTotal: ${passed}/${passed + failed} tests passed`);
  console.log("============================================================");
  
  return passed === 6;
}

runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
