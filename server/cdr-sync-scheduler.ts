import cron from 'node-cron';
import { syncForwardedCallsCDR } from './services/cdr-sync-service';

let syncRunning = false;

export function startCDRSyncScheduler() {
  console.log('[CDR Sync Scheduler] Initializing forwarded calls CDR sync (every 5 minutes)');

  cron.schedule('*/5 * * * *', async () => {
    if (syncRunning) {
      console.log('[CDR Sync Scheduler] Previous sync still running, skipping...');
      return;
    }

    syncRunning = true;
    console.log(`[CDR Sync Scheduler] Starting CDR sync at ${new Date().toISOString()}`);

    try {
      const result = await syncForwardedCallsCDR();
      
      if (result.success) {
        console.log(`[CDR Sync Scheduler] Completed: ${result.recordsProcessed} records processed, ${result.recordsCharged} charged`);
        console.log(`[CDR Sync Scheduler] Total billed - Inbound: $${result.totalInboundCost}, Outbound: $${result.totalOutboundCost}`);
      } else {
        console.error('[CDR Sync Scheduler] Sync failed with errors:', result.errors);
      }
    } catch (error) {
      console.error('[CDR Sync Scheduler] Fatal error:', error);
    } finally {
      syncRunning = false;
    }
  });

  console.log('[CDR Sync Scheduler] CDR sync scheduler started successfully');
}

export async function runManualCDRSync() {
  if (syncRunning) {
    return { success: false, error: 'Sync already in progress' };
  }

  syncRunning = true;
  try {
    const result = await syncForwardedCallsCDR();
    return result;
  } finally {
    syncRunning = false;
  }
}
