/**
 * Telnyx Call Control Webhook Handler (Ticket 11.2)
 * Processes inbound Telnyx call events and finalizes orchestrator jobs
 * 
 * Security: Multi-tenant safe - companyId derived from job/event, never from request
 */

import { db } from "../db";
import { orchestratorJobs, campaignEvents, OrchestratorJob } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { emitCampaignEvent } from "./campaign-events";

export type TelnyxCallOutcome = "answered" | "no_answer" | "busy" | "failed";

export interface TelnyxWebhookPayload {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_leg_id?: string;
      call_session_id?: string;
      client_state?: string;
      connection_id?: string;
      from?: string;
      to?: string;
      state?: string;
      hangup_cause?: string;
      hangup_source?: string;
      sip_hangup_cause?: string;
      result?: string;
    };
    record_type: string;
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
}

export interface DecodedClientState {
  companyId?: string;
  jobId?: string;
  campaignId?: string;
  type?: string;
}

export interface WebhookProcessResult {
  success: boolean;
  action: "job_updated" | "event_recorded" | "no_op" | "not_found";
  jobId?: string;
  outcome?: TelnyxCallOutcome;
  message?: string;
}

const TELNYX_EVENT_TO_OUTCOME: Record<string, TelnyxCallOutcome | null> = {
  "call.answered": "answered",
  "call.hangup": null,
  "call.machine.detection.ended": null,
  "call.bridged": "answered",
  "call.initiated": null,
  "call.ringing": null,
};

const HANGUP_CAUSE_TO_OUTCOME: Record<string, TelnyxCallOutcome> = {
  "normal_clearing": "answered",
  "user_busy": "busy",
  "no_answer": "no_answer",
  "no_user_response": "no_answer",
  "call_rejected": "busy",
  "destination_out_of_order": "failed",
  "invalid_number_format": "failed",
  "network_failure": "failed",
  "originator_cancel": "no_answer",
  "timeout": "no_answer",
  "unallocated_number": "failed",
  "normal_unspecified": "answered",
};

function maskPhone(phone: string): string {
  if (!phone || phone.length <= 4) return "****";
  return `+1******${phone.slice(-4)}`;
}

export function decodeClientState(base64State?: string): DecodedClientState | null {
  if (!base64State) return null;
  
  try {
    const decoded = Buffer.from(base64State, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function mapTelnyxEventToOutcome(
  eventType: string,
  hangupCause?: string,
  amdResult?: string
): TelnyxCallOutcome | null {
  if (eventType === "call.hangup" && hangupCause) {
    return HANGUP_CAUSE_TO_OUTCOME[hangupCause] || "failed";
  }
  
  if (eventType === "call.machine.detection.ended" && amdResult) {
    if (amdResult === "human" || amdResult === "human_residence" || amdResult === "human_business") {
      return "answered";
    }
    if (amdResult === "machine" || amdResult === "fax" || amdResult === "not_sure") {
      return "no_answer";
    }
  }
  
  return TELNYX_EVENT_TO_OUTCOME[eventType] ?? null;
}

async function findJobByClientState(clientState: DecodedClientState): Promise<OrchestratorJob | null> {
  if (!clientState.jobId) return null;
  
  const [job] = await db.select()
    .from(orchestratorJobs)
    .where(eq(orchestratorJobs.id, clientState.jobId))
    .limit(1);
  
  return job || null;
}

async function findJobByProviderCallId(
  callControlId: string, 
  expectedCompanyId?: string
): Promise<OrchestratorJob | null> {
  const [event] = await db.select()
    .from(campaignEvents)
    .where(
      and(
        eq(campaignEvents.eventType, "CALL_PLACED"),
        sql`${campaignEvents.payload}->>'providerCallId' = ${callControlId}`
      )
    )
    .limit(1);
  
  if (!event) return null;
  
  if (expectedCompanyId && event.companyId !== expectedCompanyId) {
    console.warn(`[TelnyxWebhook] SECURITY: Company mismatch - event.companyId=${event.companyId?.slice(0,8)}, expected=${expectedCompanyId.slice(0,8)}`);
    return null;
  }
  
  const jobConditions = expectedCompanyId 
    ? and(
        eq(orchestratorJobs.campaignContactId, event.campaignContactId),
        eq(orchestratorJobs.companyId, event.companyId)
      )
    : eq(orchestratorJobs.campaignContactId, event.campaignContactId);
  
  const [job] = await db.select()
    .from(orchestratorJobs)
    .where(jobConditions)
    .orderBy(sql`${orchestratorJobs.createdAt} DESC`)
    .limit(1);
  
  if (job && job.companyId !== event.companyId) {
    console.warn(`[TelnyxWebhook] SECURITY: Job/event company mismatch - aborting`);
    return null;
  }
  
  return job || null;
}

export async function resolveJob(
  callControlId: string,
  clientState: DecodedClientState | null
): Promise<OrchestratorJob | null> {
  if (clientState?.jobId) {
    const job = await findJobByClientState(clientState);
    if (job) {
      if (clientState.companyId && job.companyId !== clientState.companyId) {
        console.warn(`[TelnyxWebhook] SECURITY: Job companyId doesn't match client_state - aborting`);
        return null;
      }
      return job;
    }
  }
  
  return findJobByProviderCallId(callControlId, clientState?.companyId);
}

async function checkEventExists(externalId: string): Promise<boolean> {
  const [existing] = await db.select({ id: campaignEvents.id })
    .from(campaignEvents)
    .where(eq(campaignEvents.externalId, externalId))
    .limit(1);
  
  return !!existing;
}

export async function processCallWebhook(
  payload: TelnyxWebhookPayload
): Promise<WebhookProcessResult> {
  const eventType = payload.data.event_type;
  const callControlId = payload.data.payload.call_control_id;
  const hangupCause = payload.data.payload.hangup_cause;
  const amdResult = payload.data.payload.result;
  
  if (!callControlId) {
    return { success: false, action: "no_op", message: "Missing call_control_id" };
  }
  
  const outcome = mapTelnyxEventToOutcome(eventType, hangupCause, amdResult);
  
  if (!outcome) {
    console.log(`[TelnyxWebhook] Ignoring event ${eventType} (no outcome mapping)`);
    return { success: true, action: "no_op", message: `Event ${eventType} ignored` };
  }
  
  const clientState = decodeClientState(payload.data.payload.client_state);
  const job = await resolveJob(callControlId, clientState);
  
  if (!job) {
    console.log(`[TelnyxWebhook] No job found for call_control_id ${callControlId.slice(0, 8)}...`);
    return { success: false, action: "not_found", message: "Job not found" };
  }
  
  const eventExternalId = `telnyx:${callControlId}:${outcome}`;
  
  const eventExists = await checkEventExists(eventExternalId);
  if (eventExists) {
    console.log(`[TelnyxWebhook] Event ${eventExternalId.slice(0, 30)}... already exists (idempotent)`);
    return { 
      success: true, 
      action: "no_op", 
      jobId: job.id, 
      outcome,
      message: "Event already processed" 
    };
  }
  
  const eventTypeMap: Record<TelnyxCallOutcome, string> = {
    "answered": "CALL_ANSWERED",
    "no_answer": "CALL_NO_ANSWER",
    "busy": "CALL_BUSY",
    "failed": "CALL_FAILED"
  };
  
  await emitCampaignEvent({
    companyId: job.companyId,
    campaignId: job.campaignId,
    campaignContactId: job.campaignContactId,
    contactId: job.contactId,
    eventType: eventTypeMap[outcome] as any,
    channel: "voice",
    provider: "telnyx",
    externalId: eventExternalId,
    payload: {
      provider: "telnyx",
      callControlId,
      telnyxEventType: eventType,
      hangupCause,
      amdResult,
      reason: hangupCause || eventType,
      final: true
    }
  });
  
  if (job.status === "processing") {
    const newStatus = outcome === "failed" ? "failed" : "done";
    const errorMsg = outcome === "failed" ? `Call failed: ${hangupCause || eventType}` : null;
    
    await db.update(orchestratorJobs)
      .set({
        status: newStatus,
        completedAt: new Date(),
        error: errorMsg,
        updatedAt: new Date()
      })
      .where(eq(orchestratorJobs.id, job.id));
    
    console.log(`[TelnyxWebhook] Job ${job.id.slice(0, 8)} -> ${newStatus} (${outcome})`);
    
    return {
      success: true,
      action: "job_updated",
      jobId: job.id,
      outcome,
      message: `Job marked ${newStatus}`
    };
  }
  
  console.log(`[TelnyxWebhook] Job ${job.id.slice(0, 8)} already ${job.status}, event recorded for audit`);
  
  return {
    success: true,
    action: "event_recorded",
    jobId: job.id,
    outcome,
    message: `Job already ${job.status}, event recorded`
  };
}
