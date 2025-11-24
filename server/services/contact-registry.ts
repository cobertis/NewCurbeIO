import { storage } from "../storage";
import { formatE164 } from "@shared/phone";
import type { InsertContact, InsertContactSource, Contact, ContactSource } from "@shared/schema";

/**
 * ContactRegistry Service
 * 
 * Manages automatic contact creation and deduplication across all data sources.
 * Creates canonical contact records in the `contacts` table and tracks all
 * sources where each contact appears in the `contact_sources` table.
 * 
 * Features:
 * - Automatic deduplication by phone number and email
 * - Source tracking (quotes, policies, leads, SMS, iMessage)
 * - Multiple contact records per quote/policy (client + spouse + dependents)
 * - Graceful error handling (logs errors without failing main operations)
 */
export class ContactRegistry {
  /**
   * Helper method to upsert a contact
   * Finds existing contact by phone or email, updates if found, inserts if not
   */
  private async upsertContact(data: InsertContact): Promise<Contact> {
    try {
      // Normalize data
      const normalizedData: InsertContact = {
        ...data,
        email: data.email ? data.email.toLowerCase().trim() : undefined,
        phoneNormalized: data.phoneNormalized ? formatE164(data.phoneNormalized) : undefined,
        displayName: data.displayName || 
          (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : undefined),
      };

      // Use storage method to upsert
      return await storage.upsertContact(normalizedData);
    } catch (error: any) {
      console.error("[ContactRegistry] Error upserting contact:", error);
      throw error;
    }
  }

  /**
   * Helper method to create or update a contact source
   */
  private async upsertContactSource(data: InsertContactSource): Promise<void> {
    try {
      await storage.upsertContactSource(data);
    } catch (error: any) {
      console.error("[ContactRegistry] Error upserting contact source:", error);
      throw error;
    }
  }

  /**
   * Extract and upsert contact from a quote (primary client only)
   */
  async upsertContactFromQuote(quoteId: string, companyId: string): Promise<void> {
    try {
      console.log(`[ContactRegistry] Processing quote ${quoteId} for contacts`);

      // Get quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        console.error(`[ContactRegistry] Quote ${quoteId} not found`);
        return;
      }

      // Skip if no contact information
      if (!quote.clientPhone && !quote.clientEmail) {
        console.log(`[ContactRegistry] Skipping quote ${quoteId} - no contact info`);
        return;
      }

      // Create contact record from quote client
      const contactData: InsertContact = {
        companyId,
        firstName: quote.clientFirstName || undefined,
        lastName: quote.clientLastName || undefined,
        email: quote.clientEmail || undefined,
        phoneNormalized: quote.clientPhone ? formatE164(quote.clientPhone) : undefined,
        phoneDisplay: quote.clientPhone || undefined,
      };

      const contact = await this.upsertContact(contactData);

      // Create contact source record
      const sourceData: InsertContactSource = {
        contactId: contact.id,
        companyId,
        sourceType: "quote",
        sourceId: quoteId,
        sourceName: `Quote ${quoteId.substring(0, 8)}`,
        sourceData: {
          quoteId: quote.id,
          firstName: quote.clientFirstName,
          lastName: quote.clientLastName,
          phone: quote.clientPhone,
          email: quote.clientEmail,
          status: quote.status,
        },
      };

      await this.upsertContactSource(sourceData);

      console.log(`[ContactRegistry] Created contact ${contact.id} from quote ${quoteId}`);
    } catch (error: any) {
      console.error(`[ContactRegistry] Error processing quote ${quoteId}:`, error);
      // Don't throw - we want to continue even if contact creation fails
    }
  }

  /**
   * Extract and upsert contact from a policy (primary client only)
   */
  async upsertContactFromPolicy(policyId: string, companyId: string): Promise<void> {
    try {
      console.log(`[ContactRegistry] Processing policy ${policyId} for contacts`);

      // Get policy
      const policy = await storage.getPolicy(policyId);
      if (!policy) {
        console.error(`[ContactRegistry] Policy ${policyId} not found`);
        return;
      }

      // Skip if no contact information
      if (!policy.clientPhone && !policy.clientEmail) {
        console.log(`[ContactRegistry] Skipping policy ${policyId} - no contact info`);
        return;
      }

      // Create contact record from policy client
      const contactData: InsertContact = {
        companyId,
        firstName: policy.clientFirstName || undefined,
        lastName: policy.clientLastName || undefined,
        email: policy.clientEmail || undefined,
        phoneNormalized: policy.clientPhone ? formatE164(policy.clientPhone) : undefined,
        phoneDisplay: policy.clientPhone || undefined,
      };

      const contact = await this.upsertContact(contactData);

      // Create contact source record
      const sourceData: InsertContactSource = {
        contactId: contact.id,
        companyId,
        sourceType: "policy",
        sourceId: policyId,
        sourceName: `Policy ${policyId.substring(0, 8)}`,
        sourceData: {
          policyId: policy.id,
          firstName: policy.clientFirstName,
          lastName: policy.clientLastName,
          phone: policy.clientPhone,
          email: policy.clientEmail,
          status: policy.status,
        },
      };

      await this.upsertContactSource(sourceData);

      console.log(`[ContactRegistry] Created contact ${contact.id} from policy ${policyId}`);
    } catch (error: any) {
      console.error(`[ContactRegistry] Error processing policy ${policyId}:`, error);
      // Don't throw - we want to continue even if contact creation fails
    }
  }

  /**
   * Extract and upsert contact from a landing page lead
   */
  async upsertContactFromLead(leadId: string, companyId: string): Promise<void> {
    try {
      console.log(`[ContactRegistry] Processing lead ${leadId} for contacts`);

      // Get lead
      const lead = await storage.getLandingLead(leadId);
      if (!lead) {
        console.error(`[ContactRegistry] Lead ${leadId} not found`);
        return;
      }

      // Skip if no contact information
      if (!lead.phone && !lead.email) {
        console.log(`[ContactRegistry] Skipping lead ${leadId} - no contact info`);
        return;
      }

      // Create contact record
      const contactData: InsertContact = {
        companyId,
        firstName: lead.firstName || undefined,
        lastName: lead.lastName || undefined,
        email: lead.email || undefined,
        phoneNormalized: lead.phone ? formatE164(lead.phone) : undefined,
        phoneDisplay: lead.phone || undefined,
      };

      const contact = await this.upsertContact(contactData);

      // Get landing page for source name
      const landingPage = await storage.getLandingPageById(lead.landingPageId);
      const sourceName = landingPage ? `Lead from ${landingPage.title}` : `Lead #${leadId.substring(0, 8)}`;

      // Create contact source record
      const sourceData: InsertContactSource = {
        contactId: contact.id,
        companyId,
        sourceType: "lead",
        sourceId: leadId,
        sourceName,
        sourceData: {
          leadId: lead.id,
          landingPageId: lead.landingPageId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone,
          email: lead.email,
          formData: lead.formData,
        },
      };

      await this.upsertContactSource(sourceData);

      console.log(`[ContactRegistry] Created contact ${contact.id} from lead ${leadId}`);
    } catch (error: any) {
      console.error(`[ContactRegistry] Error processing lead ${leadId}:`, error);
      // Don't throw - we want to continue even if contact creation fails
    }
  }

  /**
   * Extract and upsert contact from an inbound SMS message
   */
  async upsertContactFromSms(phoneNumber: string, companyId: string, messageId?: string): Promise<void> {
    try {
      console.log(`[ContactRegistry] Processing SMS from ${phoneNumber} for contacts`);

      // Normalize phone number
      const phoneNormalized = formatE164(phoneNumber);

      // Create contact record with just phone number
      const contactData: InsertContact = {
        companyId,
        phoneNormalized,
        phoneDisplay: phoneNumber,
      };

      const contact = await this.upsertContact(contactData);

      // Create contact source record
      const sourceData: InsertContactSource = {
        contactId: contact.id,
        companyId,
        sourceType: "sms_inbound",
        sourceId: messageId || phoneNormalized,
        sourceName: `SMS from ${phoneNumber}`,
        sourceData: {
          phoneNumber,
          phoneNormalized,
          messageId,
        },
      };

      await this.upsertContactSource(sourceData);

      console.log(`[ContactRegistry] Created contact ${contact.id} from SMS ${phoneNumber}`);
    } catch (error: any) {
      console.error(`[ContactRegistry] Error processing SMS from ${phoneNumber}:`, error);
      // Don't throw - we want to continue even if contact creation fails
    }
  }

  /**
   * Extract and upsert contact from an inbound iMessage
   */
  async upsertContactFromImessage(handle: string, companyId: string, messageId?: string): Promise<void> {
    try {
      console.log(`[ContactRegistry] Processing iMessage from ${handle} for contacts`);

      // Determine if handle is email or phone
      const isEmail = handle.includes('@');
      const contactData: InsertContact = {
        companyId,
      };

      if (isEmail) {
        contactData.email = handle.toLowerCase().trim();
      } else {
        // Assume it's a phone number
        contactData.phoneNormalized = formatE164(handle);
        contactData.phoneDisplay = handle;
      }

      const contact = await this.upsertContact(contactData);

      // Create contact source record
      const sourceData: InsertContactSource = {
        contactId: contact.id,
        companyId,
        sourceType: "imessage_inbound",
        sourceId: messageId || handle,
        sourceName: `iMessage from ${handle}`,
        sourceData: {
          handle,
          messageId,
        },
      };

      await this.upsertContactSource(sourceData);

      console.log(`[ContactRegistry] Created contact ${contact.id} from iMessage ${handle}`);
    } catch (error: any) {
      console.error(`[ContactRegistry] Error processing iMessage from ${handle}:`, error);
      // Don't throw - we want to continue even if contact creation fails
    }
  }

  /**
   * Backfill contacts from all existing policies in a company
   * Used for migrating existing data to the unified contacts system
   */
  async backfillContactsFromPolicies(companyId: string): Promise<{ processed: number; created: number; errors: number }> {
    console.log(`[ContactRegistry] Starting policy backfill for company ${companyId}`);
    
    let processed = 0;
    let created = 0;
    let errors = 0;
    
    try {
      // Get all policies for the company using the storage layer
      const policies = await storage.getPoliciesByCompany(companyId);
      console.log(`[ContactRegistry] Found ${policies.length} policies to process`);
      
      // Process each policy
      for (const policy of policies) {
        try {
          const contactsBefore = await storage.getContacts(companyId, { limit: 1, offset: 0 });
          await this.upsertContactFromPolicy(policy.id, companyId);
          const contactsAfter = await storage.getContacts(companyId, { limit: 1, offset: 0 });
          
          processed++;
          if (contactsAfter.total > contactsBefore.total) {
            created++;
          }
          
          // Log progress every 10 policies
          if (processed % 10 === 0) {
            console.log(`[ContactRegistry] Backfill progress: ${processed}/${policies.length} policies processed, ${created} contacts created`);
          }
        } catch (error: any) {
          console.error(`[ContactRegistry] Error processing policy ${policy.id}:`, error);
          errors++;
        }
      }
      
      console.log(`[ContactRegistry] Backfill complete: ${processed} policies processed, ${created} contacts created, ${errors} errors`);
      return { processed, created, errors };
    } catch (error: any) {
      console.error(`[ContactRegistry] Fatal error during backfill:`, error);
      throw error;
    }
  }

  /**
   * Auto-backfill contacts for all companies on startup
   * Runs if contacts are significantly fewer than policies (ratio > 5:1)
   */
  async autoBackfillOnStartup(): Promise<void> {
    try {
      console.log('[ContactRegistry] Checking if auto-backfill is needed...');
      
      // Get all companies
      const companies = await storage.getAllCompanies();
      
      for (const company of companies) {
        try {
          // Check if company has contacts
          const contacts = await storage.getContacts(company.id, { limit: 1, offset: 0 });
          
          // Check if company has policies
          const policies = await storage.getPoliciesByCompany(company.id);
          
          // Run backfill if:
          // 1. No contacts but has policies, OR
          // 2. Policies are 5x more than contacts (indicates missing contact data)
          const needsBackfill = 
            (contacts.total === 0 && policies.length > 0) ||
            (policies.length > 0 && policies.length > contacts.total * 5);
          
          if (needsBackfill) {
            console.log(`[ContactRegistry] Auto-backfill starting for company ${company.id} (${company.name}) - ${policies.length} policies, ${contacts.total} contacts (ratio ${(policies.length / Math.max(contacts.total, 1)).toFixed(1)}:1)`);
            const result = await this.backfillContactsFromPolicies(company.id);
            console.log(`[ContactRegistry] Auto-backfill complete for ${company.name}: ${result.created} contacts created from ${result.processed} policies`);
          } else {
            console.log(`[ContactRegistry] Skipping auto-backfill for company ${company.id} (${company.name}) - ${contacts.total} contacts, ${policies.length} policies (ratio ${(policies.length / Math.max(contacts.total, 1)).toFixed(1)}:1)`);
          }
        } catch (error: any) {
          console.error(`[ContactRegistry] Error during auto-backfill for company ${company.id}:`, error);
          // Continue with other companies
        }
      }
      
      console.log('[ContactRegistry] Auto-backfill check complete');
    } catch (error: any) {
      console.error('[ContactRegistry] Fatal error during auto-backfill startup:', error);
      // Don't throw - we don't want to crash the server
    }
  }
}

// Export singleton instance
export const contactRegistry = new ContactRegistry();
