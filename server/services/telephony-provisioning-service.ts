import { db } from "../db";
import { 
  telephonySettings, 
  telephonyCredentials, 
  telnyxPhoneNumbers,
  companies,
  TelephonyProvisioningStatus 
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { SecretsService } from "./secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const secretsService = new SecretsService();

interface ProvisioningResult {
  success: boolean;
  outboundVoiceProfileId?: string;
  texmlAppId?: string;
  credentialConnectionId?: string;
  sipCredentials?: {
    id: string;
    username: string;
  };
  error?: string;
  step?: string;
}

async function getTelnyxMasterApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured");
  }
  return apiKey.trim().replace(/[\r\n\t]/g, '');
}

async function getWebhookBaseUrl(): Promise<string> {
  if (process.env.TELNYX_WEBHOOK_BASE_URL) {
    return process.env.TELNYX_WEBHOOK_BASE_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return "https://curbe.io";
}

export class TelephonyProvisioningService {
  
  private async makeApiRequest(
    managedAccountId: string,
    endpoint: string,
    method: string,
    body?: object
  ): Promise<Response> {
    const apiKey = await getTelnyxMasterApiKey();
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Managed-Account-Id": managedAccountId,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET" && method !== "DELETE") {
      options.body = JSON.stringify(body);
    }

    return fetch(`${TELNYX_API_BASE}${endpoint}`, options);
  }

  async provisionClientInfrastructure(
    companyId: string,
    managedAccountId: string
  ): Promise<ProvisioningResult> {
    console.log(`[TelephonyProvisioning] Starting infrastructure provisioning for company: ${companyId}, managedAccount: ${managedAccountId}`);

    let outboundVoiceProfileId: string | null = null;
    let texmlAppId: string | null = null;
    let credentialConnectionId: string | null = null;
    let sipCredentials: { id: string; username: string } | null = null;

    try {
      await this.updateProvisioningStatus(companyId, "provisioning", null);

      const [company] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId));

      const companyName = company?.name || "Company";
      const webhookBaseUrl = await getWebhookBaseUrl();

      console.log(`[TelephonyProvisioning] Step 1/5: Creating Outbound Voice Profile...`);
      const ovpResult = await this.createOutboundVoiceProfile(managedAccountId, companyName);
      if (!ovpResult.success || !ovpResult.profileId) {
        throw new Error(`Step 1 Failed: ${ovpResult.error}`);
      }
      outboundVoiceProfileId = ovpResult.profileId;
      console.log(`[TelephonyProvisioning] Outbound Voice Profile created: ${outboundVoiceProfileId}`);

      console.log(`[TelephonyProvisioning] Step 2/5: Creating TeXML Application...`);
      const texmlResult = await this.createTexmlApplication(
        managedAccountId,
        companyName,
        webhookBaseUrl,
        outboundVoiceProfileId,
        companyId
      );
      if (!texmlResult.success || !texmlResult.appId) {
        await this.rollbackOutboundProfile(managedAccountId, outboundVoiceProfileId);
        throw new Error(`Step 2 Failed: ${texmlResult.error}`);
      }
      texmlAppId = texmlResult.appId;
      console.log(`[TelephonyProvisioning] TeXML Application created: ${texmlAppId}`);

      console.log(`[TelephonyProvisioning] Step 3/5: Creating Credential Connection...`);
      const connResult = await this.createCredentialConnection(
        managedAccountId,
        companyName,
        webhookBaseUrl,
        outboundVoiceProfileId
      );
      if (!connResult.success || !connResult.connectionId) {
        await this.rollbackTexmlApp(managedAccountId, texmlAppId);
        await this.rollbackOutboundProfile(managedAccountId, outboundVoiceProfileId);
        throw new Error(`Step 3 Failed: ${connResult.error}`);
      }
      credentialConnectionId = connResult.connectionId;
      console.log(`[TelephonyProvisioning] Credential Connection created: ${credentialConnectionId}`);

      console.log(`[TelephonyProvisioning] Step 4/5: Creating SIP Credentials...`);
      const sipResult = await this.createSipCredential(
        managedAccountId,
        companyId,
        credentialConnectionId
      );
      if (!sipResult.success || !sipResult.credentials) {
        await this.rollbackCredentialConnection(managedAccountId, credentialConnectionId);
        await this.rollbackTexmlApp(managedAccountId, texmlAppId);
        await this.rollbackOutboundProfile(managedAccountId, outboundVoiceProfileId);
        throw new Error(`Step 4 Failed: ${sipResult.error}`);
      }
      sipCredentials = sipResult.credentials;
      console.log(`[TelephonyProvisioning] SIP Credentials created: ${sipCredentials.username}`);

      console.log(`[TelephonyProvisioning] Step 5/5: Updating existing phone numbers...`);
      // CRITICAL: Assign phone numbers to TeXML app, NOT credential_connection
      // This ensures only ONE routing path (TeXML webhook) handles inbound calls
      // The credential_connection is ONLY for WebRTC client authentication/outbound
      const phoneUpdateResult = await this.updateExistingPhoneNumbers(managedAccountId, companyId, texmlAppId);
      
      if (!phoneUpdateResult.success && phoneUpdateResult.failedCount > 0) {
        console.error(`[TelephonyProvisioning] Phone number updates failed: ${phoneUpdateResult.errors.join(", ")}`);
        await this.rollbackCredentialConnection(managedAccountId, credentialConnectionId);
        await this.rollbackTexmlApp(managedAccountId, texmlAppId);
        await this.rollbackOutboundProfile(managedAccountId, outboundVoiceProfileId);
        throw new Error(`Step 5 Failed: ${phoneUpdateResult.failedCount} phone numbers failed to update`);
      }
      
      console.log(`[TelephonyProvisioning] Phone numbers updated: ${phoneUpdateResult.updatedCount} success, ${phoneUpdateResult.failedCount} failed`);

      await db
        .update(telephonySettings)
        .set({
          outboundVoiceProfileId,
          texmlAppId,
          credentialConnectionId,
          webhookBaseUrl,
          provisioningStatus: "completed" as TelephonyProvisioningStatus,
          provisioningError: null,
          provisionedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(telephonySettings.companyId, companyId));

      console.log(`[TelephonyProvisioning] Infrastructure provisioning completed successfully`);

      return {
        success: true,
        outboundVoiceProfileId,
        texmlAppId,
        credentialConnectionId,
        sipCredentials,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TelephonyProvisioning] Provisioning failed:`, errorMessage);

      await this.updateProvisioningStatus(companyId, "failed", errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async createOutboundVoiceProfile(
    managedAccountId: string,
    businessName: string
  ): Promise<{ success: boolean; profileId?: string; error?: string }> {
    try {
      const response = await this.makeApiRequest(
        managedAccountId,
        "/outbound_voice_profiles",
        "POST",
        {
          name: `${businessName} - Outbound Profile`,
          service_plan: "us",
          traffic_type: "conversational",
          concurrent_call_limit: 10,
          daily_spend_limit: "25.00",
          daily_spend_limit_enabled: true,
          enabled: true,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, profileId: data.data?.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  private async createTexmlApplication(
    managedAccountId: string,
    businessName: string,
    webhookBaseUrl: string,
    outboundVoiceProfileId: string,
    companyId: string
  ): Promise<{ success: boolean; appId?: string; error?: string }> {
    try {
      const response = await this.makeApiRequest(
        managedAccountId,
        "/texml_applications",
        "POST",
        {
          friendly_name: `Curbe App - ${businessName}`,
          active: true,
          anchorsite_override: "Latency",
          // CRITICAL: Use company-specific webhook URL that routes to WebRTC client
          // NOT the generic /inbound webhook that rejects calls
          voice_url: `${webhookBaseUrl}/webhooks/telnyx/voice/${companyId}`,
          voice_fallback_url: `${webhookBaseUrl}/webhooks/telnyx/voice/fallback`,
          voice_method: "post",
          status_callback: `${webhookBaseUrl}/webhooks/telnyx/status/${companyId}`,
          status_callback_method: "post",
          outbound: {
            channel_limit: 10,
            outbound_voice_profile_id: outboundVoiceProfileId,
          },
          inbound: {
            channel_limit: 10,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, appId: data.data?.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  private async createCredentialConnection(
    managedAccountId: string,
    businessName: string,
    webhookBaseUrl: string,
    outboundVoiceProfileId: string
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    try {
      const response = await this.makeApiRequest(
        managedAccountId,
        "/credential_connections",
        "POST",
        {
          connection_name: `Curbe WebRTC - ${businessName}`,
          active: true,
          anchorsite_override: "Latency",
          outbound: {
            outbound_voice_profile_id: outboundVoiceProfileId,
            channel_limit: 10,
          },
          inbound: {
            channel_limit: 10,
          },
          // CRITICAL: Enable SIP URI calling so TeXML can dial to this credential connection
          // This is a ROOT level field, not inside inbound
          sip_uri_calling_preference: "unrestricted",
          webhook_event_url: `${webhookBaseUrl}/webhooks/telnyx/voice/status`,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, connectionId: data.data?.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  /**
   * Enable SIP URI Calling on an existing credential connection
   * This allows TeXML <Sip> dials to reach WebRTC clients registered on this connection
   * IMPORTANT: sip_uri_calling_preference is a ROOT level field, NOT inside inbound
   */
  async enableSipUriCalling(
    managedAccountId: string,
    connectionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Enabling SIP URI Calling on connection: ${connectionId}`);
      
      // sip_uri_calling_preference must be at ROOT level, not inside inbound
      // Options: "disabled", "unrestricted", "internal"
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "PATCH",
        {
          sip_uri_calling_preference: "unrestricted",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to enable SIP URI Calling: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      console.log(`[TelephonyProvisioning] SIP URI Calling enabled successfully. Response:`, JSON.stringify(data.data?.sip_uri_calling_preference));
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error enabling SIP URI Calling:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Repair existing credential connection to enable SIP URI calling
   * Call this to fix companies that were provisioned before this feature was added
   */
  async repairSipUriCalling(companyId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Repairing SIP URI Calling for company: ${companyId}`);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (!settings || !settings.credentialConnectionId) {
      return { success: false, error: "No credential connection found for company" };
    }

    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, error: "Company has no Telnyx managed account" };
    }

    return this.enableSipUriCalling(managedAccountId, settings.credentialConnectionId);
  }

  private async createSipCredential(
    managedAccountId: string,
    companyId: string,
    connectionId: string
  ): Promise<{ success: boolean; credentials?: { id: string; username: string }; error?: string }> {
    try {
      const response = await this.makeApiRequest(
        managedAccountId,
        "/telephony_credentials",
        "POST",
        {
          connection_id: connectionId,
          name: `Curbe WebRTC - ${companyId.substring(0, 8)}`,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const credentialId = data.data?.id;
      const sipUsername = data.data?.sip_username;
      const sipPassword = data.data?.sip_password;

      if (!sipUsername || !sipPassword) {
        return { success: false, error: "Credentials created but username/password not returned" };
      }

      const encryptedPassword = secretsService.encryptValue(sipPassword);

      await db.insert(telephonyCredentials).values({
        companyId,
        telnyxCredentialId: credentialId,
        sipUsername,
        sipPassword: encryptedPassword,
        isActive: true,
      });

      return {
        success: true,
        credentials: {
          id: credentialId,
          username: sipUsername,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  private async updateExistingPhoneNumbers(
    managedAccountId: string,
    companyId: string,
    texmlAppId: string
  ): Promise<{ success: boolean; updatedCount: number; failedCount: number; errors: string[] }> {
    const phoneNumbers = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId));

    if (phoneNumbers.length === 0) {
      return { success: true, updatedCount: 0, failedCount: 0, errors: [] };
    }

    const errors: string[] = [];
    let updatedCount = 0;
    let failedCount = 0;

    for (const phoneNumber of phoneNumbers) {
      try {
        console.log(`[TelephonyProvisioning] Assigning phone number ${phoneNumber.phoneNumber} to TeXML app ${texmlAppId}`);
        
        // CRITICAL: Assign to TeXML app ONLY, clear connection_id
        // This ensures inbound calls route through TeXML webhook exclusively
        // Prevents dual routing conflict that causes double billing
        const response = await this.makeApiRequest(
          managedAccountId,
          `/phone_numbers/${phoneNumber.telnyxPhoneNumberId}`,
          "PATCH",
          { 
            texml_application_id: texmlAppId,
            connection_id: null  // Clear any existing connection assignment
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          const errorMsg = `Failed to update ${phoneNumber.phoneNumber}: HTTP ${response.status} - ${errorText}`;
          console.error(`[TelephonyProvisioning] ${errorMsg}`);
          errors.push(errorMsg);
          failedCount++;
          continue;
        }

        // Store texmlAppId in connectionId field for now (reusing existing column)
        await db
          .update(telnyxPhoneNumbers)
          .set({ connectionId: texmlAppId, updatedAt: new Date() })
          .where(eq(telnyxPhoneNumbers.id, phoneNumber.id));

        console.log(`[TelephonyProvisioning] Phone number ${phoneNumber.phoneNumber} assigned to TeXML app successfully`);
        updatedCount++;
      } catch (error) {
        const errorMsg = `Error updating ${phoneNumber.phoneNumber}: ${error instanceof Error ? error.message : 'Unknown'}`;
        console.error(`[TelephonyProvisioning] ${errorMsg}`);
        errors.push(errorMsg);
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      updatedCount,
      failedCount,
      errors,
    };
  }

  private async rollbackOutboundProfile(managedAccountId: string, profileId: string): Promise<void> {
    try {
      console.log(`[TelephonyProvisioning] Rolling back Outbound Voice Profile: ${profileId}`);
      await this.makeApiRequest(managedAccountId, `/outbound_voice_profiles/${profileId}`, "DELETE");
    } catch (error) {
      console.error(`[TelephonyProvisioning] Rollback OVP failed:`, error);
    }
  }

  private async rollbackTexmlApp(managedAccountId: string, appId: string): Promise<void> {
    try {
      console.log(`[TelephonyProvisioning] Rolling back TeXML Application: ${appId}`);
      await this.makeApiRequest(managedAccountId, `/texml_applications/${appId}`, "DELETE");
    } catch (error) {
      console.error(`[TelephonyProvisioning] Rollback TeXML failed:`, error);
    }
  }

  private async rollbackCredentialConnection(managedAccountId: string, connectionId: string): Promise<void> {
    try {
      console.log(`[TelephonyProvisioning] Rolling back Credential Connection: ${connectionId}`);
      await this.makeApiRequest(managedAccountId, `/credential_connections/${connectionId}`, "DELETE");
    } catch (error) {
      console.error(`[TelephonyProvisioning] Rollback Credential Connection failed:`, error);
    }
  }

  private async updateProvisioningStatus(
    companyId: string,
    status: TelephonyProvisioningStatus,
    error: string | null
  ): Promise<void> {
    const [existing] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (existing) {
      await db
        .update(telephonySettings)
        .set({
          provisioningStatus: status,
          provisioningError: error,
          updatedAt: new Date(),
        })
        .where(eq(telephonySettings.companyId, companyId));
    } else {
      await db.insert(telephonySettings).values({
        companyId,
        provisioningStatus: status,
        provisioningError: error,
      });
    }
  }

  async getProvisioningStatus(companyId: string): Promise<{
    status: TelephonyProvisioningStatus;
    error?: string | null;
    texmlAppId?: string | null;
    outboundVoiceProfileId?: string | null;
    provisionedAt?: Date | null;
  } | null> {
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (!settings) {
      return null;
    }

    return {
      status: settings.provisioningStatus as TelephonyProvisioningStatus,
      error: settings.provisioningError,
      texmlAppId: settings.texmlAppId,
      outboundVoiceProfileId: settings.outboundVoiceProfileId,
      provisionedAt: settings.provisionedAt,
    };
  }

  async getSipCredentials(companyId: string): Promise<{
    username: string;
    password: string;
  } | null> {
    const [cred] = await db
      .select({
        username: telephonyCredentials.sipUsername,
        encryptedPassword: telephonyCredentials.sipPassword,
      })
      .from(telephonyCredentials)
      .where(eq(telephonyCredentials.companyId, companyId));

    if (!cred) return null;

    const password = secretsService.decryptValue(cred.encryptedPassword);

    return {
      username: cred.username,
      password,
    };
  }

  /**
   * FIX TeXML WEBHOOKS: Update the TeXML app to use company-specific webhook URLs
   * This fixes the issue where calls were being rejected instead of routed to WebRTC
   */
  async fixTexmlWebhooks(companyId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Fixing TeXML webhooks for company: ${companyId}`);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (!settings?.texmlAppId) {
      return { success: false, error: "No TeXML app found" };
    }

    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, error: "Company has no Telnyx managed account" };
    }

    const webhookBaseUrl = await getWebhookBaseUrl();

    try {
      const response = await this.makeApiRequest(
        managedAccountId,
        `/texml_applications/${settings.texmlAppId}`,
        "PATCH",
        {
          voice_url: `${webhookBaseUrl}/webhooks/telnyx/voice/${companyId}`,
          status_callback: `${webhookBaseUrl}/webhooks/telnyx/status/${companyId}`,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      console.log(`[TelephonyProvisioning] TeXML webhooks fixed for company: ${companyId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  /**
   * REPAIR FUNCTION: Fix phone numbers that were incorrectly assigned to credential_connection
   * This reassigns them to the TeXML app to prevent dual routing conflicts
   */
  async repairPhoneNumberRouting(companyId: string): Promise<{
    success: boolean;
    repairedCount: number;
    errors: string[];
  }> {
    console.log(`[TelephonyProvisioning] Starting phone number routing repair for company: ${companyId}`);
    
    // Get telephony settings to find the TeXML app ID
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (!settings) {
      return { success: false, repairedCount: 0, errors: ["Telephony settings not found"] };
    }

    // Get managed account from company using the dedicated function
    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, repairedCount: 0, errors: ["Company has no Telnyx managed account"] };
    }

    let texmlAppId = settings.texmlAppId;

    // If no TeXML app exists, we need to create one
    if (!texmlAppId) {
      console.log(`[TelephonyProvisioning] No TeXML app found, creating one...`);
      
      const [companyData] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId));

      const companyName = companyData?.name || "Company";
      const webhookBaseUrl = await getWebhookBaseUrl();

      const texmlResult = await this.createTexmlApplication(
        managedAccountId,
        companyName,
        webhookBaseUrl,
        settings.outboundVoiceProfileId || "",
        companyId
      );

      if (!texmlResult.success || !texmlResult.appId) {
        return { success: false, repairedCount: 0, errors: [`Failed to create TeXML app: ${texmlResult.error}`] };
      }

      texmlAppId = texmlResult.appId;

      // Update settings with the new TeXML app ID
      await db
        .update(telephonySettings)
        .set({ texmlAppId, updatedAt: new Date() })
        .where(eq(telephonySettings.companyId, companyId));

      console.log(`[TelephonyProvisioning] Created TeXML app: ${texmlAppId}`);
    }

    // Now reassign all phone numbers to the TeXML app
    const result = await this.updateExistingPhoneNumbers(managedAccountId, companyId, texmlAppId);

    console.log(`[TelephonyProvisioning] Repair complete: ${result.updatedCount} phones repaired, ${result.failedCount} failed`);

    return {
      success: result.success,
      repairedCount: result.updatedCount,
      errors: result.errors,
    };
  }
}

export const telephonyProvisioningService = new TelephonyProvisioningService();
