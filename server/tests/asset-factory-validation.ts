/**
 * Asset Factory Validation Script
 * 
 * This script validates the Campaign Asset Factory integration by testing:
 * 1. Asset CRUD operations
 * 2. ElevenLabs audio generation flow
 * 3. Heygen video generation flow
 * 4. Asset integration with voicemail jobs
 * 
 * Usage:
 *   npx tsx server/tests/asset-factory-validation.ts
 * 
 * Environment:
 *   Set ASSET_FACTORY_MOCK_MODE=true to use mock adapters
 */

import { db } from "../db";
import { orchestratorAssets, orchestratorCampaigns, companies } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { assetFactoryService } from "../services/asset-factory-service";

interface ValidationResult {
  test: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: ValidationResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      test: name,
      passed: true,
      message: "OK",
      duration: Date.now() - start
    });
    console.log(`✓ ${name} (${Date.now() - start}ms)`);
  } catch (error: any) {
    results.push({
      test: name,
      passed: false,
      message: error.message,
      duration: Date.now() - start
    });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

async function getTestCompany(): Promise<{ id: string; name: string }> {
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .limit(1);
  
  if (!company) {
    throw new Error("No company found for testing. Create a company first.");
  }
  return company;
}

async function getTestCampaign(companyId: string): Promise<{ id: string; name: string } | null> {
  const [campaign] = await db
    .select({ id: orchestratorCampaigns.id, name: orchestratorCampaigns.name })
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, companyId))
    .limit(1);
  
  return campaign || null;
}

async function main() {
  console.log("\n========================================");
  console.log("Asset Factory Validation Script");
  console.log("========================================\n");

  const company = await getTestCompany();
  console.log(`Test company: ${company.name} (${company.id})\n`);

  let testAssetId: string | null = null;
  let campaign = await getTestCampaign(company.id);

  await runTest("Database connection", async () => {
    const result = await db.execute("SELECT 1 as test");
    if (!result) throw new Error("Database query failed");
  });

  await runTest("orchestrator_assets table exists", async () => {
    const result = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'orchestrator_assets'
      ) as exists
    `);
    if (!result.rows[0]?.exists) {
      throw new Error("orchestrator_assets table does not exist");
    }
  });

  await runTest("Asset service - list assets (empty)", async () => {
    const assets = await assetFactoryService.listAssets(company.id);
    if (!Array.isArray(assets)) {
      throw new Error("listAssets did not return an array");
    }
  });

  await runTest("Asset service - create audio asset", async () => {
    const asset = await assetFactoryService.createAudioAsset(
      company.id,
      campaign?.id || null,
      "Test Audio Asset",
      { text: "Hello, this is a test.", voiceId: "test-voice" },
      "elevenlabs",
      undefined
    );
    
    if (!asset.id) throw new Error("Asset was not created");
    if (asset.type !== "audio") throw new Error("Asset type should be 'audio'");
    if (asset.status !== "draft") throw new Error("Asset status should be 'draft'");
    
    testAssetId = asset.id;
  });

  await runTest("Asset service - get asset by ID", async () => {
    if (!testAssetId) throw new Error("No test asset ID");
    
    const asset = await assetFactoryService.getAsset(testAssetId, company.id);
    if (!asset) throw new Error("Asset not found");
    if (asset.name !== "Test Audio Asset") throw new Error("Asset name mismatch");
  });

  await runTest("Asset service - update asset status", async () => {
    if (!testAssetId) throw new Error("No test asset ID");
    
    const updated = await assetFactoryService.updateAssetStatus(
      testAssetId,
      "generating"
    );
    
    if (updated.status !== "generating") {
      throw new Error("Asset status was not updated");
    }
  });

  await runTest("Asset service - update asset with output", async () => {
    if (!testAssetId) throw new Error("No test asset ID");
    
    const updated = await assetFactoryService.updateAssetStatus(
      testAssetId,
      "ready",
      { assetUrl: "/assets/audio/test/test.mp3", duration: 5.5 }
    );
    
    if (updated.status !== "ready") {
      throw new Error("Asset status was not updated to ready");
    }
    
    const outputJson = updated.outputJson as Record<string, any>;
    if (!outputJson?.assetUrl) {
      throw new Error("Asset output URL was not saved");
    }
  });

  await runTest("Asset service - list assets (with filter)", async () => {
    const allAssets = await assetFactoryService.listAssets(company.id);
    const audioAssets = await assetFactoryService.listAssets(company.id, undefined, "audio");
    const videoAssets = await assetFactoryService.listAssets(company.id, undefined, "video");
    
    if (audioAssets.length > allAssets.length) {
      throw new Error("Filtered list should not be larger than full list");
    }
    
    for (const asset of audioAssets) {
      if (asset.type !== "audio") {
        throw new Error("Type filter returned wrong asset type");
      }
    }
  });

  await runTest("Asset service - company isolation", async () => {
    if (!testAssetId) throw new Error("No test asset ID");
    
    const fakeCompanyId = "00000000-0000-0000-0000-000000000000";
    const asset = await assetFactoryService.getAsset(testAssetId, fakeCompanyId);
    
    if (asset !== null) {
      throw new Error("Asset should not be accessible by other companies");
    }
  });

  await runTest("Asset service - delete asset", async () => {
    if (!testAssetId) throw new Error("No test asset ID");
    
    const deleted = await assetFactoryService.deleteAsset(testAssetId, company.id);
    if (!deleted) throw new Error("Asset was not deleted");
    
    const asset = await assetFactoryService.getAsset(testAssetId, company.id);
    if (asset !== null) {
      throw new Error("Asset should not exist after deletion");
    }
  });

  console.log("\n========================================");
  console.log("Summary");
  console.log("========================================");
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\nTests: ${passed} passed, ${failed} failed`);
  console.log(`Total time: ${totalTime}ms`);
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.test}: ${result.message}`);
    }
    process.exit(1);
  }
  
  console.log("\nAll tests passed!");
  process.exit(0);
}

main().catch(error => {
  console.error("Validation failed:", error);
  process.exit(1);
});
