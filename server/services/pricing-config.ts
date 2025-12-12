/**
 * Centralized Pricing Configuration
 * 
 * All customer-facing rates for telephony billing.
 * These rates are loaded from the database (telnyx_global_pricing table).
 * Falls back to default values if database is unavailable.
 * 
 * Cost Structure (for reference - Telnyx wholesale costs):
 * - Inbound Cost: ~$0.0049/min
 * - Outbound Cost: ~$0.0064/min
 * - Recording Cost: ~$0.0017/min
 * - Number Monthly Cost: ~$0.75
 */

import { db } from "../db";
import { telnyxGlobalPricing } from "@shared/schema";

// Default pricing values (fallback)
const DEFAULT_PRICING = {
  usage: {
    local_outbound_minute: 0.0100,
    local_inbound_minute: 0.0080,
    tollfree_outbound_minute: 0.0180,
    tollfree_inbound_minute: 0.0130,
    recording_minute: 0.0020,
    cnam_lookup_per_call: 0.0045,
    call_control_inbound: 0.0020,
    call_control_outbound: 0.0020,
  },
  sms: {
    longcode_outbound: 0.0060,
    longcode_inbound: 0.0060,
    tollfree_outbound: 0.0070,
    tollfree_inbound: 0.0070,
  },
  monthly: {
    local_did: 1.00,
    tollfree_did: 1.50,
  },
  billing: {
    min_billable_seconds: 60,
    billing_increment: 60,
  },
};

// In-memory cache
let cachedPricing: typeof DEFAULT_PRICING | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Load pricing from database with caching
 */
export async function loadGlobalPricing(): Promise<typeof DEFAULT_PRICING> {
  // Return cached pricing if still valid
  if (cachedPricing && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedPricing;
  }

  try {
    const [dbPricing] = await db.select().from(telnyxGlobalPricing).limit(1);
    
    if (dbPricing) {
      cachedPricing = {
        usage: {
          local_outbound_minute: parseFloat(dbPricing.voiceLocalOutbound || "0.0100"),
          local_inbound_minute: parseFloat(dbPricing.voiceLocalInbound || "0.0080"),
          tollfree_outbound_minute: parseFloat(dbPricing.voiceTollfreeOutbound || "0.0180"),
          tollfree_inbound_minute: parseFloat(dbPricing.voiceTollfreeInbound || "0.0130"),
          recording_minute: parseFloat(dbPricing.recordingPerMinute || "0.0020"),
          cnam_lookup_per_call: parseFloat(dbPricing.cnamLookup || "0.0045"),
          call_control_inbound: parseFloat(dbPricing.callControlInbound || "0.0020"),
          call_control_outbound: parseFloat(dbPricing.callControlOutbound || "0.0020"),
        },
        sms: {
          longcode_outbound: parseFloat(dbPricing.smsLongcodeOutbound || "0.0060"),
          longcode_inbound: parseFloat(dbPricing.smsLongcodeInbound || "0.0060"),
          tollfree_outbound: parseFloat(dbPricing.smsTollfreeOutbound || "0.0070"),
          tollfree_inbound: parseFloat(dbPricing.smsTollfreeInbound || "0.0070"),
        },
        monthly: {
          local_did: parseFloat(dbPricing.didLocal || "1.00"),
          tollfree_did: parseFloat(dbPricing.didTollfree || "1.50"),
        },
        billing: {
          min_billable_seconds: dbPricing.minBillableSeconds || 60,
          billing_increment: dbPricing.billingIncrement || 60,
        },
      };
      cacheTimestamp = Date.now();
      return cachedPricing;
    }
  } catch (error) {
    console.error('[Pricing] Failed to load from database, using defaults:', error);
  }

  return DEFAULT_PRICING;
}

/**
 * Synchronous access to cached pricing (returns defaults if not loaded)
 * @deprecated Use loadGlobalPricing() for accurate pricing
 */
export const PRICING = {
  usage: {
    inbound_minute: DEFAULT_PRICING.usage.local_inbound_minute,
    outbound_minute: DEFAULT_PRICING.usage.local_outbound_minute,
    recording_minute: DEFAULT_PRICING.usage.recording_minute,
    cnam_lookup_per_call: DEFAULT_PRICING.usage.cnam_lookup_per_call,
  },
  monthly: {
    number_rental: DEFAULT_PRICING.monthly.local_did,
    cnam_per_number: 0.50,
    e911_per_address: 2.00,
  },
  billing: {
    min_billable_seconds: DEFAULT_PRICING.billing.min_billable_seconds,
    billing_increment: DEFAULT_PRICING.billing.billing_increment,
  },
};

/**
 * Calculate call cost using database pricing
 */
export async function calculateCallCost(
  durationSeconds: number,
  direction: 'inbound' | 'outbound',
  options: {
    isTollFree?: boolean;
    recordingEnabled?: boolean;
    cnamEnabled?: boolean;
  } = {}
): Promise<{
  baseCost: number;
  recordingCost: number;
  cnamCost: number;
  callControlCost: number;
  totalCost: number;
  billableMinutes: number;
  billedDurationSeconds: number;
  ratePerMinute: number;
}> {
  const pricing = await loadGlobalPricing();
  const { isTollFree = false, recordingEnabled = false, cnamEnabled = false } = options;
  
  // Calculate billable minutes with minimum enforcement (Telnyx 60/60 billing)
  // If call connected (duration > 0), enforce minimum billable seconds
  let billedDurationSeconds = 0;
  let billableMinutes = 0;
  
  if (durationSeconds > 0) {
    // Enforce minimum billable seconds (default 60 = 1 minute minimum)
    const effectiveDuration = Math.max(durationSeconds, pricing.billing.min_billable_seconds);
    // Round UP to next billing increment
    billableMinutes = Math.ceil(effectiveDuration / pricing.billing.billing_increment);
    billedDurationSeconds = billableMinutes * pricing.billing.billing_increment;
  }
  
  // Select rate based on direction and type
  let ratePerMinute: number;
  if (direction === 'inbound') {
    ratePerMinute = isTollFree 
      ? pricing.usage.tollfree_inbound_minute 
      : pricing.usage.local_inbound_minute;
  } else {
    ratePerMinute = isTollFree 
      ? pricing.usage.tollfree_outbound_minute 
      : pricing.usage.local_outbound_minute;
  }
  
  const baseCost = billableMinutes * ratePerMinute;
  
  // Recording cost
  const recordingCost = recordingEnabled 
    ? billableMinutes * pricing.usage.recording_minute 
    : 0;
  
  // CNAM cost (only for inbound calls)
  const cnamCost = (cnamEnabled && direction === 'inbound') 
    ? pricing.usage.cnam_lookup_per_call 
    : 0;
  
  // Call control cost
  const callControlRate = direction === 'inbound' 
    ? pricing.usage.call_control_inbound 
    : pricing.usage.call_control_outbound;
  const callControlCost = billableMinutes * callControlRate;
  
  const totalCost = baseCost + recordingCost + cnamCost + callControlCost;
  
  return {
    baseCost: Math.round(baseCost * 10000) / 10000,
    recordingCost: Math.round(recordingCost * 10000) / 10000,
    cnamCost: Math.round(cnamCost * 10000) / 10000,
    callControlCost: Math.round(callControlCost * 10000) / 10000,
    totalCost: Math.round(totalCost * 10000) / 10000,
    billableMinutes,
    billedDurationSeconds,
    ratePerMinute,
  };
}

/**
 * Calculate SMS cost using database pricing
 */
export async function calculateSmsCost(
  direction: 'inbound' | 'outbound',
  isTollFree: boolean = false
): Promise<number> {
  const pricing = await loadGlobalPricing();
  
  if (direction === 'outbound') {
    return isTollFree ? pricing.sms.tollfree_outbound : pricing.sms.longcode_outbound;
  } else {
    return isTollFree ? pricing.sms.tollfree_inbound : pricing.sms.longcode_inbound;
  }
}

/**
 * Get monthly DID cost
 */
export async function getDidMonthlyCost(isTollFree: boolean = false): Promise<number> {
  const pricing = await loadGlobalPricing();
  return isTollFree ? pricing.monthly.tollfree_did : pricing.monthly.local_did;
}

// Legacy function for backward compatibility
export function calculateCallCostWithFeatures(
  durationSeconds: number,
  direction: 'inbound' | 'outbound',
  recordingEnabled: boolean = false,
  cnamEnabled: boolean = false
): {
  baseCost: number;
  recordingCost: number;
  cnamCost: number;
  totalCost: number;
  billableMinutes: number;
  billedDurationSeconds: number;
} {
  // Use cached/default values for synchronous calls
  const minBillable = cachedPricing?.billing.min_billable_seconds || DEFAULT_PRICING.billing.min_billable_seconds;
  const increment = cachedPricing?.billing.billing_increment || DEFAULT_PRICING.billing.billing_increment;
  
  let billableMinutes = 0;
  let billedDurationSeconds = 0;
  
  if (durationSeconds > 0) {
    const effectiveDuration = Math.max(durationSeconds, minBillable);
    billableMinutes = Math.ceil(effectiveDuration / increment);
    billedDurationSeconds = billableMinutes * increment;
  }
  
  const baseRate = direction === 'inbound' 
    ? (cachedPricing?.usage.local_inbound_minute || DEFAULT_PRICING.usage.local_inbound_minute)
    : (cachedPricing?.usage.local_outbound_minute || DEFAULT_PRICING.usage.local_outbound_minute);
  
  const baseCost = billableMinutes * baseRate;
  
  const recordingCost = recordingEnabled 
    ? billableMinutes * (cachedPricing?.usage.recording_minute || DEFAULT_PRICING.usage.recording_minute)
    : 0;
  
  const cnamCost = (cnamEnabled && direction === 'inbound') 
    ? (cachedPricing?.usage.cnam_lookup_per_call || DEFAULT_PRICING.usage.cnam_lookup_per_call)
    : 0;
  
  const totalCost = baseCost + recordingCost + cnamCost;
  
  return {
    baseCost: Math.round(baseCost * 10000) / 10000,
    recordingCost: Math.round(recordingCost * 10000) / 10000,
    cnamCost: Math.round(cnamCost * 10000) / 10000,
    totalCost: Math.round(totalCost * 10000) / 10000,
    billableMinutes,
    billedDurationSeconds,
  };
}

// Format price for display
export function formatPrice(amount: number, decimals: number = 2): string {
  return `$${amount.toFixed(decimals)}`;
}

// Format rate for display (e.g., "$0.02/min")
export function formatRate(ratePerMinute: number): string {
  return `$${ratePerMinute.toFixed(4)}/min`;
}

// Invalidate cache (call after pricing update)
export function invalidatePricingCache(): void {
  cachedPricing = null;
  cacheTimestamp = 0;
}
