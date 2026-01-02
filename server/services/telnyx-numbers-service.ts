import { db } from "../db";
import { wallets, companies, telnyxPhoneNumbers, telephonySettings, users, telnyxE911Addresses } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import { SecretsService } from "./secrets-service";
import { assignPhoneNumberToCredentialConnection } from "./telnyx-e911-service";
import { getCompanyTelnyxAccountId, getCompanyTelnyxApiToken } from "./wallet-service";
import { getCompanyMessagingProfileId } from "./telnyx-manager-service";
import { loadGlobalPricing } from "./pricing-config";

// Helper to check if a phone number is toll-free based on its number or type
function isTollFreeNumber(phoneNumber: string, numberType?: string | null): boolean {
  if (numberType === 'toll_free') return true;
  const tollFreeAreaCodes = ['800', '833', '844', '855', '866', '877', '888'];
  const digits = phoneNumber.replace(/\D/g, '');
  const areaCode = digits.startsWith('1') ? digits.substring(1, 4) : digits.substring(0, 3);
  return tollFreeAreaCodes.includes(areaCode);
}

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const secretsService = new SecretsService();

export async function getTelnyxMasterApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured. Please add it in Settings > API Keys.");
  }
  // Trim whitespace and remove any invisible characters
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
  console.log(`[Telnyx] API key loaded, prefix: ${apiKey.substring(0, 10)}..., length: ${apiKey.length}, last char code: ${apiKey.charCodeAt(apiKey.length - 1)}`);
  return apiKey;
}

// Helper function to check if managed account header should be included
// Returns null if MASTER_ACCOUNT (use main account), otherwise returns the account ID
export function getManagedAccountHeader(accountId: string | null | undefined): string | null {
  if (!accountId || accountId === "MASTER_ACCOUNT") {
    return null;
  }
  return accountId;
}


export interface AvailablePhoneNumber {
  phone_number: string;
  record_type: string;
  phone_number_type?: string;
  best_effort: boolean;
  reservable: boolean;
  cost_information: {
    currency: string;
    monthly_cost: string;
    upfront_cost: string;
  };
  features: Array<{ name: string }>;
  region_information: Array<{
    region_name: string;
    region_type: string;
  }>;
}

export interface SearchNumbersParams {
  country_code?: string;
  phone_number_type?: "local" | "toll_free" | "national" | "mobile";
  locality?: string;
  administrative_area?: string;
  national_destination_code?: string;
  starts_with?: string;
  ends_with?: string;
  contains?: string;
  features?: string[];
  limit?: number;
  page?: number;
}

export interface SearchNumbersResult {
  success: boolean;
  numbers?: AvailablePhoneNumber[];
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  error?: string;
}

export async function searchAvailableNumbers(params: SearchNumbersParams): Promise<SearchNumbersResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const buildQueryParams = (useBestEffort: boolean): URLSearchParams => {
      const queryParams = new URLSearchParams();
      
      if (params.country_code) {
        queryParams.append("filter[country_code]", params.country_code);
      } else {
        queryParams.append("filter[country_code]", "US");
      }
      
      if (params.phone_number_type) {
        queryParams.append("filter[phone_number_type]", params.phone_number_type);
      }
      
      if (params.locality) {
        queryParams.append("filter[locality]", params.locality);
      }
      
      if (params.administrative_area) {
        queryParams.append("filter[administrative_area]", params.administrative_area);
      }
      
      if (params.national_destination_code) {
        queryParams.append("filter[national_destination_code]", params.national_destination_code);
      }
      
      if (params.starts_with) {
        queryParams.append("filter[phone_number][starts_with]", params.starts_with);
      }
      
      if (params.ends_with) {
        queryParams.append("filter[phone_number][ends_with]", params.ends_with);
      }
      
      if (params.contains) {
        queryParams.append("filter[phone_number][contains]", params.contains);
      }
      
      if (params.features && params.features.length > 0) {
        params.features.forEach(feature => {
          queryParams.append("filter[features][]", feature);
        });
      }
      
      // Only add best_effort when explicitly needed
      if (useBestEffort) {
        queryParams.append("filter[best_effort]", "true");
      }
      
      // Use page[size] and page[number] for proper pagination
      const pageSize = params.limit || 50;
      const pageNumber = params.page || 1;
      queryParams.append("page[size]", String(pageSize));
      queryParams.append("page[number]", String(pageNumber));
      
      return queryParams;
    };

    const pageSize = params.limit || 50;
    const pageNumber = params.page || 1;
    
    // First try WITHOUT best_effort to get exact matches
    let queryParams = buildQueryParams(false);
    console.log(`[Telnyx Numbers] Searching exact match on page ${pageNumber}: ${queryParams.toString()}`);

    let response = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    // If exact search fails with 10031 error or returns no results, try with best_effort
    let result: any;
    let usedBestEffort = false;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Telnyx Numbers] Exact search returned error: ${response.status}, trying best_effort...`);
      
      // Try with best_effort=true as fallback
      queryParams = buildQueryParams(true);
      console.log(`[Telnyx Numbers] Searching with best_effort: ${queryParams.toString()}`);
      
      response = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${queryParams.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
      });
      
      if (!response.ok) {
        const fallbackError = await response.text();
        console.error(`[Telnyx Numbers] Best effort search also failed: ${response.status} - ${fallbackError}`);
        return {
          success: false,
          error: `No numbers available for the specified criteria`,
        };
      }
      
      usedBestEffort = true;
    }
    
    result = await response.json();
    
    // Check if we got empty results without best_effort
    if (!usedBestEffort && (!result.data || result.data.length === 0)) {
      console.log(`[Telnyx Numbers] No exact matches found, trying best_effort...`);
      
      queryParams = buildQueryParams(true);
      response = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${queryParams.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
      });
      
      if (response.ok) {
        result = await response.json();
        usedBestEffort = true;
      }
    }
    
    const meta = result.meta || {};
    const exactCount = usedBestEffort ? 0 : (result.data?.length || 0);
    const bestEffortCount = usedBestEffort ? (result.data?.length || 0) : 0;
    
    console.log(`[Telnyx Numbers] Found ${result.data?.length || 0} numbers (${exactCount} exact, ${bestEffortCount} best_effort) on page ${meta.page_number || pageNumber}`);

    // Filter out premium/vanity toll-free numbers with high Telnyx cost
    // Standard toll-free numbers cost ~$1.50/mo, premium ones cost $540+
    const TOLL_FREE_PREFIXES = ["+1800", "+1833", "+1844", "+1855", "+1866", "+1877", "+1888"];
    const MAX_TOLL_FREE_TELNYX_COST = 2.00;
    
    let filteredNumbers = result.data || [];
    const originalCount = filteredNumbers.length;
    
    filteredNumbers = filteredNumbers.filter((num: any) => {
      const phoneNumber = num.phone_number || "";
      const isTollFree = TOLL_FREE_PREFIXES.some(prefix => phoneNumber.startsWith(prefix));
      
      if (!isTollFree) return true; // Keep all non-toll-free numbers
      
      // Check Telnyx cost for toll-free numbers
      const monthlyRecurring = parseFloat(num.cost_information?.monthly_cost || num.monthly_recurring_cost || "0");
      const upfrontCost = parseFloat(num.cost_information?.upfront_cost || "0");
      const telnyxCost = monthlyRecurring + upfrontCost;
      
      if (telnyxCost > MAX_TOLL_FREE_TELNYX_COST) {
        console.log(`[Telnyx Numbers] Filtering out premium toll-free ${phoneNumber} (Telnyx cost: $${telnyxCost.toFixed(2)})`);
        return false;
      }
      
      return true;
    });
    
    if (originalCount !== filteredNumbers.length) {
      console.log(`[Telnyx Numbers] Filtered ${originalCount - filteredNumbers.length} premium toll-free numbers (cost > $${MAX_TOLL_FREE_TELNYX_COST})`);
    }

    return {
      success: true,
      numbers: filteredNumbers,
      totalCount: meta.total_results,
      currentPage: meta.page_number || pageNumber,
      totalPages: meta.total_pages || 1,
      pageSize: meta.page_size || pageSize,
    };
  } catch (error) {
    console.error("[Telnyx Numbers] Search error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search numbers",
    };
  }
}

export interface PurchaseNumberResult {
  success: boolean;
  orderId?: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  error?: string;
}

export async function purchasePhoneNumber(
  phoneNumber: string, 
  companyId: string
): Promise<PurchaseNumberResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    // Get the company's shared Telnyx managed account ID
    const managedAccountId = await getCompanyTelnyxAccountId(companyId);

    if (!managedAccountId) {
      return {
        success: false,
        error: "Company Telnyx account not found. Please setup phone system first.",
      };
    }
    
    console.log(`[Telnyx Numbers] Purchasing ${phoneNumber} for company ${companyId}${managedAccountId ? ` (managed account: ${managedAccountId})` : ''}`);

    // Build headers - include managed account header if available
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["x-managed-account-id"] = managedAccountId;
    }

    const response = await fetch(`${TELNYX_API_BASE}/number_orders`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone_numbers: [
          { phone_number: phoneNumber }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Numbers] Purchase error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to purchase number: ${response.status}`,
      };
    }

    const result = await response.json();
    
    console.log(`[Telnyx Numbers] Number order created:`, JSON.stringify(result.data, null, 2));

    const orderId = result.data?.id;
    const orderStatus = result.data?.status;
    
    // Extract phone number ID from the order response
    // The phone_numbers array contains objects with phone_number and id
    const phoneNumbers = result.data?.phone_numbers || [];
    const purchasedNumber = phoneNumbers.find((pn: any) => pn.phone_number === phoneNumber);
    let phoneNumberId = purchasedNumber?.id;

    console.log(`[Telnyx Numbers] Number order created - Order ID: ${orderId}, Status: ${orderStatus}, Initial Phone Number ID: ${phoneNumberId}`);

    // If order is success or pending, poll to get the actual phone number ID from phone_numbers API
    // The ID from number_order may be different from the actual phone_number ID
    // Use retry with exponential backoff since Telnyx provisioning is async
    if (orderStatus === "success" || orderStatus === "pending") {
      const maxRetries = 5;
      const delays = [2000, 3000, 5000, 8000, 10000]; // Exponential backoff delays
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        
        try {
          console.log(`[Telnyx Numbers] Attempt ${attempt + 1}/${maxRetries} to fetch phone number ID for ${phoneNumber}`);
          
          // Search for the number in the account to get its real ID
          const searchResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers?filter[phone_number][eq]=${encodeURIComponent(phoneNumber)}`, {
            method: "GET",
            headers,
          });
          
          if (searchResponse.ok) {
            const searchResult = await searchResponse.json();
            const foundNumber = searchResult.data?.find((n: any) => n.phone_number === phoneNumber);
            if (foundNumber?.id) {
              phoneNumberId = foundNumber.id;
              console.log(`[Telnyx Numbers] Found actual phone number ID: ${phoneNumberId} on attempt ${attempt + 1}`);
              break; // Success, exit retry loop
            }
          }
          
          // If we haven't found it and this isn't the last attempt, continue retrying
          if (attempt < maxRetries - 1) {
            console.log(`[Telnyx Numbers] Phone number not yet available, retrying...`);
          }
        } catch (searchError) {
          console.warn(`[Telnyx Numbers] Error on attempt ${attempt + 1}:`, searchError);
          if (attempt === maxRetries - 1) {
            console.warn(`[Telnyx Numbers] Could not fetch phone number ID after ${maxRetries} attempts, will use order ID: ${phoneNumberId}`);
          }
        }
      }
    }

    console.log(`[Telnyx Numbers] Number purchased successfully - Order ID: ${orderId}, Final Phone Number ID: ${phoneNumberId}`);

    // Assign the phone number to the credential connection for outbound WebRTC calls
    if (phoneNumberId) {
      console.log(`[Telnyx Numbers] Assigning phone number to credential connection...`);
      try {
        const assignResult = await assignPhoneNumberToCredentialConnection(companyId, phoneNumberId);
        if (assignResult.success) {
          console.log(`[Telnyx Numbers] Phone number assigned to credential connection: ${assignResult.connectionId}`);
        } else {
          console.warn(`[Telnyx Numbers] Failed to assign credential connection (non-fatal): ${assignResult.error}`);
        }
      } catch (assignError) {
        console.warn(`[Telnyx Numbers] Error assigning credential connection (non-fatal):`, assignError);
      }
      
      // Assign the phone number to the messaging profile for SMS/MMS
      console.log(`[Telnyx Numbers] Assigning phone number to messaging profile...`);
      try {
        const messagingProfileId = await getCompanyMessagingProfileId(companyId);
        if (messagingProfileId) {
          const patchResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              messaging_profile_id: messagingProfileId,
            }),
          });
          
          if (patchResponse.ok) {
            console.log(`[Telnyx Numbers] Phone number assigned to messaging profile: ${messagingProfileId}`);
          } else {
            const errorText = await patchResponse.text();
            console.warn(`[Telnyx Numbers] Failed to assign messaging profile (non-fatal): ${patchResponse.status} - ${errorText}`);
          }
        } else {
          console.warn(`[Telnyx Numbers] No messaging profile found for company ${companyId} - SMS may not work`);
        }
      } catch (msgError) {
        console.warn(`[Telnyx Numbers] Error assigning messaging profile (non-fatal):`, msgError);
      }
    }

    return {
      success: true,
      orderId: orderId,
      phoneNumber: phoneNumber,
      phoneNumberId: phoneNumberId,
    };
  } catch (error) {
    console.error("[Telnyx Numbers] Purchase error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to purchase number",
    };
  }
}

/**
 * Validates a CNAM listing name
 * Rules: Max 15 characters, alphanumeric + spaces only
 */
export function validateCnamName(name: string): { valid: boolean; error?: string; sanitized?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: "CNAM name is required" };
  }
  
  // Remove any non-alphanumeric characters except spaces
  const sanitized = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  
  if (sanitized.length === 0) {
    return { valid: false, error: "CNAM name must contain at least one alphanumeric character" };
  }
  
  if (sanitized.length > 15) {
    return { valid: false, error: "CNAM name cannot exceed 15 characters" };
  }
  
  return { valid: true, sanitized };
}

/**
 * Truncates company name to fit CNAM 15-character limit
 */
export function truncateForCnam(companyName: string): string {
  if (!companyName) return "";
  
  // Remove special characters, keep only alphanumeric + spaces
  const sanitized = companyName.replace(/[^a-zA-Z0-9 ]/g, '');
  
  // Trim leading/trailing spaces, then truncate to 15 characters
  // Only trim at the start, keep natural spacing
  const trimmedStart = sanitized.trimStart();
  
  // Truncate to 15 characters, then trim trailing space if at boundary
  return trimmedStart.substring(0, 15).trimEnd();
}

export interface CnamUpdateResult {
  success: boolean;
  error?: string;
  cnamEnabled?: boolean;
  cnamName?: string;
}

/**
 * Enable or update CNAM listing on a phone number
 */
export async function updateCnamListing(
  phoneNumberId: string,
  companyId: string,
  enabled: boolean,
  cnamName?: string
): Promise<CnamUpdateResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Get the company's shared Telnyx account ID
    const telnyxAccountId = await getCompanyTelnyxAccountId(companyId);
    
    if (!telnyxAccountId) {
      return {
        success: false,
        error: "Company Telnyx account not found"
      };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(telnyxAccountId && telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": telnyxAccountId} : {}),
    };
    
    // Get the actual cnam_listing_details value
    let cnamDetails: string | undefined;
    if (enabled) {
      // If no name provided, try to get company name as fallback
      if (!cnamName) {
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, companyId));
        cnamDetails = company?.name ? truncateForCnam(company.name) : undefined;
      } else {
        const validation = validateCnamName(cnamName);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
        cnamDetails = validation.sanitized;
      }
      
      // Telnyx requires BOTH fields when enabling CNAM
      if (!cnamDetails) {
        return { success: false, error: "CNAM name is required when enabling CNAM listing" };
      }
    }
    
    // CORRECT ENDPOINT: /v2/phone_numbers/{id}/voice (NOT /v2/phone_numbers/{id})
    // The phone_numbers/{id} endpoint has readOnly CNAM fields that are ignored
    // Voice settings endpoint is where CNAM is actually configurable
    
    // Build the payload for voice settings endpoint
    const payload = {
      cnam_listing: {
        cnam_listing_enabled: enabled,
        ...(enabled && cnamDetails ? { cnam_listing_details: cnamDetails.toUpperCase() } : {}),
      },
    };
    
    console.log(`[Telnyx CNAM] Using V2 Voice Settings API. Number ID: ${phoneNumberId}, enabled=${enabled}, name="${cnamDetails || 'N/A'}", payload:`, JSON.stringify(payload));
    
    // PATCH /v2/phone_numbers/{phone_number_id}/voice
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx CNAM Voice] Update error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to update CNAM: ${response.status} - ${errorText}`,
      };
    }
    
    const result = await response.json();
    console.log(`[Telnyx CNAM Voice] Update successful:`, JSON.stringify(result.data, null, 2));
    
    // Extract CNAM settings from the voice settings response
    const cnamListing = result.data?.cnam_listing;
    const finalCnamName = cnamListing?.cnam_listing_details ?? cnamDetails;
    
    // Save the CNAM to local database (both fields for compatibility)
    try {
      await db
        .update(telnyxPhoneNumbers)
        .set({ 
          cnam: finalCnamName || null,
          callerIdName: finalCnamName || null 
        })
        .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));
      console.log(`[Telnyx CNAM] Saved cnam to local DB: "${finalCnamName}"`);
    } catch (dbError) {
      console.error("[Telnyx CNAM] Failed to save cnam to local DB:", dbError);
    }
    
    return {
      success: true,
      cnamEnabled: cnamListing?.cnam_listing_enabled ?? enabled,
      cnamName: finalCnamName,
    };
  } catch (error) {
    console.error("[Telnyx CNAM] Update error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update CNAM",
    };
  }
}

/**
 * Get CNAM settings for a phone number
 */
export async function getCnamSettings(
  phoneNumberId: string,
  companyId: string
): Promise<{
  success: boolean;
  error?: string;
  cnamEnabled?: boolean;
  cnamName?: string;
  phoneNumber?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Get the company's shared Telnyx account ID
    const telnyxAccountId = await getCompanyTelnyxAccountId(companyId);
    
    if (!telnyxAccountId) {
      return {
        success: false,
        error: "Company Telnyx account not found"
      };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      ...(telnyxAccountId && telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": telnyxAccountId} : {}),
    };
    
    // First get basic phone number info
    const phoneResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "GET",
      headers,
    });
    
    let phoneNumber: string | undefined;
    if (phoneResponse.ok) {
      const phoneData = await phoneResponse.json();
      phoneNumber = phoneData.data?.phone_number;
    }
    
    // Get voice settings (where CNAM is actually stored)
    // CORRECT ENDPOINT: /v2/phone_numbers/{id}/voice
    const voiceResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
      method: "GET",
      headers,
    });
    
    if (!voiceResponse.ok) {
      const errorText = await voiceResponse.text();
      console.error(`[Telnyx CNAM Voice] Get settings error: ${voiceResponse.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to get CNAM settings: ${voiceResponse.status}`,
      };
    }
    
    const result = await voiceResponse.json();
    const cnamListing = result.data?.cnam_listing;
    
    return {
      success: true,
      cnamEnabled: cnamListing?.cnam_listing_enabled || false,
      cnamName: cnamListing?.cnam_listing_details || "",
      phoneNumber,
    };
  } catch (error) {
    console.error("[Telnyx CNAM] Get settings error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get CNAM settings",
    };
  }
}

/**
 * Get all voice settings for a phone number (CNAM, Call Recording, Spam Protection, Inbound Caller ID)
 */
export async function getVoiceSettings(
  phoneNumberId: string,
  companyId: string
): Promise<{
  success: boolean;
  error?: string;
  cnamListing?: {
    enabled: boolean;
    details: string;
  };
  callRecording?: {
    inboundEnabled: boolean;
    outboundEnabled: boolean;
    format: string;
    channels: string;
  };
  inboundCallScreening?: string;
  callerIdNameEnabled?: boolean;
  callForwarding?: {
    enabled: boolean;
    destination: string;
    keepCallerId: boolean;
  };
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // First, look up the Telnyx phone number ID from our database
    // phoneNumberId could be either our internal ID or the Telnyx ID
    const [localNumber] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(
        or(
          eq(telnyxPhoneNumbers.id, phoneNumberId),
          eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId)
        )
      );
    
    if (!localNumber) {
      return { success: false, error: "Phone number not found in database" };
    }
    
    const telnyxPhoneId = localNumber.telnyxPhoneNumberId;
    if (!telnyxPhoneId) {
      return { success: false, error: "Telnyx phone number ID not found" };
    }
    
    // Get the company's shared Telnyx account ID
    const telnyxAccountId = await getCompanyTelnyxAccountId(companyId);
    
    if (!telnyxAccountId) {
      return { success: false, error: "Company Telnyx account not found" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      ...(telnyxAccountId && telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": telnyxAccountId} : {}),
    };
    
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${telnyxPhoneId}/voice`, {
      method: "GET",
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Voice] Get settings error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to get voice settings: ${response.status}` };
    }
    
    const result = await response.json();
    const data = result.data;
    
    // localNumber already fetched at the beginning of the function
    
    // Check outbound voice profile recording status
    let outboundEnabled = false;
    const [companyTelephonySettings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    
    if (companyTelephonySettings?.outboundVoiceProfileId) {
      try {
        const outboundResponse = await fetch(
          `${TELNYX_API_BASE}/outbound_voice_profiles/${companyTelephonySettings.outboundVoiceProfileId}`,
          { method: "GET", headers }
        );
        if (outboundResponse.ok) {
          const outboundResult = await outboundResponse.json();
          const outboundRecording = outboundResult.data?.call_recording;
          outboundEnabled = outboundRecording?.call_recording_type === "all";
        }
      } catch (outboundError) {
        console.error("[Telnyx Voice] Failed to get outbound profile recording status:", outboundError);
      }
    }
    
    return {
      success: true,
      cnamListing: {
        enabled: data?.cnam_listing?.cnam_listing_enabled || false,
        details: data?.cnam_listing?.cnam_listing_details || "",
      },
      callRecording: {
        inboundEnabled: data?.call_recording?.inbound_call_recording_enabled || false,
        outboundEnabled,
        format: data?.call_recording?.inbound_call_recording_format || "mp3",
        channels: data?.call_recording?.inbound_call_recording_channels || "single",
      },
      inboundCallScreening: data?.inbound_call_screening || "disabled",
      callerIdNameEnabled: data?.caller_id_name_enabled || false,
      callForwarding: {
        enabled: localNumber?.callForwardingEnabled || false,
        destination: localNumber?.callForwardingDestination || "",
        keepCallerId: localNumber?.callForwardingKeepCallerId ?? true,
      },
    };
  } catch (error) {
    console.error("[Telnyx Voice] Get settings error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to get voice settings" };
  }
}

/**
 * Get the current routing configuration for a phone number directly from Telnyx API
 * This is useful for debugging routing issues
 */
export async function getPhoneNumberRoutingConfig(
  phoneNumberId: string,
  companyId: string
): Promise<{
  success: boolean;
  error?: string;
  phoneNumber?: string;
  connectionId?: string | null;
  callControlApplicationId?: string | null;
  connectionName?: string;
  callControlAppName?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    const telnyxAccountId = await getCompanyTelnyxAccountId(companyId);
    
    if (!telnyxAccountId) {
      return { success: false, error: "Company Telnyx account not found" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      ...(telnyxAccountId && telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": telnyxAccountId} : {}),
    };
    
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "GET",
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Routing] Get phone number error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to get phone number: ${response.status}` };
    }
    
    const result = await response.json();
    const data = result.data;
    
    console.log(`[Telnyx Routing Debug] Phone ${data?.phone_number}: connection_id=${data?.connection_id}, call_control_application_id=${data?.call_control_application_id}, connection_name=${data?.connection_name}`);
    
    return {
      success: true,
      phoneNumber: data?.phone_number,
      connectionId: data?.connection_id || null,
      callControlApplicationId: data?.call_control_application_id || null,
      connectionName: data?.connection_name,
      callControlAppName: data?.call_control_application_name,
    };
  } catch (error) {
    console.error("[Telnyx Routing] Get config error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to get routing config" };
  }
}

/**
 * Update call recording settings for a phone number (inbound) and outbound voice profile (outbound)
 */
export async function updateCallRecording(
  phoneNumberId: string,
  companyId: string,
  enabled: boolean,
  format: "mp3" | "wav" = "mp3",
  channels: "single" | "dual" = "single"
): Promise<{ success: boolean; error?: string; inboundEnabled?: boolean; outboundEnabled?: boolean }> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return { success: false, error: "Company wallet or Telnyx account not found" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
    };
    
    // Update inbound call recording on the phone number
    const inboundPayload = {
      call_recording: {
        inbound_call_recording_enabled: enabled,
        inbound_call_recording_format: format,
        inbound_call_recording_channels: channels,
      },
    };
    
    console.log(`[Telnyx Call Recording] Updating inbound. Number ID: ${phoneNumberId}, enabled=${enabled}, format=${format}, channels=${channels}`);
    
    const inboundResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(inboundPayload),
    });
    
    if (!inboundResponse.ok) {
      const errorText = await inboundResponse.text();
      console.error(`[Telnyx Call Recording] Inbound update error: ${inboundResponse.status} - ${errorText}`);
      return { success: false, error: `Failed to update inbound call recording: ${inboundResponse.status} - ${errorText}` };
    }
    
    const inboundResult = await inboundResponse.json();
    console.log(`[Telnyx Call Recording] Inbound update successful:`, JSON.stringify(inboundResult.data?.call_recording, null, 2));
    
    // Also update outbound recording on the Outbound Voice Profile
    let outboundEnabled = false;
    const [companyTelephonySettings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    
    if (companyTelephonySettings?.outboundVoiceProfileId) {
      try {
        const outboundPayload = enabled
          ? {
              call_recording: {
                call_recording_type: "all",
                call_recording_channels: channels,
                call_recording_format: format,
              },
            }
          : {
              call_recording: {
                call_recording_type: "none",
              },
            };
        
        console.log(`[Telnyx Call Recording] Updating outbound profile: ${companyTelephonySettings.outboundVoiceProfileId}, enabled=${enabled}`);
        
        const outboundResponse = await fetch(
          `${TELNYX_API_BASE}/outbound_voice_profiles/${companyTelephonySettings.outboundVoiceProfileId}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify(outboundPayload),
          }
        );
        
        if (!outboundResponse.ok) {
          const errorText = await outboundResponse.text();
          console.error(`[Telnyx Call Recording] Outbound profile update error: ${outboundResponse.status} - ${errorText}`);
        } else {
          const outboundResult = await outboundResponse.json();
          console.log(`[Telnyx Call Recording] Outbound profile update successful:`, JSON.stringify(outboundResult.data?.call_recording, null, 2));
          outboundEnabled = enabled;
        }
      } catch (outboundError) {
        console.error(`[Telnyx Call Recording] Outbound profile update failed:`, outboundError);
      }
    } else {
      console.log(`[Telnyx Call Recording] No outbound voice profile found for company ${companyId}`);
    }
    
    return { success: true, inboundEnabled: enabled, outboundEnabled };
  } catch (error) {
    console.error("[Telnyx Call Recording] Update error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update call recording" };
  }
}

/**
 * Update spam protection (inbound call screening) settings for a phone number
 * Values: "disabled" | "reject_calls" | "flag_calls"
 */
export async function updateSpamProtection(
  phoneNumberId: string,
  companyId: string,
  mode: "disabled" | "reject_calls" | "flag_calls"
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return { success: false, error: "Company wallet or Telnyx account not found" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
    };
    
    const payload = {
      inbound_call_screening: mode,
    };
    
    console.log(`[Telnyx Spam Protection] Updating. Number ID: ${phoneNumberId}, mode=${mode}`);
    
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Spam Protection] Update error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to update spam protection: ${response.status} - ${errorText}` };
    }
    
    const result = await response.json();
    console.log(`[Telnyx Spam Protection] Update successful: inbound_call_screening=${result.data?.inbound_call_screening}`);
    
    return { success: true };
  } catch (error) {
    console.error("[Telnyx Spam Protection] Update error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update spam protection" };
  }
}

/**
 * Update call forwarding settings for a phone number
 * NOTE: Telnyx Voice API does NOT support call forwarding directly.
 * We store settings locally and apply them via TeXML webhook when calls come in.
 */
export async function updateCallForwarding(
  phoneNumberId: string,
  companyId: string,
  enabled: boolean,
  destination?: string,
  keepCallerId: boolean = true,
  ownerUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate destination is E.164 US number if enabled
    if (enabled && !destination) {
      return { success: false, error: "Destination number is required when enabling call forwarding" };
    }
    
    let normalizedDest: string | null = null;
    if (enabled && destination) {
      const cleanNumber = destination.replace(/\D/g, "");
      if (!cleanNumber.match(/^1?\d{10}$/)) {
        return { success: false, error: "Destination must be a valid US phone number" };
      }
      // Normalize to E.164
      normalizedDest = cleanNumber.startsWith("1") ? `+${cleanNumber}` : `+1${cleanNumber}`;
    }
    
    // Check if record exists in local database
    const [existing] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(
        and(
          eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId),
          eq(telnyxPhoneNumbers.companyId, companyId)
        )
      );
    
    if (existing) {
      // Update existing record
      await db
        .update(telnyxPhoneNumbers)
        .set({
          callForwardingEnabled: enabled,
          callForwardingDestination: normalizedDest,
          callForwardingKeepCallerId: keepCallerId,
          updatedAt: new Date(),
        })
        .where(eq(telnyxPhoneNumbers.id, existing.id));
      
      console.log(`[Call Forwarding] Settings updated. Number: ${existing.phoneNumber}, enabled=${enabled}, destination=${normalizedDest}`);
    } else {
      // Need to fetch phone number details from Telnyx to create local record
      const apiKey = await getTelnyxMasterApiKey();
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.companyId, companyId));
      
      if (!wallet?.telnyxAccountId) {
        return { success: false, error: "Company wallet or Telnyx account not found" };
      }
      
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
        ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
      };
      
      // Fetch the phone number details from Telnyx
      const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
        method: "GET",
        headers,
      });
      
      if (!response.ok) {
        console.error(`[Call Forwarding] Failed to fetch phone number from Telnyx: ${response.status}`);
        return { success: false, error: "Failed to fetch phone number details" };
      }
      
      const result = await response.json();
      const phoneNumber = result.data?.phone_number;
      
      if (!phoneNumber) {
        return { success: false, error: "Phone number not found in Telnyx" };
      }
      
      // Create local record with call forwarding settings
      const now = new Date();
      const nextBilling = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      await db.insert(telnyxPhoneNumbers).values({
        companyId,
        ownerUserId: ownerUserId || null,
        phoneNumber,
        telnyxPhoneNumberId: phoneNumberId,
        status: "active",
        callForwardingEnabled: enabled,
        callForwardingDestination: normalizedDest,
        callForwardingKeepCallerId: keepCallerId,
        purchasedAt: now,
        nextBillingAt: nextBilling,
      });
      
      console.log(`[Call Forwarding] Created local record and saved settings. Number: ${phoneNumber}, enabled=${enabled}, destination=${normalizedDest}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error("[Call Forwarding] Update error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update call forwarding" };
  }
}

/**
 * Get voicemail settings for a phone number
 */
export async function getVoicemailSettings(
  phoneNumberId: string,
  companyId: string
): Promise<{ success: boolean; enabled?: boolean; pin?: string; error?: string }> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return { success: false, error: "Company wallet or Telnyx account not found" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
    };
    
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voicemail`, {
      method: "GET",
      headers,
    });
    
    if (!response.ok) {
      // 404 means voicemail not configured yet - that's ok
      if (response.status === 404) {
        return { success: true, enabled: false, pin: "" };
      }
      const errorText = await response.text();
      console.error(`[Telnyx Voicemail] Get settings error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to get voicemail settings: ${response.status}` };
    }
    
    const result = await response.json();
    return {
      success: true,
      enabled: result.data?.enabled || false,
      pin: result.data?.pin?.toString() || "",
    };
  } catch (error) {
    console.error("[Telnyx Voicemail] Get settings error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to get voicemail settings" };
  }
}

/**
 * Update voicemail settings for a phone number
 */
export async function updateVoicemailSettings(
  phoneNumberId: string,
  companyId: string,
  enabled: boolean,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return { success: false, error: "Company wallet or Telnyx account not found" };
    }

    // Validate PIN is 4 digits
    if (enabled && (!pin || !/^\d{4}$/.test(pin))) {
      return { success: false, error: "PIN must be exactly 4 digits" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
    };
    
    // Telnyx API expects pin as string "1234", not integer
    // Also add play_caller_id for better UX
    const payload: Record<string, any> = {
      enabled,
    };
    
    // Only include PIN when enabling voicemail
    if (enabled && pin) {
      payload.pin = pin; // Keep as string per Telnyx API requirements
      payload.play_caller_id = true;
    }
    
    console.log(`[Telnyx Voicemail] Updating. Number ID: ${phoneNumberId}, enabled=${enabled}, payload:`, JSON.stringify(payload));
    
    // Try PATCH first, if 404 then POST to create
    let response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voicemail`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (response.status === 404) {
      // Voicemail not created yet, use POST
      response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voicemail`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Voicemail] Update error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to update voicemail: ${response.status} - ${errorText}` };
    }
    
    const result = await response.json();
    console.log(`[Telnyx Voicemail] Update successful: enabled=${result.data?.enabled}`);
    
    return { success: true };
  } catch (error) {
    console.error("[Telnyx Voicemail] Update error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update voicemail settings" };
  }
}

export async function getCompanyPhoneNumbers(companyId: string): Promise<{
  success: boolean;
  numbers?: any[];
  error?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    if (!wallet?.telnyxAccountId) {
      return {
        success: true,
        numbers: [],
      };
    }

    // Use managed account header to get numbers for this company's account
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    };
    
    if (wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT") {
      headers["x-managed-account-id"] = wallet.telnyxAccountId;
    }

    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Numbers] Get numbers error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to get phone numbers: ${response.status}`,
      };
    }

    const result = await response.json();
    
    // Load global pricing to use configured rates
    const pricing = await loadGlobalPricing();
    
    // Transform numbers to use global pricing
    const numbersWithGlobalPricing = (result.data || []).map((num: any) => {
      const isTollFree = isTollFreeNumber(num.phone_number, num.number_type);
      const configuredMonthlyFee = isTollFree 
        ? pricing.monthly.tollfree_did 
        : pricing.monthly.local_did;
      
      return {
        ...num,
        monthlyFee: configuredMonthlyFee.toFixed(2),
        telnyxMonthlyCost: num.monthly_cost,
      };
    });

    return {
      success: true,
      numbers: numbersWithGlobalPricing,
    };
  } catch (error) {
    console.error("[Telnyx Numbers] Get numbers error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get phone numbers",
    };
  }
}

export async function getUserPhoneNumbers(companyId: string, userId?: string): Promise<{
  success: boolean;
  numbers?: any[];
  error?: string;
}> {
  try {
    // Get phone numbers from local DB with owner user info via left join
    // When userId is provided, filter by ownerUserId (for admins seeing their own)
    // When userId is undefined, get all company numbers (for superadmins)
    const whereConditions = userId
      ? and(eq(telnyxPhoneNumbers.companyId, companyId), eq(telnyxPhoneNumbers.ownerUserId, userId))
      : eq(telnyxPhoneNumbers.companyId, companyId);
    
    const results = await db
      .select({
        id: telnyxPhoneNumbers.id,
        companyId: telnyxPhoneNumbers.companyId,
        ownerUserId: telnyxPhoneNumbers.ownerUserId,
        phoneNumber: telnyxPhoneNumbers.phoneNumber,
        telnyxPhoneNumberId: telnyxPhoneNumbers.telnyxPhoneNumberId,
        displayName: telnyxPhoneNumbers.displayName,
        status: telnyxPhoneNumbers.status,
        capabilities: telnyxPhoneNumbers.capabilities,
        monthlyFee: telnyxPhoneNumbers.monthlyFee,
        e911Enabled: telnyxPhoneNumbers.e911Enabled,
        e911AddressId: telnyxPhoneNumbers.e911AddressId,
        e911MonthlyFee: telnyxPhoneNumbers.e911MonthlyFee,
        messagingProfileId: telnyxPhoneNumbers.messagingProfileId,
        outboundVoiceProfileId: telnyxPhoneNumbers.outboundVoiceProfileId,
        connectionId: telnyxPhoneNumbers.connectionId,
        callerIdName: telnyxPhoneNumbers.callerIdName,
        callForwardingEnabled: telnyxPhoneNumbers.callForwardingEnabled,
        callForwardingDestination: telnyxPhoneNumbers.callForwardingDestination,
        callForwardingKeepCallerId: telnyxPhoneNumbers.callForwardingKeepCallerId,
        recordingEnabled: telnyxPhoneNumbers.recordingEnabled,
        cnamLookupEnabled: telnyxPhoneNumbers.cnamLookupEnabled,
        noiseSuppressionEnabled: telnyxPhoneNumbers.noiseSuppressionEnabled,
        noiseSuppressionDirection: telnyxPhoneNumbers.noiseSuppressionDirection,
        voicemailEnabled: telnyxPhoneNumbers.voicemailEnabled,
        voicemailPin: telnyxPhoneNumbers.voicemailPin,
        ivrId: telnyxPhoneNumbers.ivrId,
        numberType: telnyxPhoneNumbers.numberType,
        retailMonthlyRate: telnyxPhoneNumbers.retailMonthlyRate,
        telnyxMonthlyCost: telnyxPhoneNumbers.telnyxMonthlyCost,
        lastBilledAt: telnyxPhoneNumbers.lastBilledAt,
        nextBillingAt: telnyxPhoneNumbers.nextBillingAt,
        purchasedAt: telnyxPhoneNumbers.purchasedAt,
        createdAt: telnyxPhoneNumbers.createdAt,
        updatedAt: telnyxPhoneNumbers.updatedAt,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        ownerEmail: users.email,
        ownerAvatar: users.avatar,
        e911StreetAddress: telnyxE911Addresses.streetAddress,
        e911ExtendedAddress: telnyxE911Addresses.extendedAddress,
        e911Locality: telnyxE911Addresses.locality,
        e911AdminArea: telnyxE911Addresses.administrativeArea,
        e911PostalCode: telnyxE911Addresses.postalCode,
      })
      .from(telnyxPhoneNumbers)
      .leftJoin(users, eq(telnyxPhoneNumbers.ownerUserId, users.id))
      .leftJoin(telnyxE911Addresses, eq(telnyxPhoneNumbers.e911AddressId, telnyxE911Addresses.telnyxAddressId))
      .where(whereConditions);

    // Load global pricing to use configured rates instead of Telnyx rates
    const pricing = await loadGlobalPricing();
    
    // Transform results to include ownerUser object and use global pricing
    const numbers = results.map(r => {
      // Determine if toll-free to apply correct rate
      const isTollFree = isTollFreeNumber(r.phoneNumber, r.numberType);
      const configuredMonthlyFee = isTollFree 
        ? pricing.monthly.tollfree_did 
        : pricing.monthly.local_did;
      
      return {
        ...r,
        // Override with configured global pricing instead of Telnyx rate
        monthlyFee: configuredMonthlyFee.toFixed(2),
        // Keep Telnyx cost for reference
        telnyxMonthlyCost: r.monthlyFee,
        ownerUser: r.ownerUserId ? {
          id: r.ownerUserId,
          firstName: r.ownerFirstName,
          lastName: r.ownerLastName,
          email: r.ownerEmail,
          avatar: r.ownerAvatar,
        } : null,
      };
    });

    return {
      success: true,
      numbers: numbers || [],
    };
  } catch (error) {
    console.error("[Telnyx Numbers] Get user numbers error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get phone numbers",
    };
  }
}

// Sync phone numbers from Telnyx API to local database
export async function syncPhoneNumbersFromTelnyx(companyId: string): Promise<{
  success: boolean;
  syncedCount: number;
  error?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    if (!wallet?.telnyxAccountId) {
      return { success: true, syncedCount: 0 };
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
    };

    // Get all numbers from Telnyx
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers?page[size]=250`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Sync] Get numbers error: ${response.status} - ${errorText}`);
      return { success: false, syncedCount: 0, error: `Failed to fetch from Telnyx: ${response.status}` };
    }

    const result = await response.json();
    const telnyxNumbers = result.data || [];
    let syncedCount = 0;

    for (const tn of telnyxNumbers) {
      const phoneNumber = tn.phone_number;
      const telnyxId = tn.id;

      // Check if number exists in our DB
      const [existing] = await db
        .select()
        .from(telnyxPhoneNumbers)
        .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, telnyxId));

      if (!existing) {
        // Insert new number
        const numberType = tn.phone_number_type === 'toll_free' ? 'toll_free' : 'local';
        const monthlyRate = numberType === 'toll_free' ? '1.50' : '1.00';
        
        const purchasedDate = tn.purchased_at ? new Date(tn.purchased_at) : new Date();
        const nextBilling = new Date(purchasedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        await db.insert(telnyxPhoneNumbers).values({
          companyId,
          phoneNumber,
          telnyxPhoneNumberId: telnyxId,
          displayName: phoneNumber,
          status: tn.status || 'active',
          numberType,
          retailMonthlyRate: monthlyRate,
          telnyxMonthlyCost: tn.billing?.cost_information?.monthly_cost || '0',
          purchasedAt: purchasedDate,
          nextBillingAt: nextBilling,
        });
        syncedCount++;
        console.log(`[Telnyx Sync] Added number ${phoneNumber} to company ${companyId}`);
      }
    }

    console.log(`[Telnyx Sync] Synced ${syncedCount} new numbers for company ${companyId}`);
    return { success: true, syncedCount };
  } catch (error) {
    console.error("[Telnyx Sync] Error:", error);
    return { success: false, syncedCount: 0, error: error instanceof Error ? error.message : "Sync failed" };
  }
}

// Sync all company phone numbers with billing features (recording, CNAM)
export async function syncBillingFeaturesToTelnyx(
  companyId: string,
  recordingEnabled?: boolean,
  cnamEnabled?: boolean
): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return { success: false, syncedCount: 0, errors: ["Company wallet or Telnyx account not found"] };
    }
    
    // Get all phone numbers for this company
    const numbers = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId));
    
    if (numbers.length === 0) {
      console.log(`[Billing Features Sync] No phone numbers found for company ${companyId}`);
      return { success: true, syncedCount: 0, errors: [] };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
    };
    
    const errors: string[] = [];
    let syncedCount = 0;
    
    for (const number of numbers) {
      try {
        const payload: Record<string, any> = {};
        
        // Update call recording if specified
        if (typeof recordingEnabled === 'boolean') {
          payload.call_recording = {
            inbound_call_recording_enabled: recordingEnabled,
            inbound_call_recording_format: "mp3",
            inbound_call_recording_channels: "single",
          };
        }
        
        // Update CNAM if specified
        if (typeof cnamEnabled === 'boolean') {
          payload.cnam_listing = {
            cnam_listing_enabled: cnamEnabled,
          };
        }
        
        if (Object.keys(payload).length === 0) continue;
        
        const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${number.telnyxPhoneNumberId}/voice`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Billing Features Sync] Failed for ${number.phoneNumber}: ${response.status} - ${errorText}`);
          errors.push(`${number.phoneNumber}: ${errorText}`);
          continue;
        }
        
        syncedCount++;
        console.log(`[Billing Features Sync] Synced ${number.phoneNumber}: recording=${recordingEnabled}, cnam=${cnamEnabled}`);
      } catch (error) {
        errors.push(`${number.phoneNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`[Billing Features Sync] Completed for company ${companyId}: ${syncedCount}/${numbers.length} synced`);
    return { success: errors.length === 0, syncedCount, errors };
  } catch (error) {
    console.error("[Billing Features Sync] Error:", error);
    return { success: false, syncedCount: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
}

// Update per-number voice settings (recordingEnabled, cnamLookupEnabled, noiseSuppressionEnabled, voicemailEnabled, voicemailPin, ivrId)
export async function updateNumberVoiceSettings(
  phoneNumberId: string,
  companyId: string,
  settings: {
    recordingEnabled?: boolean;
    cnamLookupEnabled?: boolean;
    noiseSuppressionEnabled?: boolean;
    noiseSuppressionDirection?: "inbound" | "outbound" | "both";
    voicemailEnabled?: boolean;
    voicemailPin?: string;
    ivrId?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the phone number from DB - lookup by telnyxPhoneNumberId (Telnyx ID)
    const [phoneNumber] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(and(
        eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId),
        eq(telnyxPhoneNumbers.companyId, companyId)
      ));
    
    if (!phoneNumber) {
      return { success: false, error: "Phone number not found" };
    }
    
    // Build update object
    const updateData: Record<string, any> = { updatedAt: new Date() };
    
    if (typeof settings.recordingEnabled === 'boolean') {
      updateData.recordingEnabled = settings.recordingEnabled;
    }
    if (typeof settings.cnamLookupEnabled === 'boolean') {
      updateData.cnamLookupEnabled = settings.cnamLookupEnabled;
    }
    if (typeof settings.noiseSuppressionEnabled === 'boolean') {
      updateData.noiseSuppressionEnabled = settings.noiseSuppressionEnabled;
    }
    if (settings.noiseSuppressionDirection) {
      updateData.noiseSuppressionDirection = settings.noiseSuppressionDirection;
    }
    if (typeof settings.voicemailEnabled === 'boolean') {
      updateData.voicemailEnabled = settings.voicemailEnabled;
    }
    if (settings.voicemailPin) {
      updateData.voicemailPin = settings.voicemailPin;
    }
    if (settings.ivrId !== undefined) {
      updateData.ivrId = settings.ivrId;
    }
    
    // Update local DB - use local database ID from the fetched record
    await db
      .update(telnyxPhoneNumbers)
      .set(updateData)
      .where(eq(telnyxPhoneNumbers.id, phoneNumber.id));
    
    // If recording or CNAM changed, sync to Telnyx API
    if (typeof settings.recordingEnabled === 'boolean' || typeof settings.cnamLookupEnabled === 'boolean') {
      const apiKey = await getTelnyxMasterApiKey();
      
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.companyId, companyId));
      
      if (wallet?.telnyxAccountId) {
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
        };
        
        const payload: Record<string, any> = {};
        
        if (typeof settings.recordingEnabled === 'boolean') {
          payload.call_recording = {
            inbound_call_recording_enabled: settings.recordingEnabled,
            inbound_call_recording_format: "mp3",
            inbound_call_recording_channels: "single",
          };
        }
        
        if (typeof settings.cnamLookupEnabled === 'boolean') {
          // caller_id_name_enabled is for INBOUND CNAM lookup (seeing who's calling you)
          // cnam_listing_enabled is for OUTBOUND (your name when you call others)
          payload.caller_id_name_enabled = settings.cnamLookupEnabled;
        }
        
        if (Object.keys(payload).length > 0) {
          const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumber.telnyxPhoneNumberId}/voice`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(payload),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Voice Settings] Telnyx sync failed for ${phoneNumber.phoneNumber}: ${response.status} - ${errorText}`);
          } else {
            console.log(`[Voice Settings] Synced ${phoneNumber.phoneNumber} to Telnyx`);
          }
        }
      }
    }
    
    // If voicemail settings changed, sync to Telnyx API
    if (typeof settings.voicemailEnabled === 'boolean' || settings.voicemailPin) {
      const apiKey = await getTelnyxMasterApiKey();
      
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.companyId, companyId));
      
      if (wallet?.telnyxAccountId) {
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
        };
        
        // Get current voicemail settings from local DB (just updated)
        const [updatedNumber] = await db
          .select()
          .from(telnyxPhoneNumbers)
          .where(eq(telnyxPhoneNumbers.id, phoneNumber.id));
        
        if (updatedNumber?.voicemailEnabled && updatedNumber?.voicemailPin) {
          // Enable voicemail with PIN via Telnyx API
          const voicemailPayload = {
            pin: parseInt(updatedNumber.voicemailPin, 10),
            enabled: true,
          };
          
          // Try PATCH first, then POST if 404
          let response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumber.telnyxPhoneNumberId}/voicemail`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(voicemailPayload),
          });
          
          if (response.status === 404) {
            // Voicemail not created yet, use POST to create
            console.log(`[Voicemail] Creating new voicemail config for ${phoneNumber.phoneNumber}`);
            response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumber.telnyxPhoneNumberId}/voicemail`, {
              method: "POST",
              headers,
              body: JSON.stringify(voicemailPayload),
            });
          }
          
          if (!response.ok) {
            const errorText = await response.text();
            // 404 means voicemail is not available for this number type or connection
            // This typically happens when:
            // 1. Number is routed through Call Control App (voicemail only works with direct SIP Connections)
            // 2. Voicemail needs to be enabled first in Telnyx portal
            if (response.status === 404) {
              console.log(`[Voicemail] Telnyx voicemail API not available for ${phoneNumber.phoneNumber} - settings saved locally only. Number may need to be configured in Telnyx portal first.`);
            } else {
              console.error(`[Voicemail] Telnyx sync failed for ${phoneNumber.phoneNumber}: ${response.status} - ${errorText}`);
            }
          } else {
            console.log(`[Voicemail] Enabled for ${phoneNumber.phoneNumber} with PIN`);
          }
        } else if (!updatedNumber?.voicemailEnabled) {
          // Disable voicemail - use PATCH
          const voicemailPayload = {
            enabled: false,
          };
          
          const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumber.telnyxPhoneNumberId}/voicemail`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(voicemailPayload),
          });
          
          // 404 when disabling means voicemail was never created or not available, which is fine
          if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            console.error(`[Voicemail] Disable failed for ${phoneNumber.phoneNumber}: ${response.status} - ${errorText}`);
          } else {
            console.log(`[Voicemail] Disabled/Not configured for ${phoneNumber.phoneNumber} - settings saved locally`);
          }
        }
      }
    }
    
    // CRITICAL: If ivrId changed, automatically sync routing to Telnyx
    // IVR enabled (real UUID) -> route to Call Control App (for webhooks)
    // IVR disabled ("unassigned" or null) -> route to Credential Connection (for direct SIP with simultaneous_ringing)
    if (settings.ivrId !== undefined) {
      try {
        const apiKey = await getTelnyxMasterApiKey();
        
        const [telSettings] = await db
          .select()
          .from(telephonySettings)
          .where(eq(telephonySettings.companyId, companyId));
        
        const [wallet] = await db
          .select()
          .from(wallets)
          .where(eq(wallets.companyId, companyId));
        
        if (wallet?.telnyxAccountId && telSettings) {
          const hasActiveIvr = settings.ivrId && settings.ivrId !== "unassigned";
          
          // Determine which connection to use
          let targetConnectionId: string | null = null;
          let routingType = "";
          
          if (hasActiveIvr && telSettings.callControlAppId) {
            // IVR is enabled - use Call Control App for webhook-based IVR routing
            targetConnectionId = telSettings.callControlAppId;
            routingType = "Call Control App (IVR enabled)";
          } else if (telSettings.credentialConnectionId) {
            // IVR disabled - use Credential Connection for direct SIP routing with simultaneous_ringing
            targetConnectionId = telSettings.credentialConnectionId;
            routingType = "Credential Connection (direct SIP, simultaneous ring)";
          }
          
          if (targetConnectionId) {
            const headers: Record<string, string> = {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
            };
            
            // CRITICAL: When IVR is enabled, use call_control_application_id (not connection_id)
            // When IVR is disabled, use connection_id to route to Credential Connection
            const routingPayload = hasActiveIvr 
              ? { 
                  connection_id: null, 
                  call_control_application_id: targetConnectionId 
                }
              : { 
                  connection_id: targetConnectionId, 
                  call_control_application_id: null 
                };
            
            const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumber.telnyxPhoneNumberId}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify(routingPayload),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[Voice Settings] Telnyx routing sync failed for ${phoneNumber.phoneNumber}: ${response.status} - ${errorText}`);
            } else {
              console.log(`[Voice Settings] Synced ${phoneNumber.phoneNumber} routing to ${routingType}`);
              
              // Update connectionId in database
              await db
                .update(telnyxPhoneNumbers)
                .set({ connectionId: targetConnectionId, updatedAt: new Date() })
                .where(eq(telnyxPhoneNumbers.id, phoneNumber.id));
            }
          } else {
            console.warn(`[Voice Settings] No connection available for ${phoneNumber.phoneNumber} - cannot sync routing`);
          }
        }
      } catch (routingError) {
        console.error(`[Voice Settings] Error syncing routing for ${phoneNumber.phoneNumber}:`, routingError);
        // Don't fail the whole operation, just log the routing sync error
      }
    }
    
    console.log(`[Voice Settings] Updated ${phoneNumber.phoneNumber}: ${JSON.stringify(settings)}`);
    return { success: true };
  } catch (error) {
    console.error("[Voice Settings] Update error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update voice settings" };
  }
}

/**
 * Sync voice settings from Telnyx to local database for a specific phone number
 * This fetches the actual configuration from Telnyx and updates our local record
 */
export async function syncVoiceSettingsFromTelnyx(
  phoneNumberId: string,
  companyId: string
): Promise<{
  success: boolean;
  error?: string;
  settings?: {
    recordingEnabled: boolean;
    cnamLookupEnabled: boolean;
    callerIdName: string | null;
  };
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Get the phone number from our database
    const [phoneNumber] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));
    
    if (!phoneNumber) {
      return { success: false, error: "Phone number not found in database" };
    }
    
    // Get the company's Telnyx account ID
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return { success: false, error: "Company Telnyx account not found" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      ...(wallet.telnyxAccountId && wallet.telnyxAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": wallet.telnyxAccountId} : {}),
    };
    
    // Get voice settings from Telnyx
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
      method: "GET",
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Sync Voice Settings] Telnyx API error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to get Telnyx settings: ${response.status}` };
    }
    
    const result = await response.json();
    const data = result.data;
    
    // Extract settings from Telnyx response
    // caller_id_name_enabled is for INBOUND CNAM lookup (seeing who's calling you)
    // cnam_listing is for OUTBOUND (your name when you call others)
    const recordingEnabled = data?.call_recording?.inbound_call_recording_enabled || false;
    const cnamLookupEnabled = data?.caller_id_name_enabled || false;
    const callerIdName = data?.cnam_listing?.cnam_listing_details || null;
    
    console.log(`[Sync Voice Settings] Telnyx state for ${phoneNumber.phoneNumber}: recording=${recordingEnabled}, cnamLookup(inbound)=${cnamLookupEnabled}, callerIdName(outbound)="${callerIdName}"`);
    
    // Update our local database with the Telnyx state
    await db
      .update(telnyxPhoneNumbers)
      .set({
        recordingEnabled,
        cnamLookupEnabled,
        callerIdName,
        updatedAt: new Date(),
      })
      .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));
    
    console.log(`[Sync Voice Settings] Synced ${phoneNumber.phoneNumber} from Telnyx to local DB`);
    
    return {
      success: true,
      settings: {
        recordingEnabled,
        cnamLookupEnabled,
        callerIdName,
      },
    };
  } catch (error) {
    console.error("[Sync Voice Settings] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to sync voice settings" };
  }
}

/**
 * Backfill/repair function: Assigns messaging profile to all phone numbers for a company
 * Use this for existing numbers that were purchased before messaging profile auto-assignment was implemented
 */
export async function assignMessagingProfileToAllNumbers(companyId: string): Promise<{
  success: boolean;
  updated: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;
  let failed = 0;

  try {
    const apiKey = await getTelnyxMasterApiKey();
    const managedAccountId = await getCompanyTelnyxAccountId(companyId);
    const messagingProfileId = await getCompanyMessagingProfileId(companyId);

    if (!managedAccountId) {
      return { success: false, updated: 0, failed: 0, errors: ["Company Telnyx account not found"] };
    }

    if (!messagingProfileId) {
      return { success: false, updated: 0, failed: 0, errors: ["Company messaging profile not found"] };
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (managedAccountId !== "MASTER_ACCOUNT") {
      headers["x-managed-account-id"] = managedAccountId;
    }

    const companyNumbers = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId));

    console.log(`[Messaging Profile Backfill] Processing ${companyNumbers.length} numbers for company ${companyId}`);

    for (const number of companyNumbers) {
      if (!number.telnyxPhoneNumberId) {
        errors.push(`${number.phoneNumber}: No Telnyx phone number ID`);
        failed++;
        continue;
      }

      try {
        const patchResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${number.telnyxPhoneNumberId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            messaging_profile_id: messagingProfileId,
          }),
        });

        if (patchResponse.ok) {
          // Persist to local database
          await db
            .update(telnyxPhoneNumbers)
            .set({
              messagingProfileId: messagingProfileId,
              updatedAt: new Date(),
            })
            .where(eq(telnyxPhoneNumbers.id, number.id));
          
          console.log(`[Messaging Profile Backfill] Assigned ${number.phoneNumber} to messaging profile ${messagingProfileId}`);
          updated++;
        } else {
          const errorText = await patchResponse.text();
          errors.push(`${number.phoneNumber}: ${patchResponse.status} - ${errorText}`);
          failed++;
        }
      } catch (err) {
        errors.push(`${number.phoneNumber}: ${err instanceof Error ? err.message : "Unknown error"}`);
        failed++;
      }
    }

    return {
      success: failed === 0,
      updated,
      failed,
      errors,
    };
  } catch (error) {
    console.error("[Messaging Profile Backfill] Error:", error);
    return {
      success: false,
      updated,
      failed,
      errors: [error instanceof Error ? error.message : "Failed to backfill messaging profile"],
    };
  }
}

export interface ReleaseNumberResult {
  success: boolean;
  phoneNumber?: string;
  error?: string;
}

export async function releasePhoneNumber(
  phoneNumberId: string,
  companyId: string
): Promise<ReleaseNumberResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Get the company's managed account ID
    const managedAccountId = await getCompanyTelnyxAccountId(companyId);
    
    if (!managedAccountId) {
      return {
        success: false,
        error: "Company Telnyx account not found.",
      };
    }
    
    // First, get the phone number details from local DB
    const [localNumber] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(and(
        eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId),
        eq(telnyxPhoneNumbers.companyId, companyId)
      ))
      .limit(1);
    
    const phoneNumber = localNumber?.phoneNumber || phoneNumberId;
    
    console.log(`[Telnyx Numbers] Releasing ${phoneNumber} (ID: ${phoneNumberId}) for company ${companyId}`);
    
    // Build headers
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["x-managed-account-id"] = managedAccountId;
    }
    
    // Delete the phone number from Telnyx
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "DELETE",
      headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Numbers] Release error: ${response.status} - ${errorText}`);
      
      // If 404, the number doesn't exist in Telnyx - still clean up local DB
      if (response.status !== 404) {
        return {
          success: false,
          error: `Failed to release number from Telnyx: ${response.status}`,
        };
      }
      console.log(`[Telnyx Numbers] Number not found in Telnyx (404), cleaning up local record anyway`);
    }
    
    // Delete from local database if exists
    if (localNumber) {
      await db
        .delete(telnyxPhoneNumbers)
        .where(eq(telnyxPhoneNumbers.id, localNumber.id));
      
      console.log(`[Telnyx Numbers] Deleted local record for ${phoneNumber}`);
    }
    
    console.log(`[Telnyx Numbers] Successfully released ${phoneNumber}`);
    
    return {
      success: true,
      phoneNumber,
    };
  } catch (error) {
    console.error("[Telnyx Numbers] Release error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to release phone number",
    };
  }
}
