import cron from 'node-cron';
import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { db } from './db.js';
import { contacts } from '../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { credentialProvider } from './services/credential-provider.js';

let schedulerRunning = false;
let isProcessing = false;

interface BounceInfo {
  failedEmail: string;
  bounceReason?: string;
  originalSubject?: string;
}

function extractFailedRecipient(mail: ParsedMail): BounceInfo | null {
  let failedEmail: string | null = null;
  let bounceReason: string | undefined;
  let originalSubject: string | undefined = mail.subject;

  const xFailedRecipients = mail.headers.get('x-failed-recipients');
  if (xFailedRecipients) {
    const value = typeof xFailedRecipients === 'string' 
      ? xFailedRecipients 
      : (xFailedRecipients as any)?.text || String(xFailedRecipients);
    failedEmail = value.trim().toLowerCase();
    console.log(`[BOUNCE PROCESSOR] Found X-Failed-Recipients: ${failedEmail}`);
  }

  if (!failedEmail) {
    const originalRecipient = mail.headers.get('original-recipient');
    if (originalRecipient) {
      const value = typeof originalRecipient === 'string'
        ? originalRecipient
        : (originalRecipient as any)?.text || String(originalRecipient);
      const match = value.match(/rfc822;\s*(.+)/i);
      if (match) {
        failedEmail = match[1].trim().toLowerCase();
        console.log(`[BOUNCE PROCESSOR] Found Original-Recipient: ${failedEmail}`);
      }
    }
  }

  if (!failedEmail) {
    const finalRecipient = mail.headers.get('final-recipient');
    if (finalRecipient) {
      const value = typeof finalRecipient === 'string'
        ? finalRecipient
        : (finalRecipient as any)?.text || String(finalRecipient);
      const match = value.match(/rfc822;\s*(.+)/i);
      if (match) {
        failedEmail = match[1].trim().toLowerCase();
        console.log(`[BOUNCE PROCESSOR] Found Final-Recipient: ${failedEmail}`);
      }
    }
  }

  if (!failedEmail && mail.text) {
    const emailRegex = /(?:failed|rejected|bounced|undeliverable)[^@]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    const matches = mail.text.match(emailRegex);
    if (matches && matches.length > 0) {
      const emailMatch = matches[0].match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emailMatch) {
        failedEmail = emailMatch[1].toLowerCase();
        console.log(`[BOUNCE PROCESSOR] Found email in body context: ${failedEmail}`);
      }
    }
  }

  if (!failedEmail && mail.text) {
    const simpleEmailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    const allEmails = mail.text.match(simpleEmailRegex);
    if (allEmails && allEmails.length > 0) {
      const uniqueEmails = [...new Set(allEmails.map(e => e.toLowerCase()))];
      for (const email of uniqueEmails) {
        if (!email.includes('postmaster') && 
            !email.includes('mailer-daemon') && 
            !email.includes('noreply') &&
            !email.includes('no-reply') &&
            !email.includes('rebotes@')) {
          failedEmail = email;
          console.log(`[BOUNCE PROCESSOR] Found email in body (fallback): ${failedEmail}`);
          break;
        }
      }
    }
  }

  if (mail.text) {
    const reasonPatterns = [
      /(?:reason|error|diagnostic)[:\s]+(.{10,100})/gi,
      /(?:550|551|552|553|554)[:\s]+(.{10,100})/gi,
      /user\s+(?:unknown|not found|does not exist)/gi,
      /mailbox\s+(?:not found|unavailable|full)/gi,
      /address\s+rejected/gi,
    ];
    
    for (const pattern of reasonPatterns) {
      const match = mail.text.match(pattern);
      if (match) {
        bounceReason = match[0].substring(0, 200);
        break;
      }
    }
  }

  if (!failedEmail) {
    console.log('[BOUNCE PROCESSOR] Could not extract failed email from bounce message');
    return null;
  }

  return { failedEmail, bounceReason, originalSubject };
}

async function updateContactAsBounced(email: string, reason?: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    const existingContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.email, normalizedEmail));

    if (existingContacts.length === 0) {
      console.log(`[BOUNCE PROCESSOR] No contact found with email: ${normalizedEmail}`);
      return false;
    }

    for (const contact of existingContacts) {
      await db
        .update(contacts)
        .set({
          emailBounced: true,
          emailBouncedAt: new Date(),
          emailBounceReason: reason || 'Email bounced - address invalid or unavailable',
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contact.id));

      console.log(`[BOUNCE PROCESSOR] Marked contact ${contact.id} (${contact.displayName || contact.email}) as bounced`);
    }

    return true;
  } catch (error) {
    console.error('[BOUNCE PROCESSOR] Error updating contact:', error);
    return false;
  }
}

async function processBouncedEmails(): Promise<void> {
  if (isProcessing) {
    console.log('[BOUNCE PROCESSOR] Already processing, skipping this run');
    return;
  }

  isProcessing = true;
  console.log('[BOUNCE PROCESSOR] Starting bounce email processing...');

  try {
    const imapCreds = await credentialProvider.getImapBounce();
    
    if (!imapCreds.host || !imapCreds.user || !imapCreds.password) {
      console.log('[BOUNCE PROCESSOR] IMAP credentials not configured, skipping');
      return;
    }

    const imapConfig: Imap.Config = {
      user: imapCreds.user,
      password: imapCreds.password,
      host: imapCreds.host,
      port: imapCreds.port ? parseInt(imapCreds.port, 10) : 993,
      tls: imapCreds.tls === 'true' || imapCreds.tls === '1' || !imapCreds.tls,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000,
      authTimeout: 30000,
    };

    await new Promise<void>((resolve, reject) => {
      const imap = new Imap(imapConfig);

      imap.once('ready', () => {
        console.log('[BOUNCE PROCESSOR] IMAP connection established');

        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            console.error('[BOUNCE PROCESSOR] Error opening INBOX:', err);
            imap.end();
            reject(err);
            return;
          }

          console.log(`[BOUNCE PROCESSOR] INBOX opened, ${box.messages.total} total messages`);

          imap.search(['UNSEEN'], (searchErr, results) => {
            if (searchErr) {
              console.error('[BOUNCE PROCESSOR] Error searching messages:', searchErr);
              imap.end();
              reject(searchErr);
              return;
            }

            if (!results || results.length === 0) {
              console.log('[BOUNCE PROCESSOR] No unseen messages found');
              imap.end();
              resolve();
              return;
            }

            console.log(`[BOUNCE PROCESSOR] Found ${results.length} unseen message(s)`);

            let processedCount = 0;
            let bouncedCount = 0;
            const totalMessages = results.length;

            const fetch = imap.fetch(results, { bodies: '', markSeen: true });

            fetch.on('message', (msg, seqno) => {
              let buffer = '';
              
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
              });

              msg.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  console.log(`[BOUNCE PROCESSOR] Processing message ${seqno}: "${parsed.subject || 'No subject'}"`);

                  const bounceInfo = extractFailedRecipient(parsed);
                  
                  if (bounceInfo) {
                    const updated = await updateContactAsBounced(
                      bounceInfo.failedEmail,
                      bounceInfo.bounceReason
                    );
                    
                    if (updated) {
                      bouncedCount++;
                    }
                  }
                } catch (parseErr) {
                  console.error(`[BOUNCE PROCESSOR] Error parsing message ${seqno}:`, parseErr);
                } finally {
                  processedCount++;
                  
                  if (processedCount === totalMessages) {
                    console.log(`[BOUNCE PROCESSOR] Finished processing. Processed: ${processedCount}, Bounces marked: ${bouncedCount}`);
                    imap.end();
                    resolve();
                  }
                }
              });
            });

            fetch.once('error', (fetchErr) => {
              console.error('[BOUNCE PROCESSOR] Fetch error:', fetchErr);
              imap.end();
              reject(fetchErr);
            });

            fetch.once('end', () => {
              if (processedCount === 0 && totalMessages === 0) {
                imap.end();
                resolve();
              }
            });
          });
        });
      });

      imap.once('error', (err: Error) => {
        console.error('[BOUNCE PROCESSOR] IMAP error:', err.message);
        reject(err);
      });

      imap.once('end', () => {
        console.log('[BOUNCE PROCESSOR] IMAP connection ended');
      });

      imap.connect();
    });

  } catch (error) {
    console.error('[BOUNCE PROCESSOR] Error processing bounces:', error);
  } finally {
    isProcessing = false;
  }
}

export function startBounceProcessor() {
  if (schedulerRunning) {
    console.log('[BOUNCE PROCESSOR] Already running');
    return;
  }

  console.log('[BOUNCE PROCESSOR] Starting scheduler...');

  cron.schedule('*/5 * * * *', async () => {
    try {
      await processBouncedEmails();
    } catch (error) {
      console.error('[BOUNCE PROCESSOR] Scheduler error:', error);
    }
  });

  schedulerRunning = true;
  console.log('[BOUNCE PROCESSOR] Scheduler started (runs every 5 minutes)');

  setTimeout(async () => {
    try {
      console.log('[BOUNCE PROCESSOR] Running initial check...');
      await processBouncedEmails();
    } catch (error) {
      console.error('[BOUNCE PROCESSOR] Initial check error:', error);
    }
  }, 10000);
}

export function stopBounceProcessor() {
  schedulerRunning = false;
  console.log('[BOUNCE PROCESSOR] Scheduler stopped');
}

export { processBouncedEmails };
