/**
 * Test: Orchestrator Worker
 * Tests the orchestrator worker's job creation, heuristic selection, and state management.
 * 
 * Run: npx tsx server/scripts/test-orchestrator-worker.ts
 */

import { db } from "../db";
import { 
  orchestratorCampaigns, 
  campaignContacts, 
  campaignEvents,
  orchestratorJobs,
  contactConsents,
  contactSuppressions,
  contacts,
  companies
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { runOrchestratorOnce, pickNextChannel } from "../workers/orchestrator-worker";
import { PolicyEngineResult, OrchestratorChannel } from "../services/policy-engine";

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
  await db.delete(orchestratorJobs).where(eq(orchestratorJobs.companyId, companyId));
  await db.delete(campaignEvents).where(eq(campaignEvents.companyId, companyId));
  await db.delete(campaignContacts).where(eq(campaignContacts.companyId, companyId));
  await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, companyId));
  await db.delete(contactConsents).where(eq(contactConsents.companyId, companyId));
  await db.delete(contactSuppressions).where(eq(contactSuppressions.companyId, companyId));
  await db.delete(contacts).where(eq(contacts.companyId, companyId));
}

async function setupTestData(companyId: string, scenario: string): Promise<{
  campaignId: string;
  contactId: string;
  campaignContactId: string;
}> {
  const [contact] = await db.insert(contacts)
    .values({
      companyId,
      firstName: `Test-${scenario}`,
      lastName: "Contact",
      phoneNormalized: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, "0")}`,
      email: `test-${scenario}-${Date.now()}@example.com`
    })
    .returning();
  
  const policyJson: Record<string, any> = {
    maxAttemptsTotal: 10,
    maxAttemptsPerDay: 3,
    allowedChannels: ["sms", "imessage", "voice", "voicemail", "whatsapp", "rvm"],
    waitSeconds: 3600
  };
  
  const campaignStatus = scenario === "paused" ? "paused" : "active";
  
  const [campaign] = await db.insert(orchestratorCampaigns)
    .values({
      companyId,
      name: `Test Campaign ${scenario}`,
      status: campaignStatus,
      policyJson
    })
    .returning();
  
  const contactState = scenario === "stopped" ? "STOPPED" 
    : scenario === "dnc" ? "DO_NOT_CONTACT" 
    : "NEW";
  
  const nextActionAt = scenario === "future" 
    ? new Date(Date.now() + 86400000) 
    : scenario === "due" 
    ? new Date(Date.now() - 1000) 
    : null;
  
  const [campaignContact] = await db.insert(campaignContacts)
    .values({
      companyId,
      campaignId: campaign.id,
      contactId: contact.id,
      state: contactState,
      nextActionAt
    })
    .returning();
  
  if (scenario === "no_consent") {
    // Add suppression to block all channels
    await db.insert(contactSuppressions)
      .values({
        companyId,
        contactId: contact.id,
        suppressionStatus: "dnc",
        reason: "Test DNC"
      });
  } else {
    await db.insert(contactConsents)
      .values([
        { companyId, contactId: contact.id, channel: "sms", status: "opt_in" },
        { companyId, contactId: contact.id, channel: "imessage", status: "opt_in" },
        { companyId, contactId: contact.id, channel: "voice", status: "opt_in" }
      ]);
  }
  
  return {
    campaignId: campaign.id,
    contactId: contact.id,
    campaignContactId: campaignContact.id
  };
}

async function runTests(): Promise<void> {
  console.log("\n=== Orchestrator Worker Tests ===\n");
  
  const testCompanyId = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";
  
  await cleanup(testCompanyId);
  
  console.log("1) pickNextChannel - Heuristic Selection");
  
  await test("Returns imessage when allowed (highest priority)", async () => {
    const mockResult: PolicyEngineResult = {
      companyId: testCompanyId,
      campaignId: "test",
      contactId: "test",
      campaignContactId: "test",
      now: new Date().toISOString(),
      allowedActions: [
        { channel: "sms", allowed: true, reasons: [] },
        { channel: "imessage", allowed: true, reasons: [] },
        { channel: "voice", allowed: true, reasons: [] }
      ],
      blocked: []
    };
    
    const channel = pickNextChannel(mockResult);
    assert(channel === "imessage", `Expected imessage, got ${channel}`);
  });
  
  await test("Returns sms when imessage not allowed", async () => {
    const mockResult: PolicyEngineResult = {
      companyId: testCompanyId,
      campaignId: "test",
      contactId: "test",
      campaignContactId: "test",
      now: new Date().toISOString(),
      allowedActions: [
        { channel: "sms", allowed: true, reasons: [] },
        { channel: "imessage", allowed: false, reasons: ["No consent"] },
        { channel: "voice", allowed: true, reasons: [] }
      ],
      blocked: [{ channel: "imessage", reasons: ["No consent"] }]
    };
    
    const channel = pickNextChannel(mockResult);
    assert(channel === "sms", `Expected sms, got ${channel}`);
  });
  
  await test("Returns null when no channels allowed", async () => {
    const mockResult: PolicyEngineResult = {
      companyId: testCompanyId,
      campaignId: "test",
      contactId: "test",
      campaignContactId: "test",
      now: new Date().toISOString(),
      allowedActions: [
        { channel: "sms", allowed: false, reasons: ["Cap reached"] },
        { channel: "imessage", allowed: false, reasons: ["No consent"] }
      ],
      blocked: [
        { channel: "sms", reasons: ["Cap reached"] },
        { channel: "imessage", reasons: ["No consent"] }
      ]
    };
    
    const channel = pickNextChannel(mockResult);
    assert(channel === null, `Expected null, got ${channel}`);
  });
  
  console.log("\n2) Active Campaign + Due Contact => Creates Job");
  
  await test("Creates job and ATTEMPT_QUEUED event for due contact", async () => {
    await cleanup(testCompanyId);
    const { campaignId, contactId, campaignContactId } = await setupTestData(testCompanyId, "due");
    
    const result = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    assert(result.processed === 1, `Expected processed=1, got ${result.processed}`);
    assert(result.enqueued === 1, `Expected enqueued=1, got ${result.enqueued}`);
    assert(result.timeouts === 0, `Expected timeouts=0, got ${result.timeouts}`);
    
    const [job] = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.campaignContactId, campaignContactId))
      .limit(1);
    
    assert(!!job, "Job should be created");
    assert(job.status === "queued", `Expected status=queued, got ${job.status}`);
    assert(job.channel === "imessage", `Expected channel=imessage, got ${job.channel}`);
    
    const [event] = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "ATTEMPT_QUEUED")
      ))
      .limit(1);
    
    assert(!!event, "ATTEMPT_QUEUED event should be created");
    assert(event.channel === "imessage", `Expected event channel=imessage, got ${event.channel}`);
    
    const [updatedContact] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);
    
    assert(updatedContact.state === "ATTEMPTING", `Expected state=ATTEMPTING, got ${updatedContact.state}`);
    assert(!!updatedContact.nextActionAt, "nextActionAt should be set");
    assert(updatedContact.fatigueScore === 1, `Expected fatigueScore=1, got ${updatedContact.fatigueScore}`);
  });
  
  console.log("\n3) Paused Campaign => No Jobs Created");
  
  await test("Skips paused campaign", async () => {
    await cleanup(testCompanyId);
    await setupTestData(testCompanyId, "paused");
    
    const result = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    assert(result.processed === 0, `Expected processed=0, got ${result.processed}`);
    assert(result.enqueued === 0, `Expected enqueued=0, got ${result.enqueued}`);
    
    const jobs = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.companyId, testCompanyId));
    
    assert(jobs.length === 0, `Expected 0 jobs, got ${jobs.length}`);
  });
  
  console.log("\n4) STOPPED/DO_NOT_CONTACT Contact => No Jobs Created");
  
  await test("Skips STOPPED contact", async () => {
    await cleanup(testCompanyId);
    await setupTestData(testCompanyId, "stopped");
    
    const result = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    assert(result.processed === 0, `Expected processed=0, got ${result.processed}`);
    assert(result.enqueued === 0, `Expected enqueued=0, got ${result.enqueued}`);
  });
  
  await test("Skips DO_NOT_CONTACT contact", async () => {
    await cleanup(testCompanyId);
    await setupTestData(testCompanyId, "dnc");
    
    const result = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    assert(result.processed === 0, `Expected processed=0, got ${result.processed}`);
    assert(result.enqueued === 0, `Expected enqueued=0, got ${result.enqueued}`);
  });
  
  console.log("\n5) Idempotency => No Duplicate Jobs");
  
  await test("Running worker twice does not duplicate job or event", async () => {
    await cleanup(testCompanyId);
    const { campaignContactId } = await setupTestData(testCompanyId, "due");
    
    const result1 = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    assert(result1.enqueued === 1, `First run: expected enqueued=1, got ${result1.enqueued}`);
    
    await db.update(campaignContacts)
      .set({ nextActionAt: new Date(Date.now() - 1000) })
      .where(eq(campaignContacts.id, campaignContactId));
    
    const result2 = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    const jobs = await db.select()
      .from(orchestratorJobs)
      .where(eq(orchestratorJobs.campaignContactId, campaignContactId));
    
    assert(jobs.length === 1, `Expected 1 job, got ${jobs.length} (idempotency check)`);
    
    const events = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "ATTEMPT_QUEUED")
      ));
    
    assert(events.length === 1, `Expected 1 ATTEMPT_QUEUED event, got ${events.length}`);
  });
  
  console.log("\n6) No Allowed Actions => UNREACHABLE + TIMEOUT Event");
  
  await test("Sets UNREACHABLE and emits TIMEOUT when no channels allowed", async () => {
    await cleanup(testCompanyId);
    const { campaignId, contactId, campaignContactId } = await setupTestData(testCompanyId, "no_consent");
    
    const result = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    assert(result.processed === 1, `Expected processed=1, got ${result.processed}`);
    assert(result.timeouts === 1, `Expected timeouts=1, got ${result.timeouts}`);
    assert(result.enqueued === 0, `Expected enqueued=0, got ${result.enqueued}`);
    
    const [updatedContact] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);
    
    assert(updatedContact.state === "UNREACHABLE", `Expected state=UNREACHABLE, got ${updatedContact.state}`);
    assert(updatedContact.stoppedReason === "NO_ALLOWED_ACTIONS", `Expected stoppedReason=NO_ALLOWED_ACTIONS`);
    assert(updatedContact.nextActionAt === null, "nextActionAt should be null");
    
    const [timeoutEvent] = await db.select()
      .from(campaignEvents)
      .where(and(
        eq(campaignEvents.campaignContactId, campaignContactId),
        eq(campaignEvents.eventType, "TIMEOUT")
      ))
      .limit(1);
    
    assert(!!timeoutEvent, "TIMEOUT event should be created");
  });
  
  console.log("\n7) Future nextActionAt => Not Processed");
  
  await test("Does not process contact with future nextActionAt", async () => {
    await cleanup(testCompanyId);
    await setupTestData(testCompanyId, "future");
    
    const result = await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    assert(result.processed === 0, `Expected processed=0, got ${result.processed}`);
    assert(result.enqueued === 0, `Expected enqueued=0, got ${result.enqueued}`);
  });
  
  console.log("\n8) Fatigue Score Increment");
  
  await test("Increments fatigueScore from 0 to 1", async () => {
    await cleanup(testCompanyId);
    const { campaignContactId } = await setupTestData(testCompanyId, "due");
    
    // Verify initial state (fatigueScore is 0 from default)
    const [beforeContact] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);
    
    assert(beforeContact.fatigueScore === 0, `Expected initial fatigueScore=0, got ${beforeContact.fatigueScore}`);
    
    // Run worker
    await runOrchestratorOnce({ companyId: testCompanyId, limit: 10 });
    
    // Verify fatigueScore incremented from 0 to 1
    const [afterContact] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, campaignContactId))
      .limit(1);
    
    assert(afterContact.fatigueScore === 1, `Expected fatigueScore=1 after increment, got ${afterContact.fatigueScore}`);
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
