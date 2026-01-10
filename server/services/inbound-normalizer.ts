/**
 * Inbound Normalizer v1
 * Processes inbound messages, detects intents, and applies stop rules.
 * 
 * Intents:
 * - OPT_OUT: STOP, UNSUBSCRIBE, CANCEL, QUIT, PARAR, ALTO, BASTA, NO MOLESTAR
 * - NOT_INTERESTED: no, not interested, no gracias (conservative)
 * - MESSAGE_REPLIED: default for any other reply
 */

import { db } from "../db";
import { 
  contacts,
  contactConsents,
  contactSuppressions,
  campaignContacts,
  orchestratorCampaigns,
  telnyxPhoneNumbers
} from "@shared/schema";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { emitCampaignEvent } from "./campaign-events";

export type InboundChannel = "sms" | "imessage" | "mms" | "whatsapp";
export type InboundIntent = "OPT_OUT" | "NOT_INTERESTED" | "MESSAGE_REPLIED" | "UNKNOWN_CONTACT";

export interface InboundMessageInput {
  provider: string;
  channel: InboundChannel;
  from: string;
  to?: string;
  text: string;
  externalId?: string;
  companyId?: string;
  raw?: Record<string, any>;
}

export interface InboundNormalizeResult {
  success: boolean;
  intent: InboundIntent;
  contactId?: string;
  companyId?: string;
  eventsEmitted: number;
  enrollmentsUpdated: number;
  error?: string;
}

const OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "cancel",
  "quit",
  "parar",
  "alto",
  "basta",
  "no molestar",
  "optout",
  "opt out",
  "opt-out",
  "remove",
  "end"
];

const NOT_INTERESTED_PHRASES = [
  "not interested",
  "no gracias",
  "no thank you",
  "no thanks",
  "leave me alone"
];

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

/**
 * Resolve companyId from the "to" phone number using telnyx_phone_numbers table.
 * This ensures multi-tenant isolation - companyId from body is NEVER trusted.
 */
export async function resolveCompanyFromToNumber(toPhone: string): Promise<string | null> {
  const normalized = normalizePhone(toPhone);
  
  const result = await db.select({ companyId: telnyxPhoneNumbers.companyId })
    .from(telnyxPhoneNumbers)
    .where(eq(telnyxPhoneNumbers.phoneNumber, normalized))
    .limit(1);
  
  if (result.length === 0) return null;
  return result[0].companyId;
}

export function detectIntent(text: string): InboundIntent {
  const normalized = text.toLowerCase().trim();
  
  for (const keyword of OPT_OUT_KEYWORDS) {
    if (normalized === keyword || normalized.includes(keyword)) {
      return "OPT_OUT";
    }
  }
  
  for (const phrase of NOT_INTERESTED_PHRASES) {
    if (normalized.includes(phrase)) {
      return "NOT_INTERESTED";
    }
  }
  
  return "MESSAGE_REPLIED";
}

async function findContactByPhone(phone: string, companyId?: string): Promise<{ id: string; companyId: string } | null> {
  const normalized = normalizePhone(phone);
  
  const conditions = [eq(contacts.phoneNormalized, normalized)];
  if (companyId) {
    conditions.push(eq(contacts.companyId, companyId));
  }
  
  const results = await db.select({ id: contacts.id, companyId: contacts.companyId })
    .from(contacts)
    .where(and(...conditions))
    .limit(2);
  
  if (results.length === 0) return null;
  
  if (results.length > 1 && !companyId) {
    console.warn("[Inbound] Multiple contacts found for phone - provide companyId to disambiguate");
    return null;
  }
  
  return results[0];
}

async function getActiveEnrollments(contactId: string, companyId: string): Promise<{ id: string; campaignId: string }[]> {
  return db.select({ 
    id: campaignContacts.id, 
    campaignId: campaignContacts.campaignId 
  })
    .from(campaignContacts)
    .innerJoin(orchestratorCampaigns, eq(campaignContacts.campaignId, orchestratorCampaigns.id))
    .where(and(
      eq(campaignContacts.contactId, contactId),
      eq(campaignContacts.companyId, companyId),
      inArray(campaignContacts.state, ["NEW", "ATTEMPTING", "ENGAGED"] as const),
      eq(orchestratorCampaigns.status, "active")
    ));
}

async function upsertConsent(
  contactId: string, 
  companyId: string, 
  channel: InboundChannel, 
  status: "opt_in" | "opt_out"
): Promise<void> {
  const existingConsent = await db.select()
    .from(contactConsents)
    .where(and(
      eq(contactConsents.contactId, contactId),
      eq(contactConsents.channel, channel)
    ))
    .limit(1);
  
  if (existingConsent.length > 0) {
    await db.update(contactConsents)
      .set({
        status,
        previousStatus: existingConsent[0].status,
        source: "inbound_message",
        sourceTimestamp: new Date(),
        changedReason: status === "opt_out" ? "STOP keyword received" : "Positive reply",
        updatedAt: new Date()
      })
      .where(eq(contactConsents.id, existingConsent[0].id));
  } else {
    await db.insert(contactConsents)
      .values({
        contactId,
        companyId,
        channel,
        status,
        source: "inbound_message",
        sourceTimestamp: new Date()
      });
  }
}

async function upsertSuppression(
  contactId: string,
  companyId: string,
  status: "opted_out" | "complaint",
  reason: string,
  affectedCampaigns: string[]
): Promise<void> {
  const existing = await db.select()
    .from(contactSuppressions)
    .where(eq(contactSuppressions.contactId, contactId))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(contactSuppressions)
      .set({
        suppressionStatus: status,
        reason,
        triggeredBy: "inbound_message",
        affectedCampaigns,
        updatedAt: new Date()
      })
      .where(eq(contactSuppressions.id, existing[0].id));
  } else {
    await db.insert(contactSuppressions)
      .values({
        contactId,
        companyId,
        suppressionStatus: status,
        reason,
        triggeredBy: "inbound_message",
        affectedCampaigns
      });
  }
}

async function setEnrollmentsDNC(enrollmentIds: string[]): Promise<number> {
  if (enrollmentIds.length === 0) return 0;
  
  await db.update(campaignContacts)
    .set({
      state: "DO_NOT_CONTACT",
      stoppedReason: "OPT_OUT received",
      stoppedAt: new Date(),
      updatedAt: new Date()
    })
    .where(inArray(campaignContacts.id, enrollmentIds));
  
  return enrollmentIds.length;
}

async function setEnrollmentsEngaged(enrollmentIds: string[]): Promise<number> {
  if (enrollmentIds.length === 0) return 0;
  
  await db.update(campaignContacts)
    .set({
      state: "ENGAGED",
      updatedAt: new Date()
    })
    .where(and(
      inArray(campaignContacts.id, enrollmentIds),
      notInArray(campaignContacts.state, ["STOPPED", "DO_NOT_CONTACT", "UNREACHABLE"] as const)
    ));
  
  return enrollmentIds.length;
}

function buildExternalId(provider: string, externalId?: string, intent?: string): string {
  const base = externalId ? `${provider}:${externalId}` : `${provider}:inbound:${Date.now()}`;
  return intent ? `${base}:${intent.toLowerCase()}` : base;
}

export async function processInboundMessage(input: InboundMessageInput): Promise<InboundNormalizeResult> {
  const { provider, channel, from, to, text, externalId } = input;
  
  // CRITICAL: Resolve companyId from "to" phone number, NEVER trust companyId from body
  if (!to) {
    return {
      success: false,
      intent: "UNKNOWN_CONTACT",
      eventsEmitted: 0,
      enrollmentsUpdated: 0,
      error: "'to' field required for multi-tenant routing"
    };
  }
  
  const resolvedCompanyId = await resolveCompanyFromToNumber(to);
  
  if (!resolvedCompanyId) {
    return {
      success: true,
      intent: "UNKNOWN_CONTACT",
      eventsEmitted: 0,
      enrollmentsUpdated: 0,
      error: "Unknown 'to' number - not registered in system"
    };
  }
  
  const contact = await findContactByPhone(from, resolvedCompanyId);
  
  if (!contact) {
    return {
      success: true,
      intent: "UNKNOWN_CONTACT",
      eventsEmitted: 0,
      enrollmentsUpdated: 0,
      error: "Unknown contact - no action taken"
    };
  }
  
  const intent = detectIntent(text);
  const enrollments = await getActiveEnrollments(contact.id, contact.companyId);
  
  let eventsEmitted = 0;
  let enrollmentsUpdated = 0;
  
  if (intent === "OPT_OUT") {
    await upsertConsent(contact.id, contact.companyId, channel, "opt_out");
    
    const affectedCampaigns = enrollments.map(e => e.campaignId);
    await upsertSuppression(
      contact.id, 
      contact.companyId, 
      "opted_out", 
      `STOP keyword: "${text.substring(0, 50)}"`,
      affectedCampaigns
    );
    
    enrollmentsUpdated = await setEnrollmentsDNC(enrollments.map(e => e.id));
    
    for (const enrollment of enrollments) {
      await emitCampaignEvent({
        companyId: contact.companyId,
        campaignId: enrollment.campaignId,
        campaignContactId: enrollment.id,
        contactId: contact.id,
        eventType: "OPT_OUT",
        channel,
        provider,
        externalId: buildExternalId(provider, externalId, "opt_out"),
        payload: {
          text: text.substring(0, 500),
          intent
        }
      });
      eventsEmitted++;
    }
  } else if (intent === "MESSAGE_REPLIED") {
    enrollmentsUpdated = await setEnrollmentsEngaged(enrollments.map(e => e.id));
    
    for (const enrollment of enrollments) {
      await emitCampaignEvent({
        companyId: contact.companyId,
        campaignId: enrollment.campaignId,
        campaignContactId: enrollment.id,
        contactId: contact.id,
        eventType: "MESSAGE_REPLIED",
        channel,
        provider,
        externalId: buildExternalId(provider, externalId, "replied"),
        payload: {
          text: text.substring(0, 500),
          intent
        }
      });
      eventsEmitted++;
    }
  } else if (intent === "NOT_INTERESTED") {
    enrollmentsUpdated = await setEnrollmentsEngaged(enrollments.map(e => e.id));
    
    for (const enrollment of enrollments) {
      await emitCampaignEvent({
        companyId: contact.companyId,
        campaignId: enrollment.campaignId,
        campaignContactId: enrollment.id,
        contactId: contact.id,
        eventType: "MESSAGE_REPLIED",
        channel,
        provider,
        externalId: buildExternalId(provider, externalId, "not_interested"),
        payload: {
          text: text.substring(0, 500),
          intent,
          notInterested: true
        }
      });
      eventsEmitted++;
    }
  }
  
  return {
    success: true,
    intent,
    contactId: contact.id,
    companyId: contact.companyId,
    eventsEmitted,
    enrollmentsUpdated
  };
}
