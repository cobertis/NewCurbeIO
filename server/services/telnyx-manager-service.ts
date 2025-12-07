import { db } from "../db";
import { wallets, companies } from "@shared/schema";
import { eq } from "drizzle-orm";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

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

interface CreateSubAccountResult {
  success: boolean;
  accountId?: string;
  apiToken?: string;
  error?: string;
}

function getTelnyxMasterApiKey(): string {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) {
    throw new Error("TELNYX_API_KEY environment variable is not set");
  }
  return apiKey;
}

export async function createSubAccount(organizationName: string): Promise<CreateSubAccountResult> {
  try {
    const apiKey = getTelnyxMasterApiKey();

    console.log(`[Telnyx] Creating sub-account for: ${organizationName}`);

    const response = await fetch(`${TELNYX_API_BASE}/managed_accounts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: `${organizationName.toLowerCase().replace(/[^a-z0-9]/g, "-")}@managed.telnyx.com`,
        business_name: organizationName,
        managed_account_allow_custom_pricing: false,
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

    console.log(`[Telnyx] Sub-account created successfully: ${result.data.id}`);

    return {
      success: true,
      accountId: result.data.id,
      apiToken: result.data.api_token,
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

    const subAccountResult = await createSubAccount(company.name);

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
