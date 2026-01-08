import { db } from "../db";
import { wallets, companies } from "@shared/schema";
import { eq, isNotNull, sql } from "drizzle-orm";
import { SecretsService } from "./secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const secretsService = new SecretsService();

// Email masking configuration for white-label
const ADMIN_EMAIL_BASE = "hello";
const ADMIN_DOMAIN = "curbe.io";

async function getTelnyxMasterApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured. Please add it in Settings > API Keys.");
  }
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
  return apiKey;
}

export interface ManagedAccountInfo {
  id: string;
  email: string;
  api_key: string;
  api_token: string;
  api_user: string;
  business_name: string;
  created_at: string;
  updated_at: string;
  managed_account_allow_custom_pricing: boolean;
}

export interface CreateManagedAccountResult {
  success: boolean;
  managedAccount?: ManagedAccountInfo;
  error?: string;
}

export interface GetManagedAccountResult {
  success: boolean;
  managedAccount?: ManagedAccountInfo;
  error?: string;
}

export async function createManagedAccount(
  businessName: string,
  companySlug: string
): Promise<CreateManagedAccountResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    // Generate UNIQUE masked email using company slug + timestamp to prevent conflicts
    const timestamp = Date.now();
    const maskedEmail = `${ADMIN_EMAIL_BASE}+${companySlug}-${timestamp}@${ADMIN_DOMAIN}`;

    const requestBody = {
      business_name: businessName,
      organization_name: businessName,
      email: maskedEmail,
      rollup_billing: true, // CRITICAL: Consolidate billing to master account
    };

    console.log(`[Telnyx Managed] Creating managed account for: ${businessName} with email: ${maskedEmail}`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Managed] Create error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to create managed account: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    const accountId = result.data?.id;
    const creationApiKey = result.data?.api_key;
    console.log(`[Telnyx Managed] Managed account created: ${accountId}`);
    console.log(`[Telnyx Managed] API key from creation response: ${creationApiKey ? creationApiKey.substring(0, 15) + '...' : 'NOT PRESENT'}`);
    
    // If API key is present in creation response, return immediately
    if (accountId && creationApiKey && creationApiKey.startsWith('KEY')) {
      console.log(`[Telnyx Managed] Using API key from creation response`);
      return {
        success: true,
        managedAccount: result.data,
      };
    }

    if (!accountId) {
      return {
        success: false,
        error: "Account created but no ID returned",
      };
    }

    // Step 2: Enable the managed account (required for API key generation)
    console.log(`[Telnyx Managed] Enabling managed account: ${accountId}`);
    const enableResponse = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}/actions/enable`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!enableResponse.ok) {
      const errorText = await enableResponse.text();
      console.error(`[Telnyx Managed] Enable error: ${enableResponse.status} - ${errorText}`);
      // Account created but not enabled - still return success with the account
      return {
        success: true,
        managedAccount: result.data,
      };
    }
    console.log(`[Telnyx Managed] Managed account enabled successfully`);

    // Step 2.5: Configure managed account to allow toll-free number purchases
    // By default, new managed accounts can only order local numbers
    console.log(`[Telnyx Managed] Configuring account to allow toll-free number purchases: ${accountId}`);
    const configResponse = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        allowed_products: {
          number_ordering: {
            enabled: true,
            number_types: ["local", "toll_free", "national", "mobile"],
            countries: ["US", "CA"]
          }
        }
      }),
    });

    if (!configResponse.ok) {
      const errorText = await configResponse.text();
      console.error(`[Telnyx Managed] Config error: ${configResponse.status} - ${errorText}`);
      // Don't fail - account is still usable for local numbers
    } else {
      const configResult = await configResponse.json();
      console.log(`[Telnyx Managed] Account configured for toll-free purchases:`, 
        JSON.stringify(configResult.data?.allowed_products || {}, null, 2));
    }

    // Step 3: Wait and poll for API key (Telnyx generates it async after enable)
    let accountDetails: GetManagedAccountResult | null = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`[Telnyx Managed] Polling for API key (attempt ${attempt}/5)...`);
      
      accountDetails = await getManagedAccount(accountId);
      if (accountDetails.success && accountDetails.managedAccount?.api_key) {
        console.log(`[Telnyx Managed] API key obtained successfully`);
        return {
          success: true,
          managedAccount: accountDetails.managedAccount,
        };
      }
    }

    // Return whatever we have, even without API key
    console.log(`[Telnyx Managed] API key not available after polling, returning account without key`);
    return {
      success: true,
      managedAccount: accountDetails?.managedAccount || result.data,
    };
  } catch (error) {
    console.error("[Telnyx Managed] Create error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create managed account",
    };
  }
}

export async function configureManagedAccountForTollFree(accountId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    console.log(`[Telnyx Managed] Configuring account ${accountId} to allow toll-free number purchases`);
    
    const configResponse = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        allowed_products: {
          number_ordering: {
            enabled: true,
            number_types: ["local", "toll_free", "national", "mobile"],
            countries: ["US", "CA"]
          }
        }
      }),
    });

    if (!configResponse.ok) {
      const errorText = await configResponse.text();
      console.error(`[Telnyx Managed] Config error for ${accountId}: ${configResponse.status} - ${errorText}`);
      return { success: false, error: errorText };
    }
    
    const configResult = await configResponse.json();
    console.log(`[Telnyx Managed] Account ${accountId} configured for toll-free purchases:`, 
      JSON.stringify(configResult.data?.allowed_products || {}, null, 2));
    
    return { success: true };
  } catch (error) {
    console.error(`[Telnyx Managed] Config error for ${accountId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getManagedAccount(accountId: string): Promise<GetManagedAccountResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    console.log(`[Telnyx Managed] Getting managed account: ${accountId}`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Managed] Get error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to get managed account: ${response.status}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx Managed] Got managed account details, api_key exists:`, !!result.data?.api_key);

    return {
      success: true,
      managedAccount: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Managed] Get error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get managed account",
    };
  }
}

/**
 * Create a new API key for a managed account.
 * This creates a real API key that starts with KEY... which is required for Telnyx API calls.
 * The api_token from account creation is NOT the same as an API key.
 */
export async function createManagedAccountApiKey(accountId: string): Promise<{
  success: boolean;
  apiKey?: string;
  error?: string;
}> {
  try {
    const masterApiKey = await getTelnyxMasterApiKey();

    console.log(`[Telnyx Managed] Creating API key for managed account: ${accountId}`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}/api_keys`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${masterApiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Managed] API key creation error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to create API key: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    const apiKey = result.data?.api_key;
    
    if (!apiKey || !apiKey.startsWith('KEY')) {
      console.error(`[Telnyx Managed] Invalid API key returned:`, apiKey?.substring(0, 10));
      return {
        success: false,
        error: "Invalid API key format returned from Telnyx",
      };
    }
    
    console.log(`[Telnyx Managed] API key created successfully for account: ${accountId}, prefix: ${apiKey.substring(0, 10)}...`);

    return {
      success: true,
      apiKey,
    };
  } catch (error) {
    console.error("[Telnyx Managed] API key creation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create API key",
    };
  }
}

/**
 * @deprecated Use createManagedAccountApiKey instead. This returns temporary tokens, not API keys.
 */
export async function regenerateManagedAccountToken(accountId: string): Promise<{
  success: boolean;
  apiToken?: string;
  error?: string;
}> {
  // Redirect to the correct function
  const result = await createManagedAccountApiKey(accountId);
  return {
    success: result.success,
    apiToken: result.apiKey,
    error: result.error,
  };
}

/**
 * Ensure a company has a valid Telnyx API KEY (not token).
 * API keys start with 'KEY' and are required for Telnyx API calls.
 * 
 * CRITICAL: This function creates ONE managed account per company.
 * If an account already exists (telnyxAccountId in wallet), it will NEVER create another.
 * The api_key comes from the account creation response, NOT from a separate endpoint.
 */
export async function ensureCompanyTelnyxToken(companyId: string): Promise<{
  success: boolean;
  apiToken?: string;
  error?: string;
}> {
  try {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    if (!wallet) {
      return { success: false, error: "No wallet found for company" };
    }

    // CASE 1: Already have valid account_id AND valid api_key → use it
    if (wallet.telnyxAccountId && wallet.telnyxApiToken && wallet.telnyxApiToken.startsWith('KEY')) {
      console.log(`[Telnyx Managed] Company ${companyId} has valid API key: ${wallet.telnyxApiToken.substring(0, 10)}...`);
      return { success: true, apiToken: wallet.telnyxApiToken };
    }

    // CASE 2: Have account_id but missing/invalid api_key → try to retrieve from existing account
    if (wallet.telnyxAccountId) {
      console.log(`[Telnyx Managed] Company ${companyId} has account ${wallet.telnyxAccountId} but no valid KEY, fetching account...`);
      
      const accountResult = await getManagedAccount(wallet.telnyxAccountId);
      
      if (accountResult.success && accountResult.managedAccount) {
        const apiKey = accountResult.managedAccount.api_key;
        
        if (apiKey && apiKey.startsWith('KEY')) {
          // Found the api_key in the existing account - save it
          await db
            .update(wallets)
            .set({
              telnyxApiToken: apiKey,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, wallet.id));

          console.log(`[Telnyx Managed] Retrieved API key from existing account: ${apiKey.substring(0, 10)}...`);
          return { success: true, apiToken: apiKey };
        } else {
          // Account exists but has no api_key - this shouldn't happen, but don't create new account
          console.error(`[Telnyx Managed] Account ${wallet.telnyxAccountId} exists but has no api_key. Cannot proceed.`);
          return { success: false, error: "Existing Telnyx account has no API key. Please contact support." };
        }
      } else if (accountResult.error?.includes("404")) {
        // Account truly doesn't exist in Telnyx - this is the ONLY case where we clear and recreate
        console.log(`[Telnyx Managed] Account ${wallet.telnyxAccountId} confirmed deleted in Telnyx, will create new one`);
        // Clear only in this specific case - account was deleted from Telnyx side
        await db
          .update(wallets)
          .set({
            telnyxAccountId: null,
            telnyxApiToken: null,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));
        // Fall through to create new account
      } else {
        // Some other error (network, auth, etc) - DO NOT clear account, just fail
        console.error(`[Telnyx Managed] Error fetching account ${wallet.telnyxAccountId}: ${accountResult.error}`);
        return { success: false, error: accountResult.error || "Failed to verify existing Telnyx account" };
      }
    }

    // CASE 3: No account_id exists → create new managed account
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return { success: false, error: "Company not found" };
    }

    console.log(`[Telnyx Managed] Creating NEW managed account for company ${companyId} (first time)...`);
    
    const companySlug = company.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
    const createResult = await createManagedAccount(company.name, `${companySlug}-${companyId.substring(0, 8)}`);
    
    if (!createResult.success || !createResult.managedAccount) {
      return { success: false, error: createResult.error || "Failed to create managed account" };
    }

    // The API key comes directly from the creation response
    const apiKey = createResult.managedAccount.api_key;
    
    if (!apiKey || !apiKey.startsWith('KEY')) {
      console.error(`[Telnyx Managed] No valid API key in account creation response`);
      // Save account ID so we don't try to create another account
      await db
        .update(wallets)
        .set({
          telnyxAccountId: createResult.managedAccount.id,
          telnyxApiToken: null,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
      
      return { success: false, error: "No API key returned from account creation" };
    }

    // Save both account_id and api_key
    await db
      .update(wallets)
      .set({
        telnyxAccountId: createResult.managedAccount.id,
        telnyxApiToken: apiKey,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    console.log(`[Telnyx Managed] Created account ${createResult.managedAccount.id} with API key ${apiKey.substring(0, 10)}... for company ${companyId}`);

    return { success: true, apiToken: apiKey };
  } catch (error) {
    console.error("[Telnyx Managed] Ensure token error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to ensure token",
    };
  }
}

export async function listManagedAccounts(): Promise<{
  success: boolean;
  accounts?: ManagedAccountInfo[];
  error?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    console.log(`[Telnyx Managed] Listing managed accounts`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts?page[size]=250`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Managed] List error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to list managed accounts: ${response.status}`,
      };
    }

    const result = await response.json();
    console.log(`[Telnyx Managed] Found ${result.data?.length || 0} managed accounts`);

    return {
      success: true,
      accounts: result.data || [],
    };
  } catch (error) {
    console.error("[Telnyx Managed] List error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list managed accounts",
    };
  }
}

/**
 * Find a managed account by email address.
 * Telnyx doesn't support filtering by email directly, so we list all and filter.
 */
export async function findManagedAccountByEmail(email: string): Promise<{
  success: boolean;
  account?: ManagedAccountInfo;
  error?: string;
}> {
  try {
    console.log(`[Telnyx Managed] Searching for account with email: ${email}`);
    
    const listResult = await listManagedAccounts();
    if (!listResult.success || !listResult.accounts) {
      return { success: false, error: listResult.error || "Failed to list accounts" };
    }

    const account = listResult.accounts.find(acc => acc.email === email);
    if (!account) {
      console.log(`[Telnyx Managed] No account found with email: ${email}`);
      return { success: false, error: "Account not found" };
    }

    console.log(`[Telnyx Managed] Found account ${account.id} with email: ${email}`);
    return { success: true, account };
  } catch (error) {
    console.error("[Telnyx Managed] Find by email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to find account",
    };
  }
}

export async function disableManagedAccount(accountId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    console.log(`[Telnyx Managed] Disabling managed account: ${accountId}`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}/actions/disable`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Managed] Disable error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to disable managed account: ${response.status}`,
      };
    }

    console.log(`[Telnyx Managed] Managed account disabled successfully`);

    return { success: true };
  } catch (error) {
    console.error("[Telnyx Managed] Disable error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disable managed account",
    };
  }
}

export async function enableManagedAccount(accountId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    console.log(`[Telnyx Managed] Enabling managed account: ${accountId}`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts/${accountId}/actions/enable`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Managed] Enable error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to enable managed account: ${response.status}`,
      };
    }

    console.log(`[Telnyx Managed] Managed account enabled successfully`);

    return { success: true };
  } catch (error) {
    console.error("[Telnyx Managed] Enable error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to enable managed account",
    };
  }
}

export async function setupCompanyManagedAccount(companyId: string): Promise<{
  success: boolean;
  managedAccountId?: string;
  error?: string;
}> {
  try {
    // Get company details
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return { success: false, error: "Company not found" };
    }

    // Check if company already has a wallet with a Telnyx account
    const [existingWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    if (existingWallet?.telnyxAccountId) {
      console.log(`[Telnyx Managed] Company ${companyId} already has managed account: ${existingWallet.telnyxAccountId}`);
      return {
        success: true,
        managedAccountId: existingWallet.telnyxAccountId,
      };
    }

    // Generate the expected email for this company
    const expectedEmail = `${ADMIN_EMAIL_BASE}+${company.slug}@${ADMIN_DOMAIN}`;
    console.log(`[Telnyx Managed] Looking for existing account with email: ${expectedEmail}`);

    // Check if there's already a managed account with this email in Telnyx
    const existingAccounts = await listManagedAccounts();
    if (existingAccounts.success && existingAccounts.accounts) {
      const matchingAccount = existingAccounts.accounts.find(
        (acc) => acc.email === expectedEmail
      );

      if (matchingAccount) {
        console.log(`[Telnyx Managed] Found existing account ${matchingAccount.id} with email ${expectedEmail}`);
        
        // Link the account - we use the Manager API key with x-managed-account-id header
        // so we don't need individual API keys for managed accounts anymore (Telnyx 2024 change)
        if (existingWallet) {
          await db.update(wallets).set({
            telnyxAccountId: matchingAccount.id,
            telnyxApiToken: null, // Not needed - we use Manager API key + header
            updatedAt: new Date(),
          }).where(eq(wallets.id, existingWallet.id));
        } else {
          await db.insert(wallets).values({
            companyId: companyId,
            telnyxAccountId: matchingAccount.id,
            telnyxApiToken: null,
            balance: "0.0000",
            currency: "USD",
          });
        }

        console.log(`[Telnyx Managed] Linked existing account ${matchingAccount.id} to company ${companyId}`);
        
        // Auto-create messaging profile for the linked account
        await ensureMessagingProfileForCompany(companyId, matchingAccount.id, company.name);
        
        return { success: true, managedAccountId: matchingAccount.id };
      }
    }
    
    // No existing account found, create a new one
    console.log(`[Telnyx Managed] No existing account found, creating new one...`);
    const result = await createManagedAccount(company.name, company.slug);

    if (!result.success || !result.managedAccount) {
      return { success: false, error: result.error || "Failed to create managed account" };
    }

    const managedAccountId = result.managedAccount.id;
    const apiKey = result.managedAccount.api_key;

    // Create or update wallet with Telnyx account info
    if (existingWallet) {
      await db
        .update(wallets)
        .set({
          telnyxAccountId: managedAccountId,
          telnyxApiToken: apiKey || null,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, existingWallet.id));
    } else {
      await db.insert(wallets).values({
        companyId: companyId,
        telnyxAccountId: managedAccountId,
        telnyxApiToken: apiKey || null,
        balance: "0.0000",
        currency: "USD",
      });
    }

    console.log(`[Telnyx Managed] Company ${companyId} now has managed account: ${managedAccountId}`);

    // Auto-create messaging profile for the managed account
    await ensureMessagingProfileForCompany(companyId, managedAccountId, company.name);

    return {
      success: true,
      managedAccountId: managedAccountId,
    };
  } catch (error) {
    console.error("[Telnyx Managed] Setup error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to setup managed account",
    };
  }
}

export async function getCompanyManagedAccountId(companyId: string): Promise<string | null> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  return wallet?.telnyxAccountId || null;
}

// Auto-create messaging profile for a managed account if it doesn't exist
async function ensureMessagingProfileForCompany(
  companyId: string,
  managedAccountId: string,
  companyName: string
): Promise<void> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Check if company already has a messaging profile
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));
    
    if (wallet?.telnyxMessagingProfileId) {
      console.log(`[Messaging Profile] Company ${companyId} already has profile: ${wallet.telnyxMessagingProfileId}`);
      return;
    }
    
    // Check if there's already a messaging profile in Telnyx for this managed account
    const listResponse = await fetch(`${TELNYX_API_BASE}/messaging_profiles`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        ...(managedAccountId && managedAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": managedAccountId} : {}),
      },
    });
    
    if (listResponse.ok) {
      const listResult = await listResponse.json();
      const profiles = listResult.data || [];
      
      if (profiles.length > 0) {
        // Use existing profile
        const existingProfile = profiles[0];
        console.log(`[Messaging Profile] Found existing profile in Telnyx: ${existingProfile.id}`);
        
        await db.update(wallets).set({
          telnyxMessagingProfileId: existingProfile.id,
          updatedAt: new Date(),
        }).where(eq(wallets.companyId, companyId));
        
        return;
      }
    }
    
    // Create new messaging profile
    console.log(`[Messaging Profile] Creating new profile for company ${companyId}`);
    
    const profilePayload = {
      name: `SMS Profile - ${companyName}`,
      enabled: true,
      number_pool_settings: {
        geomatch: true,
        sticky_sender: true,
        skip_unhealthy: true,
      },
    };
    
    const createResponse = await fetch(`${TELNYX_API_BASE}/messaging_profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        ...(managedAccountId && managedAccountId !== "MASTER_ACCOUNT" ? {"x-managed-account-id": managedAccountId} : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profilePayload),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[Messaging Profile] Create error: ${createResponse.status} - ${errorText}`);
      return;
    }
    
    const createResult = await createResponse.json();
    const profileId = createResult.data?.id;
    
    if (profileId) {
      console.log(`[Messaging Profile] Created profile: ${profileId}`);
      
      await db.update(wallets).set({
        telnyxMessagingProfileId: profileId,
        updatedAt: new Date(),
      }).where(eq(wallets.companyId, companyId));
    }
  } catch (error) {
    console.error("[Messaging Profile] Error ensuring profile:", error);
    // Don't throw - messaging profile creation failure shouldn't block account setup
  }
}

export async function recreateCompanyManagedAccount(companyId: string, newEmail: string): Promise<{
  success: boolean;
  managedAccountId?: string;
  error?: string;
}> {
  try {
    // Get company details
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      return { success: false, error: "Company not found" };
    }

    // Get existing wallet
    const [existingWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    // If there's an existing account, disable it first
    if (existingWallet?.telnyxAccountId) {
      console.log(`[Telnyx Managed] Disabling old managed account: ${existingWallet.telnyxAccountId}`);
      await disableManagedAccount(existingWallet.telnyxAccountId);
      
      // Clear the wallet record
      await db
        .update(wallets)
        .set({
          telnyxAccountId: null,
          telnyxApiToken: null,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, existingWallet.id));
    }

    // Create new managed account with the new email
    console.log(`[Telnyx Managed] Creating new managed account with email: ${newEmail}`);
    const result = await createManagedAccount(company.name, newEmail);

    if (!result.success || !result.managedAccount) {
      return { success: false, error: result.error || "Failed to create managed account" };
    }

    const managedAccountId = result.managedAccount.id;
    const apiKey = result.managedAccount.api_key;

    // Update wallet with new Telnyx account info
    if (existingWallet) {
      await db
        .update(wallets)
        .set({
          telnyxAccountId: managedAccountId,
          telnyxApiToken: apiKey || null,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, existingWallet.id));
    } else {
      await db.insert(wallets).values({
        companyId: companyId,
        telnyxAccountId: managedAccountId,
        telnyxApiToken: apiKey || null,
        balance: "0.0000",
        currency: "USD",
      });
    }

    console.log(`[Telnyx Managed] Company ${companyId} now has new managed account: ${managedAccountId} with email: ${newEmail}`);

    return {
      success: true,
      managedAccountId: managedAccountId,
    };
  } catch (error) {
    console.error("[Telnyx Managed] Recreate error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to recreate managed account",
    };
  }
}

/**
 * Clears all Telnyx configuration for a company when the managed account is disabled/deleted in Telnyx.
 * This resets the phone system to initial setup state.
 */
export async function clearCompanyTelnyxConfig(companyId: string): Promise<void> {
  try {
    console.log(`[Telnyx Managed] Clearing Telnyx config for company ${companyId}`);

    // Clear wallet Telnyx fields
    const [existingWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.companyId, companyId));

    if (existingWallet) {
      await db
        .update(wallets)
        .set({
          telnyxAccountId: null,
          telnyxApiToken: null,
          telnyxMessagingProfileId: null,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, existingWallet.id));
      console.log(`[Telnyx Managed] Cleared wallet Telnyx fields for company ${companyId}`);
    }

    // Clear phone numbers from telnyx_phone_numbers table
    try {
      await db.execute(`DELETE FROM telnyx_phone_numbers WHERE company_id = '${companyId}'`);
      console.log(`[Telnyx Managed] Cleared phone numbers for company ${companyId}`);
    } catch (e) {
      console.log(`[Telnyx Managed] No phone numbers table or already empty`);
    }

    // Clear E911 addresses from telnyx_e911_addresses table
    try {
      await db.execute(`DELETE FROM telnyx_e911_addresses WHERE company_id = '${companyId}'`);
      console.log(`[Telnyx Managed] Cleared E911 addresses for company ${companyId}`);
    } catch (e) {
      console.log(`[Telnyx Managed] No E911 addresses table or already empty`);
    }

    console.log(`[Telnyx Managed] Successfully cleared all Telnyx config for company ${companyId}`);
  } catch (error) {
    console.error(`[Telnyx Managed] Error clearing config for company ${companyId}:`, error);
    throw error;
  }
}
