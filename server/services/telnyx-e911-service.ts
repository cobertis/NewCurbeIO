import { db } from "../db";
import { wallets, telnyxPhoneNumbers, telnyxE911Addresses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { secretsService } from "../services/secrets-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

interface E911AddressData {
  streetAddress: string;
  extendedAddress?: string; // Apt/Suite
  locality: string; // City
  administrativeArea: string; // State (2-letter code)
  postalCode: string;
  countryCode: string; // US
  callerName: string; // What 911 operator sees
}

interface E911ValidationResult {
  success: boolean;
  valid: boolean;
  suggestions?: Array<{
    id: string;
    streetAddress: string;
    extendedAddress?: string;
    locality: string;
    administrativeArea: string;
    postalCode: string;
    countryCode: string;
  }>;
  normalizedAddress?: {
    streetAddress: string;
    extendedAddress?: string;
    locality: string;
    administrativeArea: string;
    postalCode: string;
    countryCode: string;
  };
  error?: string;
}

interface E911CreateResult {
  success: boolean;
  addressId?: string;
  error?: string;
}

interface E911EnableResult {
  success: boolean;
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
 * Validates an address against Telnyx E911 database
 * Returns normalized address or suggestions if input doesn't match exactly
 */
export async function validateEmergencyAddress(
  companyId: string,
  addressData: E911AddressData
): Promise<E911ValidationResult> {
  try {
    const config = await getManagedAccountConfig(companyId);
    
    if (!config) {
      return { success: false, valid: false, error: "Phone system not configured for this company" };
    }

    console.log(`[E911] Validating address for company ${companyId}:`, addressData.streetAddress);

    const response = await fetch(`${TELNYX_API_BASE}/addresses`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        street_address: addressData.streetAddress,
        extended_address: addressData.extendedAddress || "",
        locality: addressData.locality,
        administrative_area: addressData.administrativeArea,
        postal_code: addressData.postalCode,
        country_code: addressData.countryCode || "US",
        address_book: false, // Don't save yet, just validate
        validate_address: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Check if it's a validation error with suggestions
      if (response.status === 422 && errorData.errors) {
        const validationErrors = errorData.errors;
        console.log(`[E911] Address validation failed with suggestions:`, validationErrors);
        
        // Extract suggestions if available
        const suggestions = validationErrors
          .filter((e: any) => e.meta?.suggestions)
          .flatMap((e: any) => e.meta.suggestions);
        
        if (suggestions.length > 0) {
          return {
            success: true,
            valid: false,
            suggestions: suggestions.map((s: any, i: number) => ({
              id: `suggestion-${i}`,
              streetAddress: s.street_address || addressData.streetAddress,
              extendedAddress: s.extended_address,
              locality: s.locality || addressData.locality,
              administrativeArea: s.administrative_area || addressData.administrativeArea,
              postalCode: s.postal_code || addressData.postalCode,
              countryCode: s.country_code || "US",
            })),
          };
        }
        
        return {
          success: false,
          valid: false,
          error: validationErrors.map((e: any) => e.detail).join(", "),
        };
      }
      
      const errorText = await response.text();
      console.error(`[E911] Validation error: ${response.status} - ${errorText}`);
      return { success: false, valid: false, error: `Validation failed: ${response.status}` };
    }

    const result = await response.json();
    console.log(`[E911] Address validated successfully`);

    return {
      success: true,
      valid: true,
      normalizedAddress: {
        streetAddress: result.data.street_address,
        extendedAddress: result.data.extended_address,
        locality: result.data.locality,
        administrativeArea: result.data.administrative_area,
        postalCode: result.data.postal_code,
        countryCode: result.data.country_code,
      },
    };
  } catch (error) {
    console.error("[E911] Validation error:", error);
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : "Failed to validate address",
    };
  }
}

/**
 * Creates an emergency address in Telnyx
 * This is required before enabling E911 on a phone number
 */
export async function createEmergencyAddress(
  companyId: string,
  addressData: E911AddressData
): Promise<E911CreateResult> {
  try {
    const config = await getManagedAccountConfig(companyId);
    
    if (!config) {
      return { success: false, error: "Phone system not configured for this company" };
    }

    console.log(`[E911] Creating emergency address for company ${companyId}`);

    // Helper function to make address creation request
    const makeAddressRequest = async (data: {
      street_address: string;
      extended_address?: string;
      locality: string;
      administrative_area: string;
      postal_code: string;
      country_code: string;
    }) => {
      return fetch(`${TELNYX_API_BASE}/addresses`, {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify({
          ...data,
          first_name: addressData.callerName.split(" ")[0] || "Business",
          last_name: addressData.callerName.split(" ").slice(1).join(" ") || "Line",
          business_name: addressData.callerName,
          address_book: true,
        }),
      });
    };

    // First attempt with user-provided address
    let addressResponse = await makeAddressRequest({
      street_address: addressData.streetAddress,
      extended_address: addressData.extendedAddress || "",
      locality: addressData.locality,
      administrative_area: addressData.administrativeArea,
      postal_code: addressData.postalCode,
      country_code: addressData.countryCode || "US",
    });

    // Handle 422 with suggestions - auto-retry with normalized address
    if (addressResponse.status === 422) {
      const errorData = await addressResponse.json().catch(() => ({}));
      
      if (errorData.errors && Array.isArray(errorData.errors)) {
        // Check if all errors are Suggestion type (code 10015)
        const allAreSuggestions = errorData.errors.every((e: any) => e.code === "10015");
        
        if (allAreSuggestions) {
          console.log(`[E911] Received address suggestions from Telnyx, applying corrections...`);
          
          // Extract normalized values from suggestions
          const suggestions: Record<string, string> = {};
          for (const err of errorData.errors) {
            const field = err.source?.pointer?.replace("/", "") || "";
            if (field && err.detail !== undefined) {
              suggestions[field] = err.detail;
            }
          }
          
          console.log(`[E911] Normalized address:`, suggestions);
          
          // Retry with normalized address
          addressResponse = await makeAddressRequest({
            street_address: suggestions.street_address || addressData.streetAddress,
            extended_address: suggestions.extended_address || addressData.extendedAddress || "",
            locality: suggestions.locality || addressData.locality,
            administrative_area: suggestions.administrative_area || addressData.administrativeArea,
            postal_code: suggestions.postal_code || addressData.postalCode,
            country_code: suggestions.country_code || addressData.countryCode || "US",
          });
        }
      }
    }

    if (!addressResponse.ok) {
      const errorText = await addressResponse.text();
      console.error(`[E911] Address creation error: ${addressResponse.status} - ${errorText}`);
      return { success: false, error: `Failed to create address: ${addressResponse.status}` };
    }

    const addressResult = await addressResponse.json();
    const addressId = addressResult.data.id;

    console.log(`[E911] Address created with ID: ${addressId}`);

    // Now create the emergency address linked to this address
    const e911Response = await fetch(`${TELNYX_API_BASE}/emergency_addresses`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        address_id: addressId,
      }),
    });

    if (!e911Response.ok) {
      const errorText = await e911Response.text();
      console.error(`[E911] Emergency address creation error: ${e911Response.status} - ${errorText}`);
      
      // CRITICAL: Must return failure if emergency address creation fails
      // Without a proper emergency address, 911 cannot dispatch to this location
      return { 
        success: false, 
        error: `Failed to create emergency address: ${errorText}. The address may not be valid for E911 services.`,
      };
    }

    const e911Result = await e911Response.json();
    const emergencyAddressId = e911Result.data.id;

    console.log(`[E911] Emergency address created: ${emergencyAddressId}`);

    return {
      success: true,
      addressId: emergencyAddressId,
    };
  } catch (error) {
    console.error("[E911] Create error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create emergency address",
    };
  }
}

/**
 * Enables E911 on a phone number
 * IMPORTANT: This activates monthly E911 billing on Telnyx
 */
export async function enableE911OnNumber(
  companyId: string,
  phoneNumberId: string,
  emergencyAddressId: string
): Promise<E911EnableResult> {
  try {
    const config = await getManagedAccountConfig(companyId);
    
    if (!config) {
      return { success: false, error: "Phone system not configured for this company" };
    }

    console.log(`[E911] Enabling E911 on phone number ${phoneNumberId} with address ${emergencyAddressId}`);

    const response = await fetch(`${TELNYX_API_BASE}/phone_numbers/${phoneNumberId}/actions/enable_emergency`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        emergency_address_id: emergencyAddressId,
        emergency_enabled: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[E911] Enable error: ${response.status} - ${errorText}`);
      return { success: false, error: `Failed to enable E911: ${response.status}` };
    }

    console.log(`[E911] E911 enabled successfully on ${phoneNumberId}`);

    // Update our local database to mark the number as E911 enabled
    await db
      .update(telnyxPhoneNumbers)
      .set({
        e911Enabled: true,
        e911AddressId: emergencyAddressId,
        updatedAt: new Date(),
      })
      .where(eq(telnyxPhoneNumbers.telnyxPhoneNumberId, phoneNumberId));

    return { success: true };
  } catch (error) {
    console.error("[E911] Enable error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to enable E911",
    };
  }
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

/**
 * Full E911 registration flow:
 * 1. Create emergency address
 * 2. Enable on phone number
 * 3. Update local database
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
  // Step 1: Create the emergency address
  const createResult = await createEmergencyAddress(companyId, addressData);
  
  if (!createResult.success || !createResult.addressId) {
    return { success: false, error: createResult.error || "Failed to create emergency address" };
  }

  // Step 2: Enable E911 on the phone number
  const enableResult = await enableE911OnNumber(companyId, phoneNumberId, createResult.addressId);
  
  if (!enableResult.success) {
    return { success: false, error: enableResult.error || "Failed to enable E911 on number" };
  }

  return {
    success: true,
    addressId: createResult.addressId,
  };
}
