import type { IStorage } from "../storage";
import { storage } from "../storage";
import type { BlacklistEntry } from "@shared/schema";
import { formatForStorage } from "@shared/phone";

// TODO: Add LRU cache for blacklist lookups to improve performance
// Cache key: `${companyId}:${channel}:${normalizedIdentifier}`
// TTL: 60 seconds, invalidate on add/remove operations

/**
 * Centralized Blacklist Service
 * 
 * Provides a unified interface for managing blacklisted contacts across all channels.
 * Handles normalization, validation, and provides convenient methods for blacklist operations.
 */
export class BlacklistService {
  constructor(private storage: IStorage) {}

  /**
   * Normalize identifier based on channel type
   * 
   * @param channel - The communication channel (sms, imessage, email, all)
   * @param identifier - The identifier to normalize (phone number or email)
   * @returns Normalized identifier
   * 
   * @private
   */
  private normalizeIdentifier(channel: string, identifier: string): string {
    // For SMS and iMessage: use E.164 format (11 digits with "1" prefix)
    if (channel === "sms" || channel === "imessage") {
      return formatForStorage(identifier);
    }
    
    // For email: lowercase and trim
    if (channel === "email") {
      return identifier.toLowerCase().trim();
    }
    
    // For "all" or any other channel: just trim
    return identifier.trim();
  }

  /**
   * Check if an identifier is blacklisted
   * 
   * Checks both channel-specific and channel="all" blacklist entries.
   * Automatically normalizes the identifier based on the channel type.
   * 
   * @param params - Parameters for blacklist check
   * @param params.companyId - Company ID to check within
   * @param params.channel - Communication channel (sms, imessage, email)
   * @param params.identifier - The identifier to check (phone number or email)
   * @returns Promise<boolean> - true if blacklisted, false otherwise
   * 
   * @example
   * const isBlocked = await blacklistService.isBlacklisted({
   *   companyId: "company-123",
   *   channel: "sms",
   *   identifier: "+1 (305) 488-3848"
   * });
   */
  async isBlacklisted(params: {
    companyId: string;
    channel: "sms" | "imessage" | "email";
    identifier: string;
  }): Promise<boolean> {
    console.log(`[BLACKLIST] Checking if ${params.identifier} is blacklisted on ${params.channel} for company ${params.companyId}`);
    
    const normalizedIdentifier = this.normalizeIdentifier(params.channel, params.identifier);
    
    const result = await this.storage.isBlacklisted({
      companyId: params.companyId,
      channel: params.channel,
      identifier: normalizedIdentifier,
    });
    
    console.log(`[BLACKLIST] Result: ${result ? 'BLACKLISTED' : 'NOT BLACKLISTED'}`);
    return result;
  }

  /**
   * Assert that an identifier is not blacklisted
   * 
   * Throws an error if the identifier is blacklisted, otherwise returns void.
   * Use this in outbound message endpoints to enforce blacklist checks.
   * 
   * @param params - Parameters for blacklist check
   * @param params.companyId - Company ID to check within
   * @param params.channel - Communication channel (sms, imessage, email)
   * @param params.identifier - The identifier to check (phone number or email)
   * @throws Error if the identifier is blacklisted
   * @returns Promise<void>
   * 
   * @example
   * await blacklistService.assertNotBlacklisted({
   *   companyId: "company-123",
   *   channel: "sms",
   *   identifier: "+1 (305) 488-3848"
   * });
   * // If blacklisted, throws: "Cannot send: +1 (305) 488-3848 is blacklisted on sms"
   */
  async assertNotBlacklisted(params: {
    companyId: string;
    channel: "sms" | "imessage" | "email";
    identifier: string;
  }): Promise<void> {
    const isBlocked = await this.isBlacklisted(params);
    
    if (isBlocked) {
      const normalizedIdentifier = this.normalizeIdentifier(params.channel, params.identifier);
      console.error(`[BLACKLIST] Blocked send attempt to blacklisted ${params.channel} identifier: ${normalizedIdentifier}`);
      throw new Error(`Cannot send: ${params.identifier} is blacklisted on ${params.channel}`);
    }
  }

  /**
   * Add an identifier to the blacklist
   * 
   * Automatically normalizes the identifier based on the channel type.
   * Creates an audit trail with reason, added by user, source message, etc.
   * 
   * @param params - Parameters for adding to blacklist
   * @param params.companyId - Company ID
   * @param params.channel - Communication channel (sms, imessage, email, all)
   * @param params.identifier - The identifier to blacklist (phone number or email)
   * @param params.reason - Reason for blacklisting (stop, manual, bounced, complaint)
   * @param params.addedBy - User ID who added this entry (optional)
   * @param params.sourceMessageId - ID of the message that triggered this (optional)
   * @param params.notes - Additional notes (optional)
   * @param params.metadata - Additional metadata (optional)
   * @returns Promise<BlacklistEntry> - The created blacklist entry
   * 
   * @example
   * const entry = await blacklistService.addToBlacklist({
   *   companyId: "company-123",
   *   channel: "sms",
   *   identifier: "+1 (305) 488-3848",
   *   reason: "stop",
   *   addedBy: "user-456"
   * });
   */
  async addToBlacklist(params: {
    companyId: string;
    channel: "sms" | "imessage" | "email" | "all";
    identifier: string;
    reason: "stop" | "manual" | "bounced" | "complaint";
    addedBy?: string;
    sourceMessageId?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }): Promise<BlacklistEntry> {
    const normalizedIdentifier = this.normalizeIdentifier(params.channel, params.identifier);
    
    console.log(`[BLACKLIST] Adding ${normalizedIdentifier} to blacklist on ${params.channel} for company ${params.companyId} (reason: ${params.reason})`);
    
    const entry = await this.storage.addToBlacklist({
      companyId: params.companyId,
      channel: params.channel,
      identifier: normalizedIdentifier,
      reason: params.reason,
      addedBy: params.addedBy,
      sourceMessageId: params.sourceMessageId,
      notes: params.notes,
      metadata: params.metadata,
    });
    
    console.log(`[BLACKLIST] Successfully added entry ${entry.id}`);
    return entry;
  }

  /**
   * Remove an identifier from the blacklist
   * 
   * Marks the blacklist entry as inactive rather than deleting it.
   * Automatically normalizes the identifier based on the channel type.
   * 
   * @param params - Parameters for removing from blacklist
   * @param params.companyId - Company ID
   * @param params.channel - Communication channel
   * @param params.identifier - The identifier to remove (phone number or email)
   * @param params.removedBy - User ID who removed this entry (optional)
   * @returns Promise<boolean> - true if removed successfully, false if not found
   * 
   * @example
   * const removed = await blacklistService.removeFromBlacklist({
   *   companyId: "company-123",
   *   channel: "sms",
   *   identifier: "+1 (305) 488-3848",
   *   removedBy: "user-456"
   * });
   */
  async removeFromBlacklist(params: {
    companyId: string;
    channel: string;
    identifier: string;
    removedBy?: string;
  }): Promise<boolean> {
    const normalizedIdentifier = this.normalizeIdentifier(params.channel, params.identifier);
    
    console.log(`[BLACKLIST] Removing ${normalizedIdentifier} from blacklist on ${params.channel} for company ${params.companyId}`);
    
    const result = await this.storage.removeFromBlacklist({
      companyId: params.companyId,
      channel: params.channel,
      identifier: normalizedIdentifier,
      removedBy: params.removedBy,
    });
    
    console.log(`[BLACKLIST] Removal result: ${result ? 'SUCCESS' : 'NOT FOUND'}`);
    return result;
  }

  /**
   * Get blacklist entries with optional filters
   * 
   * Retrieves paginated blacklist entries for a company with optional filtering.
   * 
   * @param companyId - Company ID to filter by
   * @param filters - Optional filters
   * @param filters.channel - Filter by specific channel
   * @param filters.isActive - Filter by active/inactive status
   * @param filters.search - Search term for identifier
   * @param filters.page - Page number for pagination (1-indexed)
   * @param filters.limit - Number of entries per page
   * @returns Promise<{ entries: BlacklistEntry[], total: number }> - Paginated entries and total count
   * 
   * @example
   * const { entries, total } = await blacklistService.getBlacklistEntries("company-123", {
   *   channel: "sms",
   *   isActive: true,
   *   page: 1,
   *   limit: 50
   * });
   */
  async getBlacklistEntries(
    companyId: string,
    filters?: {
      channel?: string;
      isActive?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ entries: BlacklistEntry[]; total: number }> {
    console.log(`[BLACKLIST] Retrieving blacklist entries for company ${companyId}`, filters);
    
    const result = await this.storage.getBlacklistEntries(companyId, filters);
    
    console.log(`[BLACKLIST] Retrieved ${result.entries.length} of ${result.total} total entries`);
    return result;
  }
}

/**
 * Singleton instance of BlacklistService
 * 
 * Use this instance throughout the application for consistent blacklist management.
 * 
 * @example
 * import { blacklistService } from "./services/blacklist-service";
 * 
 * // Check if blacklisted
 * const isBlocked = await blacklistService.isBlacklisted({
 *   companyId: "company-123",
 *   channel: "sms",
 *   identifier: "+1 (305) 488-3848"
 * });
 * 
 * // Throw if blacklisted
 * await blacklistService.assertNotBlacklisted({
 *   companyId: "company-123",
 *   channel: "email",
 *   identifier: "user@example.com"
 * });
 */
export const blacklistService = new BlacklistService(storage);
