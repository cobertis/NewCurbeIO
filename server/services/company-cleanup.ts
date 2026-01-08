import { db } from "../db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getCompanyManagedAccountId, disableManagedAccount } from "./telnyx-managed-accounts";
import { SecretsService } from "./secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const secretsService = new SecretsService();

async function getTelnyxMasterApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured");
  }
  return apiKey.trim().replace(/[\r\n\t]/g, '');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface CompanyCleanupResult {
  success: boolean;
  companyId: string;
  steps: CleanupStep[];
  errors: string[];
}

interface CleanupStep {
  step: string;
  success: boolean;
  details?: string;
  error?: string;
}

async function releasePhoneNumbers(
  apiKey: string,
  managedAccountId: string
): Promise<CleanupStep[]> {
  const steps: CleanupStep[] = [];
  const allPhoneNumbers: any[] = [];

  try {
    console.log(`[CompanyCleanup] Fetching phone numbers for managed account: ${managedAccountId}`);

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const listResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers?page[number]=${page}&page[size]=250`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
          "x-managed-account-id": managedAccountId,
        },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        steps.push({
          step: "list_phone_numbers",
          success: false,
          error: `Failed to list phone numbers (page ${page}): ${listResponse.status} - ${errorText}`,
        });
        return steps;
      }

      const listResult = await listResponse.json();
      const phoneNumbers = listResult.data || [];
      allPhoneNumbers.push(...phoneNumbers);

      const meta = listResult.meta;
      hasMore = meta?.page_number < meta?.total_pages;
      page++;
    }

    console.log(`[CompanyCleanup] Found ${allPhoneNumbers.length} phone numbers to release (fetched ${page - 1} pages)`);
    steps.push({
      step: "list_phone_numbers",
      success: true,
      details: `Found ${allPhoneNumbers.length} phone numbers`,
    });

    for (const phoneNumber of allPhoneNumbers) {
      const numberId = phoneNumber.id;
      const number = phoneNumber.phone_number;

      try {
        console.log(`[CompanyCleanup] Releasing phone number: ${number} (${numberId})`);
        
        const deleteResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${numberId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
            "x-managed-account-id": managedAccountId,
          },
        });

        if (deleteResponse.ok) {
          steps.push({
            step: "release_phone_number",
            success: true,
            details: `Released ${number}`,
          });
        } else {
          const errorText = await deleteResponse.text();
          steps.push({
            step: "release_phone_number",
            success: false,
            details: number,
            error: `Failed to release: ${deleteResponse.status} - ${errorText}`,
          });
        }
      } catch (error) {
        steps.push({
          step: "release_phone_number",
          success: false,
          details: number,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return steps;
  } catch (error) {
    console.error("[CompanyCleanup] Error releasing phone numbers:", error);
    steps.push({
      step: "release_phone_numbers",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return steps;
  }
}

async function deleteMessagingProfiles(
  apiKey: string,
  managedAccountId: string
): Promise<CleanupStep[]> {
  const steps: CleanupStep[] = [];
  const allProfiles: any[] = [];

  try {
    console.log(`[CompanyCleanup] Fetching messaging profiles for managed account: ${managedAccountId}`);

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const listResponse = await fetch(`${TELNYX_API_BASE}/messaging_profiles?page[number]=${page}&page[size]=250`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
          "x-managed-account-id": managedAccountId,
        },
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        steps.push({
          step: "list_messaging_profiles",
          success: false,
          error: `Failed to list messaging profiles (page ${page}): ${listResponse.status} - ${errorText}`,
        });
        return steps;
      }

      const listResult = await listResponse.json();
      const profiles = listResult.data || [];
      allProfiles.push(...profiles);

      const meta = listResult.meta;
      hasMore = meta?.page_number < meta?.total_pages;
      page++;
    }

    console.log(`[CompanyCleanup] Found ${allProfiles.length} messaging profiles to delete (fetched ${page - 1} pages)`);
    steps.push({
      step: "list_messaging_profiles",
      success: true,
      details: `Found ${allProfiles.length} messaging profiles`,
    });

    for (const profile of allProfiles) {
      const profileId = profile.id;
      const profileName = profile.name;

      try {
        console.log(`[CompanyCleanup] Deleting messaging profile: ${profileName} (${profileId})`);

        const deleteResponse = await fetch(`${TELNYX_API_BASE}/messaging_profiles/${profileId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
            "x-managed-account-id": managedAccountId,
          },
        });

        if (deleteResponse.ok) {
          steps.push({
            step: "delete_messaging_profile",
            success: true,
            details: `Deleted ${profileName}`,
          });
        } else {
          const errorText = await deleteResponse.text();
          steps.push({
            step: "delete_messaging_profile",
            success: false,
            details: profileName,
            error: `Failed to delete: ${deleteResponse.status} - ${errorText}`,
          });
        }
      } catch (error) {
        steps.push({
          step: "delete_messaging_profile",
          success: false,
          details: profileName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return steps;
  } catch (error) {
    console.error("[CompanyCleanup] Error deleting messaging profiles:", error);
    steps.push({
      step: "delete_messaging_profiles",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return steps;
  }
}

export async function deleteCompanyDeep(companyId: string): Promise<CompanyCleanupResult> {
  const result: CompanyCleanupResult = {
    success: false,
    companyId,
    steps: [],
    errors: [],
  };

  try {
    console.log(`[CompanyCleanup] Starting deep deletion for company: ${companyId}`);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      result.errors.push("Company not found");
      return result;
    }

    result.steps.push({
      step: "find_company",
      success: true,
      details: `Found company: ${company.name}`,
    });

    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (managedAccountId) {
      console.log(`[CompanyCleanup] Found Telnyx managed account: ${managedAccountId}`);
      result.steps.push({
        step: "find_managed_account",
        success: true,
        details: `Managed account ID: ${managedAccountId}`,
      });

      try {
        const apiKey = await getTelnyxMasterApiKey();

        const phoneNumberSteps = await releasePhoneNumbers(apiKey, managedAccountId);
        result.steps.push(...phoneNumberSteps);
        
        const failedPhoneNumberReleases = phoneNumberSteps.filter(s => !s.success && s.step === "release_phone_number");
        if (failedPhoneNumberReleases.length > 0) {
          result.errors.push(`Failed to release ${failedPhoneNumberReleases.length} phone number(s)`);
        }

        console.log(`[CompanyCleanup] Waiting for Telnyx to process phone number releases...`);
        await delay(2000);

        const messagingProfileSteps = await deleteMessagingProfiles(apiKey, managedAccountId);
        result.steps.push(...messagingProfileSteps);
        
        const failedProfileDeletes = messagingProfileSteps.filter(s => !s.success && s.step === "delete_messaging_profile");
        if (failedProfileDeletes.length > 0) {
          result.errors.push(`Failed to delete ${failedProfileDeletes.length} messaging profile(s)`);
        }

        console.log(`[CompanyCleanup] Disabling managed account: ${managedAccountId}`);
        const disableResult = await disableManagedAccount(managedAccountId);
        
        if (disableResult.success) {
          result.steps.push({
            step: "disable_managed_account",
            success: true,
            details: `Disabled managed account: ${managedAccountId}`,
          });
        } else {
          result.steps.push({
            step: "disable_managed_account",
            success: false,
            details: managedAccountId,
            error: disableResult.error,
          });
          result.errors.push(`Failed to disable managed account: ${disableResult.error}`);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`[CompanyCleanup] Error during Telnyx cleanup:`, error);
        result.steps.push({
          step: "telnyx_cleanup",
          success: false,
          error: errorMsg,
        });
        result.errors.push(`Telnyx cleanup error: ${errorMsg}`);
      }
    } else {
      console.log(`[CompanyCleanup] No Telnyx managed account found for company`);
      result.steps.push({
        step: "find_managed_account",
        success: true,
        details: "No managed account found - skipping Telnyx cleanup",
      });
    }

    console.log(`[CompanyCleanup] Deleting company from database: ${companyId}`);
    
    try {
      await db.delete(companies).where(eq(companies.id, companyId));
      
      result.steps.push({
        step: "delete_company_from_db",
        success: true,
        details: `Deleted company ${company.name} and all related records (cascade)`,
      });

      console.log(`[CompanyCleanup] Successfully deleted company: ${company.name}`);
      result.success = result.errors.length === 0;

    } catch (dbError) {
      const errorMsg = dbError instanceof Error ? dbError.message : "Unknown database error";
      console.error(`[CompanyCleanup] Database deletion error:`, dbError);
      result.steps.push({
        step: "delete_company_from_db",
        success: false,
        error: errorMsg,
      });
      result.errors.push(`Database deletion failed: ${errorMsg}`);
    }

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CompanyCleanup] Unexpected error:`, error);
    result.errors.push(`Unexpected error: ${errorMsg}`);
    return result;
  }
}
