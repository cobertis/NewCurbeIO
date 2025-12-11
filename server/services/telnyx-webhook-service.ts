import { db } from "../db";
import { wallets, telephonySettings, callLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import Decimal from "decimal.js";
import { chargeCallToWallet, findRateByPrefix, calculateCallCost } from "./pricing-service";
import { broadcastWalletUpdate, broadcastNewCallLog } from "../websocket";

Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

const PRICE_PER_MESSAGE = new Decimal("0.01");

interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id?: string;
      call_leg_id?: string;
      call_session_id?: string;
      connection_id?: string;
      from?: string;
      to?: string;
      direction?: string;
      state?: string;
      start_time?: string;
      end_time?: string;
      duration_secs?: number;
      hangup_cause?: string;
      hangup_source?: string;
      id?: string;
      text?: string;
      type?: string;
      messaging_profile_id?: string;
      owner_id?: string;
    };
    record_type: string;
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
}

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  timestamp: string,
  publicKey: string,
  tolerance: number = 300
): boolean {
  try {
    const now = Math.floor(Date.now() / 1000);
    const webhookTimestamp = parseInt(timestamp, 10);
    
    if (Math.abs(now - webhookTimestamp) > tolerance) {
      console.error("[Telnyx Webhook] Timestamp outside tolerance window");
      return false;
    }

    const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const signedPayload = `${timestamp}|${payload}`;
    
    const signatureBuffer = Buffer.from(signature, "base64");
    const publicKeyBuffer = Buffer.from(publicKey, "base64");
    
    const isValid = crypto.verify(
      null,
      Buffer.from(signedPayload),
      {
        key: publicKeyBuffer,
        format: "der",
        type: "spki",
      },
      signatureBuffer
    );

    if (!isValid) {
      console.error("[Telnyx Webhook] Invalid signature");
    }

    return isValid;
  } catch (error) {
    console.error("[Telnyx Webhook] Signature verification failed:", error);
    return false;
  }
}

async function getCompanyByConnectionId(connectionId: string): Promise<{ companyId: string; wallet: typeof wallets.$inferSelect } | null> {
  const [settings] = await db
    .select()
    .from(telephonySettings)
    .where(eq(telephonySettings.credentialConnectionId, connectionId));
  
  if (!settings) {
    console.log(`[Telnyx Webhook] No telephony settings found for connection: ${connectionId}`);
    return null;
  }

  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.companyId, settings.companyId));

  if (!wallet) {
    console.log(`[Telnyx Webhook] No wallet found for company: ${settings.companyId}`);
    return null;
  }

  return { companyId: settings.companyId, wallet };
}

async function getWalletByTelnyxAccountId(telnyxAccountId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.telnyxAccountId, telnyxAccountId));
  return wallet || null;
}

export async function handleCallInitiated(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const payload = event.data.payload;
  const connectionId = payload.connection_id;
  const from = payload.from || "";
  const to = payload.to || "";
  const direction = payload.direction || "outbound";
  const callControlId = payload.call_control_id;

  if (!connectionId) {
    console.error("[Telnyx Webhook] call.initiated missing connection_id");
    return { success: false, error: "Missing connection_id" };
  }

  console.log(`[Telnyx Webhook] call.initiated - from: ${from}, to: ${to}, direction: ${direction}`);

  const result = await getCompanyByConnectionId(connectionId);
  if (!result) {
    console.error(`[Telnyx Webhook] No company found for connection: ${connectionId}`);
    return { success: false, error: "Company not found" };
  }

  try {
    const [newLog] = await db.insert(callLogs).values({
      companyId: result.companyId,
      telnyxCallId: callControlId || event.data.id,
      fromNumber: from,
      toNumber: to,
      direction: direction as "inbound" | "outbound",
      status: "ringing",
      duration: 0,
      startedAt: new Date(),
    }).returning();

    console.log(`[Telnyx Webhook] Created call log: ${newLog.id} for call ${callControlId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Telnyx Webhook] Failed to create call log:", error);
    return { success: false, error: error.message };
  }
}

export async function handleCallAnswered(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const payload = event.data.payload;
  const callControlId = payload.call_control_id;

  if (!callControlId) {
    return { success: true };
  }

  console.log(`[Telnyx Webhook] call.answered - call: ${callControlId}`);

  try {
    await db.update(callLogs)
      .set({ status: "answered" })
      .where(eq(callLogs.telnyxCallId, callControlId));

    return { success: true };
  } catch (error: any) {
    console.error("[Telnyx Webhook] Failed to update call log:", error);
    return { success: false, error: error.message };
  }
}

export async function handleCallHangup(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const payload = event.data.payload;
  const durationSeconds = payload.duration_secs || 0;
  const connectionId = payload.connection_id;
  const callControlId = payload.call_control_id;
  const hangupCause = payload.hangup_cause || "normal";
  const from = payload.from || "";
  const to = payload.to || "";
  const direction = payload.direction || "outbound";

  console.log(`[Telnyx Webhook] call.hangup - duration: ${durationSeconds}s, connection: ${connectionId}, cause: ${hangupCause}`);

  if (!connectionId) {
    console.error("[Telnyx Webhook] call.hangup missing connection_id");
    return { success: false, error: "Missing connection_id" };
  }

  const result = await getCompanyByConnectionId(connectionId);
  if (!result) {
    console.error(`[Telnyx Webhook] No company found for connection: ${connectionId}`);
    return { success: false, error: "Company not found" };
  }

  let finalStatus: "answered" | "missed" | "busy" | "failed" | "no_answer" = "answered";
  if (hangupCause === "NO_ANSWER" || hangupCause === "ORIGINATOR_CANCEL") {
    finalStatus = durationSeconds > 0 ? "answered" : "no_answer";
  } else if (hangupCause === "USER_BUSY") {
    finalStatus = "busy";
  } else if (hangupCause === "CALL_REJECTED" || hangupCause === "DESTINATION_OUT_OF_ORDER") {
    finalStatus = "failed";
  } else if (durationSeconds === 0) {
    finalStatus = "missed";
  }

  const telnyxCallIdToUse = callControlId || event.data.id;
  
  try {
    const [existingLog] = await db.select()
      .from(callLogs)
      .where(eq(callLogs.telnyxCallId, telnyxCallIdToUse));

    let updatedLogId = existingLog?.id;

    if (existingLog) {
      await db.update(callLogs)
        .set({
          status: finalStatus,
          duration: durationSeconds,
          endedAt: new Date(),
          hangupCause: hangupCause,
        })
        .where(eq(callLogs.id, existingLog.id));
      console.log(`[Telnyx Webhook] Updated call log ${existingLog.id} to status=${finalStatus}, duration=${durationSeconds}s, cause=${hangupCause}`);
    } else {
      const [newLog] = await db.insert(callLogs).values({
        companyId: result.companyId,
        telnyxCallId: telnyxCallIdToUse,
        fromNumber: from,
        toNumber: to,
        direction: direction as "inbound" | "outbound",
        status: finalStatus,
        duration: durationSeconds,
        hangupCause: hangupCause,
        startedAt: new Date(Date.now() - durationSeconds * 1000),
        endedAt: new Date(),
      }).returning();
      updatedLogId = newLog.id;
      console.log(`[Telnyx Webhook] Created call log ${newLog.id} on hangup with cause=${hangupCause}`);
    }

    if (durationSeconds <= 0) {
      console.log("[Telnyx Webhook] Zero duration call, no charge applied");
      
      broadcastNewCallLog(result.companyId, {
        id: updatedLogId!,
        fromNumber: from,
        toNumber: to,
        direction: direction as "inbound" | "outbound",
        duration: 0,
        cost: "0.0000",
        status: finalStatus
      });
      
      return { success: true };
    }

    const chargeResult = await chargeCallToWallet(result.companyId, {
      telnyxCallId: telnyxCallIdToUse,
      fromNumber: from,
      toNumber: to,
      direction: direction as "inbound" | "outbound",
      durationSeconds,
      status: finalStatus,
      startedAt: new Date(Date.now() - durationSeconds * 1000),
      endedAt: new Date(),
    });

    if (!chargeResult.success) {
      console.error(`[Telnyx Webhook] Billing failed: ${chargeResult.error}`);
      
      if (chargeResult.insufficientFunds) {
        console.warn(`[Telnyx Webhook] Call completed but not billed (insufficient funds) - call log updated atomically`);
        
        broadcastNewCallLog(result.companyId, {
          id: chargeResult.callLogId || updatedLogId!,
          fromNumber: from,
          toNumber: to,
          direction: direction as "inbound" | "outbound",
          duration: durationSeconds,
          cost: "0.0000",
          status: "failed"
        });
        
        return { success: true };
      }
      
      broadcastNewCallLog(result.companyId, {
        id: updatedLogId!,
        fromNumber: from,
        toNumber: to,
        direction: direction as "inbound" | "outbound",
        duration: durationSeconds,
        cost: "0.0000",
        status: finalStatus
      });
      
      return { success: false, error: chargeResult.error };
    }

    console.log(`[Telnyx Webhook] Charged $${chargeResult.amountCharged}, balance: $${chargeResult.newBalance}`);

    broadcastWalletUpdate(result.companyId, {
      newBalance: chargeResult.newBalance!,
      lastCharge: chargeResult.amountCharged!,
      chargeType: "CALL_COST",
      description: `Call to ${to} (${durationSeconds}s)`
    });

    broadcastNewCallLog(result.companyId, {
      id: chargeResult.callLogId || updatedLogId!,
      fromNumber: from,
      toNumber: to,
      direction: direction as "inbound" | "outbound",
      duration: durationSeconds,
      cost: chargeResult.amountCharged!,
      status: finalStatus
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Telnyx Webhook] Failed to process call hangup:", error);
    return { success: false, error: error.message };
  }
}

export async function handleMessageSent(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const payload = event.data.payload;
  const ownerId = payload.owner_id;

  if (!ownerId) {
    console.error("[Telnyx Webhook] message.sent missing owner_id");
    return { success: false, error: "Missing owner_id" };
  }

  console.log(`[Telnyx Webhook] message.sent - owner: ${ownerId}`);

  const wallet = await getWalletByTelnyxAccountId(ownerId);
  if (!wallet) {
    console.error(`[Telnyx Webhook] No wallet found for owner: ${ownerId}`);
    return { success: false, error: "Wallet not found" };
  }

  try {
    const txResult = await db.transaction(async (tx) => {
      const [lockedWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, wallet.id))
        .for("update");
      
      if (!lockedWallet) {
        throw new Error(`Wallet not found: ${wallet.id}`);
      }

      const currentBalance = new Decimal(lockedWallet.balance);
      const newBalance = currentBalance.minus(PRICE_PER_MESSAGE);

      await tx
        .update(wallets)
        .set({ 
          balance: newBalance.toFixed(4),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      return { newBalance: newBalance.toFixed(4) };
    });

    console.log(`[Telnyx Webhook] ATOMIC: Charged $${PRICE_PER_MESSAGE.toFixed(4)} for SMS, new balance: $${txResult.newBalance}`);

    if (wallet.companyId) {
      broadcastWalletUpdate(wallet.companyId, {
        newBalance: txResult.newBalance,
        lastCharge: PRICE_PER_MESSAGE.toFixed(4),
        chargeType: "SMS_COST",
        description: "Outbound SMS"
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Telnyx Webhook] ATOMIC SMS CHARGE FAILED:", error);
    return { success: false, error: error.message };
  }
}

export async function handleMessageReceived(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const payload = event.data.payload;
  const ownerId = payload.owner_id;

  if (!ownerId) {
    console.error("[Telnyx Webhook] message.received missing owner_id");
    return { success: false, error: "Missing owner_id" };
  }

  console.log(`[Telnyx Webhook] message.received - owner: ${ownerId}`);

  const wallet = await getWalletByTelnyxAccountId(ownerId);
  if (!wallet) {
    console.error(`[Telnyx Webhook] No wallet found for owner: ${ownerId}`);
    return { success: false, error: "Wallet not found" };
  }

  try {
    const txResult = await db.transaction(async (tx) => {
      const [lockedWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, wallet.id))
        .for("update");
      
      if (!lockedWallet) {
        throw new Error(`Wallet not found: ${wallet.id}`);
      }

      const currentBalance = new Decimal(lockedWallet.balance);
      const newBalance = currentBalance.minus(PRICE_PER_MESSAGE);

      await tx
        .update(wallets)
        .set({ 
          balance: newBalance.toFixed(4),
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      return { newBalance: newBalance.toFixed(4) };
    });

    console.log(`[Telnyx Webhook] ATOMIC: Charged $${PRICE_PER_MESSAGE.toFixed(4)} for inbound SMS, new balance: $${txResult.newBalance}`);

    if (wallet.companyId) {
      broadcastWalletUpdate(wallet.companyId, {
        newBalance: txResult.newBalance,
        lastCharge: PRICE_PER_MESSAGE.toFixed(4),
        chargeType: "SMS_COST",
        description: "Inbound SMS"
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Telnyx Webhook] ATOMIC INBOUND SMS CHARGE FAILED:", error);
    return { success: false, error: error.message };
  }
}

export async function handleRecordingCompleted(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const payload = event.data.payload as any;
  const callControlId = payload.call_control_id || payload.call_leg_id;
  const recordingUrl = payload.recording_urls?.mp3 || payload.recording_url || payload.public_recording_urls?.mp3;

  console.log(`[Telnyx Webhook] call_recording.saved - call: ${callControlId}, url: ${recordingUrl ? 'present' : 'missing'}`);

  if (!callControlId || !recordingUrl) {
    console.error("[Telnyx Webhook] Recording missing call_control_id or recording_url");
    return { success: false, error: "Missing call_control_id or recording_url" };
  }

  try {
    const [updated] = await db
      .update(callLogs)
      .set({ 
        recordingUrl,
        recordingDuration: payload.recording_ended_at && payload.recording_started_at 
          ? Math.round((new Date(payload.recording_ended_at).getTime() - new Date(payload.recording_started_at).getTime()) / 1000)
          : null
      })
      .where(eq(callLogs.telnyxCallId, callControlId))
      .returning();

    if (updated) {
      console.log(`[Telnyx Webhook] Recording URL saved for call ${callControlId}`);
      
      if (updated.companyId) {
        broadcastNewCallLog(updated.companyId, {
          id: updated.id,
          fromNumber: updated.fromNumber || '',
          toNumber: updated.toNumber || '',
          direction: updated.direction as "inbound" | "outbound",
          duration: updated.duration || 0,
          cost: updated.cost || "0.0000",
          status: updated.status || 'answered',
          recordingUrl
        });
      }
    } else {
      console.warn(`[Telnyx Webhook] No call log found for recording: ${callControlId}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Telnyx Webhook] Failed to save recording URL:", error);
    return { success: false, error: error.message };
  }
}

export async function processWebhookEvent(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const eventType = event.data.event_type;

  console.log(`[Telnyx Webhook] Processing event: ${eventType}`);

  switch (eventType) {
    case "call.initiated":
      return handleCallInitiated(event);
    case "call.answered":
      return handleCallAnswered(event);
    case "call.hangup":
      return handleCallHangup(event);
    case "call_recording.saved":
    case "call.recording.saved":
    case "recording.completed":
      return handleRecordingCompleted(event);
    case "message.sent":
      return handleMessageSent(event);
    case "message.received":
      return handleMessageReceived(event);
    default:
      console.log(`[Telnyx Webhook] Unhandled event type: ${eventType}`);
      return { success: true };
  }
}
