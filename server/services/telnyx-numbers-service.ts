import { db } from "../db";
import { wallets, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { SecretsService } from "./secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const secretsService = new SecretsService();

async function getTelnyxMasterApiKey(): Promise<string> {
  const apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured. Please add it in Settings > API Keys.");
  }
  return apiKey;
}

export interface AvailablePhoneNumber {
  phone_number: string;
  record_type: string;
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
  features?: string[];
  limit?: number;
}

export interface SearchNumbersResult {
  success: boolean;
  numbers?: AvailablePhoneNumber[];
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
    
    if (params.features && params.features.length > 0) {
      params.features.forEach(feature => {
        queryParams.append("filter[features][]", feature);
      });
    }
    
    queryParams.append("filter[limit]", String(params.limit || 10));

    console.log(`[Telnyx Numbers] Searching with params: ${queryParams.toString()}`);

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
    
    console.log(`[Telnyx Numbers] Found ${result.data?.length || 0} numbers`);

    return {
      success: true,
      numbers: result.data || [],
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

    console.log(`[Telnyx Numbers] Purchasing ${phoneNumber} for company ${companyId}`);

    const response = await fetch(`${TELNYX_API_BASE}/number_orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
    
    console.log(`[Telnyx Numbers] Number purchased successfully:`, result.data?.id);

    return {
      success: true,
      orderId: result.data?.id,
      phoneNumber: phoneNumber,
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

    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers?filter[connection_id]=${wallet.telnyxAccountId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
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
