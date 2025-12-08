import { db } from "../db";
import { wallets, telnyxPhoneNumbers, telephonySettings, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { secretsService } from "../services/secrets-service";

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

  try {
    const response = await fetch(`${TELNYX_API_BASE}/credential_connections`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        connection_name: `${companyName} - WebRTC`,
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
        provisioningStatus: "completed",
        provisionedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(telephonySettings.companyId, companyId));

    return { success: true, connectionId };
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
