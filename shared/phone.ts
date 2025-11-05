/**
 * Phone Number Standardization Utilities
 * 
 * STANDARD FORMATS:
 * - Database (storage): 10 digits without prefix (e.g., "3054883848")
 * - Display/UI: Readable format "+1 (305) 488-3848"
 * - BulkVS API: 11 digits with "1" prefix (e.g., "13054883848")
 * - E.164 (international): With + prefix (e.g., "+13054883848")
 * 
 * These functions handle inputs in any format:
 * - With or without country code (+1, 1, or none)
 * - With or without formatting (spaces, dashes, parentheses)
 */

/**
 * Extract only digits from a phone number string
 * Removes all non-digit characters
 * 
 * @param phone - Phone number in any format
 * @returns String containing only digits
 * 
 * @example
 * parseToDigits("+1 (305) 488-3848") // "13054883848"
 * parseToDigits("305-488-3848") // "3054883848"
 * parseToDigits("1-305-488-3848") // "13054883848"
 */
export function parseToDigits(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Format phone number for database storage
 * Returns 10 digits without country code
 * 
 * @param phone - Phone number in any format
 * @returns 10-digit phone number (e.g., "3054883848")
 * 
 * @example
 * formatForStorage("+1 (305) 488-3848") // "3054883848"
 * formatForStorage("13054883848") // "3054883848"
 * formatForStorage("305-488-3848") // "3054883848"
 */
export function formatForStorage(phone: string | null | undefined): string {
  const digits = parseToDigits(phone);
  
  // If it has 11 digits and starts with 1, remove the 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.substring(1);
  }
  
  // If it has 10 digits, return as-is
  if (digits.length === 10) {
    return digits;
  }
  
  // Otherwise return the original digits (might be invalid)
  return digits;
}

/**
 * Format phone number for user-facing display
 * Returns format: "+1 (305) 488-3848"
 * 
 * @param phone - Phone number in any format
 * @returns Formatted phone number for display
 * 
 * @example
 * formatForDisplay("3054883848") // "+1 (305) 488-3848"
 * formatForDisplay("13054883848") // "+1 (305) 488-3848"
 * formatForDisplay("+1 (305) 488-3848") // "+1 (305) 488-3848"
 */
export function formatForDisplay(phone: string | null | undefined): string {
  const digits = parseToDigits(phone);
  
  // Ensure we have 10 or 11 digits
  let tenDigits: string;
  if (digits.length === 11 && digits.startsWith("1")) {
    tenDigits = digits.substring(1);
  } else if (digits.length === 10) {
    tenDigits = digits;
  } else {
    // Invalid format, return original
    return phone || "";
  }
  
  // Format as +1 (XXX) XXX-XXXX
  const match = tenDigits.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
  }
  
  // Fallback to original if pattern doesn't match
  return phone || "";
}

/**
 * Format phone number for BulkVS API calls
 * Returns 11 digits with "1" prefix
 * 
 * @param phone - Phone number in any format
 * @returns 11-digit phone number with "1" prefix (e.g., "13054883848")
 * 
 * @example
 * formatForBulkVS("3054883848") // "13054883848"
 * formatForBulkVS("+1 (305) 488-3848") // "13054883848"
 * formatForBulkVS("13054883848") // "13054883848"
 */
export function formatForBulkVS(phone: string | null | undefined): string {
  const digits = parseToDigits(phone);
  
  // If it has 11 digits and starts with 1, return as-is
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits;
  }
  
  // If it has 10 digits, add 1 prefix
  if (digits.length === 10) {
    return "1" + digits;
  }
  
  // Otherwise return the original digits (might be invalid)
  return digits;
}

/**
 * Format phone number in E.164 international format
 * Returns format: "+13054883848"
 * 
 * @param phone - Phone number in any format
 * @returns E.164 formatted phone number (e.g., "+13054883848")
 * 
 * @example
 * formatE164("3054883848") // "+13054883848"
 * formatE164("+1 (305) 488-3848") // "+13054883848"
 * formatE164("13054883848") // "+13054883848"
 */
export function formatE164(phone: string | null | undefined): string {
  const digits = parseToDigits(phone);
  
  // If it has 11 digits and starts with 1, add + prefix
  if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits;
  }
  
  // If it has 10 digits, add +1 prefix
  if (digits.length === 10) {
    return "+1" + digits;
  }
  
  // Otherwise return the original digits with + (might be invalid)
  return digits ? "+" + digits : "";
}

/**
 * Validate if a phone number has the correct format
 * Checks if the number has exactly 10 or 11 digits (with optional 1 prefix)
 * 
 * @param phone - Phone number in any format
 * @returns true if valid, false otherwise
 * 
 * @example
 * isValidPhoneNumber("3054883848") // true
 * isValidPhoneNumber("13054883848") // true
 * isValidPhoneNumber("+1 (305) 488-3848") // true
 * isValidPhoneNumber("123") // false
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  const digits = parseToDigits(phone);
  
  // Valid if 10 digits
  if (digits.length === 10) {
    return true;
  }
  
  // Valid if 11 digits and starts with 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return true;
  }
  
  return false;
}
