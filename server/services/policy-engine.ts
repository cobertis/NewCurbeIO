import { db } from "../db";
import { 
  orchestratorCampaigns, 
  campaignContacts, 
  campaignEvents, 
  contactConsents, 
  contactSuppressions,
  contacts,
  OrchestratorCampaign,
  CampaignContact,
  ContactConsent,
  ContactSuppression
} from "@shared/schema";
import { eq, and, sql, gte, inArray } from "drizzle-orm";

export type OrchestratorChannel = "sms" | "mms" | "imessage" | "whatsapp" | "voice" | "voicemail" | "rvm";

export interface CampaignPolicy {
  maxAttemptsTotal: number;
  maxAttemptsPerDay: number;
  maxAttemptsPerChannel: Record<OrchestratorChannel, number>;
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    timezone: string;
  };
  allowedChannels: OrchestratorChannel[];
  dncTargets: string[];
}

export interface AllowedAction {
  channel: OrchestratorChannel;
  allowed: boolean;
  reasons: string[];
}

export interface BlockedAction {
  channel: OrchestratorChannel;
  reasons: string[];
}

export interface PolicyEngineResult {
  companyId: string;
  campaignId: string;
  contactId: string;
  campaignContactId: string;
  now: string;
  allowedActions: AllowedAction[];
  blocked: BlockedAction[];
}

const DEFAULT_POLICY: CampaignPolicy = {
  maxAttemptsTotal: 10,
  maxAttemptsPerDay: 3,
  maxAttemptsPerChannel: {
    sms: 3,
    mms: 2,
    imessage: 3,
    whatsapp: 2,
    voice: 5,
    voicemail: 2,
    rvm: 2
  },
  quietHours: {
    enabled: true,
    startHour: 21,
    endHour: 8,
    timezone: "America/New_York"
  },
  allowedChannels: ["sms", "mms", "imessage", "whatsapp", "voice", "voicemail", "rvm"],
  dncTargets: []
};

const CHANNELS: OrchestratorChannel[] = ["sms", "mms", "imessage", "whatsapp", "voice", "voicemail", "rvm"];

const CHANNELS_REQUIRING_OPT_IN: OrchestratorChannel[] = ["sms", "mms", "imessage", "whatsapp", "rvm"];

function mergePolicy(stored: unknown): CampaignPolicy {
  const storedObj = (stored && typeof stored === "object" ? stored : {}) as Partial<CampaignPolicy>;
  return {
    ...DEFAULT_POLICY,
    ...storedObj,
    quietHours: {
      ...DEFAULT_POLICY.quietHours,
      ...(storedObj.quietHours || {})
    },
    maxAttemptsPerChannel: {
      ...DEFAULT_POLICY.maxAttemptsPerChannel,
      ...(storedObj.maxAttemptsPerChannel || {})
    }
  };
}

function isInQuietHours(policy: CampaignPolicy, now: Date): boolean {
  if (!policy.quietHours.enabled) return false;
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: policy.quietHours.timezone
  });
  const currentHour = parseInt(formatter.format(now), 10);
  
  const { startHour, endHour } = policy.quietHours;
  
  if (startHour > endHour) {
    return currentHour >= startHour || currentHour < endHour;
  } else {
    return currentHour >= startHour && currentHour < endHour;
  }
}

function getConsentForChannel(
  consents: ContactConsent[],
  channel: OrchestratorChannel
): "opt_in" | "opt_out" | "unknown" {
  const consent = consents.find(c => c.channel === channel);
  return consent?.status || "unknown";
}

export async function calculateAllowedActions(
  companyId: string,
  campaignId: string,
  contactId: string
): Promise<PolicyEngineResult | { error: string; status: number }> {
  const now = new Date();
  
  const [[campaign], [enrollment], suppression, consents, contact] = await Promise.all([
    db.select()
      .from(orchestratorCampaigns)
      .where(and(
        eq(orchestratorCampaigns.id, campaignId),
        eq(orchestratorCampaigns.companyId, companyId)
      ))
      .limit(1),
    
    db.select()
      .from(campaignContacts)
      .where(and(
        eq(campaignContacts.campaignId, campaignId),
        eq(campaignContacts.contactId, contactId),
        eq(campaignContacts.companyId, companyId)
      ))
      .limit(1),
    
    db.select()
      .from(contactSuppressions)
      .where(and(
        eq(contactSuppressions.contactId, contactId),
        eq(contactSuppressions.companyId, companyId)
      ))
      .limit(1)
      .then(rows => rows[0] || null),
    
    db.select()
      .from(contactConsents)
      .where(and(
        eq(contactConsents.contactId, contactId),
        eq(contactConsents.companyId, companyId)
      )),
    
    db.select({ id: contacts.id, phone: contacts.phoneNormalized })
      .from(contacts)
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.companyId, companyId)
      ))
      .limit(1)
      .then(rows => rows[0] || null)
  ]);
  
  if (!campaign) {
    return { error: "Campaign not found", status: 404 };
  }
  
  if (!enrollment) {
    return { error: "Contact not enrolled in this campaign", status: 404 };
  }
  
  if (!contact) {
    return { error: "Contact not found", status: 404 };
  }
  
  const policy = mergePolicy(campaign.policyJson);
  
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const attemptCounts = await db
    .select({
      channel: campaignEvents.channel,
      count: sql<number>`count(*)::int`
    })
    .from(campaignEvents)
    .where(and(
      eq(campaignEvents.campaignContactId, enrollment.id),
      eq(campaignEvents.companyId, companyId),
      gte(campaignEvents.createdAt, twentyFourHoursAgo),
      inArray(campaignEvents.eventType, ["MESSAGE_SENT", "CALL_PLACED", "VOICEMAIL_DROPPED", "RVM_DROPPED"])
    ))
    .groupBy(campaignEvents.channel);
  
  const attempts24h: Record<string, number> = {};
  let totalAttempts24h = 0;
  for (const row of attemptCounts) {
    if (row.channel) {
      attempts24h[row.channel] = row.count;
      totalAttempts24h += row.count;
    }
  }
  
  const allowedActions: AllowedAction[] = [];
  const blocked: BlockedAction[] = [];
  
  const inQuietHours = isInQuietHours(policy, now);
  const contactPhone = contact.phone || "";
  const isOnDnc = policy.dncTargets.includes(contactPhone);
  
  for (const channel of CHANNELS) {
    const reasons: string[] = [];
    let allowed = true;
    
    if (suppression && suppression.suppressionStatus !== "none") {
      allowed = false;
      reasons.push(`SUPPRESSED: ${suppression.suppressionStatus}${suppression.reason ? ` (${suppression.reason})` : ""}`);
    }
    
    if (allowed && !policy.allowedChannels.includes(channel)) {
      allowed = false;
      reasons.push("CHANNEL_NOT_ALLOWED: Channel disabled in campaign policy");
    }
    
    if (allowed) {
      const consentStatus = getConsentForChannel(consents, channel);
      
      if (consentStatus === "opt_out") {
        allowed = false;
        reasons.push("CONSENT_OPT_OUT: Contact has opted out of this channel");
      } else if (consentStatus === "unknown" && CHANNELS_REQUIRING_OPT_IN.includes(channel)) {
        allowed = false;
        reasons.push("CONSENT_UNKNOWN: No explicit consent for this channel (conservative default)");
      }
    }
    
    if (allowed && (channel === "voice" || channel === "voicemail") && isOnDnc) {
      allowed = false;
      reasons.push("DNC: Contact phone is on Do Not Call list");
    }
    
    if (allowed && inQuietHours) {
      allowed = false;
      reasons.push(`QUIET_HOURS: Current time is within quiet hours (${policy.quietHours.startHour}:00 - ${policy.quietHours.endHour}:00 ${policy.quietHours.timezone})`);
    }
    
    if (allowed && totalAttempts24h >= policy.maxAttemptsPerDay) {
      allowed = false;
      reasons.push(`CAP_24H: Daily attempt limit reached (${totalAttempts24h}/${policy.maxAttemptsPerDay})`);
    }
    
    if (allowed && enrollment.attemptsTotal >= policy.maxAttemptsTotal) {
      allowed = false;
      reasons.push(`CAP_TOTAL: Total attempt limit reached (${enrollment.attemptsTotal}/${policy.maxAttemptsTotal})`);
    }
    
    if (allowed) {
      const channelAttempts = attempts24h[channel] || 0;
      const channelCap = policy.maxAttemptsPerChannel[channel] || 0;
      if (channelAttempts >= channelCap) {
        allowed = false;
        reasons.push(`CAP_CHANNEL: Channel attempt limit reached (${channelAttempts}/${channelCap})`);
      }
    }
    
    if (allowed) {
      allowedActions.push({ channel, allowed: true, reasons: [] });
    } else {
      blocked.push({ channel, reasons });
    }
  }
  
  return {
    companyId,
    campaignId,
    contactId,
    campaignContactId: enrollment.id,
    now: now.toISOString(),
    allowedActions,
    blocked
  };
}

export async function getAllowedActionsForEnrollment(
  companyId: string,
  campaignId: string,
  contactId: string
): Promise<PolicyEngineResult | { error: string; status: number }> {
  return calculateAllowedActions(companyId, campaignId, contactId);
}
