import { db } from "../db";
import { callRates, wallets, walletTransactions, callLogs, telephonySettings, users, telnyxPhoneNumbers, telnyxGlobalPricing } from "@shared/schema";
import { eq, and, desc, sql, isNull, isNotNull, or } from "drizzle-orm";
import Decimal from "decimal.js";
import { PRICING } from "./pricing-config";

// Toll-free prefixes (US/Canada)
const TOLL_FREE_PREFIXES = ["1800", "1888", "1877", "1866", "1855", "1844", "1833"];

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

export interface RateLookupResult {
  ratePerMinute: Decimal;
  connectionFee: Decimal;
  minBillableSeconds: number;
  billingIncrement: number;
  prefix: string;
  description: string | null;
}

export interface CallCostResult {
  billableSeconds: number;
  billableMinutes: Decimal;
  ratePerMinute: Decimal;
  connectionFee: Decimal;
  totalCost: Decimal;
  prefix: string;
  description: string | null;
}

export interface ChargeCallResult {
  success: boolean;
  callLogId?: string;
  transactionId?: string;
  amountCharged?: string;
  newBalance?: string;
  error?: string;
  insufficientFunds?: boolean;
}

const DEFAULT_RATE: RateLookupResult = {
  ratePerMinute: new Decimal("0.0200"),
  connectionFee: new Decimal("0.0000"),
  minBillableSeconds: 6,
  billingIncrement: 6,
  prefix: "default",
  description: "Default Rate"
};

const MINIMUM_BALANCE_THRESHOLD = new Decimal("0.00");

/**
 * Check if a phone number is a toll-free number based on prefix
 */
function isTollFreeNumber(phoneNumber: string): boolean {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  return TOLL_FREE_PREFIXES.some(prefix => cleanNumber.startsWith(prefix));
}

/**
 * Determine the number type by looking up in telnyxNumbers table or checking prefix
 */
async function getNumberType(phoneNumber: string, companyId: string): Promise<"local" | "toll_free"> {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  const formattedNumber = cleanNumber.startsWith('1') ? `+${cleanNumber}` : `+1${cleanNumber}`;
  
  // First check if we have this number in our database with explicit type
  const [telnyxNumber] = await db
    .select({ numberType: telnyxPhoneNumbers.numberType })
    .from(telnyxPhoneNumbers)
    .where(and(
      eq(telnyxPhoneNumbers.companyId, companyId),
      eq(telnyxPhoneNumbers.phoneNumber, formattedNumber)
    ))
    .limit(1);
  
  if (telnyxNumber?.numberType) {
    return telnyxNumber.numberType;
  }
  
  // Fallback to prefix-based detection
  return isTollFreeNumber(phoneNumber) ? "toll_free" : "local";
}

/**
 * Get the voice rate from global pricing based on number type and direction
 * Rates are always fetched dynamically from telnyxGlobalPricing table
 */
async function getVoiceRate(
  companyId: string,
  numberType: "local" | "toll_free",
  direction: "inbound" | "outbound"
): Promise<{ rate: Decimal; description: string }> {
  // Get global pricing (first row, as there should be only one)
  const [pricing] = await db
    .select()
    .from(telnyxGlobalPricing)
    .limit(1);
  
  if (!pricing) {
    console.error("[PricingService] WARNING: No global pricing found in database! Using emergency fallback rates.");
    // Emergency fallback only if table is completely empty
    return {
      rate: new Decimal("0.0200"),
      description: `${numberType === "toll_free" ? "Toll-Free" : "Local"} ${direction === "outbound" ? "Outbound" : "Inbound"} (fallback)`
    };
  }
  
  let rate: string;
  let description: string;
  
  if (numberType === "toll_free") {
    if (direction === "outbound") {
      rate = pricing.voiceTollfreeOutbound;
      description = "Toll-Free Outbound";
    } else {
      rate = pricing.voiceTollfreeInbound;
      description = "Toll-Free Inbound";
    }
  } else {
    if (direction === "outbound") {
      rate = pricing.voiceLocalOutbound;
      description = "Local Outbound";
    } else {
      rate = pricing.voiceLocalInbound;
      description = "Local Inbound";
    }
  }
  
  console.log(`[PricingService] Loaded rate from DB: ${description} = $${rate}/min`);
  
  return {
    rate: new Decimal(rate),
    description
  };
}

export async function findRateByPrefix(destinationNumber: string, companyId?: string): Promise<RateLookupResult> {
  const cleanNumber = destinationNumber.replace(/\D/g, '');
  
  const prefixesToCheck: string[] = [];
  for (let i = cleanNumber.length; i >= 1; i--) {
    prefixesToCheck.push(cleanNumber.substring(0, i));
  }
  
  if (prefixesToCheck.length === 0) {
    console.log("[PricingService] No valid prefix to check, using default rate");
    return DEFAULT_RATE;
  }

  const rates = await db
    .select()
    .from(callRates)
    .where(
      and(
        sql`${callRates.prefix} IN (${sql.join(prefixesToCheck.map(p => sql`${p}`), sql`, `)})`,
        eq(callRates.isActive, true),
        companyId 
          ? or(eq(callRates.companyId, companyId), isNull(callRates.companyId))
          : isNull(callRates.companyId)
      )
    )
    .orderBy(desc(sql`LENGTH(${callRates.prefix})`));

  if (rates.length === 0) {
    console.log(`[PricingService] No rate found for ${cleanNumber}, using default`);
    return DEFAULT_RATE;
  }

  const companyRate = rates.find(r => r.companyId === companyId);
  const rate = companyRate || rates[0];

  console.log(`[PricingService] Found rate: prefix=${rate.prefix}, rate=${rate.ratePerMinute}/min`);
  
  return {
    ratePerMinute: new Decimal(rate.ratePerMinute),
    connectionFee: new Decimal(rate.connectionFee),
    minBillableSeconds: rate.minBillableSeconds,
    billingIncrement: rate.billingIncrement,
    prefix: rate.prefix,
    description: rate.description
  };
}

export function calculateCallCost(durationSeconds: number, rate: RateLookupResult): CallCostResult {
  const actualDuration = Math.max(0, durationSeconds);
  
  // BUSINESS RULE: Telnyx bills in 60-second (1 minute) increments, rounded UP
  // Math.ceil(61 / 60) = 2 minutes
  // Math.ceil(10 / 60) = 1 minute  
  // Math.ceil(0 / 60) = 0 minutes (no charge for unanswered)
  const billableMinutesInt = actualDuration > 0 ? Math.ceil(actualDuration / 60) : 0;
  const billableSeconds = billableMinutesInt * 60; // Store as seconds for DB
  
  const billableMinutes = new Decimal(billableMinutesInt);
  const callCost = billableMinutes.times(rate.ratePerMinute);
  const totalCost = callCost.plus(rate.connectionFee);

  console.log(`[PricingService] Cost calculation (60s increments):`);
  console.log(`  - Actual duration: ${actualDuration}s`);
  console.log(`  - Billable minutes: ${billableMinutesInt} (Math.ceil(${actualDuration}/60))`);
  console.log(`  - Rate per minute: $${rate.ratePerMinute.toFixed(4)}`);
  console.log(`  - Total cost: $${totalCost.toFixed(4)} USD`);

  return {
    billableSeconds,
    billableMinutes,
    ratePerMinute: rate.ratePerMinute,
    connectionFee: rate.connectionFee,
    totalCost,
    prefix: rate.prefix,
    description: rate.description
  };
}

export async function chargeCallToWallet(
  companyId: string,
  callData: {
    telnyxCallId: string;
    fromNumber: string;
    toNumber: string;
    direction: "inbound" | "outbound";
    durationSeconds: number;
    status: string;
    startedAt: Date;
    endedAt?: Date;
    providerCost?: number;
    userId?: string;
    contactId?: string;
    callerName?: string;
  }
): Promise<ChargeCallResult> {
  const startTime = Date.now();
  
  try {
    // Get telephony settings for recording/CNAM features
    const [settings] = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    
    const recordingEnabled = settings?.recordingEnabled ?? false;
    const cnamEnabled = settings?.cnamEnabled ?? false;
    
    // Determine OUR number (the one we own) to check if it's toll-free or local
    // For outbound calls: fromNumber is ours (we're calling from it)
    // For inbound calls: toNumber is ours (they're calling us)
    const ourNumber = callData.direction === "outbound" ? callData.fromNumber : callData.toNumber;
    const theirNumber = callData.direction === "outbound" ? callData.toNumber : callData.fromNumber;
    
    // Determine the number type (toll-free or local) based on OUR number
    const numberType = await getNumberType(ourNumber, companyId);
    
    // Get global pricing for voice rates and add-ons
    const [globalPricing] = await db
      .select()
      .from(telnyxGlobalPricing)
      .limit(1);
    
    if (!globalPricing) {
      console.error("[PricingService] WARNING: No global pricing found in database!");
    }
    
    // Get the correct rate based on number type and direction
    const voiceRateInfo = await getVoiceRate(companyId, numberType, callData.direction);
    
    console.log(`[PricingService] Rate lookup for ${callData.direction} call:`);
    console.log(`  - Our number: ${ourNumber} (${numberType})`);
    console.log(`  - Their number: ${theirNumber}`);
    console.log(`  - Rate type: ${voiceRateInfo.description}`);
    console.log(`  - Rate: $${voiceRateInfo.rate.toFixed(4)}/min`);
    
    // Create rate object for cost calculation
    const rate: RateLookupResult = {
      ratePerMinute: voiceRateInfo.rate,
      connectionFee: new Decimal(0),
      minBillableSeconds: 60,
      billingIncrement: 60,
      prefix: numberType === "toll_free" ? "toll-free" : "local",
      description: voiceRateInfo.description
    };
    
    const costResult = calculateCallCost(callData.durationSeconds, rate);
    
    // Calculate additional feature costs from database (dynamic pricing)
    const billableMinutes = costResult.billableMinutes;
    let callControlCost = new Decimal(0);
    let recordingCost = new Decimal(0);
    let cnamCost = new Decimal(0);
    
    // Call Control cost - ALWAYS charged for WebRTC/Call Control API calls
    const callControlRate = callData.direction === "inbound" 
      ? new Decimal(globalPricing?.callControlInbound || "0.0020")
      : new Decimal(globalPricing?.callControlOutbound || "0.0020");
    callControlCost = billableMinutes.times(callControlRate);
    console.log(`[PricingService] Call Control cost: $${callControlCost.toFixed(4)} (${billableMinutes.toFixed(2)} min * $${callControlRate.toFixed(4)}/min from DB)`);
    
    // Recording cost - loaded from database
    if (recordingEnabled) {
      const recordingRate = new Decimal(globalPricing?.recordingPerMinute || "0.0020");
      recordingCost = billableMinutes.times(recordingRate);
      console.log(`[PricingService] Recording cost: $${recordingCost.toFixed(4)} (${billableMinutes.toFixed(2)} min * $${recordingRate.toFixed(4)}/min from DB)`);
    }
    
    // CNAM lookup cost - loaded from database (only for inbound calls)
    if (cnamEnabled && callData.direction === "inbound") {
      cnamCost = new Decimal(globalPricing?.cnamLookup || "0.0045");
      console.log(`[PricingService] CNAM lookup cost: $${cnamCost.toFixed(4)} (from DB)`);
    }
    
    // Total cost includes base + call control + recording + CNAM
    const totalCostWithFeatures = costResult.totalCost.plus(callControlCost).plus(recordingCost).plus(cnamCost);
    console.log(`[PricingService] Total cost: $${totalCostWithFeatures.toFixed(4)} (base: $${costResult.totalCost.toFixed(4)}, callControl: $${callControlCost.toFixed(4)}, recording: $${recordingCost.toFixed(4)}, cnam: $${cnamCost.toFixed(4)})`);
    
    const result = await db.transaction(async (tx) => {
      // Find the right wallet in order of preference:
      // 1. User-specific wallet if userId provided
      // 2. Company owner's wallet (deterministic fallback)
      // 3. Any wallet for this company (last resort)
      let wallet;
      
      if (callData.userId) {
        // Find user-specific wallet
        const [userWallet] = await tx
          .select()
          .from(wallets)
          .where(and(
            eq(wallets.companyId, companyId),
            eq(wallets.ownerUserId, callData.userId)
          ))
          .for("update");
        wallet = userWallet;
      }
      
      if (!wallet) {
        // Find the company admin's wallet (deterministic - the first admin for this company)
        const [adminUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.companyId, companyId),
            eq(users.role, "admin")
          ))
          .orderBy(users.createdAt)
          .limit(1);
        
        if (adminUser?.id) {
          const [adminWallet] = await tx
            .select()
            .from(wallets)
            .where(and(
              eq(wallets.companyId, companyId),
              eq(wallets.ownerUserId, adminUser.id)
            ))
            .for("update");
          wallet = adminWallet;
        }
      }
      
      if (!wallet) {
        // Fallback: company-level wallet (ownerUserId IS NULL)
        const [companyWallet] = await tx
          .select()
          .from(wallets)
          .where(and(
            eq(wallets.companyId, companyId),
            isNull(wallets.ownerUserId)
          ))
          .for("update");
        wallet = companyWallet;
      }
      
      if (!wallet) {
        // Last resort: oldest user wallet (deterministic order by createdAt)
        const [oldestUserWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.companyId, companyId))
          .orderBy(wallets.createdAt)
          .limit(1)
          .for("update");
        wallet = oldestUserWallet;
      }
      
      if (!wallet) {
        throw new Error(`Wallet not found for company ${companyId}`);
      }
      
      console.log(`[PricingService] Using wallet ${wallet.id} (owner: ${wallet.ownerUserId || 'none'}, balance: ${wallet.balance})`);
      
      const currentBalance = new Decimal(wallet.balance);
      const newBalance = currentBalance.minus(totalCostWithFeatures);
      
      const [existingLog] = await tx
        .select()
        .from(callLogs)
        .where(and(
          eq(callLogs.telnyxCallId, callData.telnyxCallId),
          eq(callLogs.companyId, companyId)
        ));
      
      if (newBalance.lessThan(MINIMUM_BALANCE_THRESHOLD)) {
        console.error(`[PricingService] INSUFFICIENT FUNDS: current=$${currentBalance.toFixed(4)}, cost=$${totalCostWithFeatures.toFixed(4)}`);
        
        let failedLogId = existingLog?.id;
        if (existingLog) {
          await tx
            .update(callLogs)
            .set({
              status: "failed",
              duration: callData.durationSeconds,
              billedDuration: 0,
              cost: "0.0000",
              costCurrency: "USD",
              endedAt: callData.endedAt || new Date(),
            })
            .where(eq(callLogs.id, existingLog.id));
          console.log(`[PricingService] ATOMIC: Marked call log ${existingLog.id} as failed (insufficient funds)`);
        } else {
          const [newLog] = await tx
            .insert(callLogs)
            .values({
              companyId,
              userId: callData.userId,
              telnyxCallId: callData.telnyxCallId,
              fromNumber: callData.fromNumber,
              toNumber: callData.toNumber,
              direction: callData.direction,
              status: "failed",
              duration: callData.durationSeconds,
              billedDuration: 0,
              cost: "0.0000",
              costCurrency: "USD",
              contactId: callData.contactId,
              callerName: callData.callerName,
              startedAt: callData.startedAt,
              endedAt: callData.endedAt || new Date(),
            })
            .returning();
          failedLogId = newLog.id;
          console.log(`[PricingService] ATOMIC: Created failed call log ${newLog.id} (insufficient funds)`);
        }
        
        return {
          insufficientFunds: true,
          callLogId: failedLogId,
          currentBalance: currentBalance.toFixed(4)
        };
      }
      
      await tx
        .update(wallets)
        .set({ 
          balance: newBalance.toFixed(4),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));
      
      let callLog;
      if (existingLog) {
        [callLog] = await tx
          .update(callLogs)
          .set({
            status: callData.status as any,
            duration: callData.durationSeconds,
            billedDuration: costResult.billableSeconds,
            cost: totalCostWithFeatures.toFixed(4),
            costCurrency: "USD",
            endedAt: callData.endedAt || new Date(),
          })
          .where(eq(callLogs.id, existingLog.id))
          .returning();
        console.log(`[PricingService] Updated existing call log: ${callLog.id}`);
      } else {
        [callLog] = await tx
          .insert(callLogs)
          .values({
            companyId,
            userId: callData.userId,
            telnyxCallId: callData.telnyxCallId,
            fromNumber: callData.fromNumber,
            toNumber: callData.toNumber,
            direction: callData.direction,
            status: callData.status as any,
            duration: callData.durationSeconds,
            billedDuration: costResult.billableSeconds,
            cost: totalCostWithFeatures.toFixed(4),
            costCurrency: "USD",
            contactId: callData.contactId,
            callerName: callData.callerName,
            startedAt: callData.startedAt,
            endedAt: callData.endedAt || new Date(),
          })
          .returning();
        console.log(`[PricingService] Created new call log: ${callLog.id}`);
      }
      
      // Build description with rate type and feature costs
      const billableMinutesInt = costResult.billableSeconds / 60;
      const rateTypeLabel = rate.description || "Voice";
      let costBreakdown = `${callData.durationSeconds}s → ${billableMinutesInt}m @ $${rate.ratePerMinute.toFixed(4)}/min [${rateTypeLabel}]`;
      costBreakdown += ` +CC`; // Call Control is always charged
      if (recordingEnabled) costBreakdown += ` +rec`;
      if (cnamEnabled && callData.direction === "inbound") costBreakdown += ` +CNAM`;
      
      // For inbound: "Call from +caller", for outbound: "Call to +destination"
      const callParty = callData.direction === "inbound" ? callData.fromNumber : callData.toNumber;
      const callPrefix = callData.direction === "inbound" ? "Call from" : "Call to";
      
      const [transaction] = await tx
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          amount: totalCostWithFeatures.negated().toFixed(4),
          type: "CALL_COST",
          description: `${callPrefix} ${callParty} (${costBreakdown})`,
          externalReferenceId: callLog.id,
          balanceAfter: newBalance.toFixed(4),
        })
        .returning();
      
      return {
        callLogId: callLog.id,
        transactionId: transaction.id,
        amountCharged: totalCostWithFeatures.toFixed(4),
        newBalance: newBalance.toFixed(4)
      };
    });
    
    if ('insufficientFunds' in result && result.insufficientFunds) {
      return {
        success: false,
        insufficientFunds: true,
        callLogId: result.callLogId,
        error: `Insufficient funds. Balance: $${result.currentBalance}`
      };
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[PricingService] Call charged in ${elapsed}ms: $${result.amountCharged}, new balance: $${result.newBalance}`);
    
    return {
      success: true,
      callLogId: result.callLogId,
      transactionId: result.transactionId,
      amountCharged: result.amountCharged,
      newBalance: result.newBalance
    };
    
  } catch (error: any) {
    console.error("[PricingService] Failed to charge call:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function updateCallRecording(telnyxCallId: string, recordingUrl: string): Promise<boolean> {
  try {
    await db
      .update(callLogs)
      .set({ recordingUrl })
      .where(eq(callLogs.telnyxCallId, telnyxCallId));
    
    console.log(`[PricingService] Updated recording URL for call ${telnyxCallId}`);
    return true;
  } catch (error) {
    console.error("[PricingService] Failed to update recording:", error);
    return false;
  }
}

export async function seedDefaultRates(): Promise<void> {
  const existingRates = await db.select().from(callRates).limit(1);
  
  if (existingRates.length > 0) {
    console.log("[PricingService] Rates already exist, skipping seed");
    return;
  }
  
  const defaultRates = [
    { prefix: "1", ratePerMinute: "0.0200", description: "USA/Canada", country: "US" },
    { prefix: "1800", ratePerMinute: "0.0000", description: "USA Toll-Free", country: "US" },
    { prefix: "1888", ratePerMinute: "0.0000", description: "USA Toll-Free", country: "US" },
    { prefix: "1877", ratePerMinute: "0.0000", description: "USA Toll-Free", country: "US" },
    { prefix: "1866", ratePerMinute: "0.0000", description: "USA Toll-Free", country: "US" },
    { prefix: "52", ratePerMinute: "0.0350", description: "Mexico Landline", country: "MX" },
    { prefix: "521", ratePerMinute: "0.0450", description: "Mexico Mobile", country: "MX" },
    { prefix: "44", ratePerMinute: "0.0150", description: "United Kingdom", country: "GB" },
    { prefix: "34", ratePerMinute: "0.0250", description: "Spain", country: "ES" },
    { prefix: "49", ratePerMinute: "0.0200", description: "Germany", country: "DE" },
    { prefix: "33", ratePerMinute: "0.0200", description: "France", country: "FR" },
  ];
  
  for (const rate of defaultRates) {
    await db.insert(callRates).values({
      prefix: rate.prefix,
      ratePerMinute: rate.ratePerMinute,
      connectionFee: "0.0000",
      minBillableSeconds: 6,
      billingIncrement: 6,
      description: rate.description,
      country: rate.country,
      isActive: true,
    });
  }
  
  console.log(`[PricingService] Seeded ${defaultRates.length} default rates`);
}
