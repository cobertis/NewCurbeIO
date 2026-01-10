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

export interface AllocationRecommendation {
  id: string;
  computedAt: Date;
  window: string;
  allocationsJson: Record<string, number>;
  metricsSnapshotJson: VariantMetricsSnapshot[];
  objective: string;
  epsilon: number | null;
  coverageWarnings: { variant: string; message: string }[];
}

export async function getLatestAllocationRecommendation(
  companyId: string,
  campaignId: string
): Promise<AllocationRecommendation | null> {
  const [latest] = await db.select()
    .from(orchestratorExperimentAllocations)
    .where(and(
      eq(orchestratorExperimentAllocations.companyId, companyId),
      eq(orchestratorExperimentAllocations.campaignId, campaignId)
    ))
    .orderBy(desc(orchestratorExperimentAllocations.computedAt))
    .limit(1);
  
  if (!latest) return null;
  
  const metricsSnapshot = latest.metricsSnapshotJson as VariantMetricsSnapshot[];
  const coverageWarnings: { variant: string; message: string }[] = [];
  
  for (const m of metricsSnapshot) {
    if (m.attempts < 50) {
      coverageWarnings.push({
        variant: m.variant,
        message: `Insufficient data: only ${m.attempts} attempts (recommend 50+)`
      });
    }
  }
  
  return {
    id: latest.id,
    computedAt: latest.computedAt,
    window: latest.window,
    allocationsJson: latest.allocationsJson as Record<string, number>,
    metricsSnapshotJson: metricsSnapshot,
    objective: latest.objective,
    epsilon: latest.epsilon ? parseFloat(latest.epsilon) : null,
    coverageWarnings
  };
}

export interface ApplyAllocationResult {
  success: boolean;
  campaignId: string;
  oldAllocation: Record<string, number>;
  newAllocation: Record<string, number>;
  auditLogId: string;
}

export async function applyAllocationRecommendation(
  companyId: string,
  campaignId: string,
  snapshotId: string,
  mode: "replace" | "blend",
  blendFactor: number = 0.5
): Promise<ApplyAllocationResult> {
  const [snapshot] = await db.select()
    .from(orchestratorExperimentAllocations)
    .where(and(
      eq(orchestratorExperimentAllocations.id, snapshotId),
      eq(orchestratorExperimentAllocations.companyId, companyId),
      eq(orchestratorExperimentAllocations.campaignId, campaignId)
    ))
    .limit(1);
  
  if (!snapshot) {
    throw new Error("Snapshot not found or access denied");
  }
  
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(and(
      eq(orchestratorCampaigns.id, campaignId),
      eq(orchestratorCampaigns.companyId, companyId)
    ))
    .limit(1);
  
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  
  const policyJson = (campaign.policyJson as Record<string, any>) || {};
  const oldAllocation = policyJson?.experiment?.allocation || {};
  const recommendedAllocation = snapshot.allocationsJson as Record<string, number>;
  
  let newAllocation: Record<string, number>;
  
  if (mode === "replace") {
    newAllocation = { ...recommendedAllocation };
  } else {
    newAllocation = {};
    const allVariants = Array.from(new Set([...Object.keys(oldAllocation), ...Object.keys(recommendedAllocation)]));
    
    for (const variant of allVariants) {
      const oldVal = oldAllocation[variant] || 0;
      const newVal = recommendedAllocation[variant] || 0;
      newAllocation[variant] = Math.round((oldVal * (1 - blendFactor) + newVal * blendFactor) * 100) / 100;
    }
    
    const total = Object.values(newAllocation).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const k of Object.keys(newAllocation)) {
        newAllocation[k] = Math.round((newAllocation[k] / total) * 100) / 100;
      }
    }
  }
  
  const minAlloc = policyJson?.experiment?.autoTune?.minAllocation || 0.1;
  const maxAlloc = policyJson?.experiment?.autoTune?.maxAllocation || 0.9;
  
  for (const k of Object.keys(newAllocation)) {
    newAllocation[k] = Math.max(minAlloc, Math.min(maxAlloc, newAllocation[k]));
  }
  
  const allocTotal = Object.values(newAllocation).reduce((a, b) => a + b, 0);
  if (Math.abs(allocTotal - 1.0) > 0.05) {
    const diff = 1.0 - allocTotal;
    const firstKey = Object.keys(newAllocation)[0];
    if (firstKey) {
      newAllocation[firstKey] = Math.round((newAllocation[firstKey] + diff) * 100) / 100;
    }
  }
  
  const updatedPolicyJson = {
    ...policyJson,
    experiment: {
      ...policyJson.experiment,
      allocation: newAllocation
    }
  };
  
  await db.update(orchestratorCampaigns)
    .set({ policyJson: updatedPolicyJson })
    .where(eq(orchestratorCampaigns.id, campaignId));
  
  const [auditLog] = await db.insert(campaignAuditLogs)
    .values({
      companyId,
      campaignId,
      logType: "auto_tune_apply",
      actionTaken: mode,
      payload: {
        snapshotId,
        oldAllocation,
        newAllocation,
        mode,
        blendFactor
      }
    })
    .returning({ id: campaignAuditLogs.id });
  
  return {
    success: true,
    campaignId,
    oldAllocation,
    newAllocation,
    auditLogId: auditLog.id
  };
}

export async function rollbackAllocation(
  companyId: string,
  campaignId: string,
  auditLogId?: string,
  previousAllocation?: Record<string, number>
): Promise<{ success: boolean; restoredAllocation: Record<string, number>; auditLogId: string }> {
  let allocationToRestore: Record<string, number>;
  
  if (previousAllocation) {
    allocationToRestore = previousAllocation;
  } else if (auditLogId) {
    const [auditLog] = await db.select()
      .from(campaignAuditLogs)
      .where(and(
        eq(campaignAuditLogs.id, auditLogId),
        eq(campaignAuditLogs.companyId, companyId),
        eq(campaignAuditLogs.campaignId, campaignId),
        eq(campaignAuditLogs.logType, "auto_tune_apply")
      ))
      .limit(1);
    
    if (!auditLog) {
      throw new Error("Audit log not found or access denied");
    }
    
    const payload = auditLog.payload as { oldAllocation?: Record<string, number> };
    if (!payload?.oldAllocation) {
      throw new Error("No previous allocation found in audit log");
    }
    
    allocationToRestore = payload.oldAllocation;
  } else {
    throw new Error("Must provide auditLogId or previousAllocation");
  }
  
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(and(
      eq(orchestratorCampaigns.id, campaignId),
      eq(orchestratorCampaigns.companyId, companyId)
    ))
    .limit(1);
  
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  
  const policyJson = (campaign.policyJson as Record<string, any>) || {};
  const currentAllocation = policyJson?.experiment?.allocation || {};
  
  const updatedPolicyJson = {
    ...policyJson,
    experiment: {
      ...policyJson.experiment,
      allocation: allocationToRestore
    }
  };
  
  await db.update(orchestratorCampaigns)
    .set({ policyJson: updatedPolicyJson })
    .where(eq(orchestratorCampaigns.id, campaignId));
  
  const [newAuditLog] = await db.insert(campaignAuditLogs)
    .values({
      companyId,
      campaignId,
      logType: "auto_tune_rollback",
      actionTaken: "rollback",
      payload: {
        rolledBackFrom: currentAllocation,
        restoredTo: allocationToRestore,
        sourceAuditLogId: auditLogId
      }
    })
    .returning({ id: campaignAuditLogs.id });
  
  return {
    success: true,
    restoredAllocation: allocationToRestore,
    auditLogId: newAuditLog.id
  };
}

export async function getLastApplyAuditLog(
  companyId: string,
  campaignId: string
): Promise<{ id: string; payload: any; createdAt: Date } | null> {
  const [log] = await db.select()
    .from(campaignAuditLogs)
    .where(and(
      eq(campaignAuditLogs.companyId, companyId),
      eq(campaignAuditLogs.campaignId, campaignId),
      eq(campaignAuditLogs.logType, "auto_tune_apply")
    ))
    .orderBy(desc(campaignAuditLogs.createdAt))
    .limit(1);
  
  if (!log) return null;
  
  return {
    id: log.id,
    payload: log.payload,
    createdAt: log.createdAt
  };
}

export interface AutoApplyConfig {
  enabled: boolean;
  maxDeltaPerRun: number;
  minSampleSizeAllVariants: number;
  maxOptOutRate: number;
  window: string;
  applyMode: "replace" | "blend";
  blendFactor: number;
  rollbackIfWorse: {
    enabled: boolean;
    metric: "replyRate" | "score_v1";
    dropThreshold: number;
    baselineWindow: string;
  };
}

export function parseAutoApplyConfig(policyJson: any): AutoApplyConfig | null {
  if (!policyJson?.experiment?.autoTune?.autoApply?.enabled) {
    return null;
  }
  
  const aa = policyJson.experiment.autoTune.autoApply;
  return {
    enabled: true,
    maxDeltaPerRun: aa.maxDeltaPerRun ?? 0.2,
    minSampleSizeAllVariants: aa.minSampleSizeAllVariants ?? 50,
    maxOptOutRate: aa.maxOptOutRate ?? 0.03,
    window: aa.window || "7d",
    applyMode: aa.applyMode || "blend",
    blendFactor: aa.blendFactor ?? 0.5,
    rollbackIfWorse: {
      enabled: aa.rollbackIfWorse?.enabled ?? false,
      metric: aa.rollbackIfWorse?.metric || "replyRate",
      dropThreshold: aa.rollbackIfWorse?.dropThreshold ?? 0.05,
      baselineWindow: aa.rollbackIfWorse?.baselineWindow || "7d"
    }
  };
}

export interface GuardrailResult {
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    value?: number;
    threshold?: number;
  }[];
}

export function evaluateAutoApplyGuardrails(
  metrics: VariantMetricsSnapshot[],
  currentAllocation: Record<string, number>,
  recommendedAllocation: Record<string, number>,
  config: AutoApplyConfig
): GuardrailResult {
  const checks: GuardrailResult["checks"] = [];
  
  const minAttempts = Math.min(...metrics.map(m => m.attempts));
  const sampleSizePassed = minAttempts >= config.minSampleSizeAllVariants;
  checks.push({
    name: "minSampleSizeAllVariants",
    passed: sampleSizePassed,
    message: sampleSizePassed 
      ? `All variants have >= ${config.minSampleSizeAllVariants} attempts (min: ${minAttempts})`
      : `Variant with only ${minAttempts} attempts (need ${config.minSampleSizeAllVariants})`,
    value: minAttempts,
    threshold: config.minSampleSizeAllVariants
  });
  
  const totalAttempts = metrics.reduce((s, m) => s + m.attempts, 0);
  const totalOptOuts = metrics.reduce((s, m) => s + m.optOuts, 0);
  const optOutRate = totalAttempts > 0 ? totalOptOuts / totalAttempts : 0;
  const optOutPassed = optOutRate <= config.maxOptOutRate;
  checks.push({
    name: "maxOptOutRate",
    passed: optOutPassed,
    message: optOutPassed
      ? `Opt-out rate ${(optOutRate * 100).toFixed(2)}% <= ${(config.maxOptOutRate * 100).toFixed(1)}%`
      : `Opt-out rate ${(optOutRate * 100).toFixed(2)}% exceeds ${(config.maxOptOutRate * 100).toFixed(1)}%`,
    value: optOutRate,
    threshold: config.maxOptOutRate
  });
  
  let maxDelta = 0;
  for (const variant of Object.keys(recommendedAllocation)) {
    const current = currentAllocation[variant] || 0;
    const recommended = recommendedAllocation[variant] || 0;
    maxDelta = Math.max(maxDelta, Math.abs(recommended - current));
  }
  checks.push({
    name: "maxDeltaPerRun",
    passed: true,
    message: `Max allocation delta: ${(maxDelta * 100).toFixed(1)}% (will clamp if > ${(config.maxDeltaPerRun * 100).toFixed(0)}%)`,
    value: maxDelta,
    threshold: config.maxDeltaPerRun
  });
  
  return {
    passed: checks.every(c => c.passed),
    checks
  };
}

export function clampAllocationDelta(
  currentAllocation: Record<string, number>,
  recommendedAllocation: Record<string, number>,
  maxDelta: number
): Record<string, number> {
  const clamped: Record<string, number> = {};
  
  for (const variant of Object.keys(recommendedAllocation)) {
    const current = currentAllocation[variant] || 0;
    const recommended = recommendedAllocation[variant] || 0;
    const delta = recommended - current;
    const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));
    clamped[variant] = Math.round((current + clampedDelta) * 100) / 100;
  }
  
  const total = Object.values(clamped).reduce((a, b) => a + b, 0);
  if (total > 0 && Math.abs(total - 1.0) > 0.01) {
    const factor = 1.0 / total;
    for (const k of Object.keys(clamped)) {
      clamped[k] = Math.round(clamped[k] * factor * 100) / 100;
    }
  }
  
  return clamped;
}

export interface AutoApplyResult {
  applied: boolean;
  reason?: string;
  guardrails?: GuardrailResult;
  oldAllocation?: Record<string, number>;
  newAllocation?: Record<string, number>;
  clampedDelta?: boolean;
  auditLogId?: string;
  baselineMetrics?: { replyRate: number; score: number };
}

export async function executeAutoApply(
  companyId: string,
  campaignId: string,
  snapshotId: string,
  metrics: VariantMetricsSnapshot[],
  currentAllocation: Record<string, number>,
  recommendedAllocation: Record<string, number>,
  config: AutoApplyConfig,
  policyJson: Record<string, any>
): Promise<AutoApplyResult> {
  const guardrails = evaluateAutoApplyGuardrails(
    metrics,
    currentAllocation,
    recommendedAllocation,
    config
  );
  
  if (!guardrails.passed) {
    return {
      applied: false,
      reason: "Guardrails failed",
      guardrails
    };
  }
  
  let finalAllocation: Record<string, number>;
  let clampedDelta = false;
  
  if (config.applyMode === "blend") {
    finalAllocation = {};
    const allVariants = Array.from(new Set([...Object.keys(currentAllocation), ...Object.keys(recommendedAllocation)]));
    
    for (const variant of allVariants) {
      const oldVal = currentAllocation[variant] || 0;
      const newVal = recommendedAllocation[variant] || 0;
      finalAllocation[variant] = Math.round((oldVal * (1 - config.blendFactor) + newVal * config.blendFactor) * 100) / 100;
    }
    
    const total = Object.values(finalAllocation).reduce((a, b) => a + b, 0);
    if (total > 0 && Math.abs(total - 1.0) > 0.01) {
      for (const k of Object.keys(finalAllocation)) {
        finalAllocation[k] = Math.round((finalAllocation[k] / total) * 100) / 100;
      }
    }
  } else {
    finalAllocation = { ...recommendedAllocation };
  }
  
  const maxDeltaCheck = guardrails.checks.find(c => c.name === "maxDeltaPerRun");
  if (maxDeltaCheck && maxDeltaCheck.value! > config.maxDeltaPerRun) {
    finalAllocation = clampAllocationDelta(currentAllocation, finalAllocation, config.maxDeltaPerRun);
    clampedDelta = true;
  }
  
  const totalAttempts = metrics.reduce((s, m) => s + m.attempts, 0);
  const totalReplies = metrics.reduce((s, m) => s + m.replies, 0);
  const totalReward = metrics.reduce((s, m) => s + m.reward, 0);
  const baselineMetrics = {
    replyRate: totalAttempts > 0 ? totalReplies / totalAttempts : 0,
    score: totalReward
  };
  
  const updatedPolicyJson = {
    ...policyJson,
    experiment: {
      ...policyJson.experiment,
      allocation: finalAllocation
    }
  };
  
  await db.update(orchestratorCampaigns)
    .set({ policyJson: updatedPolicyJson })
    .where(eq(orchestratorCampaigns.id, campaignId));
  
  const [auditLog] = await db.insert(campaignAuditLogs)
    .values({
      companyId,
      campaignId,
      logType: "auto_tune_auto_apply",
      actionTaken: config.applyMode,
      payload: {
        snapshotId,
        oldAllocation: currentAllocation,
        newAllocation: finalAllocation,
        recommendedAllocation,
        clampedDelta,
        guardrails: guardrails.checks,
        baselineMetrics,
        config: {
          maxDeltaPerRun: config.maxDeltaPerRun,
          minSampleSizeAllVariants: config.minSampleSizeAllVariants,
          maxOptOutRate: config.maxOptOutRate
        }
      }
    })
    .returning({ id: campaignAuditLogs.id });
  
  return {
    applied: true,
    guardrails,
    oldAllocation: currentAllocation,
    newAllocation: finalAllocation,
    clampedDelta,
    auditLogId: auditLog.id,
    baselineMetrics
  };
}

export async function checkAndExecuteAutoRollback(
  companyId: string,
  campaignId: string,
  metrics: VariantMetricsSnapshot[],
  config: AutoApplyConfig
): Promise<{ rolledBack: boolean; reason?: string; auditLogId?: string }> {
  if (!config.rollbackIfWorse.enabled) {
    return { rolledBack: false, reason: "Rollback not enabled" };
  }
  
  const [lastAutoApply] = await db.select()
    .from(campaignAuditLogs)
    .where(and(
      eq(campaignAuditLogs.companyId, companyId),
      eq(campaignAuditLogs.campaignId, campaignId),
      eq(campaignAuditLogs.logType, "auto_tune_auto_apply")
    ))
    .orderBy(desc(campaignAuditLogs.createdAt))
    .limit(1);
  
  if (!lastAutoApply) {
    return { rolledBack: false, reason: "No previous auto-apply found" };
  }
  
  const alreadyRolledBack = await db.select()
    .from(campaignAuditLogs)
    .where(and(
      eq(campaignAuditLogs.companyId, companyId),
      eq(campaignAuditLogs.campaignId, campaignId),
      eq(campaignAuditLogs.logType, "auto_tune_auto_rollback"),
      sql`payload->>'sourceAutoApplyId' = ${lastAutoApply.id}`
    ))
    .limit(1);
  
  if (alreadyRolledBack.length > 0) {
    return { rolledBack: false, reason: "Already rolled back" };
  }
  
  const payload = lastAutoApply.payload as { 
    baselineMetrics?: { replyRate: number; score: number };
    oldAllocation?: Record<string, number>;
  };
  
  if (!payload.baselineMetrics) {
    return { rolledBack: false, reason: "No baseline metrics in last apply" };
  }
  
  const totalAttempts = metrics.reduce((s, m) => s + m.attempts, 0);
  const totalReplies = metrics.reduce((s, m) => s + m.replies, 0);
  const totalReward = metrics.reduce((s, m) => s + m.reward, 0);
  
  const currentMetrics = {
    replyRate: totalAttempts > 0 ? totalReplies / totalAttempts : 0,
    score: totalReward
  };
  
  const baseline = payload.baselineMetrics;
  let shouldRollback = false;
  let metricDrop = 0;
  
  if (config.rollbackIfWorse.metric === "replyRate") {
    if (baseline.replyRate > 0) {
      metricDrop = (baseline.replyRate - currentMetrics.replyRate) / baseline.replyRate;
      shouldRollback = metricDrop > config.rollbackIfWorse.dropThreshold;
    }
  } else {
    if (baseline.score > 0) {
      metricDrop = (baseline.score - currentMetrics.score) / baseline.score;
      shouldRollback = metricDrop > config.rollbackIfWorse.dropThreshold;
    }
  }
  
  if (!shouldRollback) {
    return { 
      rolledBack: false, 
      reason: `Metric drop ${(metricDrop * 100).toFixed(1)}% within threshold ${(config.rollbackIfWorse.dropThreshold * 100).toFixed(0)}%` 
    };
  }
  
  const oldAllocation = payload.oldAllocation;
  if (!oldAllocation) {
    return { rolledBack: false, reason: "No old allocation to restore" };
  }
  
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(and(
      eq(orchestratorCampaigns.id, campaignId),
      eq(orchestratorCampaigns.companyId, companyId)
    ))
    .limit(1);
  
  if (!campaign) {
    return { rolledBack: false, reason: "Campaign not found" };
  }
  
  const policyJson = (campaign.policyJson as Record<string, any>) || {};
  const currentAllocation = policyJson?.experiment?.allocation || {};
  
  const updatedPolicyJson = {
    ...policyJson,
    experiment: {
      ...policyJson.experiment,
      allocation: oldAllocation
    }
  };
  
  await db.update(orchestratorCampaigns)
    .set({ policyJson: updatedPolicyJson })
    .where(eq(orchestratorCampaigns.id, campaignId));
  
  const [auditLog] = await db.insert(campaignAuditLogs)
    .values({
      companyId,
      campaignId,
      logType: "auto_tune_auto_rollback",
      actionTaken: "auto_rollback",
      payload: {
        sourceAutoApplyId: lastAutoApply.id,
        rolledBackFrom: currentAllocation,
        restoredTo: oldAllocation,
        baselineMetrics: baseline,
        currentMetrics,
        metricDrop,
        threshold: config.rollbackIfWorse.dropThreshold,
        metric: config.rollbackIfWorse.metric
      }
    })
    .returning({ id: campaignAuditLogs.id });
  
  return {
    rolledBack: true,
    reason: `${config.rollbackIfWorse.metric} dropped ${(metricDrop * 100).toFixed(1)}% (threshold: ${(config.rollbackIfWorse.dropThreshold * 100).toFixed(0)}%)`,
    auditLogId: auditLog.id
  };
}

export async function getAutoApplyStatus(
  companyId: string,
  campaignId: string
): Promise<{
  autoApplyEnabled: boolean;
  killSwitchEnabled: boolean;
  lastAutoApply: { id: string; createdAt: Date; payload: any } | null;
  lastAutoRollback: { id: string; createdAt: Date; payload: any } | null;
}> {
  const killSwitchEnabled = process.env.AUTO_TUNE_AUTO_APPLY_ENABLED === "true";
  
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(and(
      eq(orchestratorCampaigns.id, campaignId),
      eq(orchestratorCampaigns.companyId, companyId)
    ))
    .limit(1);
  
  if (!campaign) {
    return { autoApplyEnabled: false, killSwitchEnabled, lastAutoApply: null, lastAutoRollback: null };
  }
  
  const config = parseAutoApplyConfig(campaign.policyJson);
  const autoApplyEnabled = config?.enabled ?? false;
  
  const [lastAutoApply] = await db.select()
    .from(campaignAuditLogs)
    .where(and(
      eq(campaignAuditLogs.companyId, companyId),
      eq(campaignAuditLogs.campaignId, campaignId),
      eq(campaignAuditLogs.logType, "auto_tune_auto_apply")
    ))
    .orderBy(desc(campaignAuditLogs.createdAt))
    .limit(1);
  
  const [lastAutoRollback] = await db.select()
    .from(campaignAuditLogs)
    .where(and(
      eq(campaignAuditLogs.companyId, companyId),
      eq(campaignAuditLogs.campaignId, campaignId),
      eq(campaignAuditLogs.logType, "auto_tune_auto_rollback")
    ))
    .orderBy(desc(campaignAuditLogs.createdAt))
    .limit(1);
  
  return {
    autoApplyEnabled,
    killSwitchEnabled,
    lastAutoApply: lastAutoApply ? { id: lastAutoApply.id, createdAt: lastAutoApply.createdAt, payload: lastAutoApply.payload } : null,
    lastAutoRollback: lastAutoRollback ? { id: lastAutoRollback.id, createdAt: lastAutoRollback.createdAt, payload: lastAutoRollback.payload } : null
  };
}
