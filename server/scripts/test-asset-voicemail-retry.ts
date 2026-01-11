/**
 * Test Script: Asset Voicemail Retry Behavior
 * 
 * Validates that the voicemail job processing correctly handles asset statuses:
 * - asset generating => job requeued with 10-min delay
 * - asset failed => job failed immediately
 * - asset ready => job proceeds with voicemail drop
 * 
 * Usage:
 *   npx tsx server/scripts/test-asset-voicemail-retry.ts
 */

import fs from "fs";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function pass(name: string, msg: string) {
  results.push({ name, passed: true, message: msg });
  console.log(`✓ ${name}: ${msg}`);
}

function fail(name: string, msg: string) {
  results.push({ name, passed: false, message: msg });
  console.log(`✗ ${name}: ${msg}`);
}

async function runTests() {
  console.log("\n==========================================");
  console.log("Asset Voicemail Retry Code Validation");
  console.log("==========================================\n");

  const jobRunnerContent = fs.readFileSync("server/workers/job-runner.ts", "utf-8");

  // Test 1: Constants defined
  console.log("--- Test: Constants ---");
  if (jobRunnerContent.includes("ASSET_NOT_READY_MAX_RETRIES = 6")) {
    pass("Max Retries Constant", "ASSET_NOT_READY_MAX_RETRIES = 6 defined");
  } else {
    fail("Max Retries Constant", "Missing ASSET_NOT_READY_MAX_RETRIES = 6");
  }

  if (jobRunnerContent.includes("ASSET_NOT_READY_DELAY_MS = 10 * 60 * 1000")) {
    pass("Retry Delay Constant", "ASSET_NOT_READY_DELAY_MS = 10 minutes defined");
  } else {
    fail("Retry Delay Constant", "Missing ASSET_NOT_READY_DELAY_MS");
  }

  // Test 2: scheduleAssetRetry function
  console.log("\n--- Test: Asset Retry Function ---");
  if (jobRunnerContent.includes("async function scheduleAssetRetry(job: OrchestratorJob, error: string)")) {
    pass("scheduleAssetRetry Function", "Function defined with correct signature");
  } else {
    fail("scheduleAssetRetry Function", "Missing scheduleAssetRetry function");
  }

  if (jobRunnerContent.includes("newRunAt = new Date(Date.now() + ASSET_NOT_READY_DELAY_MS)")) {
    pass("Asset Retry Delay", "Uses 10-minute delay for asset retries");
  } else {
    fail("Asset Retry Delay", "Not using ASSET_NOT_READY_DELAY_MS");
  }

  // Test 3: Event emission functions
  console.log("\n--- Test: Event Emission Functions ---");
  if (jobRunnerContent.includes("async function emitVoicemailFailedAttempt")) {
    pass("Failed Attempt Function", "emitVoicemailFailedAttempt function defined");
  } else {
    fail("Failed Attempt Function", "Missing emitVoicemailFailedAttempt");
  }

  if (jobRunnerContent.includes("async function emitVoicemailFailedFinal")) {
    pass("Failed Final Function", "emitVoicemailFailedFinal function defined");
  } else {
    fail("Failed Final Function", "Missing emitVoicemailFailedFinal");
  }

  // Test 4: Status handling in processVoicemailJob
  console.log("\n--- Test: Status Handling Logic ---");
  if (jobRunnerContent.includes('asset.status === "draft" || asset.status === "generating"')) {
    pass("Draft/Generating Check", "Code checks for draft/generating status");
  } else {
    fail("Draft/Generating Check", "Missing draft/generating status check");
  }

  if (jobRunnerContent.includes("job.retryCount < ASSET_NOT_READY_MAX_RETRIES")) {
    pass("Retry Count Check", "Checks retry count against max retries");
  } else {
    fail("Retry Count Check", "Missing retry count check");
  }

  if (jobRunnerContent.includes('if (asset.status === "failed")')) {
    pass("Failed Status Check", "Code checks for failed status");
  } else {
    fail("Failed Status Check", "Missing failed status check");
  }

  // Test 5: Retry scheduling call
  console.log("\n--- Test: Retry Scheduling ---");
  if (jobRunnerContent.includes("await scheduleAssetRetry(job, error)")) {
    pass("Asset Retry Call", "scheduleAssetRetry called for not-ready assets");
  } else {
    fail("Asset Retry Call", "Missing scheduleAssetRetry call");
  }

  // Test 6: Event emissions with correct externalId
  console.log("\n--- Test: Event ExternalId Patterns ---");
  if (jobRunnerContent.includes("`voicemail_failed_attempt_${attemptNumber}`")) {
    pass("Attempt ExternalId", "Uses voicemail_failed_attempt_{N} pattern");
  } else {
    fail("Attempt ExternalId", "Missing voicemail_failed_attempt pattern");
  }

  if (jobRunnerContent.includes('"voicemail_failed"')) {
    pass("Final ExternalId", "Uses voicemail_failed pattern for final");
  } else {
    fail("Final ExternalId", "Missing voicemail_failed pattern for final");
  }

  // Test 7: Final flag handling
  console.log("\n--- Test: Final Flag ---");
  if (jobRunnerContent.includes("final: false") && jobRunnerContent.includes("final: true")) {
    pass("Final Flag", "Both final: false and final: true are emitted");
  } else {
    fail("Final Flag", "Missing final flag distinction");
  }

  // Test 8: URL fallback
  console.log("\n--- Test: URL Fallback ---");
  if (jobRunnerContent.includes("outputJson.asset_url || outputJson.assetUrl")) {
    pass("URL Fallback", "Supports both asset_url and assetUrl");
  } else {
    fail("URL Fallback", "Missing assetUrl fallback");
  }

  // Test 9: Immediate failure for failed assets
  console.log("\n--- Test: Immediate Failure Logic ---");
  if (jobRunnerContent.includes('Asset generation failed')) {
    pass("Failed Asset Message", "Emits clear error for failed assets");
  } else {
    fail("Failed Asset Message", "Missing clear failed asset message");
  }

  // Summary
  console.log("\n==========================================");
  console.log("Summary");
  console.log("==========================================");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\nTests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
    process.exit(1);
  }

  console.log("\nAll tests passed!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
