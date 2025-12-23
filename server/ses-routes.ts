import { Express, Request, Response } from "express";
import { sesService, type EmailSendRequest } from "./services/ses-service";
import { sesEventsService, type SesEventPayload } from "./services/ses-events-service";
import { z } from "zod";
import crypto from "crypto";
import { db } from "./db";
import { companyEmailSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const domainSetupSchema = z.object({
  domain: z.string().min(3).max(255),
});

const mailFromSetupSchema = z.object({
  mailFromDomain: z.string().min(3).max(255),
});

const sendEmailSchema = z.object({
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  subject: z.string().min(1).max(998),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  campaignId: z.string().optional(),
  tags: z.record(z.string()).optional(),
});

const updateSettingsSchema = z.object({
  senderName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  replyToEmail: z.string().email().optional(),
  dailySendLimit: z.number().min(1).optional(),
  hourlySendLimit: z.number().min(1).optional(),
  minuteSendLimit: z.number().min(1).optional(),
  bounceRateThreshold: z.number().min(0).max(1).optional(),
  complaintRateThreshold: z.number().min(0).max(1).optional(),
  autoPauseEnabled: z.boolean().optional(),
});

function getCompanyId(req: Request): string {
  const companyId = req.session?.user?.companyId;
  if (!companyId) {
    throw new Error("Company context required");
  }
  return companyId;
}

export function registerSesRoutes(app: Express, requireActiveCompany: any) {
  app.get("/api/ses/settings", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const settings = await sesService.getCompanyEmailSettings(companyId);
      
      if (!settings) {
        return res.json({
          configured: false,
          settings: null,
        });
      }
      
      res.json({
        configured: true,
        settings: {
          id: settings.id,
          sendingDomain: settings.sendingDomain,
          fromEmail: settings.fromEmail,
          replyToEmail: settings.replyToEmail,
          senderName: settings.senderName,
          senders: settings.senders || [],
          dkimStatus: settings.dkimStatus,
          domainVerificationStatus: settings.domainVerificationStatus,
          verificationStatus: settings.domainVerificationStatus,
          mailFromDomain: settings.mailFromDomain,
          mailFromStatus: settings.mailFromStatus,
          emailStatus: settings.emailStatus,
          dailySendLimit: settings.dailySendLimit,
          hourlySendLimit: settings.hourlySendLimit,
          minuteSendLimit: settings.minuteSendLimit,
          warmUpStage: settings.warmUpStage,
          totalSent: settings.totalSent,
          totalDelivered: settings.totalDelivered,
          totalBounced: settings.totalBounced,
          totalComplaints: settings.totalComplaints,
          bounceRate: settings.bounceRate,
          complaintRate: settings.complaintRate,
          bounceRateThreshold: settings.bounceRateThreshold,
          complaintRateThreshold: settings.complaintRateThreshold,
          autoPauseEnabled: settings.autoPauseEnabled,
          pausedAt: settings.pausedAt,
          pauseReason: settings.pauseReason,
          createdAt: settings.createdAt,
          updatedAt: settings.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("[SES Routes] Error getting settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/ses/domain/setup", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const { domain } = domainSetupSchema.parse(req.body);
      
      const result = await sesService.createDomainIdentity(companyId, domain);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error || "Failed to setup domain" });
      }
      
      res.json({
        success: true,
        domain: result.domain,
        dnsRecords: result.dnsRecords,
        dkimStatus: result.dkimStatus,
        verificationStatus: result.verificationStatus,
      });
    } catch (error: any) {
      console.error("[SES Routes] Error setting up domain:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid domain format" });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/ses/domain/status", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const status = await sesService.getIdentityStatus(companyId);
      res.json(status);
    } catch (error: any) {
      console.error("[SES Routes] Error getting domain status:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Disconnect/delete domain endpoint
  app.delete("/api/ses/domain", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const settings = await sesService.getCompanyEmailSettings(companyId);
      
      if (!settings || !settings.sendingDomain) {
        return res.status(404).json({ message: "No domain configured" });
      }
      
      const deleted = await sesService.deleteDomainIdentity(companyId);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete domain" });
      }
      
      res.json({
        success: true,
        message: "Domain disconnected successfully",
      });
    } catch (error: any) {
      console.error("[SES Routes] Error deleting domain:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/ses/domain/dns-records", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const settings = await sesService.getCompanyEmailSettings(companyId);
      
      if (!settings || !settings.sendingDomain) {
        return res.status(404).json({ message: "Domain not configured" });
      }
      
      const dnsRecords: Array<{
        type: string;
        name: string;
        value: string;
        purpose: string;
        status?: string;
      }> = [];
      
      // Helper function to check DNS records via DNS lookup using Google DNS (8.8.8.8) to bypass local cache
      const checkDnsRecord = async (type: string, name: string, expectedValue: string): Promise<string> => {
        try {
          const dns = await import("dns");
          const resolver = new dns.Resolver();
          resolver.setServers(['8.8.8.8', '8.8.4.4']); // Use Google DNS for fresh results
          
          const resolveCname = (hostname: string): Promise<string[]> => {
            return new Promise((resolve, reject) => {
              resolver.resolveCname(hostname, (err, addresses) => {
                if (err) reject(err);
                else resolve(addresses || []);
              });
            });
          };
          
          const resolveTxt = (hostname: string): Promise<string[][]> => {
            return new Promise((resolve, reject) => {
              resolver.resolveTxt(hostname, (err, records) => {
                if (err) reject(err);
                else resolve(records || []);
              });
            });
          };
          
          if (type === "CNAME") {
            const records = await resolveCname(name);
            // Check if any returned CNAME matches expected value (with or without trailing dot)
            const normalizedExpected = expectedValue.replace(/\.$/, "").toLowerCase();
            const found = records.some(r => r.replace(/\.$/, "").toLowerCase() === normalizedExpected);
            return found ? "SUCCESS" : "PENDING";
          } else if (type === "TXT") {
            const records = await resolveTxt(name);
            // TXT records are returned as arrays of strings, join them
            const flatRecords = records.map(r => r.join(""));
            // Check if any TXT record contains key parts of expected value
            const found = flatRecords.some(r => {
              // For SPF, check if it includes amazonses.com
              if (expectedValue.includes("amazonses.com")) {
                return r.includes("amazonses.com");
              }
              // For DMARC, check if it starts with v=DMARC1
              if (expectedValue.startsWith("v=DMARC1")) {
                return r.startsWith("v=DMARC1");
              }
              return r === expectedValue;
            });
            return found ? "SUCCESS" : "PENDING";
          }
          return "PENDING";
        } catch (error: any) {
          // DNS lookup failed (record doesn't exist)
          return "PENDING";
        }
      };
      
      const dkimTokens = (settings.dkimTokens as string[]) || [];
      
      // Check each DKIM record individually
      for (const token of dkimTokens) {
        const recordName = `${token}._domainkey.${settings.sendingDomain}`;
        const recordValue = `${token}.dkim.amazonses.com`;
        const status = await checkDnsRecord("CNAME", recordName, recordValue);
        
        dnsRecords.push({
          type: "CNAME",
          name: recordName,
          value: recordValue,
          purpose: "DKIM",
          status,
        });
      }
      
      // Check SPF record
      if (settings.spfRecord) {
        const spfStatus = await checkDnsRecord("TXT", settings.sendingDomain, settings.spfRecord);
        dnsRecords.push({
          type: "TXT",
          name: settings.sendingDomain,
          value: settings.spfRecord,
          purpose: "SPF",
          status: spfStatus,
        });
      }
      
      // Check DMARC record
      if (settings.dmarcRecord) {
        const dmarcName = `_dmarc.${settings.sendingDomain}`;
        const dmarcStatus = await checkDnsRecord("TXT", dmarcName, settings.dmarcRecord);
        dnsRecords.push({
          type: "TXT",
          name: dmarcName,
          value: settings.dmarcRecord,
          purpose: "DMARC",
          status: dmarcStatus,
        });
      }
      
      // NOTE: MAIL_FROM records are intentionally NOT included
      // because they require MX records that could interfere with
      // the customer's existing mail server. AWS SES uses its
      // default amazonses.com domain for bounces which works fine.
      
      res.json({ records: dnsRecords });
    } catch (error: any) {
      console.error("[SES Routes] Error getting DNS records:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/ses/domain/verify", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const status = await sesService.getIdentityStatus(companyId);
      
      res.json({
        verified: status.isVerified,
        dkimStatus: status.dkimStatus,
        verificationStatus: status.verificationStatus,
        mailFromStatus: status.mailFromStatus,
      });
    } catch (error: any) {
      console.error("[SES Routes] Error verifying domain:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/ses/mail-from/setup", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const { mailFromDomain } = mailFromSetupSchema.parse(req.body);
      
      const result = await sesService.setupMailFrom(companyId, mailFromDomain);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error || "Failed to setup MAIL FROM" });
      }
      
      res.json({
        success: true,
        mailFromDomain,
        mxRecord: result.mxRecord,
      });
    } catch (error: any) {
      console.error("[SES Routes] Error setting up MAIL FROM:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.patch("/api/ses/settings", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const updates = updateSettingsSchema.parse(req.body);
      
      const success = await sesService.updateCompanyEmailSettings(companyId, updates as any);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to update settings" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SES Routes] Error updating settings:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid settings format" });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/ses/resume", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const settings = await sesService.getCompanyEmailSettings(companyId);
      
      if (!settings) {
        return res.status(404).json({ message: "Email settings not found" });
      }
      
      if (settings.emailStatus !== "paused") {
        return res.status(400).json({ message: "Email is not paused" });
      }
      
      const status = await sesService.getIdentityStatus(companyId);
      if (!status.isVerified) {
        return res.status(400).json({ message: "Domain verification required before resuming" });
      }
      
      await sesService.updateCompanyEmailSettings(companyId, {
        emailStatus: "active" as any,
        pausedAt: null,
        pauseReason: null,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SES Routes] Error resuming email:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/ses/email/send", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const emailData = sendEmailSchema.parse(req.body);
      
      const request: EmailSendRequest = {
        companyId,
        ...emailData,
      };
      
      const result = await sesService.queueEmail(request);
      
      if (!result.queued) {
        return res.status(400).json({ message: result.error || "Failed to queue email" });
      }
      
      res.json({
        success: true,
        messageId: result.messageId,
      });
    } catch (error: any) {
      console.error("[SES Routes] Error sending email:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid email format" });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/ses/metrics", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const days = parseInt(req.query.days as string) || 30;
      
      const metrics = await sesService.getEmailMetrics(companyId, days);
      res.json(metrics);
    } catch (error: any) {
      console.error("[SES Routes] Error getting metrics:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/ses/suppression", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const result = await sesEventsService.getSuppressionList(companyId, limit, offset);
      res.json(result);
    } catch (error: any) {
      console.error("[SES Routes] Error getting suppression list:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/ses/suppression", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      const success = await sesEventsService.addManualSuppression(companyId, email);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to add to suppression list" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SES Routes] Error adding to suppression:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete("/api/ses/suppression/:email", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const email = decodeURIComponent(req.params.email);
      
      const success = await sesEventsService.removeFromSuppression(companyId, email);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to remove from suppression list" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SES Routes] Error removing from suppression:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.delete("/api/ses/domain", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const success = await sesService.deleteDomainIdentity(companyId);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to delete domain" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[SES Routes] Error deleting domain:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Email senders management
  app.post("/api/ses/senders", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const { senders } = req.body;
      
      if (!senders || !Array.isArray(senders)) {
        return res.status(400).json({ message: "Senders array is required" });
      }
      
      // Validate senders
      for (const sender of senders) {
        if (!sender.fromEmail || !sender.fromName) {
          return res.status(400).json({ message: "Each sender must have fromEmail and fromName" });
        }
      }
      
      // Update the company email settings with senders
      const [updated] = await db
        .update(companyEmailSettings)
        .set({ 
          senders: senders,
          updatedAt: new Date()
        })
        .where(eq(companyEmailSettings.companyId, companyId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Email settings not found" });
      }
      
      res.json({ success: true, senders: updated.senders });
    } catch (error: any) {
      console.error("[SES Routes] Error saving senders:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ses/senders", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, companyId))
        .limit(1);
      
      res.json({ senders: settings?.senders || [] });
    } catch (error: any) {
      console.error("[SES Routes] Error getting senders:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/webhooks/ses-events", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      
      if (body.Type === "SubscriptionConfirmation") {
        console.log("[SES Webhook] Subscription confirmation received");
        console.log("[SES Webhook] SubscribeURL:", body.SubscribeURL);
        return res.status(200).send("OK");
      }
      
      if (body.Type === "Notification") {
        let message: SesEventPayload;
        
        try {
          message = typeof body.Message === "string" 
            ? JSON.parse(body.Message) 
            : body.Message;
        } catch (e) {
          console.error("[SES Webhook] Failed to parse message:", e);
          return res.status(400).json({ message: "Invalid message format" });
        }
        
        const result = await sesEventsService.processEvent(message);
        
        if (!result.processed) {
          console.warn("[SES Webhook] Event not processed:", result.error);
        }
        
        return res.status(200).send("OK");
      }
      
      if (body.eventType) {
        const result = await sesEventsService.processEvent(body as SesEventPayload);
        
        if (!result.processed) {
          console.warn("[SES Webhook] Event not processed:", result.error);
        }
        
        return res.status(200).send("OK");
      }
      
      console.log("[SES Webhook] Unknown message type:", body.Type || "direct");
      res.status(200).send("OK");
    } catch (error: any) {
      console.error("[SES Webhook] Error processing webhook:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  console.log("[SES] Routes registered successfully");
}
