import { db } from "../db";
import { wallets, companies, telephonySettings, telnyxPhoneNumbers } from "@shared/schema";
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

    // If order is success, try to get the actual phone number ID from phone_numbers API
    // The ID from number_order may be different from the actual phone_number ID
    if (orderStatus === "success" || orderStatus === "pending") {
      // Wait a moment for Telnyx to process the order
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Search for the number in the account to get its real ID
        const searchResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`, {
          method: "GET",
          headers,
        });
        
        if (searchResponse.ok) {
          const searchResult = await searchResponse.json();
          const foundNumber = searchResult.data?.find((n: any) => n.phone_number === phoneNumber);
          if (foundNumber?.id) {
            phoneNumberId = foundNumber.id;
            console.log(`[Telnyx Numbers] Found actual phone number ID: ${phoneNumberId}`);
          }
        }
      } catch (searchError) {
        console.warn(`[Telnyx Numbers] Could not fetch phone number ID, will use order ID: ${phoneNumberId}`);
      }
    }

    console.log(`[Telnyx Numbers] Number purchased successfully - Order ID: ${orderId}, Final Phone Number ID: ${phoneNumberId}`);

    // Get credential connection ID for the company to assign for incoming calls
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (settings?.credentialConnectionId && phoneNumberId) {
      // Assign the phone number to the credential connection for incoming WebRTC calls
      console.log(`[Telnyx Numbers] Assigning number ${phoneNumber} to credential connection ${settings.credentialConnectionId}`);
      
      try {
        const patchResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            connection_id: settings.credentialConnectionId,
          }),
        });

        if (patchResponse.ok) {
          console.log(`[Telnyx Numbers] Number ${phoneNumber} assigned to credential connection successfully`);
        } else {
          const patchError = await patchResponse.text();
          console.error(`[Telnyx Numbers] Failed to assign number to connection: ${patchError}`);
        }
      } catch (patchErr) {
        console.error(`[Telnyx Numbers] Error assigning number to connection:`, patchErr);
      }
    }

    // Save the phone number to the database
    if (phoneNumberId) {
      try {
        await db.insert(telnyxPhoneNumbers).values({
          companyId,
          phoneNumber,
          telnyxPhoneNumberId: phoneNumberId,
          connectionId: settings?.credentialConnectionId || null,
          status: "active",
        });
        console.log(`[Telnyx Numbers] Number ${phoneNumber} saved to database`);
      } catch (dbErr) {
        console.error(`[Telnyx Numbers] Error saving number to database:`, dbErr);
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

export async function syncPhoneNumbersToCredentialConnection(companyId: string): Promise<{
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
      return { success: false, syncedCount: 0, error: "No managed account found" };
    }

    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (!settings?.credentialConnectionId) {
      return { success: false, syncedCount: 0, error: "No credential connection found" };
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "x-managed-account-id": wallet.telnyxAccountId,
    };

    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, syncedCount: 0, error: `Failed to get numbers: ${errorText}` };
    }

    const result = await response.json();
    const numbers = result.data || [];
    let syncedCount = 0;

    for (const number of numbers) {
      const phoneNumberId = number.id;
      const phoneNumber = number.phone_number;
      const currentConnectionId = number.connection_id;

      // Skip if already assigned to correct connection
      if (currentConnectionId === settings.credentialConnectionId) {
        console.log(`[Telnyx Numbers] Number ${phoneNumber} already assigned to credential connection`);
        syncedCount++;
        continue;
      }

      // Assign to credential connection
      console.log(`[Telnyx Numbers] Assigning ${phoneNumber} to credential connection ${settings.credentialConnectionId}`);
      
      const patchResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          connection_id: settings.credentialConnectionId,
        }),
      });

      if (patchResponse.ok) {
        console.log(`[Telnyx Numbers] Number ${phoneNumber} assigned successfully`);
        syncedCount++;

        // Save to database if not exists
        const [existing] = await db
          .select()
          .from(telnyxPhoneNumbers)
          .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));

        if (!existing) {
          await db.insert(telnyxPhoneNumbers).values({
            companyId,
            phoneNumber,
            telnyxPhoneNumberId: phoneNumberId,
            connectionId: settings.credentialConnectionId,
            status: "active",
          });
        } else {
          await db
            .update(telnyxPhoneNumbers)
            .set({ connectionId: settings.credentialConnectionId, updatedAt: new Date() })
            .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));
        }
      } else {
        const patchError = await patchResponse.text();
        console.error(`[Telnyx Numbers] Failed to assign ${phoneNumber}: ${patchError}`);
      }
    }

    return { success: true, syncedCount };
  } catch (error) {
    console.error("[Telnyx Numbers] Sync error:", error);
    return {
      success: false,
      syncedCount: 0,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}
