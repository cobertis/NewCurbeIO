import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment or generate a default one (DEV ONLY)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // In development, use a default key (NOT FOR PRODUCTION!)
    console.warn('⚠️  WARNING: Using default encryption key. Set ENCRYPTION_KEY environment variable for production!');
    return crypto.scryptSync('default-dev-key-change-me-in-production', 'salt', KEY_LENGTH);
  }
  
  // Derive a proper key from the provided secret
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Encrypted data as JSON string containing iv, authTag, and ciphertext
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext || plaintext.trim() === '') {
    return null;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Store all components as a JSON string
  const encrypted = JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext,
  });
  
  return encrypted;
}

/**
 * Decrypt data encrypted with encrypt()
 * @param encryptedData - JSON string containing iv, authTag, and ciphertext
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const { iv, authTag, ciphertext } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

/**
 * Mask SSN - show only last 4 digits
 * @param ssn - SSN to mask (can be encrypted or plain)
 * @param isEncrypted - Whether the SSN is encrypted
 * @returns Masked SSN (e.g., "XXX-XX-1234")
 */
export function maskSSN(ssn: string | null | undefined, isEncrypted = false): string {
  if (!ssn) return 'XXX-XX-XXXX';
  
  try {
    const plainSSN = isEncrypted ? decrypt(ssn) : ssn;
    if (!plainSSN) return 'XXX-XX-XXXX';
    
    // Extract only digits
    const digits = plainSSN.replace(/\D/g, '');
    
    if (digits.length < 4) {
      return 'XXX-XX-XXXX';
    }
    
    const lastFour = digits.slice(-4);
    return `XXX-XX-${lastFour}`;
  } catch {
    return 'XXX-XX-XXXX';
  }
}

/**
 * Mask income - show only first digit and asterisks
 * @param income - Income amount to mask (can be encrypted or plain)
 * @param isEncrypted - Whether the income is encrypted
 * @returns Masked income (e.g., "$4****")
 */
export function maskIncome(income: string | null | undefined, isEncrypted = false): string {
  if (!income) return '$****';
  
  try {
    const plainIncome = isEncrypted ? decrypt(income) : income;
    if (!plainIncome) return '$****';
    
    // Remove non-digits
    const digits = plainIncome.replace(/\D/g, '');
    
    if (digits.length === 0) return '$****';
    
    const firstDigit = digits[0];
    const stars = '*'.repeat(Math.max(4, digits.length - 1));
    
    return `$${firstDigit}${stars}`;
  } catch {
    return '$****';
  }
}

/**
 * Mask visa/green card number - show only last 4 characters
 * @param number - Number to mask (can be encrypted or plain)
 * @param isEncrypted - Whether the number is encrypted
 * @returns Masked number (e.g., "****1234")
 */
export function maskDocumentNumber(number: string | null | undefined, isEncrypted = false): string {
  if (!number) return '****';
  
  try {
    const plainNumber = isEncrypted ? decrypt(number) : number;
    if (!plainNumber) return '****';
    
    if (plainNumber.length < 4) {
      return '****';
    }
    
    const lastFour = plainNumber.slice(-4);
    const stars = '*'.repeat(Math.max(4, plainNumber.length - 4));
    
    return `${stars}${lastFour}`;
  } catch {
    return '****';
  }
}

/**
 * Validate if a string is properly encrypted
 * @param data - Data to validate
 * @returns true if data appears to be encrypted with our format
 */
export function isEncrypted(data: string | null | undefined): boolean {
  if (!data) return false;
  
  try {
    const parsed = JSON.parse(data);
    return !!(parsed.iv && parsed.authTag && parsed.ciphertext);
  } catch {
    return false;
  }
}

// =====================================================
// TOKEN ENCRYPTION (for OAuth access tokens)
// Uses TOKEN_ENCRYPTION_KEY_BASE64 or fallback to SECRETS_MASTER_KEY
// =====================================================

const TOKEN_IV_LENGTH = 12; // 96 bits for GCM
const TOKEN_AUTH_TAG_LENGTH = 16; // 128 bits

function getTokenEncryptionKey(): Buffer {
  const base64Key = process.env.TOKEN_ENCRYPTION_KEY_BASE64;
  
  if (base64Key) {
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes');
    }
    return key;
  }
  
  const masterKey = process.env.SECRETS_MASTER_KEY;
  if (masterKey) {
    return crypto.scryptSync(masterKey, 'token-encryption-salt', 32);
  }
  
  console.warn('⚠️  WARNING: Using default token encryption key. Set TOKEN_ENCRYPTION_KEY_BASE64 for production!');
  return crypto.scryptSync('default-token-key', 'salt', 32);
}

/**
 * Encrypt OAuth token using AES-256-GCM
 * Output format: base64(iv.ciphertext.authTag)
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty token');
  }

  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(TOKEN_IV_LENGTH);
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([iv, ciphertext, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypt OAuth token
 * Input format: base64(iv.ciphertext.authTag)
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty token');
  }

  try {
    const key = getTokenEncryptionKey();
    const combined = Buffer.from(encrypted, 'base64');
    
    const iv = combined.subarray(0, TOKEN_IV_LENGTH);
    const authTag = combined.subarray(combined.length - TOKEN_AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(TOKEN_IV_LENGTH, combined.length - TOKEN_AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return plaintext.toString('utf8');
  } catch (error) {
    console.error('Token decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}
