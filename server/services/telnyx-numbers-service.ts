import { db } from "../db";
import { wallets, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { SecretsService } from "./secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const secretsService = new SecretsService();

async function getTelnyxMasterApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured. Please add it in Settings > API Keys.");
  }
  // Trim whitespace and remove any invisible characters
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
  console.log(`[Telnyx] API key loaded, prefix: ${apiKey.substring(0, 10)}..., length: ${apiKey.length}, last char code: ${apiKey.charCodeAt(apiKey.length - 1)}`);
  return apiKey;
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
    
    // Use page[size] and page[number] for proper pagination
    const pageSize = params.limit || 50;
    const pageNumber = params.page || 1;
    queryParams.append("page[size]", String(pageSize));
    queryParams.append("page[number]", String(pageNumber));

    console.log(`[Telnyx Numbers] Searching page ${pageNumber} with params: ${queryParams.toString()}`);

    const response = await fetch(`${TELNYX_API_BASE}/available_phone_numbers?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Numbers] Search error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Telnyx API error: ${response.status}`,
      };
    }

    const result = await response.json();
    
    const meta = result.meta || {};
    console.log(`[Telnyx Numbers] Found ${result.data?.length || 0} numbers on page ${meta.page_number || pageNumber} of ${meta.total_pages || 1}`);

    return {
      success: true,
      numbers: result.data || [],
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

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    if (!wallet) {
      return {
        success: false,
        error: "Company wallet not found. Please setup phone system first.",
      };
    }

    // Check if company has a managed account
    const managedAccountId = wallet.telnyxAccountId;
    
    console.log(`[Telnyx Numbers] Purchasing ${phoneNumber} for company ${companyId}${managedAccountId ? ` (managed account: ${managedAccountId})` : ''}`);

    // Build headers - include managed account header if available
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (managedAccountId) {
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
    
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return {
        success: false,
        error: "Company wallet or Telnyx account not found"
      };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-managed-account-id": wallet.telnyxAccountId,
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
    
    return {
      success: true,
      cnamEnabled: cnamListing?.cnam_listing_enabled ?? enabled,
      cnamName: cnamListing?.cnam_listing_details ?? cnamDetails,
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
    
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (!wallet?.telnyxAccountId) {
      return {
        success: false,
        error: "Company wallet or Telnyx account not found"
      };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      "x-managed-account-id": wallet.telnyxAccountId,
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
      "x-managed-account-id": wallet.telnyxAccountId,
    };
    
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
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
    
    return {
      success: true,
      cnamListing: {
        enabled: data?.cnam_listing?.cnam_listing_enabled || false,
        details: data?.cnam_listing?.cnam_listing_details || "",
      },
      callRecording: {
        inboundEnabled: data?.call_recording?.inbound_call_recording_enabled || false,
        format: data?.call_recording?.inbound_call_recording_format || "mp3",
        channels: data?.call_recording?.inbound_call_recording_channels || "single",
      },
      inboundCallScreening: data?.inbound_call_screening || "disabled",
      callerIdNameEnabled: data?.caller_id_name_enabled || false,
      callForwarding: {
        enabled: data?.call_forwarding?.call_forwarding_enabled || false,
        destination: data?.call_forwarding?.forwarding_destination_number || "",
        keepCallerId: data?.call_forwarding?.keep_caller_id || true,
      },
    };
  } catch (error) {
    console.error("[Telnyx Voice] Get settings error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to get voice settings" };
  }
}

/**
 * Update call recording settings for a phone number
 */
export async function updateCallRecording(
  phoneNumberId: string,
  companyId: string,
  enabled: boolean,
  format: "mp3" | "wav" = "mp3",
  channels: "single" | "dual" = "single"
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
      "x-managed-account-id": wallet.telnyxAccountId,
    };
    
    const payload = {
      call_recording: {
        inbound_call_recording_enabled: enabled,
        inbound_call_recording_format: format,
        inbound_call_recording_channels: channels,
      },
    };
    
    console.log(`[Telnyx Call Recording] Updating. Number ID: ${phoneNumberId}, enabled=${enabled}, format=${format}, channels=${channels}`);
    
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Call Recording] Update error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to update call recording: ${response.status} - ${errorText}` };
    }
    
    const result = await response.json();
    console.log(`[Telnyx Call Recording] Update successful:`, JSON.stringify(result.data?.call_recording, null, 2));
    
    return { success: true };
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
      "x-managed-account-id": wallet.telnyxAccountId,
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
 */
export async function updateCallForwarding(
  phoneNumberId: string,
  companyId: string,
  enabled: boolean,
  destination?: string,
  keepCallerId: boolean = true
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

    // Validate destination is E.164 US number if enabled
    if (enabled && destination) {
      const cleanNumber = destination.replace(/\D/g, "");
      if (!cleanNumber.match(/^1?\d{10}$/)) {
        return { success: false, error: "Destination must be a valid US phone number" };
      }
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-managed-account-id": wallet.telnyxAccountId,
    };
    
    const payload: Record<string, any> = {
      call_forwarding: {
        call_forwarding_enabled: enabled,
        keep_caller_id: keepCallerId,
      },
    };

    // Add destination if provided
    if (destination) {
      let normalizedDest = destination.replace(/\D/g, "");
      if (!normalizedDest.startsWith("1") && normalizedDest.length === 10) {
        normalizedDest = "1" + normalizedDest;
      }
      payload.call_forwarding.forwarding_destination_number = `+${normalizedDest}`;
    }
    
    console.log(`[Telnyx Call Forwarding] Updating. Number ID: ${phoneNumberId}, enabled=${enabled}, destination=${destination}`);
    
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/voice`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Call Forwarding] Update error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to update call forwarding: ${response.status} - ${errorText}` };
    }
    
    const result = await response.json();
    console.log(`[Telnyx Call Forwarding] Update successful:`, JSON.stringify(result.data?.call_forwarding, null, 2));
    
    return { success: true };
  } catch (error) {
    console.error("[Telnyx Call Forwarding] Update error:", error);
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
      "x-managed-account-id": wallet.telnyxAccountId,
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
      "x-managed-account-id": wallet.telnyxAccountId,
    };
    
    const payload = {
      enabled,
      pin: parseInt(pin, 10),
    };
    
    console.log(`[Telnyx Voicemail] Updating. Number ID: ${phoneNumberId}, enabled=${enabled}`);
    
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
    
    if (wallet.telnyxAccountId) {
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

    return {
      success: true,
      numbers: result.data || [],
    };
  } catch (error) {
    console.error("[Telnyx Numbers] Get numbers error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get phone numbers",
    };
  }
}
