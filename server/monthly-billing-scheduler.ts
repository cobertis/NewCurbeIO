import cron from 'node-cron';
import { db } from './db.js';
import { companies, telephonySettings, telnyxPhoneNumbers, wallets, walletTransactions } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { PRICING } from './services/pricing-config.js';

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

let schedulerRunning = false;

interface BillingResult {
  companyId: string;
  companyName: string;
  phoneNumbersCharged: number;
  phoneNumberFees: string;
  cnamCharged: boolean;
  cnamFee: string;
  totalCharged: string;
  insufficientBalance: boolean;
  newBalance: string;
}

async function processMonthlyBilling(): Promise<BillingResult[]> {
  const results: BillingResult[] = [];
  const billingDate = new Date();
  const billingPeriod = `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}`;

  console.log(`[MONTHLY BILLING] Starting monthly billing for period: ${billingPeriod}`);

  const allCompanies = await db.select().from(companies).where(eq(companies.isActive, true));
  console.log(`[MONTHLY BILLING] Found ${allCompanies.length} active companies`);

  for (const company of allCompanies) {
    try {
      const activePhoneNumbers = await db
        .select()
        .from(telnyxPhoneNumbers)
        .where(
          and(
            eq(telnyxPhoneNumbers.companyId, company.id),
            eq(telnyxPhoneNumbers.status, 'active')
          )
        );

      if (activePhoneNumbers.length === 0) {
        console.log(`[MONTHLY BILLING] Company ${company.name} (${company.id}): No active phone numbers, skipping`);
        continue;
      }

      const [settings] = await db
        .select()
        .from(telephonySettings)
        .where(eq(telephonySettings.companyId, company.id));

      const cnamEnabled = settings?.cnamEnabled ?? false;

      const phoneNumberFee = new Decimal(PRICING.monthly.number_rental);
      const totalPhoneNumberFees = phoneNumberFee.times(activePhoneNumbers.length);
      const cnamFeePerNumber = new Decimal(PRICING.monthly.cnam_per_number);
      const totalCnamFee = cnamEnabled ? cnamFeePerNumber.times(activePhoneNumbers.length) : new Decimal(0);
      const totalCharge = totalPhoneNumberFees.plus(totalCnamFee);

      console.log(`[MONTHLY BILLING] Company ${company.name} (${company.id}): ${activePhoneNumbers.length} numbers x $${phoneNumberFee} = $${totalPhoneNumberFees}${cnamEnabled ? ` + CNAM ${activePhoneNumbers.length} x $${cnamFeePerNumber} = $${totalCnamFee}` : ''} = Total $${totalCharge}`);

      const result = await db.transaction(async (tx) => {
        const [wallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.companyId, company.id))
          .for("update");

        if (!wallet) {
          console.warn(`[MONTHLY BILLING] Company ${company.name} (${company.id}): No wallet found, skipping`);
          return null;
        }

        const currentBalance = new Decimal(wallet.balance);
        const newBalance = currentBalance.minus(totalCharge);

        if (newBalance.lessThan(0)) {
          console.warn(`[MONTHLY BILLING] Company ${company.name} (${company.id}): INSUFFICIENT BALANCE - current: $${currentBalance}, required: $${totalCharge}`);
          
          return {
            companyId: company.id,
            companyName: company.name,
            phoneNumbersCharged: 0,
            phoneNumberFees: "0.0000",
            cnamCharged: false,
            cnamFee: "0.0000",
            totalCharged: "0.0000",
            insufficientBalance: true,
            newBalance: currentBalance.toFixed(4),
          };
        }

        await tx
          .update(wallets)
          .set({
            balance: newBalance.toFixed(4),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));

        await tx.insert(walletTransactions).values({
          walletId: wallet.id,
          amount: totalPhoneNumberFees.negated().toFixed(4),
          type: "MONTHLY_FEE",
          description: `Monthly phone number rental (${activePhoneNumbers.length} numbers x $${phoneNumberFee.toFixed(2)}) - ${billingPeriod}`,
          externalReferenceId: `monthly-billing-${billingPeriod}-${company.id}`,
          balanceAfter: currentBalance.minus(totalPhoneNumberFees).toFixed(4),
        });

        console.log(`[MONTHLY BILLING] Company ${company.name}: Created MONTHLY_FEE transaction for $${totalPhoneNumberFees}`);

        if (cnamEnabled && totalCnamFee.greaterThan(0)) {
          await tx.insert(walletTransactions).values({
            walletId: wallet.id,
            amount: totalCnamFee.negated().toFixed(4),
            type: "CNAM_MONTHLY",
            description: `CNAM listing fee (${activePhoneNumbers.length} numbers x $${cnamFeePerNumber.toFixed(2)}) - ${billingPeriod}`,
            externalReferenceId: `cnam-monthly-${billingPeriod}-${company.id}`,
            balanceAfter: newBalance.toFixed(4),
          });

          console.log(`[MONTHLY BILLING] Company ${company.name}: Created CNAM_MONTHLY transaction for $${totalCnamFee}`);
        }

        return {
          companyId: company.id,
          companyName: company.name,
          phoneNumbersCharged: activePhoneNumbers.length,
          phoneNumberFees: totalPhoneNumberFees.toFixed(4),
          cnamCharged: cnamEnabled,
          cnamFee: totalCnamFee.toFixed(4),
          totalCharged: totalCharge.toFixed(4),
          insufficientBalance: false,
          newBalance: newBalance.toFixed(4),
        };
      });

      if (result) {
        results.push(result);
        if (!result.insufficientBalance) {
          console.log(`[MONTHLY BILLING] Company ${company.name}: Successfully charged $${result.totalCharged}, new balance: $${result.newBalance}`);
        }
      }

    } catch (error) {
      console.error(`[MONTHLY BILLING] Error processing company ${company.name} (${company.id}):`, error);
    }
  }

  const totalCharged = results.reduce((sum, r) => sum.plus(new Decimal(r.totalCharged)), new Decimal(0));
  const successfulCharges = results.filter(r => !r.insufficientBalance).length;
  const failedCharges = results.filter(r => r.insufficientBalance).length;

  console.log(`[MONTHLY BILLING] Completed billing for period ${billingPeriod}:`);
  console.log(`[MONTHLY BILLING]   - Companies processed: ${results.length}`);
  console.log(`[MONTHLY BILLING]   - Successful charges: ${successfulCharges}`);
  console.log(`[MONTHLY BILLING]   - Insufficient balance: ${failedCharges}`);
  console.log(`[MONTHLY BILLING]   - Total collected: $${totalCharged.toFixed(4)}`);

  return results;
}

export function startMonthlyBillingScheduler() {
  if (schedulerRunning) {
    console.log('[MONTHLY BILLING] Scheduler already running');
    return;
  }

  console.log('[MONTHLY BILLING] Starting monthly billing scheduler...');
  schedulerRunning = true;

  cron.schedule('0 0 1 * *', async () => {
    console.log(`[MONTHLY BILLING] Cron triggered at ${new Date().toISOString()}`);
    try {
      await processMonthlyBilling();
    } catch (error) {
      console.error('[MONTHLY BILLING] Error in monthly billing scheduler:', error);
    }
  });

  console.log('[MONTHLY BILLING] Scheduler started - runs at 00:00 on the 1st of each month');
}

export async function runMonthlyBillingNow(): Promise<BillingResult[]> {
  console.log('[MONTHLY BILLING] Manual billing run triggered');
  return processMonthlyBilling();
}
