import { db } from "../db";
import { 
  campaignContacts, 
  orchestratorCampaigns, 
  orchestratorJobs,
  CampaignContact,
  OrchestratorCampaign,
  OrchestratorJob
} from "@shared/schema";
import { eq, and, sql, lte, or, isNull, inArray, desc, asc } from "drizzle-orm";
import { calculateAllowedActions, PolicyEngineResult, OrchestratorChannel } from "../services/policy-engine";
import { emitCampaignEvent } from "../services/campaign-events";
import { format } from "date-fns";

const CHANNEL_PRIORITY: OrchestratorChannel[] = [
  "imessage",
  "sms",
  "mms",
  "voice",
  "voicemail",
  "whatsapp",
  "rvm"
];

const LOCK_DURATION_SECONDS = 60;
const DEFAULT_WAIT_SECONDS = 86400;

interface WorkerOptions {
  companyId?: string;
  limit?: number;
}

interface WorkerResult {
  processed: number;
  enqueued: number;
  timeouts: number;
  skipped: number;
  errors: string[];
}

export function pickNextChannel(policyResult: PolicyEngineResult): OrchestratorChannel | null {
  const allowedChannels = policyResult.allowedActions
    .filter(a => a.allowed)
    .map(a => a.channel);
  
  for (const channel of CHANNEL_PRIORITY) {
    if (allowedChannels.includes(channel)) {
      return channel;
    }
  }
  
  return null;
}

function generateJobExternalId(campaignContactId: string, channel: string): string {
  const hourKey = format(new Date(), "yyyyMMddHH");
  return `attempt_job:${campaignContactId}:${hourKey}:${channel}`;
}

function generateTimeoutExternalId(campaignContactId: string): string {
  const dayKey = format(new Date(), "yyyyMMdd");
  return `timeout:${campaignContactId}:${dayKey}`;
}

async function acquireLock(campaignContactId: string, workerId: string): Promise<boolean> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_DURATION_SECONDS * 1000);
  
  const result = await db.update(campaignContacts)
    .set({
      lockedUntil: lockUntil,
      lockedBy: workerId,
      updatedAt: now
    })
    .where(and(
      eq(campaignContacts.id, campaignContactId),
      or(
        isNull(campaignContacts.lockedUntil),
        lte(campaignContacts.lockedUntil, now)
      )
    ))
    .returning({ id: campaignContacts.id });
  
  return result.length > 0;
}

async function releaseLock(campaignContactId: string): Promise<void> {
  await db.update(campaignContacts)
    .set({
      lockedUntil: null,
      lockedBy: null,
      updatedAt: new Date()
    })
    .where(eq(campaignContacts.id, campaignContactId));
}

async function getDueContacts(companyId: string | undefined, limit: number): Promise<Array<{
  contact: CampaignContact;
  campaign: OrchestratorCampaign;
}>> {
  const now = new Date();
  
  let query = db
    .select({
      contact: campaignContacts,
      campaign: orchestratorCampaigns
    })
    .from(campaignContacts)
    .innerJoin(
      orchestratorCampaigns,
      eq(campaignContacts.campaignId, orchestratorCampaigns.id)
    )
    .where(and(
      eq(orchestratorCampaigns.status, "active"),
      inArray(campaignContacts.state, ["NEW", "ATTEMPTING"]),
      or(
        isNull(campaignContacts.nextActionAt),
        lte(campaignContacts.nextActionAt, now)
      ),
      or(
        isNull(campaignContacts.lockedUntil),
        lte(campaignContacts.lockedUntil, now)
      ),
      ...(companyId ? [eq(campaignContacts.companyId, companyId)] : [])
    ))
    .orderBy(desc(campaignContacts.priority), asc(campaignContacts.nextActionAt))
    .limit(limit);
  
  return await query;
}

async function tryCreateJob(
  companyId: string,
  campaignId: string,
  campaignContactId: string,
  contactId: string,
  channel: OrchestratorChannel,
  externalId: string,
  payload: Record<string, any>
): Promise<{ job: OrchestratorJob | null; wasIdempotent: boolean }> {
  try {
    const [job] = await db.insert(orchestratorJobs)
      .values({
        companyId,
        campaignId,
        campaignContactId,
        contactId,
        channel,
        status: "queued",
        runAt: new Date(),
        payload,
        externalId
      })
      .returning();
    
    return { job, wasIdempotent: false };
  } catch (error: any) {
    if (error?.code === "23505") {
      const [existingJob] = await db.select()
        .from(orchestratorJobs)
        .where(and(
          eq(orchestratorJobs.companyId, companyId),
          eq(orchestratorJobs.externalId, externalId)
        ))
        .limit(1);
      
      return { job: existingJob || null, wasIdempotent: true };
    }
    throw error;
  }
}

async function processContact(
  contact: CampaignContact,
  campaign: OrchestratorCampaign,
  workerId: string
): Promise<{ enqueued: boolean; timeout: boolean; error?: string }> {
  const { id: campaignContactId, companyId, campaignId, contactId } = contact;
  
  const locked = await acquireLock(campaignContactId, workerId);
  if (!locked) {
    return { enqueued: false, timeout: false, error: "Failed to acquire lock" };
  }
  
  try {
    const policyResult = await calculateAllowedActions(companyId, campaignId, contactId);
    
    if ("error" in policyResult) {
      return { enqueued: false, timeout: false, error: policyResult.error };
    }
    
    const chosenChannel = pickNextChannel(policyResult);
    
    if (!chosenChannel) {
      const timeoutExternalId = generateTimeoutExternalId(campaignContactId);
      
      await emitCampaignEvent({
        companyId,
        campaignId,
        campaignContactId,
        contactId,
        eventType: "TIMEOUT",
        externalId: `orchestrator:${timeoutExternalId}`,
        payload: {
          blocked: policyResult.blocked,
          policySummary: policyResult.allowedActions.map(a => ({
            channel: a.channel,
            allowed: a.allowed,
            reasons: a.reasons
          }))
        }
      });
      
      await db.update(campaignContacts)
        .set({
          state: "UNREACHABLE",
          stoppedReason: "NO_ALLOWED_ACTIONS",
          stoppedAt: new Date(),
          nextActionAt: null,
          updatedAt: new Date()
        })
        .where(eq(campaignContacts.id, campaignContactId));
      
      return { enqueued: false, timeout: true };
    }
    
    const jobExternalId = generateJobExternalId(campaignContactId, chosenChannel);
    
    const { job, wasIdempotent } = await tryCreateJob(
      companyId,
      campaignId,
      campaignContactId,
      contactId,
      chosenChannel,
      jobExternalId,
      {
        target: contactId,
        channel: chosenChannel,
        metadata: {
          attemptNumber: contact.attemptsTotal + 1,
          previousChannel: contact.lastAttemptChannel
        }
      }
    );
    
    if (!job) {
      return { enqueued: false, timeout: false, error: "Failed to create job" };
    }
    
    if (!wasIdempotent) {
      const policyJson = campaign.policyJson as Record<string, any> || {};
      const waitSeconds = policyJson.waitSeconds || DEFAULT_WAIT_SECONDS;
      const nextActionAt = new Date(Date.now() + waitSeconds * 1000);
      
      await emitCampaignEvent({
        companyId,
        campaignId,
        campaignContactId,
        contactId,
        eventType: "ATTEMPT_QUEUED",
        channel: chosenChannel,
        externalId: `orchestrator:${jobExternalId}`,
        payload: {
          chosenChannel,
          reasonsSummary: policyResult.allowedActions.find(a => a.channel === chosenChannel)?.reasons || [],
          nextActionAt: nextActionAt.toISOString(),
          jobId: job.id
        }
      });
      
      const newState = contact.state === "NEW" ? "ATTEMPTING" : contact.state;
      
      await db.update(campaignContacts)
        .set({
          state: newState,
          nextActionAt,
          fatigueScore: sql`COALESCE(${campaignContacts.fatigueScore}, 0) + 1`,
          updatedAt: new Date()
        })
        .where(eq(campaignContacts.id, campaignContactId));
    }
    
    return { enqueued: true, timeout: false };
    
  } finally {
    await releaseLock(campaignContactId);
  }
}

export async function runOrchestratorOnce(options: WorkerOptions = {}): Promise<WorkerResult> {
  const { companyId, limit = 50 } = options;
  const workerId = `orchestrator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const result: WorkerResult = {
    processed: 0,
    enqueued: 0,
    timeouts: 0,
    skipped: 0,
    errors: []
  };
  
  const dueContacts = await getDueContacts(companyId, limit);
  
  for (const { contact, campaign } of dueContacts) {
    result.processed++;
    
    try {
      const outcome = await processContact(contact, campaign, workerId);
      
      if (outcome.enqueued) {
        result.enqueued++;
      } else if (outcome.timeout) {
        result.timeouts++;
      } else if (outcome.error) {
        result.skipped++;
        result.errors.push(`${contact.id}: ${outcome.error}`);
      } else {
        result.skipped++;
      }
    } catch (error: any) {
      result.skipped++;
      result.errors.push(`${contact.id}: ${error.message || "Unknown error"}`);
    }
  }
  
  return result;
}
