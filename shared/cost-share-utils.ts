/**
 * Cost-Share Utilities
 * 
 * Shared utilities for parsing, normalizing, and formatting cost-sharing values
 * (copays, coinsurance, and custom descriptions) across manual plan entry and
 * CMS Marketplace plan mapping.
 */

export type CostShareType = 'copay' | 'coinsurance' | 'custom';

export interface CostShareValue {
  raw: string;                    // Original input: "25%", "$10", "No Charge After Deductible"
  type: CostShareType;            // Classified type
  amountCents?: number;           // For copays: 1000 = $10.00
  percent?: number;               // For coinsurance: 25 = 25%
  notes?: string;                 // Additional context from descriptions
}

/**
 * Parse a cost-share value from user input or CMS API
 * 
 * Examples:
 *  "$10" -> { raw: "$10", type: "copay", amountCents: 1000 }
 *  "10" -> { raw: "10", type: "copay", amountCents: 1000 }
 *  "25%" -> { raw: "25%", type: "coinsurance", percent: 25 }
 *  "20% coinsurance" -> { raw: "20% coinsurance", type: "coinsurance", percent: 20 }
 *  "No Charge After Deductible" -> { raw: "No Charge After Deductible", type: "custom" }
 */
export function parseCostShareValue(input: string | null | undefined): CostShareValue | null {
  // Handle null/empty input
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return null;
  }
  
  const trimmed = input.trim();
  
  // CRITICAL FIX: Check for qualifiers that indicate this should be 'custom', not simple copay/coinsurance
  // Words that indicate additional context beyond just a number
  const hasQualifiers = /\b(after|deductible|copay|coinsurance|charge|no charge|then|once|per|visit|day)\b/i.test(trimmed);
  
  // Try to parse as dollar amount (copay)
  // Matches: $10, $10.50, 10, 10.50
  const dollarMatch = trimmed.match(/^\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (dollarMatch) {
    const amount = parseFloat(dollarMatch[1]);
    const amountStr = dollarMatch[0].trim(); // e.g., "$10" or "10"
    
    // Check if this is clearly a copay (has $ or no % sign anywhere)
    if (trimmed.includes('$') || !trimmed.includes('%')) {
      // Only treat as copay if it's purely numeric or has $ prefix
      // Don't mistake "10% coinsurance" for a copay
      const hasPercent = trimmed.includes('%');
      if (!hasPercent) {
        // CRITICAL: Check if there's extra text beyond just the dollar amount
        // "$10 after deductible" should be 'custom', not 'copay'
        const isJustNumber = trimmed === amountStr || trimmed === `$${amount}` || trimmed === amount.toString();
        
        if (isJustNumber && !hasQualifiers) {
          // Pure copay: just "$10" or "10"
          return {
            raw: trimmed,
            type: 'copay',
            amountCents: Math.round(amount * 100),
          };
        } else {
          // Has qualifiers: "$10 after deductible" -> preserve as custom
          return {
            raw: trimmed,
            type: 'custom',
            notes: trimmed,
          };
        }
      }
    }
  }
  
  // Try to parse as percentage (coinsurance)
  // Matches: 25%, 25, "20% coinsurance after deductible"
  const percentMatch = trimmed.match(/(\d+(?:\.\d{1,2})?)\s*%/);
  if (percentMatch) {
    const percent = parseFloat(percentMatch[1]);
    const notes = trimmed.replace(/\d+(?:\.\d{1,2})?\s*%/, '').trim();
    
    // CRITICAL: If there are qualifiers beyond just "coinsurance", treat as custom
    // "25%" -> coinsurance
    // "25% after deductible" -> custom (preserve full text)
    const hasExtraQualifiers = notes && notes.toLowerCase() !== 'coinsurance';
    
    if (hasExtraQualifiers) {
      return {
        raw: trimmed,
        type: 'custom',
        notes: trimmed,
      };
    }
    
    return {
      raw: trimmed,
      type: 'coinsurance',
      percent: percent,
      notes: notes || undefined,
    };
  }
  
  // Check for "X% after deductible" pattern without % symbol
  // e.g., "40 after deductible" -> treat as custom to avoid duplication
  // CRITICAL FIX: Don't try to normalize implicit percent with qualifiers - treat as custom
  const implicitPercentMatch = trimmed.match(/^(\d+)\s+(after|coinsurance)/i);
  if (implicitPercentMatch) {
    // If it has qualifiers like "after deductible", preserve as custom
    return {
      raw: trimmed,
      type: 'custom',
      notes: trimmed,
    };
  }
  
  // Everything else is custom (free-form text)
  return {
    raw: trimmed,
    type: 'custom',
    notes: trimmed,
  };
}

/**
 * Format a cost-share value for display
 * 
 * Examples:
 *  { type: "copay", amountCents: 1000 } -> "$10.00 copay"
 *  { type: "coinsurance", percent: 25 } -> "25% coinsurance"
 *  { type: "custom", raw: "No Charge" } -> "No Charge"
 */
export function formatCostShareValue(value: CostShareValue | null | undefined): string {
  if (!value) return 'N/A';
  
  switch (value.type) {
    case 'copay':
      if (value.amountCents !== undefined) {
        const dollars = value.amountCents / 100;
        if (dollars === 0) return '$0';
        // Show without cents if whole dollar amount
        if (dollars % 1 === 0) {
          return `$${dollars.toFixed(0)} copay`;
        }
        return `$${dollars.toFixed(2)} copay`;
      }
      return value.raw;
      
    case 'coinsurance':
      if (value.percent !== undefined) {
        const percentStr = value.percent % 1 === 0 
          ? value.percent.toFixed(0) 
          : value.percent.toFixed(1);
        return value.notes 
          ? `${percentStr}% ${value.notes}` 
          : `${percentStr}% coinsurance`;
      }
      return value.raw;
      
    case 'custom':
    default:
      return value.raw;
  }
}

/**
 * Format a cost-share value for SHORT display (compact format)
 * 
 * CRITICAL FIX: Now includes notes field to preserve important context
 * 
 * Examples:
 *  { type: "copay", amountCents: 1000 } -> "$10"
 *  { type: "copay", amountCents: 1000, notes: "after deductible" } -> "$10 after deductible"
 *  { type: "coinsurance", percent: 25 } -> "25%"
 *  { type: "coinsurance", percent: 25, notes: "after deductible" } -> "25% after deductible"
 *  { type: "custom", raw: "No Charge After Deductible" } -> "No Charge After Deductible"
 */
export function formatCostShareValueShort(value: CostShareValue | null | undefined): string {
  if (!value) return 'N/A';
  
  switch (value.type) {
    case 'copay':
      if (value.amountCents !== undefined) {
        const dollars = value.amountCents / 100;
        let result = '';
        if (dollars === 0) {
          result = '$0';
        } else if (dollars % 1 === 0) {
          result = `$${dollars.toFixed(0)}`;
        } else {
          result = `$${dollars.toFixed(2)}`;
        }
        // CRITICAL: Include notes if present
        if (value.notes) {
          return `${result} ${value.notes}`;
        }
        return result;
      }
      return value.raw;
      
    case 'coinsurance':
      if (value.percent !== undefined) {
        const percentStr = value.percent % 1 === 0 
          ? value.percent.toFixed(0) 
          : value.percent.toFixed(1);
        // CRITICAL: Include notes if present
        if (value.notes) {
          return `${percentStr}% ${value.notes}`;
        }
        return `${percentStr}%`;
      }
      return value.raw;
      
    case 'custom':
    default:
      return value.raw;
  }
}

/**
 * Validate and normalize manual plan entry cost values
 * Accepts flexible input and returns normalized structure
 */
export function normalizePlanCostField(input: string | null | undefined): CostShareValue | null {
  return parseCostShareValue(input);
}

/**
 * Extract cost-share value from CMS API benefit cost_sharing
 * Handles the complex CMS API structure
 */
export function extractCostShareFromCMS(costSharing: any): CostShareValue | null {
  if (!costSharing) return null;
  
  // Priority 1: Use display_string if available (most accurate)
  if (costSharing.display_string) {
    return parseCostShareValue(costSharing.display_string);
  }
  
  // Priority 2: Use specific fields
  if (costSharing.copay_amount !== undefined && costSharing.copay_amount !== null) {
    return {
      raw: `$${costSharing.copay_amount}`,
      type: 'copay',
      amountCents: Math.round(costSharing.copay_amount * 100),
      notes: costSharing.copay_options || undefined,
    };
  }
  
  if (costSharing.coinsurance_rate !== undefined && costSharing.coinsurance_rate !== null) {
    return {
      raw: `${costSharing.coinsurance_rate}%`,
      type: 'coinsurance',
      percent: costSharing.coinsurance_rate,
      notes: costSharing.coinsurance_options || undefined,
    };
  }
  
  // Priority 3: Parse from options strings
  if (costSharing.copay_options) {
    return parseCostShareValue(costSharing.copay_options);
  }
  
  if (costSharing.coinsurance_options) {
    return parseCostShareValue(costSharing.coinsurance_options);
  }
  
  return null;
}
