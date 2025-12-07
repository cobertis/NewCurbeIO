import { db } from "../db";
import { wallets, walletTransactions, WalletTransactionType } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

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

  return processTransaction({
    walletId,
    amount: -amount,
    type,
    description,
    externalReferenceId,
  });
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
