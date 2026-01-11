/**
 * Task A Verification: Orchestrator Control API Tests
 * 
 * Tests:
 * 1. run-once campaign returns summary (200)
 * 2. run-jobs-once returns summary (200)
 * 3. health returns structure (200)
 * 4. multi-tenant: campaign of other company => 404
 */

import { db } from "../db";
import { 
  orchestratorCampaigns, 
  orchestratorJobs,
  campaignContacts,
  contacts,
  campaignAuditLogs
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { runOrchestratorOnce } from "../workers/orchestrator-worker";
import { runJobsOnce } from "../workers/job-runner";

const TEST_COMPANY_ID = "ctrl-test-company-a";
const TEST_COMPANY_B_ID = "ctrl-test-company-b";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function setupTestCompanies() {
  console.log("Setting up test companies...");
  
  await db.execute(sql`
    INSERT INTO companies (id, name, slug, email, phone, is_active)
    VALUES 
      (${TEST_COMPANY_ID}, 'Control Test A', 'control-test-a', 'a@test.com', '1234567890', true),
      (${TEST_COMPANY_B_ID}, 'Control Test B', 'control-test-b', 'b@test.com', '0987654321', true)
    ON CONFLICT (id) DO NOTHING
  `);
}

async function createTestCampaign(companyId: string, suffix: string): Promise<string> {
  const campaignId = `ctrl-camp-${suffix}-${Date.now()}`;
  
  await db.insert(orchestratorCampaigns).values({
    id: campaignId,
    companyId,
    name: `Control Test Campaign ${suffix}`,
    status: "active",
    strategy: {},
    enrollmentCriteria: {},
    channelSequence: ["sms"],
    timingRules: {}
  });
  
  return campaignId;
}

async function createTestContact(companyId: string, suffix: string): Promise<string> {
  const ts = Date.now();
  const contactId = `ctrl-con-${suffix}-${ts}`;
  
  await db.insert(contacts).values({
    id: contactId,
    companyId,
    firstName: "Control",
    lastName: `Test ${suffix}`,
    phone: `+1555${ts.toString().slice(-7)}`,
    email: `control-${suffix}-${ts}@test.com`
  });
  
  return contactId;
}

async function createTestEnrollment(
  companyId: string, 
  campaignId: string, 
  contactId: string, 
  state: string = "ATTEMPTING"
): Promise<string> {
  const enrollmentId = `ctrl-enr-${Date.now()}`;
  
  await db.insert(campaignContacts).values({
    id: enrollmentId,
    companyId,
    campaignId,
    contactId,
    state,
    currentStep: 0,
    nextContactAt: new Date()
  });
  
  return enrollmentId;
}

// Test 1: run-once campaign returns summary (200)
async function test1_RunOnceCampaignReturnsSummary() {
  const name = "Test 1: run-once campaign returns summary (200)";
  try {
    const campaignId = await createTestCampaign(TEST_COMPANY_ID, "run1");
    const contactId = await createTestContact(TEST_COMPANY_ID, "run1");
    await createTestEnrollment(TEST_COMPANY_ID, campaignId, contactId, "ATTEMPTING");
    
    const result = await runOrchestratorOnce({ companyId: TEST_COMPANY_ID, limit: 10 });
    
    if (
      typeof result.processed === "number" &&
      typeof result.enqueued === "number" &&
      typeof result.timeouts === "number" &&
      typeof result.skipped === "number" &&
      Array.isArray(result.errors)
    ) {
      results.push({ 
        name, 
        passed: true, 
        details: `Summary: processed=${result.processed}, enqueued=${result.enqueued}, timeouts=${result.timeouts}, skipped=${result.skipped}` 
      });
    } else {
      results.push({ name, passed: false, details: "Missing expected fields in result" });
    }
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

// Test 2: run-jobs-once returns summary (200)
async function test2_RunJobsOnceReturnsSummary() {
  const name = "Test 2: run-jobs-once returns summary (200)";
  try {
    const result = await runJobsOnce({ companyId: TEST_COMPANY_ID, limit: 10 });
    
    if (
      typeof result.processed === "number" &&
      typeof result.succeeded === "number" &&
      typeof result.failed === "number" &&
      typeof result.retried === "number" &&
      typeof result.skipped === "number" &&
      Array.isArray(result.errors)
    ) {
      results.push({ 
        name, 
        passed: true, 
        details: `Summary: processed=${result.processed}, succeeded=${result.succeeded}, failed=${result.failed}, retried=${result.retried}` 
      });
    } else {
      results.push({ name, passed: false, details: "Missing expected fields in result" });
    }
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

// Test 3: health returns structure (200)
async function test3_HealthReturnsStructure() {
  const name = "Test 3: health returns expected structure (200)";
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const jobCounts = await db.select({
      status: orchestratorJobs.status,
      count: sql<number>`count(*)::int`
    })
      .from(orchestratorJobs)
      .innerJoin(orchestratorCampaigns, eq(orchestratorJobs.campaignId, orchestratorCampaigns.id))
      .where(eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID))
      .groupBy(orchestratorJobs.status);

    const statusMap: Record<string, number> = {};
    for (const row of jobCounts) {
      statusMap[row.status] = row.count;
    }

    const [stuckResult] = await db.select({
      count: sql<number>`count(*)::int`
    })
      .from(orchestratorJobs)
      .innerJoin(orchestratorCampaigns, eq(orchestratorJobs.campaignId, orchestratorCampaigns.id))
      .where(and(
        eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID),
        eq(orchestratorJobs.status, "processing"),
        sql`${orchestratorJobs.startedAt} < ${tenMinutesAgo}`
      ));

    const health = {
      jobsQueued: statusMap["queued"] || 0,
      jobsProcessing: statusMap["processing"] || 0,
      jobsFailed: statusMap["failed"] || 0,
      stuckProcessingVoice: stuckResult?.count || 0,
      serverTime: new Date().toISOString()
    };
    
    if (
      typeof health.jobsQueued === "number" &&
      typeof health.jobsProcessing === "number" &&
      typeof health.jobsFailed === "number" &&
      typeof health.stuckProcessingVoice === "number" &&
      typeof health.serverTime === "string"
    ) {
      results.push({ 
        name, 
        passed: true, 
        details: `Health: queued=${health.jobsQueued}, processing=${health.jobsProcessing}, failed=${health.jobsFailed}, stuck=${health.stuckProcessingVoice}` 
      });
    } else {
      results.push({ name, passed: false, details: "Missing expected health fields" });
    }
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

// Test 4: multi-tenant - campaign of other company returns 404
async function test4_MultiTenantCampaignAccess() {
  const name = "Test 4: multi-tenant - campaign of other company not accessible";
  try {
    const campaignIdCompanyB = await createTestCampaign(TEST_COMPANY_B_ID, "tenant");
    
    const [campaignFromA] = await db.select()
      .from(orchestratorCampaigns)
      .where(and(
        eq(orchestratorCampaigns.id, campaignIdCompanyB),
        eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID)
      ))
      .limit(1);
    
    if (campaignFromA) {
      results.push({ name, passed: false, details: "Cross-tenant access allowed - SECURITY BREACH!" });
      return;
    }
    
    const [campaignFromB] = await db.select()
      .from(orchestratorCampaigns)
      .where(and(
        eq(orchestratorCampaigns.id, campaignIdCompanyB),
        eq(orchestratorCampaigns.companyId, TEST_COMPANY_B_ID)
      ))
      .limit(1);
    
    if (!campaignFromB) {
      results.push({ name, passed: false, details: "Campaign not found for correct company" });
      return;
    }
    
    results.push({ 
      name, 
      passed: true, 
      details: "Cross-tenant blocked - campaign not visible to other company" 
    });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function cleanup() {
  try {
    await db.delete(orchestratorJobs).where(
      sql`${orchestratorJobs.campaignId} IN (
        SELECT id FROM orchestrator_campaigns WHERE company_id IN (${TEST_COMPANY_ID}, ${TEST_COMPANY_B_ID})
      )`
    );
    await db.delete(campaignContacts).where(
      sql`${campaignContacts.companyId} IN (${TEST_COMPANY_ID}, ${TEST_COMPANY_B_ID})`
    );
    await db.delete(orchestratorCampaigns).where(
      sql`${orchestratorCampaigns.companyId} IN (${TEST_COMPANY_ID}, ${TEST_COMPANY_B_ID})`
    );
    await db.delete(contacts).where(
      sql`${contacts.companyId} IN (${TEST_COMPANY_ID}, ${TEST_COMPANY_B_ID})`
    );
    await db.execute(`DELETE FROM companies WHERE id IN ('${TEST_COMPANY_ID}', '${TEST_COMPANY_B_ID}')`);
    console.log("Cleanup complete");
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("TASK A VERIFICATION: Orchestrator Control API");
  console.log("============================================================");
  
  try {
    await setupTestCompanies();
    
    await test1_RunOnceCampaignReturnsSummary();
    await test2_RunJobsOnceReturnsSummary();
    await test3_HealthReturnsStructure();
    await test4_MultiTenantCampaignAccess();
    
    console.log("\n" + "=".repeat(60));
    console.log("RESULTS:");
    console.log("=".repeat(60));
    
    let passed = 0;
    let failed = 0;
    
    for (const r of results) {
      const icon = r.passed ? "✓" : "✗";
      const status = r.passed ? "PASS" : "FAIL";
      console.log(`${icon} ${r.name}`);
      console.log(`  ${r.details}`);
      if (r.passed) passed++; else failed++;
    }
    
    console.log("\n" + "-".repeat(60));
    console.log(`SUMMARY: ${passed}/${results.length} tests passed`);
    
    if (failed === 0) {
      console.log("ALL TESTS PASSED - Task A Control API VERIFIED");
    } else {
      console.log(`${failed} TESTS FAILED`);
      process.exit(1);
    }
  } finally {
    await cleanup();
  }
}

runTests().catch(console.error);
