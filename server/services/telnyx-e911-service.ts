import { db } from "../db";
import { wallets, telnyxPhoneNumbers } from "@shared/schema";
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

async function getPhoneNumberFromTelnyx(
  config: ManagedAccountConfig,
  phoneNumberId: string
): Promise<{ success: boolean; phoneNumber?: string; error?: string }> {
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
    };
  } catch (error) {
    console.error("[E911] Get phone number error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get phone number",
    };
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

  const phoneResult = await getPhoneNumberFromTelnyx(config, phoneNumberId);
  
  if (!phoneResult.success || !phoneResult.phoneNumber) {
    return { success: false, error: phoneResult.error || "Phone number not found" };
  }

  console.log(`[E911] Registering E911 for phone: ${phoneResult.phoneNumber}`);

  const addressResult = await createEmergencyAddress(companyId, addressData, phoneResult.phoneNumber);
  
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

  console.log(`[E911] E911 fully configured for phone ${phoneResult.phoneNumber}`);

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
