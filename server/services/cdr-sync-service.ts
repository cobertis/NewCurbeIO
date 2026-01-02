import { db } from "../db";
import { telnyxPhoneNumbers, callLogs, wallets, walletTransactions, companies } from "@shared/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { getTelnyxMasterApiKey, getManagedAccountHeader } from "./telnyx-numbers-service";
import { loadGlobalPricing } from "./pricing-config";
import { getCompanyTelnyxAccountId } from "./wallet-service";
import Decimal from "decimal.js";

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

interface TelnyxDetailRecord {
  id: string;
  record_type: string;
  call_id?: string;
  finished_at?: string;
  call_sec?: number;
  billed_sec?: number;
  direction?: string;
  cli?: string;
  cld?: string;
  cost?: string;
  rate?: string;
  currency?: string;
  connection_name?: string;
  status?: string;
}

interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCharged: number;
  totalInboundCost: string;
  totalOutboundCost: string;
  errors: string[];
}

export async function syncForwardedCallsCDR(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    recordsProcessed: 0,
    recordsCharged: 0,
    totalInboundCost: "0.00",
    totalOutboundCost: "0.00",
    errors: [],
  };

  try {
    console.log("[CDR Sync] Starting forwarded calls CDR sync...");

    const numbersWithForwarding = await db
      .select({
        phoneNumber: telnyxPhoneNumbers,
        company: companies,
      })
      .from(telnyxPhoneNumbers)
      .innerJoin(companies, eq(telnyxPhoneNumbers.companyId, companies.id))
      .where(
        and(
          eq(telnyxPhoneNumbers.callForwardingEnabled, true),
          isNotNull(telnyxPhoneNumbers.callForwardingDestination),
          eq(telnyxPhoneNumbers.status, "active"),
          eq(companies.isActive, true)
        )
      );

    if (numbersWithForwarding.length === 0) {
      console.log("[CDR Sync] No phone numbers with call forwarding enabled");
      return result;
    }

    console.log(`[CDR Sync] Found ${numbersWithForwarding.length} numbers with call forwarding`);

    const apiKey = await getTelnyxMasterApiKey();
    const pricing = await loadGlobalPricing();
    const callForwardingRatePerMin = new Decimal(pricing.usage.local_outbound_minute);

    let totalInbound = new Decimal(0);
    let totalOutbound = new Decimal(0);

    for (const { phoneNumber, company } of numbersWithForwarding) {
      try {
        const telnyxAccountId = await getCompanyTelnyxAccountId(company.id);
        
        const inboundRecords = await fetchDetailRecords(
          apiKey,
          telnyxAccountId,
          phoneNumber.phoneNumber,
          "inbound"
        );
        
        const outboundRecords = await fetchDetailRecords(
          apiKey,
          telnyxAccountId,
          phoneNumber.phoneNumber,
          "outbound",
          phoneNumber.callForwardingDestination!
        );

        console.log(`[CDR Sync] ${phoneNumber.phoneNumber}: Found ${inboundRecords.length} inbound, ${outboundRecords.length} outbound records`);

        const existingRecordIds = await getExistingRecordIds(company.id);

        for (const record of inboundRecords) {
          if (existingRecordIds.has(record.id)) {
            continue;
          }

          result.recordsProcessed++;

          const matchingOutbound = findMatchingOutboundCall(record, outboundRecords);

          const billedMinutes = Math.ceil((record.billed_sec || 0) / 60);
          const inboundCost = new Decimal(record.cost || "0");
          let outboundCost = new Decimal(0);

          if (matchingOutbound) {
            outboundCost = callForwardingRatePerMin.times(billedMinutes);
          }

          const totalCallCost = inboundCost.plus(outboundCost);

          if (totalCallCost.gt(0)) {
            const chargeResult = await chargeForForwardedCall(
              company.id,
              phoneNumber.ownerUserId,
              totalCallCost,
              phoneNumber.phoneNumber,
              phoneNumber.callForwardingDestination!,
              billedMinutes
            );

            if (chargeResult.success) {
              result.recordsCharged++;
              totalInbound = totalInbound.plus(inboundCost);
              totalOutbound = totalOutbound.plus(outboundCost);
            } else if (chargeResult.error) {
              result.errors.push(chargeResult.error);
            }
          }

          await insertCallLogFromCDR(
            record,
            company.id,
            phoneNumber.ownerUserId,
            phoneNumber.phoneNumber,
            phoneNumber.callForwardingDestination!,
            inboundCost.toFixed(4),
            outboundCost.toFixed(4)
          );
        }
      } catch (error) {
        const errorMsg = `Error processing ${phoneNumber.phoneNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`[CDR Sync] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    result.totalInboundCost = totalInbound.toFixed(2);
    result.totalOutboundCost = totalOutbound.toFixed(2);

    console.log(`[CDR Sync] Complete: ${result.recordsProcessed} processed, ${result.recordsCharged} charged, inbound: $${result.totalInboundCost}, outbound: $${result.totalOutboundCost}`);

    return result;
  } catch (error) {
    console.error("[CDR Sync] Fatal error:", error);
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : "Unknown error");
    return result;
  }
}

async function fetchDetailRecords(
  apiKey: string,
  accountId: string | null,
  ourNumber: string,
  direction: "inbound" | "outbound",
  forwardedTo?: string
): Promise<TelnyxDetailRecord[]> {
  const records: TelnyxDetailRecord[] = [];
  
  // Try multiple record types since forwarded calls may be logged differently
  // Note: voice-api is not a valid record type according to Telnyx API
  const recordTypes = ["sip-trunking", "call-control"];

  for (const recordType of recordTypes) {
    try {
      const queryParams = new URLSearchParams({
        "filter[record_type]": recordType,
        "filter[date_range]": "last_7_days",
        "filter[direction]": direction,
        "page[size]": "100",
      });

      if (direction === "inbound") {
        queryParams.set("filter[cld]", ourNumber);
      } else if (direction === "outbound" && forwardedTo) {
        queryParams.set("filter[cli]", ourNumber);
        queryParams.set("filter[cld]", forwardedTo);
      } else {
        queryParams.set("filter[cli]", ourNumber);
      }

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      const managedAccountId = getManagedAccountHeader(accountId);
      if (managedAccountId) {
        headers["X-Telnyx-Account-Id"] = managedAccountId;
      }

      const url = `${TELNYX_API_BASE}/detail_records?${queryParams}`;
      console.log(`[CDR Sync] Fetching ${direction} records with type=${recordType}`);

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[CDR Sync] Failed to fetch ${direction} ${recordType} records: ${response.status} - ${text}`);
        continue;
      }

      const data = await response.json();
      const foundRecords = data.data || [];
      
      console.log(`[CDR Sync] ${recordType} ${direction}: ${foundRecords.length} records found`);
      if (foundRecords.length > 0) {
        records.push(...foundRecords);
      }
    } catch (error) {
      console.error(`[CDR Sync] Error fetching ${direction} ${recordType} records:`, error);
    }
  }

  return records;
}

// Fetch all records without filters for diagnostic purposes
export async function fetchAllDetailRecords(
  phoneNumber: string,
  forwardedTo: string
): Promise<{ raw: any[]; analysis: string }> {
  const apiKey = await getTelnyxMasterApiKey();
  const allRecords: any[] = [];
  const analysis: string[] = [];
  
  // Find the phone number to get telnyxAccountId
  const [phoneData] = await db
    .select()
    .from(telnyxPhoneNumbers)
    .where(eq(telnyxPhoneNumbers.phoneNumber, phoneNumber))
    .limit(1);
  
  let accountId: string | null = null;
  if (phoneData) {
    accountId = await getCompanyTelnyxAccountId(phoneData.companyId);
    analysis.push(`Phone number found: ${phoneNumber}, Company: ${phoneData.companyId}`);
    analysis.push(`Telnyx Account ID: ${accountId || "using master account"}`);
  } else {
    analysis.push(`Phone number NOT found in database: ${phoneNumber}`);
  }

  const recordTypes = ["sip-trunking", "call-control"];
  
  for (const recordType of recordTypes) {
    try {
      // Fetch without direction or specific filters to see ALL records
      const queryParams = new URLSearchParams({
        "filter[record_type]": recordType,
        "filter[date_range]": "last_7_days",
        "page[size]": "50",
      });

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      const managedAccountId = getManagedAccountHeader(accountId);
      if (managedAccountId) {
        headers["X-Telnyx-Account-Id"] = managedAccountId;
      }

      const response = await fetch(`${TELNYX_API_BASE}/detail_records?${queryParams}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        analysis.push(`${recordType}: API error ${response.status} - ${text.substring(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const records = data.data || [];
      analysis.push(`${recordType}: ${records.length} total records`);
      
      // Check for matching records
      const matchingRecords = records.filter((r: any) => 
        r.cli === phoneNumber || r.cld === phoneNumber ||
        r.cli === forwardedTo || r.cld === forwardedTo
      );
      
      if (matchingRecords.length > 0) {
        analysis.push(`${recordType}: ${matchingRecords.length} records match ${phoneNumber} or ${forwardedTo}`);
        allRecords.push(...matchingRecords);
      }
    } catch (error) {
      analysis.push(`${recordType}: Error - ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }

  return { raw: allRecords, analysis: analysis.join("\n") };
}

async function getExistingRecordIds(companyId: string): Promise<Set<string>> {
  const existing = await db
    .select({ telnyxDetailRecordId: callLogs.telnyxDetailRecordId })
    .from(callLogs)
    .where(
      and(
        eq(callLogs.companyId, companyId),
        isNotNull(callLogs.telnyxDetailRecordId)
      )
    );

  return new Set(
    existing
      .map((r) => r.telnyxDetailRecordId)
      .filter((id): id is string => id !== null)
  );
}

function findMatchingOutboundCall(
  inboundRecord: TelnyxDetailRecord,
  outboundRecords: TelnyxDetailRecord[]
): TelnyxDetailRecord | undefined {
  if (!inboundRecord.finished_at) return undefined;

  const inboundTime = new Date(inboundRecord.finished_at).getTime();
  const tolerance = 60000;

  return outboundRecords.find((outbound) => {
    if (!outbound.finished_at) return false;
    const outboundTime = new Date(outbound.finished_at).getTime();
    return Math.abs(inboundTime - outboundTime) < tolerance;
  });
}

async function chargeForForwardedCall(
  companyId: string,
  ownerUserId: string | null,
  amount: Decimal,
  fromNumber: string,
  forwardedTo: string,
  billedMinutes: number
): Promise<{ success: boolean; error?: string }> {
  try {
    let wallet = null;

    if (ownerUserId) {
      [wallet] = await db
        .select()
        .from(wallets)
        .where(
          and(eq(wallets.companyId, companyId), eq(wallets.ownerUserId, ownerUserId))
        );
    }

    if (!wallet) {
      [wallet] = await db.select().from(wallets).where(eq(wallets.companyId, companyId));
    }

    if (!wallet) {
      return { success: false, error: `No wallet found for company ${companyId}` };
    }

    const currentBalance = new Decimal(wallet.balance);
    const newBalance = currentBalance.minus(amount);

    if (newBalance.lt(0) && !wallet.autoRecharge) {
      return {
        success: false,
        error: `Insufficient balance for forwarded call charge: $${amount.toFixed(2)}`,
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(wallets)
        .set({
          balance: newBalance.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet!.id));

      await tx.insert(walletTransactions).values({
        walletId: wallet!.id,
        amount: `-${amount.toFixed(4)}`,
        type: "CALL_FORWARDING",
        description: `Call forwarding: ${fromNumber} → ${forwardedTo} (${billedMinutes} min)`,
        balanceAfter: newBalance.toFixed(4),
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown charge error",
    };
  }
}

async function insertCallLogFromCDR(
  record: TelnyxDetailRecord,
  companyId: string,
  userId: string | null,
  ourNumber: string,
  forwardedTo: string,
  inboundCost: string,
  outboundCost: string
): Promise<void> {
  try {
    const startedAt = record.finished_at
      ? new Date(new Date(record.finished_at).getTime() - (record.call_sec || 0) * 1000)
      : new Date();

    const totalCost = new Decimal(inboundCost).plus(outboundCost).toFixed(4);

    await db.insert(callLogs).values({
      companyId,
      userId,
      telnyxCallId: record.call_id || null,
      telnyxDetailRecordId: record.id,
      fromNumber: record.cli || "unknown",
      toNumber: record.cld || ourNumber,
      direction: "inbound",
      status: "answered",
      duration: record.call_sec || 0,
      billedDuration: record.billed_sec || 0,
      cost: totalCost,
      costCurrency: record.currency || "USD",
      isForwardedCall: true,
      forwardedTo,
      inboundCost,
      outboundCost,
      syncedFromCdr: true,
      startedAt,
      endedAt: record.finished_at ? new Date(record.finished_at) : null,
    });
  } catch (error) {
    console.error(`[CDR Sync] Failed to insert call log for record ${record.id}:`, error);
  }
}
