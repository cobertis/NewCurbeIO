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

function generateSipPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 20; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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
  sipUsername: string,
  sipPassword: string,
  displayName: string,
  extension: string
): Promise<{ success: boolean; credentialId?: string; sipUsername?: string }> {
  try {
    console.log(`[CREATE] Creating credential ${sipUsername} in Telnyx...`);
    const response = await fetch(`${TELNYX_API_BASE}/telephony_credentials`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        connection_id: connectionId,
        name: `${displayName} (Ext ${extension})`,
        sip_username: sipUsername,
        sip_password: sipPassword,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CREATE] Failed to create credential: ${response.status} - ${errorText}`);
      return { success: false };
    }

    const data = await response.json();
    const credentialId = data.data?.id;
    const returnedSipUsername = data.data?.sip_username || sipUsername;

    console.log(`[CREATE] Credential created: ${credentialId}, SIP: ${returnedSipUsername}@sip.telnyx.com`);
    return { success: true, credentialId, sipUsername: returnedSipUsername };
  } catch (error) {
    console.error(`[CREATE] Error creating credential:`, error);
    return { success: false };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("RECREATING SIP CREDENTIALS WITH READABLE USERNAMES");
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
  
  const companyName = company?.name || "Company";
  const sanitizedCompanyName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);

  console.log(`\nCompany: ${companyName}`);
  console.log(`Sanitized name for SIP: ${sanitizedCompanyName}`);

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

  // Get all extensions with their current credentials
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
    oldUsername: string | null;
    newUsername: string;
    newCredentialId: string;
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

    const oldUsername = existingCred?.sipUsername || null;
    console.log(`Old SIP username: ${oldUsername || "none"}`);

    // Delete old credential from Telnyx if exists
    if (existingCred?.telnyxCredentialId) {
      await deleteCredentialFromTelnyx(config, existingCred.telnyxCredentialId);
    }

    // Generate new readable username
    const newSipUsername = `${sanitizedCompanyName}${ext.extension}`;
    const newSipPassword = generateSipPassword();

    console.log(`New SIP username: ${newSipUsername}`);

    // Create new credential in Telnyx
    const createResult = await createCredentialInTelnyx(
      config,
      settings.credentialConnectionId,
      newSipUsername,
      newSipPassword,
      ext.displayName!,
      ext.extension!
    );

    if (!createResult.success || !createResult.credentialId) {
      console.error(`Failed to create credential for ${ext.displayName}`);
      results.push({
        extension: ext.extension!,
        displayName: ext.displayName!,
        oldUsername,
        newUsername: newSipUsername,
        newCredentialId: "",
        success: false,
      });
      continue;
    }

    // Update database
    if (existingCred) {
      await db.update(telephonyCredentials)
        .set({
          telnyxCredentialId: createResult.credentialId,
          sipUsername: createResult.sipUsername || newSipUsername,
          sipPassword: newSipPassword,
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
        sipUsername: createResult.sipUsername || newSipUsername,
        sipPassword: newSipPassword,
        isActive: true,
      });
    }

    console.log(`Database updated successfully`);

    results.push({
      extension: ext.extension!,
      displayName: ext.displayName!,
      oldUsername,
      newUsername: createResult.sipUsername || newSipUsername,
      newCredentialId: createResult.credentialId,
      success: true,
    });
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log("\n| Ext  | Display Name      | Old Username               | New Username        | Status |");
  console.log("|------|-------------------|----------------------------|---------------------|--------|");
  
  for (const r of results) {
    const oldUser = r.oldUsername?.slice(0, 26) || "-";
    const status = r.success ? "✓" : "✗";
    console.log(`| ${r.extension.padEnd(4)} | ${r.displayName.padEnd(17)} | ${oldUser.padEnd(26)} | ${r.newUsername.padEnd(19)} | ${status.padEnd(6)} |`);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\nCompleted: ${successCount}/${results.length} credentials recreated successfully`);

  process.exit(0);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
