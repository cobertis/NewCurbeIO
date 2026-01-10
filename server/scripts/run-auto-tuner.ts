/**
 * Auto-Tuner Worker Script
 * Computes and saves allocation recommendations for campaigns with autoTune enabled
 * 
 * Usage: npx tsx server/scripts/run-auto-tuner.ts [--company-id=xxx] [--campaign-id=xxx]
 */

import { db } from "../db";
import { orchestratorCampaigns } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  parseAutoTuneConfig,
  computeAutoTuneRecommendation,
  saveAutoTuneSnapshot,
  logAutoTuneAudit,
  AutoTuneConfig
} from "../services/orchestrator-auto-tuner";

interface RunResult {
  campaignId: string;
  companyId: string;
  status: "computed" | "skipped" | "error";
  message?: string;
  snapshotId?: string;
}

async function runAutoTuner(options: {
  companyId?: string;
  campaignId?: string;
  window?: string;
}): Promise<RunResult[]> {
  const results: RunResult[] = [];
  const window = options.window || "7d";
  
  console.log("=== Auto-Tuner Worker ===");
  console.log(`Window: ${window}`);
  if (options.companyId) console.log(`Company: ${options.companyId}`);
  if (options.campaignId) console.log(`Campaign: ${options.campaignId}`);
  console.log("");
  
  let campaigns = await db.select()
    .from(orchestratorCampaigns)
    .where(
      options.companyId 
        ? eq(orchestratorCampaigns.companyId, options.companyId)
        : undefined
    );
  
  if (options.campaignId) {
    campaigns = campaigns.filter(c => c.id === options.campaignId);
  }
  
  campaigns = campaigns.filter(c => c.status === "running" || c.status === "paused");
  
  console.log(`Found ${campaigns.length} campaign(s) to evaluate\n`);
  
  for (const campaign of campaigns) {
    const policyJson = campaign.policyJson as Record<string, any> || {};
    const config = parseAutoTuneConfig(policyJson);
    
    if (!config) {
      console.log(`[${campaign.id}] Skipped: autoTune not enabled`);
      results.push({
        campaignId: campaign.id,
        companyId: campaign.companyId,
        status: "skipped",
        message: "autoTune not enabled"
      });
      continue;
    }
    
    try {
      console.log(`[${campaign.id}] Computing recommendation...`);
      
      const result = await computeAutoTuneRecommendation(
        campaign.companyId,
        campaign.id,
        policyJson,
        window
      );
      
      if (result.skipped) {
        console.log(`  Skipped: ${result.skipReason}`);
        results.push({
          campaignId: campaign.id,
          companyId: campaign.companyId,
          status: "skipped",
          message: result.skipReason
        });
        
        await logAutoTuneAudit(campaign.companyId, campaign.id, result, "");
        continue;
      }
      
      const snapshotId = await saveAutoTuneSnapshot(result, config);
      await logAutoTuneAudit(campaign.companyId, campaign.id, result, snapshotId);
      
      console.log(`  Snapshot saved: ${snapshotId}`);
      console.log(`  Current allocations: ${JSON.stringify(result.currentAllocations)}`);
      console.log(`  Recommended: ${JSON.stringify(result.recommendedAllocations)}`);
      console.log(`  Metrics:`);
      for (const m of result.metricsSnapshot) {
        console.log(`    ${m.variant}: attempts=${m.attempts}, reward=${m.reward}, rate=${m.rewardRate}`);
      }
      
      results.push({
        campaignId: campaign.id,
        companyId: campaign.companyId,
        status: "computed",
        snapshotId
      });
      
    } catch (error) {
      console.error(`  Error: ${error}`);
      results.push({
        campaignId: campaign.id,
        companyId: campaign.companyId,
        status: "error",
        message: String(error)
      });
    }
  }
  
  console.log("\n=== Summary ===");
  console.log(`Computed: ${results.filter(r => r.status === "computed").length}`);
  console.log(`Skipped: ${results.filter(r => r.status === "skipped").length}`);
  console.log(`Errors: ${results.filter(r => r.status === "error").length}`);
  
  return results;
}

const args = process.argv.slice(2);
const companyId = args.find(a => a.startsWith("--company-id="))?.split("=")[1];
const campaignId = args.find(a => a.startsWith("--campaign-id="))?.split("=")[1];
const window = args.find(a => a.startsWith("--window="))?.split("=")[1];

runAutoTuner({ companyId, campaignId, window })
  .then(results => {
    process.exit(results.some(r => r.status === "error") ? 1 : 0);
  })
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
