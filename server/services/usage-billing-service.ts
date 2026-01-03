import { db } from "../db";
import { usageItems, callLogs, wallets, walletTransactions, telnyxGlobalPricing, UsageType, UsageResourceType, callUsageItems, CallUsageType } from "@shared/schema";
import { eq } from "drizzle-orm";
import Decimal from "decimal.js";
import { broadcastWalletUpdate } from "../websocket";

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

export interface BillingItem {
  resourceType: UsageResourceType;
  usageType: UsageType;
  description: string;
  quantity: number;
  unit: string;
  ratePerUnit: Decimal;
  costPerUnit?: Decimal;
  totalPrice: Decimal;
  totalCost?: Decimal;
  metadata?: Record<string, any>;
}

export interface ChargeResult {
  success: boolean;
  totalCharged: Decimal;
  newBalance?: Decimal;
  items: BillingItem[];
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
    voiceLocalInbound: "0.0080",
    voiceLocalOutbound: "0.0100",
    voiceTollfreeInbound: "0.0130",
    voiceTollfreeOutbound: "0.0180",
    voiceLocalInboundCost: "0.0035",
    voiceLocalOutboundCost: "0.0047",
    voiceTollfreeInboundCost: "0.0060",
    voiceTollfreeOutboundCost: "0.0047",
    smsLongcodeOutbound: "0.0060",
    smsLongcodeInbound: "0.0060",
    smsTollfreeOutbound: "0.0070",
    smsTollfreeInbound: "0.0070",
    smsLongcodeOutboundCost: "0.0040",
    smsLongcodeInboundCost: "0.0040",
    smsTollfreeOutboundCost: "0.0040",
    smsTollfreeInboundCost: "0.0040",
    callControlInbound: "0.0020",
    callControlOutbound: "0.0020",
    callControlInboundCost: "0.0010",
    callControlOutboundCost: "0.0010",
    recordingPerMinute: "0.0020",
    recordingPerMinuteCost: "0.0010",
    cnamLookup: "0.0045",
    cnamLookupCost: "0.0025",
    callForwardingPerMinute: "0.0100",
    callForwardingPerMinuteCost: "0.0047",
    didLocal: "1.00",
    didTollfree: "1.50",
    didLocalCost: "0.50",
    didTollfreeCost: "0.75",
    e911Address: "2.00",
    e911AddressCost: "1.50",
    unregisteredE911: "100.00",
    unregisteredE911Cost: "100.00",
    portOutFee: "10.00",
    portOutFeeCost: "6.00"
  };
}

export class UsageCollector {
  private items: BillingItem[] = [];
  private companyId: string;
  private callLogId?: string;
  private messageId?: string;
  private didId?: string;

  constructor(
    companyId: string,
    options?: {
      callLogId?: string;
      messageId?: string;
      didId?: string;
    }
  ) {
    this.companyId = companyId;
    this.callLogId = options?.callLogId;
    this.messageId = options?.messageId;
    this.didId = options?.didId;
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
    
    let price: string;
    let cost: string;
    let usageType: UsageType;
    let description: string;
    
    if (isTollFree) {
      if (direction === "inbound") {
        price = pricing.voiceTollfreeInbound || "0.0130";
        cost = pricing.voiceTollfreeInboundCost || "0.0060";
        usageType = "voice_tollfree_inbound";
        description = "Toll-Free Inbound Voice";
      } else {
        price = pricing.voiceTollfreeOutbound || "0.0180";
        cost = pricing.voiceTollfreeOutboundCost || "0.0047";
        usageType = "voice_tollfree_outbound";
        description = "Toll-Free Outbound Voice";
      }
    } else {
      if (direction === "inbound") {
        price = pricing.voiceLocalInbound || "0.0080";
        cost = pricing.voiceLocalInboundCost || "0.0035";
        usageType = "voice_local_inbound";
        description = "Local Inbound Voice";
      } else {
        price = pricing.voiceLocalOutbound || "0.0100";
        cost = pricing.voiceLocalOutboundCost || "0.0047";
        usageType = "voice_local_outbound";
        description = "Local Outbound Voice";
      }
    }

    const ratePerUnit = new Decimal(price);
    const costPerUnit = new Decimal(cost);
    const totalPrice = ratePerUnit.times(minutes);
    const totalCost = costPerUnit.times(minutes);

    this.items.push({
      resourceType: "call",
      usageType,
      description: `${description} (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost,
      metadata: { from: fromNumber, to: toNumber, durationSeconds }
    });

    console.log(`[UsageBilling] Added ${usageType}: ${minutes} min @ $${ratePerUnit}/min = $${totalPrice.toFixed(4)}`);
  }

  async addCallControl(direction: "inbound" | "outbound", durationSeconds: number): Promise<void> {
    if (durationSeconds <= 0) return;

    const pricing = await getGlobalPricing();
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const priceStr = direction === "inbound" 
      ? (pricing.callControlInbound || "0.0020")
      : (pricing.callControlOutbound || "0.0020");
    const costStr = direction === "inbound"
      ? (pricing.callControlInboundCost || "0.0010")
      : (pricing.callControlOutboundCost || "0.0010");
    
    const ratePerUnit = new Decimal(priceStr);
    const costPerUnit = new Decimal(costStr);
    const totalPrice = ratePerUnit.times(minutes);
    const totalCost = costPerUnit.times(minutes);
    const usageType: UsageType = direction === "inbound" ? "call_control_inbound" : "call_control_outbound";

    this.items.push({
      resourceType: "call",
      usageType,
      description: `Call Control ${direction === "inbound" ? "Inbound" : "Outbound"} (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added ${usageType}: ${minutes} min @ $${ratePerUnit}/min = $${totalPrice.toFixed(4)}`);
  }

  async addRecording(durationSeconds: number): Promise<void> {
    if (durationSeconds <= 0) return;

    const pricing = await getGlobalPricing();
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const ratePerUnit = new Decimal(pricing.recordingPerMinute || "0.0020");
    const costPerUnit = new Decimal(pricing.recordingPerMinuteCost || "0.0010");
    const totalPrice = ratePerUnit.times(minutes);
    const totalCost = costPerUnit.times(minutes);

    this.items.push({
      resourceType: "recording",
      usageType: "recording",
      description: `Call Recording (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added recording: ${minutes} min @ $${ratePerUnit}/min = $${totalPrice.toFixed(4)}`);
  }

  async addCnamLookup(): Promise<void> {
    const pricing = await getGlobalPricing();
    const ratePerUnit = new Decimal(pricing.cnamLookup || "0.0045");
    const costPerUnit = new Decimal(pricing.cnamLookupCost || "0.0025");

    this.items.push({
      resourceType: "lookup",
      usageType: "cnam_lookup",
      description: "CNAM Lookup",
      quantity: 1,
      unit: "lookup",
      ratePerUnit,
      costPerUnit,
      totalPrice: ratePerUnit,
      totalCost: costPerUnit
    });

    console.log(`[UsageBilling] Added cnam_lookup: 1 @ $${ratePerUnit}/lookup = $${ratePerUnit.toFixed(4)}`);
  }

  addVoicemail(durationSeconds: number): void {
    if (durationSeconds <= 0) return;

    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const ratePerUnit = new Decimal("0.0020");
    const costPerUnit = new Decimal("0.0010");
    const totalPrice = ratePerUnit.times(minutes);
    const totalCost = costPerUnit.times(minutes);

    this.items.push({
      resourceType: "call",
      usageType: "voicemail",
      description: `Voicemail Storage (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added voicemail: ${minutes} min @ $${ratePerUnit}/min = $${totalPrice.toFixed(4)}`);
  }

  addIvrUsage(interactionCount: number): void {
    if (interactionCount <= 0) return;

    const ratePerUnit = new Decimal("0.0010");
    const costPerUnit = new Decimal("0.0005");
    const totalPrice = ratePerUnit.times(interactionCount);
    const totalCost = costPerUnit.times(interactionCount);

    this.items.push({
      resourceType: "call",
      usageType: "ivr",
      description: `IVR Interactions (${interactionCount})`,
      quantity: interactionCount,
      unit: "interaction",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added ivr: ${interactionCount} @ $${ratePerUnit}/interaction = $${totalPrice.toFixed(4)}`);
  }

  async addCallForwarding(
    direction: "inbound" | "outbound",
    durationSeconds: number
  ): Promise<void> {
    if (durationSeconds <= 0) return;

    const pricing = await getGlobalPricing();
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const ratePerUnit = new Decimal(pricing.callForwardingPerMinute || "0.0100");
    const costPerUnit = new Decimal(pricing.callForwardingPerMinuteCost || "0.0047");
    const totalPrice = ratePerUnit.times(minutes);
    const totalCost = costPerUnit.times(minutes);
    
    const usageType: UsageType = direction === "inbound" 
      ? "call_forwarding_inbound" 
      : "call_forwarding_outbound";

    this.items.push({
      resourceType: "call",
      usageType,
      description: `Call Forwarding ${direction === "inbound" ? "Inbound" : "Outbound"} (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added ${usageType}: ${minutes} min @ $${ratePerUnit}/min = $${totalPrice.toFixed(4)}`);
  }

  async addSmsUsage(
    direction: "inbound" | "outbound",
    isTollFree: boolean = false,
    messageCount: number = 1
  ): Promise<void> {
    if (messageCount <= 0) return;

    const pricing = await getGlobalPricing();
    let price: string;
    let cost: string;
    let usageType: UsageType;
    let description: string;

    if (isTollFree) {
      if (direction === "inbound") {
        price = pricing.smsTollfreeInbound || "0.0070";
        cost = pricing.smsTollfreeInboundCost || "0.0040";
        usageType = "sms_tollfree_inbound";
        description = "Toll-Free SMS Inbound";
      } else {
        price = pricing.smsTollfreeOutbound || "0.0070";
        cost = pricing.smsTollfreeOutboundCost || "0.0040";
        usageType = "sms_tollfree_outbound";
        description = "Toll-Free SMS Outbound";
      }
    } else {
      if (direction === "inbound") {
        price = pricing.smsLongcodeInbound || "0.0060";
        cost = pricing.smsLongcodeInboundCost || "0.0040";
        usageType = "sms_longcode_inbound";
        description = "Long-Code SMS Inbound";
      } else {
        price = pricing.smsLongcodeOutbound || "0.0060";
        cost = pricing.smsLongcodeOutboundCost || "0.0040";
        usageType = "sms_longcode_outbound";
        description = "Long-Code SMS Outbound";
      }
    }

    const ratePerUnit = new Decimal(price);
    const costPerUnit = new Decimal(cost);
    const totalPrice = ratePerUnit.times(messageCount);
    const totalCost = costPerUnit.times(messageCount);

    this.items.push({
      resourceType: "sms",
      usageType,
      description: `${description} (${messageCount} msg)`,
      quantity: messageCount,
      unit: "message",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added ${usageType}: ${messageCount} msg @ $${ratePerUnit}/msg = $${totalPrice.toFixed(4)}`);
  }

  async addMmsUsage(
    direction: "inbound" | "outbound",
    isTollFree: boolean = false,
    messageCount: number = 1
  ): Promise<void> {
    if (messageCount <= 0) return;

    const pricing = await getGlobalPricing();
    let usageType: UsageType;
    let description: string;
    const mmsMultiplier = 3;

    if (isTollFree) {
      if (direction === "inbound") {
        usageType = "mms_tollfree_inbound";
        description = "Toll-Free MMS Inbound";
      } else {
        usageType = "mms_tollfree_outbound";
        description = "Toll-Free MMS Outbound";
      }
    } else {
      if (direction === "inbound") {
        usageType = "mms_longcode_inbound";
        description = "Long-Code MMS Inbound";
      } else {
        usageType = "mms_longcode_outbound";
        description = "Long-Code MMS Outbound";
      }
    }

    const baseSmsPrice = isTollFree 
      ? new Decimal(pricing.smsTollfreeOutbound || "0.0070")
      : new Decimal(pricing.smsLongcodeOutbound || "0.0060");
    const baseSmsCost = isTollFree
      ? new Decimal(pricing.smsTollfreeOutboundCost || "0.0040")
      : new Decimal(pricing.smsLongcodeOutboundCost || "0.0040");
    
    const ratePerUnit = baseSmsPrice.times(mmsMultiplier);
    const costPerUnit = baseSmsCost.times(mmsMultiplier);
    const totalPrice = ratePerUnit.times(messageCount);
    const totalCost = costPerUnit.times(messageCount);

    this.items.push({
      resourceType: "mms",
      usageType,
      description: `${description} (${messageCount} msg)`,
      quantity: messageCount,
      unit: "message",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added ${usageType}: ${messageCount} msg @ $${ratePerUnit}/msg = $${totalPrice.toFixed(4)}`);
  }

  async addDidCharge(type: "local" | "tollfree", count: number = 1): Promise<void> {
    if (count <= 0) return;

    const pricing = await getGlobalPricing();
    const isLocal = type === "local";
    const price = isLocal ? (pricing.didLocal || "1.00") : (pricing.didTollfree || "1.50");
    const cost = isLocal ? (pricing.didLocalCost || "0.50") : (pricing.didTollfreeCost || "0.75");
    const usageType: UsageType = isLocal ? "did_local_monthly" : "did_tollfree_monthly";
    const description = isLocal ? "Local DID Monthly Fee" : "Toll-Free DID Monthly Fee";

    const ratePerUnit = new Decimal(price);
    const costPerUnit = new Decimal(cost);
    const totalPrice = ratePerUnit.times(count);
    const totalCost = costPerUnit.times(count);

    this.items.push({
      resourceType: "did",
      usageType,
      description: `${description} (${count} number${count > 1 ? 's' : ''})`,
      quantity: count,
      unit: "month",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added ${usageType}: ${count} @ $${ratePerUnit}/month = $${totalPrice.toFixed(2)}`);
  }

  async addE911Charge(type: "address" | "unregistered", count: number = 1): Promise<void> {
    if (count <= 0) return;

    const pricing = await getGlobalPricing();
    const isAddress = type === "address";
    const price = isAddress ? (pricing.e911Address || "2.00") : (pricing.unregisteredE911 || "100.00");
    const cost = isAddress ? (pricing.e911AddressCost || "1.50") : (pricing.unregisteredE911Cost || "100.00");
    const usageType: UsageType = isAddress ? "e911_address" : "unregistered_e911";
    const description = isAddress ? "E911 Address Registration" : "Unregistered E911 Fee";

    const ratePerUnit = new Decimal(price);
    const costPerUnit = new Decimal(cost);
    const totalPrice = ratePerUnit.times(count);
    const totalCost = costPerUnit.times(count);

    this.items.push({
      resourceType: "e911",
      usageType,
      description: `${description}`,
      quantity: count,
      unit: "unit",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added ${usageType}: ${count} @ $${ratePerUnit}/unit = $${totalPrice.toFixed(2)}`);
  }

  async addPortOutFee(count: number = 1): Promise<void> {
    if (count <= 0) return;

    const pricing = await getGlobalPricing();
    const price = pricing.portOutFee || "10.00";
    const cost = pricing.portOutFeeCost || "6.00";

    const ratePerUnit = new Decimal(price);
    const costPerUnit = new Decimal(cost);
    const totalPrice = ratePerUnit.times(count);
    const totalCost = costPerUnit.times(count);

    this.items.push({
      resourceType: "port",
      usageType: "port_out_fee",
      description: `Port Out Fee (${count} number${count > 1 ? 's' : ''})`,
      quantity: count,
      unit: "unit",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added port_out_fee: ${count} @ $${ratePerUnit}/unit = $${totalPrice.toFixed(2)}`);
  }

  addTranscription(durationSeconds: number): void {
    if (durationSeconds <= 0) return;

    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const ratePerUnit = new Decimal("0.0100");
    const costPerUnit = new Decimal("0.0050");
    const totalPrice = ratePerUnit.times(minutes);
    const totalCost = costPerUnit.times(minutes);

    this.items.push({
      resourceType: "call",
      usageType: "transcription",
      description: `Call Transcription (${minutes} min)`,
      quantity: minutes,
      unit: "minute",
      ratePerUnit,
      costPerUnit,
      totalPrice,
      totalCost
    });

    console.log(`[UsageBilling] Added transcription: ${minutes} min @ $${ratePerUnit}/min = $${totalPrice.toFixed(4)}`);
  }

  getItems(): BillingItem[] {
    return this.items;
  }

  getTotalPrice(): Decimal {
    return this.items.reduce((sum, item) => sum.plus(item.totalPrice), new Decimal(0));
  }

  getTotalCost(): Decimal {
    return this.items.reduce((sum, item) => sum.plus(item.totalCost || new Decimal(0)), new Decimal(0));
  }

  async chargeToWallet(transactionType: string = "USAGE_CHARGE"): Promise<ChargeResult> {
    if (this.items.length === 0) {
      return { success: true, totalCharged: new Decimal(0), items: [] };
    }

    const totalPrice = this.getTotalPrice();
    
    console.log(`[UsageBilling] Charging ${this.items.length} items, total: $${totalPrice.toFixed(4)}`);

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
      if (currentBalance.lessThan(totalPrice)) {
        return {
          success: false,
          totalCharged: new Decimal(0),
          items: this.items,
          error: `Insufficient funds. Required: $${totalPrice.toFixed(4)}, Available: $${currentBalance.toFixed(4)}`,
          insufficientFunds: true
        };
      }

      const newBalance = currentBalance.minus(totalPrice);
      const itemDescriptions = this.items.map(i => i.description).join(", ");

      const [transaction] = await db
        .insert(walletTransactions)
        .values({
          walletId: wallet.id,
          type: transactionType as any,
          amount: totalPrice.negated().toFixed(4),
          balanceAfter: newBalance.toFixed(4),
          description: `Usage: ${itemDescriptions}`,
          externalReferenceId: this.callLogId || this.messageId || this.didId
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
        await db.insert(usageItems).values({
          companyId: this.companyId,
          resourceType: item.resourceType,
          callLogId: this.callLogId,
          messageId: this.messageId,
          didId: this.didId,
          usageType: item.usageType,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          ratePerUnit: item.ratePerUnit.toFixed(4),
          costPerUnit: item.costPerUnit?.toFixed(4),
          totalPrice: item.totalPrice.toFixed(4),
          totalCost: item.totalCost?.toFixed(4),
          currency: "USD",
          walletTransactionId: transaction.id,
          metadata: item.metadata || null
        });
      }

      if (this.callLogId) {
        await db
          .update(callLogs)
          .set({ 
            cost: totalPrice.toFixed(4),
            costCurrency: "USD"
          })
          .where(eq(callLogs.id, this.callLogId));
      }

      broadcastWalletUpdate(this.companyId, {
        newBalance: newBalance.toFixed(4),
        lastCharge: totalPrice.toFixed(4),
        chargeType: transactionType,
        description: `Usage charges: $${totalPrice.toFixed(4)}`
      });

      console.log(`[UsageBilling] Successfully charged $${totalPrice.toFixed(4)}, new balance: $${newBalance.toFixed(4)}`);

      return {
        success: true,
        totalCharged: totalPrice,
        newBalance,
        items: this.items,
        transactionId: transaction.id
      };

    } catch (error: any) {
      console.error("[UsageBilling] Error charging wallet:", error);
      return {
        success: false,
        totalCharged: new Decimal(0),
        items: this.items,
        error: error.message
      };
    }
  }
}

export class CallUsageCollector extends UsageCollector {
  constructor(companyId: string, callLogId: string) {
    super(companyId, { callLogId });
  }

  async chargeToWallet(): Promise<ChargeResult> {
    return super.chargeToWallet("CALL_COST");
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
    await collector.addCallForwarding(options.direction, options.callForwardingDurationSeconds);
  }

  return collector.chargeToWallet();
}

export async function chargeSmsUsage(
  companyId: string,
  messageId: string,
  options: {
    direction: "inbound" | "outbound";
    isTollFree?: boolean;
    messageCount?: number;
  }
): Promise<ChargeResult> {
  const collector = new UsageCollector(companyId, { messageId });
  await collector.addSmsUsage(
    options.direction,
    options.isTollFree || false,
    options.messageCount || 1
  );
  return collector.chargeToWallet("SMS_COST");
}

export async function chargeMmsUsage(
  companyId: string,
  messageId: string,
  options: {
    direction: "inbound" | "outbound";
    isTollFree?: boolean;
    messageCount?: number;
  }
): Promise<ChargeResult> {
  const collector = new UsageCollector(companyId, { messageId });
  await collector.addMmsUsage(
    options.direction,
    options.isTollFree || false,
    options.messageCount || 1
  );
  return collector.chargeToWallet("SMS_COST");
}

export async function chargeDidMonthly(
  companyId: string,
  didId: string,
  type: "local" | "tollfree"
): Promise<ChargeResult> {
  const collector = new UsageCollector(companyId, { didId });
  await collector.addDidCharge(type);
  return collector.chargeToWallet("DID_MONTHLY");
}

export async function chargeE911(
  companyId: string,
  didId: string,
  type: "address" | "unregistered"
): Promise<ChargeResult> {
  const collector = new UsageCollector(companyId, { didId });
  await collector.addE911Charge(type);
  return collector.chargeToWallet("E911_MONTHLY");
}

export async function chargePortOut(
  companyId: string,
  didId: string
): Promise<ChargeResult> {
  const collector = new UsageCollector(companyId, { didId });
  await collector.addPortOutFee();
  return collector.chargeToWallet("NUMBER_RENTAL");
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

  const newItems = await db
    .select()
    .from(usageItems)
    .where(eq(usageItems.callLogId, callLogId));

  const allItems = [
    ...items.map(item => ({
      usageType: item.usageType,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      ratePerUnit: item.ratePerUnit,
      cost: item.cost
    })),
    ...newItems.map(item => ({
      usageType: item.usageType,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      ratePerUnit: item.ratePerUnit,
      cost: item.totalPrice
    }))
  ];

  const totalCost = allItems.reduce(
    (sum, item) => new Decimal(sum).plus(item.cost).toString(),
    "0"
  );

  return {
    items: allItems,
    totalCost
  };
}

export async function getUsageBreakdown(options: {
  callLogId?: string;
  messageId?: string;
  didId?: string;
}): Promise<{
  items: Array<{
    resourceType: string;
    usageType: string;
    description: string;
    quantity: number;
    unit: string;
    ratePerUnit: string;
    totalPrice: string;
    totalCost?: string;
  }>;
  totalPrice: string;
  totalCost: string;
}> {
  let query = db.select().from(usageItems);
  
  if (options.callLogId) {
    query = query.where(eq(usageItems.callLogId, options.callLogId)) as any;
  } else if (options.messageId) {
    query = query.where(eq(usageItems.messageId, options.messageId)) as any;
  } else if (options.didId) {
    query = query.where(eq(usageItems.didId, options.didId)) as any;
  }

  const items = await query;

  const totalPrice = items.reduce(
    (sum, item) => new Decimal(sum).plus(item.totalPrice).toString(),
    "0"
  );

  const totalCost = items.reduce(
    (sum, item) => new Decimal(sum).plus(item.totalCost || "0").toString(),
    "0"
  );

  return {
    items: items.map(item => ({
      resourceType: item.resourceType,
      usageType: item.usageType,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      ratePerUnit: item.ratePerUnit,
      totalPrice: item.totalPrice,
      totalCost: item.totalCost || undefined
    })),
    totalPrice,
    totalCost
  };
}
