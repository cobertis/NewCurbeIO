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
      return { success: false, error: "Telnyx account not configured for this company" };
    }
    
    if (!messagingProfileId) {
      return { success: false, error: "Messaging profile not configured. Please set up SMS in Phone System settings." };
    }
    
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
    
    console.log(`[Telnyx Messaging] Sending ${payload.type} from ${from} to ${to}`);
    
    const response = await fetch(`${TELNYX_API_BASE}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Telnyx Messaging] Send error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Failed to send message: ${response.status}`,
      };
    }
    
    const result = await response.json();
    const messageId = result.data?.id;
    
    console.log(`[Telnyx Messaging] Message sent successfully - ID: ${messageId}`);
    
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
