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

interface MetaUserProfile {
  name: string | null;
  profilePictureUrl: string | null;
}

async function getFacebookUserProfile(psid: string, pageAccessToken: string): Promise<MetaUserProfile> {
  const result: MetaUserProfile = { name: null, profilePictureUrl: null };
  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${psid}?fields=name,first_name,last_name,profile_pic&access_token=${pageAccessToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Meta Webhook Worker] Failed to get user profile for ${psid}: ${response.status}`);
      return result;
    }
    const data = await response.json() as any;
    result.name = data.name || data.first_name || null;
    result.profilePictureUrl = data.profile_pic || null;
    return result;
  } catch (error) {
    console.error(`[Meta Webhook Worker] Error fetching user profile for ${psid}:`, error);
    return result;
  }
}

async function getInstagramUserProfile(igScopedId: string, pageAccessToken: string): Promise<MetaUserProfile> {
  const result: MetaUserProfile = { name: null, profilePictureUrl: null };
  try {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${igScopedId}?fields=name,username,profile_pic&access_token=${pageAccessToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[Meta Webhook Worker] Failed to get Instagram user profile for ${igScopedId}: ${response.status}`);
      return result;
    }
    const data = await response.json() as any;
    result.name = data.name || data.username || null;
    result.profilePictureUrl = data.profile_pic || null;
    return result;
  } catch (error) {
    console.error(`[Meta Webhook Worker] Error fetching Instagram user profile for ${igScopedId}:`, error);
    return result;
  }
}

const WEBHOOK_POLL_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 5;

let webhookIntervalId: ReturnType<typeof setInterval> | null = null;

async function processWebhookEvent(event: typeof fbWebhookEvents.$inferSelect): Promise<void> {
  const payload = event.payload as any;
  
  if (!payload?.entry) {
    console.log("[Meta Webhook Worker] No entries in payload");
    return;
  }

  const eventType = payload.object;
  
  if (eventType === "instagram") {
    await processInstagramEvent(payload);
  } else if (eventType === "page") {
    await processFacebookEvent(payload);
  } else {
    console.log(`[Meta Webhook Worker] Unknown event type: ${eventType}`);
  }
}

async function processInstagramEvent(payload: any): Promise<void> {
  for (const entry of payload.entry) {
    const igAccountId = entry.id;
    const messaging = entry.messaging || [];
    
    for (const msgEvent of messaging) {
      const senderId = msgEvent.sender?.id;
      const recipientId = msgEvent.recipient?.id;
      const message = msgEvent.message;
      const timestamp = msgEvent.timestamp;
      
      if (!message || !senderId || !recipientId) {
        continue;
      }

      const connection = await db.query.channelConnections.findFirst({
        where: and(
          eq(channelConnections.igUserId, igAccountId),
          eq(channelConnections.channel, "instagram"),
          eq(channelConnections.status, "active")
        ),
      });

      if (!connection) {
        console.log(`[Meta Webhook Worker] No Instagram connection found for igAccountId: ${igAccountId}`);
        continue;
      }

      const companyId = connection.companyId;
      const customerIgId = senderId === igAccountId ? recipientId : senderId;
      const isInbound = senderId !== igAccountId;

      if (!isInbound) {
        continue;
      }

      const messageId = message.mid;
      const messageText = message.text || "";
      const attachments = message.attachments || [];

      const dedupeKey = `ig_msg:${messageId}`;
      try {
        const result = await db.execute(sql`
          INSERT INTO wa_webhook_dedupe (company_id, dedupe_key, event_type)
          VALUES (${companyId}, ${dedupeKey}, 'inbound_message')
          ON CONFLICT (company_id, dedupe_key, event_type) DO NOTHING
          RETURNING id
        `);
        
        if (!result.rows || result.rows.length === 0) {
          console.log(`[Meta Webhook Worker] Duplicate Instagram message skipped: ${messageId}`);
          continue;
        }
      } catch (dedupeErr) {
        console.log(`[Meta Webhook Worker] Dedupe check failed for ${messageId}, processing anyway`);
      }

      const companyPhone = connection.igUsername || connection.displayName || igAccountId;
      const lastMessageValue = messageText || (attachments.length > 0 ? `[${attachments[0]?.type || 'attachment'}]` : "[message]");
      const messageTimestamp = timestamp ? new Date(timestamp) : new Date();

      let customerName: string | null = null;
      let profilePictureUrl: string | null = null;
      if (connection.accessTokenEnc) {
        try {
          const pageToken = decryptToken(connection.accessTokenEnc);
          const profile = await getInstagramUserProfile(customerIgId, pageToken);
          customerName = profile.name;
          profilePictureUrl = profile.profilePictureUrl;
          if (customerName) {
            console.log(`[Meta Webhook Worker] Got Instagram user profile: ${customerName} for ID: ${customerIgId}`);
          }
        } catch (profileErr) {
          console.log(`[Meta Webhook Worker] Could not fetch Instagram profile (token issue), continuing without profile`);
        }
      }

      const upsertResult = await db.execute<typeof telnyxConversations.$inferSelect>(sql`
        INSERT INTO telnyx_conversations 
          (company_id, phone_number, company_phone_number, channel, display_name, profile_picture_url, status, unread_count, last_message, last_message_at)
        VALUES 
          (${companyId}, ${customerIgId}, ${companyPhone}, 'instagram', ${customerName}, ${profilePictureUrl}, 'open', 1, ${lastMessageValue}, ${messageTimestamp})
        ON CONFLICT (company_id, phone_number, company_phone_number, channel) 
        DO UPDATE SET
          unread_count = telnyx_conversations.unread_count + 1,
          last_message = ${lastMessageValue},
          last_message_at = ${messageTimestamp},
          display_name = COALESCE(telnyx_conversations.display_name, ${customerName}),
          profile_picture_url = COALESCE(telnyx_conversations.profile_picture_url, ${profilePictureUrl}),
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
            eq(telnyxConversations.phoneNumber, customerIgId),
            eq(telnyxConversations.channel, "instagram")
          ),
        });
        
        if (!found) {
          console.error(`[Meta Webhook Worker] Failed to find/create Instagram conversation for ${customerIgId}`);
          throw new Error(`Failed to upsert Instagram conversation for ${customerIgId}`);
        }
        inboxConversation = found;
      }

      let mediaUrls: string[] | null = null;
      if (attachments.length > 0) {
        mediaUrls = attachments.map((att: any) => {
          if (att.payload?.url) {
            return att.payload.url;
          }
          return `ig_media:${JSON.stringify({
            type: att.type,
            payload: att.payload
          })}`;
        });
      }

      await db.insert(telnyxMessages).values({
        conversationId: inboxConversation.id,
        direction: "inbound",
        messageType: "incoming",
        channel: "instagram",
        text: messageText || (attachments.length > 0 ? `[${attachments[0]?.type}]` : "[message]"),
        contentType: attachments.length > 0 ? "media" : "text",
        mediaUrls: mediaUrls,
        status: "delivered",
        telnyxMessageId: messageId,
        deliveredAt: messageTimestamp,
      });

      broadcastNewMessage(customerIgId, {
        conversationId: inboxConversation.id,
        channel: "instagram",
        text: messageText,
      }, companyId);

      console.log(`[Meta Webhook Worker] Saved inbound Instagram message to inbox: ${messageId}`);
    }
  }
}

async function processFacebookEvent(payload: any): Promise<void> {
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
        console.log(`[Meta Webhook Worker] No Facebook connection found for pageId: ${fbPageId}`);
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
          console.log(`[Meta Webhook Worker] Duplicate Facebook message skipped: ${messageId}`);
          continue;
        }
      } catch (dedupeErr) {
        console.log(`[Meta Webhook Worker] Dedupe check failed for ${messageId}, processing anyway`);
      }

      const companyPhone = connection.fbPageName || fbPageId;
      const lastMessageValue = messageText || (attachments.length > 0 ? `[${attachments[0]?.type || 'attachment'}]` : "[message]");
      const messageTimestamp = timestamp ? new Date(timestamp) : new Date();

      let customerName: string | null = null;
      let profilePictureUrl: string | null = null;
      if (connection.fbPageAccessToken) {
        const pageToken = connection.fbPageAccessToken;
        const profile = await getFacebookUserProfile(customerPsid, pageToken);
        customerName = profile.name;
        profilePictureUrl = profile.profilePictureUrl;
        if (customerName) {
          console.log(`[Meta Webhook Worker] Got Facebook user profile: ${customerName} for PSID: ${customerPsid}`);
        }
      }

      const upsertResult = await db.execute<typeof telnyxConversations.$inferSelect>(sql`
        INSERT INTO telnyx_conversations 
          (company_id, phone_number, company_phone_number, channel, display_name, profile_picture_url, status, unread_count, last_message, last_message_at)
        VALUES 
          (${companyId}, ${customerPsid}, ${companyPhone}, 'facebook', ${customerName}, ${profilePictureUrl}, 'open', 1, ${lastMessageValue}, ${messageTimestamp})
        ON CONFLICT (company_id, phone_number, company_phone_number, channel) 
        DO UPDATE SET
          unread_count = telnyx_conversations.unread_count + 1,
          last_message = ${lastMessageValue},
          last_message_at = ${messageTimestamp},
          display_name = COALESCE(telnyx_conversations.display_name, ${customerName}),
          profile_picture_url = COALESCE(telnyx_conversations.profile_picture_url, ${profilePictureUrl}),
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
          console.error(`[Meta Webhook Worker] Failed to find/create Facebook conversation for ${customerPsid}`);
          throw new Error(`Failed to upsert Facebook conversation for ${customerPsid}`);
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

      console.log(`[Meta Webhook Worker] Saved inbound Facebook message to inbox: ${messageId}`);
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
        console.error(`[Meta Webhook Worker] Error processing event ${event.id}:`, error);
        
        const newStatus = event.attempt >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await db.execute(sql`
          UPDATE fb_webhook_events
          SET status = ${newStatus}, last_error = ${error.message || 'Unknown error'}
          WHERE id = ${event.id}
        `);
      }
    }
  } catch (error) {
    console.error("[Meta Webhook Worker] Poll error:", error);
  }
}

export function startFacebookWebhookWorker(): void {
  if (webhookIntervalId) {
    console.log("[Meta Webhook Worker] Already running");
    return;
  }

  console.log("[Meta Webhook Worker] Starting (handles Facebook + Instagram)...");
  webhookIntervalId = setInterval(pollWebhookEvents, WEBHOOK_POLL_INTERVAL_MS);
}

export function stopFacebookWebhookWorker(): void {
  if (webhookIntervalId) {
    clearInterval(webhookIntervalId);
    webhookIntervalId = null;
    console.log("[Meta Webhook Worker] Stopped");
  }
}
