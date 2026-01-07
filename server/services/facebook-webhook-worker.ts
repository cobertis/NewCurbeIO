import { db } from "../db";
import {
  fbWebhookEvents,
  channelConnections,
  telnyxConversations,
  telnyxMessages,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { broadcastNewMessage } from "../websocket";
import { decryptToken } from "../crypto";

const META_GRAPH_VERSION = "v21.0";

async function getFacebookUserProfile(psid: string, pageAccessToken: string): Promise<string | null> {
  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${psid}?fields=name,first_name,last_name&access_token=${pageAccessToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Facebook Webhook Worker] Failed to get user profile for ${psid}: ${response.status}`);
      return null;
    }
    const data = await response.json() as any;
    return data.name || data.first_name || null;
  } catch (error) {
    console.error(`[Facebook Webhook Worker] Error fetching user profile for ${psid}:`, error);
    return null;
  }
}

const WEBHOOK_POLL_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 5;

let webhookIntervalId: ReturnType<typeof setInterval> | null = null;

async function processWebhookEvent(event: typeof fbWebhookEvents.$inferSelect): Promise<void> {
  const payload = event.payload as any;
  
  if (!payload?.entry) {
    console.log("[Facebook Webhook Worker] No entries in payload");
    return;
  }

  for (const entry of payload.entry) {
    const pageId = entry.id;
    const messaging = entry.messaging || [];
    
    for (const msgEvent of messaging) {
      const senderId = msgEvent.sender?.id;
      const recipientId = msgEvent.recipient?.id;
      const message = msgEvent.message;
      const timestamp = msgEvent.timestamp;
      
      if (!message || !senderId || !recipientId) {
        continue;
      }

      const fbPageId = recipientId === pageId ? recipientId : senderId === pageId ? senderId : pageId;
      
      const connection = await db.query.channelConnections.findFirst({
        where: and(
          eq(channelConnections.fbPageId, fbPageId),
          eq(channelConnections.channel, "facebook"),
          eq(channelConnections.status, "active")
        ),
      });

      if (!connection) {
        console.log(`[Facebook Webhook Worker] No connection found for pageId: ${fbPageId}`);
        continue;
      }

      const companyId = connection.companyId;
      const customerPsid = senderId === fbPageId ? recipientId : senderId;
      const isInbound = senderId !== fbPageId;

      if (!isInbound) {
        continue;
      }

      const messageId = message.mid;
      const messageText = message.text || "";
      const attachments = message.attachments || [];

      const dedupeKey = `fb_msg:${messageId}`;
      try {
        const result = await db.execute(sql`
          INSERT INTO wa_webhook_dedupe (company_id, dedupe_key, event_type)
          VALUES (${companyId}, ${dedupeKey}, 'inbound_message')
          ON CONFLICT (company_id, dedupe_key, event_type) DO NOTHING
          RETURNING id
        `);
        
        if (!result.rows || result.rows.length === 0) {
          console.log(`[Facebook Webhook Worker] Duplicate message skipped: ${messageId}`);
          continue;
        }
      } catch (dedupeErr) {
        console.log(`[Facebook Webhook Worker] Dedupe check failed for ${messageId}, processing anyway`);
      }

      const companyPhone = connection.fbPageName || fbPageId;
      const lastMessageValue = messageText || (attachments.length > 0 ? `[${attachments[0]?.type || 'attachment'}]` : "[message]");
      const messageTimestamp = timestamp ? new Date(timestamp) : new Date();

      // Get user's name from Facebook Graph API
      let customerName: string | null = null;
      if (connection.fbPageAccessToken) {
        const pageToken = decryptToken(connection.fbPageAccessToken);
        customerName = await getFacebookUserProfile(customerPsid, pageToken);
        if (customerName) {
          console.log(`[Facebook Webhook Worker] Got user name: ${customerName} for PSID: ${customerPsid}`);
        }
      }

      const upsertResult = await db.execute<typeof telnyxConversations.$inferSelect>(sql`
        INSERT INTO telnyx_conversations 
          (company_id, phone_number, company_phone_number, channel, display_name, status, unread_count, last_message, last_message_at)
        VALUES 
          (${companyId}, ${customerPsid}, ${companyPhone}, 'facebook', ${customerName}, 'open', 1, ${lastMessageValue}, ${messageTimestamp})
        ON CONFLICT (company_id, phone_number, company_phone_number, channel) 
        DO UPDATE SET
          unread_count = telnyx_conversations.unread_count + 1,
          last_message = ${lastMessageValue},
          last_message_at = ${messageTimestamp},
          display_name = COALESCE(telnyx_conversations.display_name, ${customerName}),
          status = CASE 
            WHEN telnyx_conversations.status IN ('solved', 'archived') THEN 'open'
            ELSE telnyx_conversations.status
          END,
          updated_at = NOW()
        RETURNING *
      `);
      
      let inboxConversation: typeof telnyxConversations.$inferSelect | undefined = upsertResult.rows?.[0];
      
      if (!inboxConversation) {
        const found = await db.query.telnyxConversations.findFirst({
          where: and(
            eq(telnyxConversations.companyId, companyId),
            eq(telnyxConversations.phoneNumber, customerPsid),
            eq(telnyxConversations.channel, "facebook")
          ),
        });
        
        if (!found) {
          console.error(`[Facebook Webhook Worker] Failed to find/create conversation for ${customerPsid}`);
          throw new Error(`Failed to upsert conversation for ${customerPsid}`);
        }
        inboxConversation = found;
      }

      let mediaUrls: string[] | null = null;
      if (attachments.length > 0) {
        mediaUrls = attachments.map((att: any) => {
          if (att.payload?.url) {
            return att.payload.url;
          }
          return `fb_media:${JSON.stringify({
            type: att.type,
            payload: att.payload
          })}`;
        });
      }

      await db.insert(telnyxMessages).values({
        conversationId: inboxConversation.id,
        direction: "inbound",
        messageType: "incoming",
        channel: "facebook",
        text: messageText || (attachments.length > 0 ? `[${attachments[0]?.type}]` : "[message]"),
        contentType: attachments.length > 0 ? "media" : "text",
        mediaUrls: mediaUrls,
        status: "delivered",
        telnyxMessageId: messageId,
        deliveredAt: messageTimestamp,
      });

      broadcastNewMessage(customerPsid, {
        conversationId: inboxConversation.id,
        channel: "facebook",
        text: messageText,
      }, companyId);

      console.log(`[Facebook Webhook Worker] Saved inbound message to inbox: ${messageId}`);
    }
  }
}

async function pollWebhookEvents(): Promise<void> {
  try {
    const events = await db.execute<typeof fbWebhookEvents.$inferSelect>(sql`
      UPDATE fb_webhook_events
      SET status = 'processing', attempt = attempt + 1
      WHERE id IN (
        SELECT id FROM fb_webhook_events
        WHERE status = 'pending'
        ORDER BY received_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    if (!events.rows || events.rows.length === 0) {
      return;
    }

    for (const event of events.rows) {
      try {
        await processWebhookEvent(event);
        
        await db.execute(sql`
          UPDATE fb_webhook_events
          SET status = 'done', processed_at = NOW()
          WHERE id = ${event.id}
        `);
      } catch (error: any) {
        console.error(`[Facebook Webhook Worker] Error processing event ${event.id}:`, error);
        
        const newStatus = event.attempt >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await db.execute(sql`
          UPDATE fb_webhook_events
          SET status = ${newStatus}, last_error = ${error.message || 'Unknown error'}
          WHERE id = ${event.id}
        `);
      }
    }
  } catch (error) {
    console.error("[Facebook Webhook Worker] Poll error:", error);
  }
}

export function startFacebookWebhookWorker(): void {
  if (webhookIntervalId) {
    console.log("[Facebook Webhook Worker] Already running");
    return;
  }

  console.log("[Facebook Webhook Worker] Starting...");
  webhookIntervalId = setInterval(pollWebhookEvents, WEBHOOK_POLL_INTERVAL_MS);
}

export function stopFacebookWebhookWorker(): void {
  if (webhookIntervalId) {
    clearInterval(webhookIntervalId);
    webhookIntervalId = null;
    console.log("[Facebook Webhook Worker] Stopped");
  }
}
