/**
 * Auto-Tuner Worker Script
 * Computes and saves allocation recommendations for campaigns with autoTune enabled
 * Optionally auto-applies recommendations if AUTO_TUNE_AUTO_APPLY_ENABLED=true
 * 
 * Usage: npx tsx server/scripts/run-auto-tuner.ts [--company-id=xxx] [--campaign-id=xxx] [--window=7d]
 */

import { db } from "../db";
import { orchestratorCampaigns } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  parseAutoTuneConfig,
  parseAutoApplyConfig,
  computeAutoTuneRecommendation,
  saveAutoTuneSnapshot,
  logAutoTuneAudit,
  executeAutoApply,
  checkAndExecuteAutoRollback,
  AutoTuneConfig,
  AutoApplyConfig
} from "../services/orchestrator-auto-tuner";

interface RunResult {
  campaignId: string;
  companyId: string;
  status: "computed" | "skipped" | "error" | "auto_applied" | "auto_rollback";
  message?: string;
  snapshotId?: string;
  autoApplyResult?: any;
  autoRollbackResult?: any;
}

function isAutoApplyEnabled(): boolean {
  return process.env.AUTO_TUNE_AUTO_APPLY_ENABLED === "true";
}

async function runAutoTuner(options: {
  companyId?: string;
  campaignId?: string;
  window?: string;
}): Promise<RunResult[]> {
  const results: RunResult[] = [];
  const window = options.window || "7d";
  const autoApplyGlobalEnabled = isAutoApplyEnabled();
  
  console.log("=== Auto-Tuner Worker ===");
  console.log(`Window: ${window}`);
  console.log(`Global Auto-Apply Enabled: ${autoApplyGlobalEnabled}`);
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
    const autoApplyConfig = parseAutoApplyConfig(policyJson);
    
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
        console.log(`    ${m.variant}: attempts=${m.attempts}, reward=${m.reward.toFixed(2)}, rate=${m.rewardRate.toFixed(4)}`);
      }
      
      if (autoApplyGlobalEnabled && autoApplyConfig?.enabled) {
        console.log(`  Checking for auto-rollback first...`);
        const rollbackResult = await checkAndExecuteAutoRollback(
          campaign.companyId,
          campaign.id,
          result.metricsSnapshot,
          autoApplyConfig
        );
        
        if (rollbackResult.rolledBack) {
          console.log(`  AUTO-ROLLBACK executed: ${rollbackResult.reason}`);
          results.push({
            campaignId: campaign.id,
            companyId: campaign.companyId,
            status: "auto_rollback",
            snapshotId,
            autoRollbackResult: rollbackResult
          });
          continue;
        } else {
          console.log(`  No rollback needed: ${rollbackResult.reason}`);
        }
        
        console.log(`  Evaluating auto-apply guardrails...`);
        const autoApplyResult = await executeAutoApply(
          campaign.companyId,
          campaign.id,
          snapshotId,
          result.metricsSnapshot,
          result.currentAllocations,
          result.recommendedAllocations,
          autoApplyConfig,
          policyJson
        );
        
        if (autoApplyResult.applied) {
          console.log(`  AUTO-APPLIED: ${JSON.stringify(autoApplyResult.newAllocation)}`);
          if (autoApplyResult.clampedDelta) {
            console.log(`    (allocation was clamped by maxDeltaPerRun)`);
          }
          results.push({
            campaignId: campaign.id,
            companyId: campaign.companyId,
            status: "auto_applied",
            snapshotId,
            autoApplyResult
          });
        } else {
          console.log(`  Auto-apply blocked: ${autoApplyResult.reason}`);
          for (const check of autoApplyResult.guardrails?.checks || []) {
            console.log(`    ${check.passed ? '✓' : '✗'} ${check.name}: ${check.message}`);
          }
          results.push({
            campaignId: campaign.id,
            companyId: campaign.companyId,
            status: "computed",
            snapshotId,
            message: `Auto-apply blocked: ${autoApplyResult.reason}`,
            autoApplyResult
          });
        }
      } else {
        if (!autoApplyGlobalEnabled) {
          console.log(`  Auto-apply: disabled globally (kill switch)`);
        } else if (!autoApplyConfig?.enabled) {
          console.log(`  Auto-apply: not enabled for this campaign`);
        }
        
        results.push({
          campaignId: campaign.id,
          companyId: campaign.companyId,
          status: "computed",
          snapshotId
        });
      }
      
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
  console.log(`Auto-applied: ${results.filter(r => r.status === "auto_applied").length}`);
  console.log(`Auto-rollback: ${results.filter(r => r.status === "auto_rollback").length}`);
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
