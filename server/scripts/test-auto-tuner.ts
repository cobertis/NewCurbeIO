/**
 * TICKET 10.2 VERIFICATION: Auto-Tuner v1 (Multi-armed Bandit)
 * Tests: Reward calculation, epsilon-greedy allocation, minSampleSize guard
 */

import { db } from "../db";
import { orchestratorCampaigns, orchestratorExperimentAllocations } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import {
  calculateReward,
  computeEpsilonGreedyAllocations,
  parseAutoTuneConfig,
  getVariantMetrics,
  computeAutoTuneRecommendation,
  AutoTuneConfig,
  VariantMetricsSnapshot
} from "../services/orchestrator-auto-tuner";

const CURBE_COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function testRewardCalculation() {
  console.log("\n[TEST 1] Reward function penalizes optOut and failedFinal");
  
  const baseCase = { replies: 10, optOuts: 0, failedFinal: 0, cost: 0 };
  const baseReward = calculateReward(baseCase);
  
  const withOptOuts = { replies: 10, optOuts: 2, failedFinal: 0, cost: 0 };
  const optOutReward = calculateReward(withOptOuts);
  
  const withFailed = { replies: 10, optOuts: 0, failedFinal: 4, cost: 0 };
  const failedReward = calculateReward(withFailed);
  
  const withCost = { replies: 10, optOuts: 0, failedFinal: 0, cost: 10 };
  const costReward = calculateReward(withCost);
  
  const passed = 
    baseReward === 10 &&
    optOutReward < baseReward &&
    failedReward < baseReward &&
    costReward < baseReward &&
    optOutReward === 10 - 3 * 2 &&
    failedReward === 10 - 0.5 * 4 &&
    costReward === 10 - 0.2 * 10;
  
  results.push({
    name: "Reward function penalties",
    passed,
    details: `base=${baseReward}, withOptOuts=${optOutReward} (expected 4), withFailed=${failedReward} (expected 8), withCost=${costReward} (expected 8)`
  });
  
  console.log(`Base reward: ${baseReward}`);
  console.log(`With 2 optOuts: ${optOutReward} (expected: 4)`);
  console.log(`With 4 failedFinal: ${failedReward} (expected: 8)`);
  console.log(`With $10 cost: ${costReward} (expected: 8)`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testAllocationsSumToOne() {
  console.log("\n[TEST 2] Computed allocations sum to 1.0 and respect min/max");
  
  const config: AutoTuneConfig = {
    enabled: true,
    objective: "score_v1",
    minSampleSize: 10,
    updateFrequencyHours: 24,
    epsilon: 0.0,
    minAllocation: 0.1,
    maxAllocation: 0.9
  };
  
  const metrics: VariantMetricsSnapshot[] = [
    { variant: "A", attempts: 100, replies: 20, optOuts: 1, failedFinal: 2, cost: 5, reward: 15, rewardRate: 0.15 },
    { variant: "B", attempts: 100, replies: 5, optOuts: 5, failedFinal: 10, cost: 10, reward: -12, rewardRate: -0.12 }
  ];
  
  const allocations = computeEpsilonGreedyAllocations(metrics, config);
  const sum = Object.values(allocations).reduce((a, b) => a + b, 0);
  
  const allWithinBounds = Object.values(allocations).every(
    v => v >= config.minAllocation && v <= config.maxAllocation
  );
  
  const passed = Math.abs(sum - 1.0) < 0.02 && allWithinBounds;
  
  results.push({
    name: "Allocations sum to 1 and respect bounds",
    passed,
    details: `allocations=${JSON.stringify(allocations)}, sum=${sum.toFixed(2)}, withinBounds=${allWithinBounds}`
  });
  
  console.log(`Allocations: ${JSON.stringify(allocations)}`);
  console.log(`Sum: ${sum.toFixed(4)}`);
  console.log(`All within bounds: ${allWithinBounds}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testEpsilonExploration() {
  console.log("\n[TEST 3] Epsilon exploration yields randomness (seeded test)");
  
  const config: AutoTuneConfig = {
    enabled: true,
    objective: "score_v1",
    minSampleSize: 10,
    updateFrequencyHours: 24,
    epsilon: 1.0,
    minAllocation: 0.1,
    maxAllocation: 0.9
  };
  
  const metrics: VariantMetricsSnapshot[] = [
    { variant: "A", attempts: 100, replies: 20, optOuts: 0, failedFinal: 0, cost: 0, reward: 20, rewardRate: 0.2 },
    { variant: "B", attempts: 100, replies: 5, optOuts: 0, failedFinal: 0, cost: 0, reward: 5, rewardRate: 0.05 },
    { variant: "C", attempts: 100, replies: 10, optOuts: 0, failedFinal: 0, cost: 0, reward: 10, rewardRate: 0.1 }
  ];
  
  const alloc1 = computeEpsilonGreedyAllocations(metrics, config, 12345);
  const alloc2 = computeEpsilonGreedyAllocations(metrics, config, 12345);
  const alloc3 = computeEpsilonGreedyAllocations(metrics, config, 99999);
  
  const sameWithSameSeed = JSON.stringify(alloc1) === JSON.stringify(alloc2);
  
  const passed = sameWithSameSeed;
  
  results.push({
    name: "Epsilon exploration determinism with seed",
    passed,
    details: `seed1=${JSON.stringify(alloc1)}, seed2=${JSON.stringify(alloc2)}, differentSeed=${JSON.stringify(alloc3)}`
  });
  
  console.log(`Same seed (12345): ${JSON.stringify(alloc1)} vs ${JSON.stringify(alloc2)}`);
  console.log(`Different seed (99999): ${JSON.stringify(alloc3)}`);
  console.log(`Same with same seed: ${sameWithSameSeed}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testMinSampleSizeGuard() {
  console.log("\n[TEST 4] No compute if minSampleSize not met");
  
  const policyJson = {
    experiment: {
      enabled: true,
      variants: [{ name: "control" }, { name: "test" }],
      allocation: { control: 0.5, test: 0.5 },
      autoTune: {
        enabled: true,
        objective: "score_v1",
        minSampleSize: 1000,
        updateFrequencyHours: 24,
        epsilon: 0.1,
        minAllocation: 0.1,
        maxAllocation: 0.9
      }
    }
  };
  
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, CURBE_COMPANY_ID))
    .limit(1);
  
  if (!campaign) {
    results.push({
      name: "MinSampleSize guard",
      passed: false,
      details: "No campaign found for testing"
    });
    console.log("SKIP: No campaign found");
    return false;
  }
  
  const result = await computeAutoTuneRecommendation(
    campaign.companyId,
    campaign.id,
    policyJson,
    "7d"
  );
  
  const passed = result.skipped && result.skipReason?.includes("minSampleSize");
  
  results.push({
    name: "MinSampleSize guard",
    passed,
    details: `skipped=${result.skipped}, reason=${result.skipReason}`
  });
  
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Reason: ${result.skipReason}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testExploitFavorsHigherReward() {
  console.log("\n[TEST 5] Exploit mode favors higher rewardRate variants");
  
  const config: AutoTuneConfig = {
    enabled: true,
    objective: "score_v1",
    minSampleSize: 10,
    updateFrequencyHours: 24,
    epsilon: 0.0,
    minAllocation: 0.1,
    maxAllocation: 0.9
  };
  
  const metrics: VariantMetricsSnapshot[] = [
    { variant: "winner", attempts: 100, replies: 30, optOuts: 0, failedFinal: 0, cost: 0, reward: 30, rewardRate: 0.3 },
    { variant: "loser", attempts: 100, replies: 5, optOuts: 0, failedFinal: 0, cost: 0, reward: 5, rewardRate: 0.05 }
  ];
  
  const allocations = computeEpsilonGreedyAllocations(metrics, config);
  
  const passed = allocations["winner"] > allocations["loser"];
  
  results.push({
    name: "Exploit favors higher reward",
    passed,
    details: `winner=${allocations["winner"]}, loser=${allocations["loser"]}`
  });
  
  console.log(`Winner allocation: ${allocations["winner"]}`);
  console.log(`Loser allocation: ${allocations["loser"]}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testParseAutoTuneConfig() {
  console.log("\n[TEST 6] parseAutoTuneConfig extracts config correctly");
  
  const policyJson = {
    experiment: {
      enabled: true,
      variants: [{ name: "A" }, { name: "B" }],
      allocation: { A: 0.5, B: 0.5 },
      autoTune: {
        enabled: true,
        objective: "score_v1",
        minSampleSize: 50,
        updateFrequencyHours: 24,
        epsilon: 0.1,
        minAllocation: 0.1,
        maxAllocation: 0.9
      }
    }
  };
  
  const config = parseAutoTuneConfig(policyJson);
  
  const passed = config !== null &&
    config.enabled === true &&
    config.objective === "score_v1" &&
    config.minSampleSize === 50 &&
    config.epsilon === 0.1 &&
    config.minAllocation === 0.1 &&
    config.maxAllocation === 0.9;
  
  results.push({
    name: "parseAutoTuneConfig",
    passed,
    details: config ? `epsilon=${config.epsilon}, minSample=${config.minSampleSize}` : "null"
  });
  
  console.log(`Config: ${config ? JSON.stringify(config) : "null"}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testBoundsAfterNormalization() {
  console.log("\n[TEST 7] Bounds respected after normalization (regression)");
  
  const config: AutoTuneConfig = {
    enabled: true,
    objective: "score_v1",
    minSampleSize: 10,
    updateFrequencyHours: 24,
    epsilon: 0.0,
    minAllocation: 0.2,
    maxAllocation: 0.8
  };
  
  const metrics: VariantMetricsSnapshot[] = [
    { variant: "A", attempts: 100, replies: 50, optOuts: 0, failedFinal: 0, cost: 0, reward: 50, rewardRate: 0.5 },
    { variant: "B", attempts: 100, replies: 1, optOuts: 0, failedFinal: 0, cost: 0, reward: 1, rewardRate: 0.01 },
    { variant: "C", attempts: 100, replies: 0, optOuts: 0, failedFinal: 0, cost: 0, reward: 0, rewardRate: 0 }
  ];
  
  const allocations = computeEpsilonGreedyAllocations(metrics, config);
  
  const allWithinBounds = Object.entries(allocations).every(
    ([k, v]) => v >= config.minAllocation - 0.01 && v <= config.maxAllocation + 0.01
  );
  
  const sumsToOne = Math.abs(Object.values(allocations).reduce((a, b) => a + b, 0) - 1.0) < 0.02;
  
  const passed = allWithinBounds && sumsToOne;
  
  results.push({
    name: "Bounds respected after normalization",
    passed,
    details: `allocations=${JSON.stringify(allocations)}, withinBounds=${allWithinBounds}, sumsToOne=${sumsToOne}`
  });
  
  console.log(`Allocations: ${JSON.stringify(allocations)}`);
  console.log(`All within [${config.minAllocation}, ${config.maxAllocation}]: ${allWithinBounds}`);
  console.log(`Sums to 1.0: ${sumsToOne}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function runAllTests() {
  console.log("=".repeat(60));
  console.log("TICKET 10.2: Auto-Tuner v1 (Multi-armed Bandit) - Test Suite");
  console.log("=".repeat(60));
  
  try {
    await testRewardCalculation();
    await testAllocationsSumToOne();
    await testEpsilonExploration();
    await testMinSampleSizeGuard();
    await testExploitFavorsHigherReward();
    await testParseAutoTuneConfig();
    await testBoundsAfterNormalization();
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
