import { db } from "../db";
import { 
  sesEmailMessages, 
  sesEmailEvents, 
  companyEmailSuppression,
  companyEmailSettings,
  type InsertSesEmailEvent,
} from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";

export interface SesEventPayload {
  eventType: string;
  mail: {
    messageId: string;
    timestamp: string;
    source: string;
    destination: string[];
    tags?: Record<string, string[]>;
  };
  bounce?: {
    bounceType: string;
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action?: string;
      status?: string;
      diagnosticCode?: string;
    }>;
    timestamp: string;
  };
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
    complaintFeedbackType?: string;
    timestamp: string;
  };
  delivery?: {
    timestamp: string;
    recipients: string[];
    processingTimeMillis?: number;
  };
  open?: {
    timestamp: string;
    userAgent?: string;
    ipAddress?: string;
  };
  click?: {
    timestamp: string;
    link?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  reject?: {
    reason: string;
  };
}

class SesEventsService {
  async processEvent(payload: SesEventPayload): Promise<{ processed: boolean; error?: string }> {
    try {
      const eventType = payload.eventType?.toLowerCase();
      const providerMessageId = payload.mail?.messageId;
      
      if (!eventType || !providerMessageId) {
        return { processed: false, error: "Missing event type or message ID" };
      }
      
      const [existingEvent] = await db
        .select()
        .from(sesEmailEvents)
        .where(
          and(
            eq(sesEmailEvents.providerMessageId, providerMessageId),
            eq(sesEmailEvents.eventType, eventType as any)
          )
        )
        .limit(1);
      
      if (existingEvent) {
        console.log(`[SES Events] Event already processed: ${eventType} for ${providerMessageId}`);
        return { processed: true };
      }
      
      const [message] = await db
        .select()
        .from(sesEmailMessages)
        .where(eq(sesEmailMessages.providerMessageId, providerMessageId))
        .limit(1);
      
      if (!message) {
        console.log(`[SES Events] Message not found for provider ID: ${providerMessageId}`);
        return { processed: false, error: "Message not found" };
      }
      
      const eventTimestamp = this.getEventTimestamp(payload, eventType);
      
      const eventData: InsertSesEmailEvent = {
        messageId: message.id,
        companyId: message.companyId,
        providerMessageId,
        eventType: eventType as any,
        eventTimestamp,
        rawPayload: payload as any,
      };
      
      if (eventType === "bounce" && payload.bounce) {
        eventData.bounceType = payload.bounce.bounceType;
        eventData.bounceSubType = payload.bounce.bounceSubType;
        if (payload.bounce.bouncedRecipients?.[0]?.diagnosticCode) {
          eventData.diagnosticCode = payload.bounce.bouncedRecipients[0].diagnosticCode;
        }
      }
      
      if (eventType === "complaint" && payload.complaint) {
        eventData.complaintFeedbackType = payload.complaint.complaintFeedbackType;
      }
      
      const [event] = await db.insert(sesEmailEvents)
        .values(eventData)
        .onConflictDoNothing()
        .returning();
      
      if (!event) {
        console.log(`[SES Events] Event already exists (race condition): ${eventType} for ${providerMessageId}`);
        return { processed: true };
      }
      
      await this.updateMessageStatus(message.id, message.companyId, eventType, payload, event.id);
      
      await this.handleSuppressionAndMetrics(message.companyId, eventType, payload, message.id, event.id);
      
      await db.update(sesEmailEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(sesEmailEvents.id, event.id));
      
      console.log(`[SES Events] Processed ${eventType} event for message ${message.id}`);
      return { processed: true };
    } catch (error: any) {
      console.error("[SES Events] Error processing event:", error);
      return { processed: false, error: error.message };
    }
  }
  
  private getEventTimestamp(payload: SesEventPayload, eventType: string): Date {
    switch (eventType) {
      case "bounce":
        return new Date(payload.bounce?.timestamp || payload.mail.timestamp);
      case "complaint":
        return new Date(payload.complaint?.timestamp || payload.mail.timestamp);
      case "delivery":
        return new Date(payload.delivery?.timestamp || payload.mail.timestamp);
      case "open":
        return new Date(payload.open?.timestamp || payload.mail.timestamp);
      case "click":
        return new Date(payload.click?.timestamp || payload.mail.timestamp);
      default:
        return new Date(payload.mail.timestamp);
    }
  }
  
  private async updateMessageStatus(
    messageId: string, 
    companyId: string,
    eventType: string, 
    payload: SesEventPayload,
    eventId: string
  ): Promise<void> {
    const updates: Record<string, any> = {};
    
    switch (eventType) {
      case "send":
        updates.status = "sent";
        updates.sentAt = new Date(payload.mail.timestamp);
        break;
        
      case "delivery":
        updates.status = "delivered";
        updates.deliveredAt = new Date(payload.delivery?.timestamp || payload.mail.timestamp);
        
        await db.update(companyEmailSettings)
          .set({ totalDelivered: sql`${companyEmailSettings.totalDelivered} + 1` })
          .where(eq(companyEmailSettings.companyId, companyId));
        break;
        
      case "bounce":
        updates.status = "bounced";
        updates.bouncedAt = new Date(payload.bounce?.timestamp || payload.mail.timestamp);
        updates.errorCode = payload.bounce?.bounceType;
        updates.errorMessage = payload.bounce?.bounceSubType;
        break;
        
      case "complaint":
        updates.status = "complained";
        updates.complainedAt = new Date(payload.complaint?.timestamp || payload.mail.timestamp);
        break;
        
      case "reject":
        updates.status = "rejected";
        updates.errorMessage = payload.reject?.reason;
        break;
        
      case "open":
        updates.openCount = sql`${sesEmailMessages.openCount} + 1`;
        if (!updates.firstOpenedAt) {
          updates.firstOpenedAt = new Date(payload.open?.timestamp || payload.mail.timestamp);
        }
        break;
        
      case "click":
        updates.clickCount = sql`${sesEmailMessages.clickCount} + 1`;
        if (!updates.firstClickedAt) {
          updates.firstClickedAt = new Date(payload.click?.timestamp || payload.mail.timestamp);
        }
        break;
    }
    
    if (Object.keys(updates).length > 0) {
      await db.update(sesEmailMessages)
        .set(updates)
        .where(eq(sesEmailMessages.id, messageId));
    }
  }
  
  private async handleSuppressionAndMetrics(
    companyId: string,
    eventType: string,
    payload: SesEventPayload,
    messageId: string,
    eventId: string
  ): Promise<void> {
    if (eventType === "bounce" && payload.bounce) {
      const isPermanent = payload.bounce.bounceType === "Permanent";
      
      if (isPermanent) {
        await db.update(companyEmailSettings)
          .set({ totalBounced: sql`${companyEmailSettings.totalBounced} + 1` })
          .where(eq(companyEmailSettings.companyId, companyId));
        
        for (const recipient of payload.bounce.bouncedRecipients || []) {
          await this.addToSuppression(
            companyId,
            recipient.emailAddress,
            "hard_bounce",
            messageId,
            eventId,
            payload.bounce.bounceType,
            recipient.diagnosticCode
          );
        }
        
        await this.checkAndAutoPause(companyId);
      }
    }
    
    if (eventType === "complaint" && payload.complaint) {
      await db.update(companyEmailSettings)
        .set({ totalComplaints: sql`${companyEmailSettings.totalComplaints} + 1` })
        .where(eq(companyEmailSettings.companyId, companyId));
      
      for (const recipient of payload.complaint.complainedRecipients || []) {
        await this.addToSuppression(
          companyId,
          recipient.emailAddress,
          "complaint",
          messageId,
          eventId
        );
      }
      
      await this.checkAndAutoPause(companyId);
    }
  }
  
  private async addToSuppression(
    companyId: string,
    email: string,
    reason: "hard_bounce" | "complaint" | "manual" | "unsubscribe",
    sourceMessageId?: string,
    sourceEventId?: string,
    bounceType?: string,
    diagnosticCode?: string
  ): Promise<void> {
    try {
      await db.insert(companyEmailSuppression).values({
        companyId,
        email: email.toLowerCase(),
        reason,
        sourceMessageId,
        sourceEventId,
        bounceType,
        diagnosticCode,
      }).onConflictDoNothing();
      
      console.log(`[SES Suppression] Added ${email} to suppression list for company ${companyId}: ${reason}`);
    } catch (error) {
      console.error("[SES Suppression] Error adding to suppression:", error);
    }
  }
  
  private async checkAndAutoPause(companyId: string): Promise<void> {
    try {
      const [settings] = await db
        .select()
        .from(companyEmailSettings)
        .where(eq(companyEmailSettings.companyId, companyId))
        .limit(1);
      
      if (!settings || !settings.autoPauseEnabled || settings.emailStatus === "paused") {
        return;
      }
      
      const totalSent = settings.totalSent || 0;
      if (totalSent < 100) {
        return;
      }
      
      const totalBounced = settings.totalBounced || 0;
      const totalComplaints = settings.totalComplaints || 0;
      
      const bounceRate = totalBounced / totalSent;
      const complaintRate = totalComplaints / totalSent;
      
      const bounceThreshold = parseFloat(settings.bounceRateThreshold?.toString() || "0.05");
      const complaintThreshold = parseFloat(settings.complaintRateThreshold?.toString() || "0.001");
      
      let pauseReason: string | null = null;
      
      if (bounceRate >= bounceThreshold) {
        pauseReason = `Bounce rate (${(bounceRate * 100).toFixed(2)}%) exceeded threshold (${(bounceThreshold * 100).toFixed(2)}%)`;
      } else if (complaintRate >= complaintThreshold) {
        pauseReason = `Complaint rate (${(complaintRate * 100).toFixed(3)}%) exceeded threshold (${(complaintThreshold * 100).toFixed(3)}%)`;
      }
      
      if (pauseReason) {
        await db.update(companyEmailSettings)
          .set({
            emailStatus: "paused",
            pausedAt: new Date(),
            pauseReason,
            bounceRate: bounceRate.toString(),
            complaintRate: complaintRate.toString(),
            updatedAt: new Date(),
          })
          .where(eq(companyEmailSettings.companyId, companyId));
        
        console.warn(`[SES Auto-Pause] Paused email for company ${companyId}: ${pauseReason}`);
      } else {
        await db.update(companyEmailSettings)
          .set({
            bounceRate: bounceRate.toString(),
            complaintRate: complaintRate.toString(),
            lastMetricsUpdateAt: new Date(),
          })
          .where(eq(companyEmailSettings.companyId, companyId));
      }
    } catch (error) {
      console.error("[SES Auto-Pause] Error checking auto-pause:", error);
    }
  }
  
  async getSuppressionList(companyId: string, limit: number = 100, offset: number = 0): Promise<{
    items: Array<{
      email: string;
      reason: string;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const items = await db
      .select({
        email: companyEmailSuppression.email,
        reason: companyEmailSuppression.reason,
        createdAt: companyEmailSuppression.createdAt,
      })
      .from(companyEmailSuppression)
      .where(eq(companyEmailSuppression.companyId, companyId))
      .orderBy(companyEmailSuppression.createdAt)
      .limit(limit)
      .offset(offset);
    
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companyEmailSuppression)
      .where(eq(companyEmailSuppression.companyId, companyId));
    
    return {
      items: items as any,
      total: countResult?.count || 0,
    };
  }
  
  async removeFromSuppression(companyId: string, email: string): Promise<boolean> {
    try {
      await db.delete(companyEmailSuppression)
        .where(
          and(
            eq(companyEmailSuppression.companyId, companyId),
            eq(companyEmailSuppression.email, email.toLowerCase())
          )
        );
      return true;
    } catch (error) {
      console.error("[SES Suppression] Error removing from suppression:", error);
      return false;
    }
  }
  
  async addManualSuppression(companyId: string, email: string): Promise<boolean> {
    try {
      await this.addToSuppression(companyId, email, "manual");
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const sesEventsService = new SesEventsService();
