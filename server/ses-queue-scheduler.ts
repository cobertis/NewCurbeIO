import cron from "node-cron";
import { sesService } from "./services/ses-service";

export function startSesQueueScheduler(): void {
  console.log("[SES QUEUE] Starting scheduler...");

  cron.schedule("*/10 * * * * *", async () => {
    try {
      const result = await sesService.processQueue();
      if (result.processed > 0 || result.failed > 0) {
        console.log(`[SES QUEUE] Processed: ${result.processed}, Failed: ${result.failed}`);
      }
    } catch (error) {
      console.error("[SES QUEUE] Processing error:", error);
    }
  });

  console.log("[SES QUEUE] Scheduler started (queue processes every 10 seconds)");
}
