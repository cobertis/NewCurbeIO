import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  campaignAuditLogs,
  orchestratorCampaigns,
  contacts,
  CampaignEvent,
  CampaignContact
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface EmitCampaignEventInput {
  companyId: string;
  campaignId: string;
  campaignContactId?: string;
  contactId: string;
  eventType: CampaignEvent["eventType"];
  channel?: CampaignEvent["channel"];
  provider?: string;
  externalId?: string;
  payload?: Record<string, any>;
  cost?: { amount: number; currency: string };
}

export interface EmitCampaignEventResult {
  event: CampaignEvent;
  wasIdempotent: boolean;
  stateTransition?: { before: string; after: string };
}

// Shared constant: Event types that count as "attempts" for caps/limits
// Used by: Policy Engine (24h caps, total caps), Event Emitter (attemptsTotal increment)
export const ATTEMPT_EVENT_TYPES = [
  "MESSAGE_SENT",
  "CALL_PLACED",
  "VOICEMAIL_DROPPED",
  "RVM_DROPPED"
] as const;

const TERMINAL_EVENT_TYPES = {
  OPT_OUT: "DO_NOT_CONTACT",
  COMPLAINT: "DO_NOT_CONTACT",
  MANUAL_STOP: "STOPPED"
} as const;

const ENGAGEMENT_EVENT_TYPES = [
  "MESSAGE_REPLIED",
  "CALL_ANSWERED"
] as const;

const NON_TRANSITIONABLE_STATES = ["STOPPED", "DO_NOT_CONTACT"] as const;

function isAttemptEvent(eventType: string): boolean {
  return (ATTEMPT_EVENT_TYPES as readonly string[]).includes(eventType);
}

function getTerminalState(eventType: string): string | null {
  return (TERMINAL_EVENT_TYPES as Record<string, string>)[eventType] || null;
}

function isEngagementEvent(eventType: string): boolean {
  return (ENGAGEMENT_EVENT_TYPES as readonly string[]).includes(eventType);
}

function canTransition(currentState: string): boolean {
  return !(NON_TRANSITIONABLE_STATES as readonly string[]).includes(currentState);
}

export async function emitCampaignEvent(
  input: EmitCampaignEventInput
): Promise<EmitCampaignEventResult | { error: string; status: number }> {
  const {
    companyId,
    campaignId,
    contactId,
    eventType,
    channel,
    provider,
    externalId,
    payload,
    cost
  } = input;

  if (!companyId || !campaignId || !contactId || !eventType) {
    return { error: "companyId, campaignId, contactId, and eventType are required", status: 400 };
  }

  const [[campaign], [contact]] = await Promise.all([
    db.select({ id: orchestratorCampaigns.id })
      .from(orchestratorCampaigns)
      .where(and(
        eq(orchestratorCampaigns.id, campaignId),
        eq(orchestratorCampaigns.companyId, companyId)
      ))
      .limit(1),
    db.select({ id: contacts.id })
      .from(contacts)
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.companyId, companyId)
      ))
      .limit(1)
  ]);

  if (!campaign) {
    return { error: "Campaign not found", status: 404 };
  }
  if (!contact) {
    return { error: "Contact not found", status: 404 };
  }

  let campaignContactId = input.campaignContactId;
  let enrollment: CampaignContact | null = null;

  if (campaignContactId) {
    const [found] = await db.select()
      .from(campaignContacts)
      .where(and(
        eq(campaignContacts.id, campaignContactId),
        eq(campaignContacts.companyId, companyId)
      ))
      .limit(1);
    enrollment = found || null;
    if (!enrollment) {
      return { error: "Campaign contact enrollment not found", status: 404 };
    }
  } else {
    const [found] = await db.select()
      .from(campaignContacts)
      .where(and(
        eq(campaignContacts.campaignId, campaignId),
        eq(campaignContacts.contactId, contactId),
        eq(campaignContacts.companyId, companyId)
      ))
      .limit(1);
    enrollment = found || null;
    if (enrollment) {
      campaignContactId = enrollment.id;
    }
  }

  if (!campaignContactId || !enrollment) {
    return { error: "Contact is not enrolled in this campaign", status: 404 };
  }

  // Compute state transition before insert
  const stateBefore = enrollment.state;
  let stateAfter: CampaignContact["state"] = stateBefore;
  let shouldUpdateState = false;

  const terminalState = getTerminalState(eventType);
  if (terminalState) {
    stateAfter = terminalState as CampaignContact["state"];
    shouldUpdateState = true;
  } else if (isEngagementEvent(eventType) && canTransition(stateBefore)) {
    stateAfter = "ENGAGED";
    shouldUpdateState = stateBefore !== "ENGAGED";
  }

  // Build event data
  const eventData = {
    campaignId,
    campaignContactId,
    contactId,
    companyId,
    eventType,
    channel: channel || null,
    provider: provider || null,
    // externalId MUST be namespaced by provider: "{provider}:{id}" e.g. "twilio:SMxxx"
    externalId: externalId || null,
    payload: payload || {},
    costAmount: cost ? cost.amount.toString() : null,
    costCurrency: cost ? cost.currency : null,
    stateBefore,
    stateAfter
  };

  let newEvent: CampaignEvent;

  if (externalId) {
    // Race-safe insert: try insert, catch unique violation, re-fetch if conflict
    // Using try-catch because partial unique index doesn't work with onConflictDoNothing target
    try {
      const [inserted] = await db.insert(campaignEvents)
        .values(eventData)
        .returning();
      newEvent = inserted;
    } catch (err: any) {
      // Check for unique violation (Postgres error code 23505)
      if (err?.code === "23505" && err?.constraint === "campaign_events_company_external_id_uniq") {
        // Conflict occurred - fetch existing event
        const [existing] = await db.select()
          .from(campaignEvents)
          .where(and(
            eq(campaignEvents.companyId, companyId),
            eq(campaignEvents.externalId, externalId)
          ))
          .limit(1);

        if (!existing) {
          // Should never happen but handle gracefully
          return { error: "Race condition: event not found after conflict", status: 500 };
        }

        return {
          event: existing,
          wasIdempotent: true
        };
      }
      // Re-throw other errors
      throw err;
    }
  } else {
    // No externalId - regular insert (no conflict possible on this constraint)
    const [inserted] = await db.insert(campaignEvents)
      .values(eventData)
      .returning();
    newEvent = inserted;
  }

  if (isAttemptEvent(eventType) || shouldUpdateState) {
    const updates: Partial<CampaignContact> = {
      updatedAt: new Date()
    };

    if (isAttemptEvent(eventType)) {
      updates.attemptsTotal = enrollment.attemptsTotal + 1;
      updates.lastAttemptAt = new Date();
    }

    if (shouldUpdateState) {
      updates.state = stateAfter as CampaignContact["state"];
      if (stateAfter === "STOPPED" || stateAfter === "DO_NOT_CONTACT") {
        updates.stoppedAt = new Date();
      }
    }

    await db.update(campaignContacts)
      .set(updates)
      .where(eq(campaignContacts.id, campaignContactId));
  }

  await db.insert(campaignAuditLogs).values({
    companyId,
    campaignId,
    campaignContactId,
    contactId,
    logType: "event_emitted",
    eventType,
    channel: channel || null,
    payload: {
      eventId: newEvent.id,
      eventType,
      channel,
      provider,
      externalId: externalId ? "[REDACTED]" : null,
      stateBefore,
      stateAfter,
      hasCost: !!cost
    }
  });

  const result: EmitCampaignEventResult = {
    event: newEvent,
    wasIdempotent: false
  };

  if (stateBefore !== stateAfter) {
    result.stateTransition = { before: stateBefore, after: stateAfter };
  }

  return result;
}

export async function validateInternalApiKey(providedKey: string | undefined): Promise<boolean> {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
    throw new Error("INTERNAL_API_KEY not configured");
  }
  return providedKey === internalKey;
}
