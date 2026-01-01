import { db } from "../db";
import { callRates, wallets, walletTransactions, callLogs, telephonySettings, users } from "@shared/schema";
import { eq, and, desc, sql, isNull, isNotNull, or } from "drizzle-orm";
import Decimal from "decimal.js";
import { PRICING } from "./pricing-config";

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
    
    // For inbound calls, use fromNumber (where the call originated)
    // For outbound calls, use toNumber (the destination being called)
    const rateNumber = callData.direction === "inbound" ? callData.fromNumber : callData.toNumber;
    console.log(`[PricingService] Rate lookup for ${callData.direction} call using number: ${rateNumber}`);
    
    const rate = await findRateByPrefix(rateNumber, companyId);
    const costResult = calculateCallCost(callData.durationSeconds, rate);
    
    // Calculate additional feature costs
    const billableMinutes = costResult.billableMinutes;
    let recordingCost = new Decimal(0);
    let cnamCost = new Decimal(0);
    
    if (recordingEnabled) {
      recordingCost = billableMinutes.times(new Decimal(PRICING.usage.recording_minute));
      console.log(`[PricingService] Recording cost: $${recordingCost.toFixed(4)} (${billableMinutes.toFixed(2)} min * $${PRICING.usage.recording_minute}/min)`);
    }
    
    if (cnamEnabled && callData.direction === "inbound") {
      cnamCost = new Decimal(PRICING.usage.cnam_lookup_per_call);
      console.log(`[PricingService] CNAM lookup cost: $${cnamCost.toFixed(4)}`);
    }
    
    // Total cost includes base + recording + CNAM
    const totalCostWithFeatures = costResult.totalCost.plus(recordingCost).plus(cnamCost);
    console.log(`[PricingService] Total cost: $${totalCostWithFeatures.toFixed(4)} (base: $${costResult.totalCost.toFixed(4)}, recording: $${recordingCost.toFixed(4)}, cnam: $${cnamCost.toFixed(4)})`);
    
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
      
      // Build description with feature costs if applicable
      const billableMinutesInt = costResult.billableSeconds / 60;
      let costBreakdown = `${callData.durationSeconds}s actual → ${billableMinutesInt} min billed @ $${rate.ratePerMinute.toFixed(4)}/min`;
      if (recordingEnabled) costBreakdown += ` + recording`;
      if (cnamEnabled && callData.direction === "inbound") costBreakdown += ` + CNAM`;
      
      const [transaction] = await tx
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          amount: totalCostWithFeatures.negated().toFixed(4),
          type: "CALL_COST",
          description: `Call to ${callData.toNumber} (${costBreakdown})`,
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
