import { db } from "../db";
import { wallets, companies } from "@shared/schema";
import { eq } from "drizzle-orm";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

// Email masking configuration for white-label privacy
const ADMIN_EMAIL_BASE = "hello";
const ADMIN_DOMAIN = "curbe.io";

// Security configuration
const SAFETY_CAP_AMOUNT = "25.00"; // Emergency kill-switch limit
const SAFETY_CAP_CURRENCY = "USD";
const SERVICE_PLAN = "us"; // US domestic only - blocks international fraud

interface TelnyxManagedAccountResponse {
  data: {
    id: string;
    api_key: string;
    api_token: string;
    api_user: string;
    email: string;
    organization_name: string;
    manager_account_id: string;
    created_at: string;
    updated_at: string;
    record_type: string;
  };
}

interface TelnyxOutboundVoiceProfileResponse {
  data: {
    id: string;
    name: string;
    traffic_type: string;
    service_plan: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
  };
}

interface CreateSubAccountResult {
  success: boolean;
  accountId?: string;
  apiToken?: string;
  outboundVoiceProfileId?: string;
  error?: string;
}

function getTelnyxMasterApiKey(): string {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) {
    throw new Error("TELNYX_API_KEY environment variable is not set");
  }
  return apiKey;
}

/**
 * Creates a restrictive Outbound Voice Profile for a managed account
 * - USA only (service_plan: "us")
 * - $25 safety cap (emergency kill-switch)
 * - Blocks calls if limit is reached
 */
async function createOutboundVoiceProfile(
  accountApiToken: string,
  organizationName: string
): Promise<{ success: boolean; profileId?: string; error?: string }> {
  try {
    console.log(`[Telnyx] Creating restrictive Outbound Voice Profile for: ${organizationName}`);

    const response = await fetch(`${TELNYX_API_BASE}/outbound_voice_profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accountApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Curbe Plan - US Only (${organizationName})`,
        traffic_type: "conversational",
        service_plan: SERVICE_PLAN, // US domestic only - optimizes routes, blocks international
        usage_limit: {
          amount: SAFETY_CAP_AMOUNT,
          currency_code: SAFETY_CAP_CURRENCY,
          action: "block", // Kill-switch: block calls if $25 limit reached
        },
        enabled: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx] Outbound Voice Profile Error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to create voice profile: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json() as TelnyxOutboundVoiceProfileResponse;
    console.log(`[Telnyx] Outbound Voice Profile created: ${result.data.id} (US only, $${SAFETY_CAP_AMOUNT} cap)`);

    return {
      success: true,
      profileId: result.data.id,
    };
  } catch (error) {
    console.error("[Telnyx] Error creating Outbound Voice Profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create voice profile",
    };
  }
}

/**
 * Creates a Telnyx Managed Account with:
 * - rollup_billing: true (all charges go to master account)
 * - Masked email for white-label privacy
 * - Organization name for identification
 * 
 * After account creation, also creates:
 * - Restrictive Outbound Voice Profile (USA only, $25 cap)
 */
export async function createSubAccount(
  organizationName: string,
  companyId: string
): Promise<CreateSubAccountResult> {
  try {
    const apiKey = getTelnyxMasterApiKey();

    // Generate masked email using company ID for white-label privacy
    // All emails go to hello@curbe.io but appear as unique users to Telnyx
    const maskedEmail = `${ADMIN_EMAIL_BASE}+${companyId}@${ADMIN_DOMAIN}`;

    console.log(`[Telnyx] Creating managed account for: ${organizationName}`);
    console.log(`[Telnyx] - Email: ${maskedEmail}`);
    console.log(`[Telnyx] - rollup_billing: true (consolidated billing)`);
    console.log(`[Telnyx] - Will create US-only voice profile with $${SAFETY_CAP_AMOUNT} cap`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name: organizationName,
        organization_name: organizationName,
        email: maskedEmail,
        rollup_billing: true, // CRITICAL: Consolidate all billing to master account
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx] API Error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Telnyx API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json() as TelnyxManagedAccountResponse;
    const accountId = result.data.id;
    const apiToken = result.data.api_token;

    console.log(`[Telnyx] Managed account created: ${accountId}`);

    // Step 2: Create restrictive Outbound Voice Profile
    const voiceProfileResult = await createOutboundVoiceProfile(apiToken, organizationName);
    
    if (!voiceProfileResult.success) {
      console.warn(`[Telnyx] Warning: Account created but voice profile failed: ${voiceProfileResult.error}`);
      // Still return success for account, but log the warning
    } else {
      console.log(`[Telnyx] Full setup complete for ${organizationName}:`);
      console.log(`[Telnyx] - Account ID: ${accountId}`);
      console.log(`[Telnyx] - Voice Profile ID: ${voiceProfileResult.profileId}`);
      console.log(`[Telnyx] - Restrictions: US only, $${SAFETY_CAP_AMOUNT} safety cap`);
    }

    return {
      success: true,
      accountId: accountId,
      apiToken: apiToken,
      outboundVoiceProfileId: voiceProfileResult.profileId,
    };
  } catch (error) {
    console.error("[Telnyx] Error creating sub-account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create sub-account",
    };
  }
}

export async function getManagedAccount(accountId: string): Promise<TelnyxManagedAccountResponse["data"] | null> {
  try {
    const apiKey = getTelnyxMasterApiKey();

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[Telnyx] Failed to get managed account: ${response.status}`);
      return null;
    }

    const result = await response.json() as TelnyxManagedAccountResponse;
    return result.data;
  } catch (error) {
    console.error("[Telnyx] Error getting managed account:", error);
    return null;
  }
}

export async function listManagedAccounts(): Promise<TelnyxManagedAccountResponse["data"][]> {
  try {
    const apiKey = getTelnyxMasterApiKey();

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[Telnyx] Failed to list managed accounts: ${response.status}`);
      return [];
    }

    const result = await response.json() as { data: TelnyxManagedAccountResponse["data"][] };
    return result.data;
  } catch (error) {
    console.error("[Telnyx] Error listing managed accounts:", error);
    return [];
  }
}

/**
 * Sets up the complete phone system for a company:
 * 1. Creates Telnyx Managed Account (with rollup_billing)
 * 2. Creates restrictive Outbound Voice Profile (US only, $25 cap)
 * 3. Stores account info in wallet
 */
export async function setupPhoneSystemForCompany(companyId: string): Promise<{
  success: boolean;
  wallet?: {
    id: string;
    telnyxAccountId: string;
    balance: string;
  };
  error?: string;
  alreadySetup?: boolean;
}> {
  try {
    const [existingWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    if (existingWallet?.telnyxAccountId) {
      console.log(`[Telnyx] Company ${companyId} already has Telnyx account: ${existingWallet.telnyxAccountId}`);
      return {
        success: true,
        alreadySetup: true,
        wallet: {
          id: existingWallet.id,
          telnyxAccountId: existingWallet.telnyxAccountId,
          balance: existingWallet.balance,
        },
      };
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return {
        success: false,
        error: "Company not found",
      };
    }

    const subAccountResult = await createSubAccount(company.name, companyId);

    if (!subAccountResult.success || !subAccountResult.accountId || !subAccountResult.apiToken) {
      return {
        success: false,
        error: subAccountResult.error || "Failed to create Telnyx sub-account",
      };
    }

    if (existingWallet) {
      await db
        .update(wallets)
        .set({
          telnyxAccountId: subAccountResult.accountId,
          telnyxApiToken: subAccountResult.apiToken,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, existingWallet.id));

      console.log(`[Telnyx] Updated existing wallet ${existingWallet.id} with Telnyx account`);

      return {
        success: true,
        wallet: {
          id: existingWallet.id,
          telnyxAccountId: subAccountResult.accountId,
          balance: existingWallet.balance,
        },
      };
    }

    const [newWallet] = await db
      .insert(wallets)
      .values({
        companyId,
        telnyxAccountId: subAccountResult.accountId,
        telnyxApiToken: subAccountResult.apiToken,
      })
      .returning();

    console.log(`[Telnyx] Created new wallet ${newWallet.id} with Telnyx account for company ${companyId}`);

    return {
      success: true,
      wallet: {
        id: newWallet.id,
        telnyxAccountId: subAccountResult.accountId,
        balance: newWallet.balance,
      },
    };
  } catch (error) {
    console.error("[Telnyx] Error setting up phone system:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to setup phone system",
    };
  }
}

export async function getSubAccountApiToken(companyId: string): Promise<string | null> {
  const [wallet] = await db
    .select({ telnyxApiToken: wallets.telnyxApiToken })
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  return wallet?.telnyxApiToken || null;
}

export async function makeSubAccountRequest(
  companyId: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: any
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const apiToken = await getSubAccountApiToken(companyId);
    
    if (!apiToken) {
      return { success: false, error: "No Telnyx API token found for this company" };
    }

    const response = await fetch(`${TELNYX_API_BASE}${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Telnyx API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("[Telnyx] Sub-account request failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

/**
 * Retrieves the Outbound Voice Profiles for a managed account
 */
export async function getOutboundVoiceProfiles(companyId: string): Promise<{
  success: boolean;
  profiles?: any[];
  error?: string;
}> {
  try {
    const apiToken = await getSubAccountApiToken(companyId);
    
    if (!apiToken) {
      return { success: false, error: "No Telnyx API token found for this company" };
    }

    const response = await fetch(`${TELNYX_API_BASE}/outbound_voice_profiles`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Telnyx API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, profiles: result.data };
  } catch (error) {
    console.error("[Telnyx] Error getting voice profiles:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to get voice profiles" };
  }
}

/**
 * Updates the usage limit (safety cap) for an Outbound Voice Profile
 */
export async function updateVoiceProfileLimit(
  companyId: string,
  profileId: string,
  newLimit: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiToken = await getSubAccountApiToken(companyId);
    
    if (!apiToken) {
      return { success: false, error: "No Telnyx API token found for this company" };
    }

    const response = await fetch(`${TELNYX_API_BASE}/outbound_voice_profiles/${profileId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usage_limit: {
          amount: newLimit,
          currency_code: SAFETY_CAP_CURRENCY,
          action: "block",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Telnyx API error: ${response.status} - ${errorText}` };
    }

    console.log(`[Telnyx] Updated voice profile ${profileId} limit to $${newLimit}`);
    return { success: true };
  } catch (error) {
    console.error("[Telnyx] Error updating voice profile limit:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update limit" };
  }
}
