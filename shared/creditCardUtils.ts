/**
 * Credit Card Validation Utilities
 * Comprehensive validation for credit/debit cards including Luhn algorithm,
 * card type detection, and formatting
 */

export type CardType = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export interface CardTypeInfo {
  type: CardType;
  name: string;
  lengths: number[];
  cvvLength: number;
  gaps: number[]; // Positions for spacing in formatted display
}

/**
 * Card type definitions with BIN patterns, valid lengths, and formatting
 */
const CARD_TYPES: Record<CardType, CardTypeInfo> = {
  visa: {
    type: 'visa',
    name: 'Visa',
    lengths: [13, 16, 19],
    cvvLength: 3,
    gaps: [4, 8, 12], // Standard 4-4-4-4 format
  },
  mastercard: {
    type: 'mastercard',
    name: 'Mastercard',
    lengths: [16],
    cvvLength: 3,
    gaps: [4, 8, 12], // Standard 4-4-4-4 format
  },
  amex: {
    type: 'amex',
    name: 'American Express',
    lengths: [15],
    cvvLength: 4, // Amex uses 4-digit CVV
    gaps: [4, 10], // Amex format: 4-6-5
  },
  discover: {
    type: 'discover',
    name: 'Discover',
    lengths: [16],
    cvvLength: 3,
    gaps: [4, 8, 12], // Standard 4-4-4-4 format
  },
  unknown: {
    type: 'unknown',
    name: 'Unknown',
    lengths: [13, 14, 15, 16, 17, 18, 19],
    cvvLength: 3,
    gaps: [4, 8, 12],
  },
};

/**
 * Detect card type from card number using BIN patterns
 */
export function detectCardType(cardNumber: string): CardType {
  const cleaned = cardNumber.replace(/\D/g, '');
  
  if (!cleaned) return 'unknown';

  // Visa: starts with 4
  if (/^4/.test(cleaned)) {
    return 'visa';
  }

  // Mastercard: starts with 51-55 or 2221-2720
  if (/^5[1-5]/.test(cleaned) || /^2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(cleaned)) {
    return 'mastercard';
  }

  // American Express: starts with 34 or 37
  if (/^3[47]/.test(cleaned)) {
    return 'amex';
  }

  // Discover: starts with 6011, 622126-622925, 644-649, or 65
  if (/^(6011|65|64[4-9]|622(1(2[6-9]|[3-9]\d)|[2-8]\d{2}|9([01]\d|2[0-5])))/.test(cleaned)) {
    return 'discover';
  }

  return 'unknown';
}

/**
 * Get card type information
 */
export function getCardTypeInfo(cardNumber: string): CardTypeInfo {
  const type = detectCardType(cardNumber);
  return CARD_TYPES[type];
}

/**
 * Luhn algorithm for credit card validation
 * Returns true if the card number is valid according to Luhn checksum
 */
export function luhnCheck(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\D/g, '');
  
  if (cleaned.length < 13) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  // Process digits from right to left
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Validate card number comprehensively
 */
export function validateCardNumber(cardNumber: string): {
  isValid: boolean;
  cardType: CardType;
  error?: string;
} {
  const cleaned = cardNumber.replace(/\D/g, '');

  if (!cleaned) {
    return { isValid: false, cardType: 'unknown', error: 'Card number is required' };
  }

  const cardType = detectCardType(cleaned);
  const cardInfo = CARD_TYPES[cardType];

  // Check length
  if (!cardInfo.lengths.includes(cleaned.length)) {
    return {
      isValid: false,
      cardType,
      error: `${cardInfo.name} card must be ${cardInfo.lengths.join(' or ')} digits`,
    };
  }

  // Check Luhn algorithm
  if (!luhnCheck(cleaned)) {
    return {
      isValid: false,
      cardType,
      error: 'Invalid card number',
    };
  }

  return { isValid: true, cardType };
}

/**
 * Format card number for display with appropriate spacing
 */
export function formatCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');
  const cardInfo = getCardTypeInfo(cleaned);
  
  let formatted = '';
  let lastGap = 0;

  cardInfo.gaps.forEach((gap, index) => {
    const segment = cleaned.slice(lastGap, gap);
    if (segment) {
      formatted += (formatted ? ' ' : '') + segment;
    }
    lastGap = gap;
  });

  // Add remaining digits
  const remaining = cleaned.slice(lastGap);
  if (remaining) {
    formatted += (formatted ? ' ' : '') + remaining;
  }

  return formatted;
}

/**
 * Validate CVV based on card type
 */
export function validateCVV(cvv: string, cardNumber: string): {
  isValid: boolean;
  error?: string;
} {
  const cleaned = cvv.replace(/\D/g, '');
  const cardInfo = getCardTypeInfo(cardNumber);

  if (!cleaned) {
    return { isValid: false, error: 'CVV is required' };
  }

  if (cleaned.length !== cardInfo.cvvLength) {
    return {
      isValid: false,
      error: `${cardInfo.name} CVV must be ${cardInfo.cvvLength} digits`,
    };
  }

  return { isValid: true };
}

/**
 * Validate expiration date (MM/YY format)
 */
export function validateExpirationDate(expiration: string): {
  isValid: boolean;
  error?: string;
} {
  const cleaned = expiration.replace(/\D/g, '');

  if (cleaned.length !== 4) {
    return { isValid: false, error: 'Expiration must be MM/YY format' };
  }

  const month = parseInt(cleaned.slice(0, 2), 10);
  const year = parseInt(cleaned.slice(2, 4), 10);

  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Invalid month (01-12)' };
  }

  const now = new Date();
  const currentYear = now.getFullYear() % 100; // Get last 2 digits
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { isValid: false, error: 'Card has expired' };
  }

  return { isValid: true };
}

/**
 * Format expiration date as MM/YY
 */
export function formatExpirationDate(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
  }
  
  return cleaned;
}

/**
 * Get maximum length for card number input based on detected type
 */
export function getMaxCardLength(cardNumber: string): number {
  const cardInfo = getCardTypeInfo(cardNumber);
  return Math.max(...cardInfo.lengths);
}

/**
 * Clean and limit card number input
 */
export function cleanCardNumber(value: string, currentValue?: string): string {
  const cleaned = value.replace(/\D/g, '');
  const maxLength = getMaxCardLength(cleaned);
  return cleaned.slice(0, maxLength);
}
