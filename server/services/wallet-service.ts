import { db } from "../db";
import { wallets, walletTransactions, WalletTransactionType, companies } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Track auto-recharge in progress to prevent duplicate charges
const autoRechargeInProgress = new Set<string>();

async function triggerAutoRecharge(wallet: typeof wallets.$inferSelect): Promise<void> {
  if (autoRechargeInProgress.has(wallet.id)) {
    console.log(`[Wallet Auto-Recharge] Already in progress for wallet ${wallet.id}, skipping`);
    return;
  }

  try {
    autoRechargeInProgress.add(wallet.id);
    
    const threshold = parseFloat(wallet.autoRechargeThreshold || "0");
    const rechargeAmount = parseFloat(wallet.autoRechargeAmount || "0");
    const currentBalance = parseFloat(wallet.balance);
    
    if (currentBalance >= threshold) {
      return; // Balance is above threshold, no need to recharge
    }
    
    console.log(`[Wallet Auto-Recharge] Triggering for wallet ${wallet.id}: balance $${currentBalance} < threshold $${threshold}`);
    
    // Get company's Stripe info
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, wallet.companyId));
    
    if (!company?.stripeCustomerId) {
      console.error(`[Wallet Auto-Recharge] No Stripe customer for company ${wallet.companyId}`);
      return;
    }
    
    // Get payment method
    let paymentMethodId = company.stripePaymentMethodId;
    if (!paymentMethodId) {
      const { getStripeClient } = await import("../stripe");
      const stripeClient = await getStripeClient();
      if (!stripeClient) {
        console.error(`[Wallet Auto-Recharge] Stripe client not available`);
        return;
      }
      const customer = await stripeClient.customers.retrieve(company.stripeCustomerId) as any;
      paymentMethodId = customer.invoice_settings?.default_payment_method;
    }
    
    if (!paymentMethodId) {
      console.error(`[Wallet Auto-Recharge] No payment method for company ${wallet.companyId}`);
      return;
    }
    
    // Process the payment
    const { getStripeClient } = await import("../stripe");
    const stripeClient = await getStripeClient();
    if (!stripeClient) {
      console.error(`[Wallet Auto-Recharge] Stripe client not available for payment`);
      return;
    }
    const amountInCents = Math.round(rechargeAmount * 100);
    
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: company.stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      description: `Auto-recharge for wallet ${wallet.id}`,
      metadata: {
        companyId: wallet.companyId,
        type: 'wallet_auto_recharge',
        walletId: wallet.id,
      },
    });
    
    if (paymentIntent.status === 'succeeded') {
      // Add funds to wallet
      await processTransaction({
        walletId: wallet.id,
        amount: rechargeAmount,
        type: "DEPOSIT",
        description: `Auto-recharge: $${rechargeAmount.toFixed(2)}`,
        externalReferenceId: paymentIntent.id,
      });
      
      console.log(`[Wallet Auto-Recharge] Successfully added $${rechargeAmount} to wallet ${wallet.id}`);
    } else {
      console.error(`[Wallet Auto-Recharge] Payment failed with status: ${paymentIntent.status}`);
    }
  } catch (error) {
    console.error(`[Wallet Auto-Recharge] Error:`, error);
  } finally {
    autoRechargeInProgress.delete(wallet.id);
  }
}

export interface ProcessTransactionParams {
  walletId: string;
  amount: number;
  type: WalletTransactionType;
  description?: string;
  externalReferenceId?: string;
}

export interface ProcessTransactionResult {
  success: boolean;
  transaction?: {
    id: string;
    amount: string;
    type: WalletTransactionType;
    balanceAfter: string;
    createdAt: Date;
  };
  newBalance?: string;
  error?: string;
}

export async function processTransaction(params: ProcessTransactionParams): Promise<ProcessTransactionResult> {
  const { walletId, amount, type, description, externalReferenceId } = params;

  try {
    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .for("update");

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const currentBalance = parseFloat(wallet.balance);
      const newBalance = currentBalance + amount;

      if (newBalance < 0) {
        throw new Error("Insufficient funds");
      }

      await tx
        .update(wallets)
        .set({
          balance: newBalance.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletId));

      const [transaction] = await tx
        .insert(walletTransactions)
        .values({
          walletId,
          amount: amount.toFixed(4),
          type,
          description: description || null,
          externalReferenceId: externalReferenceId || null,
          balanceAfter: newBalance.toFixed(4),
        })
        .returning();

      return {
        transaction,
        newBalance: newBalance.toFixed(4),
      };
    });

    return {
      success: true,
      transaction: {
        id: result.transaction.id,
        amount: result.transaction.amount,
        type: result.transaction.type as WalletTransactionType,
        balanceAfter: result.transaction.balanceAfter,
        createdAt: result.transaction.createdAt,
      },
      newBalance: result.newBalance,
    };
  } catch (error) {
    console.error("[Wallet] Transaction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Transaction failed",
    };
  }
}

export async function getOrCreateWallet(companyId: string): Promise<{ id: string; balance: string; currency: string }> {
  const [existingWallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  if (existingWallet) {
    return {
      id: existingWallet.id,
      balance: existingWallet.balance,
      currency: existingWallet.currency,
    };
  }

  const [newWallet] = await db
    .insert(wallets)
    .values({ companyId })
    .returning();

  return {
    id: newWallet.id,
    balance: newWallet.balance,
    currency: newWallet.currency,
  };
}

export async function getWalletByCompany(companyId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.companyId, companyId));

  return wallet || null;
}

export async function getWalletTransactions(
  walletId: string,
  limit: number = 50,
  offset: number = 0
) {
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, walletId))
    .orderBy(sql`${walletTransactions.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return transactions;
}

export async function deposit(
  walletId: string,
  amount: number,
  description?: string,
  externalReferenceId?: string
): Promise<ProcessTransactionResult> {
  if (amount <= 0) {
    return { success: false, error: "Deposit amount must be positive" };
  }

  return processTransaction({
    walletId,
    amount,
    type: "DEPOSIT",
    description: description || "Deposit",
    externalReferenceId,
  });
}

export async function charge(
  walletId: string,
  amount: number,
  type: WalletTransactionType,
  description?: string,
  externalReferenceId?: string
): Promise<ProcessTransactionResult> {
  if (amount <= 0) {
    return { success: false, error: "Charge amount must be positive" };
  }

  const result = await processTransaction({
    walletId,
    amount: -amount,
    type,
    description,
    externalReferenceId,
  });

  // Check if auto-recharge should be triggered
  if (result.success) {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId));
    
    if (wallet?.autoRecharge) {
      const newBalance = parseFloat(result.newBalance || "0");
      const threshold = parseFloat(wallet.autoRechargeThreshold || "0");
      
      if (newBalance < threshold) {
        // Trigger auto-recharge asynchronously (don't block the charge response)
        triggerAutoRecharge(wallet).catch(err => {
          console.error("[Wallet] Auto-recharge error:", err);
        });
      }
    }
  }

  return result;
}

export async function checkBalance(walletId: string): Promise<{ balance: number; hasEnough: (amount: number) => boolean }> {
  const [wallet] = await db
    .select({ balance: wallets.balance })
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) {
    return { balance: 0, hasEnough: () => false };
  }

  const balance = parseFloat(wallet.balance);
  return {
    balance,
    hasEnough: (amount: number) => balance >= amount,
  };
}
