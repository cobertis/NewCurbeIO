import { db } from "../db";
import { wallets, telnyxPhoneNumbers, telephonySettings, companies, telephonyCredentials } from "@shared/schema";
import { eq } from "drizzle-orm";
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

interface ManagedAccountConfig {
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

async function getManagedAccountConfig(companyId: string): Promise<ManagedAccountConfig | null> {
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

function buildHeaders(config: ManagedAccountConfig): Record<string, string> {
  return {
    "Authorization": `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    "x-managed-account-id": config.managedAccountId,
  };
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

  console.log(`[E911] Creating outbound voice profile for ${companyName}...`);

  try {
    const response = await fetch(`${TELNYX_API_BASE}/outbound_voice_profiles`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        name: `${companyName} - Outbound Profile`,
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
    console.log(`[E911] Using existing credential connection: ${settings.credentialConnectionId}`);
    return { success: true, connectionId: settings.credentialConnectionId };
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
        outbound: {
          outbound_voice_profile_id: outboundVoiceProfileId,
          channel_limit: 10,
        },
        inbound: {
          channel_limit: 10,
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
  console.log(`[E911] Assigning connection ${connectionId} to phone number ${phoneNumberId}...`);

  try {
    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}`, {
      method: "PATCH",
      headers: buildHeaders(config),
      body: JSON.stringify({ connection_id: connectionId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Failed to assign connection: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to assign connection: ${response.status}` };
    }

    console.log(`[E911] Connection assigned successfully`);
    return { success: true };
  } catch (error) {
    console.error("[E911] Assign connection error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to assign connection" };
  }
}

async function ensurePhoneNumberHasConnection(
  config: ManagedAccountConfig,
  companyId: string,
  phoneNumberId: string
): Promise<{ success: boolean; error?: string }> {
  const phoneDetails = await getPhoneNumberDetails(config, phoneNumberId);
  
  if (!phoneDetails.success) {
    return { success: false, error: phoneDetails.error };
  }

  if (phoneDetails.connectionId) {
    console.log(`[E911] Phone number already has connection: ${phoneDetails.connectionId}`);
    return { success: true };
  }

  console.log(`[E911] Phone number has no connection, creating infrastructure...`);

  const ovpResult = await getOrCreateOutboundVoiceProfile(config, companyId);
  if (!ovpResult.success || !ovpResult.profileId) {
    return { success: false, error: ovpResult.error };
  }

  const connResult = await getOrCreateCredentialConnection(config, companyId, ovpResult.profileId);
  if (!connResult.success || !connResult.connectionId) {
    return { success: false, error: connResult.error };
  }

  const assignResult = await assignConnectionToPhoneNumber(config, phoneNumberId, connResult.connectionId);
  if (!assignResult.success) {
    return { success: false, error: assignResult.error };
  }

  return { success: true };
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

  const connectionResult = await ensurePhoneNumberHasConnection(config, companyId, phoneNumberId);
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

export async function getOrCreateWebRTCCredential(
  companyId: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; credentialId?: string; sipUsername?: string; sipPassword?: string; error?: string }> {
  const [existing] = await db
    .select()
    .from(telephonyCredentials)
    .where(eq(telephonyCredentials.userId, userId));

  if (existing?.telnyxCredentialId && existing.isActive && existing.sipPassword) {
    console.log(`[WebRTC] Using existing credential for user ${userId}: ${existing.telnyxCredentialId}`);
    return { 
      success: true, 
      credentialId: existing.telnyxCredentialId, 
      sipUsername: existing.sipUsername,
      sipPassword: existing.sipPassword,
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

    const credResult = await getOrCreateWebRTCCredential(companyId, userId, userName);
    if (!credResult.success || !credResult.credentialId) {
      return { success: false, error: credResult.error || "Failed to get credential" };
    }

    const [phoneNumber] = await db
      .select({ phoneNumber: telnyxPhoneNumbers.phoneNumber })
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId))
      .limit(1);

    const response = await fetch(`${TELNYX_API_BASE}/telephony_credentials/${credResult.credentialId}/token`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WebRTC] Failed to generate token: ${response.status} - ${errorText}`);
      return { 
        success: true, 
        sipUsername: credResult.sipUsername,
        sipPassword: credResult.sipPassword,
        callerIdNumber: phoneNumber?.phoneNumber,
      };
    }

    const data = await response.json();
    const token = data.data;

    console.log(`[WebRTC] Token generated successfully for ${credResult.sipUsername}`);

    await db.update(telephonyCredentials)
      .set({ lastUsedAt: new Date() })
      .where(eq(telephonyCredentials.userId, userId));

    return { 
      success: true, 
      token, 
      sipUsername: credResult.sipUsername,
      sipPassword: credResult.sipPassword,
      callerIdNumber: phoneNumber?.phoneNumber,
    };
  } catch (error) {
    console.error("[WebRTC] Generate token error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate token" };
  }
}
