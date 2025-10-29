import { webcrypto } from "crypto";

/**
 * Generate a cryptographically secure 8-character alphanumeric ID
 * Format: Uppercase letters and numbers (excluding similar looking characters)
 * Uses crypto.getRandomValues for cryptographic security
 */
export function generateShortId(): string {
  // Use base32-like character set (excludes 0, O, I, L, 1 to avoid confusion)
  const chars = '234567889ABCDEFGHJKMNPQRSTUVWXYZ';
  const charLength = chars.length;
  let id = '';
  
  // Generate 8 cryptographically random characters
  const randomValues = new Uint8Array(8);
  webcrypto.getRandomValues(randomValues);
  
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(randomValues[i] % charLength);
  }
  
  return id;
}
