/**
 * Orchestrator Auto-Tuner Service
 * Multi-armed Bandit (epsilon-greedy) for variant allocation optimization
 * 
 * REWARD FUNCTION (score_v1):
 * reward = replies - 3*optOuts - 0.5*failedFinal - 0.2*cost
 * 
 * EPSILON-GREEDY BANDIT:
 * - With probability epsilon: explore (random allocation within min/max)
 * - Otherwise: exploit (allocate more to higher rewardRate variants)
 */

import { db } from "../db";
import { 
  orchestratorCampaigns, 
  orchestratorExperimentAllocations,
  campaignEvents,
  campaignContacts,
  campaignAuditLogs
} from "@shared/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";

export interface AutoTuneConfig {
  enabled: boolean;
  objective: string; // "score_v1"
  minSampleSize: number;
  updateFrequencyHours: number;
  epsilon: number;
  minAllocation: number;
  maxAllocation: number;
}

export interface VariantMetricsSnapshot {
  variant: string;
  attempts: number;
  replies: number;
  optOuts: number;
  failedFinal: number;
  cost: number;
  reward: number;
  rewardRate: number;
}

export interface AutoTuneResult {
  campaignId: string;
  companyId: string;
  window: string;
  currentAllocations: Record<string, number>;
  recommendedAllocations: Record<string, number>;
  metricsSnapshot: VariantMetricsSnapshot[];
  skipped: boolean;
  skipReason?: string;
}

export function parseAutoTuneConfig(policyJson: any): AutoTuneConfig | null {
  if (!policyJson?.experiment?.autoTune?.enabled) {
    return null;
  }
  
  const at = policyJson.experiment.autoTune;
  return {
    enabled: true,
    objective: at.objective || "score_v1",
    minSampleSize: at.minSampleSize || 50,
    updateFrequencyHours: at.updateFrequencyHours || 24,
    epsilon: at.epsilon ?? 0.1,
    minAllocation: at.minAllocation ?? 0.1,
    maxAllocation: at.maxAllocation ?? 0.9
  };
}

export function calculateReward(metrics: {
  replies: number;
  optOuts: number;
  failedFinal: number;
  cost: number;
}): number {
  return metrics.replies - 3 * metrics.optOuts - 0.5 * metrics.failedFinal - 0.2 * metrics.cost;
}

export function computeEpsilonGreedyAllocations(
  variantMetrics: VariantMetricsSnapshot[],
  config: AutoTuneConfig,
  seed?: number
): Record<string, number> {
  if (variantMetrics.length === 0) {
    return {};
  }
  
  if (variantMetrics.length === 1) {
    return { [variantMetrics[0].variant]: 1.0 };
  }
  
  let allocations: Record<string, number> = {};
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  
  if (random() < config.epsilon) {
    const equalShare = 1.0 / variantMetrics.length;
    for (const m of variantMetrics) {
      allocations[m.variant] = equalShare;
    }
  } else {
    const totalRewardRate = variantMetrics.reduce((sum, m) => sum + Math.max(0, m.rewardRate), 0);
    
    if (totalRewardRate === 0) {
      const equalShare = 1.0 / variantMetrics.length;
      for (const m of variantMetrics) {
        allocations[m.variant] = equalShare;
      }
    } else {
      for (const m of variantMetrics) {
        const rawAlloc = Math.max(0, m.rewardRate) / totalRewardRate;
        allocations[m.variant] = rawAlloc;
      }
    }
  }
  
  allocations = projectToBoxConstraints(
    allocations,
    config.minAllocation,
    config.maxAllocation
  );
  
  return allocations;
}

function projectToBoxConstraints(
  allocations: Record<string, number>,
  minAlloc: number,
  maxAlloc: number,
  maxIterations: number = 10
): Record<string, number> {
  const keys = Object.keys(allocations);
  const n = keys.length;
  
  if (n === 0) return allocations;
  
  if (n * minAlloc > 1 + 0.01) {
    const equalShare = Math.round((1 / n) * 100) / 100;
    for (const k of keys) {
      allocations[k] = equalShare;
    }
    const diff = 1 - keys.reduce((s, k) => s + allocations[k], 0);
    allocations[keys[0]] = Math.round((allocations[keys[0]] + diff) * 100) / 100;
    return allocations;
  }
  
  if (n * maxAlloc < 1 - 0.01) {
    const equalShare = Math.round((1 / n) * 100) / 100;
    for (const k of keys) {
      allocations[k] = equalShare;
    }
    const diff = 1 - keys.reduce((s, k) => s + allocations[k], 0);
    allocations[keys[0]] = Math.round((allocations[keys[0]] + diff) * 100) / 100;
    return allocations;
  }
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let excess = 0;
    let unfixedCount = 0;
    const fixed: Record<string, boolean> = {};
    
    for (const k of keys) {
      if (allocations[k] < minAlloc) {
        excess += minAlloc - allocations[k];
        allocations[k] = minAlloc;
        fixed[k] = true;
      } else if (allocations[k] > maxAlloc) {
        excess -= allocations[k] - maxAlloc;
        allocations[k] = maxAlloc;
        fixed[k] = true;
      } else {
        unfixedCount++;
      }
    }
    
    const total = keys.reduce((s, k) => s + allocations[k], 0);
    const diff = 1 - total;
    
    if (Math.abs(diff) < 0.005) break;
    
    const unfixedKeys = keys.filter(k => !fixed[k]);
    if (unfixedKeys.length > 0) {
      const adjust = diff / unfixedKeys.length;
      for (const k of unfixedKeys) {
        allocations[k] += adjust;
      }
    } else {
      const sortedKeys = [...keys].sort((a, b) => allocations[b] - allocations[a]);
      if (diff > 0) {
        for (const k of sortedKeys) {
          if (allocations[k] < maxAlloc) {
            const canAdd = Math.min(diff, maxAlloc - allocations[k]);
            allocations[k] += canAdd;
            break;
          }
        }
      } else {
        for (const k of [...sortedKeys].reverse()) {
          if (allocations[k] > minAlloc) {
            const canSub = Math.min(-diff, allocations[k] - minAlloc);
            allocations[k] -= canSub;
            break;
          }
        }
      }
    }
  }
  
  for (const k of keys) {
    allocations[k] = Math.round(allocations[k] * 100) / 100;
  }
  
  const finalTotal = keys.reduce((s, k) => s + allocations[k], 0);
  if (Math.abs(finalTotal - 1.0) > 0.005) {
    const diff = 1.0 - finalTotal;
    const sortedKeys = [...keys].sort((a, b) => allocations[b] - allocations[a]);
    if (diff > 0) {
      for (const k of sortedKeys) {
        if (allocations[k] + diff <= maxAlloc) {
          allocations[k] = Math.round((allocations[k] + diff) * 100) / 100;
          break;
        }
      }
    } else {
      for (const k of [...sortedKeys].reverse()) {
        if (allocations[k] + diff >= minAlloc) {
          allocations[k] = Math.round((allocations[k] + diff) * 100) / 100;
          break;
        }
      }
    }
  }
  
  return allocations;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export async function getVariantMetrics(
  companyId: string,
  campaignId: string,
  window: string
): Promise<VariantMetricsSnapshot[]> {
  let windowStart: Date | null = null;
  if (window === "7d") {
    windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (window === "30d") {
    windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
  
  const eventCounts = await db.execute(sql`
    SELECT 
      COALESCE(cc.variant, 'control') as variant,
      ce.event_type,
      COUNT(*) as cnt
    FROM campaign_events ce
    JOIN campaign_contacts cc ON ce.campaign_contact_id = cc.id
    WHERE ce.company_id = ${companyId}
      AND ce.campaign_id = ${campaignId}
      ${windowStart ? sql`AND ce.created_at >= ${windowStart}` : sql``}
    GROUP BY cc.variant, ce.event_type
  `);
  
  const failedFinalCounts = await db.execute(sql`
    SELECT 
      COALESCE(cc.variant, 'control') as variant,
      COUNT(*) as cnt
    FROM campaign_events ce
    JOIN campaign_contacts cc ON ce.campaign_contact_id = cc.id
    WHERE ce.company_id = ${companyId}
      AND ce.campaign_id = ${campaignId}
      AND ce.event_type = 'MESSAGE_FAILED'
      AND (ce.payload->>'isFinal')::boolean = true
      ${windowStart ? sql`AND ce.created_at >= ${windowStart}` : sql``}
    GROUP BY cc.variant
  `);
  
  const costSums = await db.execute(sql`
    SELECT 
      COALESCE(cc.variant, 'control') as variant,
      SUM(COALESCE(ce.cost_amount::numeric, 0)) as total_cost
    FROM campaign_events ce
    JOIN campaign_contacts cc ON ce.campaign_contact_id = cc.id
    WHERE ce.company_id = ${companyId}
      AND ce.campaign_id = ${campaignId}
      ${windowStart ? sql`AND ce.created_at >= ${windowStart}` : sql``}
    GROUP BY cc.variant
  `);
  
  const variantData: Record<string, {
    attempts: number;
    replies: number;
    optOuts: number;
    failedFinal: number;
    cost: number;
  }> = {};
  
  for (const row of (eventCounts.rows || []) as any[]) {
    const v = row.variant || "control";
    if (!variantData[v]) {
      variantData[v] = { attempts: 0, replies: 0, optOuts: 0, failedFinal: 0, cost: 0 };
    }
    
    const cnt = Number(row.cnt);
    const et = row.event_type as string;
    
    if (["MESSAGE_SENT", "CALL_PLACED", "VOICEMAIL_DROPPED", "RVM_DROPPED"].includes(et)) {
      variantData[v].attempts += cnt;
    }
    if (et === "MESSAGE_REPLIED") variantData[v].replies += cnt;
    if (et === "OPT_OUT") variantData[v].optOuts += cnt;
  }
  
  for (const row of (failedFinalCounts.rows || []) as any[]) {
    const v = row.variant || "control";
    if (variantData[v]) {
      variantData[v].failedFinal = Number(row.cnt);
    }
  }
  
  for (const row of (costSums.rows || []) as any[]) {
    const v = row.variant || "control";
    if (variantData[v]) {
      variantData[v].cost = Number(row.total_cost) || 0;
    }
  }
  
  const result: VariantMetricsSnapshot[] = [];
  for (const [variant, d] of Object.entries(variantData)) {
    const reward = calculateReward(d);
    const rewardRate = d.attempts > 0 ? reward / d.attempts : 0;
    
    result.push({
      variant,
      attempts: d.attempts,
      replies: d.replies,
      optOuts: d.optOuts,
      failedFinal: d.failedFinal,
      cost: d.cost,
      reward: Math.round(reward * 100) / 100,
      rewardRate: Math.round(rewardRate * 1000) / 1000
    });
  }
  
  return result;
}

export async function computeAutoTuneRecommendation(
  companyId: string,
  campaignId: string,
  policyJson: any,
  window: string = "7d"
): Promise<AutoTuneResult> {
  const config = parseAutoTuneConfig(policyJson);
  
  if (!config) {
    return {
      campaignId,
      companyId,
      window,
      currentAllocations: policyJson?.experiment?.allocation || {},
      recommendedAllocations: {},
      metricsSnapshot: [],
      skipped: true,
      skipReason: "autoTune not enabled"
    };
  }
  
  const metrics = await getVariantMetrics(companyId, campaignId, window);
  
  const insufficientSample = metrics.some(m => m.attempts < config.minSampleSize);
  if (insufficientSample) {
    return {
      campaignId,
      companyId,
      window,
      currentAllocations: policyJson?.experiment?.allocation || {},
      recommendedAllocations: {},
      metricsSnapshot: metrics,
      skipped: true,
      skipReason: `minSampleSize (${config.minSampleSize}) not met for all variants`
    };
  }
  
  const recommendedAllocations = computeEpsilonGreedyAllocations(metrics, config);
  
  return {
    campaignId,
    companyId,
    window,
    currentAllocations: policyJson?.experiment?.allocation || {},
    recommendedAllocations,
    metricsSnapshot: metrics,
    skipped: false
  };
}

export async function saveAutoTuneSnapshot(
  result: AutoTuneResult,
  config: AutoTuneConfig
): Promise<string> {
  const [inserted] = await db.insert(orchestratorExperimentAllocations)
    .values({
      companyId: result.companyId,
      campaignId: result.campaignId,
      window: result.window,
      allocationsJson: result.recommendedAllocations,
      metricsSnapshotJson: result.metricsSnapshot,
      objective: config.objective,
      epsilon: config.epsilon.toString()
    })
    .returning({ id: orchestratorExperimentAllocations.id });
  
  return inserted.id;
}

export async function logAutoTuneAudit(
  companyId: string,
  campaignId: string,
  result: AutoTuneResult,
  snapshotId: string
): Promise<void> {
  await db.insert(campaignAuditLogs).values({
    companyId,
    campaignId,
    logType: "auto_tune_recommendation",
    actionTaken: result.skipped ? "skipped" : "computed",
    payload: {
      snapshotId,
      window: result.window,
      skipped: result.skipped,
      skipReason: result.skipReason,
      currentAllocations: result.currentAllocations,
      recommendedAllocations: result.recommendedAllocations,
      metricsSnapshot: result.metricsSnapshot
    }
  });
}

export async function getLatestAllocationRecommendation(
  companyId: string,
  campaignId: string
): Promise<{
  id: string;
  computedAt: Date;
  window: string;
  allocationsJson: Record<string, number>;
  metricsSnapshotJson: VariantMetricsSnapshot[];
  objective: string;
  epsilon: number | null;
} | null> {
  const [latest] = await db.select()
    .from(orchestratorExperimentAllocations)
    .where(and(
      eq(orchestratorExperimentAllocations.companyId, companyId),
      eq(orchestratorExperimentAllocations.campaignId, campaignId)
    ))
    .orderBy(desc(orchestratorExperimentAllocations.computedAt))
    .limit(1);
  
  if (!latest) return null;
  
  return {
    id: latest.id,
    computedAt: latest.computedAt,
    window: latest.window,
    allocationsJson: latest.allocationsJson as Record<string, number>,
    metricsSnapshotJson: latest.metricsSnapshotJson as VariantMetricsSnapshot[],
    objective: latest.objective,
    epsilon: latest.epsilon ? parseFloat(latest.epsilon) : null
  };
}
