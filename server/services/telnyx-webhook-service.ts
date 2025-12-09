import { db } from "../db";
import { wallets, telephonySettings, callLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { charge } from "./wallet-service";
import crypto from "crypto";

const PRICE_PER_MINUTE = 0.02;
const PRICE_PER_MESSAGE = 0.01;

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

async function getWalletByTelnyxAccountId(telnyxAccountId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.telnyxAccountId, telnyxAccountId));
  return wallet || null;
}

async function getCompanyByConnectionId(connectionId: string): Promise<{ companyId: string; wallet: typeof wallets.$inferSelect } | null> {
  // Look up telephony settings by credential connection ID
  const [settings] = await db
    .select()
    .from(telephonySettings)
    .where(eq(telephonySettings.credentialConnectionId, connectionId));
  
  if (!settings) {
    console.log(`[Telnyx Webhook] No telephony settings found for connection: ${connectionId}`);
    return null;
  }

  // Get the wallet for this company
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
    // Create call log entry when call starts with "ringing" status
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
    return { success: true }; // No call control ID, skip
  }

  console.log(`[Telnyx Webhook] call.answered - call: ${callControlId}`);

  try {
    // Update call log to answered
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

  // Determine final status based on hangup cause
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

  try {
    // Try to update existing call log
    const [existingLog] = await db.select()
      .from(callLogs)
      .where(eq(callLogs.telnyxCallId, callControlId || event.data.id));

    if (existingLog) {
      // Update existing call log
      await db.update(callLogs)
        .set({
          status: finalStatus,
          duration: durationSeconds,
          endedAt: new Date(),
        })
        .where(eq(callLogs.id, existingLog.id));
      console.log(`[Telnyx Webhook] Updated call log: ${existingLog.id}, status: ${finalStatus}, duration: ${durationSeconds}s`);
    } else {
      // Create new call log (in case we missed the initiated event)
      const [newLog] = await db.insert(callLogs).values({
        companyId: result.companyId,
        telnyxCallId: callControlId || event.data.id,
        fromNumber: from,
        toNumber: to,
        direction: direction as "inbound" | "outbound",
        status: finalStatus,
        duration: durationSeconds,
        startedAt: new Date(Date.now() - durationSeconds * 1000),
        endedAt: new Date(),
      }).returning();
      console.log(`[Telnyx Webhook] Created call log on hangup: ${newLog.id}, status: ${finalStatus}`);
    }
  } catch (error: any) {
    console.error("[Telnyx Webhook] Failed to save call log:", error);
    // Continue to charge anyway
  }

  // Calculate and charge for the call
  const durationMinutes = durationSeconds / 60;
  const cost = durationMinutes * PRICE_PER_MINUTE;

  if (cost <= 0) {
    console.log("[Telnyx Webhook] Zero duration call, no charge");
    return { success: true };
  }

  const chargeResult = await charge(
    result.wallet.id,
    cost,
    "CALL_COST",
    `Call charge: ${durationSeconds}s (${durationMinutes.toFixed(2)} min) @ $${PRICE_PER_MINUTE}/min`,
    event.data.id
  );

  if (!chargeResult.success) {
    console.error(`[Telnyx Webhook] Failed to charge wallet: ${chargeResult.error}`);
    return { success: false, error: chargeResult.error };
  }

  console.log(`[Telnyx Webhook] Charged $${cost.toFixed(4)} for call. New balance: $${chargeResult.newBalance}`);
  return { success: true };
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

  const result = await charge(
    wallet.id,
    PRICE_PER_MESSAGE,
    "SMS_COST",
    `Outbound SMS charge @ $${PRICE_PER_MESSAGE}`,
    event.data.id
  );

  if (!result.success) {
    console.error(`[Telnyx Webhook] Failed to charge wallet: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`[Telnyx Webhook] Charged $${PRICE_PER_MESSAGE.toFixed(4)} for message. New balance: $${result.newBalance}`);
  return { success: true };
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

  const result = await charge(
    wallet.id,
    PRICE_PER_MESSAGE,
    "SMS_COST",
    `Inbound SMS charge @ $${PRICE_PER_MESSAGE}`,
    event.data.id
  );

  if (!result.success) {
    console.error(`[Telnyx Webhook] Failed to charge wallet: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`[Telnyx Webhook] Charged $${PRICE_PER_MESSAGE.toFixed(4)} for message. New balance: $${result.newBalance}`);
  return { success: true };
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
    case "message.sent":
      return handleMessageSent(event);
    case "message.received":
      return handleMessageReceived(event);
    default:
      console.log(`[Telnyx Webhook] Unhandled event type: ${eventType}`);
      return { success: true };
  }
}
