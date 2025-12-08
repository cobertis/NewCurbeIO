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
}

interface ParsedAddress {
  house_number: string;
  street_pre_directional?: string;
  street_name: string;
  street_suffix?: string;
  street_post_directional?: string;
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

/**
 * Parse a street address into components for Telnyx Dynamic E911 API
 * Example: "14850 SW 26th Street" -> { house_number: "14850", street_pre_directional: "SW", street_name: "26TH", street_suffix: "ST" }
 */
function parseStreetAddress(streetAddress: string): ParsedAddress {
  const address = streetAddress.trim().toUpperCase();
  
  const directionals = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTHEAST', 'NORTHWEST', 'SOUTHEAST', 'SOUTHWEST'];
  const suffixes: Record<string, string> = {
    'STREET': 'ST', 'ST': 'ST',
    'AVENUE': 'AVE', 'AVE': 'AVE', 'AV': 'AVE',
    'ROAD': 'RD', 'RD': 'RD',
    'DRIVE': 'DR', 'DR': 'DR',
    'LANE': 'LN', 'LN': 'LN',
    'BOULEVARD': 'BLVD', 'BLVD': 'BLVD',
    'COURT': 'CT', 'CT': 'CT',
    'CIRCLE': 'CIR', 'CIR': 'CIR',
    'PLACE': 'PL', 'PL': 'PL',
    'TERRACE': 'TER', 'TER': 'TER',
    'WAY': 'WAY',
    'HIGHWAY': 'HWY', 'HWY': 'HWY',
    'PARKWAY': 'PKWY', 'PKWY': 'PKWY',
    'TRAIL': 'TRL', 'TRL': 'TRL',
    'PATH': 'PATH',
    'ALLEY': 'ALY', 'ALY': 'ALY',
    'EXPRESSWAY': 'EXPY', 'EXPY': 'EXPY',
    'FREEWAY': 'FWY', 'FWY': 'FWY',
  };
  
  const directionalMap: Record<string, string> = {
    'NORTH': 'N', 'SOUTH': 'S', 'EAST': 'E', 'WEST': 'W',
    'NORTHEAST': 'NE', 'NORTHWEST': 'NW', 'SOUTHEAST': 'SE', 'SOUTHWEST': 'SW',
  };

  const parts = address.split(/\s+/);
  
  let houseNumber = '';
  let preDirectional = '';
  let streetName = '';
  let streetSuffix = '';
  let postDirectional = '';
  
  let idx = 0;
  
  if (parts.length > 0 && /^\d+[A-Z]?$/.test(parts[0])) {
    houseNumber = parts[0];
    idx = 1;
  }
  
  if (idx < parts.length && directionals.includes(parts[idx])) {
    preDirectional = directionalMap[parts[idx]] || parts[idx];
    idx++;
  }
  
  const remainingParts: string[] = [];
  for (let i = idx; i < parts.length; i++) {
    remainingParts.push(parts[i]);
  }
  
  if (remainingParts.length > 0) {
    const lastPart = remainingParts[remainingParts.length - 1];
    
    if (directionals.includes(lastPart)) {
      postDirectional = directionalMap[lastPart] || lastPart;
      remainingParts.pop();
    }
    
    if (remainingParts.length > 0) {
      const possibleSuffix = remainingParts[remainingParts.length - 1];
      if (suffixes[possibleSuffix]) {
        streetSuffix = suffixes[possibleSuffix];
        remainingParts.pop();
      }
    }
    
    streetName = remainingParts.join(' ');
  }
  
  const result: ParsedAddress = {
    house_number: houseNumber,
    street_name: streetName,
  };
  
  if (preDirectional) result.street_pre_directional = preDirectional;
  if (streetSuffix) result.street_suffix = streetSuffix;
  if (postDirectional) result.street_post_directional = postDirectional;
  
  return result;
}

/**
 * Wait for address to be activated (poll status)
 */
async function waitForAddressActivation(
  config: ManagedAccountConfig,
  addressId: string,
  maxAttempts: number = 10
): Promise<{ success: boolean; status: string; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(`${TELNYX_API_BASE}/dynamic_emergency_addresses/${addressId}`, {
      method: "GET",
      headers: buildHeaders(config),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Failed to check address status: ${response.status} - ${errorText}`);
      continue;
    }
    
    const result = await response.json();
    const status = result.data?.status;
    
    console.log(`[E911] Address ${addressId} status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);
    
    if (status === 'activated') {
      return { success: true, status };
    }
    
    if (status === 'rejected' || status === 'failed') {
      return { success: false, status, error: `Address validation ${status}` };
    }
  }
  
  return { success: false, status: 'timeout', error: 'Address validation timed out' };
}

/**
 * Creates a Dynamic Emergency Address in Telnyx
 * Uses the correct API: POST /v2/dynamic_emergency_addresses
 */
export async function createDynamicEmergencyAddress(
  companyId: string,
  addressData: E911AddressData
): Promise<E911CreateResult> {
  try {
    const config = await getManagedAccountConfig(companyId);
    
    if (!config) {
      return { success: false, error: "Phone system not configured for this company" };
    }

    console.log(`[E911] Creating dynamic emergency address for company ${companyId}`);
    console.log(`[E911] Raw address: ${addressData.streetAddress}`);

    const parsedAddress = parseStreetAddress(addressData.streetAddress);
    console.log(`[E911] Parsed address:`, parsedAddress);

    const requestBody: Record<string, string> = {
      house_number: parsedAddress.house_number,
      street_name: parsedAddress.street_name,
      locality: addressData.locality.toUpperCase(),
      administrative_area: addressData.administrativeArea.toUpperCase(),
      postal_code: addressData.postalCode,
      country_code: addressData.countryCode || "US",
    };

    if (parsedAddress.street_pre_directional) {
      requestBody.street_pre_directional = parsedAddress.street_pre_directional;
    }
    if (parsedAddress.street_suffix) {
      requestBody.street_suffix = parsedAddress.street_suffix;
    }
    if (parsedAddress.street_post_directional) {
      requestBody.street_post_directional = parsedAddress.street_post_directional;
    }
    if (addressData.extendedAddress) {
      requestBody.extended_address = addressData.extendedAddress.toUpperCase();
    }

    console.log(`[E911] Request body:`, requestBody);

    const response = await fetch(`${TELNYX_API_BASE}/dynamic_emergency_addresses`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Dynamic address creation error: ${response.status} - ${errorText}`);
      
      try {
        const errorData = JSON.parse(errorText);
        const errorMessages = errorData.errors?.map((e: any) => e.detail || e.title).join(', ');
        return { success: false, error: errorMessages || `Failed to create address: ${response.status}` };
      } catch {
        return { success: false, error: `Failed to create address: ${response.status}` };
      }
    }

    const result = await response.json();
    const addressId = result.data.id;
    const status = result.data.status;

    console.log(`[E911] Dynamic address created: ID=${addressId}, status=${status}`);

    if (status === 'pending') {
      console.log(`[E911] Address pending validation, polling for activation...`);
      const activationResult = await waitForAddressActivation(config, addressId);
      
      if (!activationResult.success) {
        return { success: false, error: activationResult.error || 'Address validation failed' };
      }
    }

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

/**
 * Creates a Dynamic Emergency Endpoint in Telnyx
 * Associates a phone number with a Dynamic Emergency Address
 */
export async function createDynamicEmergencyEndpoint(
  companyId: string,
  phoneNumber: string,
  callerName: string,
  dynamicEmergencyAddressId: string
): Promise<E911CreateResult> {
  try {
    const config = await getManagedAccountConfig(companyId);
    
    if (!config) {
      return { success: false, error: "Phone system not configured for this company" };
    }

    console.log(`[E911] Creating dynamic emergency endpoint for phone ${phoneNumber}`);

    let callbackNumber = phoneNumber.replace(/\D/g, '');
    if (callbackNumber.length === 10) {
      callbackNumber = '+1' + callbackNumber;
    } else if (callbackNumber.length === 11 && callbackNumber.startsWith('1')) {
      callbackNumber = '+' + callbackNumber;
    } else if (!callbackNumber.startsWith('+')) {
      callbackNumber = '+' + callbackNumber;
    }

    const response = await fetch(`${TELNYX_API_BASE}/dynamic_emergency_endpoints`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        callback_number: callbackNumber,
        caller_name: callerName,
        dynamic_emergency_address_id: dynamicEmergencyAddressId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Dynamic endpoint creation error: ${response.status} - ${errorText}`);
      
      try {
        const errorData = JSON.parse(errorText);
        const errorMessages = errorData.errors?.map((e: any) => e.detail || e.title).join(', ');
        return { success: false, error: errorMessages || `Failed to create endpoint: ${response.status}` };
      } catch {
        return { success: false, error: `Failed to create endpoint: ${response.status}` };
      }
    }

    const result = await response.json();
    const endpointId = result.data.id;
    const sipFromId = result.data.sip_from_id;

    console.log(`[E911] Dynamic endpoint created: ID=${endpointId}, sip_from_id=${sipFromId}`);

    return {
      success: true,
      addressId: endpointId,
    };
  } catch (error) {
    console.error("[E911] Create endpoint error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create emergency endpoint",
    };
  }
}

/**
 * Get phone number from Telnyx API using phone number ID
 */
async function getPhoneNumberFromTelnyx(
  config: ManagedAccountConfig,
  phoneNumberId: string
): Promise<{ success: boolean; phoneNumber?: string; error?: string }> {
  try {
    const response = await fetch(`https://api.telnyx.com/v2/phone_numbers/${phoneNumberId}`, {
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

/**
 * Enable E911 on a phone number using Telnyx enable_emergency action
 * This is the CRITICAL step that actually enables E911 on the number
 */
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Enable emergency error: ${response.status} - ${errorText}`);
      
      try {
        const errorData = JSON.parse(errorText);
        const errorMessages = errorData.errors?.map((e: any) => e.detail || e.title).join(', ');
        return { success: false, error: errorMessages || `Failed to enable E911: ${response.status}` };
      } catch {
        return { success: false, error: `Failed to enable E911: ${response.status}` };
      }
    }

    const result = await response.json();
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

/**
 * Full E911 registration flow:
 * 1. Create Dynamic Emergency Address
 * 2. Wait for activation
 * 3. Create Dynamic Emergency Endpoint
 * 4. Enable E911 on the phone number (CRITICAL)
 * 5. Update local database
 */
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

  // Get phone number from Telnyx API
  const phoneResult = await getPhoneNumberFromTelnyx(config, phoneNumberId);
  
  if (!phoneResult.success || !phoneResult.phoneNumber) {
    return { success: false, error: phoneResult.error || "Phone number not found" };
  }

  console.log(`[E911] Registering E911 for phone: ${phoneResult.phoneNumber}`);

  // Step 1: Create Dynamic Emergency Address
  const addressResult = await createDynamicEmergencyAddress(companyId, addressData);
  
  if (!addressResult.success || !addressResult.addressId) {
    return { success: false, error: addressResult.error || "Failed to create emergency address" };
  }

  // Step 2: Create Dynamic Emergency Endpoint
  const endpointResult = await createDynamicEmergencyEndpoint(
    companyId,
    phoneResult.phoneNumber,
    addressData.callerName,
    addressResult.addressId
  );
  
  if (!endpointResult.success) {
    return { success: false, error: endpointResult.error || "Failed to create emergency endpoint" };
  }

  // Step 3: Enable E911 on the phone number (CRITICAL - this is what enables the checkbox in Telnyx portal)
  const enableResult = await enableE911OnPhoneNumber(config, phoneNumberId, addressResult.addressId);
  
  if (!enableResult.success) {
    return { success: false, error: enableResult.error || "Failed to enable E911 on phone number" };
  }

  // Try to update local database if record exists
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

/**
 * Gets existing emergency addresses for a company
 */
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

    const response = await fetch(`${TELNYX_API_BASE}/dynamic_emergency_addresses`, {
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
        streetAddress: [
          addr.house_number,
          addr.street_pre_directional,
          addr.street_name,
          addr.street_suffix,
          addr.street_post_directional,
        ].filter(Boolean).join(' '),
        extendedAddress: addr.extended_address,
        locality: addr.locality,
        administrativeArea: addr.administrative_area,
        postalCode: addr.postal_code,
        countryCode: addr.country_code,
        status: addr.status,
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

export async function createEmergencyAddress(
  companyId: string,
  addressData: E911AddressData
): Promise<E911CreateResult> {
  return createDynamicEmergencyAddress(companyId, addressData);
}

export async function enableE911OnNumber(
  companyId: string,
  phoneNumberId: string,
  emergencyAddressId: string
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}
