import cron from 'node-cron';
import { db } from './db.js';
import { quoteReminders, notifications } from '../shared/schema.js';
import { eq, and, lt, sql, or } from 'drizzle-orm';

let schedulerRunning = false;

/**
 * Background job that:
 * 1. Checks for snoozed reminders and creates notifications when snooze time is up
 * 2. Checks for pending reminders due today and creates notifications
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
      
      // ============= PART 1: Handle expired snoozes =============
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

            console.log(`[REMINDER SCHEDULER] Notification created for expired snooze reminder ${reminder.id}`);
          } catch (error) {
            console.error(`[REMINDER SCHEDULER] Error processing reminder ${reminder.id}:`, error);
          }
        }
      }

      // ============= PART 2: Handle reminders due today =============
      // Get today's date in yyyy-MM-dd format
      const today = now.toISOString().split('T')[0];
      
      // Find all pending reminders that are due today
      const todayReminders = await db
        .select()
        .from(quoteReminders)
        .where(
          and(
            eq(quoteReminders.status, 'pending'),
            eq(quoteReminders.dueDate, today)
          )
        );

      if (todayReminders.length > 0) {
        console.log(`[REMINDER SCHEDULER] Found ${todayReminders.length} reminder(s) due today`);

        for (const reminder of todayReminders) {
          try {
            // Check if notification already exists for this SPECIFIC reminder today
            // Use reminder ID in message to uniquely identify each reminder
            const existingNotifications = await db
              .select()
              .from(notifications)
              .where(
                and(
                  eq(notifications.userId, reminder.createdBy),
                  sql`${notifications.message} LIKE ${'%' + reminder.id + '%'}`,
                  sql`DATE(${notifications.createdAt}) = ${today}`
                )
              );

            // Only create notification if one doesn't already exist today for THIS reminder
            if (existingNotifications.length === 0) {
              // Create notification for the user who created the reminder (always in English)
              await db.insert(notifications).values({
                userId: reminder.createdBy,
                type: 'warning',
                title: 'Reminder Due Today',
                message: `Your reminder "${reminder.title || 'Untitled'}" for quote ${reminder.quoteId} is due today${reminder.dueTime ? ` at ${reminder.dueTime}` : ''}. (ID: ${reminder.id})`,
                link: `/quotes/${reminder.quoteId}`,
                isRead: false,
              });

              // Also notify any users in the notifyUsers array (always in English)
              if (reminder.notifyUsers && reminder.notifyUsers.length > 0) {
                for (const userId of reminder.notifyUsers) {
                  // Check if notification already exists for this user for THIS reminder
                  const userExistingNotifications = await db
                    .select()
                    .from(notifications)
                    .where(
                      and(
                        eq(notifications.userId, userId),
                        sql`${notifications.message} LIKE ${'%' + reminder.id + '%'}`,
                        sql`DATE(${notifications.createdAt}) = ${today}`
                      )
                    );

                  if (userExistingNotifications.length === 0) {
                    await db.insert(notifications).values({
                      userId: userId,
                      type: 'warning',
                      title: 'Reminder Due Today',
                      message: `The reminder "${reminder.title || 'Untitled'}" for quote ${reminder.quoteId} is due today${reminder.dueTime ? ` at ${reminder.dueTime}` : ''}. (ID: ${reminder.id})`,
                      link: `/quotes/${reminder.quoteId}`,
                      isRead: false,
                    });
                  }
                }
              }

              console.log(`[REMINDER SCHEDULER] Notification created for today's reminder ${reminder.id}`);
            }
          } catch (error) {
            console.error(`[REMINDER SCHEDULER] Error processing today's reminder ${reminder.id}:`, error);
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
