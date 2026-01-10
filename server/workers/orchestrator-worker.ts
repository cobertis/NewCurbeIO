import { db } from "../db";
import { 
  campaignContacts, 
  campaignEvents,
  orchestratorCampaigns, 
  orchestratorJobs,
  CampaignContact,
  OrchestratorCampaign,
  OrchestratorJob
} from "@shared/schema";
import { eq, and, sql, lte, or, isNull, inArray, desc, asc } from "drizzle-orm";
import { calculateAllowedActions, PolicyEngineResult, OrchestratorChannel } from "../services/policy-engine";
import { emitCampaignEvent } from "../services/campaign-events";
import { decideNextAction, generateDecisionExternalId, DecideNextActionOutput } from "../services/ai-next-action";
import { format } from "date-fns";

const AI_ENABLED = process.env.ORCHESTRATOR_AI_ENABLED === "true";
const AI_HISTORY_LIMIT = 20;

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

async function loadContactHistory(
  companyId: string,
  campaignContactId: string,
  limit: number
): Promise<Array<{ eventType: string; channel?: string; createdAt: string; payload?: any }>> {
  const events = await db.select({
    eventType: campaignEvents.eventType,
    channel: campaignEvents.channel,
    createdAt: campaignEvents.createdAt,
    payload: campaignEvents.payload
  })
    .from(campaignEvents)
    .where(and(
      eq(campaignEvents.companyId, companyId),
      eq(campaignEvents.campaignContactId, campaignContactId)
    ))
    .orderBy(desc(campaignEvents.createdAt))
    .limit(limit);
  
  return events.map(e => ({
    eventType: e.eventType,
    channel: e.channel || undefined,
    createdAt: e.createdAt.toISOString(),
    payload: e.payload
  }));
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
    
    let chosenChannel: OrchestratorChannel | null = null;
    let aiDecision: DecideNextActionOutput | null = null;
    let fallbackUsed = false;
    let aiError: string | undefined;
    let waitSeconds = DEFAULT_WAIT_SECONDS;
    
    const allowedChannels = policyResult.allowedActions
      .filter(a => a.allowed)
      .map(a => a.channel);
    
    if (AI_ENABLED && allowedChannels.length > 0) {
      const history = await loadContactHistory(companyId, campaignContactId, AI_HISTORY_LIMIT);
      
      const lastOutbound = history.find(e => 
        e.eventType === "MESSAGE_SENT" || e.eventType === "CALL_INITIATED"
      );
      
      const policyJson = campaign.policyJson as Record<string, any> || {};
      
      const aiResult = await decideNextAction({
        companyId,
        campaignId,
        campaignContactId,
        contactId,
        campaignName: campaign.name,
        campaignGoal: policyJson.goal,
        policy: policyJson,
        allowedActions: policyResult.allowedActions,
        history,
        lastOutbound: lastOutbound ? { channel: lastOutbound.channel!, at: lastOutbound.createdAt } : null,
        fatigueScore: contact.fatigueScore || 0,
        locale: policyJson.locale || "en"
      });
      
      if (aiResult.decision && !aiResult.fallbackUsed) {
        aiDecision = aiResult.decision;
        chosenChannel = aiDecision.channel as OrchestratorChannel;
        waitSeconds = aiDecision.waitSeconds;
        fallbackUsed = false;
      } else {
        aiError = aiResult.error;
        fallbackUsed = true;
        console.log(`[Orchestrator] AI fallback: ${aiError}`);
      }
      
      if (aiResult.messageBodyStripped) {
        console.log(`[Orchestrator] messageBody stripped for compliance`);
      }
    }
    
    if (!chosenChannel) {
      chosenChannel = pickNextChannel(policyResult);
      fallbackUsed = !AI_ENABLED ? false : true;
    }
    
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
    
    const decisionExternalId = generateDecisionExternalId(campaignContactId);
    await emitCampaignEvent({
      companyId,
      campaignId,
      campaignContactId,
      contactId,
      eventType: "DECISION_MADE",
      channel: chosenChannel,
      externalId: `orchestrator:${decisionExternalId}`,
      payload: {
        chosenChannel,
        confidence: aiDecision?.confidence ?? null,
        explanation: aiDecision?.explanation ?? "Heuristic priority-based selection",
        aiEnabled: AI_ENABLED,
        fallbackUsed,
        aiError: aiError || null,
        allowedChannels,
        prefer: aiDecision?.prefer,
        messageTemplateId: aiDecision?.messageTemplateId,
        waitSeconds
      }
    });
    
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
        prefer: aiDecision?.prefer,
        messageTemplateId: aiDecision?.messageTemplateId,
        metadata: {
          attemptNumber: contact.attemptsTotal + 1,
          previousChannel: contact.lastAttemptChannel,
          aiDecision: aiDecision ? true : false
        }
      }
    );
    
    if (!job) {
      return { enqueued: false, timeout: false, error: "Failed to create job" };
    }
    
    if (!wasIdempotent) {
      const policyJson = campaign.policyJson as Record<string, any> || {};
      const finalWaitSeconds = aiDecision?.waitSeconds || policyJson.waitSeconds || DEFAULT_WAIT_SECONDS;
      const nextActionAt = new Date(Date.now() + finalWaitSeconds * 1000);
      
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
