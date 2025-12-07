import { db } from "../db";
import { wallets } from "@shared/schema";
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

async function getWalletByConnectionId(connectionId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.telnyxAccountId, connectionId));
  return wallet || null;
}

export async function handleCallHangup(event: TelnyxWebhookEvent): Promise<{ success: boolean; error?: string }> {
  const payload = event.data.payload;
  const durationSeconds = payload.duration_secs || 0;
  const connectionId = payload.connection_id;

  if (!connectionId) {
    console.error("[Telnyx Webhook] call.hangup missing connection_id");
    return { success: false, error: "Missing connection_id" };
  }

  console.log(`[Telnyx Webhook] call.hangup - duration: ${durationSeconds}s, connection: ${connectionId}`);

  const wallet = await getWalletByConnectionId(connectionId);
  if (!wallet) {
    console.error(`[Telnyx Webhook] No wallet found for connection: ${connectionId}`);
    return { success: false, error: "Wallet not found" };
  }

  const durationMinutes = durationSeconds / 60;
  const cost = durationMinutes * PRICE_PER_MINUTE;

  if (cost <= 0) {
    console.log("[Telnyx Webhook] Zero duration call, no charge");
    return { success: true };
  }

  const result = await charge(
    wallet.id,
    cost,
    "CALL_COST",
    `Call charge: ${durationSeconds}s (${durationMinutes.toFixed(2)} min) @ $${PRICE_PER_MINUTE}/min`,
    event.data.id
  );

  if (!result.success) {
    console.error(`[Telnyx Webhook] Failed to charge wallet: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`[Telnyx Webhook] Charged $${cost.toFixed(4)} for call. New balance: $${result.newBalance}`);
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
