import { db } from "../db";
import {
  waWebhookEvents,
  waWebhookDedupe,
  waSendOutbox,
  waMessages,
  waConversations,
  channelConnections,
} from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { decryptToken } from "../crypto";

const WEBHOOK_POLL_INTERVAL_MS = 500;
const SEND_POLL_INTERVAL_MS = 500;
const MAX_CONCURRENCY_PER_TENANT = 2;
const MAX_SEND_ATTEMPTS = 8;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

let webhookIntervalId: ReturnType<typeof setInterval> | null = null;
let sendIntervalId: ReturnType<typeof setInterval> | null = null;

function calculateBackoffSeconds(attempts: number): number {
  return Math.min(300, Math.pow(2, attempts) * 5);
}

function isAuthError(error: any): boolean {
  if (!error) return false;
  const code = error.code || error.error?.code;
  const message = (error.message || error.error?.message || "").toLowerCase();
  const authErrorCodes = [190, 102, 10];
  if (authErrorCodes.includes(code)) return true;
  if (
    message.includes("token") ||
    message.includes("expired") ||
    message.includes("invalid") ||
    message.includes("unauthorized") ||
    message.includes("authentication")
  ) {
    return true;
  }
  return false;
}

async function processWebhookEvent(event: typeof waWebhookEvents.$inferSelect): Promise<void> {
  const payload = event.payload as any;
  
  if (!payload?.entry) {
    console.log("[WhatsApp Webhook Worker] No entries in payload");
    return;
  }

  for (const entry of payload.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== "messages") continue;
      
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      
      if (!phoneNumberId) continue;

      const connection = await db.query.channelConnections.findFirst({
        where: and(
          eq(channelConnections.phoneNumberId, phoneNumberId),
          eq(channelConnections.status, "active")
        ),
      });

      if (!connection) {
        console.log(`[WhatsApp Webhook Worker] No connection found for phoneNumberId: ${phoneNumberId}`);
        continue;
      }

      const companyId = connection.companyId;

      if (value.messages && Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const dedupeKey = `msg:${msg.id}`;
          try {
            await db.insert(waWebhookDedupe).values({
              companyId,
              dedupeKey,
              eventType: "inbound_message",
            }).onConflictDoNothing();

            const inserted = await db.query.waWebhookDedupe.findFirst({
              where: and(
                eq(waWebhookDedupe.companyId, companyId),
                eq(waWebhookDedupe.dedupeKey, dedupeKey),
                eq(waWebhookDedupe.eventType, "inbound_message")
              ),
            });

            if (!inserted) {
              console.log(`[WhatsApp Webhook Worker] Duplicate message skipped: ${msg.id}`);
              continue;
            }
          } catch (dedupeErr) {
            console.log(`[WhatsApp Webhook Worker] Dedupe check failed for ${msg.id}, processing anyway`);
          }

          const contactWaId = msg.from;
          const contactName = value.contacts?.[0]?.profile?.name || contactWaId;
          const externalThreadId = contactWaId;

          let conversation = await db.query.waConversations.findFirst({
            where: and(
              eq(waConversations.connectionId, connection.id),
              eq(waConversations.externalThreadId, externalThreadId)
            ),
          });

          if (!conversation) {
            const [newConv] = await db.insert(waConversations).values({
              companyId,
              connectionId: connection.id,
              externalThreadId,
              contactWaId,
              contactName,
              unreadCount: 1,
              lastMessageAt: new Date(),
              lastMessagePreview: msg.text?.body || msg.type,
            }).returning();
            conversation = newConv;
            console.log(`[WhatsApp Webhook Worker] Created conversation: ${conversation.id}`);
          } else {
            await db.update(waConversations)
              .set({
                unreadCount: sql`${waConversations.unreadCount} + 1`,
                lastMessageAt: new Date(),
                lastMessagePreview: msg.text?.body || msg.type,
                contactName: contactName || conversation.contactName,
                updatedAt: new Date(),
              })
              .where(eq(waConversations.id, conversation.id));
          }

          const messageType = msg.type || "text";
          let textBody = null;
          let mediaUrl = null;
          let mediaMimeType = null;

          if (msg.text) {
            textBody = msg.text.body;
          } else if (msg.image) {
            mediaUrl = msg.image.id;
            mediaMimeType = msg.image.mime_type;
            textBody = msg.image.caption || null;
          } else if (msg.video) {
            mediaUrl = msg.video.id;
            mediaMimeType = msg.video.mime_type;
            textBody = msg.video.caption || null;
          } else if (msg.audio) {
            mediaUrl = msg.audio.id;
            mediaMimeType = msg.audio.mime_type;
          } else if (msg.document) {
            mediaUrl = msg.document.id;
            mediaMimeType = msg.document.mime_type;
            textBody = msg.document.filename || msg.document.caption || null;
          } else if (msg.sticker) {
            mediaUrl = msg.sticker.id;
            mediaMimeType = msg.sticker.mime_type;
          } else if (msg.location) {
            textBody = `Location: ${msg.location.latitude}, ${msg.location.longitude}`;
          } else if (msg.contacts) {
            textBody = `Contact: ${msg.contacts[0]?.name?.formatted_name || "Unknown"}`;
          }

          await db.insert(waMessages).values({
            companyId,
            connectionId: connection.id,
            conversationId: conversation.id,
            providerMessageId: msg.id,
            direction: "inbound",
            status: "delivered",
            messageType,
            textBody,
            mediaUrl,
            mediaMimeType,
            payload: msg,
            timestamp: new Date(parseInt(msg.timestamp) * 1000),
          });

          console.log(`[WhatsApp Webhook Worker] Saved inbound message: ${msg.id}`);
        }
      }

      if (value.statuses && Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          const dedupeKey = `status:${status.id}:${status.status}`;
          try {
            await db.insert(waWebhookDedupe).values({
              companyId,
              dedupeKey,
              eventType: "status_update",
            }).onConflictDoNothing();
          } catch {
          }

          const newStatus = status.status;
          const providerMessageId = status.id;

          const updateData: any = {};
          if (newStatus === "sent") {
            updateData.status = "sent";
            updateData.sentAt = new Date(parseInt(status.timestamp) * 1000);
          } else if (newStatus === "delivered") {
            updateData.status = "delivered";
            updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
          } else if (newStatus === "read") {
            updateData.status = "read";
            updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
          } else if (newStatus === "failed") {
            updateData.status = "failed";
            updateData.errorMessage = status.errors?.[0]?.message || "Unknown error";
          }

          if (Object.keys(updateData).length > 0) {
            await db.update(waMessages)
              .set(updateData)
              .where(
                and(
                  eq(waMessages.connectionId, connection.id),
                  eq(waMessages.providerMessageId, providerMessageId)
                )
              );
            console.log(`[WhatsApp Webhook Worker] Updated message status: ${providerMessageId} -> ${newStatus}`);
          }
        }
      }
    }
  }
}

async function pollWebhookEvents(): Promise<void> {
  try {
    const events = await db.execute<typeof waWebhookEvents.$inferSelect>(sql`
      SELECT * FROM wa_webhook_events
      WHERE status = 'pending'
      ORDER BY received_at ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    `);

    if (!events.rows || events.rows.length === 0) {
      return;
    }

    for (const event of events.rows) {
      const eventId = event.id;
      
      try {
        await db.update(waWebhookEvents)
          .set({
            status: "processing",
            attempt: sql`${waWebhookEvents.attempt} + 1`,
          })
          .where(eq(waWebhookEvents.id, eventId));

        await processWebhookEvent(event);

        await db.update(waWebhookEvents)
          .set({
            status: "done",
            processedAt: new Date(),
          })
          .where(eq(waWebhookEvents.id, eventId));

        console.log(`[WhatsApp Webhook Worker] Processed event: ${eventId}`);
      } catch (error: any) {
        console.error(`[WhatsApp Webhook Worker] Error processing event ${eventId}:`, error.message);
        
        await db.update(waWebhookEvents)
          .set({
            status: "failed",
            lastError: error.message || "Unknown error",
            processedAt: new Date(),
          })
          .where(eq(waWebhookEvents.id, eventId));
      }
    }
  } catch (error: any) {
    console.error("[WhatsApp Webhook Worker] Poll error:", error.message);
  }
}

async function sendWhatsAppMessage(job: typeof waSendOutbox.$inferSelect): Promise<void> {
  const message = await db.query.waMessages.findFirst({
    where: eq(waMessages.id, job.messageId),
  });

  if (!message) {
    throw new Error(`Message not found: ${job.messageId}`);
  }

  const connection = await db.query.channelConnections.findFirst({
    where: and(
      eq(channelConnections.phoneNumberId, job.phoneNumberId),
      eq(channelConnections.status, "active")
    ),
  });

  if (!connection) {
    throw new Error(`No active connection for phoneNumberId: ${job.phoneNumberId}`);
  }

  if (!connection.accessTokenEnc) {
    throw new Error("No access token configured for connection");
  }

  const accessToken = decryptToken(connection.accessTokenEnc);
  const conversation = await db.query.waConversations.findFirst({
    where: eq(waConversations.id, message.conversationId),
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${message.conversationId}`);
  }

  const recipientWaId = conversation.contactWaId;

  let messagePayload: any;
  if (message.messageType === "text") {
    messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientWaId,
      type: "text",
      text: { body: message.textBody },
    };
  } else if (message.templateName) {
    messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientWaId,
      type: "template",
      template: message.payload || { name: message.templateName, language: { code: "en" } },
    };
  } else if (["image", "video", "audio", "document"].includes(message.messageType)) {
    const mediaPayload: any = {};
    if (message.mediaUrl) {
      if (message.mediaUrl.startsWith("http")) {
        mediaPayload.link = message.mediaUrl;
      } else {
        mediaPayload.id = message.mediaUrl;
      }
    }
    if (message.textBody && ["image", "video", "document"].includes(message.messageType)) {
      mediaPayload.caption = message.textBody;
    }
    messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientWaId,
      type: message.messageType,
      [message.messageType]: mediaPayload,
    };
  } else {
    throw new Error(`Unsupported message type: ${message.messageType}`);
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${job.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    }
  );

  const responseData = (await response.json()) as any;

  if (!response.ok) {
    const error = responseData?.error || responseData;
    if (isAuthError(error)) {
      await db.update(channelConnections)
        .set({
          authStatus: "needs_reauth",
          authLastError: error.message || "Token expired or invalid",
          updatedAt: new Date(),
        })
        .where(eq(channelConnections.id, connection.id));
      console.error(`[WhatsApp Send Worker] Auth error for connection ${connection.id}, marked for reauth`);
    }
    throw new Error(error.message || `Meta API error: ${response.status}`);
  }

  const providerMessageId = responseData.messages?.[0]?.id;

  await db.update(waMessages)
    .set({
      status: "sent",
      providerMessageId,
      sentAt: new Date(),
    })
    .where(eq(waMessages.id, job.messageId));

  console.log(`[WhatsApp Send Worker] Message sent: ${job.messageId} -> ${providerMessageId}`);
}

async function pollSendOutbox(): Promise<void> {
  try {
    const jobs = await db.execute<typeof waSendOutbox.$inferSelect>(sql`
      SELECT * FROM wa_send_outbox
      WHERE status = 'pending' AND next_run_at <= NOW()
      ORDER BY next_run_at ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    `);

    if (!jobs.rows || jobs.rows.length === 0) {
      return;
    }

    for (const job of jobs.rows) {
      const jobId = job.id;
      const companyId = job.companyId;

      const runningCount = await db.execute<{ count: string }>(sql`
        SELECT COUNT(*) as count FROM wa_send_outbox
        WHERE company_id = ${companyId} AND status = 'running'
      `);

      const currentRunning = parseInt(runningCount.rows[0]?.count || "0", 10);
      if (currentRunning >= MAX_CONCURRENCY_PER_TENANT) {
        console.log(`[WhatsApp Send Worker] Tenant ${companyId} at max concurrency, skipping job ${jobId}`);
        continue;
      }

      await db.update(waSendOutbox)
        .set({
          status: "running",
          attempts: sql`${waSendOutbox.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(waSendOutbox.id, jobId));

      try {
        await sendWhatsAppMessage(job);

        await db.update(waSendOutbox)
          .set({
            status: "done",
            updatedAt: new Date(),
          })
          .where(eq(waSendOutbox.id, jobId));

        console.log(`[WhatsApp Send Worker] Job completed: ${jobId}`);
      } catch (error: any) {
        console.error(`[WhatsApp Send Worker] Error sending job ${jobId}:`, error.message);

        const newAttempts = (job.attempts || 0) + 1;

        if (newAttempts >= MAX_SEND_ATTEMPTS) {
          await db.update(waSendOutbox)
            .set({
              status: "failed",
              lastError: error.message || "Max retries exceeded",
              updatedAt: new Date(),
            })
            .where(eq(waSendOutbox.id, jobId));

          await db.update(waMessages)
            .set({
              status: "failed",
              errorMessage: error.message || "Max retries exceeded",
            })
            .where(eq(waMessages.id, job.messageId));

          console.log(`[WhatsApp Send Worker] Job ${jobId} moved to DLQ after ${newAttempts} attempts`);
        } else {
          const backoffSeconds = calculateBackoffSeconds(newAttempts);
          const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);

          await db.update(waSendOutbox)
            .set({
              status: "pending",
              lastError: error.message || "Unknown error",
              nextRunAt,
              updatedAt: new Date(),
            })
            .where(eq(waSendOutbox.id, jobId));

          console.log(`[WhatsApp Send Worker] Job ${jobId} rescheduled for ${nextRunAt.toISOString()} (attempt ${newAttempts})`);
        }
      }
    }
  } catch (error: any) {
    console.error("[WhatsApp Send Worker] Poll error:", error.message);
  }
}

export function startWebhookWorker(): void {
  if (webhookIntervalId) {
    console.log("[WhatsApp Webhook Worker] Already running");
    return;
  }

  console.log("[WhatsApp Webhook Worker] Starting...");
  webhookIntervalId = setInterval(pollWebhookEvents, WEBHOOK_POLL_INTERVAL_MS);
  pollWebhookEvents();
}

export function startSendWorker(): void {
  if (sendIntervalId) {
    console.log("[WhatsApp Send Worker] Already running");
    return;
  }

  console.log("[WhatsApp Send Worker] Starting...");
  sendIntervalId = setInterval(pollSendOutbox, SEND_POLL_INTERVAL_MS);
  pollSendOutbox();
}

export function stopWorkers(): void {
  if (webhookIntervalId) {
    clearInterval(webhookIntervalId);
    webhookIntervalId = null;
    console.log("[WhatsApp Webhook Worker] Stopped");
  }

  if (sendIntervalId) {
    clearInterval(sendIntervalId);
    sendIntervalId = null;
    console.log("[WhatsApp Send Worker] Stopped");
  }
}

export function startAllWorkers(): void {
  startWebhookWorker();
  startSendWorker();
}
