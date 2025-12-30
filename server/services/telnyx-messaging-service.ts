import { db } from "../db";
import { wallets, telnyxPhoneNumbers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getTelnyxMasterApiKey } from "./telnyx-numbers-service";
import { getCompanyTelnyxAccountId } from "./wallet-service";
import { getCompanyMessagingProfileId } from "./telnyx-manager-service";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

export interface SendMessageParams {
  from: string;
  to: string;
  text: string;
  mediaUrls?: string[];
  companyId: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS/MMS message using Telnyx Long Code
 * Reference: https://developers.telnyx.com/api-reference/messages/send-a-long-code-message
 */
export async function sendTelnyxMessage(params: SendMessageParams): Promise<SendMessageResult> {
  try {
    const { from, to, text, mediaUrls, companyId } = params;
    
    const apiKey = await getTelnyxMasterApiKey();
    const managedAccountId = await getCompanyTelnyxAccountId(companyId);
    const messagingProfileId = await getCompanyMessagingProfileId(companyId);
    
    if (!managedAccountId) {
      console.error(`[Telnyx Messaging] SEND FAILED: No Telnyx account for company ${companyId}`);
      return { success: false, error: "Telnyx account not configured for this company" };
    }
    
    if (!messagingProfileId) {
      console.error(`[Telnyx Messaging] SEND FAILED: No messaging profile for company ${companyId}`);
      return { success: false, error: "Messaging profile not configured. Please set up SMS in Phone System settings." };
    }
    
    console.log(`[Telnyx Messaging] Config: companyId=${companyId}, managedAccount=${managedAccountId}, messagingProfile=${messagingProfileId}`);
    
    // Build headers with managed account
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (managedAccountId !== "MASTER_ACCOUNT") {
      headers["x-managed-account-id"] = managedAccountId;
    }
    
    // Build message payload
    const payload: any = {
      from,
      to,
      text,
      messaging_profile_id: messagingProfileId,
      type: "SMS",
    };
    
    // Add media URLs for MMS
    if (mediaUrls && mediaUrls.length > 0) {
      payload.media_urls = mediaUrls;
      payload.type = "MMS";
    }
    
    console.log(`[Telnyx Messaging] Sending ${payload.type}: from=${from}, to=${to}, textLen=${text.length}, profile=${messagingProfileId}`);
    
    const response = await fetch(`${TELNYX_API_BASE}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Messaging] SEND FAILED: HTTP ${response.status}`);
      console.error(`[Telnyx Messaging] Error details: ${errorText}`);
      console.error(`[Telnyx Messaging] Failed request: from=${from}, to=${to}, profile=${messagingProfileId}`);
      return {
        success: false,
        error: `Failed to send message: ${response.status} - ${errorText}`,
      };
    }
    
    const result = await response.json();
    const messageId = result.data?.id;
    
    console.log(`[Telnyx Messaging] SUCCESS: Message ${messageId} sent from ${from} to ${to}`);
    
    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error("[Telnyx Messaging] Error sending message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send message",
    };
  }
}

export interface SendRcsMessageParams {
  agentId: string;
  to: string;
  text?: string;
  mediaUrl?: string;
  companyId: string;
}

/**
 * Send an RCS message using Telnyx RCS API
 * Reference: https://developers.telnyx.com/api-reference/rcs/send-an-rcs-message
 */
export async function sendRcsMessage(params: SendRcsMessageParams): Promise<SendMessageResult> {
  try {
    const { agentId, to, text, mediaUrl, companyId } = params;
    
    const apiKey = await getTelnyxMasterApiKey();
    const managedAccountId = await getCompanyTelnyxAccountId(companyId);
    
    if (!managedAccountId) {
      return { success: false, error: "Telnyx account not configured" };
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (managedAccountId !== "MASTER_ACCOUNT") {
      headers["x-managed-account-id"] = managedAccountId;
    }
    
    const payload: any = {
      agent_id: agentId,
      to,
    };
    
    if (text) payload.text = text;
    if (mediaUrl) {
      payload.media = { type: "image", url: mediaUrl };
    }
    
    console.log(`[Telnyx RCS] Sending: agentId=${agentId}, to=${to}`);
    
    const response = await fetch(`${TELNYX_API_BASE}/rcs/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx RCS] SEND FAILED: ${response.status} - ${errorText}`);
      return { success: false, error: `RCS send failed: ${errorText}` };
    }
    
    const result = await response.json();
    console.log(`[Telnyx RCS] SUCCESS: ${result.data?.id}`);
    
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("[Telnyx RCS] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "RCS send failed" };
  }
}

/**
 * Get available phone numbers for sending messages
 */
export async function getCompanyMessagingNumbers(companyId: string): Promise<Array<{ phoneNumber: string }>> {
  const numbers = await db
    .select({
      phoneNumber: telnyxPhoneNumbers.phoneNumber,
    })
    .from(telnyxPhoneNumbers)
    .where(eq(telnyxPhoneNumbers.companyId, companyId));
  
  return numbers;
}

const OTP_SENDER_PHONE = "+13053936666";

/**
 * Send OTP SMS using the master Telnyx account
 * Always uses +13053936666 (master account javier@curbe.io) as the sender
 */
export async function sendTelnyxOtpSms(toPhoneNumber: string, otpCode: string): Promise<boolean> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    if (!apiKey) {
      console.error("[Telnyx OTP] No master API key configured");
      return false;
    }
    
    // Ensure phone number is in E.164 format (starts with +)
    let formattedPhone = toPhoneNumber.replace(/\D/g, ''); // Remove non-digits
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    
    const message = `Your Curbe.io verification code is: ${otpCode}`;
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    const payload = {
      from: OTP_SENDER_PHONE,
      to: formattedPhone,
      text: message,
      type: "SMS",
    };
    
    console.log(`[Telnyx OTP] Sending OTP to ${formattedPhone} from ${OTP_SENDER_PHONE}`);
    
    const response = await fetch(`${TELNYX_API_BASE}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx OTP] SEND FAILED: HTTP ${response.status}`);
      console.error(`[Telnyx OTP] Error details: ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    const messageId = result.data?.id;
    
    console.log(`[Telnyx OTP] SUCCESS: Message ${messageId} sent to ${toPhoneNumber}`);
    return true;
  } catch (error) {
    console.error("[Telnyx OTP] Error sending OTP:", error);
    return false;
  }
}
