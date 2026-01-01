import cron from 'node-cron';
import { db } from './db.js';
import { companies, telephonySettings, telnyxPhoneNumbers, telnyxE911Addresses, wallets, walletTransactions, users } from '../shared/schema.js';
import { eq, and, lte, isNull, or } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { loadGlobalPricing } from './services/pricing-config.js';

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

let schedulerRunning = false;

interface PhoneNumberBillingResult {
  phoneNumberId: string;
  phoneNumber: string;
  companyId: string;
  companyName: string;
  monthlyFee: string;
  e911Fee: string;
  totalCharged: string;
  success: boolean;
  error?: string;
  newBalance?: string;
}

interface BillingResult {
  companyId: string;
  companyName: string;
  phoneNumbersCharged: number;
  phoneNumberFees: string;
  cnamCharged: boolean;
  cnamFee: string;
  e911AddressesCharged: number;
  e911Fee: string;
  totalCharged: string;
  insufficientBalance: boolean;
  newBalance: string;
}

async function processPerNumberBilling(): Promise<PhoneNumberBillingResult[]> {
  const results: PhoneNumberBillingResult[] = [];
  const now = new Date();
  
  console.log(`[DID BILLING] Starting per-number billing check at ${now.toISOString()}`);

  const pricing = await loadGlobalPricing();
  const localDidRate = new Decimal(pricing.monthly.local_did);
  const tollFreeDidRate = new Decimal(pricing.monthly.tollfree_did);

  const phoneNumbersDue = await db
    .select({
      phoneNumber: telnyxPhoneNumbers,
      company: companies,
    })
    .from(telnyxPhoneNumbers)
    .innerJoin(companies, eq(telnyxPhoneNumbers.companyId, companies.id))
    .where(
      and(
        eq(telnyxPhoneNumbers.status, 'active'),
        eq(companies.isActive, true),
        or(
          lte(telnyxPhoneNumbers.nextBillingAt, now),
          isNull(telnyxPhoneNumbers.nextBillingAt)
        )
      )
    );

  console.log(`[DID BILLING] Found ${phoneNumbersDue.length} phone numbers due for billing`);

  for (const { phoneNumber: pn, company } of phoneNumbersDue) {
    try {
      const isTollFree = pn.numberType === 'toll_free' || pn.phoneNumber.startsWith('+1800') || 
                         pn.phoneNumber.startsWith('+1888') || pn.phoneNumber.startsWith('+1877') ||
                         pn.phoneNumber.startsWith('+1866') || pn.phoneNumber.startsWith('+1855') ||
                         pn.phoneNumber.startsWith('+1844') || pn.phoneNumber.startsWith('+1833');
      
      const baseRate = isTollFree ? tollFreeDidRate : localDidRate;
      const monthlyFee = pn.retailMonthlyRate ? new Decimal(pn.retailMonthlyRate) : baseRate;
      
      const e911Fee = pn.e911Enabled ? new Decimal(pricing.monthly.local_did).times(0.2) : new Decimal(0);
      const totalCharge = monthlyFee.plus(e911Fee);

      console.log(`[DID BILLING] Processing ${pn.phoneNumber} for ${company.name}: $${totalCharge.toFixed(4)} (DID: $${monthlyFee}, E911: $${e911Fee})`);

      const result = await db.transaction(async (tx) => {
        let wallet = null;
        
        if (pn.ownerUserId) {
          const [userWallet] = await tx
            .select()
            .from(wallets)
            .where(and(
              eq(wallets.companyId, company.id),
              eq(wallets.ownerUserId, pn.ownerUserId)
            ))
            .for("update");
          wallet = userWallet;
        }
        
        if (!wallet) {
          const [adminUser] = await tx
            .select({ id: users.id })
            .from(users)
            .where(and(
              eq(users.companyId, company.id),
              eq(users.role, "admin")
            ))
            .orderBy(users.createdAt)
            .limit(1);
          
          if (adminUser?.id) {
            const [adminWallet] = await tx
              .select()
              .from(wallets)
              .where(and(
                eq(wallets.companyId, company.id),
                eq(wallets.ownerUserId, adminUser.id)
              ))
              .for("update");
            wallet = adminWallet;
          }
        }
        
        if (!wallet) {
          const [companyWallet] = await tx
            .select()
            .from(wallets)
            .where(and(
              eq(wallets.companyId, company.id),
              isNull(wallets.ownerUserId)
            ))
            .for("update");
          wallet = companyWallet;
        }
        
        if (!wallet) {
          const [anyWallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.companyId, company.id))
            .orderBy(wallets.createdAt)
            .limit(1)
            .for("update");
          wallet = anyWallet;
        }

        if (!wallet) {
          return {
            phoneNumberId: pn.id,
            phoneNumber: pn.phoneNumber,
            companyId: company.id,
            companyName: company.name,
            monthlyFee: monthlyFee.toFixed(4),
            e911Fee: e911Fee.toFixed(4),
            totalCharged: "0.0000",
            success: false,
            error: "No wallet found",
          };
        }

        const currentBalance = new Decimal(wallet.balance);
        const newBalance = currentBalance.minus(totalCharge);

        if (newBalance.lessThan(-10)) {
          console.warn(`[DID BILLING] ${pn.phoneNumber}: INSUFFICIENT BALANCE - current: $${currentBalance}, required: $${totalCharge}`);
          
          return {
            phoneNumberId: pn.id,
            phoneNumber: pn.phoneNumber,
            companyId: company.id,
            companyName: company.name,
            monthlyFee: monthlyFee.toFixed(4),
            e911Fee: e911Fee.toFixed(4),
            totalCharged: "0.0000",
            success: false,
            error: `Insufficient balance: $${currentBalance.toFixed(2)}`,
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

        const billingPeriodStart = pn.lastBilledAt || pn.purchasedAt || new Date();
        const nextBilling = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await tx.insert(walletTransactions).values({
          walletId: wallet.id,
          amount: totalCharge.negated().toFixed(4),
          type: "DID_MONTHLY",
          description: `Monthly DID fee: ${pn.phoneNumber}${pn.e911Enabled ? ' (includes E911)' : ''}`,
          externalReferenceId: `did-monthly-${pn.id}-${now.toISOString().slice(0, 10)}`,
          balanceAfter: newBalance.toFixed(4),
        });

        await tx
          .update(telnyxPhoneNumbers)
          .set({
            lastBilledAt: now,
            nextBillingAt: nextBilling,
            updatedAt: now,
          })
          .where(eq(telnyxPhoneNumbers.id, pn.id));

        console.log(`[DID BILLING] ${pn.phoneNumber}: Charged $${totalCharge.toFixed(4)}, next billing: ${nextBilling.toISOString().slice(0, 10)}`);

        return {
          phoneNumberId: pn.id,
          phoneNumber: pn.phoneNumber,
          companyId: company.id,
          companyName: company.name,
          monthlyFee: monthlyFee.toFixed(4),
          e911Fee: e911Fee.toFixed(4),
          totalCharged: totalCharge.toFixed(4),
          success: true,
          newBalance: newBalance.toFixed(4),
        };
      });

      results.push(result);

    } catch (error) {
      console.error(`[DID BILLING] Error processing ${pn.phoneNumber}:`, error);
      results.push({
        phoneNumberId: pn.id,
        phoneNumber: pn.phoneNumber,
        companyId: company.id,
        companyName: company.name,
        monthlyFee: "0.0000",
        e911Fee: "0.0000",
        totalCharged: "0.0000",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalCollected = successful.reduce((sum, r) => sum.plus(new Decimal(r.totalCharged)), new Decimal(0));

  console.log(`[DID BILLING] Completed:`);
  console.log(`[DID BILLING]   - Numbers processed: ${results.length}`);
  console.log(`[DID BILLING]   - Successful: ${successful.length}`);
  console.log(`[DID BILLING]   - Failed: ${failed.length}`);
  console.log(`[DID BILLING]   - Total collected: $${totalCollected.toFixed(4)}`);

  return results;
}

async function processMonthlyBilling(): Promise<BillingResult[]> {
  const results: BillingResult[] = [];
  const billingDate = new Date();
  const billingPeriod = `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}`;

  console.log(`[MONTHLY BILLING] Starting monthly billing for period: ${billingPeriod}`);

  const allCompanies = await db.select().from(companies).where(eq(companies.isActive, true));
  console.log(`[MONTHLY BILLING] Found ${allCompanies.length} active companies`);

  const pricing = await loadGlobalPricing();

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

      const e911Addresses = await db
        .select()
        .from(telnyxE911Addresses)
        .where(eq(telnyxE911Addresses.companyId, company.id));

      const phoneNumberFee = new Decimal(pricing.monthly.local_did);
      const totalPhoneNumberFees = phoneNumberFee.times(activePhoneNumbers.length);
      const cnamFeePerNumber = new Decimal(0.50);
      const totalCnamFee = cnamEnabled ? cnamFeePerNumber.times(activePhoneNumbers.length) : new Decimal(0);
      const e911FeePerAddress = new Decimal(2.00);
      const totalE911Fee = e911Addresses.length > 0 ? e911FeePerAddress.times(e911Addresses.length) : new Decimal(0);
      const totalCharge = totalPhoneNumberFees.plus(totalCnamFee).plus(totalE911Fee);

      console.log(`[MONTHLY BILLING] Company ${company.name} (${company.id}): ${activePhoneNumbers.length} numbers x $${phoneNumberFee} = $${totalPhoneNumberFees}${cnamEnabled ? ` + CNAM ${activePhoneNumbers.length} x $${cnamFeePerNumber} = $${totalCnamFee}` : ''}${e911Addresses.length > 0 ? ` + E911 ${e911Addresses.length} x $${e911FeePerAddress} = $${totalE911Fee}` : ''} = Total $${totalCharge}`);

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
            e911AddressesCharged: 0,
            e911Fee: "0.0000",
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

        let runningBalance = currentBalance.minus(totalPhoneNumberFees);

        if (cnamEnabled && totalCnamFee.greaterThan(0)) {
          await tx.insert(walletTransactions).values({
            walletId: wallet.id,
            amount: totalCnamFee.negated().toFixed(4),
            type: "CNAM_MONTHLY",
            description: `CNAM listing fee (${activePhoneNumbers.length} numbers x $${cnamFeePerNumber.toFixed(2)}) - ${billingPeriod}`,
            externalReferenceId: `cnam-monthly-${billingPeriod}-${company.id}`,
            balanceAfter: runningBalance.minus(totalCnamFee).toFixed(4),
          });

          runningBalance = runningBalance.minus(totalCnamFee);
          console.log(`[MONTHLY BILLING] Company ${company.name}: Created CNAM_MONTHLY transaction for $${totalCnamFee}`);
        }

        if (e911Addresses.length > 0 && totalE911Fee.greaterThan(0)) {
          await tx.insert(walletTransactions).values({
            walletId: wallet.id,
            amount: totalE911Fee.negated().toFixed(4),
            type: "E911_MONTHLY",
            description: `E911 service fee (${e911Addresses.length} address${e911Addresses.length > 1 ? 'es' : ''} x $${e911FeePerAddress.toFixed(2)}) - ${billingPeriod}`,
            externalReferenceId: `e911-monthly-${billingPeriod}-${company.id}`,
            balanceAfter: newBalance.toFixed(4),
          });

          console.log(`[MONTHLY BILLING] Company ${company.name}: Created E911_MONTHLY transaction for $${totalE911Fee}`);
        }

        return {
          companyId: company.id,
          companyName: company.name,
          phoneNumbersCharged: activePhoneNumbers.length,
          phoneNumberFees: totalPhoneNumberFees.toFixed(4),
          cnamCharged: cnamEnabled,
          cnamFee: totalCnamFee.toFixed(4),
          e911AddressesCharged: e911Addresses.length,
          e911Fee: totalE911Fee.toFixed(4),
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
    console.log('[DID BILLING] Scheduler already running');
    return;
  }

  console.log('[DID BILLING] Starting DID billing scheduler...');
  schedulerRunning = true;

  cron.schedule('0 * * * *', async () => {
    console.log(`[DID BILLING] Hourly check triggered at ${new Date().toISOString()}`);
    try {
      await processPerNumberBilling();
    } catch (error) {
      console.error('[DID BILLING] Error in billing scheduler:', error);
    }
  });

  console.log('[DID BILLING] Scheduler started - runs every hour to check for DIDs due for billing');
}

export async function runMonthlyBillingNow(): Promise<BillingResult[]> {
  console.log('[MONTHLY BILLING] Manual billing run triggered');
  return processMonthlyBilling();
}

export async function runPerNumberBillingNow(): Promise<PhoneNumberBillingResult[]> {
  console.log('[DID BILLING] Manual per-number billing run triggered');
  return processPerNumberBilling();
}
