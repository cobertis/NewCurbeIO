import cron from 'node-cron';
import { db } from './db.js';
import { users, birthdayImages, userBirthdaySettings, birthdayGreetingHistory, companies, quotes, quoteMembers, policies, policyMembers, manualContacts, manualBirthdays, notifications } from '../shared/schema.js';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import twilio from 'twilio';
import { formatInTimeZone, format } from 'date-fns-tz';
import { formatForDisplay } from '../shared/phone.js';
import { storage } from './storage.js';
import { broadcastNotificationUpdate } from './websocket.js';

let schedulerRunning = false;

/**
 * Get all birthday events for today in a specific company
 * Uses the same deduplication logic as /api/calendar/events
 */
async function getTodaysBirthdaysForCompany(companyId: string, todayMonthDay: string): Promise<Array<{ name: string; phone: string | null; dateOfBirth: string }>> {
  const birthdays: Array<{ name: string; phone: string | null; dateOfBirth: string }> = [];
  const birthdaySet = new Set<string>();

  // ============== QUOTES BIRTHDAYS ==============
  const quotesData = await storage.getQuotesByCompany(companyId);
  for (const quote of quotesData) {
    const members = await storage.getQuoteMembersByQuoteId(quote.id, companyId);
    
    const primaryClientInMembers = members.find(m => m.role === 'client');
    
    if (quote.clientDateOfBirth && !primaryClientInMembers) {
      const monthDay = quote.clientDateOfBirth.slice(5); // MM-DD
      if (monthDay === todayMonthDay) {
        const fullName = `${quote.clientFirstName} ${quote.clientLastName}`.toLowerCase().trim();
        const birthdayKey = `${fullName}-${quote.clientDateOfBirth}`;
        if (!birthdaySet.has(birthdayKey)) {
          birthdaySet.add(birthdayKey);
          birthdays.push({
            name: `${quote.clientFirstName} ${quote.clientLastName}`,
            phone: quote.clientPhone || null,
            dateOfBirth: quote.clientDateOfBirth,
          });
        }
      }
    }

    for (const member of members) {
      if (member.dateOfBirth) {
        const monthDay = member.dateOfBirth.slice(5); // MM-DD
        if (monthDay === todayMonthDay) {
          const fullName = `${member.firstName} ${member.lastName}`.toLowerCase().trim();
          const birthdayKey = `${fullName}-${member.dateOfBirth}`;
          if (!birthdaySet.has(birthdayKey)) {
            birthdaySet.add(birthdayKey);
            birthdays.push({
              name: `${member.firstName} ${member.lastName}`,
              phone: member.phone || null,
              dateOfBirth: member.dateOfBirth,
            });
          }
        }
      }
    }
  }

  // ============== POLICIES BIRTHDAYS ==============
  const policiesData = await storage.getPoliciesByCompany(companyId);
  for (const policy of policiesData) {
    const members = await storage.getPolicyMembersByPolicyId(policy.id, companyId);
    
    const primaryClientInMembers = members.find(m => m.role === 'client');
    
    if (policy.clientDateOfBirth && !primaryClientInMembers) {
      const monthDay = policy.clientDateOfBirth.slice(5); // MM-DD
      if (monthDay === todayMonthDay) {
        const fullName = `${policy.clientFirstName} ${policy.clientLastName}`.toLowerCase().trim();
        const birthdayKey = `${fullName}-${policy.clientDateOfBirth}`;
        if (!birthdaySet.has(birthdayKey)) {
          birthdaySet.add(birthdayKey);
          birthdays.push({
            name: `${policy.clientFirstName} ${policy.clientLastName}`,
            phone: policy.clientPhone || null,
            dateOfBirth: policy.clientDateOfBirth,
          });
        }
      }
    }

    for (const member of members) {
      if (member.dateOfBirth) {
        const monthDay = member.dateOfBirth.slice(5); // MM-DD
        if (monthDay === todayMonthDay) {
          const fullName = `${member.firstName} ${member.lastName}`.toLowerCase().trim();
          const birthdayKey = `${fullName}-${member.dateOfBirth}`;
          if (!birthdaySet.has(birthdayKey)) {
            birthdaySet.add(birthdayKey);
            birthdays.push({
              name: `${member.firstName} ${member.lastName}`,
              phone: member.phone || null,
              dateOfBirth: member.dateOfBirth,
            });
          }
        }
      }
    }
  }

  // ============== USERS/TEAM BIRTHDAYS ==============
  try {
    const usersData = await storage.getUsersByCompany(companyId);
    for (const user of usersData) {
      if (user.dateOfBirth) {
        const monthDay = user.dateOfBirth.slice(5); // MM-DD
        if (monthDay === todayMonthDay) {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
          const birthdayKey = `${fullName.toLowerCase().trim()}-${user.dateOfBirth}`;
          if (!birthdaySet.has(birthdayKey)) {
            birthdaySet.add(birthdayKey);
            birthdays.push({
              name: fullName,
              phone: user.phone || null,
              dateOfBirth: user.dateOfBirth,
            });
          }
        }
      }
    }
  } catch (error: any) {
    console.error("[BIRTHDAY SCHEDULER] Error fetching team birthdays:", error);
  }

  // ============== MANUAL BIRTHDAYS ==============
  try {
    const manualBirthdaysData = await storage.getManualBirthdaysByCompany(companyId);
    for (const birthday of manualBirthdaysData) {
      const monthDay = birthday.dateOfBirth.slice(5); // MM-DD
      if (monthDay === todayMonthDay) {
        const birthdayKey = `${birthday.clientName.toLowerCase().trim()}-${birthday.dateOfBirth}`;
        if (!birthdaySet.has(birthdayKey)) {
          birthdaySet.add(birthdayKey);
          birthdays.push({
            name: birthday.clientName,
            phone: null, // Manual birthdays don't have phone numbers stored
            dateOfBirth: birthday.dateOfBirth,
          });
        }
      }
    }
  } catch (error: any) {
    console.error("[BIRTHDAY SCHEDULER] Error fetching manual birthdays:", error);
  }

  return birthdays;
}

/**
 * Background job that:
 * 1. Runs hourly
 * 2. Checks all companies with users whose local timezone is currently 9 AM
 * 3. Finds all birthday contacts today (from quotes, policies, manual contacts, team members)
 * 4. Sends birthday SMS greetings via Twilio
 * 5. Tracks sent greetings in birthdayGreetingHistory
 */
export function startBirthdayScheduler() {
  if (schedulerRunning) {
    console.log('[BIRTHDAY SCHEDULER] Already running');
    return;
  }

  console.log('[BIRTHDAY SCHEDULER] Starting scheduler...');
  schedulerRunning = true;

  // Run every hour at the start of the hour (0 minutes)
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      console.log(`[BIRTHDAY SCHEDULER] Running birthday check at ${now.toISOString()}`);

      // Get Twilio credentials from environment
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.log('[BIRTHDAY SCHEDULER] Twilio credentials not configured, skipping birthday checks');
        return;
      }

      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

      // Get all companies
      const allCompanies = await db.select().from(companies);
      console.log(`[BIRTHDAY SCHEDULER] Found ${allCompanies.length} companies`);

      // Process each company
      for (const company of allCompanies) {
        try {
          // Get company timezone (default to UTC if not set)
          const companyTimezone = company.timezone || 'UTC';
          
          // Check if it's 9 AM in the company's timezone
          const currentHourInCompanyTz = parseInt(formatInTimeZone(now, companyTimezone, 'HH'));
          
          if (currentHourInCompanyTz !== 9) {
            // Not 9 AM in this company's timezone, skip
            continue;
          }

          console.log(`[BIRTHDAY SCHEDULER] It's 9 AM in ${companyTimezone} for company ${company.name} (${company.id})`);

          // Get today's date in company's timezone (format: MM-DD)
          const todayMonthDay = formatInTimeZone(now, companyTimezone, 'MM-dd');

          // Find users with enabled birthday settings for this company
          const sendersWithSettings = await db
            .select({
              user: users,
              settings: userBirthdaySettings,
            })
            .from(users)
            .leftJoin(userBirthdaySettings, eq(users.id, userBirthdaySettings.userId))
            .where(
              and(
                eq(users.companyId, company.id),
                eq(userBirthdaySettings.isEnabled, true)
              )
            );

          if (sendersWithSettings.length === 0) {
            console.log(`[BIRTHDAY SCHEDULER] No enabled senders for company ${company.id}`);
            continue;
          }

          // Use the first enabled sender
          const sender = sendersWithSettings[0];
          const senderUser = sender.user;
          const senderSettings = sender.settings;

          if (!senderSettings) {
            console.log(`[BIRTHDAY SCHEDULER] Sender settings null for company ${company.id}`);
            continue;
          }

          // Get all birthdays for today from ALL sources (quotes, policies, manual contacts, team members)
          const todaysBirthdays = await getTodaysBirthdaysForCompany(company.id, todayMonthDay);

          console.log(`[BIRTHDAY SCHEDULER] Found ${todaysBirthdays.length} birthday(s) today in company ${company.name}`);

          // Track successfully sent greetings for notification
          let sentCount = 0;
          const sentNames: string[] = [];

          // Process each birthday
          for (const birthday of todaysBirthdays) {
            try {
              // Skip if no phone number
              if (!birthday.phone) {
                console.log(`[BIRTHDAY SCHEDULER] Skipping ${birthday.name} - no phone number`);
                continue;
              }

              // Check if greeting already sent today
              const alreadySent = await db
                .select()
                .from(birthdayGreetingHistory)
                .where(
                  and(
                    eq(birthdayGreetingHistory.recipientPhone, birthday.phone),
                    eq(birthdayGreetingHistory.recipientDateOfBirth, birthday.dateOfBirth),
                    sql`DATE(${birthdayGreetingHistory.sentAt}) = CURRENT_DATE`
                  )
                );

              if (alreadySent.length > 0) {
                console.log(`[BIRTHDAY SCHEDULER] Already sent birthday greeting to ${birthday.name} (${birthday.phone}) today`);
                continue;
              }

              // Get selected birthday image if any
              let imageUrl: string | null = null;
              if (senderSettings.selectedImageId) {
                // Check if selectedImageId is a direct URL (custom uploaded image)
                if (senderSettings.selectedImageId.startsWith('/uploads/') || 
                    senderSettings.selectedImageId.startsWith('http://') || 
                    senderSettings.selectedImageId.startsWith('https://')) {
                  let rawUrl = senderSettings.selectedImageId;
                  
                  // Convert local paths to public URLs
                  if (rawUrl.startsWith('/uploads/')) {
                    // Use Replit public URL in development, production URL otherwise
                    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
                    const appUrl = replitDomain ? `https://${replitDomain}` : (process.env.APP_URL || 'https://app.curbe.io');
                    imageUrl = `${appUrl}${rawUrl}`;
                  } else {
                    imageUrl = rawUrl;
                  }
                } else {
                  // Otherwise, it's a UUID - look up in birthday_images table
                  const image = await db
                    .select()
                    .from(birthdayImages)
                    .where(eq(birthdayImages.id, senderSettings.selectedImageId));
                  
                  if (image.length > 0 && image[0].isActive) {
                    let rawUrl = image[0].imageUrl;
                    
                    // Convert local paths to public URLs
                    if (rawUrl.startsWith('/uploads/')) {
                      // Use Replit public URL in development, production URL otherwise
                      const replitDomain = process.env.REPLIT_DEV_DOMAIN;
                      const appUrl = replitDomain ? `https://${replitDomain}` : (process.env.APP_URL || 'https://app.curbe.io');
                      imageUrl = `${appUrl}${rawUrl}`;
                    } else if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
                      imageUrl = rawUrl;
                    } else {
                      // Skip invalid URLs (base64, relative paths, etc.)
                      console.log(`[BIRTHDAY SCHEDULER] Skipping invalid image URL format: ${rawUrl.substring(0, 50)}...`);
                      imageUrl = null;
                    }
                  }
                }
              }

              // Prepare SMS message with personalization (first name only)
              const defaultMessage = "¡Feliz Cumpleaños {CLIENT_NAME}!\n\nTe deseamos el mejor de los éxitos en este nuevo año de vida.\n\nTe saluda {AGENT_NAME}, tu agente de seguros.";
              
              // Extract first name from client's full name
              const clientFirstName = birthday.name.split(' ')[0];
              
              // Use agent's first name only
              const agentFirstName = senderUser.firstName || senderUser.email.split('@')[0];
              
              const messageBody = (senderSettings.customMessage || defaultMessage)
                .replace('{CLIENT_NAME}', clientFirstName)
                .replace('{AGENT_NAME}', agentFirstName);

              console.log(`[BIRTHDAY SCHEDULER] Sending birthday greeting to ${birthday.name} (${birthday.phone})...`);

              // Send via Twilio
              let twilioMessageSid: string | null = null;
              let status = 'pending';
              let errorMessage: string | null = null;

              try {
                // STEP 1: Send IMAGE first (if selected)
                if (imageUrl) {
                  console.log(`[BIRTHDAY SCHEDULER] Sending image first: ${imageUrl}`);
                  const imageMessage = await twilioClient.messages.create({
                    mediaUrl: [imageUrl],
                    body: '🎂', // Fallback emoji in case MMS fails
                    from: twilioPhoneNumber,
                    to: birthday.phone,
                  });
                  console.log(`[BIRTHDAY SCHEDULER] Image sent successfully, SID: ${imageMessage.sid}`);
                  
                  // Small delay to ensure proper message ordering
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // STEP 2: Send TEXT message
                console.log(`[BIRTHDAY SCHEDULER] Sending text message`);
                const textMessage = await twilioClient.messages.create({
                  body: messageBody,
                  from: twilioPhoneNumber,
                  to: birthday.phone,
                });
                
                twilioMessageSid = textMessage.sid;
                status = textMessage.status || 'sent';
                
                console.log(`[BIRTHDAY SCHEDULER] Text sent successfully, SID: ${twilioMessageSid}`);
              } catch (twilioError: any) {
                console.error(`[BIRTHDAY SCHEDULER] Twilio error sending to ${birthday.name}:`, twilioError);
                status = 'failed';
                errorMessage = twilioError.message || 'Failed to send SMS';
              }

              // Save to birthday greeting history
              await db.insert(birthdayGreetingHistory).values({
                userId: senderUser.id,
                companyId: company.id,
                recipientName: birthday.name,
                recipientPhone: birthday.phone,
                recipientDateOfBirth: birthday.dateOfBirth,
                message: messageBody,
                imageUrl: imageUrl,
                status: status,
                twilioMessageSid: twilioMessageSid,
                errorMessage: errorMessage,
                sentAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              console.log(`[BIRTHDAY SCHEDULER] Birthday greeting recorded for ${birthday.name}`);

              // Track successful sends
              if (status === 'sent' || status === 'queued' || status === 'pending') {
                sentCount++;
                sentNames.push(birthday.name.split(' ')[0]); // First name only
              }

            } catch (error) {
              console.error(`[BIRTHDAY SCHEDULER] Error processing birthday for ${birthday.name}:`, error);
            }
          }

          // Create notification if any greetings were sent
          if (sentCount > 0) {
            try {
              const formattedDate = format(now, 'MMMM d, yyyy', { timeZone: companyTimezone });
              const notificationMessage = sentCount === 1 
                ? `Birthday greeting sent to ${sentNames[0]} on ${formattedDate}`
                : `Birthday greetings sent to all ${sentCount} birthday contacts on ${formattedDate}`;

              await db.insert(notifications).values({
                userId: senderUser.id,
                type: 'success',
                title: 'Birthday Greetings Sent',
                message: notificationMessage,
                link: '/settings?tab=automations',
                isRead: false,
                createdAt: new Date(),
              });

              console.log(`[BIRTHDAY SCHEDULER] Notification created for user ${senderUser.email}: ${sentCount} greetings sent`);
              
              // Broadcast notification update
              broadcastNotificationUpdate();
            } catch (notificationError) {
              console.error('[BIRTHDAY SCHEDULER] Error creating notification:', notificationError);
            }
          }

        } catch (error) {
          console.error(`[BIRTHDAY SCHEDULER] Error processing company ${company.id}:`, error);
        }
      }

      console.log('[BIRTHDAY SCHEDULER] Birthday check completed');
    } catch (error) {
      console.error('[BIRTHDAY SCHEDULER] Error in birthday scheduler:', error);
    }
  });

  console.log('[BIRTHDAY SCHEDULER] Scheduler started successfully (runs hourly at :00)');
}
