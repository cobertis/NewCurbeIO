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

export function registerSesRoutes(app: Express, requireActiveCompany: any) {
  app.get("/api/ses/settings", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).companyId;
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
          dkimStatus: settings.dkimStatus,
          domainVerificationStatus: settings.domainVerificationStatus,
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
      const status = await sesService.getIdentityStatus(companyId);
      res.json(status);
    } catch (error: any) {
      console.error("[SES Routes] Error getting domain status:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/ses/domain/dns-records", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).companyId;
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
      
      const dkimTokens = (settings.dkimTokens as string[]) || [];
      for (const token of dkimTokens) {
        dnsRecords.push({
          type: "CNAME",
          name: `${token}._domainkey.${settings.sendingDomain}`,
          value: `${token}.dkim.amazonses.com`,
          purpose: "DKIM",
          status: settings.dkimStatus ?? undefined,
        });
      }
      
      if (settings.spfRecord) {
        dnsRecords.push({
          type: "TXT",
          name: settings.sendingDomain,
          value: settings.spfRecord,
          purpose: "SPF",
        });
      }
      
      if (settings.dmarcRecord) {
        dnsRecords.push({
          type: "TXT",
          name: `_dmarc.${settings.sendingDomain}`,
          value: settings.dmarcRecord,
          purpose: "DMARC",
        });
      }
      
      if (settings.mailFromDomain && settings.mailFromMxRecord) {
        dnsRecords.push({
          type: "MX",
          name: settings.mailFromDomain,
          value: `10 ${settings.mailFromMxRecord}`,
          purpose: "MAIL_FROM",
          status: settings.mailFromStatus ?? undefined,
        });
        
        dnsRecords.push({
          type: "TXT",
          name: settings.mailFromDomain,
          value: "v=spf1 include:amazonses.com ~all",
          purpose: "MAIL_FROM_SPF",
        });
      }
      
      res.json({ dnsRecords });
    } catch (error: any) {
      console.error("[SES Routes] Error getting DNS records:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/ses/domain/verify", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
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
      const companyId = (req as any).companyId;
      
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
