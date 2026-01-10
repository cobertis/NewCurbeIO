/**
 * Test Suite: Ticket 10.4 - Auto-Apply + Kill Switch + Rollback
 * 
 * Tests:
 * 1) Kill switch off => no apply
 * 2) Guardrail sample size fail => no apply
 * 3) Guardrail optOutRate too high => no apply
 * 4) maxDeltaPerRun clamp funciona
 * 5) Auto-apply escribe audit log correcto
 * 6) Rollback automático si empeora (simulado)
 */

import { db } from "../db";
import { orchestratorCampaigns, campaignAuditLogs, orchestratorExperimentAllocations } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  parseAutoApplyConfig,
  evaluateAutoApplyGuardrails,
  clampAllocationDelta,
  executeAutoApply,
  checkAndExecuteAutoRollback,
  VariantMetricsSnapshot,
  AutoApplyConfig
} from "../services/orchestrator-auto-tuner";

const TEST_COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";
const TEST_CAMPAIGN_ID = "0c8396d6-e05b-4c95-9397-791e1828dece";

function createTestMetrics(overrides: Partial<VariantMetricsSnapshot>[] = []): VariantMetricsSnapshot[] {
  const defaults: VariantMetricsSnapshot[] = [
    { variant: "control", attempts: 100, replies: 10, optOuts: 1, failedFinal: 5, cost: 10, reward: 5, rewardRate: 0.05 },
    { variant: "test", attempts: 100, replies: 15, optOuts: 1, failedFinal: 3, cost: 10, reward: 10, rewardRate: 0.1 }
  ];
  
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] || {}) }));
}

function createAutoApplyConfig(overrides: Partial<AutoApplyConfig> = {}): AutoApplyConfig {
  return {
    enabled: true,
    maxDeltaPerRun: 0.2,
    minSampleSizeAllVariants: 50,
    maxOptOutRate: 0.03,
    window: "7d",
    applyMode: "blend",
    blendFactor: 0.5,
    rollbackIfWorse: {
      enabled: true,
      metric: "replyRate",
      dropThreshold: 0.05,
      baselineWindow: "7d"
    },
    ...overrides
  };
}

async function cleanupTestData() {
  await db.delete(campaignAuditLogs)
    .where(and(
      eq(campaignAuditLogs.companyId, TEST_COMPANY_ID),
      eq(campaignAuditLogs.campaignId, TEST_CAMPAIGN_ID)
    ));
}

async function runTests() {
  console.log("============================================================");
  console.log("TICKET 10.4: Auto-Apply + Kill Switch + Rollback - Test Suite");
  console.log("============================================================\n");
  
  let passed = 0;
  let failed = 0;
  
  // TEST 1: Kill switch evaluation
  console.log("[TEST 1] Kill switch off => parseAutoApplyConfig returns null");
  try {
    const policyWithoutAutoApply = {
      experiment: {
        autoTune: {
          enabled: true
        }
      }
    };
    const config = parseAutoApplyConfig(policyWithoutAutoApply);
    if (config === null) {
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log("RESULT: FAIL ✗ - Expected null, got config\n");
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }

  // TEST 2: Guardrail sample size fail
  console.log("[TEST 2] Guardrail sample size fail => no apply");
  try {
    const metrics = createTestMetrics([
      { attempts: 30 },  // Below threshold
      { attempts: 100 }
    ]);
    const config = createAutoApplyConfig({ minSampleSizeAllVariants: 50 });
    const result = evaluateAutoApplyGuardrails(
      metrics,
      { control: 0.5, test: 0.5 },
      { control: 0.3, test: 0.7 },
      config
    );
    
    const sampleCheck = result.checks.find(c => c.name === "minSampleSizeAllVariants");
    if (!result.passed && sampleCheck && !sampleCheck.passed) {
      console.log(`  Sample check: ${sampleCheck.message}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`RESULT: FAIL ✗ - Expected guardrail to fail\n`);
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }

  // TEST 3: Guardrail optOutRate too high
  console.log("[TEST 3] Guardrail optOutRate too high => no apply");
  try {
    const metrics = createTestMetrics([
      { attempts: 100, optOuts: 5 },  // 5% opt-out rate
      { attempts: 100, optOuts: 5 }
    ]);
    const config = createAutoApplyConfig({ maxOptOutRate: 0.03 });  // 3% max
    const result = evaluateAutoApplyGuardrails(
      metrics,
      { control: 0.5, test: 0.5 },
      { control: 0.3, test: 0.7 },
      config
    );
    
    const optOutCheck = result.checks.find(c => c.name === "maxOptOutRate");
    if (!result.passed && optOutCheck && !optOutCheck.passed) {
      console.log(`  Opt-out check: ${optOutCheck.message}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`RESULT: FAIL ✗ - Expected guardrail to fail\n`);
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }

  // TEST 4: maxDeltaPerRun clamp
  console.log("[TEST 4] maxDeltaPerRun clamp funciona");
  try {
    const current = { control: 0.5, test: 0.5 };
    const recommended = { control: 0.1, test: 0.9 };  // 40% delta
    const clamped = clampAllocationDelta(current, recommended, 0.2);  // Max 20% delta
    
    const controlDelta = Math.abs(clamped.control - current.control);
    const testDelta = Math.abs(clamped.test - current.test);
    
    if (controlDelta <= 0.21 && testDelta <= 0.21) {  // Small tolerance for rounding
      console.log(`  Current: ${JSON.stringify(current)}`);
      console.log(`  Recommended: ${JSON.stringify(recommended)}`);
      console.log(`  Clamped: ${JSON.stringify(clamped)}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`RESULT: FAIL ✗ - Delta exceeded maxDeltaPerRun\n`);
      failed++;
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }

  // TEST 5: Blend mode preserves partial old allocation
  console.log("[TEST 5] Blend mode preserves partial old allocation");
  try {
    await cleanupTestData();
    
    const [campaign] = await db.select().from(orchestratorCampaigns).where(eq(orchestratorCampaigns.id, TEST_CAMPAIGN_ID)).limit(1);
    if (!campaign) {
      console.log("RESULT: SKIP - Test campaign not found\n");
    } else {
      const [snapshot] = await db.insert(orchestratorExperimentAllocations)
        .values({
          companyId: TEST_COMPANY_ID,
          campaignId: TEST_CAMPAIGN_ID,
          window: "7d",
          allocationsJson: { control: 0.2, test: 0.8 },
          metricsSnapshotJson: createTestMetrics(),
          objective: "score_v1",
          epsilon: "0.1"
        })
        .returning({ id: orchestratorExperimentAllocations.id });
      
      const metrics = createTestMetrics();
      const config = createAutoApplyConfig({ 
        applyMode: "blend", 
        blendFactor: 0.5,
        minSampleSizeAllVariants: 50, 
        maxOptOutRate: 0.1 
      });
      const policyJson = campaign.policyJson as Record<string, any> || {};
      
      const currentAlloc = { control: 0.6, test: 0.4 };
      const recommendedAlloc = { control: 0.2, test: 0.8 };
      
      const result = await executeAutoApply(
        TEST_COMPANY_ID,
        TEST_CAMPAIGN_ID,
        snapshot.id,
        metrics,
        currentAlloc,
        recommendedAlloc,
        config,
        policyJson
      );
      
      if (result.applied && result.newAllocation) {
        const expectedControl = 0.6 * 0.5 + 0.2 * 0.5; // 0.4
        const expectedTest = 0.4 * 0.5 + 0.8 * 0.5;    // 0.6
        
        const controlOk = Math.abs(result.newAllocation.control - expectedControl) < 0.05;
        const testOk = Math.abs(result.newAllocation.test - expectedTest) < 0.05;
        
        if (controlOk && testOk) {
          console.log(`  Current: ${JSON.stringify(currentAlloc)}`);
          console.log(`  Recommended: ${JSON.stringify(recommendedAlloc)}`);
          console.log(`  Blended (50%): ${JSON.stringify(result.newAllocation)}`);
          console.log("RESULT: PASS ✓\n");
          passed++;
        } else {
          console.log(`  Expected ~{control:0.4,test:0.6}, got ${JSON.stringify(result.newAllocation)}`);
          console.log("RESULT: FAIL ✗ - Blend calculation incorrect\n");
          failed++;
        }
      } else {
        console.log(`  Applied: ${result.applied}, Reason: ${result.reason}`);
        console.log("RESULT: FAIL ✗ - Auto-apply did not execute\n");
        failed++;
      }
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }

  // TEST 6: Auto-apply writes correct audit log
  console.log("[TEST 6] Auto-apply escribe audit log correcto");
  try {
    await cleanupTestData();
    
    const [campaign] = await db.select().from(orchestratorCampaigns).where(eq(orchestratorCampaigns.id, TEST_CAMPAIGN_ID)).limit(1);
    if (!campaign) {
      console.log("RESULT: SKIP - Test campaign not found\n");
    } else {
      const [snapshot] = await db.insert(orchestratorExperimentAllocations)
        .values({
          companyId: TEST_COMPANY_ID,
          campaignId: TEST_CAMPAIGN_ID,
          window: "7d",
          allocationsJson: { control: 0.4, test: 0.6 },
          metricsSnapshotJson: createTestMetrics(),
          objective: "score_v1",
          epsilon: "0.1"
        })
        .returning({ id: orchestratorExperimentAllocations.id });
      
      const metrics = createTestMetrics();
      const config = createAutoApplyConfig({ minSampleSizeAllVariants: 50, maxOptOutRate: 0.1 });
      const policyJson = campaign.policyJson as Record<string, any> || {};
      
      const result = await executeAutoApply(
        TEST_COMPANY_ID,
        TEST_CAMPAIGN_ID,
        snapshot.id,
        metrics,
        { control: 0.5, test: 0.5 },
        { control: 0.4, test: 0.6 },
        config,
        policyJson
      );
      
      if (result.applied && result.auditLogId) {
        const [log] = await db.select()
          .from(campaignAuditLogs)
          .where(eq(campaignAuditLogs.id, result.auditLogId))
          .limit(1);
        
        if (log && log.logType === "auto_tune_auto_apply") {
          console.log(`  Audit log created: ${log.id}`);
          console.log(`  Log type: ${log.logType}`);
          console.log("RESULT: PASS ✓\n");
          passed++;
        } else {
          console.log(`RESULT: FAIL ✗ - Audit log not found or wrong type\n`);
          failed++;
        }
      } else {
        console.log(`  Applied: ${result.applied}, Reason: ${result.reason}`);
        console.log(`RESULT: FAIL ✗ - Auto-apply did not execute\n`);
        failed++;
      }
    }
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    failed++;
  }

  // TEST 7: Auto-rollback when metric drops
  console.log("[TEST 7] Rollback automático si empeora (simulado)");
  try {
    await cleanupTestData();
    
    // Create a fake auto-apply audit log with baseline metrics
    const [applyLog] = await db.insert(campaignAuditLogs)
      .values({
        companyId: TEST_COMPANY_ID,
        campaignId: TEST_CAMPAIGN_ID,
        logType: "auto_tune_auto_apply",
        actionTaken: "blend",
        payload: {
          oldAllocation: { control: 0.5, test: 0.5 },
          newAllocation: { control: 0.4, test: 0.6 },
          baselineMetrics: { replyRate: 0.15, score: 20 }  // Good baseline
        }
      })
      .returning({ id: campaignAuditLogs.id });
    
    // Current metrics show a significant drop
    const currentMetrics = createTestMetrics([
      { attempts: 100, replies: 5 },   // Worse replies
      { attempts: 100, replies: 5 }
    ]);
    
    const config = createAutoApplyConfig({
      rollbackIfWorse: {
        enabled: true,
        metric: "replyRate",
        dropThreshold: 0.05,  // 5% drop triggers rollback
        baselineWindow: "7d"
      }
    });
    
    const result = await checkAndExecuteAutoRollback(
      TEST_COMPANY_ID,
      TEST_CAMPAIGN_ID,
      currentMetrics,
      config
    );
    
    if (result.rolledBack) {
      console.log(`  Rollback executed: ${result.reason}`);
      console.log(`  Audit log: ${result.auditLogId}`);
      console.log("RESULT: PASS ✓\n");
      passed++;
    } else {
      console.log(`  Rollback reason: ${result.reason}`);
      console.log("RESULT: FAIL ✗ - Expected rollback but didn't happen\n");
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
  console.log(`✓ Test 1: Kill switch parsing`);
  console.log(`✓ Test 2: Sample size guardrail`);
  console.log(`✓ Test 3: Opt-out rate guardrail`);
  console.log(`✓ Test 4: Delta clamping`);
  console.log(`✓ Test 5: Blend mode allocation`);
  console.log(`✓ Test 6: Auto-apply audit log`);
  console.log(`✓ Test 7: Auto-rollback on metric drop`);
  console.log(`\nTotal: ${passed}/${passed + failed} tests passed`);
  console.log("============================================================");
  
  return passed === 7;
}

runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
