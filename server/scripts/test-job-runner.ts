/**
 * Test: Job Runner
 * Tests job processing, retry logic, and event emission.
 * 
 * Run: npx tsx server/scripts/test-job-runner.ts
 */

import { db } from "../db";
import { 
  orchestratorCampaigns, 
  campaignContacts, 
  campaignEvents,
  orchestratorJobs,
  contactConsents,
  contacts
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { runJobsOnce } from "../workers/job-runner";
import { MockBridgeAdapter, setDefaultAdapter } from "../services/channel-adapters/bridge-imessage-sms";

const testResults: { name: string; passed: boolean; error?: string }[] = [];
const mockAdapter = new MockBridgeAdapter();

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
  await db.delete(orchestratorJobs).where(eq(orchestratorJobs.companyId, companyId));
  await db.delete(campaignEvents).where(eq(campaignEvents.companyId, companyId));
  await db.delete(campaignContacts).where(eq(campaignContacts.companyId, companyId));
  await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, companyId));
  await db.delete(contactConsents).where(eq(contactConsents.companyId, companyId));
  await db.delete(contacts).where(eq(contacts.companyId, companyId));
}

async function setupTestData(companyId: string, scenario: string): Promise<{
  campaignId: string;
  contactId: string;
  campaignContactId: string;
  jobId: string;
}> {
  const [contact] = await db.insert(contacts)
    .values({
      companyId,
      firstName: `JobTest-${scenario}`,
      lastName: "Contact",
      phoneNormalized: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, "0")}`,
      email: `job-test-${scenario}-${Date.now()}@example.com`
    })
    .returning();
  
  const policyJson: Record<string, any> = {
    maxAttemptsTotal: 10,
    maxAttemptsPerDay: 3,
    allowedChannels: ["sms", "imessage", "voice"],
    waitSeconds: 3600,
    maxRetries: scenario === "low_retries" ? 1 : 2
  };
  
  const [campaign] = await db.insert(orchestratorCampaigns)
    .values({
      companyId,
      name: `Job Test Campaign ${scenario}`,
      status: "active",
      policyJson
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
  
  const channel = scenario === "sms" ? "sms" : "imessage";
  const externalId = `test_job:${campaignContact.id}:${Date.now()}:${channel}`;
  
  const [job] = await db.insert(orchestratorJobs)
    .values({
      companyId,
      campaignId: campaign.id,
      campaignContactId: campaignContact.id,
      contactId: contact.id,
      channel,
      status: "queued",
      runAt: new Date(Date.now() - 1000),
      externalId,
      payload: {
        to: contact.phoneNormalized,
        body: `Test message for ${scenario}`,
        prefer: channel
      }
    })
    .returning();
  
  return {
    campaignId: campaign.id,
    contactId: contact.id,
    campaignContactId: campaignContact.id,
    jobId: job.id
  };
}

async function runTests(): Promise<void> {
  console.log("\n=== Job Runner Tests ===\n");
  
  const testCompanyId = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";
  
  setDefaultAdapter(mockAdapter);
  
  await cleanup(testCompanyId);
  
  console.log("1) iMessage Job Success");
  
  await test("Job imessage => done + MESSAGE_SENT + MESSAGE_DELIVERED", async () => {
    await cleanup(testCompanyId);
    mockAdapter.reset();
    
    const { jobId, campaignContactId } = await setupTestData(testCompanyId, "imessage");
    
    const result = await runJobsOnce({ companyId: testCompanyId, limit: 10, adapter: mockAdapter });
    
    assert(result.processed === 1, `Expected processed=1, got ${result.processed}`);
    assert(result.succeeded === 1, `Expected succeeded=1, got ${result.succeeded}`);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.id, jobId))
      .limit(1);
    
    assert(job.status === "done", `Expected status=done, got ${job.status}`);
    assert(!!job.completedAt, "completedAt should be set");
    
    const events = await db.select()
      .from(campaignEvents)
      .where(eq(campaignEvents.campaignContactId, campaignContactId));
    
    const sentEvent = events.find(e => e.eventType === "MESSAGE_SENT");
    const deliveredEvent = events.find(e => e.eventType === "MESSAGE_DELIVERED");
    
    assert(!!sentEvent, "MESSAGE_SENT event should exist");
    assert(!!deliveredEvent, "MESSAGE_DELIVERED event should exist");
    assert(sentEvent!.channel === "imessage", `Expected channel=imessage, got ${sentEvent!.channel}`);
  });
  
  console.log("\n2) SMS Job Success");
  
  await test("Job sms => done + events emitted", async () => {
    await cleanup(testCompanyId);
    mockAdapter.reset();
    
    const { jobId, campaignContactId } = await setupTestData(testCompanyId, "sms");
    
    const result = await runJobsOnce({ companyId: testCompanyId, limit: 10, adapter: mockAdapter });
    
    assert(result.succeeded === 1, `Expected succeeded=1, got ${result.succeeded}`);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.id, jobId))
      .limit(1);
    
    assert(job.status === "done", `Expected status=done, got ${job.status}`);
    
    const events = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "MESSAGE_SENT")
      ));
    
    assert(events.length === 1, `Expected 1 MESSAGE_SENT, got ${events.length}`);
    assert(events[0].channel === "sms", `Expected channel=sms, got ${events[0].channel}`);
  });
  
  console.log("\n3) Bridge Failure => Retry");
  
  await test("Bridge fails => job retries with future run_at + MESSAGE_FAILED emitted", async () => {
    await cleanup(testCompanyId);
    mockAdapter.reset();
    mockAdapter.shouldFail = true;
    
    const { jobId, campaignContactId } = await setupTestData(testCompanyId, "retry_test");
    
    const result = await runJobsOnce({ companyId: testCompanyId, limit: 10, adapter: mockAdapter });
    
    assert(result.retried === 1, `Expected retried=1, got ${result.retried}`);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.id, jobId))
      .limit(1);
    
    assert(job.status === "queued", `Expected status=queued for retry, got ${job.status}`);
    assert(job.retryCount === 1, `Expected retryCount=1, got ${job.retryCount}`);
    assert(job.runAt > new Date(), "runAt should be in the future");
    assert(!!job.error, "error should be set");
    
    // Verify MESSAGE_FAILED emitted for telemetry even on retry
    const failedEvents = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "MESSAGE_FAILED")
      ));
    
    assert(failedEvents.length >= 1, `Expected at least 1 MESSAGE_FAILED on retry, got ${failedEvents.length}`);
    const payload = failedEvents[0].payload as Record<string, any>;
    assert(payload.final === false, "Retry failure should have final=false");
  });
  
  console.log("\n4) Max Retries Exceeded => Failed");
  
  await test("Exceeds maxRetries => status=failed + MESSAGE_FAILED (attempt + final)", async () => {
    await cleanup(testCompanyId);
    mockAdapter.reset();
    mockAdapter.shouldFail = true;
    
    const { jobId, campaignContactId } = await setupTestData(testCompanyId, "low_retries");
    
    // Set retryCount to 1 (maxRetries=1 for low_retries scenario)
    await db.update(orchestratorJobs)
      .set({ retryCount: 1 })
      .where(eq(orchestratorJobs.id, jobId));
    
    const result = await runJobsOnce({ companyId: testCompanyId, limit: 10, adapter: mockAdapter });
    
    assert(result.failed === 1, `Expected failed=1, got ${result.failed}`);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.id, jobId))
      .limit(1);
    
    assert(job.status === "failed", `Expected status=failed, got ${job.status}`);
    assert(!!job.completedAt, "completedAt should be set");
    
    // Should have 2 MESSAGE_FAILED events: attempt failure + final failure
    const failedEvents = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "MESSAGE_FAILED")
      ));
    
    assert(failedEvents.length === 2, `Expected 2 MESSAGE_FAILED (attempt+final), got ${failedEvents.length}`);
    
    const attemptEvent = failedEvents.find(e => (e.payload as Record<string, any>).final === false);
    const finalEvent = failedEvents.find(e => (e.payload as Record<string, any>).final === true);
    
    assert(!!attemptEvent, "Should have attempt failure event with final=false");
    assert(!!finalEvent, "Should have final failure event with final=true");
  });
  
  console.log("\n5) Idempotency");
  
  await test("Running twice does not duplicate events", async () => {
    await cleanup(testCompanyId);
    mockAdapter.reset();
    
    const { jobId, campaignContactId } = await setupTestData(testCompanyId, "idempotency");
    
    await runJobsOnce({ companyId: testCompanyId, limit: 10, adapter: mockAdapter });
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.id, jobId))
      .limit(1);
    
    assert(job.status === "done", `Job should be done after first run, got ${job.status}`);
    
    await runJobsOnce({ companyId: testCompanyId, limit: 10, adapter: mockAdapter });
    
    const events = await db.select()
      .from(campaignEvents)
      .where(eq(campaignEvents.campaignContactId, campaignContactId));
    
    const sentCount = events.filter(e => e.eventType === "MESSAGE_SENT").length;
    const deliveredCount = events.filter(e => e.eventType === "MESSAGE_DELIVERED").length;
    
    assert(sentCount === 1, `Expected 1 MESSAGE_SENT (idempotent), got ${sentCount}`);
    assert(deliveredCount === 1, `Expected 1 MESSAGE_DELIVERED (idempotent), got ${deliveredCount}`);
  });
  
  console.log("\n6) Missing Payload Fields");
  
  await test("Job with missing 'to' fails immediately", async () => {
    await cleanup(testCompanyId);
    mockAdapter.reset();
    
    const { jobId } = await setupTestData(testCompanyId, "missing_to");
    
    await db.update(orchestratorJobs)
      .set({ payload: { body: "test" } })
      .where(eq(orchestratorJobs.id, jobId));
    
    const result = await runJobsOnce({ companyId: testCompanyId, limit: 10, adapter: mockAdapter });
    
    assert(result.failed === 1, `Expected failed=1, got ${result.failed}`);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.id, jobId))
      .limit(1);
    
    assert(job.status === "failed", `Expected status=failed, got ${job.status}`);
    assert(job.error?.includes("to") === true, `Error should mention 'to' field`);
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
