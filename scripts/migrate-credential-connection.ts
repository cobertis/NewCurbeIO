import { db } from "../server/db";
import { telephonySettings, wallets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { secretsService } from "../server/services/secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

async function getTelnyxMasterApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured");
  }
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
  return apiKey;
}

async function updateCredentialConnectionForWebRTC() {
  console.log("[Migration] Starting credential connection update...");
  
  const apiKey = await getTelnyxMasterApiKey();
  console.log(`[Migration] Got master API key, prefix: ${apiKey.slice(0, 10)}...`);
  
  const allSettings = await db
    .select({
      companyId: telephonySettings.companyId,
      credentialConnectionId: telephonySettings.credentialConnectionId,
    })
    .from(telephonySettings);
  
  console.log(`[Migration] Found ${allSettings.length} telephony settings to update`);
  
  for (const setting of allSettings) {
    if (!setting.credentialConnectionId) {
      console.log(`[Migration] Skipping company ${setting.companyId} - no credential connection`);
      continue;
    }
    
    const [wallet] = await db
      .select({ telnyxAccountId: wallets.telnyxAccountId })
      .from(wallets)
      .where(eq(wallets.companyId, setting.companyId));
    
    if (!wallet?.telnyxAccountId) {
      console.log(`[Migration] Skipping company ${setting.companyId} - no managed account ID`);
      continue;
    }
    
    console.log(`[Migration] Updating credential connection ${setting.credentialConnectionId}...`);
    
    try {
      const response = await fetch(`${TELNYX_API_BASE}/credential_connections/${setting.credentialConnectionId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "x-managed-account-id": wallet.telnyxAccountId,
        },
        body: JSON.stringify({
          sip_uri_calling_preference: "unrestricted",
          encrypted_media: "SRTP",
          dtmf_type: "RFC 2833",
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Migration] Failed to update: ${response.status} - ${errorText}`);
      } else {
        console.log(`[Migration] Successfully updated credential connection ${setting.credentialConnectionId}`);
      }
    } catch (error) {
      console.error(`[Migration] Error updating ${setting.credentialConnectionId}:`, error);
    }
  }
  
  console.log("[Migration] Complete!");
}

updateCredentialConnectionForWebRTC()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Migration] Fatal error:", err);
    process.exit(1);
  });
