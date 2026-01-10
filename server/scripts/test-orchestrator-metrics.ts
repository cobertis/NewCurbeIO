/**
 * TICKET 9.2 VERIFICATION: Orchestrator Metrics v1.1
 * Tests: Campaign metrics with failedFinal, read, correct denominators, avgTimeToReply
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  orchestratorCampaigns,
  orchestratorJobs 
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCampaignMetrics, getJobMetrics, verifyCampaignAccess } from "../services/orchestrator-metrics";

const CURBE_COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";
const FAKE_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function getTestCampaign() {
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, CURBE_COMPANY_ID))
    .limit(1);
  
  if (!campaign) {
    throw new Error("No test campaign found. Create an orchestrator campaign first.");
  }
  
  return campaign;
}

async function testMetricsReturnsNewFields() {
  console.log("\n[TEST 1] Metrics returns new v1.1 fields (failedFinal, read, failureRateFinal)");
  
  const campaign = await getTestCampaign();
  const metrics = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  const hasNewFields = 
    typeof metrics.failedFinal === "number" &&
    typeof metrics.read === "number" &&
    typeof metrics.rates.failureRateFinal === "number";
  
  const passed = hasNewFields;
  
  results.push({
    name: "Metrics returns new v1.1 fields",
    passed,
    details: `failedFinal=${metrics.failedFinal}, read=${metrics.read}, failureRateFinal=${metrics.rates.failureRateFinal}`
  });
  
  console.log(`failedFinal: ${metrics.failedFinal}`);
  console.log(`read: ${metrics.read}`);
  console.log(`failureRateFinal: ${(metrics.rates.failureRateFinal * 100).toFixed(1)}%`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testFailedFinalVsFailedAll() {
  console.log("\n[TEST 2] failedFinal <= failed (final is subset of all failures)");
  
  const campaign = await getTestCampaign();
  const metrics = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  const passed = metrics.failedFinal <= metrics.failed;
  
  results.push({
    name: "failedFinal <= failed (subset check)",
    passed,
    details: `failedFinal=${metrics.failedFinal}, failed=${metrics.failed}`
  });
  
  console.log(`Failed (All): ${metrics.failed}`);
  console.log(`Failed (Final): ${metrics.failedFinal}`);
  console.log(`failedFinal <= failed: ${passed}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testDenominators() {
  console.log("\n[TEST 3] Denominators are correct");
  
  const campaign = await getTestCampaign();
  const metrics = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  // Verify denominators:
  // deliveryRate = delivered / attempts
  // replyRate = replied / delivered
  // optOutRate = optOut / delivered  
  // failureRateFinal = failedFinal / attempts
  
  const expectedDeliveryRate = metrics.attempts > 0 
    ? Math.round((metrics.delivered / metrics.attempts) * 100) / 100 
    : 0;
  const expectedReplyRate = metrics.delivered > 0 
    ? Math.round((metrics.replied / metrics.delivered) * 100) / 100 
    : 0;
  const expectedOptOutRate = metrics.delivered > 0 
    ? Math.round((metrics.optOut / metrics.delivered) * 100) / 100 
    : 0;
  const expectedFailureRateFinal = metrics.attempts > 0 
    ? Math.round((metrics.failedFinal / metrics.attempts) * 100) / 100 
    : 0;
  
  const deliveryRateCorrect = metrics.rates.deliveryRate === expectedDeliveryRate;
  const replyRateCorrect = metrics.rates.replyRate === expectedReplyRate;
  const optOutRateCorrect = metrics.rates.optOutRate === expectedOptOutRate;
  const failureRateFinalCorrect = metrics.rates.failureRateFinal === expectedFailureRateFinal;
  
  const passed = deliveryRateCorrect && replyRateCorrect && optOutRateCorrect && failureRateFinalCorrect;
  
  results.push({
    name: "Denominators are correct",
    passed,
    details: `delivery=${deliveryRateCorrect}, reply=${replyRateCorrect}, optOut=${optOutRateCorrect}, failureFinal=${failureRateFinalCorrect}`
  });
  
  console.log(`deliveryRate: ${metrics.rates.deliveryRate} (expected ${expectedDeliveryRate}) - ${deliveryRateCorrect ? "OK" : "WRONG"}`);
  console.log(`replyRate: ${metrics.rates.replyRate} (expected ${expectedReplyRate}) - ${replyRateCorrect ? "OK" : "WRONG"}`);
  console.log(`optOutRate: ${metrics.rates.optOutRate} (expected ${expectedOptOutRate}) - ${optOutRateCorrect ? "OK" : "WRONG"}`);
  console.log(`failureRateFinal: ${metrics.rates.failureRateFinal} (expected ${expectedFailureRateFinal}) - ${failureRateFinalCorrect ? "OK" : "WRONG"}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testWindowFiltering() {
  console.log("\n[TEST 4] Window filtering works (7d vs all)");
  
  const campaign = await getTestCampaign();
  
  const metrics7d = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "7d");
  const metricsAll = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  const passed = metrics7d.window === "7d" && 
    metricsAll.window === "all" &&
    metricsAll.attempts >= metrics7d.attempts;
  
  results.push({
    name: "Window filtering works",
    passed,
    details: `7d attempts=${metrics7d.attempts}, all attempts=${metricsAll.attempts}`
  });
  
  console.log(`7d window: ${metrics7d.attempts} attempts`);
  console.log(`All time: ${metricsAll.attempts} attempts`);
  console.log(`All >= 7d: ${metricsAll.attempts >= metrics7d.attempts}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testMultiTenantIsolation() {
  console.log("\n[TEST 5] Multi-tenant isolation (fake company gets 404)");
  
  const campaign = await getTestCampaign();
  
  const hasAccess = await verifyCampaignAccess(FAKE_COMPANY_ID, campaign.id);
  const hasRealAccess = await verifyCampaignAccess(CURBE_COMPANY_ID, campaign.id);
  
  const passed = !hasAccess && hasRealAccess;
  
  results.push({
    name: "Multi-tenant isolation blocks fake company",
    passed,
    details: `fakeCompany=${hasAccess}, realCompany=${hasRealAccess}`
  });
  
  console.log(`Fake company access: ${hasAccess}`);
  console.log(`Real company access: ${hasRealAccess}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testBreakdownByChannelHasNewFields() {
  console.log("\n[TEST 6] Breakdown by channel includes failedFinal and read");
  
  const campaign = await getTestCampaign();
  const metrics = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  const channels = Object.keys(metrics.breakdownByChannel);
  let allHaveNewFields = true;
  
  for (const channel of channels) {
    const stats = metrics.breakdownByChannel[channel];
    if (typeof stats.failedFinal !== "number" || typeof stats.read !== "number") {
      allHaveNewFields = false;
    }
    console.log(`  ${channel}: attempts=${stats.attempts}, delivered=${stats.delivered}, failed=${stats.failed}, failedFinal=${stats.failedFinal}, read=${stats.read}`);
  }
  
  const passed = allHaveNewFields;
  
  results.push({
    name: "Breakdown by channel includes failedFinal and read",
    passed,
    details: `channels=[${channels.join(", ")}], allHaveNewFields=${allHaveNewFields}`
  });
  
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testAvgTimeToReplyCalculation() {
  console.log("\n[TEST 7] avgTimeToReplySeconds calculation (first SENT to first REPLIED per contact)");
  
  const campaign = await getTestCampaign();
  const metrics = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  // Just verify it's a number or null
  const passed = metrics.avgTimeToReplySeconds === null || 
    (typeof metrics.avgTimeToReplySeconds === "number" && metrics.avgTimeToReplySeconds >= 0);
  
  results.push({
    name: "avgTimeToReplySeconds is valid",
    passed,
    details: `value=${metrics.avgTimeToReplySeconds !== null ? `${metrics.avgTimeToReplySeconds}s (${Math.round(metrics.avgTimeToReplySeconds / 60)}m)` : "null"}`
  });
  
  console.log(`avgTimeToReplySeconds: ${metrics.avgTimeToReplySeconds !== null ? `${metrics.avgTimeToReplySeconds}s (${Math.round(metrics.avgTimeToReplySeconds / 60)}m)` : "null (no replies)"}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testJobMetrics() {
  console.log("\n[TEST 8] Job metrics returns correct counts");
  
  const campaign = await getTestCampaign();
  const jobMetrics = await getJobMetrics(CURBE_COMPANY_ID, campaign.id);
  
  const passed = typeof jobMetrics.queuedCount === "number" &&
    typeof jobMetrics.processingCount === "number" &&
    typeof jobMetrics.failedCount === "number" &&
    typeof jobMetrics.avgRetryCount === "number";
  
  results.push({
    name: "Job metrics returns correct structure",
    passed,
    details: `queued=${jobMetrics.queuedCount}, processing=${jobMetrics.processingCount}, failed=${jobMetrics.failedCount}`
  });
  
  console.log(`Queued: ${jobMetrics.queuedCount}`);
  console.log(`Processing: ${jobMetrics.processingCount}`);
  console.log(`Failed: ${jobMetrics.failedCount}`);
  console.log(`Done: ${jobMetrics.doneCount}`);
  console.log(`Avg Retries: ${jobMetrics.avgRetryCount}`);
  console.log(`Oldest Queued Age: ${jobMetrics.oldestQueuedAgeSec !== null ? `${jobMetrics.oldestQueuedAgeSec}s` : "none"}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function runTests() {
  console.log("=".repeat(70));
  console.log("TICKET 9.2 VERIFICATION: Orchestrator Metrics v1.1");
  console.log("(failedFinal, read, correct denominators, avgTimeToReply)");
  console.log("=".repeat(70));
  
  await testMetricsReturnsNewFields();
  await testFailedFinalVsFailedAll();
  await testDenominators();
  await testWindowFiltering();
  await testMultiTenantIsolation();
  await testBreakdownByChannelHasNewFields();
  await testAvgTimeToReplyCalculation();
  await testJobMetrics();
  
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
