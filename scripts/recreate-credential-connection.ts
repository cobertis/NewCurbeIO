import { db } from "../server/db";
import { telephonySettings, companies, wallets } from "../shared/schema";
import { eq } from "drizzle-orm";
import { secretsService } from "../server/services/secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const COMPANY_ID = "b5325600-9bf9-4eae-b34a-87d6ab2f5fb2";

interface ManagedAccountConfig {
  apiKey: string;
  managedAccountId: string;
}

async function getManagedAccountConfig(): Promise<ManagedAccountConfig | null> {
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

function generateSipUsername(companyId: string): string {
  const prefix = "curbe";
  const companyPart = companyId.replace(/-/g, '').slice(0, 8);
  const randomPart = Math.random().toString(36).substring(2, 6);
  return `${prefix}${companyPart}${randomPart}`.toLowerCase();
}

function generateSipPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 20; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createCredentialConnection(
  config: ManagedAccountConfig,
  companyName: string,
  outboundVoiceProfileId: string
): Promise<{ success: boolean; connectionId?: string; sipUsername?: string; sipPassword?: string; error?: string }> {
  const sipUsername = generateSipUsername(COMPANY_ID);
  const sipPassword = generateSipPassword();
  
  console.log(`[CREATE] Creating credential connection for ${companyName}...`);
  console.log(`[CREATE] SIP Username: ${sipUsername}`);

  try {
    const response = await fetch(`${TELNYX_API_BASE}/credential_connections`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        connection_name: `${companyName} - WebRTC`,
        user_name: sipUsername,
        password: sipPassword,
        active: true,
        anchorsite_override: "Latency",
        sip_uri_calling_preference: "unrestricted",
        encrypted_media: null,
        dtmf_type: "RFC 2833",
        default_on_hold_comfort_noise_enabled: true,
        rtcp_settings: {
          port: "rtcp-mux",
          capture_enabled: true,
          report_frequency_secs: 10,
        },
        outbound: {
          outbound_voice_profile_id: outboundVoiceProfileId,
          channel_limit: 10,
        },
        inbound: {
          channel_limit: 10,
          codecs: ["G711U", "G711A", "G722", "OPUS"],
          generate_ringback_tone: true,
          shaken_stir_enabled: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CREATE] Failed: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed: ${response.status}` };
    }

    const data = await response.json();
    const connectionId = data.data?.id;

    console.log(`[CREATE] Credential connection created: ${connectionId}`);
    return { success: true, connectionId, sipUsername, sipPassword };
  } catch (error) {
    console.error("[CREATE] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("RECREATING CREDENTIAL CONNECTION");
  console.log("=".repeat(60));

  const config = await getManagedAccountConfig();
  if (!config) {
    console.error("Failed to get managed account config");
    process.exit(1);
  }

  console.log(`Managed Account ID: ${config.managedAccountId}`);

  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, COMPANY_ID));

  console.log(`Company: ${company?.name || "Unknown"}`);

  const [settings] = await db
    .select({ 
      outboundVoiceProfileId: telephonySettings.outboundVoiceProfileId,
      credentialConnectionId: telephonySettings.credentialConnectionId
    })
    .from(telephonySettings)
    .where(eq(telephonySettings.companyId, COMPANY_ID));

  if (!settings?.outboundVoiceProfileId) {
    console.error("No outbound voice profile found");
    process.exit(1);
  }

  console.log(`Outbound Voice Profile: ${settings.outboundVoiceProfileId}`);
  console.log(`Current Credential Connection: ${settings.credentialConnectionId || "NONE"}`);

  if (settings.credentialConnectionId) {
    console.log("Credential connection already exists. Skipping creation.");
    process.exit(0);
  }

  const result = await createCredentialConnection(
    config,
    company?.name || "Company",
    settings.outboundVoiceProfileId
  );

  if (!result.success || !result.connectionId) {
    console.error("Failed to create credential connection:", result.error);
    process.exit(1);
  }

  await db.update(telephonySettings)
    .set({ 
      credentialConnectionId: result.connectionId,
      updatedAt: new Date()
    })
    .where(eq(telephonySettings.companyId, COMPANY_ID));

  console.log(`\nDatabase updated with new credential connection: ${result.connectionId}`);
  console.log("\nNow run: npx tsx scripts/recreate-sip-credentials.ts");

  process.exit(0);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
