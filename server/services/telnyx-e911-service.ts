import { db } from "../db";
import { wallets, telnyxPhoneNumbers, telephonySettings, companies, telephonyCredentials } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { secretsService } from "../services/secrets-service";

const TELNYX_WSS_SERVER = "wss://sip.telnyx.com:443";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

interface E911AddressData {
  streetAddress: string;
  extendedAddress?: string;
  locality: string;
  administrativeArea: string;
  postalCode: string;
  countryCode: string;
  callerName: string;
  phoneNumber?: string;
}

interface E911CreateResult {
  success: boolean;
  addressId?: string;
  error?: string;
}

export interface ManagedAccountConfig {
  apiKey: string;
  managedAccountId: string;
}

async function getTelnyxMasterApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured. Please add it in Settings > API Keys.");
  }
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
  return apiKey;
}

export async function getManagedAccountConfig(companyId: string): Promise<ManagedAccountConfig | null> {
  const [wallet] = await db
    .select({ telnyxAccountId: wallets.telnyxAccountId })
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  if (!wallet?.telnyxAccountId) {
    return null;
  }
  
  const apiKey = await getTelnyxMasterApiKey();
  
  return {
    apiKey,
    managedAccountId: wallet.telnyxAccountId,
  };
}

export function buildHeaders(config: ManagedAccountConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  if (config.managedAccountId && config.managedAccountId !== "MASTER_ACCOUNT") {
    headers["x-managed-account-id"] = config.managedAccountId;
  }
  return headers;
}

async function getPhoneNumberDetails(
  config: ManagedAccountConfig,
  phoneNumberId: string
): Promise<{ success: boolean; phoneNumber?: string; connectionId?: string; error?: string }> {
  try {
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "GET",
      headers: buildHeaders(config),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Failed to get phone number: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to get phone number: ${response.status}` };
    }

    const result = await response.json();
    return {
      success: true,
      phoneNumber: result.data?.phone_number,
      connectionId: result.data?.connection_id,
    };
  } catch (error) {
    console.error("[E911] Get phone number error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get phone number",
    };
  }
}

async function getOrCreateOutboundVoiceProfile(
  config: ManagedAccountConfig,
  companyId: string
): Promise<{ success: boolean; profileId?: string; error?: string }> {
  const [settings] = await db
    .select({ outboundVoiceProfileId: telephonySettings.outboundVoiceProfileId })
    .from(telephonySettings)
    .where(eq(telephonySettings.companyId, companyId));

  if (settings?.outboundVoiceProfileId) {
    console.log(`[E911] Using existing outbound voice profile: ${settings.outboundVoiceProfileId}`);
    return { success: true, profileId: settings.outboundVoiceProfileId };
  }

  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId));

  const companyName = company?.name || "Company";
  const profileName = `${companyName} - Outbound Profile`;

  console.log(`[E911] Looking for existing outbound voice profile: ${profileName}...`);

  try {
    // First, search for existing profile by name in Telnyx
    const searchResponse = await fetch(
      `${TELNYX_API_BASE}/outbound_voice_profiles?filter[name]=${encodeURIComponent(profileName)}`,
      {
        method: "GET",
        headers: buildHeaders(config),
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const existingProfile = searchData.data?.find((p: any) => p.name === profileName);
      
      if (existingProfile?.id) {
        console.log(`[E911] Found existing outbound voice profile in Telnyx: ${existingProfile.id}`);
        
        // Save to database
        const [existing] = await db
          .select({ id: telephonySettings.id })
          .from(telephonySettings)
          .where(eq(telephonySettings.companyId, companyId));

        if (existing) {
          await db.update(telephonySettings)
            .set({ outboundVoiceProfileId: existingProfile.id, updatedAt: new Date() })
            .where(eq(telephonySettings.companyId, companyId));
        } else {
          await db.insert(telephonySettings).values({
            companyId,
            outboundVoiceProfileId: existingProfile.id,
            provisioningStatus: "provisioning" as const,
          });
        }

        return { success: true, profileId: existingProfile.id };
      }
    }

    console.log(`[E911] Creating outbound voice profile for ${companyName}...`);

    const response = await fetch(`${TELNYX_API_BASE}/outbound_voice_profiles`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        name: profileName,
        service_plan: "global",
        traffic_type: "conversational",
        usage_payment_method: "rate-deck",
        concurrent_call_limit: 10,
        daily_spend_limit: "25.00",
        daily_spend_limit_enabled: true,
        enabled: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Failed to create outbound voice profile: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to create voice profile: ${response.status}` };
    }

    const data = await response.json();
    const profileId = data.data?.id;

    console.log(`[E911] Outbound voice profile created: ${profileId}`);

    const [existing] = await db
      .select({ id: telephonySettings.id })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (existing) {
      await db.update(telephonySettings)
        .set({ outboundVoiceProfileId: profileId, updatedAt: new Date() })
        .where(eq(telephonySettings.companyId, companyId));
    } else {
      await db.insert(telephonySettings).values({
        companyId,
        outboundVoiceProfileId: profileId,
        provisioningStatus: "provisioning" as const,
      });
    }

    return { success: true, profileId };
  } catch (error) {
    console.error("[E911] Create outbound voice profile error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create voice profile" };
  }
}

async function getOrCreateTexmlApplication(
  config: ManagedAccountConfig,
  companyId: string,
  outboundVoiceProfileId: string
): Promise<{ success: boolean; appId?: string; error?: string }> {
  const [settings] = await db
    .select({ texmlAppId: telephonySettings.texmlAppId })
    .from(telephonySettings)
    .where(eq(telephonySettings.companyId, companyId));

  if (settings?.texmlAppId) {
    console.log(`[Telephony] Using existing TeXML app: ${settings.texmlAppId}`);
    return { success: true, appId: settings.texmlAppId };
  }

  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId));

  const companyName = company?.name || "Company";
  const webhookBaseUrl = process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
    : "https://curbe.io";

  console.log(`[Telephony] Creating TeXML application for ${companyName}...`);

  try {
    const response = await fetch(`${TELNYX_API_BASE}/texml_applications`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        friendly_name: `${companyName} - Voice App`,
        voice_url: `${webhookBaseUrl}/webhooks/telnyx/voice/${companyId}`,
        voice_method: "POST",
        status_callback: `${webhookBaseUrl}/webhooks/telnyx/status/${companyId}`,
        status_callback_method: "POST",
        outbound_voice_profile_id: outboundVoiceProfileId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telephony] Failed to create TeXML app: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to create TeXML app: ${response.status}` };
    }

    const data = await response.json();
    const appId = data.data?.id;

    console.log(`[Telephony] TeXML application created: ${appId}`);

    await db.update(telephonySettings)
      .set({ texmlAppId: appId, updatedAt: new Date() })
      .where(eq(telephonySettings.companyId, companyId));

    return { success: true, appId };
  } catch (error) {
    console.error("[Telephony] Create TeXML app error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create TeXML app" };
  }
}

function generateSipUsername(companyId: string): string {
  const prefix = "curbe";
  const companyPart = companyId.replace(/-/g, '').slice(0, 8);
  const randomPart = Math.random().toString(36).substring(2, 6);
  return `${prefix}${companyPart}${randomPart}`.toLowerCase();
}

function generateSipUsernameWithExtension(companyName: string, extension: string): string {
  // Use company name + extension for readable format (e.g., cobertis1001)
  const sanitizedName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .slice(0, 20); // Max 20 chars for company name
  const extPart = extension.replace(/\D/g, '').slice(0, 4);
  return `${sanitizedName}${extPart}`;
}

function generateSipPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 20; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function getOrCreateCredentialConnection(
  config: ManagedAccountConfig,
  companyId: string,
  outboundVoiceProfileId: string
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const [settings] = await db
    .select({ credentialConnectionId: telephonySettings.credentialConnectionId })
    .from(telephonySettings)
    .where(eq(telephonySettings.companyId, companyId));

  if (settings?.credentialConnectionId) {
    // Verify the credential connection still exists in Telnyx before using it
    try {
      const verifyResponse = await fetch(`${TELNYX_API_BASE}/credential_connections/${settings.credentialConnectionId}`, {
        method: "GET",
        headers: buildHeaders(config),
      });
      
      if (verifyResponse.ok) {
        console.log(`[E911] Verified credential connection exists: ${settings.credentialConnectionId}`);
        return { success: true, connectionId: settings.credentialConnectionId };
      } else {
        console.log(`[E911] Credential connection ${settings.credentialConnectionId} no longer exists in Telnyx (${verifyResponse.status}), will create new...`);
        // Clear the invalid ID from database
        await db.update(telephonySettings)
          .set({ credentialConnectionId: null })
          .where(eq(telephonySettings.companyId, companyId));
        // Continue to create new connection below
      }
    } catch (verifyError) {
      console.error(`[E911] Error verifying credential connection:`, verifyError);
      // Continue to create new connection below
    }
  }

  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId));

  const companyName = company?.name || "Company";

  console.log(`[E911] Creating credential connection for ${companyName}...`);

  const sipUsername = generateSipUsername(companyId);
  const sipPassword = generateSipPassword();

  console.log(`[E911] Generated SIP username: ${sipUsername}`);

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
        // CRITICAL: Allow TeXML to dial SIP URI for inbound calls
        sip_uri_calling_preference: "unrestricted",
        // WebRTC requires SRTP encryption
        encrypted_media: "SRTP",
        // DTMF type for WebRTC compatibility
        dtmf_type: "RFC 2833",
        // Enable comfort noise when call is on hold
        default_on_hold_comfort_noise_enabled: true,
        // RTCP settings for call quality monitoring
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
          // Codec priority: G.711 first for PSTN compatibility, OPUS last for SIP-to-SIP
          // G711U = µ-law (US/Japan), G711A = A-law (Europe), G722 = wideband, OPUS = HD
          codecs: ["G711U", "G711A", "G722", "OPUS"],
          generate_ringback_tone: true,
          // Enable SHAKEN/STIR for caller ID verification
          shaken_stir_enabled: true,
          // Enable simultaneous ring - all devices with same credentials ring at once
          simultaneous_ringing: "enabled",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Failed to create credential connection: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to create connection: ${response.status}` };
    }

    const data = await response.json();
    const connectionId = data.data?.id;

    console.log(`[E911] Credential connection created: ${connectionId}`);

    await db.update(telephonySettings)
      .set({ 
        credentialConnectionId: connectionId, 
        updatedAt: new Date() 
      })
      .where(eq(telephonySettings.companyId, companyId));

    await db.insert(telephonyCredentials).values({
      companyId,
      telnyxCredentialId: connectionId,
      sipUsername,
      sipPassword,
      isActive: true,
    });

    console.log(`[E911] SIP credentials saved: ${sipUsername}@sip.telnyx.com`);

    return { success: true, connectionId, sipUsername, sipPassword };
  } catch (error) {
    console.error("[E911] Create credential connection error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create connection" };
  }
}

async function assignConnectionToPhoneNumber(
  config: ManagedAccountConfig,
  phoneNumberId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[E911] Assigning credential connection ${connectionId} to phone number ${phoneNumberId}...`);

  try {
    // CRITICAL FIX: Clear texml_application_id to route calls directly to WebRTC
    // Per Telnyx docs, TeXML routing creates second SIP leg causing 4-6s audio delay
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "PATCH",
      headers: buildHeaders(config),
      body: JSON.stringify({ 
        connection_id: connectionId,
        texml_application_id: null  // Clear TeXML to enable direct WebRTC routing
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Failed to assign connection: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to assign connection: ${response.status}` };
    }

    console.log(`[E911] Credential connection assigned successfully (TeXML cleared for direct WebRTC routing)`);
    return { success: true };
  } catch (error) {
    console.error("[E911] Assign connection error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to assign connection" };
  }
}

async function ensurePhoneNumberHasCredentialConnection(
  config: ManagedAccountConfig,
  companyId: string,
  phoneNumberId: string
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  console.log(`[E911] Ensuring phone number has CREDENTIAL CONNECTION (required for E911)...`);

  const ovpResult = await getOrCreateOutboundVoiceProfile(config, companyId);
  if (!ovpResult.success || !ovpResult.profileId) {
    return { success: false, error: ovpResult.error };
  }

  const connResult = await getOrCreateCredentialConnection(config, companyId, ovpResult.profileId);
  if (!connResult.success || !connResult.connectionId) {
    return { success: false, error: connResult.error };
  }

  const phoneDetails = await getPhoneNumberDetails(config, phoneNumberId);
  if (!phoneDetails.success) {
    return { success: false, error: phoneDetails.error };
  }

  if (phoneDetails.connectionId === connResult.connectionId) {
    console.log(`[E911] Phone number already has correct credential connection: ${phoneDetails.connectionId}`);
    return { success: true, connectionId: connResult.connectionId };
  }

  console.log(`[E911] Phone number has connection ${phoneDetails.connectionId || 'NONE'}, replacing with credential connection ${connResult.connectionId}...`);

  const assignResult = await assignConnectionToPhoneNumber(config, phoneNumberId, connResult.connectionId);
  if (!assignResult.success) {
    return { success: false, error: assignResult.error };
  }

  return { success: true, connectionId: connResult.connectionId };
}

/**
 * Public function to assign a phone number to the company's credential connection.
 * This is required for outbound WebRTC calls to work.
 * Call this after purchasing a phone number or to repair existing numbers.
 */
export async function assignPhoneNumberToCredentialConnection(
  companyId: string,
  phoneNumberId: string
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  console.log(`[Phone Assignment] Assigning phone number ${phoneNumberId} to credential connection for company ${companyId}...`);
  
  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Company has no managed account configured" };
    }
    
    const result = await ensurePhoneNumberHasCredentialConnection(config, companyId, phoneNumberId);
    
    if (result.success && result.connectionId) {
      // Also update our local database record
      await db.update(telnyxPhoneNumbers)
        .set({ 
          connectionId: result.connectionId,
          updatedAt: new Date()
        })
        .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));
      
      console.log(`[Phone Assignment] Successfully assigned phone number to credential connection ${result.connectionId}`);
      
      // Also update the credential connection with the ANI override (caller ID)
      const phoneDetails = await getPhoneNumberDetails(config, phoneNumberId);
      if (phoneDetails.success && phoneDetails.phoneNumber) {
        const aniResult = await updateCredentialConnectionAni(config, result.connectionId, phoneDetails.phoneNumber);
        if (aniResult.success) {
          console.log(`[Phone Assignment] Set ANI override to ${phoneDetails.phoneNumber}`);
        } else {
          console.warn(`[Phone Assignment] Failed to set ANI override (non-fatal): ${aniResult.error}`);
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error("[Phone Assignment] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to assign phone number" };
  }
}

/**
 * Public function to repair/update a SIP connection with the company's phone number
 * This configures: 1) ANI override for outbound caller ID, 2) Enable simultaneous ringing
 * Call this to fix existing connections that are missing these settings
 */
export async function repairSipConnectionSettings(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[SIP Repair] Repairing SIP connection settings for company ${companyId}...`);
  
  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Company has no managed account configured" };
    }
    
    // Get the company's credential connection ID
    const [settings] = await db
      .select({ credentialConnectionId: telephonySettings.credentialConnectionId })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    
    if (!settings?.credentialConnectionId) {
      return { success: false, error: "No SIP connection found for this company" };
    }
    
    // Get the company's primary phone number
    const [phoneNumber] = await db
      .select({ phoneNumber: telnyxPhoneNumbers.phoneNumber })
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId));
    
    if (!phoneNumber?.phoneNumber) {
      return { success: false, error: "No phone number found for this company" };
    }
    
    console.log(`[SIP Repair] Found connection ${settings.credentialConnectionId} and phone ${phoneNumber.phoneNumber}`);
    
    // Update the connection with ANI override and simultaneous ringing
    const result = await updateCredentialConnectionAni(
      config,
      settings.credentialConnectionId,
      phoneNumber.phoneNumber
    );
    
    if (result.success) {
      console.log(`[SIP Repair] Successfully repaired SIP connection settings`);
    }
    
    return result;
  } catch (error) {
    console.error("[SIP Repair] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to repair SIP connection" };
  }
}

/**
 * Update a credential connection's ANI override (outbound caller ID) and enable simultaneous ringing
 * This is required for outbound calls to work properly and for multiple devices to ring at once
 */
async function updateCredentialConnectionAni(
  config: ManagedAccountConfig,
  connectionId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Connection Update] Setting outbound caller ID to ${phoneNumber} and enabling simultaneous ringing on connection ${connectionId}...`);
  
  try {
    const response = await fetch(`${TELNYX_API_BASE}/credential_connections/${connectionId}`, {
      method: "PATCH",
      headers: buildHeaders(config),
      body: JSON.stringify({
        outbound: {
          ani_override: phoneNumber,
          ani_override_type: "always",
        },
        inbound: {
          // Enable simultaneous ring - all devices with same credentials ring at once
          simultaneous_ringing: "enabled",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Connection Update] Failed to update: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to update connection: ${response.status}` };
    }

    console.log(`[Connection Update] Successfully set outbound caller ID to ${phoneNumber} and enabled simultaneous ringing`);
    return { success: true };
  } catch (error) {
    console.error("[Connection Update] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update connection" };
  }
}

interface TelnyxSuggestion {
  field: string;
  value: string;
}

function parseTelnyxSuggestions(errors: any[]): TelnyxSuggestion[] {
  const suggestions: TelnyxSuggestion[] = [];
  
  for (const error of errors) {
    if (error.title === "Suggestion" && error.source?.pointer) {
      const field = error.source.pointer.replace(/^\//, '');
      suggestions.push({
        field,
        value: error.detail || '',
      });
    }
  }
  
  return suggestions;
}

function applySuggestions(requestBody: Record<string, any>, suggestions: TelnyxSuggestion[]): Record<string, any> {
  const correctedBody = { ...requestBody };
  
  for (const suggestion of suggestions) {
    if (suggestion.value !== undefined) {
      correctedBody[suggestion.field] = suggestion.value;
    }
  }
  
  return correctedBody;
}

export async function createEmergencyAddress(
  companyId: string,
  addressData: E911AddressData,
  phoneNumber: string
): Promise<E911CreateResult> {
  try {
    const config = await getManagedAccountConfig(companyId);
    
    if (!config) {
      return { success: false, error: "Phone system not configured for this company" };
    }

    console.log(`[E911] Creating emergency address for company ${companyId}`);

    const requestBody: Record<string, any> = {
      street_address: addressData.streetAddress.toUpperCase(),
      locality: addressData.locality.toUpperCase(),
      administrative_area: addressData.administrativeArea.toUpperCase(),
      postal_code: addressData.postalCode,
      country_code: addressData.countryCode || "US",
      phone_number: phoneNumber,
      address_book: false,
      validate_address: true,
    };

    if (addressData.callerName.includes(' ')) {
      const nameParts = addressData.callerName.split(' ');
      requestBody.first_name = nameParts[0].toUpperCase();
      requestBody.last_name = nameParts.slice(1).join(' ').toUpperCase();
    } else {
      requestBody.business_name = addressData.callerName.toUpperCase();
    }

    if (addressData.extendedAddress) {
      requestBody.extended_address = addressData.extendedAddress.toUpperCase();
    }

    console.log(`[E911] Initial request body:`, requestBody);

    let response = await fetch(`${TELNYX_API_BASE}/addresses`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify(requestBody),
    });

    let responseText = await response.text();
    console.log(`[E911] Response status: ${response.status}`);

    if (response.status === 422) {
      try {
        const errorData = JSON.parse(responseText);
        
        if (errorData.errors && errorData.errors.some((e: any) => e.title === "Suggestion")) {
          console.log(`[E911] Received address suggestions from Telnyx, applying corrections...`);
          
          const suggestions = parseTelnyxSuggestions(errorData.errors);
          console.log(`[E911] Suggestions:`, suggestions);
          
          const correctedBody = applySuggestions(requestBody, suggestions);
          correctedBody.validate_address = false;
          
          console.log(`[E911] Corrected request body:`, correctedBody);
          
          response = await fetch(`${TELNYX_API_BASE}/addresses`, {
            method: "POST",
            headers: buildHeaders(config),
            body: JSON.stringify(correctedBody),
          });
          
          responseText = await response.text();
          console.log(`[E911] Retry response status: ${response.status}`);
          console.log(`[E911] Retry response body: ${responseText}`);
        }
      } catch (parseError) {
        console.error(`[E911] Failed to parse 422 response:`, parseError);
      }
    }

    if (!response.ok) {
      console.log(`[E911] Error response body: ${responseText}`);
      try {
        const errorData = JSON.parse(responseText);
        const errorMessages = errorData.errors?.map((e: any) => e.detail || e.title).join(', ');
        return { success: false, error: errorMessages || `Failed to create address: ${response.status}` };
      } catch {
        return { success: false, error: `Failed to create address: ${response.status}` };
      }
    }

    const result = JSON.parse(responseText);
    const addressId = result.data.id;

    console.log(`[E911] Emergency address created: ID=${addressId}`);

    return {
      success: true,
      addressId,
    };
  } catch (error) {
    console.error("[E911] Create address error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create emergency address",
    };
  }
}

async function enableE911OnPhoneNumber(
  config: ManagedAccountConfig,
  phoneNumberId: string,
  emergencyAddressId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[E911] Enabling E911 on phone number ${phoneNumberId} with address ${emergencyAddressId}`);

    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/actions/enable_emergency`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        emergency_enabled: true,
        emergency_address_id: emergencyAddressId,
      }),
    });

    const responseText = await response.text();
    console.log(`[E911] Enable emergency response status: ${response.status}`);
    console.log(`[E911] Enable emergency response: ${responseText}`);

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        const errorMessages = errorData.errors?.map((e: any) => e.detail || e.title).join(', ');
        return { success: false, error: errorMessages || `Failed to enable E911: ${response.status}` };
      } catch {
        return { success: false, error: `Failed to enable E911: ${response.status}` };
      }
    }

    const result = JSON.parse(responseText);
    console.log(`[E911] E911 enabled on phone number. Emergency settings:`, result.data?.emergency);

    return { success: true };
  } catch (error) {
    console.error("[E911] Enable E911 error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to enable E911",
    };
  }
}

export async function registerE911ForNumber(
  companyId: string,
  phoneNumberId: string,
  addressData: E911AddressData
): Promise<{
  success: boolean;
  addressId?: string;
  error?: string;
}> {
  const config = await getManagedAccountConfig(companyId);
  
  if (!config) {
    return { success: false, error: "Phone system not configured for this company" };
  }

  const phoneDetails = await getPhoneNumberDetails(config, phoneNumberId);
  
  if (!phoneDetails.success || !phoneDetails.phoneNumber) {
    return { success: false, error: phoneDetails.error || "Phone number not found" };
  }

  console.log(`[E911] Registering E911 for phone: ${phoneDetails.phoneNumber}`);

  const connectionResult = await ensurePhoneNumberHasCredentialConnection(config, companyId, phoneNumberId);
  if (!connectionResult.success) {
    return { success: false, error: connectionResult.error };
  }

  const addressResult = await createEmergencyAddress(companyId, addressData, phoneDetails.phoneNumber);
  
  if (!addressResult.success || !addressResult.addressId) {
    return { success: false, error: addressResult.error || "Failed to create emergency address" };
  }

  const enableResult = await enableE911OnPhoneNumber(config, phoneNumberId, addressResult.addressId);
  
  if (!enableResult.success) {
    return { success: false, error: enableResult.error || "Failed to enable E911 on phone number" };
  }

  try {
    await db
      .update(telnyxPhoneNumbers)
      .set({
        e911Enabled: true,
        e911AddressId: addressResult.addressId,
        updatedAt: new Date(),
      })
      .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));
  } catch (dbError) {
    console.log(`[E911] Note: Could not update local DB record (may not exist)`);
  }

  console.log(`[E911] E911 fully configured for phone ${phoneDetails.phoneNumber}`);

  return {
    success: true,
    addressId: addressResult.addressId,
  };
}

export async function getEmergencyAddresses(companyId: string): Promise<{
  success: boolean;
  addresses?: Array<{
    id: string;
    streetAddress: string;
    extendedAddress?: string;
    locality: string;
    administrativeArea: string;
    postalCode: string;
    countryCode: string;
    status: string;
  }>;
  error?: string;
}> {
  try {
    const config = await getManagedAccountConfig(companyId);
    
    if (!config) {
      return { success: false, error: "Phone system not configured for this company" };
    }

    const response = await fetch(`${TELNYX_API_BASE}/addresses`, {
      method: "GET",
      headers: buildHeaders(config),
    });

    if (!response.ok) {
      return { success: false, error: `Failed to get addresses: ${response.status}` };
    }

    const result = await response.json();

    return {
      success: true,
      addresses: (result.data || []).map((addr: any) => ({
        id: addr.id,
        streetAddress: addr.street_address,
        extendedAddress: addr.extended_address,
        locality: addr.locality,
        administrativeArea: addr.administrative_area,
        postalCode: addr.postal_code,
        countryCode: addr.country_code,
        status: 'active',
      })),
    };
  } catch (error) {
    console.error("[E911] Get addresses error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get addresses",
    };
  }
}

export async function validateEmergencyAddress(
  companyId: string,
  addressData: E911AddressData
): Promise<{ success: boolean; valid: boolean; error?: string }> {
  return { success: true, valid: true };
}

export async function enableE911OnNumber(
  companyId: string,
  phoneNumberId: string,
  emergencyAddressId: string
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

// =====================================================
// WEBRTC CREDENTIALS & TOKEN MANAGEMENT
// =====================================================

export async function createWebRTCCredential(
  companyId: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; credentialId?: string; sipUsername?: string; sipPassword?: string; error?: string }> {
  console.log(`[WebRTC] Creating credential for user ${userId} in company ${companyId}...`);

  try {
    const config = await getManagedAccountConfig(companyId);

    const [settings] = await db
      .select({ 
        texmlAppId: telephonySettings.texmlAppId,
        outboundVoiceProfileId: telephonySettings.outboundVoiceProfileId,
      })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    let texmlAppId = settings?.texmlAppId;

    if (!texmlAppId) {
      if (!settings?.outboundVoiceProfileId) {
        const profileResult = await getOrCreateOutboundVoiceProfile(config, companyId);
        if (!profileResult.success || !profileResult.profileId) {
          return { success: false, error: "Failed to create voice profile" };
        }
        const appResult = await getOrCreateTexmlApplication(config, companyId, profileResult.profileId);
        if (!appResult.success || !appResult.appId) {
          return { success: false, error: "Failed to create TeXML application" };
        }
        texmlAppId = appResult.appId;
      } else {
        const appResult = await getOrCreateTexmlApplication(config, companyId, settings.outboundVoiceProfileId);
        if (!appResult.success || !appResult.appId) {
          return { success: false, error: "Failed to create TeXML application" };
        }
        texmlAppId = appResult.appId;
      }
    }

    const sipUsername = generateSipUsername(companyId);
    const sipPassword = generateSipPassword();

    const response = await fetch(`${TELNYX_API_BASE}/telephony_credentials`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        connection_id: texmlAppId,
        name: userName || `User ${userId.slice(0, 8)}`,
        sip_username: sipUsername,
        sip_password: sipPassword,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WebRTC] Failed to create credential: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to create WebRTC credential: ${response.status}` };
    }

    const data = await response.json();
    const credentialId = data.data?.id;
    const returnedSipUsername = data.data?.sip_username || sipUsername;

    console.log(`[WebRTC] Credential created: ${credentialId}, SIP: ${returnedSipUsername}`);

    await db.insert(telephonyCredentials).values({
      companyId,
      userId,
      telnyxCredentialId: credentialId,
      sipUsername: returnedSipUsername,
      sipPassword: sipPassword,
      isActive: true,
    }).onConflictDoUpdate({
      target: [telephonyCredentials.userId],
      set: {
        telnyxCredentialId: credentialId,
        sipUsername: returnedSipUsername,
        sipPassword: sipPassword,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return { success: true, credentialId, sipUsername: returnedSipUsername, sipPassword };
  } catch (error) {
    console.error("[WebRTC] Create credential error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create credential" };
  }
}

/**
 * Create SIP credentials for a user linked to their PBX extension.
 * This creates unique credentials per user with extension-based username.
 */
export async function createUserSipCredentialWithExtension(
  companyId: string,
  userId: string,
  extension: string,
  displayName: string
): Promise<{ success: boolean; credentialId?: string; sipUsername?: string; sipPassword?: string; error?: string }> {
  console.log(`[SIP User] Creating SIP credential for user ${userId} with extension ${extension}...`);

  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Managed account not configured for this company" };
    }

    // Check if user already has credentials
    const [existingCred] = await db
      .select()
      .from(telephonyCredentials)
      .where(eq(telephonyCredentials.ownerUserId, userId));

    if (existingCred?.telnyxCredentialId && existingCred.isActive) {
      console.log(`[SIP User] User ${userId} already has credentials: ${existingCred.sipUsername}`);
      return {
        success: true,
        credentialId: existingCred.telnyxCredentialId,
        sipUsername: existingCred.sipUsername,
        sipPassword: existingCred.sipPassword,
      };
    }

    // Get or create the credential connection for this company
    const [settings] = await db
      .select({ 
        credentialConnectionId: telephonySettings.credentialConnectionId,
        outboundVoiceProfileId: telephonySettings.outboundVoiceProfileId,
      })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    let connectionId = settings?.credentialConnectionId;

    // If no credential connection exists, create one
    if (!connectionId) {
      let ovpId = settings?.outboundVoiceProfileId;
      if (!ovpId) {
        const profileResult = await getOrCreateOutboundVoiceProfile(config, companyId);
        if (!profileResult.success || !profileResult.profileId) {
          return { success: false, error: "Failed to create voice profile" };
        }
        ovpId = profileResult.profileId;
      }
      const connResult = await getOrCreateCredentialConnection(config, companyId, ovpId);
      if (!connResult.success || !connResult.connectionId) {
        return { success: false, error: connResult.error || "Failed to create credential connection" };
      }
      connectionId = connResult.connectionId;
    }

    // Get company name for readable SIP username
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId));
    const companyName = company?.name || "company";

    // Generate unique SIP credentials with company name + extension (e.g., cobertis1001)
    const sipUsername = generateSipUsernameWithExtension(companyName, extension);
    const sipPassword = generateSipPassword();

    console.log(`[SIP User] Creating Telnyx credential: ${sipUsername} for connection ${connectionId}`);

    // Create the telephony credential in Telnyx
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
      console.error(`[SIP User] Failed to create credential: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to create SIP credential: ${response.status}` };
    }

    const data = await response.json();
    const credentialId = data.data?.id;
    const returnedSipUsername = data.data?.sip_username || sipUsername;

    console.log(`[SIP User] Credential created: ${credentialId}, SIP: ${returnedSipUsername}@sip.telnyx.com`);

    // Save to database with ownerUserId - check for existing first
    const [existingUserCred] = await db
      .select({ id: telephonyCredentials.id })
      .from(telephonyCredentials)
      .where(eq(telephonyCredentials.ownerUserId, userId));

    if (existingUserCred) {
      await db.update(telephonyCredentials)
        .set({
          telnyxCredentialId: credentialId,
          sipUsername: returnedSipUsername,
          sipPassword: sipPassword,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(telephonyCredentials.ownerUserId, userId));
    } else {
      await db.insert(telephonyCredentials).values({
        companyId,
        userId,
        ownerUserId: userId,
        telnyxCredentialId: credentialId,
        sipUsername: returnedSipUsername,
        sipPassword: sipPassword,
        isActive: true,
      });
    }

    return { success: true, credentialId, sipUsername: returnedSipUsername, sipPassword };
  } catch (error) {
    console.error("[SIP User] Create credential error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create SIP credential" };
  }
}

/**
 * Get SIP credentials for a user. Returns existing credentials or null.
 */
export async function getUserSipCredentials(
  userId: string
): Promise<{ sipUsername: string; sipPassword: string; telnyxCredentialId: string } | null> {
  const [cred] = await db
    .select({
      sipUsername: telephonyCredentials.sipUsername,
      sipPassword: telephonyCredentials.sipPassword,
      telnyxCredentialId: telephonyCredentials.telnyxCredentialId,
    })
    .from(telephonyCredentials)
    .where(eq(telephonyCredentials.ownerUserId, userId));

  if (!cred?.sipPassword || !cred?.telnyxCredentialId) {
    return null;
  }

  return {
    sipUsername: cred.sipUsername,
    sipPassword: cred.sipPassword,
    telnyxCredentialId: cred.telnyxCredentialId,
  };
}

export async function getOrCreateWebRTCCredential(
  companyId: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; credentialId?: string; sipUsername?: string; sipPassword?: string; error?: string }> {
  // First, try to find by userId
  const [existingByUser] = await db
    .select()
    .from(telephonyCredentials)
    .where(eq(telephonyCredentials.userId, userId));

  if (existingByUser?.telnyxCredentialId && existingByUser.isActive && existingByUser.sipPassword) {
    console.log(`[WebRTC] Using existing credential for user ${userId}: ${existingByUser.telnyxCredentialId}`);
    return { 
      success: true, 
      credentialId: existingByUser.telnyxCredentialId, 
      sipUsername: existingByUser.sipUsername,
      sipPassword: existingByUser.sipPassword,
    };
  }

  // If no credential for this user, check if there's a company-wide credential we can use
  const [existingByCompany] = await db
    .select()
    .from(telephonyCredentials)
    .where(eq(telephonyCredentials.companyId, companyId));

  if (existingByCompany?.telnyxCredentialId && existingByCompany.isActive && existingByCompany.sipPassword) {
    console.log(`[WebRTC] Using company credential for ${companyId}: ${existingByCompany.telnyxCredentialId}`);
    
    // Optionally update with userId if missing
    if (!existingByCompany.userId) {
      await db.update(telephonyCredentials)
        .set({ userId, updatedAt: new Date() })
        .where(eq(telephonyCredentials.id, existingByCompany.id));
    }
    
    return { 
      success: true, 
      credentialId: existingByCompany.telnyxCredentialId, 
      sipUsername: existingByCompany.sipUsername,
      sipPassword: existingByCompany.sipPassword,
    };
  }

  return createWebRTCCredential(companyId, userId, userName);
}

export async function generateWebRTCToken(
  companyId: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; token?: string; sipUsername?: string; sipPassword?: string; callerIdNumber?: string; error?: string }> {
  console.log(`[WebRTC] Generating token for user ${userId}...`);

  try {
    const config = await getManagedAccountConfig(companyId);

    // First, check if user has their own SIP credentials (created via PBX extension)
    const userCreds = await getUserSipCredentials(userId);
    let credResult: { success: boolean; credentialId?: string; sipUsername?: string; sipPassword?: string; error?: string };
    
    if (userCreds) {
      console.log(`[WebRTC] Using user's own SIP credentials: ${userCreds.sipUsername}`);
      credResult = {
        success: true,
        credentialId: userCreds.telnyxCredentialId,
        sipUsername: userCreds.sipUsername,
        sipPassword: userCreds.sipPassword,
      };
    } else {
      // Fallback to company-wide credential
      console.log(`[WebRTC] No user-specific credentials, using company-wide credential...`);
      credResult = await getOrCreateWebRTCCredential(companyId, userId, userName);
    }
    
    if (!credResult.success || !credResult.credentialId) {
      return { success: false, error: credResult.error || "Failed to get credential" };
    }

    // First try to find phone number assigned to this specific user
    let callerIdNumber: string | undefined;
    const [userPhoneNumber] = await db
      .select({ phoneNumber: telnyxPhoneNumbers.phoneNumber })
      .from(telnyxPhoneNumbers)
      .where(and(
        eq(telnyxPhoneNumbers.companyId, companyId),
        eq(telnyxPhoneNumbers.ownerUserId, userId)
      ))
      .limit(1);
    
    callerIdNumber = userPhoneNumber?.phoneNumber;
    console.log(`[WebRTC] User-assigned phone number: ${callerIdNumber || 'none'}`);
    
    // If no number assigned to user, fall back to any company number
    if (!callerIdNumber) {
      const [localPhoneNumber] = await db
        .select({ phoneNumber: telnyxPhoneNumbers.phoneNumber })
        .from(telnyxPhoneNumbers)
        .where(eq(telnyxPhoneNumbers.companyId, companyId))
        .limit(1);
      
      callerIdNumber = localPhoneNumber?.phoneNumber;
      console.log(`[WebRTC] Fallback company phone number: ${callerIdNumber || 'none'}`);
    }
    
    // If still not found, fetch from Telnyx API
    if (!callerIdNumber) {
      console.log(`[WebRTC] No local phone number, fetching from Telnyx API...`);
      try {
        const response = await fetch(`${TELNYX_API_BASE}/phone_numbers?page[size]=1`, {
          method: "GET",
          headers: buildHeaders(config),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            callerIdNumber = data.data[0].phone_number;
            console.log(`[WebRTC] Got phone number from Telnyx API: ${callerIdNumber}`);
          }
        }
      } catch (apiError) {
        console.error(`[WebRTC] Failed to fetch phone number from API:`, apiError);
      }
    }
    
    console.log(`[WebRTC] Final callerIdNumber: ${callerIdNumber}`);

    // Note: Telnyx WebRTC SDK uses SIP credentials directly (username/password)
    // The token endpoint is deprecated and returns 400 - skip it entirely
    console.log(`[WebRTC] Credentials ready for ${credResult.sipUsername}, callerIdNumber: ${callerIdNumber}`);

    await db.update(telephonyCredentials)
      .set({ lastUsedAt: new Date() })
      .where(eq(telephonyCredentials.userId, userId));

    return { 
      success: true, 
      sipUsername: credResult.sipUsername,
      sipPassword: credResult.sipPassword,
      callerIdNumber,
    };
  } catch (error) {
    console.error("[WebRTC] Generate token error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate token" };
  }
}

/**
 * Update an existing credential connection to enable WebRTC-optimized settings
 * including OPUS codec, SRTP encryption, and other optimizations
 */
export async function updateCredentialConnectionForWebRTC(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Managed account not configured" };
    }

    const [settings] = await db
      .select({ credentialConnectionId: telephonySettings.credentialConnectionId })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    if (!settings?.credentialConnectionId) {
      return { success: false, error: "No credential connection found" };
    }

    const connectionId = settings.credentialConnectionId;
    console.log(`[E911] Updating credential connection ${connectionId} for WebRTC...`);

    const response = await fetch(`${TELNYX_API_BASE}/credential_connections/${connectionId}`, {
      method: "PATCH",
      headers: buildHeaders(config),
      body: JSON.stringify({
        // CRITICAL: Allow TeXML to dial SIP URI for inbound calls
        sip_uri_calling_preference: "unrestricted",
        // WebRTC requires SRTP encryption
        encrypted_media: "SRTP",
        // DTMF type for WebRTC compatibility
        dtmf_type: "RFC 2833",
        // Enable comfort noise when call is on hold
        default_on_hold_comfort_noise_enabled: true,
        // RTCP settings for call quality monitoring
        rtcp_settings: {
          port: "rtcp-mux",
          capture_enabled: true,
          report_frequency_secs: 10,
        },
        inbound: {
          // Codec priority: G.711 first for PSTN compatibility, OPUS last for SIP-to-SIP
          codecs: ["G711U", "G711A", "G722", "OPUS"],
          generate_ringback_tone: true,
          // Enable SHAKEN/STIR for caller ID verification
          shaken_stir_enabled: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Failed to update credential connection: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to update connection: ${response.status} - ${errorText}` };
    }

    console.log(`[E911] Credential connection ${connectionId} updated for WebRTC successfully`);
    return { success: true };
  } catch (error) {
    console.error("[E911] Update credential connection error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update connection" };
  }
}

// =====================================================
// E911 EMERGENCY ADDRESS MANAGEMENT
// =====================================================

import { telnyxE911Addresses } from "@shared/schema";

export interface CreateE911AddressInput {
  streetAddress: string;
  extendedAddress?: string;
  locality: string;
  administrativeArea: string;
  postalCode: string;
  countryCode?: string;
  callerName: string;
}

export interface E911AddressResult {
  success: boolean;
  addressId?: string;
  telnyxAddressId?: string;
  isVerified?: boolean;
  error?: string;
}

/**
 * Create an E911 emergency address in Telnyx
 */
export async function createE911Address(
  companyId: string,
  input: CreateE911AddressInput
): Promise<E911AddressResult> {
  console.log(`[E911 Address] Creating emergency address for company ${companyId}...`);
  
  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Company has no managed account configured" };
    }
    
    const response = await fetch(`${TELNYX_API_BASE}/addresses`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        first_name: input.callerName.split(' ')[0] || input.callerName,
        last_name: input.callerName.split(' ').slice(1).join(' ') || ".",
        business_name: input.callerName,
        street_address: input.streetAddress,
        extended_address: input.extendedAddress || "",
        locality: input.locality,
        administrative_area: input.administrativeArea,
        postal_code: input.postalCode,
        country_code: input.countryCode || "US",
        address_book: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.errors?.[0]?.detail || `Failed to create address: ${response.status}`;
      console.error(`[E911 Address] Create failed: ${response.status} - ${JSON.stringify(errorData)}`);
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const telnyxAddressId = data.data?.id;
    const isVerified = data.data?.address_book || false;

    console.log(`[E911 Address] Created Telnyx address: ${telnyxAddressId}`);

    // Save to our database
    const [saved] = await db.insert(telnyxE911Addresses).values({
      companyId,
      telnyxAddressId,
      streetAddress: input.streetAddress,
      extendedAddress: input.extendedAddress || null,
      locality: input.locality,
      administrativeArea: input.administrativeArea,
      postalCode: input.postalCode,
      countryCode: input.countryCode || "US",
      callerName: input.callerName,
      isVerified,
    }).returning();

    console.log(`[E911 Address] Saved to database: ${saved.id}`);

    return { 
      success: true, 
      addressId: saved.id, 
      telnyxAddressId,
      isVerified,
    };
  } catch (error) {
    console.error("[E911 Address] Create error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create address" };
  }
}

/**
 * List all E911 addresses for a company
 */
export async function listE911Addresses(companyId: string) {
  const addresses = await db
    .select()
    .from(telnyxE911Addresses)
    .where(eq(telnyxE911Addresses.companyId, companyId));
  
  return addresses;
}

/**
 * Get a single E911 address
 */
export async function getE911Address(addressId: string) {
  const [address] = await db
    .select()
    .from(telnyxE911Addresses)
    .where(eq(telnyxE911Addresses.id, addressId));
  
  return address;
}

/**
 * Associate an E911 address with a phone number
 */
export async function assignE911AddressToNumber(
  companyId: string,
  phoneNumberId: string,
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[E911] Assigning address ${addressId} to phone ${phoneNumberId}...`);
  
  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Company has no managed account configured" };
    }
    
    // Get the E911 address from our database
    const [e911Address] = await db
      .select()
      .from(telnyxE911Addresses)
      .where(and(
        eq(telnyxE911Addresses.id, addressId),
        eq(telnyxE911Addresses.companyId, companyId)
      ));
    
    if (!e911Address) {
      return { success: false, error: "E911 address not found" };
    }

    // Get the phone number from our database to find the Telnyx ID
    const [phoneRecord] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(and(
        eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId),
        eq(telnyxPhoneNumbers.companyId, companyId)
      ));
    
    if (!phoneRecord) {
      return { success: false, error: "Phone number not found" };
    }

    // Step 1: Enable E911 on the phone number
    const enableResponse = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "PATCH",
      headers: buildHeaders(config),
      body: JSON.stringify({
        emergency_enabled: true,
        emergency_address_id: e911Address.telnyxAddressId,
      }),
    });

    if (!enableResponse.ok) {
      const errorData = await enableResponse.json().catch(() => ({}));
      const errorMsg = errorData.errors?.[0]?.detail || `Failed to enable E911: ${enableResponse.status}`;
      console.error(`[E911] Enable failed: ${enableResponse.status} - ${JSON.stringify(errorData)}`);
      return { success: false, error: errorMsg };
    }

    console.log(`[E911] E911 enabled on phone number ${phoneNumberId}`);

    // Update our database
    await db.update(telnyxPhoneNumbers)
      .set({
        e911Enabled: true,
        e911AddressId: e911Address.telnyxAddressId,
        updatedAt: new Date(),
      })
      .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));

    console.log(`[E911] Database updated for phone ${phoneNumberId}`);
    
    return { success: true };
  } catch (error) {
    console.error("[E911] Assign address error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to assign address" };
  }
}

/**
 * Remove E911 from a phone number
 */
export async function removeE911FromNumber(
  companyId: string,
  phoneNumberId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[E911] Removing E911 from phone ${phoneNumberId}...`);
  
  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Company has no managed account configured" };
    }

    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "PATCH",
      headers: buildHeaders(config),
      body: JSON.stringify({
        emergency_enabled: false,
        emergency_address_id: null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.errors?.[0]?.detail || `Failed to disable E911: ${response.status}`;
      console.error(`[E911] Disable failed: ${response.status} - ${JSON.stringify(errorData)}`);
      return { success: false, error: errorMsg };
    }

    // Update our database
    await db.update(telnyxPhoneNumbers)
      .set({
        e911Enabled: false,
        e911AddressId: null,
        updatedAt: new Date(),
      })
      .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));

    console.log(`[E911] E911 removed from phone ${phoneNumberId}`);
    
    return { success: true };
  } catch (error) {
    console.error("[E911] Remove E911 error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove E911" };
  }
}

/**
 * Delete an E911 address
 */
export async function deleteE911Address(
  companyId: string,
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[E911] Deleting address ${addressId}...`);
  
  try {
    const config = await getManagedAccountConfig(companyId);
    if (!config) {
      return { success: false, error: "Company has no managed account configured" };
    }
    
    // Get the address
    const [e911Address] = await db
      .select()
      .from(telnyxE911Addresses)
      .where(and(
        eq(telnyxE911Addresses.id, addressId),
        eq(telnyxE911Addresses.companyId, companyId)
      ));
    
    if (!e911Address) {
      return { success: false, error: "E911 address not found" };
    }

    // Check if any phone numbers are using this address
    const [phoneUsingAddress] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(and(
        eq(telnyxPhoneNumbers.companyId, companyId),
        eq(telnyxPhoneNumbers.e911AddressId, e911Address.telnyxAddressId)
      ));
    
    if (phoneUsingAddress) {
      return { success: false, error: "Cannot delete address: it is assigned to a phone number" };
    }

    // Delete from Telnyx
    const response = await fetch(`${TELNYX_API_BASE}/addresses/${e911Address.telnyxAddressId}`, {
      method: "DELETE",
      headers: buildHeaders(config),
    });

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.errors?.[0]?.detail || `Failed to delete address: ${response.status}`;
      console.error(`[E911] Delete failed: ${response.status} - ${JSON.stringify(errorData)}`);
      return { success: false, error: errorMsg };
    }

    // Delete from our database
    await db.delete(telnyxE911Addresses)
      .where(eq(telnyxE911Addresses.id, addressId));

    console.log(`[E911] Address ${addressId} deleted`);
    
    return { success: true };
  } catch (error) {
    console.error("[E911] Delete address error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete address" };
  }
}

/**
 * Get phone numbers with their E911 status
 */
export async function getPhoneNumbersWithE911Status(companyId: string) {
  const numbers = await db
    .select({
      id: telnyxPhoneNumbers.id,
      telnyxPhoneNumberId: telnyxPhoneNumbers.telnyxPhoneNumberId,
      phoneNumber: telnyxPhoneNumbers.phoneNumber,
      friendlyName: telnyxPhoneNumbers.friendlyName,
      e911Enabled: telnyxPhoneNumbers.e911Enabled,
      e911AddressId: telnyxPhoneNumbers.e911AddressId,
    })
    .from(telnyxPhoneNumbers)
    .where(eq(telnyxPhoneNumbers.companyId, companyId));
  
  return numbers;
}
