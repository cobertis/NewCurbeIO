/**
 * Call Summary Normalizer (Ticket 12.1)
 * Processes post-call summary webhooks from voice providers
 * Normalizes intent classification and updates campaign contact states
 * 
 * Security: ALL companyId MUST be derived from resolved CALL_PLACED event, NEVER from request body
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  contactSuppressions,
  contactConsents,
  orchestratorTasks,
  CampaignEvent,
  CampaignContact,
  OrchestratorTask
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { emitCampaignEvent } from "./campaign-events";

export type CallSummaryIntent = 
  | "interested" 
  | "not_interested" 
  | "callback" 
  | "wrong_number" 
  | "do_not_call" 
  | "voicemail" 
  | "unknown";

export const CallSummaryWebhookSchema = z.object({
  provider: z.string(),
  callControlId: z.string().optional(),
  jobExternalId: z.string().optional(),
  campaignContactId: z.string().optional(),
  summaryText: z.string().optional(),
  transcript: z.string().optional(),
  intent: z.enum([
    "interested", 
    "not_interested", 
    "callback", 
    "wrong_number", 
    "do_not_call", 
    "voicemail", 
    "unknown"
  ]),
  externalId: z.string().optional()
});

export type CallSummaryWebhookInput = z.infer<typeof CallSummaryWebhookSchema>;

export interface ResolvedCallContext {
  companyId: string;
  campaignId: string;
  contactId: string;
  campaignContactId: string;
  channel: CampaignEvent["channel"];
}

export interface ProcessCallSummaryResult {
  action: "created" | "no_op" | "not_found";
  event?: CampaignEvent;
  stateUpdate?: {
    before: string;
    after: string;
  };
  task?: OrchestratorTask;
  message?: string;
}

const INTENT_TO_STATE: Record<CallSummaryIntent, CampaignContact["state"] | null> = {
  do_not_call: "DO_NOT_CONTACT",
  not_interested: "STOPPED",
  interested: "QUALIFIED",
  callback: "ATTEMPTING",
  wrong_number: "UNREACHABLE",
  voicemail: null,
  unknown: null
};

export function getStateForIntent(intent: CallSummaryIntent): CampaignContact["state"] | null {
  return INTENT_TO_STATE[intent] ?? null;
}

export async function resolveCallByProviderCallId(
  callControlId: string
): Promise<ResolvedCallContext | null> {
  const [event] = await db.select({
    companyId: campaignEvents.companyId,
    campaignId: campaignEvents.campaignId,
    contactId: campaignEvents.contactId,
    campaignContactId: campaignEvents.campaignContactId,
    channel: campaignEvents.channel
  })
    .from(campaignEvents)
    .where(
      and(
        eq(campaignEvents.eventType, "CALL_PLACED"),
        sql`${campaignEvents.payload}->>'providerCallId' = ${callControlId}`
      )
    )
    .limit(1);

  if (!event) return null;

  return {
    companyId: event.companyId,
    campaignId: event.campaignId,
    contactId: event.contactId,
    campaignContactId: event.campaignContactId,
    channel: event.channel
  };
}

async function resolveCallByJobExternalId(
  jobExternalId: string
): Promise<ResolvedCallContext | null> {
  const [event] = await db.select({
    companyId: campaignEvents.companyId,
    campaignId: campaignEvents.campaignId,
    contactId: campaignEvents.contactId,
    campaignContactId: campaignEvents.campaignContactId,
    channel: campaignEvents.channel
  })
    .from(campaignEvents)
    .where(
      and(
        eq(campaignEvents.eventType, "CALL_PLACED"),
        sql`${campaignEvents.payload}->>'jobExternalId' = ${jobExternalId}`
      )
    )
    .limit(1);

  if (!event) return null;

  return {
    companyId: event.companyId,
    campaignId: event.campaignId,
    contactId: event.contactId,
    campaignContactId: event.campaignContactId,
    channel: event.channel
  };
}

async function resolveCallByCampaignContactId(
  campaignContactIdInput: string
): Promise<ResolvedCallContext | null> {
  const [enrollment] = await db.select({
    companyId: campaignContacts.companyId,
    campaignId: campaignContacts.campaignId,
    contactId: campaignContacts.contactId,
    campaignContactId: campaignContacts.id
  })
    .from(campaignContacts)
    .where(eq(campaignContacts.id, campaignContactIdInput))
    .limit(1);

  if (!enrollment) return null;

  return {
    companyId: enrollment.companyId,
    campaignId: enrollment.campaignId,
    contactId: enrollment.contactId,
    campaignContactId: enrollment.campaignContactId,
    channel: "voice"
  };
}

async function checkEventExists(companyId: string, externalId: string): Promise<CampaignEvent | null> {
  const [existing] = await db.select()
    .from(campaignEvents)
    .where(
      and(
        eq(campaignEvents.companyId, companyId),
        eq(campaignEvents.externalId, externalId)
      )
    )
    .limit(1);

  return existing || null;
}

async function updateSuppressionForDoNotCall(
  companyId: string,
  contactId: string,
  campaignId: string
): Promise<void> {
  // 1) Update contact_suppressions with status='dnc'
  const [existingSuppression] = await db.select()
    .from(contactSuppressions)
    .where(eq(contactSuppressions.contactId, contactId))
    .limit(1);

  if (existingSuppression) {
    const existingCampaigns = existingSuppression.affectedCampaigns || [];
    const updatedCampaigns = existingCampaigns.includes(campaignId) 
      ? existingCampaigns 
      : [...existingCampaigns, campaignId];

    await db.update(contactSuppressions)
      .set({
        suppressionStatus: "dnc",
        reason: "do_not_call intent from call summary",
        triggeredBy: "webhook",
        triggerSource: "call_summary_normalizer",
        affectedCampaigns: updatedCampaigns,
        updatedAt: new Date()
      })
      .where(eq(contactSuppressions.contactId, contactId));
  } else {
    await db.insert(contactSuppressions)
      .values({
        contactId,
        companyId,
        suppressionStatus: "dnc",
        reason: "do_not_call intent from call summary",
        triggeredBy: "webhook",
        triggerSource: "call_summary_normalizer",
        affectedCampaigns: [campaignId]
      });
  }

  // 2) Upsert contact_consents for voice and voicemail as opt_out
  const channels = ["voice", "voicemail"] as const;
  for (const channel of channels) {
    const [existing] = await db.select()
      .from(contactConsents)
      .where(
        and(
          eq(contactConsents.contactId, contactId),
          eq(contactConsents.channel, channel)
        )
      )
      .limit(1);

    if (existing) {
      await db.update(contactConsents)
        .set({
          previousStatus: existing.status,
          status: "opt_out",
          source: "call_summary",
          sourceTimestamp: new Date(),
          sourceMeta: { intent: "do_not_call", trigger: "call_summary_normalizer" },
          updatedAt: new Date()
        })
        .where(eq(contactConsents.id, existing.id));
    } else {
      await db.insert(contactConsents)
        .values({
          contactId,
          companyId,
          channel,
          status: "opt_out",
          source: "call_summary",
          sourceTimestamp: new Date(),
          sourceMeta: { intent: "do_not_call", trigger: "call_summary_normalizer" }
        });
    }
  }
}

export async function processCallSummary(
  input: CallSummaryWebhookInput
): Promise<ProcessCallSummaryResult> {
  const { 
    provider, 
    callControlId, 
    jobExternalId, 
    campaignContactId: inputCampaignContactId,
    summaryText, 
    transcript, 
    intent,
    externalId 
  } = input;

  let context: ResolvedCallContext | null = null;

  if (callControlId) {
    context = await resolveCallByProviderCallId(callControlId);
  }
  
  if (!context && jobExternalId) {
    context = await resolveCallByJobExternalId(jobExternalId);
  }
  
  if (!context && inputCampaignContactId) {
    context = await resolveCallByCampaignContactId(inputCampaignContactId);
  }

  if (!context) {
    console.log(`[CallSummaryNormalizer] Could not resolve call context - callControlId=${callControlId?.slice(0,8)}, jobExternalId=${jobExternalId?.slice(0,8)}`);
    return { 
      action: "not_found", 
      message: "Could not resolve call context from callControlId, jobExternalId, or campaignContactId" 
    };
  }

  const idempotentExternalId = `call_summary:${provider}:${externalId || callControlId || jobExternalId || context.campaignContactId}`;

  const existingEvent = await checkEventExists(context.companyId, idempotentExternalId);
  if (existingEvent) {
    console.log(`[CallSummaryNormalizer] Duplicate call summary ignored (idempotent) - ${idempotentExternalId.slice(0,40)}...`);
    return {
      action: "no_op",
      event: existingEvent,
      message: "Call summary already processed (idempotent)"
    };
  }

  const [enrollment] = await db.select()
    .from(campaignContacts)
    .where(eq(campaignContacts.id, context.campaignContactId))
    .limit(1);

  if (!enrollment) {
    console.log(`[CallSummaryNormalizer] Campaign contact not found - ${context.campaignContactId.slice(0,8)}`);
    return { action: "not_found", message: "Campaign contact enrollment not found" };
  }

  const stateBefore = enrollment.state;
  const newState = getStateForIntent(intent);
  const stateAfter = newState || stateBefore;

  const eventResult = await emitCampaignEvent({
    companyId: context.companyId,
    campaignId: context.campaignId,
    campaignContactId: context.campaignContactId,
    contactId: context.contactId,
    eventType: "CALL_SUMMARY",
    channel: context.channel || "voice",
    provider,
    externalId: idempotentExternalId,
    payload: {
      source: "call_summary",
      intent,
      summaryText: summaryText || null,
      transcript: transcript ? "[TRANSCRIPT_STORED]" : null,
      hasTranscript: !!transcript,
      originalCallControlId: callControlId || null,
      originalJobExternalId: jobExternalId || null
    }
  });

  if ("error" in eventResult) {
    console.error(`[CallSummaryNormalizer] Failed to emit event: ${eventResult.error}`);
    return { action: "not_found", message: eventResult.error };
  }

  if (newState && newState !== stateBefore) {
    const updates: Partial<CampaignContact> = {
      state: newState,
      updatedAt: new Date()
    };

    if (intent === "callback") {
      const next24Hours = new Date();
      next24Hours.setHours(next24Hours.getHours() + 24);
      updates.nextActionAt = next24Hours;
    }

    if (newState === "STOPPED" || newState === "DO_NOT_CONTACT" || newState === "UNREACHABLE") {
      updates.stoppedAt = new Date();
      updates.stoppedReason = `call_summary_intent:${intent}`;
    }

    await db.update(campaignContacts)
      .set(updates)
      .where(eq(campaignContacts.id, context.campaignContactId));

    console.log(`[CallSummaryNormalizer] Updated state ${stateBefore} -> ${newState} for contact ${context.campaignContactId.slice(0,8)}`);
  }

  if (intent === "do_not_call") {
    await updateSuppressionForDoNotCall(context.companyId, context.contactId, context.campaignId);
    console.log(`[CallSummaryNormalizer] Added suppression for contact ${context.contactId.slice(0,8)}`);
  }

  const result: ProcessCallSummaryResult = {
    action: "created",
    event: eventResult.event
  };

  if (newState && newState !== stateBefore) {
    result.stateUpdate = {
      before: stateBefore,
      after: newState
    };
  }

  // Create task for actionable intents
  const task = await createTaskForIntent(
    intent,
    context,
    eventResult.event.id
  );
  if (task) {
    result.task = task;
    console.log(`[CallSummaryNormalizer] Created ${task.type} task ${task.id.slice(0,8)} for contact ${context.contactId.slice(0,8)}`);
  }

  console.log(`[CallSummaryNormalizer] Processed call summary - intent=${intent}, action=${result.action}`);

  return result;
}

async function createTaskForIntent(
  intent: CallSummaryIntent,
  context: ResolvedCallContext,
  sourceEventId: string
): Promise<OrchestratorTask | null> {
  let taskType: "callback" | "followup" | "appointment" | null = null;
  let dueAt = new Date();

  if (intent === "interested") {
    taskType = "followup";
    // Due immediately
  } else if (intent === "callback") {
    taskType = "callback";
    // Due in 24 hours
    dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  if (!taskType) {
    return null;
  }

  const [task] = await db.insert(orchestratorTasks)
    .values({
      companyId: context.companyId,
      contactId: context.contactId,
      campaignId: context.campaignId,
      campaignContactId: context.campaignContactId,
      type: taskType,
      status: "open",
      dueAt,
      sourceEventId,
      sourceIntent: intent,
      payload: {}
    })
    .returning();

  // Emit TASK_CREATED event
  await emitCampaignEvent({
    companyId: context.companyId,
    campaignId: context.campaignId,
    campaignContactId: context.campaignContactId,
    contactId: context.contactId,
    eventType: "TASK_CREATED",
    channel: context.channel || "voice",
    provider: "system",
    payload: {
      taskId: task.id,
      taskType,
      sourceIntent: intent,
      dueAt: dueAt.toISOString()
    }
  });

  return task;
}
