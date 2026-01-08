import { db } from "../db";
import { 
  canonicalPersons, 
  canonicalContactPoints, 
  leadOperational,
  contactAttempts,
  suppressionList
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { normalizePhoneToE164, normalizeEmail } from "./lead-canonicalizer-service";

// State to Timezone mapping
const STATE_TIMEZONE_MAP: Record<string, string> = {
  'AL': 'America/Chicago', 'AK': 'America/Anchorage', 'AZ': 'America/Phoenix',
  'AR': 'America/Chicago', 'CA': 'America/Los_Angeles', 'CO': 'America/Denver',
  'CT': 'America/New_York', 'DE': 'America/New_York', 'FL': 'America/New_York',
  'GA': 'America/New_York', 'HI': 'Pacific/Honolulu', 'ID': 'America/Boise',
  'IL': 'America/Chicago', 'IN': 'America/Indiana/Indianapolis', 'IA': 'America/Chicago',
  'KS': 'America/Chicago', 'KY': 'America/New_York', 'LA': 'America/Chicago',
  'ME': 'America/New_York', 'MD': 'America/New_York', 'MA': 'America/New_York',
  'MI': 'America/Detroit', 'MN': 'America/Chicago', 'MS': 'America/Chicago',
  'MO': 'America/Chicago', 'MT': 'America/Denver', 'NE': 'America/Chicago',
  'NV': 'America/Los_Angeles', 'NH': 'America/New_York', 'NJ': 'America/New_York',
  'NM': 'America/Denver', 'NY': 'America/New_York', 'NC': 'America/New_York',
  'ND': 'America/Chicago', 'OH': 'America/New_York', 'OK': 'America/Chicago',
  'OR': 'America/Los_Angeles', 'PA': 'America/New_York', 'RI': 'America/New_York',
  'SC': 'America/New_York', 'SD': 'America/Chicago', 'TN': 'America/Chicago',
  'TX': 'America/Chicago', 'UT': 'America/Denver', 'VT': 'America/New_York',
  'VA': 'America/New_York', 'WA': 'America/Los_Angeles', 'WV': 'America/New_York',
  'WI': 'America/Chicago', 'WY': 'America/Denver', 'DC': 'America/New_York',
  'PR': 'America/Puerto_Rico', 'VI': 'America/Virgin'
};

export interface RiskFlags {
  dnc_all?: boolean;
  no_valid_phone?: boolean;
  no_valid_email?: boolean;
  all_opted_out?: boolean;
  junk_demographics?: boolean;
  all_phones_invalid?: boolean;
}

export interface DerivedFields {
  bestPhoneToCall: string | null;
  bestPhoneForSms: string | null;
  bestEmail: string | null;
  timezone: string | null;
  contactabilityScore: number;
  riskFlags: RiskFlags;
  recommendedNextAction: 'CALL' | 'SMS' | 'EMAIL' | 'UNCONTACTABLE';
}

export class LeadDerivedFieldsService {
  
  // Check if a contact point is permitted for contact
  // Channel parameter enables channel-specific validation
  async isContactPointPermitted(
    companyId: string,
    contactPointId: string,
    channel?: 'call' | 'sms' | 'email'
  ): Promise<{ permitted: boolean; reason?: string }> {
    const [cp] = await db.select()
      .from(canonicalContactPoints)
      .where(eq(canonicalContactPoints.id, contactPointId))
      .limit(1);
    
    if (!cp) {
      return { permitted: false, reason: 'Contact point not found' };
    }
    
    // Channel-type validation
    if (channel === 'email' && cp.type !== 'email') {
      return { permitted: false, reason: `Contact point is ${cp.type}, not email` };
    }
    
    if ((channel === 'call' || channel === 'sms') && cp.type !== 'phone') {
      return { permitted: false, reason: `Contact point is ${cp.type}, not phone` };
    }
    
    if (!cp.isValid) {
      return { permitted: false, reason: `Invalid ${cp.type}: ${cp.valueRaw || cp.value}` };
    }
    
    // DNC check - applies to call and sms channels for phones
    if (cp.dncStatus === 'yes') {
      // DNC blocks calls; for SMS we also check DNC
      if (channel === 'call' || channel === 'sms' || !channel) {
        return { permitted: false, reason: `DNC by vendor on ${cp.value}` };
      }
    }
    
    if (cp.optedOut) {
      return { permitted: false, reason: `Opted out: ${cp.value}` };
    }
    
    // SMS-specific: Check if phone subtype is suitable for SMS
    if (channel === 'sms') {
      const smsPreferredSubtypes = ['mobile', 'personal'];
      if (!smsPreferredSubtypes.includes(cp.subtype)) {
        // Allow but warn for non-mobile numbers
        // For strict enforcement, could return permitted: false
        // For now, we allow with reduced confidence but permit it
      }
    }
    
    // Check suppression list with normalized values
    // Normalize the contact point value for comparison
    let normalizedValue = cp.value;
    if (cp.type === 'phone') {
      const { normalized } = normalizePhoneToE164(cp.value);
      normalizedValue = normalized;
    } else if (cp.type === 'email') {
      const { normalized } = normalizeEmail(cp.value);
      normalizedValue = normalized;
    }
    
    // Get suppression list entries and normalize for comparison
    const suppressionEntries = await db.select()
      .from(suppressionList)
      .where(and(
        eq(suppressionList.companyId, companyId),
        eq(suppressionList.type, cp.type)
      ));
    
    for (const entry of suppressionEntries) {
      let normalizedSuppressionValue = entry.value;
      if (cp.type === 'phone') {
        const { normalized } = normalizePhoneToE164(entry.value);
        normalizedSuppressionValue = normalized;
      } else if (cp.type === 'email') {
        const { normalized } = normalizeEmail(entry.value);
        normalizedSuppressionValue = normalized;
      }
      
      if (normalizedValue === normalizedSuppressionValue) {
        return { permitted: false, reason: `Suppressed: ${cp.value}` };
      }
    }
    
    return { permitted: true };
  }
  
  // Get best phone for calling
  async getBestPhoneToCall(companyId: string, personId: string): Promise<string | null> {
    // Priority: direct > mobile > personal > other (for calls)
    // Must be: valid, not DNC, not opted out
    const phones = await db.select()
      .from(canonicalContactPoints)
      .where(and(
        eq(canonicalContactPoints.companyId, companyId),
        eq(canonicalContactPoints.personId, personId),
        eq(canonicalContactPoints.type, 'phone'),
        eq(canonicalContactPoints.isValid, true),
        sql`${canonicalContactPoints.dncStatus} != 'yes'`,
        eq(canonicalContactPoints.optedOut, false)
      ));
    
    if (phones.length === 0) return null;
    
    // Sort by subtype priority for calls
    const priority: Record<string, number> = {
      'direct': 4,
      'mobile': 3,
      'personal': 2,
      'business': 1,
      'other': 0
    };
    
    phones.sort((a, b) => (priority[b.subtype] || 0) - (priority[a.subtype] || 0));
    
    return phones[0].id;
  }
  
  // Get best phone for SMS
  async getBestPhoneForSms(companyId: string, personId: string): Promise<string | null> {
    // Priority: mobile > personal > direct > other (for SMS)
    // Must be: valid, not DNC, not opted out
    const phones = await db.select()
      .from(canonicalContactPoints)
      .where(and(
        eq(canonicalContactPoints.companyId, companyId),
        eq(canonicalContactPoints.personId, personId),
        eq(canonicalContactPoints.type, 'phone'),
        eq(canonicalContactPoints.isValid, true),
        sql`${canonicalContactPoints.dncStatus} != 'yes'`,
        eq(canonicalContactPoints.optedOut, false)
      ));
    
    if (phones.length === 0) return null;
    
    // SMS priority - prefer mobile
    const priority: Record<string, number> = {
      'mobile': 4,
      'personal': 3,
      'direct': 2,
      'business': 1,
      'other': 0
    };
    
    phones.sort((a, b) => (priority[b.subtype] || 0) - (priority[a.subtype] || 0));
    
    // Only return if mobile or personal (SMS likely to work)
    if (phones[0].subtype === 'mobile' || phones[0].subtype === 'personal') {
      return phones[0].id;
    }
    
    return phones[0].id;
  }
  
  // Get best email
  async getBestEmail(companyId: string, personId: string): Promise<string | null> {
    // Priority: verified > business > personal > other
    // Must be: valid, not opted out
    const emails = await db.select()
      .from(canonicalContactPoints)
      .where(and(
        eq(canonicalContactPoints.companyId, companyId),
        eq(canonicalContactPoints.personId, personId),
        eq(canonicalContactPoints.type, 'email'),
        eq(canonicalContactPoints.isValid, true),
        eq(canonicalContactPoints.optedOut, false)
      ));
    
    if (emails.length === 0) return null;
    
    // Sort by verified first, then by subtype
    emails.sort((a, b) => {
      if (a.isVerified && !b.isVerified) return -1;
      if (!a.isVerified && b.isVerified) return 1;
      
      const priority: Record<string, number> = {
        'business': 3,
        'personal': 2,
        'other': 1
      };
      return (priority[b.subtype] || 0) - (priority[a.subtype] || 0);
    });
    
    return emails[0].id;
  }
  
  // Compute contactability score and risk flags
  async computeScoreAndFlags(
    companyId: string,
    personId: string,
    bestPhoneToCall: string | null,
    bestPhoneForSms: string | null,
    bestEmail: string | null
  ): Promise<{ score: number; flags: RiskFlags }> {
    let score = 0;
    const flags: RiskFlags = {};
    
    // Get all contact points for this person
    const allContactPoints = await db.select()
      .from(canonicalContactPoints)
      .where(and(
        eq(canonicalContactPoints.companyId, companyId),
        eq(canonicalContactPoints.personId, personId)
      ));
    
    const phones = allContactPoints.filter(cp => cp.type === 'phone');
    const emails = allContactPoints.filter(cp => cp.type === 'email');
    const validPhones = phones.filter(cp => cp.isValid);
    const validEmails = emails.filter(cp => cp.isValid);
    const verifiedEmails = emails.filter(cp => cp.isVerified);
    
    // Positive scoring
    if (bestPhoneToCall) {
      score += 30;
    }
    
    if (bestPhoneForSms) {
      score += 20;
    }
    
    if (bestEmail) {
      score += 15;
      if (verifiedEmails.length > 0) {
        score += 10;
      }
    }
    
    // Add points for multiple contact methods
    if (validPhones.length > 1) score += 5;
    if (validEmails.length > 1) score += 5;
    
    // Risk flags and negative scoring
    const dncPhones = validPhones.filter(cp => cp.dncStatus === 'yes');
    if (dncPhones.length === validPhones.length && validPhones.length > 0) {
      flags.dnc_all = true;
      score -= 50;
    }
    
    if (validPhones.length === 0) {
      flags.no_valid_phone = true;
      score -= 40;
    } else if (phones.length > 0 && validPhones.length === 0) {
      flags.all_phones_invalid = true;
      score -= 30;
    }
    
    if (validEmails.length === 0) {
      flags.no_valid_email = true;
      score -= 10;
    }
    
    const optedOutCount = allContactPoints.filter(cp => cp.optedOut).length;
    if (optedOutCount === allContactPoints.length && allContactPoints.length > 0) {
      flags.all_opted_out = true;
      score -= 60;
    }
    
    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score));
    
    return { score, flags };
  }
  
  // Determine recommended next action
  determineRecommendedAction(
    bestPhoneToCall: string | null,
    bestPhoneForSms: string | null,
    bestEmail: string | null
  ): 'CALL' | 'SMS' | 'EMAIL' | 'UNCONTACTABLE' {
    if (bestPhoneToCall) return 'CALL';
    if (bestPhoneForSms) return 'SMS';
    if (bestEmail) return 'EMAIL';
    return 'UNCONTACTABLE';
  }
  
  // Derive timezone from state
  deriveTimezone(state: string | null | undefined): string | null {
    if (!state) return null;
    const normalized = state.toUpperCase().trim();
    return STATE_TIMEZONE_MAP[normalized] || null;
  }
  
  // Compute all derived fields for a person
  async computeDerivedFields(companyId: string, personId: string): Promise<DerivedFields> {
    // Get person for timezone derivation
    const [person] = await db.select()
      .from(canonicalPersons)
      .where(eq(canonicalPersons.id, personId))
      .limit(1);
    
    const bestPhoneToCall = await this.getBestPhoneToCall(companyId, personId);
    const bestPhoneForSms = await this.getBestPhoneForSms(companyId, personId);
    const bestEmail = await this.getBestEmail(companyId, personId);
    
    const { score, flags } = await this.computeScoreAndFlags(
      companyId, personId, bestPhoneToCall, bestPhoneForSms, bestEmail
    );
    
    const recommendedNextAction = this.determineRecommendedAction(
      bestPhoneToCall, bestPhoneForSms, bestEmail
    );
    
    const timezone = person ? this.deriveTimezone(person.state) : null;
    
    return {
      bestPhoneToCall,
      bestPhoneForSms,
      bestEmail,
      timezone,
      contactabilityScore: score,
      riskFlags: flags,
      recommendedNextAction
    };
  }
  
  // Create or update lead_operational record
  async upsertLeadOperational(
    companyId: string,
    personId: string,
    batchId: string
  ): Promise<string> {
    const derived = await this.computeDerivedFields(companyId, personId);
    
    // Check if record exists
    const existing = await db.select({ id: leadOperational.id })
      .from(leadOperational)
      .where(and(
        eq(leadOperational.companyId, companyId),
        eq(leadOperational.personId, personId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(leadOperational)
        .set({
          lastBatchId: batchId,
          bestPhoneToCall: derived.bestPhoneToCall,
          bestPhoneForSms: derived.bestPhoneForSms,
          bestEmail: derived.bestEmail,
          timezone: derived.timezone,
          contactabilityScore: derived.contactabilityScore,
          riskFlags: derived.riskFlags,
          recommendedNextAction: derived.recommendedNextAction,
          updatedAt: new Date()
        })
        .where(eq(leadOperational.id, existing[0].id));
      
      return existing[0].id;
    }
    
    const [inserted] = await db.insert(leadOperational)
      .values({
        companyId,
        personId,
        status: 'new',
        lastBatchId: batchId,
        bestPhoneToCall: derived.bestPhoneToCall,
        bestPhoneForSms: derived.bestPhoneForSms,
        bestEmail: derived.bestEmail,
        timezone: derived.timezone,
        contactabilityScore: derived.contactabilityScore,
        riskFlags: derived.riskFlags,
        recommendedNextAction: derived.recommendedNextAction
      })
      .returning({ id: leadOperational.id });
    
    return inserted.id;
  }
  
  // Recompute all leads for a company (batch job)
  async recomputeAllLeads(companyId: string): Promise<{ processed: number; errors: number }> {
    const persons = await db.select({ id: canonicalPersons.id, lastBatchId: canonicalPersons.lastBatchId })
      .from(canonicalPersons)
      .where(eq(canonicalPersons.companyId, companyId));
    
    let processed = 0;
    let errors = 0;
    
    for (const person of persons) {
      try {
        await this.upsertLeadOperational(companyId, person.id, person.lastBatchId || '');
        processed++;
      } catch (err) {
        console.error(`[LeadDerivedFields] Error processing person ${person.id}:`, err);
        errors++;
      }
    }
    
    return { processed, errors };
  }
}

export const leadDerivedFieldsService = new LeadDerivedFieldsService();
