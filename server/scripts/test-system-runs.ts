import { db } from "../db";
import { companies, orchestratorSystemRuns, orchestratorCampaigns, contacts } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const testResults: { name: string; passed: boolean; details: string }[] = [];

const ts = Date.now();
const testCompanyId = `sysrun-test-co-${ts}`;
const otherCompanyId = `sysrun-other-co-${ts}`;
const testCampaignId = `sysrun-test-camp-${ts}`;

async function runTests() {
  console.log("============================================================");
  console.log("TASK F VERIFICATION: System Run History");
  console.log("============================================================");
  console.log("Setting up test data...\n");

  try {
    await db.insert(companies).values([
      { id: testCompanyId, name: "SysRun Test Company", email: `sysrun${ts}@test.com` },
      { id: otherCompanyId, name: "Other SysRun Company", email: `othersysrun${ts}@test.com` }
    ]);

    await db.insert(orchestratorCampaigns).values({
      id: testCampaignId,
      companyId: testCompanyId,
      name: "SysRun Test Campaign",
      status: "active"
    });

    // ========== TEST 1: Create run record and update it ==========
    console.log("Test 1: Insert running -> update to success...");
    {
      const runId = `sysrun-test-${ts}`;
      const startedAt = new Date();

      const [insertedRun] = await db.insert(orchestratorSystemRuns).values({
        id: runId,
        companyId: testCompanyId,
        type: "orchestrator",
        status: "running",
        startedAt,
      }).returning();

      if (insertedRun.status !== "running") {
        testResults.push({ name: "Test 1: Insert running", passed: false, details: `Expected status 'running', got '${insertedRun.status}'` });
      } else {
        await db.update(orchestratorSystemRuns)
          .set({ 
            status: "success", 
            completedAt: new Date(), 
            payload: { processed: 5, enqueued: 3 } 
          })
          .where(eq(orchestratorSystemRuns.id, runId));

        const [updatedRun] = await db.select()
          .from(orchestratorSystemRuns)
          .where(eq(orchestratorSystemRuns.id, runId))
          .limit(1);

        const passed = updatedRun.status === "success" && 
                       updatedRun.completedAt !== null &&
                       (updatedRun.payload as any)?.processed === 5;

        testResults.push({ 
          name: "Test 1: Insert running -> update to success", 
          passed, 
          details: passed ? "Run record created and updated correctly" : `Unexpected state: status=${updatedRun.status}, payload=${JSON.stringify(updatedRun.payload)}`
        });
      }
    }

    // ========== TEST 2: Error status update ==========
    console.log("Test 2: Insert running -> update to error...");
    {
      const runId = `sysrun-error-${ts}`;

      await db.insert(orchestratorSystemRuns).values({
        id: runId,
        companyId: testCompanyId,
        type: "jobs",
        status: "running",
        startedAt: new Date(),
      });

      await db.update(orchestratorSystemRuns)
        .set({ 
          status: "error", 
          completedAt: new Date(), 
          payload: { error: "Test error message" } 
        })
        .where(eq(orchestratorSystemRuns.id, runId));

      const [updatedRun] = await db.select()
        .from(orchestratorSystemRuns)
        .where(eq(orchestratorSystemRuns.id, runId))
        .limit(1);

      const passed = updatedRun.status === "error" && 
                     (updatedRun.payload as any)?.error === "Test error message";

      testResults.push({ 
        name: "Test 2: Insert running -> update to error", 
        passed, 
        details: passed ? "Error status and payload stored correctly" : `Unexpected: status=${updatedRun.status}, payload=${JSON.stringify(updatedRun.payload)}`
      });
    }

    // ========== TEST 3: Multi-tenant scoping ==========
    console.log("Test 3: Multi-tenant scoping (Company A can't see Company B's runs)...");
    {
      const runIdA = `sysrun-tenant-a-${ts}`;
      const runIdB = `sysrun-tenant-b-${ts}`;

      await db.insert(orchestratorSystemRuns).values([
        { id: runIdA, companyId: testCompanyId, type: "reaper", status: "success", startedAt: new Date() },
        { id: runIdB, companyId: otherCompanyId, type: "reaper", status: "success", startedAt: new Date() }
      ]);

      const companyARuns = await db.select()
        .from(orchestratorSystemRuns)
        .where(eq(orchestratorSystemRuns.companyId, testCompanyId));

      const companyBRuns = await db.select()
        .from(orchestratorSystemRuns)
        .where(eq(orchestratorSystemRuns.companyId, otherCompanyId));

      const companyAHasOnlyOwn = companyARuns.every(r => r.companyId === testCompanyId);
      const companyBHasOnlyOwn = companyBRuns.every(r => r.companyId === otherCompanyId);
      const noOverlap = !companyARuns.some(r => r.id === runIdB) && !companyBRuns.some(r => r.id === runIdA);

      const passed = companyAHasOnlyOwn && companyBHasOnlyOwn && noOverlap;

      testResults.push({ 
        name: "Test 3: Multi-tenant scoping", 
        passed, 
        details: passed ? "Each company only sees its own runs" : `Company A runs: ${companyARuns.length}, Company B runs: ${companyBRuns.length}`
      });
    }

    // ========== TEST 4: All run types work ==========
    console.log("Test 4: All run types can be stored...");
    {
      const runTypes = ["orchestrator", "jobs", "reaper"] as const;
      let allPassed = true;

      for (const runType of runTypes) {
        const runId = `sysrun-type-${runType}-${ts}`;
        await db.insert(orchestratorSystemRuns).values({
          id: runId,
          companyId: testCompanyId,
          type: runType,
          status: "success",
          startedAt: new Date(),
          completedAt: new Date(),
        });

        const [run] = await db.select()
          .from(orchestratorSystemRuns)
          .where(eq(orchestratorSystemRuns.id, runId))
          .limit(1);

        if (!run || run.type !== runType) {
          allPassed = false;
        }
      }

      testResults.push({ 
        name: "Test 4: All run types work", 
        passed: allPassed, 
        details: allPassed ? "All run types (orchestrator, jobs, reaper) stored correctly" : "Some run types failed"
      });
    }

    // ========== TEST 5: Health endpoint data structure ==========
    console.log("Test 5: Verify health endpoint data includes lastRuns...");
    {
      const { sql } = await import("drizzle-orm");

      const lastRunsRaw = await db.select()
        .from(orchestratorSystemRuns)
        .where(eq(orchestratorSystemRuns.companyId, testCompanyId))
        .orderBy(sql`${orchestratorSystemRuns.createdAt} DESC`)
        .limit(20);

      const lastRunsByType: Record<string, any> = {};
      for (const run of lastRunsRaw) {
        if (!lastRunsByType[run.type]) {
          lastRunsByType[run.type] = { completedAt: run.completedAt, status: run.status, startedAt: run.startedAt };
        }
      }

      const lastErrors = await db.select()
        .from(orchestratorSystemRuns)
        .where(and(
          eq(orchestratorSystemRuns.companyId, testCompanyId),
          eq(orchestratorSystemRuns.status, "error")
        ))
        .orderBy(sql`${orchestratorSystemRuns.createdAt} DESC`)
        .limit(10);

      const hasOrchestratorRun = !!lastRunsByType["orchestrator"];
      const hasJobsRun = !!lastRunsByType["jobs"];
      const hasReaperRun = !!lastRunsByType["reaper"];
      const hasErrors = lastErrors.length > 0;

      const passed = hasOrchestratorRun && hasJobsRun && hasReaperRun && hasErrors;

      testResults.push({ 
        name: "Test 5: Health endpoint data structure", 
        passed, 
        details: passed 
          ? `lastRunsByType has all expected types, ${lastErrors.length} errors found` 
          : `orchestrator=${hasOrchestratorRun}, jobs=${hasJobsRun}, reaper=${hasReaperRun}, errors=${hasErrors}`
      });
    }

  } catch (error: any) {
    console.error("Test setup/execution error:", error);
    testResults.push({ name: "Test Execution", passed: false, details: error.message });
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  try {
    await db.delete(orchestratorSystemRuns).where(eq(orchestratorSystemRuns.companyId, testCompanyId));
    await db.delete(orchestratorSystemRuns).where(eq(orchestratorSystemRuns.companyId, otherCompanyId));
    await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.id, testCampaignId));
    await db.delete(companies).where(eq(companies.id, testCompanyId));
    await db.delete(companies).where(eq(companies.id, otherCompanyId));
    console.log("Cleanup complete.");
  } catch (cleanupError: any) {
    console.error("Cleanup error (non-fatal):", cleanupError.message);
  }

  // Print results
  console.log("\n============================================================");
  console.log("TEST RESULTS");
  console.log("============================================================");

  let passCount = 0;
  let failCount = 0;

  for (const result of testResults) {
    const icon = result.passed ? "✓" : "✗";
    const color = result.passed ? "\x1b[32m" : "\x1b[31m";
    console.log(`${color}${icon}\x1b[0m ${result.name}`);
    console.log(`  ${result.details}`);
    if (result.passed) passCount++;
    else failCount++;
  }

  console.log("\n============================================================");
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed`);
  console.log("============================================================");

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
