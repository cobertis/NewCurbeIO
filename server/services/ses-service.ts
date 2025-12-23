import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  DeleteConfigurationSetCommand,
  SendEmailCommand,
  SendBulkEmailCommand,
  PutEmailIdentityMailFromAttributesCommand,
  type CreateEmailIdentityCommandInput,
  type SendEmailCommandInput,
  type SendBulkEmailCommandInput,
  type BulkEmailEntry,
} from "@aws-sdk/client-sesv2";
import { db } from "../db";
import { 
  companyEmailSettings, 
  sesEmailMessages, 
  sesEmailEvents, 
  sesEmailQueue,
  companyEmailSuppression,
  companies,
  type CompanyEmailSettings,
  type InsertSesEmailMessage,
  type SesEmailMessage,
} from "@shared/schema";
import { eq, and, lte, sql, or } from "drizzle-orm";
import { credentialProvider } from "./credential-provider";

let sesClient: SESv2Client | null = null;
let cachedCredentials: { accessKeyId: string; secretAccessKey: string; region: string } | null = null;

async function getSesClient(): Promise<SESv2Client> {
  const credentials = await credentialProvider.getAwsSes();
  
  // Check if credentials have changed (forces client recreation)
  if (sesClient && cachedCredentials && 
      cachedCredentials.accessKeyId === credentials.accessKeyId &&
      cachedCredentials.secretAccessKey === credentials.secretAccessKey &&
      cachedCredentials.region === credentials.region) {
    return sesClient;
  }
  
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    throw new Error("AWS SES credentials not configured. Configure them in System Settings > API Credentials.");
  }
  
  sesClient = new SESv2Client({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
  cachedCredentials = credentials;
  
  return sesClient;
}

// Function to invalidate client when credentials change
export function invalidateSesClient(): void {
  sesClient = null;
  cachedCredentials = null;
  credentialProvider.invalidate('aws_ses');
}

export interface DnsRecord {
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  purpose: "DKIM" | "SPF" | "DMARC" | "MAIL_FROM" | "MAIL_FROM_SPF" | "VERIFICATION";
}

export interface DomainSetupResult {
  success: boolean;
  domain: string;
  dnsRecords: DnsRecord[];
  dkimStatus: string;
  verificationStatus: string;
  error?: string;
}

export interface EmailSendRequest {
  companyId: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  campaignId?: string;
  tags?: Record<string, string>;
  priority?: number;
}

export interface BulkEmailSendRequest {
  companyId: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  recipients: Array<{
    toEmail: string;
    toName?: string;
    replacementData?: Record<string, string>;
  }>;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  campaignId?: string;
  tags?: Record<string, string>;
}

// Sanitize tag values for AWS SES - only allows letters, numbers, spaces, and _ . : / = + - @
function sanitizeTagValue(value: string | undefined | null): string {
  if (!value) {
    return "unknown";
  }
  // Replace any invalid characters with underscores
  return value.replace(/[^a-zA-Z0-9 _.:/=+\-@]/g, '_');
}

class SesService {
  async createDomainIdentity(companyId: string, domain: string): Promise<DomainSetupResult> {
    try {
      const client = await getSesClient();
      
      const sanitizedDomain = domain.toLowerCase().trim();
      
      const input: CreateEmailIdentityCommandInput = {
        EmailIdentity: sanitizedDomain,
        DkimSigningAttributes: {
          NextSigningKeyLength: "RSA_2048_BIT",
        },
        Tags: [
          { Key: "companyId", Value: sanitizeTagValue(companyId) },
          { Key: "createdBy", Value: "curbe-ses-service" },
        ],
      };
      
      const command = new CreateEmailIdentityCommand(input);
      const response = await client.send(command);
      
      const dnsRecords: DnsRecord[] = [];
      
      if (response.DkimAttributes?.Tokens) {
        for (const token of response.DkimAttributes.Tokens) {
          dnsRecords.push({
            type: "CNAME",
            name: `${token}._domainkey.${sanitizedDomain}`,
            value: `${token}.dkim.amazonses.com`,
            purpose: "DKIM",
          });
        }
      }
      
      dnsRecords.push({
        type: "TXT",
        name: sanitizedDomain,
        value: `v=spf1 include:amazonses.com ~all`,
        purpose: "SPF",
      });
      
      dnsRecords.push({
        type: "TXT",
        name: `_dmarc.${sanitizedDomain}`,
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${sanitizedDomain}`,
        purpose: "DMARC",
      });
      
      const configSetName = `curbe-${companyId.substring(0, 8)}`;
      await this.createConfigurationSet(companyId, configSetName);
      
      // Set up MAIL_FROM subdomain for better deliverability
      const mailFromDomain = `mail.${sanitizedDomain}`;
      const awsCredentials = await credentialProvider.getAwsSes();
      const mailFromMxRecord = `feedback-smtp.${awsCredentials.region}.amazonses.com`;
      
      let mailFromSuccess = false;
      try {
        const mailFromCommand = new PutEmailIdentityMailFromAttributesCommand({
          EmailIdentity: sanitizedDomain,
          MailFromDomain: mailFromDomain,
          BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
        });
        await client.send(mailFromCommand);
        console.log(`[SES] MAIL_FROM configured: ${mailFromDomain}`);
        mailFromSuccess = true;
      } catch (mailFromError: any) {
        console.error("[SES] Error setting up MAIL_FROM:", mailFromError.message);
        // Continue anyway - MAIL_FROM is optional but recommended
      }
      
      // Only add MAIL_FROM DNS records if the AWS call succeeded
      if (mailFromSuccess) {
        dnsRecords.push({
          type: "MX",
          name: mailFromDomain,
          value: `10 ${mailFromMxRecord}`,
          purpose: "MAIL_FROM",
        });
        
        dnsRecords.push({
          type: "TXT",
          name: mailFromDomain,
          value: "v=spf1 include:amazonses.com ~all",
          purpose: "MAIL_FROM_SPF",
        });
      }
      
      await db.insert(companyEmailSettings).values({
        companyId,
        sendingDomain: sanitizedDomain,
        dkimStatus: "pending",
        domainVerificationStatus: "pending",
        dkimTokens: response.DkimAttributes?.Tokens || [],
        spfRecord: `v=spf1 include:amazonses.com ~all`,
        dmarcRecord: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${sanitizedDomain}`,
        configurationSetName: configSetName,
        emailStatus: "pending_verification",
        // Only persist MAIL_FROM config if AWS call succeeded
        mailFromDomain: mailFromSuccess ? mailFromDomain : null,
        mailFromMxRecord: mailFromSuccess ? mailFromMxRecord : null,
        mailFromStatus: mailFromSuccess ? "pending" : "not_configured",
      }).onConflictDoUpdate({
        target: companyEmailSettings.companyId,
        set: {
          sendingDomain: sanitizedDomain,
          dkimStatus: "pending",
          domainVerificationStatus: "pending",
          dkimTokens: response.DkimAttributes?.Tokens || [],
          spfRecord: `v=spf1 include:amazonses.com ~all`,
          dmarcRecord: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${sanitizedDomain}`,
          configurationSetName: configSetName,
          emailStatus: "pending_verification",
          // Only persist MAIL_FROM config if AWS call succeeded
          mailFromDomain: mailFromSuccess ? mailFromDomain : null,
          mailFromMxRecord: mailFromSuccess ? mailFromMxRecord : null,
          mailFromStatus: mailFromSuccess ? "pending" : "not_configured",
          updatedAt: new Date(),
        },
      });
      
      return {
        success: true,
        domain: sanitizedDomain,
        dnsRecords,
        dkimStatus: response.DkimAttributes?.Status || "PENDING",
        verificationStatus: response.VerifiedForSendingStatus ? "SUCCESS" : "PENDING",
      };
    } catch (error: any) {
      console.error("[SES] Error creating domain identity:", error);
      return {
        success: false,
        domain,
        dnsRecords: [],
        dkimStatus: "FAILED",
        verificationStatus: "FAILED",
        error: error.message,
      };
    }
  }
  
  async getIdentityStatus(companyId: string): Promise<{
    domain: string | null;
    dkimStatus: string;
    verificationStatus: string;
    mailFromStatus: string;
    isVerified: boolean;
  }> {
    try {
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, companyId))
        .limit(1);
      
      if (!settings || !settings.sendingDomain) {
        return {
          domain: null,
          dkimStatus: "not_started",
          verificationStatus: "not_started",
          mailFromStatus: "not_configured",
          isVerified: false,
        };
      }
      
      const client = await getSesClient();
      const command = new GetEmailIdentityCommand({
        EmailIdentity: settings.sendingDomain,
      });
      
      const response = await client.send(command);
      
      const dkimStatus = response.DkimAttributes?.Status || "NOT_STARTED";
      const verificationStatus = response.VerifiedForSendingStatus ? "SUCCESS" : "PENDING";
      const mailFromStatus = response.MailFromAttributes?.MailFromDomainStatus || "NOT_CONFIGURED";
      
      const isVerified = dkimStatus === "SUCCESS" && response.VerifiedForSendingStatus === true;
      
      await db.update(companyEmailSettings)
        .set({
          dkimStatus: dkimStatus.toLowerCase() as any,
          domainVerificationStatus: verificationStatus.toLowerCase(),
          mailFromStatus: mailFromStatus.toLowerCase(),
          emailStatus: isVerified ? "active" : "pending_verification",
          updatedAt: new Date(),
        })
        .where(eq(companyEmailSettings.companyId, companyId));
      
      return {
        domain: settings.sendingDomain,
        dkimStatus,
        verificationStatus,
        mailFromStatus,
        isVerified,
      };
    } catch (error: any) {
      console.error("[SES] Error getting identity status:", error);
      throw error;
    }
  }
  
  async setupMailFrom(companyId: string, mailFromDomain: string): Promise<{ success: boolean; mxRecord: string; error?: string }> {
    try {
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, companyId))
        .limit(1);
      
      if (!settings || !settings.sendingDomain) {
        return { success: false, mxRecord: "", error: "Domain not configured" };
      }
      
      const client = await getSesClient();
      const command = new PutEmailIdentityMailFromAttributesCommand({
        EmailIdentity: settings.sendingDomain,
        MailFromDomain: mailFromDomain,
        BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
      });
      
      await client.send(command);
      
      const awsCredentials = await credentialProvider.getAwsSes();
      const mxRecord = `feedback-smtp.${awsCredentials.region}.amazonses.com`;
      
      await db.update(companyEmailSettings)
        .set({
          mailFromDomain,
          mailFromStatus: "pending",
          mailFromMxRecord: mxRecord,
          updatedAt: new Date(),
        })
        .where(eq(companyEmailSettings.companyId, companyId));
      
      return { success: true, mxRecord };
    } catch (error: any) {
      console.error("[SES] Error setting up MAIL FROM:", error);
      return { success: false, mxRecord: "", error: error.message };
    }
  }
  
  async createConfigurationSet(companyId: string, configSetName: string): Promise<boolean> {
    try {
      const client = await getSesClient();
      
      await client.send(new CreateConfigurationSetCommand({
        ConfigurationSetName: configSetName,
        TrackingOptions: {
          CustomRedirectDomain: undefined,
        },
        SendingOptions: {
          SendingEnabled: true,
        },
        ReputationOptions: {
          ReputationMetricsEnabled: true,
        },
        Tags: [
          { Key: "companyId", Value: sanitizeTagValue(companyId) },
        ],
      }));
      
      console.log(`[SES] Created configuration set: ${configSetName}`);
      return true;
    } catch (error: any) {
      if (error.name === "AlreadyExistsException") {
        console.log(`[SES] Configuration set already exists: ${configSetName}`);
        return true;
      }
      console.error("[SES] Error creating configuration set:", error);
      return false;
    }
  }
  
  async setupEventDestination(companyId: string, snsTopicArn: string): Promise<boolean> {
    try {
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, companyId))
        .limit(1);
      
      if (!settings || !settings.configurationSetName) {
        throw new Error("Configuration set not found");
      }
      
      const client = await getSesClient();
      const eventDestinationName = `events-${companyId.substring(0, 8)}`;
      
      await client.send(new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: settings.configurationSetName,
        EventDestinationName: eventDestinationName,
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: [
            "SEND",
            "DELIVERY",
            "BOUNCE",
            "COMPLAINT",
            "REJECT",
            "OPEN",
            "CLICK",
            "RENDERING_FAILURE",
            "DELIVERY_DELAY",
          ],
          SnsDestination: {
            TopicArn: snsTopicArn,
          },
        },
      }));
      
      await db.update(companyEmailSettings)
        .set({
          eventDestinationName,
          updatedAt: new Date(),
        })
        .where(eq(companyEmailSettings.companyId, companyId));
      
      console.log(`[SES] Created event destination: ${eventDestinationName}`);
      return true;
    } catch (error: any) {
      if (error.name === "AlreadyExistsException") {
        return true;
      }
      console.error("[SES] Error creating event destination:", error);
      return false;
    }
  }
  
  async queueEmail(request: EmailSendRequest): Promise<{ messageId: string; queued: boolean; error?: string }> {
    try {
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, request.companyId))
        .limit(1);
      
      if (!settings) {
        return { messageId: "", queued: false, error: "Email settings not configured" };
      }
      
      if (settings.emailStatus === "paused" || settings.emailStatus === "suspended") {
        return { messageId: "", queued: false, error: `Email sending is ${settings.emailStatus}` };
      }
      
      const [suppressed] = await db
        .select()
        .from(companyEmailSuppression)
        .where(
          and(
            eq(companyEmailSuppression.companyId, request.companyId),
            eq(companyEmailSuppression.email, request.toEmail.toLowerCase())
          )
        )
        .limit(1);
      
      if (suppressed) {
        return { messageId: "", queued: false, error: `Email ${request.toEmail} is suppressed: ${suppressed.reason}` };
      }
      
      const [message] = await db.insert(sesEmailMessages).values({
        companyId: request.companyId,
        fromEmail: request.fromEmail,
        fromName: request.fromName,
        replyTo: request.replyTo,
        toEmail: request.toEmail,
        toName: request.toName,
        subject: request.subject,
        htmlContent: request.htmlContent,
        textContent: request.textContent,
        campaignId: request.campaignId,
        configurationSetName: settings.configurationSetName,
        status: "queued",
        tags: request.tags || {},
      }).returning();
      
      await db.insert(sesEmailQueue).values({
        companyId: request.companyId,
        messageId: message.id,
        priority: request.priority || 5,
        scheduledFor: new Date(),
        status: "pending",
      });
      
      return { messageId: message.id, queued: true };
    } catch (error: any) {
      console.error("[SES] Error queueing email:", error);
      return { messageId: "", queued: false, error: error.message };
    }
  }
  
  async sendEmailDirect(messageId: string): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    try {
      const [message] = await db
        .select()
        .from(sesEmailMessages)
        .where(eq(sesEmailMessages.id, messageId))
        .limit(1);
      
      if (!message) {
        return { success: false, error: "Message not found" };
      }
      
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, message.companyId))
        .limit(1);
      
      if (!settings || settings.emailStatus !== "active") {
        return { success: false, error: "Email sending not active" };
      }
      
      const client = await getSesClient();
      
      const fromAddress = message.fromName 
        ? `"${message.fromName}" <${message.fromEmail}>`
        : message.fromEmail;
      
      const input: SendEmailCommandInput = {
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: [message.toEmail],
        },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: "UTF-8" },
            Body: {},
          },
        },
        ConfigurationSetName: settings.configurationSetName || undefined,
        EmailTags: [
          { Name: "companyId", Value: sanitizeTagValue(message.companyId) },
          { Name: "messageId", Value: sanitizeTagValue(message.id) },
        ],
      };
      
      if (message.htmlContent) {
        input.Content!.Simple!.Body!.Html = { Data: message.htmlContent, Charset: "UTF-8" };
      }
      if (message.textContent) {
        input.Content!.Simple!.Body!.Text = { Data: message.textContent, Charset: "UTF-8" };
      }
      if (message.replyTo) {
        input.ReplyToAddresses = [message.replyTo];
      }
      
      const command = new SendEmailCommand(input);
      const response = await client.send(command);
      
      await db.update(sesEmailMessages)
        .set({
          status: "sent",
          providerMessageId: response.MessageId,
          sentAt: new Date(),
        })
        .where(eq(sesEmailMessages.id, messageId));
      
      await db.update(companyEmailSettings)
        .set({
          totalSent: sql`${companyEmailSettings.totalSent} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(companyEmailSettings.companyId, message.companyId));
      
      return { success: true, providerMessageId: response.MessageId };
    } catch (error: any) {
      console.error("[SES] Error sending email:", error);
      
      await db.update(sesEmailMessages)
        .set({
          status: "failed",
          errorCode: error.name,
          errorMessage: error.message,
        })
        .where(eq(sesEmailMessages.id, messageId));
      
      return { success: false, error: error.message };
    }
  }
  
  async processQueue(batchSize: number = 10): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;
    
    try {
      const pendingItems = await db
        .select()
        .from(sesEmailQueue)
        .where(
          and(
            eq(sesEmailQueue.status, "pending"),
            lte(sesEmailQueue.scheduledFor, new Date())
          )
        )
        .orderBy(sesEmailQueue.priority, sesEmailQueue.scheduledFor)
        .limit(batchSize);
      
      for (const item of pendingItems) {
        await db.update(sesEmailQueue)
          .set({ status: "processing", lastAttemptAt: new Date() })
          .where(eq(sesEmailQueue.id, item.id));
        
        const result = await this.sendEmailDirect(item.messageId);
        
        if (result.success) {
          await db.update(sesEmailQueue)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(sesEmailQueue.id, item.id));
          processed++;
        } else {
          const newAttempts = (item.attempts || 0) + 1;
          
          if (newAttempts >= (item.maxAttempts || 3)) {
            await db.update(sesEmailQueue)
              .set({ 
                status: "failed", 
                attempts: newAttempts,
                errorMessage: result.error,
              })
              .where(eq(sesEmailQueue.id, item.id));
          } else {
            const nextAttempt = new Date(Date.now() + Math.pow(2, newAttempts) * 60000);
            await db.update(sesEmailQueue)
              .set({ 
                status: "pending", 
                attempts: newAttempts,
                nextAttemptAt: nextAttempt,
                scheduledFor: nextAttempt,
                errorMessage: result.error,
              })
              .where(eq(sesEmailQueue.id, item.id));
          }
          failed++;
        }
      }
    } catch (error) {
      console.error("[SES] Error processing queue:", error);
    }
    
    return { processed, failed };
  }
  
  async getCompanyEmailSettings(companyId: string): Promise<CompanyEmailSettings | null> {
    const [settings] = await db
      .select()
      .from(companyEmailSettings)
      .where(eq(companyEmailSettings.companyId, companyId))
      .limit(1);
    return settings || null;
  }
  
  async updateCompanyEmailSettings(companyId: string, updates: Partial<CompanyEmailSettings>): Promise<boolean> {
    try {
      await db.update(companyEmailSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(companyEmailSettings.companyId, companyId));
      return true;
    } catch (error) {
      console.error("[SES] Error updating settings:", error);
      return false;
    }
  }
  
  async getEmailMetrics(companyId: string, days: number = 30): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalComplaints: number;
    bounceRate: number;
    complaintRate: number;
    openRate: number;
    clickRate: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [settings] = await db
      .select()
      .from(companyEmailSettings)
      .where(eq(companyEmailSettings.companyId, companyId))
      .limit(1);
    
    if (!settings) {
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalBounced: 0,
        totalComplaints: 0,
        bounceRate: 0,
        complaintRate: 0,
        openRate: 0,
        clickRate: 0,
      };
    }
    
    const totalSent = settings.totalSent || 0;
    const totalDelivered = settings.totalDelivered || 0;
    const totalBounced = settings.totalBounced || 0;
    const totalComplaints = settings.totalComplaints || 0;
    
    const bounceRate = totalSent > 0 ? totalBounced / totalSent : 0;
    const complaintRate = totalSent > 0 ? totalComplaints / totalSent : 0;
    
    return {
      totalSent,
      totalDelivered,
      totalBounced,
      totalComplaints,
      bounceRate,
      complaintRate,
      openRate: 0,
      clickRate: 0,
    };
  }
  
  async deleteDomainIdentity(companyId: string): Promise<boolean> {
    try {
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, companyId))
        .limit(1);
      
      if (!settings || !settings.sendingDomain) {
        return true;
      }
      
      const client = await getSesClient();
      
      await client.send(new DeleteEmailIdentityCommand({
        EmailIdentity: settings.sendingDomain,
      }));
      
      if (settings.configurationSetName) {
        try {
          await client.send(new DeleteConfigurationSetCommand({
            ConfigurationSetName: settings.configurationSetName,
          }));
        } catch (e) {
        }
      }
      
      await db.delete(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, companyId));
      
      return true;
    } catch (error: any) {
      console.error("[SES] Error deleting domain identity:", error);
      return false;
    }
  }
}

export const sesService = new SesService();
