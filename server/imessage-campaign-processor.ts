import cron from 'node-cron';
import { storage } from './storage';
import { blueBubblesManager } from './bluebubbles';
import type { ImessageCampaignRun, ImessageCampaign, ImessageCampaignMessage, ManualContact } from '@shared/schema';

const activeProcessing = new Set<string>();

export function startImessageCampaignProcessor() {
  console.log('[CAMPAIGN PROCESSOR] Starting processor...');
  
  cron.schedule('*/10 * * * * *', async () => {
    await processActiveCampaigns();
  });
  
  console.log('[CAMPAIGN PROCESSOR] Processor started (runs every 10 seconds)');
}

async function processActiveCampaigns() {
  try {
    // RECOVERY SWEEP: Reset abandoned messages left in 'sending' after crashes
    await recoverAbandonedMessages();
    
    const activeRuns = await storage.getActiveImessageCampaignRuns();
    
    for (const run of activeRuns) {
      if (activeProcessing.has(run.id)) continue;
      
      activeProcessing.add(run.id);
      
      try {
        await processRun(run);
      } finally {
        activeProcessing.delete(run.id);
      }
    }
  } catch (error) {
    console.error('[CAMPAIGN PROCESSOR] Error:', error);
  }
}

async function recoverAbandonedMessages() {
  try {
    const abandonedMessages = await storage.getAbandonedCampaignMessages();
    
    if (abandonedMessages.length > 0) {
      console.log(`[CAMPAIGN PROCESSOR] Recovering ${abandonedMessages.length} abandoned messages`);
      
      for (const message of abandonedMessages) {
        await storage.updateImessageCampaignMessage(message.id, {
          sendStatus: 'pending'
        });
      }
    }
  } catch (error) {
    console.error('[CAMPAIGN PROCESSOR] Error recovering abandoned messages:', error);
  }
}

async function processRun(run: ImessageCampaignRun) {
  const pendingMessages = await storage.getPendingCampaignMessages(run.id, 10);
  
  if (pendingMessages.length === 0) {
    const totalMessages = run.totalContacts;
    const processedMessages = run.sentCount + run.failedCount + run.skippedCount;
    
    if (totalMessages === processedMessages) {
      await storage.updateImessageCampaignRun(run.id, {
        status: 'completed',
        completedAt: new Date()
      });
      
      // Also update campaign status to completed
      await storage.updateImessageCampaign(run.campaignId, {
        status: 'completed'
      });
      
      console.log(`[CAMPAIGN PROCESSOR] Run ${run.runNumber} completed`);
      console.log(`[CAMPAIGN PROCESSOR] Campaign ${run.campaignId} marked as completed`);
    }
    return;
  }
  
  const campaign = await storage.getImessageCampaign(run.campaignId);
  if (!campaign) return;
  
  const schedule = await storage.getCampaignSchedule(campaign.id);
  
  for (const message of pendingMessages) {
    try {
      await sendCampaignMessage(message, campaign, run);
    } catch (error) {
      console.error(`[CAMPAIGN PROCESSOR] Error sending message ${message.id}:`, error);
      await handleSendError(message, error);
    }
  }
}

async function sendCampaignMessage(
  message: ImessageCampaignMessage, 
  campaign: ImessageCampaign, 
  run: ImessageCampaignRun
) {
  // TRANSACTIONAL CLAIM: Mark as "sending" BEFORE dispatch to prevent duplicates
  await storage.updateImessageCampaignMessage(message.id, {
    sendStatus: 'sending',
    attemptedAt: new Date()
  });
  
  const contact = await storage.getContactById(message.contactId);
  
  let messageBody = campaign.messageBody;
  if (contact) {
    messageBody = messageBody.replace(/\{\{firstName\}\}/g, contact.firstName || '');
    messageBody = messageBody.replace(/\{\{lastName\}\}/g, contact.lastName || '');
    messageBody = messageBody.replace(/\{\{phone\}\}/g, contact.phone || '');
  }
  
  const response = await blueBubblesManager.sendMessage(campaign.companyId, {
    chatGuid: message.chatGuid!,
    message: messageBody,
    method: 'private-api'
  });
  
  await storage.updateImessageCampaignMessage(message.id, {
    sendStatus: 'sent',
    messageGuid: response.data.guid
  });
  
  await storage.incrementRunSentCount(run.id);
  
  console.log(`[CAMPAIGN PROCESSOR] Message sent: ${message.id} to ${message.phone}`);
}

async function handleSendError(message: ImessageCampaignMessage, error: any) {
  const retryCount = (message.retryCount || 0) + 1;
  const maxRetries = 3;
  
  if (retryCount >= maxRetries) {
    await storage.updateImessageCampaignMessage(message.id, {
      sendStatus: 'failed',
      retryCount,
      failureReason: error.message,
      attemptedAt: new Date()
    });
    
    await storage.incrementRunFailedCount(message.runId);
  } else {
    // Reset to 'pending' so processor can retry
    await storage.updateImessageCampaignMessage(message.id, {
      sendStatus: 'pending',
      retryCount,
      attemptedAt: new Date()
    });
  }
}
