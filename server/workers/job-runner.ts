/**
 * Job Runner v1.1
 * Processes orchestrator_jobs with status=queued and executes channel sends.
 * Supports: imessage, sms, mms, voice, voicemail
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
import {
  VoiceAdapter,
  PlaceCallInput,
  PlaceCallResult,
  DropVoicemailInput,
  DropVoicemailResult,
  getDefaultVoiceAdapter
} from "../services/channel-adapters/voice-adapter";

const DEFAULT_MAX_RETRIES = 2;
const VOICE_MAX_RETRIES = 1;
const VOICEMAIL_MAX_RETRIES = 1;

const RETRY_DELAYS_MS = [
  5 * 60 * 1000,    // retry 1: 5 minutes
  30 * 60 * 1000    // retry 2: 30 minutes
];

const MESSAGE_CHANNELS = ["imessage", "sms", "mms"] as const;
const VOICE_CHANNELS = ["voice", "voicemail"] as const;
const SUPPORTED_CHANNELS = [...MESSAGE_CHANNELS, ...VOICE_CHANNELS] as const;
type SupportedChannel = typeof SUPPORTED_CHANNELS[number];
type MessageChannel = typeof MESSAGE_CHANNELS[number];
type VoiceChannel = typeof VOICE_CHANNELS[number];

interface JobRunnerOptions {
  companyId?: string;
  limit?: number;
  adapter?: BridgeAdapter;
  voiceAdapter?: VoiceAdapter;
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

function isMessageChannel(channel: string): channel is MessageChannel {
  return MESSAGE_CHANNELS.includes(channel as MessageChannel);
}

function isVoiceChannel(channel: string): channel is VoiceChannel {
  return VOICE_CHANNELS.includes(channel as VoiceChannel);
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

async function emitCallPlaced(job: OrchestratorJob, providerCallId?: string): Promise<void> {
  if (!job.externalId) return;
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: "CALL_PLACED",
    channel: "voice",
    provider: "telnyx",
    externalId: buildEventExternalId(job.externalId, "call_placed"),
    payload: {
      jobId: job.id,
      providerCallId,
      channel: job.channel
    }
  });
}

async function emitCallOutcome(
  job: OrchestratorJob, 
  outcome: "answered" | "no_answer" | "busy" | "failed",
  providerCallId?: string,
  error?: string
): Promise<void> {
  if (!job.externalId) return;
  
  const eventTypeMap: Record<string, string> = {
    "answered": "CALL_ANSWERED",
    "no_answer": "CALL_NO_ANSWER",
    "busy": "CALL_BUSY",
    "failed": "CALL_FAILED"
  };
  
  const eventType = eventTypeMap[outcome] || "CALL_FAILED";
  const suffix = outcome.replace("_", "_");
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: eventType as any,
    channel: "voice",
    provider: "telnyx",
    externalId: buildEventExternalId(job.externalId, `call_${outcome}`),
    payload: {
      jobId: job.id,
      providerCallId,
      outcome,
      error,
      channel: job.channel
    }
  });
}

async function emitCallFailedAttempt(job: OrchestratorJob, error: string, attemptNum: number): Promise<void> {
  if (!job.externalId) return;
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: "CALL_FAILED",
    channel: "voice",
    provider: "telnyx",
    externalId: buildEventExternalId(job.externalId, `call_failed_attempt_${attemptNum}`),
    payload: {
      jobId: job.id,
      error,
      channel: job.channel,
      attemptNum,
      final: false
    }
  });
}

async function emitVoicemailDropped(job: OrchestratorJob, providerId?: string): Promise<void> {
  if (!job.externalId) return;
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: "VOICEMAIL_DROPPED",
    channel: "voicemail",
    provider: "telnyx",
    externalId: buildEventExternalId(job.externalId, "voicemail_dropped"),
    payload: {
      jobId: job.id,
      providerId,
      channel: job.channel
    }
  });
}

async function processMessageJob(
  job: OrchestratorJob,
  adapter: BridgeAdapter
): Promise<{ success: boolean; retried: boolean; error?: string }> {
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
  
  await emitMessageFailedAttempt(job, result.error || "Unknown error", job.retryCount);
  
  const maxRetries = await getMaxRetries(job);
  
  if (job.retryCount < maxRetries) {
    await scheduleRetry(job, result.error || "Unknown error");
    return { success: false, retried: true, error: result.error };
  }
  
  await markFailed(job.id, result.error || "Max retries exceeded");
  await emitMessageFailed(job, result.error || "Max retries exceeded");
  return { success: false, retried: false, error: result.error };
}

async function processVoiceJob(
  job: OrchestratorJob,
  adapter: VoiceAdapter
): Promise<{ success: boolean; retried: boolean; error?: string }> {
  const payload = job.payload as Record<string, any>;
  
  if (!payload.to) {
    const error = "Missing required 'to' field for voice call";
    await markFailed(job.id, error);
    await emitCallOutcome(job, "failed", undefined, error);
    return { success: false, retried: false, error };
  }
  
  await markProcessing(job.id);
  
  const result = await adapter.placeCall({
    to: payload.to,
    from: payload.from,
    scriptId: payload.scriptId,
    campaignContactId: job.campaignContactId,
    companyId: job.companyId,
    metadata: { jobId: job.id, campaignId: job.campaignId }
  });
  
  if (!result.ok) {
    await emitCallFailedAttempt(job, result.error || "Call failed", job.retryCount);
    
    const maxRetries = VOICE_MAX_RETRIES;
    
    if (job.retryCount < maxRetries) {
      await scheduleRetry(job, result.error || "Call failed");
      return { success: false, retried: true, error: result.error };
    }
    
    await markFailed(job.id, result.error || "Max retries exceeded");
    await emitCallOutcome(job, "failed", result.providerCallId, result.error || "Max retries exceeded");
    return { success: false, retried: false, error: result.error };
  }
  
  await emitCallPlaced(job, result.providerCallId);
  
  if (!result.outcome) {
    return { success: true, retried: false };
  }
  
  if (result.outcome === "answered") {
    await markDone(job.id);
    await emitCallOutcome(job, "answered", result.providerCallId);
    return { success: true, retried: false };
  }
  
  if (result.outcome === "no_answer" || result.outcome === "busy") {
    await markDone(job.id);
    await emitCallOutcome(job, result.outcome, result.providerCallId);
    return { success: true, retried: false };
  }
  
  if (result.outcome === "voicemail") {
    await markDone(job.id);
    await emitCallOutcome(job, "no_answer", result.providerCallId);
    return { success: true, retried: false };
  }
  
  await emitCallFailedAttempt(job, result.error || "Call failed", job.retryCount);
  
  const maxRetries = VOICE_MAX_RETRIES;
  
  if (job.retryCount < maxRetries) {
    await scheduleRetry(job, result.error || "Call failed");
    return { success: false, retried: true, error: result.error };
  }
  
  await markFailed(job.id, result.error || "Max retries exceeded");
  await emitCallOutcome(job, "failed", result.providerCallId, result.error || "Max retries exceeded");
  return { success: false, retried: false, error: result.error };
}

async function processVoicemailJob(
  job: OrchestratorJob,
  adapter: VoiceAdapter
): Promise<{ success: boolean; retried: boolean; error?: string }> {
  const payload = job.payload as Record<string, any>;
  
  if (!payload.to) {
    const error = "Missing required 'to' field for voicemail drop";
    await markFailed(job.id, error);
    return { success: false, retried: false, error };
  }
  
  if (!payload.recordingUrl && !payload.textToSpeech) {
    const error = "Either recordingUrl or textToSpeech is required for voicemail drop";
    await markFailed(job.id, error);
    return { success: false, retried: false, error };
  }
  
  await markProcessing(job.id);
  
  const result = await adapter.dropVoicemail({
    to: payload.to,
    from: payload.from,
    recordingId: payload.recordingId,
    recordingUrl: payload.recordingUrl,
    textToSpeech: payload.textToSpeech,
    companyId: job.companyId,
    metadata: { jobId: job.id, campaignId: job.campaignId }
  });
  
  if (result.ok) {
    await markDone(job.id);
    await emitVoicemailDropped(job, result.providerId);
    return { success: true, retried: false };
  }
  
  const maxRetries = VOICEMAIL_MAX_RETRIES;
  
  if (job.retryCount < maxRetries) {
    await scheduleRetry(job, result.error || "Voicemail drop failed");
    return { success: false, retried: true, error: result.error };
  }
  
  await markFailed(job.id, result.error || "Max retries exceeded");
  return { success: false, retried: false, error: result.error };
}

async function processJob(
  job: OrchestratorJob,
  messageAdapter: BridgeAdapter,
  voiceAdapter: VoiceAdapter
): Promise<{ success: boolean; retried: boolean; error?: string }> {
  
  if (!isSupportedChannel(job.channel)) {
    return { success: false, retried: false, error: `Unsupported channel: ${job.channel}` };
  }
  
  if (isMessageChannel(job.channel)) {
    return processMessageJob(job, messageAdapter);
  }
  
  if (job.channel === "voice") {
    return processVoiceJob(job, voiceAdapter);
  }
  
  if (job.channel === "voicemail") {
    return processVoicemailJob(job, voiceAdapter);
  }
  
  return { success: false, retried: false, error: `Unhandled channel: ${job.channel}` };
}

export async function runJobsOnce(options: JobRunnerOptions = {}): Promise<JobRunnerResult> {
  const { companyId, limit = 50, adapter, voiceAdapter } = options;
  const effectiveMessageAdapter = adapter || getDefaultAdapter();
  const effectiveVoiceAdapter = voiceAdapter || getDefaultVoiceAdapter();
  
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
      const outcome = await processJob(job, effectiveMessageAdapter, effectiveVoiceAdapter);
      
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
