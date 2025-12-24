import { db } from "../db";
import { wallets, companies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { credentialProvider } from "./credential-provider";

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
  messagingProfileId?: string;
  texmlApplicationId?: string;
  connectionId?: string;
  error?: string;
}

async function getTelnyxMasterApiKey(): Promise<string> {
  const { apiKey } = await credentialProvider.getTelnyx();
  if (!apiKey) {
    throw new Error("Telnyx API key not configured in database");
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
 * Creates a Messaging Profile for SMS/MMS handling
 * - Connects incoming messages to our webhook
 * - Enables sticky sender for consistent number assignment
 * - Optimizes for toll-free and long code delivery
 */
async function createMessagingProfile(
  accountApiToken: string,
  organizationName: string,
  webhookUrl: string
): Promise<{ success: boolean; profileId?: string; error?: string }> {
  try {
    console.log(`[Telnyx] Creating Messaging Profile for: ${organizationName}`);

    const response = await fetch(`${TELNYX_API_BASE}/messaging_profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accountApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Curbe SMS Profile (${organizationName})`,
        enabled: true,
        webhook_url: webhookUrl,
        webhook_failover_url: null,
        webhook_api_version: "2",
        number_pool_settings: {
          toll_free_weight: 10, // Prefer toll-free for better deliverability
          long_code_weight: 1,
          skip_unhealthy: true, // Skip numbers with delivery issues
          sticky_sender: true, // Keep same sender for conversation
          geomatch: false, // We're US only, no need for geo matching
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx] Messaging Profile Error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to create messaging profile: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx] Messaging Profile created: ${result.data.id}`);

    return {
      success: true,
      profileId: result.data.id,
    };
  } catch (error) {
    console.error("[Telnyx] Error creating Messaging Profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create messaging profile",
    };
  }
}

/**
 * Creates a TeXML Application for voice call handling
 * - Routes incoming calls to our webhook
 * - Enables outbound calling
 * - Links to the outbound voice profile for restrictions
 */
async function createTeXMLApplication(
  accountApiToken: string,
  organizationName: string,
  webhookUrl: string,
  outboundVoiceProfileId?: string
): Promise<{ success: boolean; applicationId?: string; connectionId?: string; error?: string }> {
  try {
    console.log(`[Telnyx] Creating TeXML Application for: ${organizationName}`);

    const response = await fetch(`${TELNYX_API_BASE}/texml_applications`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accountApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        friendly_name: `Curbe Voice App (${organizationName})`,
        active: true,
        voice_url: webhookUrl,
        voice_method: "POST",
        voice_fallback_url: null,
        status_callback: webhookUrl,
        status_callback_method: "POST",
        outbound_voice_profile_id: outboundVoiceProfileId || null,
        first_command_timeout_secs: 30,
        dtmf_type: "inband",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx] TeXML Application Error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to create TeXML application: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx] TeXML Application created: ${result.data.id}`);

    return {
      success: true,
      applicationId: result.data.id,
      connectionId: result.data.connection_id,
    };
  } catch (error) {
    console.error("[Telnyx] Error creating TeXML Application:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create TeXML application",
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
 * - Messaging Profile (for SMS/MMS)
 * - TeXML Application (for voice calls)
 */
export async function createSubAccount(
  organizationName: string,
  companyId: string
): Promise<CreateSubAccountResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

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

    // Get webhook base URL from environment
    const webhookBaseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://app.curbe.io"; // Production fallback
    
    const smsWebhookUrl = `${webhookBaseUrl}/webhooks/telnyx/messages`;
    const voiceWebhookUrl = `${webhookBaseUrl}/webhooks/telnyx/voice`;

    // Step 2: Create restrictive Outbound Voice Profile (US only, $25 cap)
    const voiceProfileResult = await createOutboundVoiceProfile(apiToken, organizationName);
    
    if (!voiceProfileResult.success) {
      console.warn(`[Telnyx] Warning: Voice profile creation failed: ${voiceProfileResult.error}`);
    }

    // Step 3: Create Messaging Profile (for SMS/MMS)
    const messagingProfileResult = await createMessagingProfile(apiToken, organizationName, smsWebhookUrl);
    
    if (!messagingProfileResult.success) {
      console.warn(`[Telnyx] Warning: Messaging profile creation failed: ${messagingProfileResult.error}`);
    }

    // Step 4: Create TeXML Application (for voice calls)
    const texmlResult = await createTeXMLApplication(
      apiToken, 
      organizationName, 
      voiceWebhookUrl,
      voiceProfileResult.profileId
    );
    
    if (!texmlResult.success) {
      console.warn(`[Telnyx] Warning: TeXML application creation failed: ${texmlResult.error}`);
    }

    console.log(`[Telnyx] Full account setup complete for ${organizationName}:`);
    console.log(`[Telnyx] - Account ID: ${accountId}`);
    console.log(`[Telnyx] - Voice Profile ID: ${voiceProfileResult.profileId || "FAILED"}`);
    console.log(`[Telnyx] - Messaging Profile ID: ${messagingProfileResult.profileId || "FAILED"}`);
    console.log(`[Telnyx] - TeXML App ID: ${texmlResult.applicationId || "FAILED"}`);
    console.log(`[Telnyx] - Restrictions: US only, $${SAFETY_CAP_AMOUNT} safety cap`);

    return {
      success: true,
      accountId: accountId,
      apiToken: apiToken,
      outboundVoiceProfileId: voiceProfileResult.profileId,
      messagingProfileId: messagingProfileResult.profileId,
      texmlApplicationId: texmlResult.applicationId,
      connectionId: texmlResult.connectionId,
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
    const apiKey = await getTelnyxMasterApiKey();

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
    const apiKey = await getTelnyxMasterApiKey();

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
 * 
 * @param companyId - The company ID
 * @param userId - Optional user ID for user-scoped wallet creation
 */
export async function setupPhoneSystemForCompany(companyId: string, userId?: string): Promise<{
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
    // Check if company already has a Telnyx account in any wallet
    const existingTelnyxAccountId = await getCompanyTelnyxAccountId(companyId);
    
    if (existingTelnyxAccountId) {
      console.log(`[Telnyx] Company ${companyId} already has Telnyx account: ${existingTelnyxAccountId}`);
      
      // If userId provided, ensure user has a wallet with the shared telnyxAccountId
      if (userId) {
        const { getOrCreateWallet } = await import("./wallet-service");
        const userWallet = await getOrCreateWallet(companyId, userId);
        return {
          success: true,
          alreadySetup: true,
          wallet: {
            id: userWallet.id,
            telnyxAccountId: existingTelnyxAccountId,
            balance: userWallet.balance,
          },
        };
      }
      
      // Get any wallet for backward compatibility
      const [existingWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.companyId, companyId));
        
      return {
        success: true,
        alreadySetup: true,
        wallet: {
          id: existingWallet.id,
          telnyxAccountId: existingTelnyxAccountId,
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

    // Check if user already has a wallet (without telnyx account)
    let existingWallet: typeof wallets.$inferSelect | undefined;
    if (userId) {
      const [userWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.ownerUserId, userId));
      existingWallet = userWallet;
    } else {
      const [companyWallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.companyId, companyId));
      existingWallet = companyWallet;
    }

    if (existingWallet) {
      await db
        .update(wallets)
        .set({
          telnyxAccountId: subAccountResult.accountId,
          telnyxApiToken: subAccountResult.apiToken,
          telnyxMessagingProfileId: subAccountResult.messagingProfileId || null,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, existingWallet.id));

      console.log(`[Telnyx] Updated existing wallet ${existingWallet.id} with Telnyx account and messaging profile: ${subAccountResult.messagingProfileId}`);

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
        ownerUserId: userId || null,
        telnyxAccountId: subAccountResult.accountId,
        telnyxApiToken: subAccountResult.apiToken,
        telnyxMessagingProfileId: subAccountResult.messagingProfileId || null,
      })
      .returning();

    console.log(`[Telnyx] Created new wallet ${newWallet.id} with Telnyx account and messaging profile: ${subAccountResult.messagingProfileId}`);

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

/**
 * Get the company's shared Telnyx account ID from any wallet in the company
 * This is used for Telnyx API calls (shared account at company level)
 */
export async function getCompanyTelnyxAccountId(companyId: string): Promise<string | null> {
  const [walletWithTelnyx] = await db
    .select({ telnyxAccountId: wallets.telnyxAccountId })
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  // Return the first non-null telnyxAccountId found
  if (walletWithTelnyx?.telnyxAccountId) {
    return walletWithTelnyx.telnyxAccountId;
  }
  return null;
}

export async function getSubAccountApiToken(companyId: string): Promise<string | null> {
  const [wallet] = await db
    .select({ telnyxApiToken: wallets.telnyxApiToken })
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  return wallet?.telnyxApiToken || null;
}

/**
 * Get the company's Telnyx messaging profile ID for SMS/MMS
 */
export async function getCompanyMessagingProfileId(companyId: string): Promise<string | null> {
  const [wallet] = await db
    .select({ messagingProfileId: wallets.telnyxMessagingProfileId })
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  return wallet?.messagingProfileId || null;
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

/**
 * Repair messaging profile webhooks for all companies
 * Updates webhook URLs to point to current dev/production domain
 */
export async function repairMessagingProfileWebhooks(): Promise<void> {
  try {
    const webhookBaseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://app.curbe.io";
    
    const smsWebhookUrl = `${webhookBaseUrl}/webhooks/telnyx/messages`;
    
    // Get all companies with messaging profiles
    const companiesWithProfiles = await db
      .select({
        companyId: wallets.companyId,
        messagingProfileId: wallets.telnyxMessagingProfileId,
        telnyxAccountId: wallets.telnyxAccountId,
      })
      .from(wallets)
      .where(sql`${wallets.telnyxMessagingProfileId} IS NOT NULL`);
    
    const apiKey = await getTelnyxMasterApiKey();
    
    for (const company of companiesWithProfiles) {
      if (!company.messagingProfileId) continue;
      
      try {
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        };
        
        // Add managed account header if not master account
        if (company.telnyxAccountId && company.telnyxAccountId !== "MASTER_ACCOUNT") {
          headers["x-managed-account-id"] = company.telnyxAccountId;
        }
        
        const response = await fetch(`${TELNYX_API_BASE}/messaging_profiles/${company.messagingProfileId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            webhook_url: smsWebhookUrl,
          }),
        });
        
        if (response.ok) {
          console.log(`[Messaging Profile Repair] Updated webhook for company ${company.companyId} to ${smsWebhookUrl}`);
        } else {
          const errorText = await response.text();
          console.error(`[Messaging Profile Repair] Failed for company ${company.companyId}: ${response.status} - ${errorText}`);
        }
      } catch (error) {
        console.error(`[Messaging Profile Repair] Error for company ${company.companyId}:`, error);
      }
    }
    
    console.log(`[Messaging Profile Repair] Completed webhook repair for ${companiesWithProfiles.length} companies`);
  } catch (error) {
    console.error("[Messaging Profile Repair] Error:", error);
  }
}
