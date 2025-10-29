import cron from 'node-cron';
import { db } from './db.js';
import { quoteReminders, notifications } from '../shared/schema.js';
import { eq, and, lt, sql } from 'drizzle-orm';

let schedulerRunning = false;

/**
 * Background job that checks for snoozed reminders and creates notifications when snooze time is up
 * Runs every minute
 */
export function startReminderScheduler() {
  if (schedulerRunning) {
    console.log('[REMINDER SCHEDULER] Already running');
    return;
  }

  console.log('[REMINDER SCHEDULER] Starting scheduler...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      // Find all reminders that:
      // 1. Have status "snoozed"
      // 2. snoozedUntil time has passed (is in the past)
      const expiredSnoozes = await db
        .select()
        .from(quoteReminders)
        .where(
          and(
            eq(quoteReminders.status, 'snoozed'),
            lt(quoteReminders.snoozedUntil, now)
          )
        );

      if (expiredSnoozes.length > 0) {
        console.log(`[REMINDER SCHEDULER] Found ${expiredSnoozes.length} expired snooze(s)`);

        for (const reminder of expiredSnoozes) {
          try {
            // Create notification for the user who created the reminder (always in English)
            await db.insert(notifications).values({
              userId: reminder.createdBy,
              type: 'warning',
              title: 'Active Reminder',
              message: `Your reminder "${reminder.title || 'Untitled'}" for quote ${reminder.quoteId} is pending and requires your attention.`,
              link: `/quotes/${reminder.quoteId}`,
              isRead: false,
            });

            // Also notify any users in the notifyUsers array (always in English)
            if (reminder.notifyUsers && reminder.notifyUsers.length > 0) {
              for (const userId of reminder.notifyUsers) {
                await db.insert(notifications).values({
                  userId: userId,
                  type: 'warning',
                  title: 'Active Reminder',
                  message: `The reminder "${reminder.title || 'Untitled'}" for quote ${reminder.quoteId} is pending.`,
                  link: `/quotes/${reminder.quoteId}`,
                  isRead: false,
                });
              }
            }

            // Update reminder status back to pending
            await db
              .update(quoteReminders)
              .set({
                status: 'pending',
                snoozedUntil: null,
                updatedAt: new Date(),
              })
              .where(eq(quoteReminders.id, reminder.id));

            console.log(`[REMINDER SCHEDULER] Notification created for reminder ${reminder.id}`);
          } catch (error) {
            console.error(`[REMINDER SCHEDULER] Error processing reminder ${reminder.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[REMINDER SCHEDULER] Error in scheduler:', error);
    }
  });

  schedulerRunning = true;
  console.log('[REMINDER SCHEDULER] Scheduler started successfully');
}

export function stopReminderScheduler() {
  schedulerRunning = false;
  console.log('[REMINDER SCHEDULER] Scheduler stopped');
}
