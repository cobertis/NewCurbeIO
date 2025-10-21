/**
 * Generate a unique 8-character alphanumeric ID
 * Format: Uppercase letters and numbers (excluding similar looking characters)
 */
export function generateShortId(): string {
  // Use base32-like character set (excludes 0, O, I, L, 1 to avoid confusion)
  const chars = '234567889ABCDEFGHJKMNPQRSTUVWXYZ';
  let id = '';
  
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return id;
}
