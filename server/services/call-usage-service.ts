import { db } from "../db";
import { callUsageItems, callLogs, wallets, walletTransactions, telnyxGlobalPricing, CallUsageType } from "@shared/schema";
import { eq } from "drizzle-orm";
import Decimal from "decimal.js";
import { broadcastWalletUpdate } from "../websocket";

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

export interface UsageItem {
  usageType: CallUsageType;
  description: string;
  quantity: number;
  unit: string;
  ratePerUnit: Decimal;
  cost: Decimal;
  metadata?: Record<string, any>;
}

export interface ChargeResult {
  success: boolean;
  totalCharged: Decimal;
  newBalance?: Decimal;
  items: UsageItem[];
  transactionId?: string;
  error?: string;
  insufficientFunds?: boolean;
}

const TOLL_FREE_PREFIXES = ["1800", "1888", "1877", "1866", "1855", "1844", "1833"];

function isTollFreeNumber(phoneNumber: string): boolean {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  return TOLL_FREE_PREFIXES.some(prefix => cleanNumber.startsWith(prefix));
}

async function getGlobalPricing() {
  const [pricing] = await db.select().from(telnyxGlobalPricing).limit(1);
  return pricing || {
    voiceLocalInbound: "0.0100",
    voiceLocalOutbound: "0.0100",
    voiceTollfreeInbound: "0.0130",
    voiceTollfreeOutbound: "0.0100",
    callControlInbound: "0.0020",
    callControlOutbound: "0.0020",
    recordingPerMinute: "0.0020",
    cnamLookup: "0.0100",
    callForwardingPerMinute: "0.0100"
  };
}

export class CallUsageCollector {
  private items: UsageItem[] = [];
  private companyId: string;
  private callLogId: string;

  constructor(companyId: string, callLogId: string) {
    this.companyId = companyId;
    this.callLogId = callLogId;
  }

  async addVoiceUsage(
    direction: "inbound" | "outbound",
    fromNumber: string,
    toNumber: string,
    durationSeconds: number
  ): Promise<void> {
    if (durationSeconds <= 0) return;

    const pricing = await getGlobalPricing();
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    
    const relevantNumber = direction === "inbound" ? toNumber : fromNumber;
    const isTollFree = isTollFreeNumber(relevantNumber);
    
    let ratePerMinute: string;
    let usageType: CallUsageType;
    let description: string;
    
    if (isTollFree) {
      if (direction === "inbound") {
        ratePerMinute = pricing.voiceTollfreeInbound || "0.0130";
        usageType = "toll_free_inbound";
        description = "Toll-Free Inbound Voice";
      } else {
        ratePerMinute = pricing.voiceTollfreeOutbound || "0.0100";
        usageType = "toll_free_outbound";
        description = "Toll-Free Outbound Voice";
      }
    } else {
      if (direction === "inbound") {
        ratePerMinute = pricing.voiceLocalInbound || "0.0100";
        usageType = "local_inbound";
        description = "Local Inbound Voice";
      } else {
        ratePerMinute = pricing.voiceLocalOutbound || "0.0100";
        usageType = "local_outbound";
        description = "Local Outbound Voice";
      }
    }

    const rate = new Decimal(ratePerMinute);
    const cost = rate.times(minutes);

    this.items.push({
      usageType,
      description: `${description} (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit: rate,
      cost,
      metadata: { from: fromNumber, to: toNumber, durationSeconds }
    });

    console.log(`[CallUsage] Added ${usageType}: ${minutes} min @ $${rate}/min = $${cost.toFixed(4)}`);
  }

  async addCallControl(direction: "inbound" | "outbound", durationSeconds: number): Promise<void> {
    if (durationSeconds <= 0) return;

    const pricing = await getGlobalPricing();
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const rateStr = direction === "inbound" 
      ? (pricing.callControlInbound || "0.0020")
      : (pricing.callControlOutbound || "0.0020");
    const rate = new Decimal(rateStr);
    const cost = rate.times(minutes);

    this.items.push({
      usageType: "call_control",
      description: `Call Control (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit: rate,
      cost
    });

    console.log(`[CallUsage] Added call_control: ${minutes} min @ $${rate}/min = $${cost.toFixed(4)}`);
  }

  async addRecording(durationSeconds: number): Promise<void> {
    if (durationSeconds <= 0) return;

    const pricing = await getGlobalPricing();
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const rate = new Decimal(pricing.recordingPerMinute || "0.0020");
    const cost = rate.times(minutes);

    this.items.push({
      usageType: "recording",
      description: `Call Recording (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit: rate,
      cost
    });

    console.log(`[CallUsage] Added recording: ${minutes} min @ $${rate}/min = $${cost.toFixed(4)}`);
  }

  async addCnamLookup(): Promise<void> {
    const pricing = await getGlobalPricing();
    const rate = new Decimal(pricing.cnamLookup || "0.0100");

    this.items.push({
      usageType: "cnam_lookup",
      description: "CNAM Lookup",
      quantity: 1,
      unit: "lookup",
      ratePerUnit: rate,
      cost: rate
    });

    console.log(`[CallUsage] Added cnam_lookup: 1 @ $${rate}/lookup = $${rate.toFixed(4)}`);
  }

  addVoicemail(durationSeconds: number): void {
    if (durationSeconds <= 0) return;

    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const rate = new Decimal("0.0020");
    const cost = rate.times(minutes);

    this.items.push({
      usageType: "voicemail",
      description: `Voicemail Storage (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit: rate,
      cost
    });

    console.log(`[CallUsage] Added voicemail: ${minutes} min @ $${rate}/min = $${cost.toFixed(4)}`);
  }

  addIvrUsage(interactionCount: number): void {
    if (interactionCount <= 0) return;

    const rate = new Decimal("0.0010");
    const cost = rate.times(interactionCount);

    this.items.push({
      usageType: "ivr",
      description: `IVR Interactions (${interactionCount})`,
      quantity: interactionCount,
      unit: "interaction",
      ratePerUnit: rate,
      cost
    });

    console.log(`[CallUsage] Added ivr: ${interactionCount} @ $${rate}/interaction = $${cost.toFixed(4)}`);
  }

  async addCallForwarding(
    direction: "inbound" | "outbound",
    durationSeconds: number
  ): Promise<void> {
    if (durationSeconds <= 0) return;

    const pricing = await getGlobalPricing();
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const rate = new Decimal(pricing.callForwardingPerMinute || "0.0100");
    const cost = rate.times(minutes);
    
    const usageType: CallUsageType = direction === "inbound" 
      ? "call_forwarding_inbound" 
      : "call_forwarding_outbound";

    this.items.push({
      usageType,
      description: `Call Forwarding ${direction === "inbound" ? "Inbound" : "Outbound"} (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit: rate,
      cost
    });

    console.log(`[CallUsage] Added ${usageType}: ${minutes} min @ $${rate}/min = $${cost.toFixed(4)}`);
  }

  getItems(): UsageItem[] {
    return this.items;
  }

  getTotalCost(): Decimal {
    return this.items.reduce((sum, item) => sum.plus(item.cost), new Decimal(0));
  }

  async chargeToWallet(userId?: string): Promise<ChargeResult> {
    if (this.items.length === 0) {
      return { success: true, totalCharged: new Decimal(0), items: [] };
    }

    const totalCost = this.getTotalCost();
    
    console.log(`[CallUsage] Charging ${this.items.length} items, total: $${totalCost.toFixed(4)}`);

    try {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.companyId, this.companyId));

      if (!wallet) {
        return { 
          success: false, 
          totalCharged: new Decimal(0), 
          items: this.items,
          error: "Wallet not found" 
        };
      }

      const currentBalance = new Decimal(wallet.balance);
      if (currentBalance.lessThan(totalCost)) {
        return {
          success: false,
          totalCharged: new Decimal(0),
          items: this.items,
          error: `Insufficient funds. Required: $${totalCost.toFixed(4)}, Available: $${currentBalance.toFixed(4)}`,
          insufficientFunds: true
        };
      }

      const newBalance = currentBalance.minus(totalCost);
      const itemDescriptions = this.items.map(i => i.description).join(", ");

      const [transaction] = await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          type: "CALL_COST",
          amount: totalCost.negated().toFixed(4),
          balanceAfter: newBalance.toFixed(4),
          description: `Call usage: ${itemDescriptions}`,
          externalReferenceId: this.callLogId
        })
        .returning();

      await db
        .update(wallets)
        .set({ 
          balance: newBalance.toFixed(4),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      for (const item of this.items) {
        await db.insert(callUsageItems).values({
          callLogId: this.callLogId,
          companyId: this.companyId,
          usageType: item.usageType,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          ratePerUnit: item.ratePerUnit.toFixed(4),
          cost: item.cost.toFixed(4),
          currency: "USD",
          walletTransactionId: transaction.id,
          metadata: item.metadata || null
        });
      }

      await db
        .update(callLogs)
        .set({ 
          cost: totalCost.toFixed(4),
          costCurrency: "USD"
        })
        .where(eq(callLogs.id, this.callLogId));

      broadcastWalletUpdate(this.companyId, {
        newBalance: newBalance.toFixed(4),
        lastCharge: totalCost.toFixed(4),
        chargeType: "CALL_COST",
        description: `Call charges: $${totalCost.toFixed(4)}`
      });

      console.log(`[CallUsage] Successfully charged $${totalCost.toFixed(4)}, new balance: $${newBalance.toFixed(4)}`);

      return {
        success: true,
        totalCharged: totalCost,
        newBalance,
        items: this.items,
        transactionId: transaction.id
      };

    } catch (error: any) {
      console.error("[CallUsage] Error charging wallet:", error);
      return {
        success: false,
        totalCharged: new Decimal(0),
        items: this.items,
        error: error.message
      };
    }
  }
}

export async function chargeCallUsage(
  companyId: string,
  callLogId: string,
  options: {
    direction: "inbound" | "outbound";
    fromNumber: string;
    toNumber: string;
    durationSeconds: number;
    recordingDurationSeconds?: number;
    hadCnamLookup?: boolean;
    voicemailDurationSeconds?: number;
    ivrInteractionCount?: number;
    callForwardingDurationSeconds?: number;
    userId?: string;
  }
): Promise<ChargeResult> {
  const collector = new CallUsageCollector(companyId, callLogId);

  await collector.addVoiceUsage(
    options.direction,
    options.fromNumber,
    options.toNumber,
    options.durationSeconds
  );

  await collector.addCallControl(options.direction, options.durationSeconds);

  if (options.recordingDurationSeconds && options.recordingDurationSeconds > 0) {
    await collector.addRecording(options.recordingDurationSeconds);
  }

  if (options.hadCnamLookup) {
    await collector.addCnamLookup();
  }

  if (options.voicemailDurationSeconds && options.voicemailDurationSeconds > 0) {
    collector.addVoicemail(options.voicemailDurationSeconds);
  }

  if (options.ivrInteractionCount && options.ivrInteractionCount > 0) {
    collector.addIvrUsage(options.ivrInteractionCount);
  }

  if (options.callForwardingDurationSeconds && options.callForwardingDurationSeconds > 0) {
    // Call forwarding inherits the main call direction for accurate billing
    await collector.addCallForwarding(options.direction, options.callForwardingDurationSeconds);
  }

  return collector.chargeToWallet(options.userId);
}

export async function getCallUsageBreakdown(callLogId: string): Promise<{
  items: Array<{
    usageType: string;
    description: string;
    quantity: number;
    unit: string;
    ratePerUnit: string;
    cost: string;
  }>;
  totalCost: string;
}> {
  const items = await db
    .select()
    .from(callUsageItems)
    .where(eq(callUsageItems.callLogId, callLogId));

  const totalCost = items.reduce(
    (sum, item) => new Decimal(sum).plus(item.cost).toString(),
    "0"
  );

  return {
    items: items.map(item => ({
      usageType: item.usageType,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      ratePerUnit: item.ratePerUnit,
      cost: item.cost
    })),
    totalCost
  };
}
