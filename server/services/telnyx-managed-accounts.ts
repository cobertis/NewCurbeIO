import { db } from "../db";
import { wallets, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
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
  companyId: string
): Promise<CreateManagedAccountResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    // Generate masked email using company ID for white-label privacy
    const maskedEmail = `${ADMIN_EMAIL_BASE}+${companyId}@${ADMIN_DOMAIN}`;

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
    console.log(`[Telnyx Managed] Managed account created:`, result.data?.id);

    // The API key is not returned immediately, we need to fetch the account to get it
    const accountId = result.data?.id;
    if (accountId) {
      // Wait a moment for the API key to be generated
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch the managed account to get the API key
      const accountDetails = await getManagedAccount(accountId);
      if (accountDetails.success && accountDetails.managedAccount) {
        return {
          success: true,
          managedAccount: accountDetails.managedAccount,
        };
      }
    }

    return {
      success: true,
      managedAccount: result.data,
    };
  } catch (error) {
    console.error("[Telnyx Managed] Create error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create managed account",
    };
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

export async function listManagedAccounts(): Promise<{
  success: boolean;
  accounts?: ManagedAccountInfo[];
  error?: string;
}> {
  try {
    const apiKey = await getTelnyxMasterApiKey();

    console.log(`[Telnyx Managed] Listing managed accounts`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts`, {
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

export async function setupCompanyManagedAccount(companyId: string, customEmail?: string): Promise<{
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

    // Use custom email if provided, otherwise use company email
    const accountEmail = customEmail || company.email;
    
    // Create managed account using company name and email
    const result = await createManagedAccount(company.name, accountEmail);

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
