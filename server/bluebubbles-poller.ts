import * as cron from 'node-cron';
import { storage } from './storage';
import { BlueBubblesClient } from './bluebubbles';
import { broadcastImessageMessage, broadcastImessageUpdate } from './websocket';
import { notificationService } from './notification-service';
import type { CompanySettings } from '@shared/schema';

// Map to track polling jobs for each company
const pollingJobs = new Map<string, cron.ScheduledTask>();
const lastMessageTimestamps = new Map<string, number>();

/**
 * Start polling BlueBubbles for new messages for a company
 */
export async function startBlueBubblesPolling(companyId: string) {
  console.log(`[BlueBubbles Poller] Starting polling for company: ${companyId}`);
  
  // Stop any existing job for this company
  stopBlueBubblesPolling(companyId);
  
  // Create polling job that runs every 30 seconds
  const job = cron.schedule('*/30 * * * * *', async () => {
    try {
      await pollBlueBubblesForCompany(companyId);
    } catch (error: any) {
      console.error(`[BlueBubbles Poller] Error polling for company ${companyId}:`, error);
    }
  });
  
  // Store the job
  pollingJobs.set(companyId, job);
  job.start();
  
  // Do an immediate poll
  await pollBlueBubblesForCompany(companyId);
}

/**
 * Stop polling BlueBubbles for a company
 */
export function stopBlueBubblesPolling(companyId: string) {
  const job = pollingJobs.get(companyId);
  if (job) {
    console.log(`[BlueBubbles Poller] Stopping polling for company: ${companyId}`);
    job.stop();
    pollingJobs.delete(companyId);
    lastMessageTimestamps.delete(companyId);
  }
}

/**
 * Poll BlueBubbles for new messages for a specific company
 */
async function pollBlueBubblesForCompany(companyId: string) {
  const companySettings = await storage.getCompanySettings(companyId);
  if (!companySettings) {
    console.log(`[BlueBubbles Poller] No settings found for company: ${companyId}`);
    stopBlueBubblesPolling(companyId);
    return;
  }
  
  const imessageSettings = companySettings.imessageSettings as any;
  if (!imessageSettings?.isEnabled || !imessageSettings?.serverUrl) {
    console.log(`[BlueBubbles Poller] iMessage not enabled for company: ${companyId}`);
    stopBlueBubblesPolling(companyId);
    return;
  }
  
  // Only poll if webhook is not configured (fallback mode)
  if (imessageSettings.webhookSecret) {
    console.log(`[BlueBubbles Poller] Company ${companyId} has webhook configured, skipping polling`);
    stopBlueBubblesPolling(companyId);
    return;
  }
  
  try {
    // Create BlueBubbles client
    const client = BlueBubblesClient.createFromSettings(companySettings);
    if (!client) {
      console.error(`[BlueBubbles Poller] Failed to create client for company: ${companyId}`);
      return;
    }
    
    // Get last poll timestamp
    const lastTimestamp = lastMessageTimestamps.get(companyId) || Date.now() - 60000; // Default to 1 minute ago
    
    // Get all chats
    const chatsResponse = await client.getChats();
    const chats = chatsResponse.data || [];
    
    let newMessageCount = 0;
    
    // Process each chat
    for (const chat of chats) {
      // Get or create conversation
      let conversation = await storage.getImessageConversationByChatGuid(chat.guid);
      if (!conversation) {
        // Create new conversation
        conversation = await storage.createImessageConversation({
          companyId,
          chatGuid: chat.guid,
          participants: chat.participants || [],
          displayName: chat.displayName || chat.chatIdentifier || 'Unknown',
          lastMessageAt: chat.lastMessage?.dateCreated ? new Date(chat.lastMessage.dateCreated) : new Date(),
          lastMessageText: chat.lastMessage?.text || '',
          unreadCount: 0,
        });
      }
      
      // Get recent messages for this chat
      const messagesResponse = await client.getChatMessages(chat.guid, 0, 50);
      const messages = messagesResponse.data || [];
      
      // Process messages newer than last timestamp
      for (const message of messages) {
        if (message.dateCreated > lastTimestamp) {
          // Check if message already exists
          const existingMessage = await storage.getImessageMessageByGuid(message.guid);
          if (!existingMessage) {
            // Store new message
            const newMessage = await storage.createImessageMessage({
              conversationId: conversation.id,
              guid: message.guid,
              text: message.text || '',
              sender: message.handle?.address || 'Unknown',
              isFromMe: message.isFromMe || false,
              dateCreated: new Date(message.dateCreated),
              dateRead: message.dateRead ? new Date(message.dateRead) : null,
              dateDelivered: message.dateDelivered ? new Date(message.dateDelivered) : null,
              attachments: message.attachments || [],
              associatedMessageGuid: message.associatedMessageGuid || null,
              associatedMessageType: message.associatedMessageType || null,
            });
            
            newMessageCount++;
            
            // Update conversation
            await storage.updateImessageConversation(conversation.id, {
              lastMessageAt: newMessage.dateCreated,
              lastMessageText: newMessage.text,
              unreadCount: conversation.unreadCount + (newMessage.isFromMe ? 0 : 1),
            });
            
            // Broadcast new message
            broadcastImessageMessage(companyId, conversation.id, newMessage);
            
            // Send notification if not from me
            if (!newMessage.isFromMe) {
              await notificationService.sendImessageNotification(companyId, {
                conversationId: conversation.id,
                senderName: newMessage.sender,
                messageText: newMessage.text,
              });
            }
          }
        }
      }
    }
    
    // Update last timestamp
    lastMessageTimestamps.set(companyId, Date.now());
    
    if (newMessageCount > 0) {
      console.log(`[BlueBubbles Poller] Processed ${newMessageCount} new messages for company: ${companyId}`);
      broadcastImessageUpdate(companyId, { type: 'conversations_updated' });
    }
    
  } catch (error: any) {
    console.error(`[BlueBubbles Poller] Error polling company ${companyId}:`, error);
  }
}

/**
 * Initialize polling for all companies with iMessage enabled but no webhook
 */
export async function initializeBlueBubblesPolling() {
  console.log('[BlueBubbles Poller] Initializing polling for all companies...');
  
  try {
    // Get all companies
    const companies = await storage.getAllCompanies();
    
    for (const company of companies) {
      // Get company settings
      const settings = await storage.getCompanySettings(company.id);
      if (settings) {
        const imessageSettings = settings.imessageSettings as any;
        
        // Start polling if iMessage is enabled but no webhook configured
        if (imessageSettings?.isEnabled && imessageSettings?.serverUrl && !imessageSettings?.webhookSecret) {
          await startBlueBubblesPolling(company.id);
        }
      }
    }
    
    console.log(`[BlueBubbles Poller] Initialized polling for ${pollingJobs.size} companies`);
  } catch (error: any) {
    console.error('[BlueBubbles Poller] Error initializing polling:', error);
  }
}

/**
 * Cleanup all polling jobs
 */
export function cleanupBlueBubblesPolling() {
  console.log('[BlueBubbles Poller] Cleaning up all polling jobs...');
  
  for (const [companyId, job] of pollingJobs.entries()) {
    job.stop();
    console.log(`[BlueBubbles Poller] Stopped polling for company: ${companyId}`);
  }
  
  pollingJobs.clear();
  lastMessageTimestamps.clear();
}