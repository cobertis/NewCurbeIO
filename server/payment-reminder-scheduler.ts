import cron from "node-cron";
import { apnsService } from "./services/apns-service";

export function startPaymentReminderScheduler() {
  cron.schedule("1 0 * * *", async () => {
    console.log("[Payment Reminder Scheduler] Running daily payment reminder check at 12:01 AM");
    
    try {
      const result = await apnsService.processPaymentReminders();
      
      console.log(`[Payment Reminder Scheduler] Completed:`, {
        processed: result.processed,
        notified: result.notified,
        errors: result.errors.length,
      });
      
      if (result.errors.length > 0) {
        console.error("[Payment Reminder Scheduler] Errors:", result.errors.slice(0, 10));
      }
    } catch (error) {
      console.error("[Payment Reminder Scheduler] Fatal error:", error);
    }
  }, {
    timezone: "America/New_York"
  });
  
  console.log("[Payment Reminder Scheduler] Started - will run at 12:01 AM EST daily");
}
