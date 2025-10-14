// Phone number formatting utilities

/**
 * Formats a phone number to display format
 * Primary support: US/Canada numbers (NANP)
 * - E.164: +14155552671 -> Display: +1 (415) 555-2671
 * - Without +: 4155552671 -> +1 (415) 555-2671
 * - With parentheses: (415) 555-2671 -> +1 (415) 555-2671
 * 
 * International numbers: Returns as-is if they don't match US format
 * 
 * @param phone - Phone number in various formats
 * @returns Formatted phone number or original if not US format
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-digit characters except the leading +
  let cleaned = phone.replace(/[^\d+]/g, "");
  
  // Handle US/Canada numbers without + prefix
  if (!cleaned.startsWith("+")) {
    if (cleaned.length === 10) {
      // 10 digits: assume US number, add +1
      cleaned = "+1" + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      // 11 digits starting with 1: add +
      cleaned = "+" + cleaned;
    } else {
      // Other lengths: return original (likely international)
      return phone;
    }
  }
  
  // Format US/Canada numbers (NANP: +1 XXX XXX XXXX)
  const match = cleaned.match(/^\+(\d{1,3})(\d{3})(\d{3})(\d{4})$/);
  
  if (match) {
    const [, countryCode, area, prefix, line] = match;
    return `+${countryCode} (${area}) ${prefix}-${line}`;
  }
  
  // Return original for non-matching formats (international, invalid, etc.)
  return phone;
}

/**
 * Converts display format to E.164 format
 * Display: +1 (415) 555-2671 -> E.164: +14155552671
 */
export function formatPhoneE164(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-digit characters except the leading +
  const cleaned = phone.replace(/[^\d+]/g, "");
  
  return cleaned;
}

/**
 * Formats while typing - creates display format as user types
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-digit characters except the leading +
  const cleaned = value.replace(/[^\d+]/g, "");
  
  // If it doesn't start with +, add it
  if (!cleaned.startsWith("+") && cleaned.length > 0) {
    return "+" + cleaned;
  }
  
  // Format as user types
  if (cleaned.length <= 2) {
    return cleaned; // +1
  } else if (cleaned.length <= 5) {
    return `${cleaned.slice(0, 2)} (${cleaned.slice(2)}`; // +1 (415
  } else if (cleaned.length <= 8) {
    return `${cleaned.slice(0, 2)} (${cleaned.slice(2, 5)}) ${cleaned.slice(5)}`; // +1 (415) 555
  } else if (cleaned.length <= 12) {
    return `${cleaned.slice(0, 2)} (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`; // +1 (415) 555-2671
  }
  
  // Max length reached, don't allow more
  return `${cleaned.slice(0, 2)} (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 12)}`;
}
