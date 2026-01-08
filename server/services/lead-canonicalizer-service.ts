import { db } from "../db";
import { 
  leadRawRows, 
  canonicalPersons, 
  canonicalContactPoints, 
  canonicalCompanyEntities,
  personCompanyRelations,
  leadOperational,
  importLeadBatches
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

// US State to Timezone mapping
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

// Subtype priority for deduplication (higher = preferred)
const SUBTYPE_PRIORITY: Record<string, number> = {
  'mobile': 4,
  'direct': 3,
  'personal': 2,
  'business': 1,
  'other': 0
};

export interface ParseWarning {
  field: string;
  message: string;
  phonesCount?: number;
  dncsCount?: number;
}

export interface PhoneWithDnc {
  raw: string;
  normalized: string;
  isValid: boolean;
  dncStatus: 'yes' | 'no' | 'unknown';
  subtype: 'mobile' | 'direct' | 'personal' | 'business' | 'other';
}

export interface EmailParsed {
  raw: string;
  normalized: string;
  isValid: boolean;
  isVerified: boolean;
  subtype: 'business' | 'personal' | 'other';
}

// Split CSV list by comma, trim, remove empty values
export function splitCsvList(str: string | null | undefined): string[] {
  if (!str || str.trim() === '') return [];
  return str.split(',').map(s => s.trim()).filter(s => s !== '');
}

// Normalize phone to E.164 format (US default)
export function normalizePhoneToE164(phone: string): { normalized: string; isValid: boolean } {
  if (!phone) return { normalized: '', isValid: false };
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check for valid US phone number
  if (digits.length === 10) {
    return { normalized: `+1${digits}`, isValid: true };
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return { normalized: `+${digits}`, isValid: true };
  } else if (digits.length >= 10 && digits.length <= 15) {
    // International number - keep as is with + prefix
    return { normalized: `+${digits}`, isValid: true };
  }
  
  // Invalid phone - return cleaned version but mark invalid
  return { normalized: digits, isValid: false };
}

// Normalize email (lowercase, trim, basic validation)
export function normalizeEmail(email: string): { normalized: string; isValid: boolean } {
  if (!email) return { normalized: '', isValid: false };
  
  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return {
    normalized: cleaned,
    isValid: emailRegex.test(cleaned)
  };
}

// Parse phone field with aligned DNC flags
export function parsePhoneWithDnc(
  phoneField: string | null | undefined,
  dncField: string | null | undefined,
  subtype: 'mobile' | 'direct' | 'personal'
): { phones: PhoneWithDnc[]; warnings: ParseWarning[] } {
  const phones = splitCsvList(phoneField);
  const dncs = splitCsvList(dncField);
  const warnings: ParseWarning[] = [];
  
  // Check for misaligned arrays
  if (dncs.length > 0 && dncs.length !== phones.length) {
    warnings.push({
      field: subtype,
      message: `Phone/DNC count mismatch: ${phones.length} phones, ${dncs.length} DNC flags`,
      phonesCount: phones.length,
      dncsCount: dncs.length
    });
  }
  
  const result: PhoneWithDnc[] = phones.map((rawPhone, i) => {
    const { normalized, isValid } = normalizePhoneToE164(rawPhone);
    
    // Get DNC flag by position, default to UNKNOWN if missing
    const flag = i < dncs.length ? dncs[i].toUpperCase() : 'UNKNOWN';
    let dncStatus: 'yes' | 'no' | 'unknown';
    
    if (flag === 'Y' || flag === 'YES' || flag === 'TRUE' || flag === '1') {
      dncStatus = 'yes';
    } else if (flag === 'N' || flag === 'NO' || flag === 'FALSE' || flag === '0') {
      dncStatus = 'no';
    } else {
      dncStatus = 'unknown';
    }
    
    return {
      raw: rawPhone,
      normalized,
      isValid,
      dncStatus,
      subtype
    };
  });
  
  return { phones: result, warnings };
}

// Parse emails from various fields
export function parseEmails(row: Record<string, any>): EmailParsed[] {
  const emails: EmailParsed[] = [];
  
  // Business emails
  const businessEmails = splitCsvList(row.BUSINESS_EMAIL || row.business_email);
  const verifiedBusinessEmails = splitCsvList(row.BUSINESS_VERIFIED_EMAILS || row.verified_business_emails || '');
  
  businessEmails.forEach(email => {
    const { normalized, isValid } = normalizeEmail(email);
    if (normalized) {
      emails.push({
        raw: email,
        normalized,
        isValid,
        isVerified: verifiedBusinessEmails.includes(email),
        subtype: 'business'
      });
    }
  });
  
  // Personal emails
  const personalEmails = splitCsvList(row.PERSONAL_EMAIL || row.personal_email);
  const verifiedPersonalEmails = splitCsvList(row.PERSONAL_VERIFIED_EMAILS || row.verified_personal_emails || '');
  
  personalEmails.forEach(email => {
    const { normalized, isValid } = normalizeEmail(email);
    if (normalized) {
      emails.push({
        raw: email,
        normalized,
        isValid,
        isVerified: verifiedPersonalEmails.includes(email),
        subtype: 'personal'
      });
    }
  });
  
  // Verified emails (generic field)
  const verifiedEmails = splitCsvList(row.VERIFIED_EMAILS || row.verified_emails || '');
  verifiedEmails.forEach(email => {
    const { normalized, isValid } = normalizeEmail(email);
    if (normalized && !emails.some(e => e.normalized === normalized)) {
      emails.push({
        raw: email,
        normalized,
        isValid,
        isVerified: true,
        subtype: 'other'
      });
    }
  });
  
  return emails;
}

// Generate checksum for row deduplication
export function generateRowChecksum(row: Record<string, any>): string {
  const sorted = Object.keys(row).sort().reduce((acc, key) => {
    acc[key] = row[key];
    return acc;
  }, {} as Record<string, any>);
  
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// Derive timezone from state
export function deriveTimezone(state: string | null | undefined): string | null {
  if (!state) return null;
  const normalized = state.toUpperCase().trim();
  return STATE_TIMEZONE_MAP[normalized] || null;
}

// Main canonicalization service
export class LeadCanonicalizerService {
  
  // Store raw row (Layer 1)
  async storeRawRow(
    companyId: string, 
    batchId: string, 
    rowNumber: number, 
    rawJson: Record<string, any>,
    parseWarnings: ParseWarning[] | null = null
  ): Promise<{ id: string; skipped: boolean }> {
    const checksum = generateRowChecksum(rawJson);
    
    // Check if row already exists (idempotence)
    const existing = await db.select({ id: leadRawRows.id })
      .from(leadRawRows)
      
.where(and(
        eq(leadRawRows.companyId, companyId),
        eq(leadRawRows.checksum, checksum)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      console.log(`Duplicate row skipped (checksum match): ${checksum.substring(0, 16)}...`);
      return { id: existing[0].id, skipped: true };
    }
    
    const [inserted] = await db.insert(leadRawRows)
      .values({
        companyId,
        batchId,
        rowNumber,
        rawJson,
        checksum,
        parseWarnings: parseWarnings && parseWarnings.length > 0 ? parseWarnings : null
      })
      .returning({ id: leadRawRows.id });
    
    return { id: inserted.id, skipped: false };
  }
  
  // Upsert contact point (Layer 2)
  async upsertContactPoint(
    companyId: string,
    personId: string | null,
    type: 'phone' | 'email',
    subtype: 'mobile' | 'direct' | 'personal' | 'business' | 'other',
    value: string,
    valueRaw: string,
    isValid: boolean,
    dncStatus: 'yes' | 'no' | 'unknown',
    isVerified: boolean,
    batchId: string
  ): Promise<string> {
    // Check if contact point already exists
    const existing = await db.select()
      .from(canonicalContactPoints)
      
.where(and(
        eq(canonicalContactPoints.companyId, companyId),
        eq(canonicalContactPoints.type, type),
        eq(canonicalContactPoints.value, value)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      const existingPoint = existing[0];
      
      // Update if new subtype has higher priority
      const existingPriority = SUBTYPE_PRIORITY[existingPoint.subtype] || 0;
      const newPriority = SUBTYPE_PRIORITY[subtype] || 0;
      
      const updates: Record<string, any> = {
        updatedAt: new Date()
      };
      
      // Update subtype if higher priority
      if (newPriority > existingPriority) {
        updates.subtype = subtype;
      }
      
      // Update person association if not set
      if (!existingPoint.personId && personId) {
        updates.personId = personId;
      }
      
      // Update DNC status if we have more specific info
      if (existingPoint.dncStatus === 'unknown' && dncStatus !== 'unknown') {
        updates.dncStatus = dncStatus;
      }
      
      // Update verification status if newly verified
      if (!existingPoint.isVerified && isVerified) {
        updates.isVerified = true;
      }
      
      await db.update(canonicalContactPoints)
        .set(updates)
        .where(eq(canonicalContactPoints.id, existingPoint.id));
      
      return existingPoint.id;
    }
    
    // Insert new contact point
    const [inserted] = await db.insert(canonicalContactPoints)
      .values({
        companyId,
        personId,
        type,
        subtype,
        value,
        valueRaw,
        isValid,
        isVerified,
        dncStatus,
        optedOut: false,
        source: 'csv_import',
        batchId,
        confidence: isValid ? 70 : 30
      })
      .returning({ id: canonicalContactPoints.id });
    
    return inserted.id;
  }
  
  // Create or find canonical person (Layer 2)
  async upsertCanonicalPerson(
    companyId: string,
    firstName: string | null,
    lastName: string | null,
    row: Record<string, any>,
    rawRowId: string,
    batchId: string
  ): Promise<string> {
    // Try to find existing person by name and location
    if (firstName || lastName) {
      const existing = await db.select()
        .from(canonicalPersons)
        
.where(and(
          eq(canonicalPersons.companyId, companyId),
          sql`lower(${canonicalPersons.firstName}) = lower(${firstName || ''})`,
          sql`lower(${canonicalPersons.lastName}) = lower(${lastName || ''})`
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Update with new batch reference
        await db.update(canonicalPersons)
          .set({ 
            lastBatchId: batchId,
            updatedAt: new Date()
          })
          .where(eq(canonicalPersons.id, existing[0].id));
        
        return existing[0].id;
      }
    }
    
    // Create new person
    const [inserted] = await db.insert(canonicalPersons)
      .values({
        companyId,
        firstName,
        lastName,
        gender: row.GENDER || row.gender || null,
        ageRange: row.AGE_RANGE || row.age_range || null,
        addressLine1: row.ADDRESS || row.address || row.STREET_ADDRESS || null,
        city: row.CITY || row.city || null,
        state: row.STATE || row.state || null,
        zip: row.ZIP || row.zip || row.POSTAL_CODE || null,
        hasChildren: parseBoolean(row.HAS_CHILDREN || row.has_children),
        isHomeowner: parseBoolean(row.IS_HOMEOWNER || row.is_homeowner || row.HOMEOWNER),
        isMarried: parseBoolean(row.IS_MARRIED || row.is_married || row.MARRIED),
        netWorth: row.NET_WORTH || row.net_worth || null,
        incomeRange: row.INCOME_RANGE || row.income_range || row.INCOME || null,
        firstRawRowId: rawRowId,
        lastBatchId: batchId
      })
      .returning({ id: canonicalPersons.id });
    
    return inserted.id;
  }
  
  // Create or find employer company (Layer 2)
  async upsertEmployerCompany(
    companyId: string,
    name: string,
    row: Record<string, any>
  ): Promise<string> {
    const existing = await db.select({ id: canonicalCompanyEntities.id })
      .from(canonicalCompanyEntities)
      
.where(and(
        eq(canonicalCompanyEntities.companyId, companyId),
        sql`lower(${canonicalCompanyEntities.name}) = lower(${name})`
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0].id;
    }
    
    const [inserted] = await db.insert(canonicalCompanyEntities)
      .values({
        companyId,
        name,
        domain: row.COMPANY_DOMAIN || row.company_domain || null,
        industry: row.INDUSTRY || row.industry || null,
        employeeCount: row.EMPLOYEE_COUNT || row.employee_count || null,
        revenue: row.COMPANY_REVENUE || row.company_revenue || null
      })
      .returning({ id: canonicalCompanyEntities.id });
    
    return inserted.id;
  }
  
  // Create person-company relation
  async createPersonCompanyRelation(
    companyId: string,
    personId: string,
    companyEntityId: string,
    row: Record<string, any>
  ): Promise<void> {
    // Check if relation already exists
    const existing = await db.select({ id: personCompanyRelations.id })
      .from(personCompanyRelations)
      .where(and(
        eq(personCompanyRelations.companyId, companyId),
        eq(personCompanyRelations.personId, personId),
        eq(personCompanyRelations.companyEntityId, companyEntityId)
      ))
      .limit(1);
    if (existing.length > 0) return;
    
    await db.insert(personCompanyRelations)
      .values({
        companyId,
        personId,
        companyEntityId,
        jobTitle: row.JOB_TITLE || row.job_title || row.TITLE || null,
        department: row.DEPARTMENT || row.department || null,
        seniority: row.SENIORITY || row.seniority || null
      });
  }
  
  // Process a single CSV row through all 3 layers
  async processRow(
    companyId: string,
    batchId: string,
    rowNumber: number,
    row: Record<string, any>
  ): Promise<{ personId: string | null; contactPointIds: string[]; warnings: ParseWarning[]; skippedDuplicate: boolean }> {
    const allWarnings: ParseWarning[] = [];
    const contactPointIds: string[] = [];
    
    // Layer 1: Store raw row
    const { id: rawRowId, skipped } = await this.storeRawRow(companyId, batchId, rowNumber, row, []);
    
    // If row was skipped due to duplicate checksum, return early
    if (skipped) {
      return { personId: null, contactPointIds: [], warnings: [], skippedDuplicate: true };
    }
    
    // Layer 2: Create canonical person
    const firstName = row.FIRST_NAME || row.first_name || row.FIRST || null;
    const lastName = row.LAST_NAME || row.last_name || row.LAST || null;
    
    const personId = await this.upsertCanonicalPerson(
      companyId, firstName, lastName, row, rawRowId, batchId
    );
    
    // Parse phones with aligned DNC flags
    const directPhones = parsePhoneWithDnc(
      row.DIRECT_NUMBER || row.direct_number,
      row.DIRECT_NUMBER_DNC || row.direct_number_dnc,
      'direct'
    );
    allWarnings.push(...directPhones.warnings);
    
    const mobilePhones = parsePhoneWithDnc(
      row.MOBILE_PHONE || row.mobile_phone,
      row.MOBILE_PHONE_DNC || row.mobile_phone_dnc,
      'mobile'
    );
    allWarnings.push(...mobilePhones.warnings);
    
    const personalPhones = parsePhoneWithDnc(
      row.PERSONAL_PHONE || row.personal_phone,
      row.PERSONAL_PHONE_DNC || row.personal_phone_dnc,
      'personal'
    );
    allWarnings.push(...personalPhones.warnings);
    
    // Upsert all phone contact points
    const allPhones = [...directPhones.phones, ...mobilePhones.phones, ...personalPhones.phones];
    
    for (const phone of allPhones) {
      if (phone.normalized) {
        const cpId = await this.upsertContactPoint(
          companyId,
          personId,
          'phone',
          phone.subtype,
          phone.normalized,
          phone.raw,
          phone.isValid,
          phone.dncStatus,
          false,
          batchId
        );
        contactPointIds.push(cpId);
      }
    }
    
    // Parse and upsert emails
    const emails = parseEmails(row);
    
    for (const email of emails) {
      if (email.normalized) {
        const cpId = await this.upsertContactPoint(
          companyId,
          personId,
          'email',
          email.subtype,
          email.normalized,
          email.raw,
          email.isValid,
          'unknown',
          email.isVerified,
          batchId
        );
        contactPointIds.push(cpId);
      }
    }
    
    // Handle employer company if present
    const employerName = row.COMPANY || row.company || row.COMPANY_NAME || row.company_name;
    if (employerName && employerName.trim()) {
      const companyEntityId = await this.upsertEmployerCompany(companyId, employerName.trim(), row);
      await this.createPersonCompanyRelation(companyId, personId, companyEntityId, row);
    }
    
    // Update raw row with warnings if any
    if (allWarnings.length > 0) {
      await db.update(leadRawRows)
        .set({ parseWarnings: allWarnings })
        .where(eq(leadRawRows.id, rawRowId));
    }
    
    return { personId, contactPointIds, warnings: allWarnings, skippedDuplicate: false };
  }
}

// Helper to parse boolean from various formats
function parseBoolean(val: any): boolean | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase().trim();
  if (['y', 'yes', 'true', '1'].includes(str)) return true;
  if (['n', 'no', 'false', '0'].includes(str)) return false;
  return null;
}

export const leadCanonicalizerService = new LeadCanonicalizerService();
