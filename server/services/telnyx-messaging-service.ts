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
