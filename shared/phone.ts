/**
 * Phone Number Standardization Utilities
 * 
 * STANDARD FORMATS (UPDATED - ALL USE 11 DIGITS):
 * - Database (storage): 11 digits with "1" prefix (e.g., "13054883848")
 * - Display/UI: Readable format "+1 (305) 488-3848"
 * - BulkVS API: 11 digits with "1" prefix (e.g., "13054883848")
 * - E.164 (international): With + prefix (e.g., "+13054883848")
 * 
 * These functions handle inputs in any format:
 * - With or without country code (+1, 1, or none)
 * - With or without formatting (spaces, dashes, parentheses)
 * 
 * IMPORTANT: Storage format changed from 10 to 11 digits to match BulkVS format
 * and ensure consistency across all phone number operations.
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
 * Validate if a phone number is a valid US phone number
 * Returns true only for US numbers (country code +1)
 * 
 * @param phone - Phone number in any format
 * @returns true if valid US number, false otherwise
 * 
 * @example
 * isValidUSPhoneNumber("3054883848") // true
 * isValidUSPhoneNumber("13054883848") // true
 * isValidUSPhoneNumber("+13054883848") // true
 * isValidUSPhoneNumber("123") // false (too short)
 * isValidUSPhoneNumber("+44...") // false (non-US country code)
 */
export function isValidUSPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  const digits = parseToDigits(phone);
  
  // Valid if 10 digits (US number without country code)
  if (digits.length === 10) {
    return true;
  }
  
  // Valid if 11 digits and starts with 1 (US country code)
  if (digits.length === 11 && digits.startsWith("1")) {
    return true;
  }
  
  // Everything else is invalid (too short, too long, or non-US country code)
  return false;
}

/**
 * Format phone number for database storage
 * Returns 11 digits with "1" prefix for consistency with BulkVS
 * THROWS ERROR if phone number is invalid
 * 
 * @param phone - Phone number in any format
 * @returns 11-digit phone number with "1" prefix (e.g., "13054883848")
 * @throws Error if phone number is not a valid US number
 * 
 * @example
 * formatForStorage("+1 (305) 488-3848") // "13054883848"
 * formatForStorage("13054883848") // "13054883848"
 * formatForStorage("305-488-3848") // "13054883848"
 * formatForStorage("3054883848") // "13054883848"
 * formatForStorage("5551234") // throws Error (too short)
 * formatForStorage("+44...") // throws Error (non-US)
 */
export function formatForStorage(phone: string | null | undefined): string {
  if (!phone) {
    throw new Error("Phone number is required");
  }
  
  const digits = parseToDigits(phone);
  
  // Validate length: must be exactly 10 or 11 digits
  if (digits.length !== 10 && digits.length !== 11) {
    throw new Error(`Invalid phone number: must be 10 or 11 digits, got ${digits.length} digits`);
  }
  
  // If it has 11 digits, must start with 1 (US country code)
  if (digits.length === 11 && !digits.startsWith("1")) {
    throw new Error(`Invalid phone number: 11-digit numbers must start with 1 (US country code), got ${digits.charAt(0)}`);
  }
  
  // If it has 11 digits and starts with 1, return as-is
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits;
  }
  
  // If it has 10 digits, add "1" prefix
  if (digits.length === 10) {
    return "1" + digits;
  }
  
  // This should never be reached due to validation above
  return digits;
}

/**
 * Format phone number for user-facing display
 * Returns format: "+1 (305) 488-3848"
 * 
 * @param phone - Phone number in any format (prioritizes 11-digit format)
 * @returns Formatted phone number for display
 * 
 * @example
 * formatForDisplay("13054883848") // "+1 (305) 488-3848"
 * formatForDisplay("3054883848") // "+1 (305) 488-3848"
 * formatForDisplay("+1 (305) 488-3848") // "+1 (305) 488-3848"
 */
export function formatForDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  
  const digits = parseToDigits(phone);
  
  // Ensure we have 10 or 11 digits
  let tenDigits: string;
  if (digits.length === 11 && digits.startsWith("1")) {
    tenDigits = digits.substring(1);
  } else if (digits.length === 10) {
    tenDigits = digits;
  } else {
    // Invalid format, return original
    return phone;
  }
  
  // Format as +1 (XXX) XXX-XXXX
  const match = tenDigits.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
  }
  
  // Fallback to original if pattern doesn't match
  return phone;
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

/**
 * Format phone input for real-time user typing
 * Formats as user types in input field: "+1 (XXX) XXX-XXXX"
 * For display only during typing - NEVER throws exceptions
 * Returns original input unchanged for non-US country codes
 * Validation happens at submit time (formatForStorage), not during typing
 * 
 * @param value - Current input value
 * @returns Formatted phone string for display in input field
 * 
 * @example
 * formatPhoneInput("3") // "+1 (3"
 * formatPhoneInput("305") // "+1 (305"
 * formatPhoneInput("3054883848") // "+1 (305) 488-3848"
 * formatPhoneInput("+44123") // "+44123" (returns unchanged, validation happens at submit)
 */
export function formatPhoneInput(value: string): string {
  if (!value) return "";
  
  // Remove all non-digits except leading +
  let cleaned = value.replace(/[^\d+]/g, "");
  
  // Check for non-US country codes
  if (cleaned.startsWith("+") && !cleaned.startsWith("+1")) {
    // Extract the country code (first 1-3 digits after +)
    const countryCodeMatch = cleaned.match(/^\+(\d{1,3})/);
    if (countryCodeMatch) {
      const countryCode = countryCodeMatch[1];
      // Only allow country code 1 (US/Canada)
      if (countryCode !== "1" && countryCode.length >= 2) {
        // Return original input unchanged for non-US country codes
        // Don't throw - validation happens at submit time, not during typing
        return value;
      }
    }
  }
  
  // Ensure it starts with +1
  if (!cleaned.startsWith("+")) {
    cleaned = "+1" + cleaned.replace(/^1/, "");
  } else if (cleaned.startsWith("+") && !cleaned.startsWith("+1")) {
    // Force +1 for any other country code attempts
    cleaned = "+1" + cleaned.substring(1).replace(/^1/, "");
  }
  
  // Extract digits after +1
  const digits = cleaned.substring(2);
  
  // Limit to 10 digits max (US phone number)
  const limitedDigits = digits.slice(0, 10);
  
  // Format as: +1 (XXX) XXX-XXXX
  if (limitedDigits.length === 0) {
    return "+1 ";
  } else if (limitedDigits.length <= 3) {
    return `+1 (${limitedDigits}`;
  } else if (limitedDigits.length <= 6) {
    return `+1 (${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  } else {
    return `+1 (${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6, 10)}`;
  }
}

/**
 * Generate a URL-friendly slug from a string
 * Example: "John Doe" -> "john-doe"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a secure random token for webhooks
 * Example: "a1b2c3d4e5f6g7h8i9j0"
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Get the base domain for webhook URLs
 * Development: uses REPLIT_DOMAINS
 * Production: uses app.curbe.io
 */
export function getBaseDomain(): string {
  const replitDomain = process.env.REPLIT_DOMAINS;
  
  // If REPLIT_DOMAINS exists, we're in development
  if (replitDomain) {
    return `https://${replitDomain}`;
  }
  
  // Production domain
  return 'https://app.curbe.io';
}
