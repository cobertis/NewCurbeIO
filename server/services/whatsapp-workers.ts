import { db } from "../db";
import {
  waWebhookEvents,
  waWebhookDedupe,
  waSendOutbox,
  waMessages,
  waConversations,
  channelConnections,
  telnyxConversations,
  telnyxMessages,
} from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { decryptToken } from "../crypto";
import { whatsappCallService } from "./whatsapp-call-service";

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
      // Process messages and calls webhooks
      if (change.field !== "messages" && change.field !== "calls") continue;
      
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

      // Process incoming WhatsApp voice calls
      if (change.field === "calls" && value.calls && Array.isArray(value.calls)) {
        for (const call of value.calls) {
          // Validate required fields before processing
          if (!call.id || !call.from) {
            console.log(`[WhatsApp Webhook Worker] Skipping call event - missing id or from field`);
            continue;
          }

          const callEvent = call.event || call.status || 'unknown';
          const dedupeKey = `call:${call.id}:${callEvent}`;
          try {
            const result = await db.execute(sql`
              INSERT INTO wa_webhook_dedupe (company_id, dedupe_key, event_type)
              VALUES (${companyId}, ${dedupeKey}, 'inbound_call')
              ON CONFLICT (company_id, dedupe_key, event_type) DO NOTHING
              RETURNING id
            `);
            
            if (!result.rows || result.rows.length === 0) {
              console.log(`[WhatsApp Webhook Worker] Duplicate call event skipped: ${call.id} - ${callEvent}`);
              continue;
            }
          } catch (dedupeErr) {
            console.log(`[WhatsApp Webhook Worker] Dedupe check failed for call ${call.id}, processing anyway`);
          }

          const callerWaId = call.from;
          const contactName = value.contacts?.[0]?.profile?.name || callerWaId;
          const customerPhone = callerWaId.startsWith("+") ? callerWaId : `+${callerWaId}`;
          const companyPhone = connection.phoneNumberE164 || phoneNumberId;

          // Handle "connect" event - this is an incoming call with SDP offer
          if (callEvent === "connect" && call.session?.sdp) {
            console.log(`[WhatsApp Webhook Worker] Incoming call with SDP offer: ${call.id} from ${callerWaId}`);
            
            // Notify agents via WebSocket for real-time call handling
            await whatsappCallService.handleIncomingCall(
              call.id,
              customerPhone,
              companyPhone,
              contactName !== callerWaId ? contactName : undefined,
              phoneNumberId,
              companyId,
              call.session.sdp,
              call.direction || 'USER_INITIATED'
            );
          }

          // Handle "terminate" event - call ended
          if (callEvent === "terminate" || callEvent === "ended" || callEvent === "completed" || callEvent === "missed") {
            whatsappCallService.handleCallTerminate(call.id);
          }

          // Upsert conversation for this WhatsApp call
          // First, try to find conversation WITHOUT companyPhoneNumber filter to handle reconnection scenarios
          let inboxConversation = await db.query.telnyxConversations.findFirst({
            where: and(
              eq(telnyxConversations.companyId, companyId),
              eq(telnyxConversations.phoneNumber, customerPhone),
              eq(telnyxConversations.channel, "whatsapp")
            ),
          });

          // Build call status text with safe fallbacks
          let callStatusText: string;
          if (callEvent === "missed") {
            callStatusText = "Missed WhatsApp call";
          } else if (callEvent === "completed" || callEvent === "ended" || callEvent === "terminate") {
            const duration = call.duration || 0;
            callStatusText = duration > 0 ? `WhatsApp call (${duration}s)` : "WhatsApp call ended";
          } else if (callEvent === "connect" || callEvent === "ringing") {
            callStatusText = "Incoming WhatsApp call";
          } else {
            callStatusText = "WhatsApp call";
          }

          // Safe timestamp parsing with fallback to current time
          const callTimestamp = call.timestamp 
            ? new Date(parseInt(call.timestamp) * 1000) 
            : new Date();

          if (!inboxConversation) {
            // No conversation exists - try to create one, handling race conditions
            try {
              const [newConv] = await db.insert(telnyxConversations).values({
                companyId,
                phoneNumber: customerPhone,
                companyPhoneNumber: companyPhone,
                displayName: contactName !== callerWaId ? contactName : null,
                channel: "whatsapp",
                status: "open",
                unreadCount: 1,
                lastMessage: callStatusText,
                lastMessageAt: callTimestamp,
              }).returning();
              inboxConversation = newConv;
              console.log(`[WhatsApp Webhook Worker] Created inbox conversation for call: ${inboxConversation.id}`);
            } catch (insertErr: any) {
              // Handle race condition - another worker may have created the conversation
              if (insertErr.code === '23505') { // PostgreSQL unique constraint violation
                console.log(`[WhatsApp Webhook Worker] Race condition detected for call, fetching existing conversation`);
                inboxConversation = await db.query.telnyxConversations.findFirst({
                  where: and(
                    eq(telnyxConversations.companyId, companyId),
                    eq(telnyxConversations.phoneNumber, customerPhone),
                    eq(telnyxConversations.channel, "whatsapp")
                  ),
                });
                if (!inboxConversation) {
                  throw new Error(`Failed to find conversation after race condition for call from ${customerPhone}`);
                }
              } else {
                throw insertErr;
              }
            }
          }
          
          // Always update the conversation to ensure it's current
          if (inboxConversation) {
            await db.update(telnyxConversations)
              .set({
                unreadCount: sql`${telnyxConversations.unreadCount} + 1`,
                lastMessageAt: callTimestamp,
                lastMessage: callStatusText,
                displayName: (contactName !== callerWaId ? contactName : null) || inboxConversation.displayName,
                companyPhoneNumber: companyPhone, // Update to current company phone in case of reconnection
                status: (inboxConversation.status === "solved" || inboxConversation.status === "archived") ? "open" : inboxConversation.status,
                updatedAt: new Date(),
              })
              .where(eq(telnyxConversations.id, inboxConversation.id));
          }

          // Store call event as a message in the inbox (using valid schema values)
          await db.insert(telnyxMessages).values({
            conversationId: inboxConversation.id,
            direction: "inbound",
            messageType: "incoming",
            channel: "whatsapp",
            text: callStatusText,
            contentType: "system",
            status: "delivered",
            telnyxMessageId: call.id,
            deliveredAt: callTimestamp,
          });

          console.log(`[WhatsApp Webhook Worker] Saved inbound call to inbox: ${call.id} - ${callEvent}`);
        }
      }

      if (value.messages && Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          // Validate required fields before processing
          if (!msg || !msg.id || !msg.from) {
            console.log(`[WhatsApp Webhook Worker] Skipping message - missing required fields`);
            continue;
          }
          
          const dedupeKey = `msg:${msg.id}`;
          try {
            // Use INSERT with RETURNING to detect if we actually inserted (vs conflict)
            const result = await db.execute(sql`
              INSERT INTO wa_webhook_dedupe (company_id, dedupe_key, event_type)
              VALUES (${companyId}, ${dedupeKey}, 'inbound_message')
              ON CONFLICT (company_id, dedupe_key, event_type) DO NOTHING
              RETURNING id
            `);
            
            // If rowCount is 0, this was a duplicate - skip processing
            if (!result.rows || result.rows.length === 0) {
              console.log(`[WhatsApp Webhook Worker] Duplicate message skipped: ${msg.id}`);
              continue;
            }
          } catch (dedupeErr) {
            console.log(`[WhatsApp Webhook Worker] Dedupe check failed for ${msg.id}, processing anyway`);
          }

          const contactWaId = msg.from;
          const contactName = value.contacts?.[0]?.profile?.name || contactWaId;
          
          // Format phone number for inbox (E.164 format with + prefix)
          const customerPhone = contactWaId.startsWith("+") ? contactWaId : `+${contactWaId}`;
          const companyPhone = connection.phoneNumberE164 || phoneNumberId;

          // Upsert conversation in telnyxConversations for unified inbox
          // First, try to find conversation WITHOUT companyPhoneNumber filter to handle reconnection scenarios
          let inboxConversation = await db.query.telnyxConversations.findFirst({
            where: and(
              eq(telnyxConversations.companyId, companyId),
              eq(telnyxConversations.phoneNumber, customerPhone),
              eq(telnyxConversations.channel, "whatsapp")
            ),
          });

          if (!inboxConversation) {
            // No conversation exists - try to create one, handling race conditions
            try {
              const [newConv] = await db.insert(telnyxConversations).values({
                companyId,
                phoneNumber: customerPhone,
                companyPhoneNumber: companyPhone,
                displayName: contactName !== contactWaId ? contactName : null,
                channel: "whatsapp",
                status: "open",
                unreadCount: 1,
                lastMessage: msg.text?.body || `[${msg.type}]`,
                lastMessageAt: new Date(),
              }).returning();
              inboxConversation = newConv;
              console.log(`[WhatsApp Webhook Worker] Created inbox conversation: ${inboxConversation.id}`);
            } catch (insertErr: any) {
              // Handle race condition - another worker may have created the conversation
              if (insertErr.code === '23505') { // PostgreSQL unique constraint violation
                console.log(`[WhatsApp Webhook Worker] Race condition detected, fetching existing conversation`);
                inboxConversation = await db.query.telnyxConversations.findFirst({
                  where: and(
                    eq(telnyxConversations.companyId, companyId),
                    eq(telnyxConversations.phoneNumber, customerPhone),
                    eq(telnyxConversations.channel, "whatsapp")
                  ),
                });
                if (!inboxConversation) {
                  throw new Error(`Failed to find conversation after race condition for ${customerPhone}`);
                }
              } else {
                throw insertErr;
              }
            }
          }
          
          // Always update the conversation to ensure it's current
          if (inboxConversation) {
            await db.update(telnyxConversations)
              .set({
                unreadCount: sql`${telnyxConversations.unreadCount} + 1`,
                lastMessageAt: new Date(),
                lastMessage: msg.text?.body || `[${msg.type}]`,
                displayName: (contactName !== contactWaId ? contactName : null) || inboxConversation.displayName,
                companyPhoneNumber: companyPhone, // Update to current company phone in case of reconnection
                status: (inboxConversation.status === "solved" || inboxConversation.status === "archived") ? "open" : inboxConversation.status,
                updatedAt: new Date(),
              })
              .where(eq(telnyxConversations.id, inboxConversation.id));
          }

          const messageType = msg.type || "text";
          let textBody = null;
          let mediaUrl = null;
          let mediaMimeType = null;
          let mediaFileName = null;
          let mediaFileSize = null;

          if (msg.text) {
            textBody = msg.text.body;
          } else if (msg.image) {
            mediaUrl = msg.image.id;
            mediaMimeType = msg.image.mime_type;
            mediaFileSize = msg.image.file_size;
            textBody = msg.image.caption || null;
          } else if (msg.video) {
            mediaUrl = msg.video.id;
            mediaMimeType = msg.video.mime_type;
            mediaFileSize = msg.video.file_size;
            textBody = msg.video.caption || null;
          } else if (msg.audio) {
            mediaUrl = msg.audio.id;
            mediaMimeType = msg.audio.mime_type;
            mediaFileSize = msg.audio.file_size;
          } else if (msg.document) {
            mediaUrl = msg.document.id;
            mediaMimeType = msg.document.mime_type;
            mediaFileName = msg.document.filename;
            mediaFileSize = msg.document.file_size;
            textBody = msg.document.caption || null;
          } else if (msg.sticker) {
            mediaUrl = msg.sticker.id;
            mediaMimeType = msg.sticker.mime_type;
            mediaFileSize = msg.sticker.file_size;
          } else if (msg.location) {
            textBody = `Location: ${msg.location.latitude}, ${msg.location.longitude}`;
          } else if (msg.contacts) {
            textBody = `Contact: ${msg.contacts[0]?.name?.formatted_name || "Unknown"}`;
          }

          // Store in telnyxMessages for unified inbox
          // For WhatsApp media, store metadata as JSON with wa_media: prefix
          let messageMediaUrls: string[] | null = null;
          if (mediaUrl) {
            // Encode media metadata with wa_media: prefix for frontend parsing
            const mediaEntry = `wa_media:${JSON.stringify({
              mediaId: mediaUrl,
              mediaType: messageType,
              mimeType: mediaMimeType || "",
              fileName: mediaFileName || "",
              fileSize: mediaFileSize || 0
            })}`;
            messageMediaUrls = [mediaEntry];
          }
          
          const messageText = textBody || (mediaUrl ? (mediaFileName || `[${messageType}]`) : "[message]");
          
          await db.insert(telnyxMessages).values({
            conversationId: inboxConversation.id,
            direction: "inbound",
            messageType: "incoming",
            channel: "whatsapp",
            text: messageText,
            contentType: mediaUrl ? "media" : "text",
            mediaUrls: messageMediaUrls,
            status: "delivered",
            telnyxMessageId: msg.id,
            deliveredAt: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date(),
          });

          console.log(`[WhatsApp Webhook Worker] Saved inbound message to inbox: ${msg.id}`);
        }
      }

      if (value.statuses && Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          const dedupeKey = `status:${status.id}:${status.status}`;
          try {
            // Use INSERT with RETURNING to detect if we actually inserted (vs conflict)
            const result = await db.execute(sql`
              INSERT INTO wa_webhook_dedupe (company_id, dedupe_key, event_type)
              VALUES (${companyId}, ${dedupeKey}, 'status_update')
              ON CONFLICT (company_id, dedupe_key, event_type) DO NOTHING
              RETURNING id
            `);
            
            // If rowCount is 0, this was a duplicate - skip processing
            if (!result.rows || result.rows.length === 0) {
              console.log(`[WhatsApp Webhook Worker] Duplicate status update skipped: ${status.id}:${status.status}`);
              continue;
            }
          } catch {
            // On error, process anyway (fail open for status updates)
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
            // Update status in telnyxMessages (unified inbox)
            await db.update(telnyxMessages)
              .set(updateData)
              .where(eq(telnyxMessages.telnyxMessageId, providerMessageId));
            console.log(`[WhatsApp Webhook Worker] Updated inbox message status: ${providerMessageId} -> ${newStatus}`);
          }
        }
      }
    }
  }
}

async function pollWebhookEvents(): Promise<void> {
  try {
    // Use transaction to hold the lock until we've claimed the job
    await db.transaction(async (tx) => {
      // Select and lock pending events
      const events = await tx.execute<typeof waWebhookEvents.$inferSelect>(sql`
        SELECT * FROM wa_webhook_events
        WHERE status = 'pending'
        ORDER BY received_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      `);

      if (!events.rows || events.rows.length === 0) {
        return;
      }

      // Mark all selected events as processing within the transaction
      for (const event of events.rows) {
        await tx.execute(sql`
          UPDATE wa_webhook_events
          SET status = 'processing', attempt = attempt + 1
          WHERE id = ${event.id}
        `);
      }

      // Process events outside the transaction (after claiming them)
      for (const event of events.rows) {
        const eventId = event.id;
        
        try {
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
    });
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
    // Track which jobs we claimed in the transaction
    const claimedJobs: typeof waSendOutbox.$inferSelect[] = [];
    
    // Use transaction to hold the lock until we've claimed the jobs
    await db.transaction(async (tx) => {
      const jobs = await tx.execute<typeof waSendOutbox.$inferSelect>(sql`
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

        // Check tenant concurrency within the transaction
        const runningCount = await tx.execute<{ count: string }>(sql`
          SELECT COUNT(*) as count FROM wa_send_outbox
          WHERE company_id = ${companyId} AND status = 'running'
        `);

        const currentRunning = parseInt(runningCount.rows[0]?.count || "0", 10);
        if (currentRunning >= MAX_CONCURRENCY_PER_TENANT) {
          console.log(`[WhatsApp Send Worker] Tenant ${companyId} at max concurrency, skipping job ${jobId}`);
          continue;
        }

        // Claim the job by marking as running within the transaction
        await tx.execute(sql`
          UPDATE wa_send_outbox
          SET status = 'running', attempts = attempts + 1, updated_at = NOW()
          WHERE id = ${jobId}
        `);
        
        claimedJobs.push(job);
      }
    });

    // Process claimed jobs outside the transaction
    for (const job of claimedJobs) {
      const jobId = job.id;
      
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
