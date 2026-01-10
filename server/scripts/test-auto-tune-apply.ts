/**
 * TICKET 10.3 VERIFICATION: Apply Allocation + Rollback + Guardrails
 * Tests: apply replace, apply blend, rollback, invalid snapshot, multi-tenant
 */

import { db } from "../db";
import { orchestratorCampaigns, orchestratorExperimentAllocations, campaignAuditLogs } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  applyAllocationRecommendation,
  rollbackAllocation,
  getLatestAllocationRecommendation,
  getLastApplyAuditLog
} from "../services/orchestrator-auto-tuner";

const CURBE_COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";
const DEMO_CAMPAIGN_ID = "0c8396d6-e05b-4c95-9397-791e1828dece";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function setupTestCampaign(): Promise<string | null> {
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.id, DEMO_CAMPAIGN_ID))
    .limit(1);
  
  if (!campaign) {
    console.log("No test campaign found");
    return null;
  }
  
  await db.update(orchestratorCampaigns)
    .set({
      policyJson: {
        experiment: {
          enabled: true,
          variants: [{ name: "control" }, { name: "test" }],
          allocation: { control: 0.5, test: 0.5 },
          autoTune: {
            enabled: true,
            objective: "score_v1",
            minSampleSize: 5,
            epsilon: 0.1,
            minAllocation: 0.1,
            maxAllocation: 0.9
          }
        }
      }
    })
    .where(eq(orchestratorCampaigns.id, DEMO_CAMPAIGN_ID));
  
  return DEMO_CAMPAIGN_ID;
}

async function getSnapshotId(): Promise<string | null> {
  const recommendation = await getLatestAllocationRecommendation(CURBE_COMPANY_ID, DEMO_CAMPAIGN_ID);
  return recommendation?.id || null;
}

async function testApplyReplace() {
  console.log("\n[TEST 1] Apply replace updates policy_json");
  
  const campaignId = await setupTestCampaign();
  if (!campaignId) {
    results.push({ name: "Apply replace", passed: false, details: "No campaign" });
    return false;
  }
  
  const snapshotId = await getSnapshotId();
  if (!snapshotId) {
    results.push({ name: "Apply replace", passed: false, details: "No snapshot" });
    return false;
  }
  
  try {
    const result = await applyAllocationRecommendation(
      CURBE_COMPANY_ID,
      campaignId,
      snapshotId,
      "replace"
    );
    
    const [updated] = await db.select()
      .from(orchestratorCampaigns)
      .where(eq(orchestratorCampaigns.id, campaignId))
      .limit(1);
    
    const policy = updated.policyJson as any;
    const newAlloc = policy?.experiment?.allocation;
    
    const passed = result.success && 
      Object.keys(newAlloc).length > 0 &&
      JSON.stringify(result.newAllocation) === JSON.stringify(newAlloc);
    
    results.push({
      name: "Apply replace",
      passed,
      details: `old=${JSON.stringify(result.oldAllocation)}, new=${JSON.stringify(result.newAllocation)}`
    });
    
    console.log(`Old: ${JSON.stringify(result.oldAllocation)}`);
    console.log(`New: ${JSON.stringify(result.newAllocation)}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
    
    return passed;
  } catch (error) {
    console.error("Error:", error);
    results.push({ name: "Apply replace", passed: false, details: String(error) });
    return false;
  }
}

async function testApplyBlend() {
  console.log("\n[TEST 2] Apply blend combines allocations");
  
  await setupTestCampaign();
  const snapshotId = await getSnapshotId();
  if (!snapshotId) {
    results.push({ name: "Apply blend", passed: false, details: "No snapshot" });
    return false;
  }
  
  try {
    const result = await applyAllocationRecommendation(
      CURBE_COMPANY_ID,
      DEMO_CAMPAIGN_ID,
      snapshotId,
      "blend",
      0.5
    );
    
    const passed = result.success && Object.keys(result.newAllocation).length > 0;
    
    results.push({
      name: "Apply blend",
      passed,
      details: `blendFactor=0.5, new=${JSON.stringify(result.newAllocation)}`
    });
    
    console.log(`Blended allocation: ${JSON.stringify(result.newAllocation)}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
    
    return passed;
  } catch (error) {
    console.error("Error:", error);
    results.push({ name: "Apply blend", passed: false, details: String(error) });
    return false;
  }
}

async function testRollback() {
  console.log("\n[TEST 3] Rollback restores previous allocation");
  
  await setupTestCampaign();
  const snapshotId = await getSnapshotId();
  if (!snapshotId) {
    results.push({ name: "Rollback", passed: false, details: "No snapshot" });
    return false;
  }
  
  try {
    const applyResult = await applyAllocationRecommendation(
      CURBE_COMPANY_ID,
      DEMO_CAMPAIGN_ID,
      snapshotId,
      "replace"
    );
    
    const rollbackResult = await rollbackAllocation(
      CURBE_COMPANY_ID,
      DEMO_CAMPAIGN_ID,
      applyResult.auditLogId
    );
    
    const [updated] = await db.select()
      .from(orchestratorCampaigns)
      .where(eq(orchestratorCampaigns.id, DEMO_CAMPAIGN_ID))
      .limit(1);
    
    const policy = updated.policyJson as any;
    const restoredAlloc = policy?.experiment?.allocation;
    
    const passed = rollbackResult.success && 
      JSON.stringify(rollbackResult.restoredAllocation) === JSON.stringify(applyResult.oldAllocation);
    
    results.push({
      name: "Rollback",
      passed,
      details: `restored=${JSON.stringify(rollbackResult.restoredAllocation)}`
    });
    
    console.log(`Applied: ${JSON.stringify(applyResult.newAllocation)}`);
    console.log(`Rolled back to: ${JSON.stringify(rollbackResult.restoredAllocation)}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
    
    return passed;
  } catch (error) {
    console.error("Error:", error);
    results.push({ name: "Rollback", passed: false, details: String(error) });
    return false;
  }
}

async function testInvalidSnapshot() {
  console.log("\n[TEST 4] Invalid snapshotId returns error");
  
  try {
    await applyAllocationRecommendation(
      CURBE_COMPANY_ID,
      DEMO_CAMPAIGN_ID,
      "invalid-snapshot-id-12345",
      "replace"
    );
    
    results.push({ name: "Invalid snapshot", passed: false, details: "Should have thrown error" });
    console.log("RESULT: FAIL ✗ (should have thrown)");
    return false;
  } catch (error: any) {
    const passed = error.message?.includes("not found");
    
    results.push({
      name: "Invalid snapshot",
      passed,
      details: `error="${error.message}"`
    });
    
    console.log(`Error: ${error.message}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
    
    return passed;
  }
}

async function testMultiTenantIsolation() {
  console.log("\n[TEST 5] Multi-tenant: cannot apply to other company's snapshot");
  
  const snapshotId = await getSnapshotId();
  if (!snapshotId) {
    results.push({ name: "Multi-tenant isolation", passed: false, details: "No snapshot" });
    return false;
  }
  
  try {
    await applyAllocationRecommendation(
      "other-company-id-12345",
      DEMO_CAMPAIGN_ID,
      snapshotId,
      "replace"
    );
    
    results.push({ name: "Multi-tenant isolation", passed: false, details: "Should have thrown" });
    console.log("RESULT: FAIL ✗ (should have thrown)");
    return false;
  } catch (error: any) {
    const passed = error.message?.includes("not found") || error.message?.includes("access denied");
    
    results.push({
      name: "Multi-tenant isolation",
      passed,
      details: `blocked with: "${error.message}"`
    });
    
    console.log(`Error: ${error.message}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
    
    return passed;
  }
}

async function runAllTests() {
  console.log("=".repeat(60));
  console.log("TICKET 10.3: Apply Allocation + Rollback - Test Suite");
  console.log("=".repeat(60));
  
  try {
    await testApplyReplace();
    await testApplyBlend();
    await testRollback();
    await testInvalidSnapshot();
    await testMultiTenantIsolation();
  } catch (error) {
    console.error("\nTest suite error:", error);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  for (const r of results) {
    console.log(`${r.passed ? "✓" : "✗"} ${r.name}: ${r.details}`);
  }
  
  console.log(`\nTotal: ${passed}/${total} tests passed`);
  console.log("=".repeat(60));
  
  process.exit(passed === total ? 0 : 1);
}

runAllTests();
