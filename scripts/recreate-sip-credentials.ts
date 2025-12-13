import { db } from "../server/db";
import { pbxExtensions, telephonyCredentials, telephonySettings, companies, users } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { secretsService } from "../server/services/secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const COMPANY_ID = "b5325600-9bf9-4eae-b34a-87d6ab2f5fb2";

interface ManagedAccountConfig {
  apiKey: string;
  managedAccountId: string;
}

async function getManagedAccountConfig(): Promise<ManagedAccountConfig | null> {
  const { wallets } = await import("../shared/schema");
  const [wallet] = await db
    .select({ telnyxAccountId: wallets.telnyxAccountId })
    .from(wallets)
    .where(eq(wallets.companyId, COMPANY_ID));

  if (!wallet?.telnyxAccountId) {
    console.error("No managed account found for company");
    return null;
  }

  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    console.error("Telnyx API key not configured");
    return null;
  }
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');

  return {
    apiKey,
    managedAccountId: wallet.telnyxAccountId,
  };
}

function buildHeaders(config: ManagedAccountConfig): Record<string, string> {
  return {
    "Authorization": `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    "x-managed-account-id": config.managedAccountId,
  };
}

async function deleteCredentialFromTelnyx(config: ManagedAccountConfig, credentialId: string): Promise<boolean> {
  try {
    console.log(`[DELETE] Deleting credential ${credentialId} from Telnyx...`);
    const response = await fetch(`${TELNYX_API_BASE}/telephony_credentials/${credentialId}`, {
      method: "DELETE",
      headers: buildHeaders(config),
    });

    if (response.ok || response.status === 404) {
      console.log(`[DELETE] Credential ${credentialId} deleted successfully`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`[DELETE] Failed to delete credential ${credentialId}: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`[DELETE] Error deleting credential ${credentialId}:`, error);
    return false;
  }
}

async function createCredentialInTelnyx(
  config: ManagedAccountConfig,
  connectionId: string,
  displayName: string,
  extension: string
): Promise<{ success: boolean; credentialId?: string; sipUsername?: string; sipPassword?: string }> {
  try {
    const credentialName = `${displayName} (Ext ${extension})`;
    console.log(`[CREATE] Creating credential "${credentialName}" in Telnyx...`);
    
    // Only send name - Telnyx will auto-generate sip_username and sip_password
    const response = await fetch(`${TELNYX_API_BASE}/telephony_credentials`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        connection_id: connectionId,
        name: credentialName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CREATE] Failed to create credential: ${response.status} - ${errorText}`);
      return { success: false };
    }

    const data = await response.json();
    const credentialId = data.data?.id;
    const sipUsername = data.data?.sip_username;
    const sipPassword = data.data?.sip_password;

    console.log(`[CREATE] Credential created: ${credentialId}`);
    console.log(`[CREATE] SIP Username: ${sipUsername}`);
    console.log(`[CREATE] SIP Password: ${sipPassword ? '***' + sipPassword.slice(-4) : 'NOT RETURNED'}`);
    
    if (!sipPassword) {
      console.error(`[CREATE] WARNING: Telnyx did not return sip_password!`);
    }

    return { success: true, credentialId, sipUsername, sipPassword };
  } catch (error) {
    console.error(`[CREATE] Error creating credential:`, error);
    return { success: false };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("RECREATING SIP CREDENTIALS (Telnyx auto-generates passwords)");
  console.log("=".repeat(60));

  const config = await getManagedAccountConfig();
  if (!config) {
    console.error("Failed to get managed account config");
    process.exit(1);
  }

  // Get company name
  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, COMPANY_ID));
  
  console.log(`\nCompany: ${company?.name || "Unknown"}`);

  // Get credential connection ID
  const [settings] = await db
    .select({ credentialConnectionId: telephonySettings.credentialConnectionId })
    .from(telephonySettings)
    .where(eq(telephonySettings.companyId, COMPANY_ID));

  if (!settings?.credentialConnectionId) {
    console.error("No credential connection found for company");
    process.exit(1);
  }

  console.log(`Credential Connection ID: ${settings.credentialConnectionId}`);

  // Get all extensions
  const extensions = await db
    .select({
      extensionId: pbxExtensions.id,
      extension: pbxExtensions.extension,
      displayName: pbxExtensions.displayName,
      userId: pbxExtensions.userId,
    })
    .from(pbxExtensions)
    .where(eq(pbxExtensions.companyId, COMPANY_ID));

  console.log(`\nFound ${extensions.length} extensions to process:`);

  const results: Array<{
    extension: string;
    displayName: string;
    sipUsername: string;
    credentialId: string;
    success: boolean;
  }> = [];

  for (const ext of extensions) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Processing: ${ext.displayName} (Ext ${ext.extension})`);

    // Get existing credential for this user
    const [existingCred] = await db
      .select({
        id: telephonyCredentials.id,
        sipUsername: telephonyCredentials.sipUsername,
        telnyxCredentialId: telephonyCredentials.telnyxCredentialId,
      })
      .from(telephonyCredentials)
      .where(eq(telephonyCredentials.ownerUserId, ext.userId!));

    // Delete old credential from Telnyx if exists
    if (existingCred?.telnyxCredentialId) {
      console.log(`Old credential: ${existingCred.telnyxCredentialId}`);
      await deleteCredentialFromTelnyx(config, existingCred.telnyxCredentialId);
    }

    // Create new credential - Telnyx generates username and password
    const createResult = await createCredentialInTelnyx(
      config,
      settings.credentialConnectionId,
      ext.displayName!,
      ext.extension!
    );

    if (!createResult.success || !createResult.credentialId || !createResult.sipPassword) {
      console.error(`Failed to create credential for ${ext.displayName}`);
      results.push({
        extension: ext.extension!,
        displayName: ext.displayName!,
        sipUsername: "",
        credentialId: "",
        success: false,
      });
      continue;
    }

    // Update database with Telnyx-generated credentials
    if (existingCred) {
      await db.update(telephonyCredentials)
        .set({
          telnyxCredentialId: createResult.credentialId,
          sipUsername: createResult.sipUsername!,
          sipPassword: createResult.sipPassword,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(telephonyCredentials.id, existingCred.id));
    } else {
      await db.insert(telephonyCredentials).values({
        companyId: COMPANY_ID,
        userId: ext.userId!,
        ownerUserId: ext.userId!,
        telnyxCredentialId: createResult.credentialId,
        sipUsername: createResult.sipUsername!,
        sipPassword: createResult.sipPassword,
        isActive: true,
      });
    }

    console.log(`Database updated with Telnyx credentials`);

    results.push({
      extension: ext.extension!,
      displayName: ext.displayName!,
      sipUsername: createResult.sipUsername!,
      credentialId: createResult.credentialId,
      success: true,
    });
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log("\n| Ext  | Display Name      | SIP Username                              | Status |");
  console.log("|------|-------------------|-------------------------------------------|--------|");
  
  for (const r of results) {
    const sipUser = r.sipUsername.slice(0, 41) || "-";
    const status = r.success ? "✓" : "✗";
    console.log(`| ${r.extension.padEnd(4)} | ${r.displayName.padEnd(17)} | ${sipUser.padEnd(41)} | ${status.padEnd(6)} |`);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\nCompleted: ${successCount}/${results.length} credentials recreated successfully`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
