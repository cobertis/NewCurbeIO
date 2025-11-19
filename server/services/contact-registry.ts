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
   * Extract and upsert contacts from a quote
   * Creates contact records for the client and all quote members
   */
  async upsertContactFromQuote(quoteId: string, companyId: string): Promise<void> {
    try {
      console.log(`[ContactRegistry] Processing quote ${quoteId} for contacts`);

      // Get quote with all members
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        console.error(`[ContactRegistry] Quote ${quoteId} not found`);
        return;
      }

      // Get quote members
      const members = await storage.listQuoteMembers(quoteId, companyId);

      // Process each member (including the primary client)
      for (const member of members) {
        try {
          // Skip members without contact information
          if (!member.phone && !member.email) {
            console.log(`[ContactRegistry] Skipping quote member ${member.id} - no contact info`);
            continue;
          }

          // Create contact record
          const contactData: InsertContact = {
            companyId,
            firstName: member.firstName || undefined,
            lastName: member.lastName || undefined,
            email: member.email || undefined,
            phoneNormalized: member.phone ? formatE164(member.phone) : undefined,
            phoneDisplay: member.phone || undefined,
          };

          const contact = await this.upsertContact(contactData);

          // Create contact source record
          const sourceData: InsertContactSource = {
            contactId: contact.id,
            companyId,
            sourceType: "quote",
            sourceId: quoteId,
            sourceName: `Quote #${quote.quoteNumber || quoteId.substring(0, 8)}`,
            sourceData: {
              quoteMemberId: member.id,
              role: member.role,
              firstName: member.firstName,
              lastName: member.lastName,
              phone: member.phone,
              email: member.email,
              dateOfBirth: member.dateOfBirth,
            },
          };

          await this.upsertContactSource(sourceData);

          console.log(`[ContactRegistry] Created contact ${contact.id} from quote member ${member.id}`);
        } catch (error: any) {
          console.error(`[ContactRegistry] Error processing quote member ${member.id}:`, error);
          // Continue processing other members
        }
      }

      console.log(`[ContactRegistry] Completed processing quote ${quoteId}`);
    } catch (error: any) {
      console.error(`[ContactRegistry] Error processing quote ${quoteId}:`, error);
      // Don't throw - we want to continue even if contact creation fails
    }
  }

  /**
   * Extract and upsert contacts from a policy
   * Creates contact records for the client and all policy members
   */
  async upsertContactFromPolicy(policyId: string, companyId: string): Promise<void> {
    try {
      console.log(`[ContactRegistry] Processing policy ${policyId} for contacts`);

      // Get policy with all members
      const policy = await storage.getPolicy(policyId);
      if (!policy) {
        console.error(`[ContactRegistry] Policy ${policyId} not found`);
        return;
      }

      // Get policy members
      const members = await storage.listPolicyMembers(policyId, companyId);

      // Process each member (including the primary client)
      for (const member of members) {
        try {
          // Skip members without contact information
          if (!member.phone && !member.email) {
            console.log(`[ContactRegistry] Skipping policy member ${member.id} - no contact info`);
            continue;
          }

          // Create contact record
          const contactData: InsertContact = {
            companyId,
            firstName: member.firstName || undefined,
            lastName: member.lastName || undefined,
            email: member.email || undefined,
            phoneNormalized: member.phone ? formatE164(member.phone) : undefined,
            phoneDisplay: member.phone || undefined,
          };

          const contact = await this.upsertContact(contactData);

          // Create contact source record
          const sourceData: InsertContactSource = {
            contactId: contact.id,
            companyId,
            sourceType: "policy",
            sourceId: policyId,
            sourceName: `Policy #${policy.policyNumber || policyId.substring(0, 8)}`,
            sourceData: {
              policyMemberId: member.id,
              role: member.role,
              firstName: member.firstName,
              lastName: member.lastName,
              phone: member.phone,
              email: member.email,
              dateOfBirth: member.dateOfBirth,
            },
          };

          await this.upsertContactSource(sourceData);

          console.log(`[ContactRegistry] Created contact ${contact.id} from policy member ${member.id}`);
        } catch (error: any) {
          console.error(`[ContactRegistry] Error processing policy member ${member.id}:`, error);
          // Continue processing other members
        }
      }

      console.log(`[ContactRegistry] Completed processing policy ${policyId}`);
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
}

// Export singleton instance
export const contactRegistry = new ContactRegistry();
