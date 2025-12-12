import { db } from "../db";
import { wallets, walletTransactions, telnyxPhoneNumbers, telephonySettings, companies } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { loadGlobalPricing } from "./pricing-config";
import { processTransaction, getOrCreateWallet, charge } from "./wallet-service";
import { addMonths } from "date-fns";

export interface PurchaseAndBillResult {
  success: boolean;
  phoneNumberId?: string;
  phoneNumber?: string;
  orderId?: string;
  amountCharged?: number;
  error?: string;
  insufficientFunds?: boolean;
}

export async function purchaseAndBillPhoneNumber(
  phoneNumber: string,
  companyId: string,
  telnyxOrderResult: {
    orderId: string;
    phoneNumberId: string;
    numberType?: "local" | "toll_free";
    telnyxMonthlyCost?: number;
  },
  ownerUserId?: string
): Promise<PurchaseAndBillResult> {
  try {
    const wallet = await getOrCreateWallet(companyId);
    const pricing = await loadGlobalPricing();
    
    const isTollFree = telnyxOrderResult.numberType === "toll_free" || 
                       phoneNumber.startsWith("+1800") || 
                       phoneNumber.startsWith("+1888") ||
                       phoneNumber.startsWith("+1877") ||
                       phoneNumber.startsWith("+1866") ||
                       phoneNumber.startsWith("+1855") ||
                       phoneNumber.startsWith("+1844") ||
                       phoneNumber.startsWith("+1833");
    
    const numberType: "local" | "toll_free" = isTollFree ? "toll_free" : "local";
    const retailMonthlyRate = isTollFree ? pricing.monthly.tollfree_did : pricing.monthly.local_did;
    const telnyxMonthlyCost = telnyxOrderResult.telnyxMonthlyCost || (isTollFree ? 0.75 : 0.50);
    
    const currentBalance = parseFloat(wallet.balance);
    if (currentBalance < retailMonthlyRate) {
      console.log(`[Billing] Insufficient funds for number purchase. Balance: $${currentBalance}, Required: $${retailMonthlyRate}`);
      return {
        success: false,
        error: `Insufficient wallet balance. Need $${retailMonthlyRate.toFixed(2)}, have $${currentBalance.toFixed(2)}`,
        insufficientFunds: true,
      };
    }
    
    const now = new Date();
    const nextBillingDate = addMonths(now, 1);
    
    const chargeResult = await charge(
      wallet.id,
      retailMonthlyRate,
      "NUMBER_PURCHASE",
      `Phone number purchase: ${phoneNumber} (first month)`,
      telnyxOrderResult.phoneNumberId
    );
    
    if (!chargeResult.success) {
      console.error(`[Billing] Failed to charge wallet for number purchase:`, chargeResult.error);
      return {
        success: false,
        error: chargeResult.error || "Failed to charge wallet",
        insufficientFunds: chargeResult.error?.includes("Insufficient"),
      };
    }
    
    console.log(`[Billing] Charged $${retailMonthlyRate.toFixed(4)} for ${phoneNumber}. New balance: $${chargeResult.newBalance}`);
    
    const existingNumber = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.phoneNumber, phoneNumber))
      .limit(1);
    
    if (existingNumber.length > 0) {
      await db
        .update(telnyxPhoneNumbers)
        .set({
          telnyxPhoneNumberId: telnyxOrderResult.phoneNumberId,
          status: "active",
          numberType,
          retailMonthlyRate: retailMonthlyRate.toFixed(4),
          telnyxMonthlyCost: telnyxMonthlyCost.toFixed(4),
          lastBilledAt: now,
          nextBillingAt: nextBillingDate,
          purchasedAt: now,
          updatedAt: now,
          ...(ownerUserId && { ownerUserId }),
        })
        .where(eq(telnyxPhoneNumbers.phoneNumber, phoneNumber));
      
      console.log(`[Billing] Updated existing phone number record: ${phoneNumber}, ownerUserId: ${ownerUserId || 'none'}`);
    } else {
      await db.insert(telnyxPhoneNumbers).values({
        companyId,
        ownerUserId: ownerUserId || null,
        phoneNumber,
        telnyxPhoneNumberId: telnyxOrderResult.phoneNumberId,
        status: "active",
        numberType,
        retailMonthlyRate: retailMonthlyRate.toFixed(4),
        telnyxMonthlyCost: telnyxMonthlyCost.toFixed(4),
        lastBilledAt: now,
        nextBillingAt: nextBillingDate,
        purchasedAt: now,
      });
      
      console.log(`[Billing] Created new phone number record: ${phoneNumber}, ownerUserId: ${ownerUserId || 'none'}`);
    }
    
    return {
      success: true,
      phoneNumberId: telnyxOrderResult.phoneNumberId,
      phoneNumber,
      orderId: telnyxOrderResult.orderId,
      amountCharged: retailMonthlyRate,
    };
  } catch (error) {
    console.error("[Billing] Phone number purchase billing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process billing",
    };
  }
}

export interface MonthlyBillingResult {
  success: boolean;
  numbersBilled: number;
  totalCharged: number;
  failures: Array<{ phoneNumber: string; error: string }>;
}

export async function processMonthlyNumberBilling(): Promise<MonthlyBillingResult> {
  const now = new Date();
  const results: MonthlyBillingResult = {
    success: true,
    numbersBilled: 0,
    totalCharged: 0,
    failures: [],
  };
  
  try {
    const numbersDue = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(
        and(
          eq(telnyxPhoneNumbers.status, "active"),
          lte(telnyxPhoneNumbers.nextBillingAt, now)
        )
      );
    
    console.log(`[Monthly Billing] Found ${numbersDue.length} numbers due for billing`);
    
    for (const number of numbersDue) {
      try {
        const wallet = await getOrCreateWallet(number.companyId);
        const rate = parseFloat(number.retailMonthlyRate || "1.00");
        
        const chargeResult = await charge(
          wallet.id,
          rate,
          "NUMBER_RENTAL",
          `Monthly fee: ${number.phoneNumber}`,
          number.id
        );
        
        if (chargeResult.success) {
          const nextBilling = addMonths(now, 1);
          await db
            .update(telnyxPhoneNumbers)
            .set({
              lastBilledAt: now,
              nextBillingAt: nextBilling,
              updatedAt: now,
            })
            .where(eq(telnyxPhoneNumbers.id, number.id));
          
          results.numbersBilled++;
          results.totalCharged += rate;
          console.log(`[Monthly Billing] Charged $${rate.toFixed(4)} for ${number.phoneNumber}`);
        } else {
          results.failures.push({
            phoneNumber: number.phoneNumber,
            error: chargeResult.error || "Charge failed",
          });
          console.error(`[Monthly Billing] Failed to charge for ${number.phoneNumber}: ${chargeResult.error}`);
        }
      } catch (err) {
        results.failures.push({
          phoneNumber: number.phoneNumber,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
    
    const cnamResult = await processMonthlyCnamBilling();
    if (cnamResult.totalCharged > 0) {
      console.log(`[Monthly Billing] CNAM billing: ${cnamResult.numbersCharged} numbers, $${cnamResult.totalCharged.toFixed(4)}`);
    }
    
    console.log(`[Monthly Billing] Complete. Billed ${results.numbersBilled} numbers, total $${results.totalCharged.toFixed(4)}, ${results.failures.length} failures`);
    
    return results;
  } catch (error) {
    console.error("[Monthly Billing] Error:", error);
    return {
      success: false,
      numbersBilled: 0,
      totalCharged: 0,
      failures: [{ phoneNumber: "system", error: error instanceof Error ? error.message : "Unknown error" }],
    };
  }
}

async function processMonthlyCnamBilling(): Promise<{ numbersCharged: number; totalCharged: number }> {
  const pricing = await loadGlobalPricing();
  const cnamMonthlyPerNumber = 0.50;
  
  let numbersCharged = 0;
  let totalCharged = 0;
  
  try {
    const companiesWithCnam = await db
      .select()
      .from(telephonySettings)
      .where(eq(telephonySettings.cnamEnabled, true));
    
    for (const settings of companiesWithCnam) {
      const companyNumbers = await db
        .select()
        .from(telnyxPhoneNumbers)
        .where(
          and(
            eq(telnyxPhoneNumbers.companyId, settings.companyId),
            eq(telnyxPhoneNumbers.status, "active")
          )
        );
      
      if (companyNumbers.length === 0) continue;
      
      const totalCnamFee = cnamMonthlyPerNumber * companyNumbers.length;
      const wallet = await getOrCreateWallet(settings.companyId);
      
      const chargeResult = await charge(
        wallet.id,
        totalCnamFee,
        "CNAM_MONTHLY",
        `CNAM monthly fee for ${companyNumbers.length} number(s)`,
        settings.id
      );
      
      if (chargeResult.success) {
        numbersCharged += companyNumbers.length;
        totalCharged += totalCnamFee;
      }
    }
  } catch (error) {
    console.error("[CNAM Billing] Error:", error);
  }
  
  return { numbersCharged, totalCharged };
}

export async function getCompanyBillingSummary(companyId: string): Promise<{
  activeNumbers: number;
  monthlyNumberFees: number;
  cnamEnabled: boolean;
  cnamMonthlyFee: number;
  estimatedMonthlyTotal: number;
}> {
  const numbers = await db
    .select()
    .from(telnyxPhoneNumbers)
    .where(
      and(
        eq(telnyxPhoneNumbers.companyId, companyId),
        eq(telnyxPhoneNumbers.status, "active")
      )
    );
  
  const [settings] = await db
    .select()
    .from(telephonySettings)
    .where(eq(telephonySettings.companyId, companyId));
  
  const cnamEnabled = settings?.cnamEnabled ?? false;
  const cnamMonthlyPerNumber = 0.50;
  
  let monthlyNumberFees = 0;
  for (const num of numbers) {
    monthlyNumberFees += parseFloat(num.retailMonthlyRate || "1.00");
  }
  
  const cnamMonthlyFee = cnamEnabled ? cnamMonthlyPerNumber * numbers.length : 0;
  
  return {
    activeNumbers: numbers.length,
    monthlyNumberFees,
    cnamEnabled,
    cnamMonthlyFee,
    estimatedMonthlyTotal: monthlyNumberFees + cnamMonthlyFee,
  };
}
