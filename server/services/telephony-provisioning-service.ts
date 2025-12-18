import { db } from "../db";
import { 
  telephonySettings, 
  telephonyCredentials, 
  telnyxPhoneNumbers,
  companies,
  pbxExtensions,
  users,
  TelephonyProvisioningStatus 
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
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

  async createCallControlApplication(
    managedAccountId: string,
    businessName: string,
    webhookBaseUrl: string,
    outboundVoiceProfileId: string,
    companyId: string
  ): Promise<{ success: boolean; appId?: string; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Creating Call Control Application for company: ${companyId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        "/call_control_applications",
        "POST",
        {
          application_name: `Curbe Call Control - ${businessName}`,
          webhook_event_url: `${webhookBaseUrl}/webhooks/telnyx/call-control/${companyId}`,
          webhook_event_failover_url: `${webhookBaseUrl}/webhooks/telnyx/call-control/${companyId}/fallback`,
          webhook_api_version: "2",
          webhook_timeout_secs: 25,
          first_command_timeout: true,
          first_command_timeout_secs: 30,
          anchorsite_override: "Latency",
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
        console.error(`[TelephonyProvisioning] Call Control App creation failed: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const appId = data.data?.id;
      console.log(`[TelephonyProvisioning] Call Control Application created: ${appId}`);
      return { success: true, appId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Call Control App creation error:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async getCallControlAppDetails(
    managedAccountId: string,
    appId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await this.makeApiRequest(
        managedAccountId,
        `/call_control_applications/${appId}`,
        "GET"
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  async updateCallControlAppWebhook(
    managedAccountId: string,
    appId: string,
    webhookBaseUrl: string,
    companyId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Updating Call Control App ${appId} webhook to ${webhookBaseUrl}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/call_control_applications/${appId}`,
        "PATCH",
        {
          webhook_event_url: `${webhookBaseUrl}/webhooks/telnyx/call-control/${companyId}`,
          webhook_event_failover_url: `${webhookBaseUrl}/webhooks/telnyx/call-control/${companyId}/fallback`,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Call Control App webhook update failed: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      console.log(`[TelephonyProvisioning] Call Control App webhook updated successfully`);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Call Control App webhook update error:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Configure SIP subdomain on Call Control Application for SIP Forking
   * CRITICAL: The SIP subdomain must be set on the Call Control Application (Voice API app),
   * NOT on the Credential Connection. This is what enables calls to ring on all registered devices.
   * The subdomain format in Telnyx is: {subdomain}.sip.telnyx.com
   */
  async configureCallControlAppSipSubdomain(
    managedAccountId: string,
    appId: string,
    subdomain: string
  ): Promise<{ success: boolean; sipDomain?: string; error?: string }> {
    try {
      // Clean subdomain: lowercase, alphanumeric + hyphens only
      const cleanSubdomain = subdomain
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);
      
      console.log(`[TelephonyProvisioning] Configuring SIP subdomain on Call Control App: ${appId}, subdomain: ${cleanSubdomain}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/call_control_applications/${appId}`,
        "PATCH",
        {
          inbound: {
            sip_subdomain: cleanSubdomain,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to configure Call Control App SIP subdomain: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const configuredSubdomain = data.data?.inbound?.sip_subdomain;
      const sipDomain = configuredSubdomain ? `${configuredSubdomain}.sip.telnyx.com` : null;
      
      console.log(`[TelephonyProvisioning] Call Control App SIP subdomain configured successfully: ${sipDomain}`);
      return { success: true, sipDomain: sipDomain || undefined };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error configuring Call Control App SIP subdomain:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get SIP subdomain from Call Control Application
   */
  async getCallControlAppSipSubdomain(
    managedAccountId: string,
    appId: string
  ): Promise<{ success: boolean; sipDomain?: string; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Getting SIP subdomain from Call Control App: ${appId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/call_control_applications/${appId}`,
        "GET"
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const subdomain = data.data?.inbound?.sip_subdomain;
      const sipDomain = subdomain ? `${subdomain}.sip.telnyx.com` : null;
      
      console.log(`[TelephonyProvisioning] Call Control App SIP subdomain: ${sipDomain || 'not configured'}`);
      return { success: true, sipDomain: sipDomain || undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

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
      ...(managedAccountId && managedAccountId !== "MASTER_ACCOUNT" ? {"X-Managed-Account-Id": managedAccountId} : {}),
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
    managedAccountId: string,
    userId: string
  ): Promise<ProvisioningResult> {
    console.log(`[TelephonyProvisioning] Starting infrastructure provisioning for company: ${companyId}, managedAccount: ${managedAccountId}, userId: ${userId}`);

    let outboundVoiceProfileId: string | null = null;
    let texmlAppId: string | null = null;
    let credentialConnectionId: string | null = null;
    let sipCredentials: { id: string; username: string } | null = null;

    try {
      await this.updateProvisioningStatus(companyId, userId, "provisioning", null);

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
        userId,
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
      // CRITICAL FIX: Assign phone numbers to Credential Connection DIRECTLY
      // Per Telnyx docs, this routes inbound calls directly to WebRTC client
      // without TeXML intermediate leg that causes 4-6 second audio delay
      const phoneUpdateResult = await this.updateExistingPhoneNumbers(managedAccountId, companyId, credentialConnectionId);
      
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
        .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));

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

      await this.updateProvisioningStatus(companyId, userId, "failed", errorMessage);

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
            codecs: ["G722", "PCMU", "PCMA"],
            // Enable SIP Forking so all registered devices (webphone + physical phones) ring simultaneously
            // Telnyx uses "simultaneous_ringing" property (not sip_forking_enabled)
            simultaneous_ringing: "enabled",
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
  async repairSipUriCalling(companyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Repairing SIP URI Calling for company: ${companyId}, userId: ${userId}`);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));

    if (!settings || !settings.credentialConnectionId) {
      return { success: false, error: "No credential connection found for user" };
    }

    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, error: "Company has no Telnyx managed account" };
    }

    return this.enableSipUriCalling(managedAccountId, settings.credentialConnectionId);
  }

  /**
   * Disable SRTP encrypted media on credential connection
   * CRITICAL: WebRTC SDK uses DTLS-SRTP automatically, having SRTP enabled on the 
   * SIP Connection causes 488 "Not Acceptable Here" errors on outbound calls
   */
  async disableSrtpEncryption(
    managedAccountId: string,
    connectionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Disabling SRTP on connection: ${connectionId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "PATCH",
        {
          // Per Telnyx OpenAPI spec (spec3.yml): enum is ["SRTP", null]
          // Docs: https://github.com/team-telnyx/openapi/blob/master/openapi/spec3.yml
          // Setting to null disables SRTP encryption
          // WebRTC uses DTLS-SRTP automatically, so Telnyx SRTP must be disabled to avoid 488 errors
          encrypted_media: null,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to disable SRTP: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      console.log(`[TelephonyProvisioning] SRTP disabled successfully. encrypted_media:`, data.data?.encrypted_media);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error disabling SRTP:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Repair existing credential connection to disable SRTP for WebRTC compatibility
   * Call this to fix 488 errors on outbound calls
   */
  async repairSrtpSettings(companyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Repairing SRTP settings for company: ${companyId}, userId: ${userId}`);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));

    if (!settings || !settings.credentialConnectionId) {
      return { success: false, error: "No credential connection found for user" };
    }

    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, error: "Company has no Telnyx managed account" };
    }

    return this.disableSrtpEncryption(managedAccountId, settings.credentialConnectionId);
  }

  /**
   * Configure SIP subdomain on credential connection for SIP Forking
   * CRITICAL: This enables simultaneous_ringing to work by forcing calls
   * to route through the connection-specific realm instead of generic sip.telnyx.com
   * The subdomain format is: {subdomain}.sip.telnyx.com
   */
  async configureSipSubdomain(
    managedAccountId: string,
    connectionId: string,
    subdomain: string
  ): Promise<{ success: boolean; sipDomain?: string; error?: string }> {
    try {
      // Clean subdomain: lowercase, alphanumeric + hyphens only
      const cleanSubdomain = subdomain
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);
      
      console.log(`[TelephonyProvisioning] Configuring SIP subdomain on connection: ${connectionId}, subdomain: ${cleanSubdomain}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "PATCH",
        {
          sip_subdomain: cleanSubdomain,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to configure SIP subdomain: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const configuredSubdomain = data.data?.sip_subdomain;
      const sipDomain = configuredSubdomain ? `${configuredSubdomain}.sip.telnyx.com` : null;
      
      console.log(`[TelephonyProvisioning] SIP subdomain configured successfully: ${sipDomain}`);
      return { success: true, sipDomain: sipDomain || undefined };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error configuring SIP subdomain:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get SIP subdomain from credential connection
   */
  async getSipSubdomain(
    managedAccountId: string,
    connectionId: string
  ): Promise<{ success: boolean; sipDomain?: string; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Getting SIP subdomain for connection: ${connectionId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "GET"
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const subdomain = data.data?.sip_subdomain;
      const sipDomain = subdomain ? `${subdomain}.sip.telnyx.com` : null;
      
      console.log(`[TelephonyProvisioning] Current SIP subdomain: ${sipDomain || 'not configured'}`);
      return { success: true, sipDomain: sipDomain || undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  /**
   * Setup SIP subdomain for a company and save to database
   * This enables SIP forking so both webphone and desk phones ring simultaneously
   */
  async setupSipDomainForCompany(companyId: string): Promise<{ success: boolean; sipDomain?: string; error?: string }> {
    console.log(`[TelephonyProvisioning] Setting up SIP domain for company: ${companyId}`);
    
    // Get company info
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));
    
    if (!company) {
      return { success: false, error: "Company not found" };
    }

    // Get telephony settings with credential connection
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId))
      .limit(1);

    if (!settings || !settings.credentialConnectionId) {
      return { success: false, error: "No credential connection found for company" };
    }

    // Check if already configured
    if (settings.sipDomain) {
      console.log(`[TelephonyProvisioning] SIP domain already configured: ${settings.sipDomain}`);
      return { success: true, sipDomain: settings.sipDomain };
    }

    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, error: "Company has no Telnyx managed account" };
    }

    // First check if subdomain already exists in Telnyx
    const existingResult = await this.getSipSubdomain(managedAccountId, settings.credentialConnectionId);
    if (existingResult.success && existingResult.sipDomain) {
      // Save to database and return
      await db
        .update(telephonySettings)
        .set({ sipDomain: existingResult.sipDomain, updatedAt: new Date() })
        .where(eq(telephonySettings.id, settings.id));
      
      return { success: true, sipDomain: existingResult.sipDomain };
    }

    // Generate subdomain from company name
    const subdomain = `curbe-${company.name || companyId.slice(0, 8)}`;
    
    // Configure in Telnyx
    const result = await this.configureSipSubdomain(
      managedAccountId,
      settings.credentialConnectionId,
      subdomain
    );

    if (!result.success || !result.sipDomain) {
      return { success: false, error: result.error || "Failed to configure SIP subdomain" };
    }

    // Save to database
    await db
      .update(telephonySettings)
      .set({ sipDomain: result.sipDomain, updatedAt: new Date() })
      .where(eq(telephonySettings.id, settings.id));

    console.log(`[TelephonyProvisioning] SIP domain setup complete: ${result.sipDomain}`);
    return { success: true, sipDomain: result.sipDomain };
  }

  /**
   * Get the SIP domain for a company (from database or configure if missing)
   */
  async getCompanySipDomain(companyId: string): Promise<string | null> {
    const [settings] = await db
      .select({ sipDomain: telephonySettings.sipDomain })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId))
      .limit(1);

    if (settings?.sipDomain) {
      return settings.sipDomain;
    }

    // Try to setup if not configured
    const result = await this.setupSipDomainForCompany(companyId);
    return result.sipDomain || null;
  }

  /**
   * Configure HD codecs on credential connection for high-quality voice
   * Sets codec priority: G.722 (HD) first, then PCMU/PCMA as fallback
   * OPUS is not included as it requires TLS/TCP transport for inbound
   */
  async configureHDCodecs(
    managedAccountId: string,
    connectionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Configuring HD codecs on connection: ${connectionId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "PATCH",
        {
          inbound: {
            codecs: ["G722", "PCMU", "PCMA"],
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to configure HD codecs: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      console.log(`[TelephonyProvisioning] HD codecs configured successfully. Codecs:`, data.data?.inbound?.codecs);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error configuring HD codecs:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Repair existing credential connection to use HD codecs
   * Call this to enable G.722 HD voice quality on existing connections
   */
  async repairHDCodecs(companyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Repairing HD codecs for company: ${companyId}, userId: ${userId}`);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId))
      .limit(1);

    if (!settings || !settings.credentialConnectionId) {
      return { success: false, error: "No credential connection found for company" };
    }

    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, error: "Company has no Telnyx managed account" };
    }

    return this.configureHDCodecs(managedAccountId, settings.credentialConnectionId);
  }

  /**
   * Enable SIP Forking on credential connection
   * When enabled, all registered devices (webphone + physical phones) ring simultaneously
   * First device to answer wins - others are cancelled
   */
  async enableSipForking(
    managedAccountId: string,
    connectionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Enabling SIP Forking on connection: ${connectionId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "PATCH",
        {
          inbound: {
            // Telnyx uses "simultaneous_ringing" property (not sip_forking_enabled)
            simultaneous_ringing: "enabled",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to enable SIP Forking: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const patchData = await response.json();
      console.log(`[TelephonyProvisioning] PATCH response inbound:`, JSON.stringify(patchData.data?.inbound));
      
      // Verify by doing a GET to confirm the setting was applied
      const verifyResponse = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "GET"
      );
      
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        // Telnyx uses "simultaneous_ringing" property with value "enabled"
        const sipForkingStatus = verifyData.data?.inbound?.simultaneous_ringing;
        console.log(`[TelephonyProvisioning] GET verification - simultaneous_ringing: ${sipForkingStatus}`);
        
        if (sipForkingStatus !== "enabled") {
          console.error(`[TelephonyProvisioning] SIP Forking NOT enabled after PATCH! Current value: ${sipForkingStatus}`);
          return { success: false, error: `SIP Forking not applied. Value: ${sipForkingStatus}` };
        }
      }
      
      console.log(`[TelephonyProvisioning] SIP Forking enabled and verified successfully`);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error enabling SIP Forking:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Repair existing credential connection to enable SIP Forking
   * Call this to enable ring-all (webphone + physical phone) on existing connections
   * This also configures the SIP subdomain on the CALL CONTROL APPLICATION which is REQUIRED for SIP Forking to work
   * 
   * CRITICAL: The SIP subdomain must be configured on the Call Control Application (Voice API app),
   * NOT on the Credential Connection. The user verified this in the Telnyx portal:
   * "Edit Voice API application" -> "Inbound" -> "SIP subdomain"
   */
  async repairSipForking(companyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Repairing SIP Forking for company: ${companyId}, userId: ${userId}`);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)))
      .limit(1);

    if (!settings || !settings.credentialConnectionId) {
      return { success: false, error: "No credential connection found for company" };
    }

    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, error: "Company has no Telnyx managed account" };
    }

    // Step 1: Enable simultaneous_ringing on Credential Connection
    const forkingResult = await this.enableSipForking(managedAccountId, settings.credentialConnectionId);
    if (!forkingResult.success) {
      return forkingResult;
    }

    // Step 2: Configure SIP subdomain on CALL CONTROL APPLICATION - CRITICAL for SIP Forking to actually work
    // The subdomain MUST be set on the Call Control App (Voice API app), not on Credential Connection
    // User verified this in Telnyx portal: "Edit Voice API application" -> "Inbound" -> "SIP subdomain"
    if (settings.callControlAppId) {
      console.log(`[TelephonyProvisioning] Configuring SIP subdomain on Call Control App: ${settings.callControlAppId}`);
      
      // Get company name for subdomain
      const [company] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId));
      
      const subdomain = company?.name || companyId.slice(0, 8);
      
      const subdomainResult = await this.configureCallControlAppSipSubdomain(
        managedAccountId,
        settings.callControlAppId,
        subdomain
      );
      
      if (subdomainResult.success && subdomainResult.sipDomain) {
        console.log(`[TelephonyProvisioning] Call Control App SIP subdomain configured: ${subdomainResult.sipDomain}`);
        
        // Save to database
        await db
          .update(telephonySettings)
          .set({ sipDomain: subdomainResult.sipDomain, updatedAt: new Date() })
          .where(eq(telephonySettings.id, settings.id));
      } else {
        console.warn(`[TelephonyProvisioning] Could not configure Call Control App SIP subdomain: ${subdomainResult.error}`);
        // Don't fail the whole repair - simultaneous_ringing is still enabled on credential connection
      }
    } else {
      // Fallback: Configure on Credential Connection if no Call Control App
      console.log(`[TelephonyProvisioning] No Call Control App, configuring SIP subdomain on Credential Connection`);
      const subdomainResult = await this.setupSipDomainForCompany(companyId);
      if (subdomainResult.success && subdomainResult.sipDomain) {
        console.log(`[TelephonyProvisioning] SIP subdomain configured on Credential Connection: ${subdomainResult.sipDomain}`);
      } else {
        console.warn(`[TelephonyProvisioning] Could not configure SIP subdomain: ${subdomainResult.error}`);
      }
    }

    return { success: true };
  }

  private async createSipCredential(
    managedAccountId: string,
    companyId: string,
    userId: string,
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
        ownerUserId: userId,
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
    credentialConnectionId: string
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
        console.log(`[TelephonyProvisioning] Assigning phone number ${phoneNumber.phoneNumber} to Credential Connection ${credentialConnectionId}`);
        
        // CRITICAL FIX: Assign to Credential Connection DIRECTLY (not TeXML app)
        // Per Telnyx docs, this routes inbound calls directly to WebRTC client
        // without TeXML intermediate leg that causes 4-6 second audio delay
        // TeXML routing creates a second SIP leg that anchors media at the TeXML app
        const response = await this.makeApiRequest(
          managedAccountId,
          `/phone_numbers/${phoneNumber.telnyxPhoneNumberId}`,
          "PATCH",
          { 
            connection_id: credentialConnectionId,
            texml_application_id: null  // Clear TeXML app to prevent dual routing
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

        await db
          .update(telnyxPhoneNumbers)
          .set({ connectionId: credentialConnectionId, updatedAt: new Date() })
          .where(eq(telnyxPhoneNumbers.id, phoneNumber.id));

        console.log(`[TelephonyProvisioning] Phone number ${phoneNumber.phoneNumber} assigned to Credential Connection successfully`);
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
    userId: string,
    status: TelephonyProvisioningStatus,
    error: string | null
  ): Promise<void> {
    const [existing] = await db
      .select()
      .from(telephonySettings)
      .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));

    if (existing) {
      await db
        .update(telephonySettings)
        .set({
          provisioningStatus: status,
          provisioningError: error,
          updatedAt: new Date(),
        })
        .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));
    } else {
      await db.insert(telephonySettings).values({
        companyId,
        ownerUserId: userId,
        provisioningStatus: status,
        provisioningError: error,
      });
    }
  }

  async getProvisioningStatus(companyId: string, userId?: string): Promise<{
    status: TelephonyProvisioningStatus;
    error?: string | null;
    texmlAppId?: string | null;
    outboundVoiceProfileId?: string | null;
    provisionedAt?: Date | null;
  } | null> {
    const whereConditions = userId 
      ? and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId))
      : eq(telephonySettings.companyId, companyId);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(whereConditions);

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

  async getSipCredentials(companyId: string, userId?: string): Promise<{
    username: string;
    password: string;
  } | null> {
    const whereConditions = userId
      ? and(eq(telephonyCredentials.companyId, companyId), eq(telephonyCredentials.ownerUserId, userId))
      : eq(telephonyCredentials.companyId, companyId);
    
    const [cred] = await db
      .select({
        username: telephonyCredentials.sipUsername,
        encryptedPassword: telephonyCredentials.sipPassword,
      })
      .from(telephonyCredentials)
      .where(whereConditions);

    if (!cred || !cred.username) return null;

    let password: string;
    
    try {
      // Try to decrypt if it has the proper encrypted format (iv:encryptedValue)
      if (cred.encryptedPassword && cred.encryptedPassword.includes(':')) {
        password = secretsService.decryptValue(cred.encryptedPassword);
      } else {
        // Legacy unencrypted password - use as-is
        password = cred.encryptedPassword || '';
      }
    } catch (error) {
      console.error(`[SIP Credentials] Decryption failed for user, treating as plain text:`, error);
      // Fallback: treat as plain text password (legacy data)
      password = cred.encryptedPassword || '';
    }

    return {
      username: cred.username,
      password,
    };
  }

  /**
   * FIX TeXML WEBHOOKS: Update the TeXML app to use company-specific webhook URLs
   * This fixes the issue where calls were being rejected instead of routed to WebRTC
   */
  async fixTexmlWebhooks(companyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Fixing TeXML webhooks for company: ${companyId}, userId: ${userId}`);
    
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));

    if (!settings?.texmlAppId) {
      return { success: false, error: "No TeXML app found for user" };
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
   * Assign a phone number to a Call Control Application
   * This enables REST API call management with call_control_id
   */
  async assignPhoneNumberToCallControlApp(
    managedAccountId: string,
    phoneNumberId: string,
    callControlAppId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Assigning phone number ${phoneNumberId} to Call Control App ${callControlAppId}`);
      
      // STEP 1: First disable E911 emergency services using the dedicated endpoint
      // Telnyx requires disabling E911 before changing routing/connection
      // Per Telnyx API: POST /phone_numbers/{id}/actions/enable_emergency with emergency_enabled: false
      console.log(`[TelephonyProvisioning] Disabling E911 on phone number ${phoneNumberId} via dedicated endpoint...`);
      
      // Use the dedicated enable_emergency endpoint to disable E911
      const disableE911Response = await this.makeApiRequest(
        managedAccountId,
        `/phone_numbers/${phoneNumberId}/actions/enable_emergency`,
        "POST",
        {
          emergency_enabled: false,
        }
      );
      
      if (!disableE911Response.ok) {
        const errorText = await disableE911Response.text();
        console.log(`[TelephonyProvisioning] E911 disable via dedicated endpoint: ${disableE911Response.status} - ${errorText}`);
        
        // Try fallback with voice settings endpoint
        console.log(`[TelephonyProvisioning] Trying fallback: PATCH phone_numbers/voice...`);
        const fallbackResponse = await this.makeApiRequest(
          managedAccountId,
          `/phone_numbers/${phoneNumberId}/voice`,
          "PATCH",
          {
            emergency: {
              emergency_enabled: false,
              emergency_address_id: null,
            }
          }
        );
        
        if (!fallbackResponse.ok) {
          const fallbackError = await fallbackResponse.text();
          console.log(`[TelephonyProvisioning] E911 fallback also failed: ${fallbackResponse.status} - ${fallbackError}`);
        } else {
          console.log(`[TelephonyProvisioning] E911 disabled via voice settings fallback`);
        }
      } else {
        console.log(`[TelephonyProvisioning] E911 disabled successfully via dedicated endpoint`);
      }
      
      // STEP 2: Assign to Call Control Application
      // CRITICAL: Telnyx API requires connection_id with the Call Control App ID (NOT call_control_application_id)
      // The Call Control App IS a type of connection in Telnyx's API
      const response = await this.makeApiRequest(
        managedAccountId,
        `/phone_numbers/${phoneNumberId}`,
        "PATCH",
        {
          connection_id: callControlAppId,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to assign phone to Call Control App: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      console.log(`[TelephonyProvisioning] Phone number ${phoneNumberId} assigned to Call Control App successfully`);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error assigning phone to Call Control App:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Migrate company from Credential Connection routing to Call Control Application routing
   * This enables REST API call management with call_control_id for hangup functionality
   */
  async migrateToCallControl(companyId: string, userId: string): Promise<{
    success: boolean;
    callControlAppId?: string;
    migratedCount: number;
    errors: string[];
  }> {
    console.log(`[TelephonyProvisioning] Starting Call Control migration for company: ${companyId}, userId: ${userId}`);
    
    const errors: string[] = [];
    let migratedCount = 0;

    // Get telephony settings
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));

    if (!settings) {
      return { success: false, migratedCount: 0, errors: ["Telephony settings not found for user"] };
    }

    if (!settings.outboundVoiceProfileId) {
      return { success: false, migratedCount: 0, errors: ["No outbound voice profile found - please provision telephony first"] };
    }

    // Get managed account
    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, migratedCount: 0, errors: ["Company has no Telnyx managed account"] };
    }

    // Get company name for the app
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId));
    const companyName = company?.name || "Company";

    // Create Call Control Application if not exists
    let callControlAppId = settings.callControlAppId;
    
    if (!callControlAppId) {
      const webhookBaseUrl = await getWebhookBaseUrl();
      const ccResult = await this.createCallControlApplication(
        managedAccountId,
        companyName,
        webhookBaseUrl,
        settings.outboundVoiceProfileId,
        companyId
      );

      if (!ccResult.success || !ccResult.appId) {
        return { success: false, migratedCount: 0, errors: [`Failed to create Call Control App: ${ccResult.error}`] };
      }

      callControlAppId = ccResult.appId;
      console.log(`[TelephonyProvisioning] Created Call Control App: ${callControlAppId}`);

      // Store the Call Control App ID
      await db
        .update(telephonySettings)
        .set({
          callControlAppId,
          updatedAt: new Date(),
        })
        .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));
    } else {
      console.log(`[TelephonyProvisioning] Using existing Call Control App: ${callControlAppId}`);
    }

    // Get all phone numbers for the user
    const phoneNumbers = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(and(eq(telnyxPhoneNumbers.companyId, companyId), eq(telnyxPhoneNumbers.ownerUserId, userId)));

    if (phoneNumbers.length === 0) {
      console.log(`[TelephonyProvisioning] No phone numbers to migrate`);
      return { success: true, callControlAppId, migratedCount: 0, errors: [] };
    }

    // Reassign each phone number to the Call Control App
    for (const phoneNumber of phoneNumbers) {
      const result = await this.assignPhoneNumberToCallControlApp(
        managedAccountId,
        phoneNumber.telnyxPhoneNumberId,
        callControlAppId
      );

      if (result.success) {
        migratedCount++;
      } else {
        errors.push(`Failed to migrate ${phoneNumber.phoneNumber}: ${result.error}`);
      }
    }

    const success = errors.length === 0;
    console.log(`[TelephonyProvisioning] Migration complete: ${migratedCount}/${phoneNumbers.length} numbers migrated`);

    return {
      success,
      callControlAppId,
      migratedCount,
      errors,
    };
  }

  /**
   * REPAIR FUNCTION: Fix phone numbers routing
   * If Call Control App is configured, assign numbers to it
   * Otherwise, assign to Credential Connection for backward compatibility
   */
  async repairPhoneNumberRouting(companyId: string, userId: string): Promise<{
    success: boolean;
    repairedCount: number;
    errors: string[];
  }> {
    console.log(`[TelephonyProvisioning] Starting phone number routing repair for company: ${companyId}, userId: ${userId}`);
    
    // Get telephony settings
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(and(eq(telephonySettings.companyId, companyId), eq(telephonySettings.ownerUserId, userId)));

    if (!settings) {
      return { success: false, repairedCount: 0, errors: ["Telephony settings not found for user"] };
    }

    // Get managed account from company
    const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
    const managedAccountId = await getCompanyManagedAccountId(companyId);

    if (!managedAccountId) {
      return { success: false, repairedCount: 0, errors: ["Company has no Telnyx managed account"] };
    }

    // Get all phone numbers for the company (not just user)
    const phoneNumbers = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId));

    if (phoneNumbers.length === 0) {
      return { success: true, repairedCount: 0, errors: [] };
    }

    const errors: string[] = [];
    let repairedCount = 0;

    for (const phoneNumber of phoneNumbers) {
      try {
        // Determine routing based on phone number configuration
        // CRITICAL: ivrId="unassigned" means IVR is DISABLED, so use Credential Connection for direct SIP routing
        // Only use Call Control App when IVR is ENABLED (has a real IVR ID, not "unassigned")
        const hasActiveIvr = phoneNumber.ivrId && phoneNumber.ivrId !== "unassigned";
        const needsCallControl = hasActiveIvr; // Only IVR-enabled phones need Call Control App for webhooks
        
        if (needsCallControl && settings.callControlAppId) {
          // Use Call Control App for IVR routing (webhooks handle IVR/Queue logic)
          // Use the assignPhoneNumberToCallControlApp method which handles E911 disable before routing change
          console.log(`[TelephonyProvisioning] Phone ${phoneNumber.phoneNumber} needs Call Control App (active IVR: ${phoneNumber.ivrId})`);
          
          const assignResult = await this.assignPhoneNumberToCallControlApp(
            managedAccountId,
            phoneNumber.telnyxPhoneNumberId,
            settings.callControlAppId
          );

          if (!assignResult.success) {
            errors.push(`Failed to repair ${phoneNumber.phoneNumber}: ${assignResult.error}`);
            console.log(`[TelephonyProvisioning] FAILED to assign Call Control App to ${phoneNumber.phoneNumber}: ${assignResult.error}`);
            continue;
          }

          console.log(`[TelephonyProvisioning] Phone ${phoneNumber.phoneNumber} -> Call Control App ${settings.callControlAppId} (intelligent routing)`);
          repairedCount++;
        } else if (settings.credentialConnectionId) {
          // Use Credential Connection for direct SIP routing - enables simultaneous_ringing to all registered devices
          console.log(`[TelephonyProvisioning] Phone ${phoneNumber.phoneNumber} using Credential Connection (simultaneous ring to all devices)`);
          
          const response = await this.makeApiRequest(
            managedAccountId,
            `/phone_numbers/${phoneNumber.telnyxPhoneNumberId}`,
            "PATCH",
            { 
              connection_id: settings.credentialConnectionId,
              call_control_application_id: null
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`Failed to repair ${phoneNumber.phoneNumber}: HTTP ${response.status} - ${errorText}`);
            continue;
          }

          // Update database
          await db
            .update(telnyxPhoneNumbers)
            .set({ connectionId: settings.credentialConnectionId, updatedAt: new Date() })
            .where(eq(telnyxPhoneNumbers.id, phoneNumber.id));

          console.log(`[TelephonyProvisioning] Phone ${phoneNumber.phoneNumber} -> Credential Connection (direct routing)`);
          repairedCount++;
        }
      } catch (error) {
        errors.push(`Error repairing ${phoneNumber.phoneNumber}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    console.log(`[TelephonyProvisioning] Repair complete: ${repairedCount} phones repaired`);
    return { success: errors.length === 0, repairedCount, errors };
  }

  /**
   * Provision a dedicated SIP Connection for a PBX extension
   * Each extension gets its own Credential Connection and SIP credentials
   * This enables independent WebRTC registration per agent
   */
  async provisionExtensionSipConnection(
    companyId: string,
    extensionId: string
  ): Promise<{ 
    success: boolean; 
    credentialConnectionId?: string;
    sipCredentialId?: string;
    sipUsername?: string;
    sipPassword?: string;
    sipDomain?: string;
    error?: string;
  }> {
    console.log(`[TelephonyProvisioning] Provisioning SIP Connection for extension: ${extensionId}`);

    try {
      // Get extension details
      const [extension] = await db
        .select({
          id: pbxExtensions.id,
          companyId: pbxExtensions.companyId,
          userId: pbxExtensions.userId,
          extension: pbxExtensions.extension,
          displayName: pbxExtensions.displayName,
          telnyxCredentialConnectionId: pbxExtensions.telnyxCredentialConnectionId,
        })
        .from(pbxExtensions)
        .where(and(eq(pbxExtensions.id, extensionId), eq(pbxExtensions.companyId, companyId)));

      if (!extension) {
        return { success: false, error: "Extension not found" };
      }

      // Check if already provisioned
      if (extension.telnyxCredentialConnectionId) {
        console.log(`[TelephonyProvisioning] Extension ${extensionId} already has SIP connection: ${extension.telnyxCredentialConnectionId}`);
        return { success: false, error: "Extension already has a SIP connection" };
      }

      // Get user info for display name
      const [user] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, extension.userId));

      const displayName = extension.displayName || 
        (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : `Ext ${extension.extension}`);

      // Get company info
      const [company] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId));

      // Get managed account ID
      const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
      const managedAccountId = await getCompanyManagedAccountId(companyId);

      if (!managedAccountId) {
        return { success: false, error: "Company has no Telnyx managed account" };
      }

      // Get company's outbound voice profile for the credential connection
      const [settings] = await db
        .select({ outboundVoiceProfileId: telephonySettings.outboundVoiceProfileId })
        .from(telephonySettings)
        .where(eq(telephonySettings.companyId, companyId));

      if (!settings?.outboundVoiceProfileId) {
        return { success: false, error: "Company has no outbound voice profile. Please complete telephony setup first." };
      }

      const webhookBaseUrl = await getWebhookBaseUrl();

      // Generate unique SIP username and password for this extension
      // Username: 4-32 chars, alphanumeric, at least one letter in first 5 chars
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const sipUsername = `ext${extension.extension}${randomSuffix}`.substring(0, 32);
      // Password: 8-128 chars, secure
      const sipPassword = `Curbe${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}!`;

      // Step 1: Create Credential Connection for this extension
      console.log(`[TelephonyProvisioning] Creating Credential Connection for extension ${extension.extension}...`);
      
      const connectionName = `${company?.name || 'Company'} - Ext ${extension.extension} - ${displayName}`;
      
      const connResponse = await this.makeApiRequest(
        managedAccountId,
        "/credential_connections",
        "POST",
        {
          connection_name: connectionName.substring(0, 100), // Telnyx limit
          user_name: sipUsername, // Required by Telnyx API
          password: sipPassword, // Required by Telnyx API
          active: true,
          anchorsite_override: "Latency",
          // CRITICAL: Enable RTCP-MUX for WebRTC compatibility
          // Browser WebRTC requires RTCP-MUX or setRemoteDescription fails with:
          // "RTCP-MUX is not enabled when it is required"
          rtcp_mux_enabled: true,
          outbound: {
            outbound_voice_profile_id: settings.outboundVoiceProfileId,
            channel_limit: 2, // Single extension needs only a couple channels
          },
          inbound: {
            channel_limit: 2,
            codecs: ["G722", "G711U", "G711A"],
            simultaneous_ringing: "enabled",
          },
          sip_uri_calling_preference: "unrestricted",
          webhook_event_url: `${webhookBaseUrl}/webhooks/telnyx/voice/status`,
        }
      );

      if (!connResponse.ok) {
        const errorText = await connResponse.text();
        console.error(`[TelephonyProvisioning] Failed to create credential connection: ${errorText}`);
        return { success: false, error: `Failed to create SIP connection: ${errorText}` };
      }

      const connData = await connResponse.json();
      const credentialConnectionId = connData.data?.id;
      // Get the SIP domain from the connection - Telnyx returns sip_uri in format "sip:user@domain"
      const returnedSipUri = connData.data?.sip_uri;
      const sipDomain = returnedSipUri 
        ? returnedSipUri.replace(/^sip:[^@]+@/, '') 
        : "sip.telnyx.com";

      console.log(`[TelephonyProvisioning] Credential Connection created: ${credentialConnectionId}, domain: ${sipDomain}`);

      // Step 2: Disable SRTP for WebRTC compatibility
      await this.disableSrtpEncryption(managedAccountId, credentialConnectionId);

      console.log(`[TelephonyProvisioning] SIP Credentials ready: ${sipUsername}`);

      // Step 3: Update extension record with SIP connection details
      // IMPORTANT: Store password in plain text per user requirement (see replit.md)
      await db
        .update(pbxExtensions)
        .set({
          telnyxCredentialConnectionId: credentialConnectionId,
          sipCredentialId: credentialConnectionId, // Use connection ID as credential ID
          sipUsername: sipUsername,
          sipPassword: sipPassword,
          sipDomain: sipDomain,
          updatedAt: new Date(),
        })
        .where(eq(pbxExtensions.id, extensionId));

      console.log(`[TelephonyProvisioning] Extension ${extension.extension} SIP provisioning complete`);

      return {
        success: true,
        credentialConnectionId,
        sipCredentialId: credentialConnectionId,
        sipUsername,
        sipPassword,
        sipDomain,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TelephonyProvisioning] Extension SIP provisioning failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Delete SIP Connection for an extension (cleanup)
   */
  async deprovisionExtensionSipConnection(
    companyId: string,
    extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Deprovisioning SIP Connection for extension: ${extensionId}`);

    try {
      const [extension] = await db
        .select({
          telnyxCredentialConnectionId: pbxExtensions.telnyxCredentialConnectionId,
          sipCredentialId: pbxExtensions.sipCredentialId,
        })
        .from(pbxExtensions)
        .where(and(eq(pbxExtensions.id, extensionId), eq(pbxExtensions.companyId, companyId)));

      if (!extension) {
        return { success: false, error: "Extension not found" };
      }

      if (!extension.telnyxCredentialConnectionId) {
        return { success: true }; // Nothing to deprovision
      }

      const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
      const managedAccountId = await getCompanyManagedAccountId(companyId);

      if (!managedAccountId) {
        return { success: false, error: "Company has no Telnyx managed account" };
      }

      // Delete SIP credentials first
      if (extension.sipCredentialId) {
        try {
          await this.makeApiRequest(
            managedAccountId,
            `/telephony_credentials/${extension.sipCredentialId}`,
            "DELETE"
          );
          console.log(`[TelephonyProvisioning] SIP credentials deleted: ${extension.sipCredentialId}`);
        } catch (error) {
          console.error(`[TelephonyProvisioning] Failed to delete SIP credentials:`, error);
        }
      }

      // Delete credential connection
      await this.rollbackCredentialConnection(managedAccountId, extension.telnyxCredentialConnectionId);

      // Clear extension SIP fields
      await db
        .update(pbxExtensions)
        .set({
          telnyxCredentialConnectionId: null,
          sipCredentialId: null,
          sipUsername: null,
          sipPassword: null,
          sipDomain: null,
          updatedAt: new Date(),
        })
        .where(eq(pbxExtensions.id, extensionId));

      console.log(`[TelephonyProvisioning] Extension SIP deprovisioning complete`);
      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TelephonyProvisioning] Extension SIP deprovisioning failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Assign a phone number to an extension's SIP connection
   * Routes the number to the extension's Credential Connection
   */
  async assignPhoneNumberToExtension(
    companyId: string,
    extensionId: string,
    phoneNumberId: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[TelephonyProvisioning] Assigning phone ${phoneNumberId} to extension ${extensionId}`);

    try {
      // Get extension SIP connection
      const [extension] = await db
        .select({
          telnyxCredentialConnectionId: pbxExtensions.telnyxCredentialConnectionId,
          extension: pbxExtensions.extension,
        })
        .from(pbxExtensions)
        .where(and(eq(pbxExtensions.id, extensionId), eq(pbxExtensions.companyId, companyId)));

      if (!extension) {
        return { success: false, error: "Extension not found" };
      }

      if (!extension.telnyxCredentialConnectionId) {
        return { success: false, error: "Extension has no SIP connection. Provision it first." };
      }

      // Get phone number details
      const [phoneNumber] = await db
        .select()
        .from(telnyxPhoneNumbers)
        .where(and(eq(telnyxPhoneNumbers.id, phoneNumberId), eq(telnyxPhoneNumbers.companyId, companyId)));

      if (!phoneNumber) {
        return { success: false, error: "Phone number not found" };
      }

      const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
      const managedAccountId = await getCompanyManagedAccountId(companyId);

      if (!managedAccountId) {
        return { success: false, error: "Company has no Telnyx managed account" };
      }

      // Update phone number routing to extension's credential connection
      const response = await this.makeApiRequest(
        managedAccountId,
        `/phone_numbers/${phoneNumber.telnyxPhoneNumberId}`,
        "PATCH",
        {
          connection_id: extension.telnyxCredentialConnectionId,
          call_control_application_id: null,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to update phone number routing: ${errorText}` };
      }

      // Update database records
      await db
        .update(telnyxPhoneNumbers)
        .set({
          connectionId: extension.telnyxCredentialConnectionId,
          updatedAt: new Date(),
        })
        .where(eq(telnyxPhoneNumbers.id, phoneNumberId));

      await db
        .update(pbxExtensions)
        .set({
          directPhoneNumberId: phoneNumberId,
          updatedAt: new Date(),
        })
        .where(eq(pbxExtensions.id, extensionId));

      console.log(`[TelephonyProvisioning] Phone ${phoneNumber.phoneNumber} assigned to extension ${extension.extension}`);
      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TelephonyProvisioning] Phone assignment failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Enable RTCP-MUX on an existing credential connection
   * CRITICAL: WebRTC browsers require RTCP-MUX enabled, otherwise setRemoteDescription fails
   * with error: "RTCP-MUX is not enabled when it is required"
   */
  async enableRtcpMux(
    managedAccountId: string,
    connectionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Enabling RTCP-MUX on connection: ${connectionId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${connectionId}`,
        "PATCH",
        {
          rtcp_mux_enabled: true,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to enable RTCP-MUX: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      console.log(`[TelephonyProvisioning] RTCP-MUX enabled successfully. Response:`, JSON.stringify(data.data?.rtcp_mux_enabled));
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";
      console.error(`[TelephonyProvisioning] Error enabling RTCP-MUX:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Repair extension SIP connections to enable RTCP-MUX
   * Required for extensions provisioned before RTCP-MUX was added
   */
  async repairExtensionRtcpMux(
    companyId: string,
    extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Repairing RTCP-MUX for extension: ${extensionId}`);

      // Get extension
      const [extension] = await db
        .select({
          telnyxCredentialConnectionId: pbxExtensions.telnyxCredentialConnectionId,
          extension: pbxExtensions.extension,
        })
        .from(pbxExtensions)
        .where(and(eq(pbxExtensions.id, extensionId), eq(pbxExtensions.companyId, companyId)));

      if (!extension?.telnyxCredentialConnectionId) {
        return { success: false, error: "Extension has no SIP connection" };
      }

      // Get managed account ID
      const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
      const managedAccountId = await getCompanyManagedAccountId(companyId);

      if (!managedAccountId) {
        return { success: false, error: "Company has no Telnyx managed account" };
      }

      const result = await this.enableRtcpMux(managedAccountId, extension.telnyxCredentialConnectionId);
      
      if (result.success) {
        console.log(`[TelephonyProvisioning] Extension ${extension.extension} RTCP-MUX repair complete`);
      }
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TelephonyProvisioning] Extension RTCP-MUX repair failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Repair all extensions in a company to enable RTCP-MUX
   */
  async repairAllExtensionsRtcpMux(companyId: string): Promise<{
    success: boolean;
    repairedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    console.log(`[TelephonyProvisioning] Repairing RTCP-MUX for all extensions in company: ${companyId}`);

    const extensions = await db
      .select({
        id: pbxExtensions.id,
        extension: pbxExtensions.extension,
        telnyxCredentialConnectionId: pbxExtensions.telnyxCredentialConnectionId,
      })
      .from(pbxExtensions)
      .where(eq(pbxExtensions.companyId, companyId));

    let repairedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const ext of extensions) {
      if (!ext.telnyxCredentialConnectionId) {
        console.log(`[TelephonyProvisioning] Skipping extension ${ext.extension} - no SIP connection`);
        continue;
      }

      const result = await this.repairExtensionRtcpMux(companyId, ext.id);
      if (result.success) {
        repairedCount++;
      } else {
        failedCount++;
        errors.push(`Ext ${ext.extension}: ${result.error}`);
      }
    }

    console.log(`[TelephonyProvisioning] RTCP-MUX repair complete: ${repairedCount} repaired, ${failedCount} failed`);
    return { success: failedCount === 0, repairedCount, failedCount, errors };
  }

  /**
   * Add outbound voice profile to an extension's credential connection
   * CRITICAL: Extensions need outbound_voice_profile_id to make outbound calls
   * Without this, Telnyx returns error: "You cannot enable emergency services on a number 
   * unless it has both a connection and an active outbound profile"
   */
  async repairExtensionOutboundProfile(
    companyId: string,
    extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[TelephonyProvisioning] Repairing outbound profile for extension: ${extensionId}`);

      // Get extension
      const [extension] = await db
        .select({
          telnyxCredentialConnectionId: pbxExtensions.telnyxCredentialConnectionId,
          extension: pbxExtensions.extension,
        })
        .from(pbxExtensions)
        .where(and(eq(pbxExtensions.id, extensionId), eq(pbxExtensions.companyId, companyId)));

      if (!extension?.telnyxCredentialConnectionId) {
        return { success: false, error: "Extension has no SIP connection" };
      }

      // Get company's outbound voice profile
      const [settings] = await db
        .select({ outboundVoiceProfileId: telephonySettings.outboundVoiceProfileId })
        .from(telephonySettings)
        .where(eq(telephonySettings.companyId, companyId));

      if (!settings?.outboundVoiceProfileId) {
        return { success: false, error: "Company has no outbound voice profile" };
      }

      // Get managed account ID
      const { getCompanyManagedAccountId } = await import("./telnyx-managed-accounts");
      const managedAccountId = await getCompanyManagedAccountId(companyId);

      if (!managedAccountId) {
        return { success: false, error: "Company has no Telnyx managed account" };
      }

      // PATCH the credential connection with outbound voice profile
      console.log(`[TelephonyProvisioning] Adding outbound_voice_profile_id ${settings.outboundVoiceProfileId} to connection ${extension.telnyxCredentialConnectionId}`);
      
      const response = await this.makeApiRequest(
        managedAccountId,
        `/credential_connections/${extension.telnyxCredentialConnectionId}`,
        "PATCH",
        {
          outbound: {
            outbound_voice_profile_id: settings.outboundVoiceProfileId,
            channel_limit: 2,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TelephonyProvisioning] Failed to add outbound profile: ${response.status} - ${errorText}`);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      console.log(`[TelephonyProvisioning] Extension ${extension.extension} outbound profile repair complete. Profile ID: ${data.data?.outbound?.outbound_voice_profile_id}`);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[TelephonyProvisioning] Extension outbound profile repair failed:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Repair all extensions in a company to add outbound voice profile
   * Required for extensions provisioned before outbound profile was added
   */
  async repairAllExtensionsOutboundProfile(companyId: string): Promise<{
    success: boolean;
    repairedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    console.log(`[TelephonyProvisioning] Repairing outbound profile for all extensions in company: ${companyId}`);

    const extensions = await db
      .select({
        id: pbxExtensions.id,
        extension: pbxExtensions.extension,
        telnyxCredentialConnectionId: pbxExtensions.telnyxCredentialConnectionId,
      })
      .from(pbxExtensions)
      .where(eq(pbxExtensions.companyId, companyId));

    let repairedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const ext of extensions) {
      if (!ext.telnyxCredentialConnectionId) {
        console.log(`[TelephonyProvisioning] Skipping extension ${ext.extension} - no SIP connection`);
        continue;
      }

      const result = await this.repairExtensionOutboundProfile(companyId, ext.id);
      if (result.success) {
        repairedCount++;
      } else {
        failedCount++;
        errors.push(`Ext ${ext.extension}: ${result.error}`);
      }
    }

    console.log(`[TelephonyProvisioning] Outbound profile repair complete: ${repairedCount} repaired, ${failedCount} failed`);
    return { success: failedCount === 0, repairedCount, failedCount, errors };
  }
}

export const telephonyProvisioningService = new TelephonyProvisioningService();
