/**
 * Job Runner v1
 * Processes orchestrator_jobs with status=queued and executes channel sends.
 * Currently supports: imessage, sms
 */

import { db } from "../db";
import { 
  orchestratorJobs, 
  orchestratorCampaigns,
  OrchestratorJob 
} from "@shared/schema";
import { eq, and, sql, lte, inArray } from "drizzle-orm";
import { emitCampaignEvent } from "../services/campaign-events";
import { 
  sendViaBridge, 
  BridgeSendInput, 
  BridgeSendResult,
  BridgeAdapter,
  getDefaultAdapter
} from "../services/channel-adapters/bridge-imessage-sms";

const DEFAULT_MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,    // retry 1: 5 minutes
  30 * 60 * 1000    // retry 2: 30 minutes
];

const SUPPORTED_CHANNELS = ["imessage", "sms", "mms"] as const;
type SupportedChannel = typeof SUPPORTED_CHANNELS[number];

interface JobRunnerOptions {
  companyId?: string;
  limit?: number;
  adapter?: BridgeAdapter;
}

interface JobRunnerResult {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
  skipped: number;
  errors: string[];
}

function isSupportedChannel(channel: string): channel is SupportedChannel {
  return SUPPORTED_CHANNELS.includes(channel as SupportedChannel);
}

async function getQueuedJobs(companyId: string | undefined, limit: number): Promise<OrchestratorJob[]> {
  const now = new Date();
  
  const conditions = [
    eq(orchestratorJobs.status, "queued"),
    lte(orchestratorJobs.runAt, now),
    inArray(orchestratorJobs.channel, [...SUPPORTED_CHANNELS])
  ];
  
  if (companyId) {
    conditions.push(eq(orchestratorJobs.companyId, companyId));
  }
  
  return db.select()
    .from(orchestratorJobs)
    .where(and(...conditions))
    .orderBy(orchestratorJobs.runAt)
    .limit(limit);
}

async function markProcessing(jobId: string): Promise<void> {
  await db.update(orchestratorJobs)
    .set({
      status: "processing",
      startedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(orchestratorJobs.id, jobId));
}

async function markDone(jobId: string): Promise<void> {
  await db.update(orchestratorJobs)
    .set({
      status: "done",
      completedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(orchestratorJobs.id, jobId));
}

async function markFailed(jobId: string, error: string): Promise<void> {
  await db.update(orchestratorJobs)
    .set({
      status: "failed",
      error,
      completedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(orchestratorJobs.id, jobId));
}

async function scheduleRetry(job: OrchestratorJob, error: string): Promise<void> {
  const newRetryCount = job.retryCount + 1;
  const delayMs = RETRY_DELAYS_MS[Math.min(newRetryCount - 1, RETRY_DELAYS_MS.length - 1)];
  const newRunAt = new Date(Date.now() + delayMs);
  
  await db.update(orchestratorJobs)
    .set({
      status: "queued",
      retryCount: newRetryCount,
      runAt: newRunAt,
      error,
      updatedAt: new Date()
    })
    .where(eq(orchestratorJobs.id, job.id));
}

async function getMaxRetries(job: OrchestratorJob): Promise<number> {
  const [campaign] = await db.select({ policyJson: orchestratorCampaigns.policyJson })
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.id, job.campaignId))
    .limit(1);
  
  if (campaign?.policyJson && typeof campaign.policyJson === "object") {
    const policy = campaign.policyJson as Record<string, any>;
    if (typeof policy.maxRetries === "number") {
      return policy.maxRetries;
    }
    if (policy.retryPolicy && typeof policy.retryPolicy.maxRetries === "number") {
      return policy.retryPolicy.maxRetries;
    }
  }
  
  return DEFAULT_MAX_RETRIES;
}

function buildEventExternalId(jobExternalId: string, suffix: string): string {
  return `job:${jobExternalId}:${suffix}`;
}

async function emitMessageSent(job: OrchestratorJob, providerId?: string): Promise<void> {
  if (!job.externalId) return;
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: "MESSAGE_SENT",
    channel: job.channel,
    provider: "bridge",
    externalId: buildEventExternalId(job.externalId, "sent"),
    payload: {
      jobId: job.id,
      providerId,
      channel: job.channel
    }
  });
}

async function emitMessageDelivered(job: OrchestratorJob, providerId?: string): Promise<void> {
  if (!job.externalId) return;
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: "MESSAGE_DELIVERED",
    channel: job.channel,
    provider: "bridge",
    externalId: buildEventExternalId(job.externalId, "delivered"),
    payload: {
      jobId: job.id,
      providerId,
      channel: job.channel
    }
  });
}

async function emitMessageFailed(job: OrchestratorJob, error: string): Promise<void> {
  if (!job.externalId) return;
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: "MESSAGE_FAILED",
    channel: job.channel,
    provider: "bridge",
    externalId: buildEventExternalId(job.externalId, "failed"),
    payload: {
      jobId: job.id,
      error,
      channel: job.channel,
      final: true
    }
  });
}

async function emitMessageFailedAttempt(job: OrchestratorJob, error: string, attemptNum: number): Promise<void> {
  if (!job.externalId) return;
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: "MESSAGE_FAILED",
    channel: job.channel,
    provider: "bridge",
    externalId: buildEventExternalId(job.externalId, `failed_attempt_${attemptNum}`),
    payload: {
      jobId: job.id,
      error,
      channel: job.channel,
      attemptNum,
      final: false
    }
  });
}

async function processJob(
  job: OrchestratorJob,
  adapter: BridgeAdapter
): Promise<{ success: boolean; retried: boolean; error?: string }> {
  
  if (!isSupportedChannel(job.channel)) {
    return { success: false, retried: false, error: `Unsupported channel: ${job.channel}` };
  }
  
  const payload = job.payload as Record<string, any>;
  
  if (!payload.to || !payload.body) {
    const error = `Missing required payload fields: ${!payload.to ? "'to'" : ""} ${!payload.body ? "'body'" : ""}`.trim();
    await markFailed(job.id, error);
    await emitMessageFailed(job, error);
    return { success: false, retried: false, error };
  }
  
  await markProcessing(job.id);
  
  const bridgeInput: BridgeSendInput = {
    to: payload.to,
    body: payload.body,
    prefer: payload.prefer || (job.channel === "imessage" ? "imessage" : "sms")
  };
  
  await emitMessageSent(job);
  
  const result: BridgeSendResult = await adapter.send(bridgeInput);
  
  if (result.ok) {
    await markDone(job.id);
    await emitMessageDelivered(job, result.providerId);
    return { success: true, retried: false };
  }
  
  // Emit MESSAGE_FAILED for every bridge failure (telemetry)
  // Use attempt-specific externalId to allow multiple failure events
  await emitMessageFailedAttempt(job, result.error || "Unknown error", job.retryCount);
  
  const maxRetries = await getMaxRetries(job);
  
  if (job.retryCount < maxRetries) {
    await scheduleRetry(job, result.error || "Unknown error");
    return { success: false, retried: true, error: result.error };
  }
  
  await markFailed(job.id, result.error || "Max retries exceeded");
  // Final failure event (idempotent with :failed suffix)
  await emitMessageFailed(job, result.error || "Max retries exceeded");
  return { success: false, retried: false, error: result.error };
}

export async function runJobsOnce(options: JobRunnerOptions = {}): Promise<JobRunnerResult> {
  const { companyId, limit = 50, adapter } = options;
  const effectiveAdapter = adapter || getDefaultAdapter();
  
  const result: JobRunnerResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    skipped: 0,
    errors: []
  };
  
  const jobs = await getQueuedJobs(companyId, limit);
  
  for (const job of jobs) {
    result.processed++;
    
    try {
      const outcome = await processJob(job, effectiveAdapter);
      
      if (outcome.success) {
        result.succeeded++;
      } else if (outcome.retried) {
        result.retried++;
      } else {
        result.failed++;
        if (outcome.error) {
          result.errors.push(`${job.id}: ${outcome.error}`);
        }
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push(`${job.id}: ${error.message || "Unknown error"}`);
      
      try {
        await markFailed(job.id, error.message || "Unknown error");
      } catch {}
    }
  }
  
  return result;
}
