/**
 * Centralized Pricing Configuration
 * 
 * All customer-facing rates for telephony billing.
 * These are the SALE prices to customers (includes margin over Telnyx costs).
 * 
 * Cost Structure (for reference):
 * - Inbound Cost: $0.0049/min ($0.0032 transport + $0.0017 processing)
 * - Outbound Cost: $0.0064/min ($0.0047 transport + $0.0017 processing)
 * - Recording Cost: $0.0017/min
 * - Number Monthly Cost: $0.75
 * - CNAM Monthly Cost: $0.40
 */

export const PRICING = {
  // Per-minute usage rates (customer-facing prices)
  usage: {
    // Inbound: $0.015/min (Cost: $0.0049, Margin: ~3x)
    inbound_minute: 0.015,
    
    // Outbound: $0.02/min (Cost: $0.0064, Margin: ~3x)
    outbound_minute: 0.02,
    
    // Recording: $0.005/min added to call cost (Cost: $0.0017, Margin: ~3x)
    recording_minute: 0.005,
    
    // CNAM lookup: $0.01 per inbound call (Cost: ~$0.004, Margin: ~2.5x)
    cnam_lookup_per_call: 0.01,
  },
  
  // Monthly subscription fees
  monthly: {
    // Phone number rental: $1.50/month (Cost: $0.75, Margin: 2x)
    number_rental: 1.50,
    
    // CNAM subscription: $1.00/month (Cost: $0.40, Margin: 2.5x)
    cnam_subscription: 1.00,
  },
  
  // Billing increments
  billing: {
    // Minimum billable duration in seconds (60 = 1 minute, matching Telnyx billing)
    min_billable_seconds: 60,
    
    // Billing increment in seconds (60 = 1 minute, rounded up - matching Telnyx)
    billing_increment: 60,
  },
} as const;

// Helper function to calculate call cost with features
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
  // BUSINESS RULE: Telnyx bills in 60-second (1 minute) increments, rounded UP
  // Math.ceil(61 / 60) = 2 minutes
  // Math.ceil(10 / 60) = 1 minute
  // Math.ceil(0 / 60) = 0 minutes (no charge for unanswered)
  const billableMinutes = durationSeconds > 0 ? Math.ceil(durationSeconds / 60) : 0;
  const billedDurationSeconds = billableMinutes * 60;
  
  // Base rate based on direction
  const baseRate = direction === 'inbound' 
    ? PRICING.usage.inbound_minute 
    : PRICING.usage.outbound_minute;
  
  const baseCost = billableMinutes * baseRate;
  
  // Recording cost (if enabled)
  const recordingCost = recordingEnabled 
    ? billableMinutes * PRICING.usage.recording_minute 
    : 0;
  
  // CNAM cost (only for inbound calls when enabled)
  const cnamCost = (cnamEnabled && direction === 'inbound') 
    ? PRICING.usage.cnam_lookup_per_call 
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
  return `$${ratePerMinute.toFixed(3)}/min`;
}
