import { db } from "../db";
import { wallets, telnyxPhoneNumbers, telnyxConversations, telnyxMessages } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { getTelnyxMasterApiKey, getCompanyTelnyxAccountId } from "./telnyx-numbers-service";
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
 * Save a message to the database and update conversation
 */
export async function saveOutboundMessage(
  companyId: string,
  userId: string,
  fromNumber: string,
  toNumber: string,
  text: string,
  telnyxMessageId?: string,
  mediaUrls?: string[]
): Promise<{ conversationId: string; messageId: string }> {
  // Normalize phone numbers
  const normalizedFrom = fromNumber.replace(/\D/g, '');
  const normalizedTo = toNumber.replace(/\D/g, '');
  
  // Find or create conversation
  let [conversation] = await db
    .select()
    .from(telnyxConversations)
    .where(
      and(
        eq(telnyxConversations.companyId, companyId),
        or(
          and(
            eq(telnyxConversations.phoneNumber, normalizedFrom),
            eq(telnyxConversations.contactNumber, normalizedTo)
          ),
          and(
            eq(telnyxConversations.phoneNumber, normalizedTo),
            eq(telnyxConversations.contactNumber, normalizedFrom)
          )
        )
      )
    );
  
  if (!conversation) {
    // Create new conversation
    const [newConversation] = await db
      .insert(telnyxConversations)
      .values({
        companyId,
        phoneNumber: normalizedFrom,
        contactNumber: normalizedTo,
        lastMessageAt: new Date(),
        lastMessagePreview: text.substring(0, 100),
        unreadCount: 0,
      })
      .returning();
    conversation = newConversation;
  }
  
  // Save message
  const [message] = await db
    .insert(telnyxMessages)
    .values({
      conversationId: conversation.id,
      companyId,
      direction: "outbound",
      fromNumber: normalizedFrom,
      toNumber: normalizedTo,
      body: text,
      telnyxMessageId: telnyxMessageId || null,
      status: "sent",
      mediaUrls: mediaUrls || null,
      sentBy: userId,
    })
    .returning();
  
  // Update conversation
  await db
    .update(telnyxConversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: text.substring(0, 100),
      updatedAt: new Date(),
    })
    .where(eq(telnyxConversations.id, conversation.id));
  
  return {
    conversationId: conversation.id,
    messageId: message.id,
  };
}

/**
 * Get available phone numbers for sending messages
 */
export async function getCompanyMessagingNumbers(companyId: string): Promise<Array<{ phoneNumber: string; label?: string }>> {
  const numbers = await db
    .select({
      phoneNumber: telnyxPhoneNumbers.phoneNumber,
      label: telnyxPhoneNumbers.label,
    })
    .from(telnyxPhoneNumbers)
    .where(eq(telnyxPhoneNumbers.companyId, companyId));
  
  return numbers;
}
