/**
 * Manual Runner: Orchestrator Worker
 * Executes runOrchestratorOnce() and logs the results.
 * 
 * Usage:
 *   npx tsx server/scripts/run-orchestrator-once.ts
 *   npx tsx server/scripts/run-orchestrator-once.ts --company=<uuid>
 *   npx tsx server/scripts/run-orchestrator-once.ts --limit=100
 */

import { runOrchestratorOnce } from "../workers/orchestrator-worker";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  let companyId: string | undefined;
  let limit = 50;
  
  for (const arg of args) {
    if (arg.startsWith("--company=")) {
      companyId = arg.split("=")[1];
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10);
    }
  }
  
  console.log("=== Orchestrator Worker Manual Run ===\n");
  console.log(`Options:`);
  console.log(`  Company ID: ${companyId || "(all companies)"}`);
  console.log(`  Limit: ${limit}`);
  console.log("");
  
  const startTime = Date.now();
  
  const result = await runOrchestratorOnce({ companyId, limit });
  
  const elapsed = Date.now() - startTime;
  
  console.log("=== Summary ===");
  console.log(`  Processed: ${result.processed}`);
  console.log(`  Enqueued:  ${result.enqueued}`);
  console.log(`  Timeouts:  ${result.timeouts}`);
  console.log(`  Skipped:   ${result.skipped}`);
  console.log(`  Elapsed:   ${elapsed}ms`);
  
  if (result.errors.length > 0) {
    console.log("\n=== Errors ===");
    result.errors.forEach((error, i) => {
      console.log(`  ${i + 1}) ${error}`);
    });
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error("Runner error:", err);
  process.exit(1);
});
