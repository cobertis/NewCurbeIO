import { Express, Request, Response } from "express";
import { db } from "../db";
import { 
  widgetConfigs, widgetContacts, widgetConversations, 
  widgetMessages, widgetCsatResponses 
} from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { 
  createWidgetToken, verifyWidgetToken, refreshWidgetToken, 
  identifyContact 
} from "../services/widget-token";

async function getNextDisplayId(companyId: string): Promise<number> {
  const result = await db.select({ maxId: sql<number>`COALESCE(MAX(display_id), 0)` })
    .from(widgetConversations)
    .where(eq(widgetConversations.companyId, companyId));
  return (result[0]?.maxId || 0) + 1;
}

async function authenticateWidget(req: Request): Promise<{
  valid: boolean;
  contact?: typeof widgetContacts.$inferSelect;
  config?: typeof widgetConfigs.$inferSelect;
  error?: string;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing authorization token" };
  }
  
  const token = authHeader.slice(7);
  const { valid, payload, contact } = await verifyWidgetToken(token);
  
  if (!valid || !payload || !contact) {
    return { valid: false, error: "Invalid or expired token" };
  }
  
  const [config] = await db.select()
    .from(widgetConfigs)
    .where(eq(widgetConfigs.id, payload.widgetConfigId))
    .limit(1);
  
  if (!config || !config.isActive) {
    return { valid: false, error: "Widget not found or inactive" };
  }
  
  return { valid: true, contact, config };
}

export function registerWidgetApiRoutes(app: Express): void {
  app.get("/api/widget/config/:websiteToken", async (req: Request, res: Response) => {
    try {
      const { websiteToken } = req.params;
      
      const [config] = await db.select()
        .from(widgetConfigs)
        .where(
          and(
            eq(widgetConfigs.websiteToken, websiteToken),
            eq(widgetConfigs.isActive, true)
          )
        )
        .limit(1);
      
      if (!config) {
        return res.status(404).json({ error: "Widget not found" });
      }
      
      res.json({
        id: config.id,
        websiteToken: config.websiteToken,
        name: config.name,
        widgetColor: config.widgetColor,
        position: config.position,
        welcomeTitle: config.welcomeTitle,
        welcomeTagline: config.welcomeTagline,
        preChatFormEnabled: config.preChatFormEnabled,
        preChatFormOptions: config.preChatFormOptions,
        replyTime: config.replyTime,
        featureFlags: config.featureFlags,
        hmacMandatory: config.hmacMandatory,
        businessHoursEnabled: config.businessHoursEnabled,
        businessHours: config.businessHours,
        outOfOfficeMessage: config.outOfOfficeMessage,
        csatSurveyEnabled: config.csatSurveyEnabled,
        showBranding: config.showBranding,
        customLogo: config.customLogo,
      });
    } catch (error) {
      console.error("Error fetching widget config:", error);
      res.status(500).json({ error: "Failed to fetch widget configuration" });
    }
  });

  app.post("/api/widget/session", async (req: Request, res: Response) => {
    try {
      const { websiteToken, deviceId, referrer, initialPageUrl } = req.body;
      
      if (!websiteToken) {
        return res.status(400).json({ error: "websiteToken is required" });
      }
      
      const [config] = await db.select()
        .from(widgetConfigs)
        .where(
          and(
            eq(widgetConfigs.websiteToken, websiteToken),
            eq(widgetConfigs.isActive, true)
          )
        )
        .limit(1);
      
      if (!config) {
        return res.status(404).json({ error: "Widget not found" });
      }
      
      const userAgent = req.headers["user-agent"] || "";
      const { token, sourceId, contactId } = await createWidgetToken(
        config.id,
        config.companyId,
        deviceId,
        userAgent
      );
      
      await db.update(widgetContacts)
        .set({
          additionalAttributes: {
            referer: referrer,
            initialPageUrl,
            browser_language: req.headers["accept-language"]?.split(",")[0],
          },
        })
        .where(eq(widgetContacts.id, contactId));
      
      res.json({
        token,
        sourceId,
        contactId,
        config: {
          widgetColor: config.widgetColor,
          position: config.position,
          welcomeTitle: config.welcomeTitle,
          welcomeTagline: config.welcomeTagline,
          preChatFormEnabled: config.preChatFormEnabled,
          preChatFormOptions: config.preChatFormOptions,
          replyTime: config.replyTime,
        },
      });
    } catch (error) {
      console.error("Error creating widget session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.post("/api/widget/session/refresh", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }
      
      const token = authHeader.slice(7);
      const result = await refreshWidgetToken(token);
      
      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }
      
      res.json({ token: result.newToken });
    } catch (error) {
      console.error("Error refreshing token:", error);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  app.post("/api/widget/contacts/identify", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing authorization token" });
      }
      
      const token = authHeader.slice(7);
      const { identifier, email, name, phoneNumber, avatarUrl, customAttributes, hmacSignature } = req.body;
      
      if (!identifier) {
        return res.status(400).json({ error: "identifier is required" });
      }
      
      const result = await identifyContact(
        token,
        { identifier, email, name, phoneNumber, avatarUrl, customAttributes },
        hmacSignature
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ contact: result.contact });
    } catch (error) {
      console.error("Error identifying contact:", error);
      res.status(500).json({ error: "Failed to identify contact" });
    }
  });

  app.get("/api/widget/contacts/me", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact) {
        return res.status(401).json({ error: auth.error });
      }
      res.json({ contact: auth.contact });
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ error: "Failed to fetch contact" });
    }
  });

  app.patch("/api/widget/contacts/me", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { name, email, phoneNumber, avatarUrl, customAttributes } = req.body;
      
      const [updated] = await db.update(widgetContacts)
        .set({
          ...(name && { name }),
          ...(email && { email }),
          ...(phoneNumber && { phoneNumber }),
          ...(avatarUrl && { avatarUrl }),
          ...(customAttributes && { 
            customAttributes: { ...auth.contact.customAttributes, ...customAttributes } 
          }),
          contactType: auth.contact.contactType === "visitor" ? "lead" : auth.contact.contactType,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(widgetContacts.id, auth.contact.id))
        .returning();
      
      res.json({ contact: updated });
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.get("/api/widget/conversations", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact) {
        return res.status(401).json({ error: auth.error });
      }
      
      const conversations = await db.select()
        .from(widgetConversations)
        .where(eq(widgetConversations.widgetContactId, auth.contact.id))
        .orderBy(desc(widgetConversations.lastActivityAt));
      
      res.json({ conversations });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/widget/conversations", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact || !auth.config) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { message, preChatFormData, additionalAttributes } = req.body;
      
      if (preChatFormData) {
        await db.update(widgetContacts)
          .set({
            name: preChatFormData.fullName || auth.contact.name,
            email: preChatFormData.email || auth.contact.email,
            phoneNumber: preChatFormData.phoneNumber || auth.contact.phoneNumber,
            contactType: "lead",
            updatedAt: new Date(),
          })
          .where(eq(widgetContacts.id, auth.contact.id));
      }
      
      const displayId = await getNextDisplayId(auth.config.companyId);
      
      const [conversation] = await db.insert(widgetConversations).values({
        companyId: auth.config.companyId,
        widgetConfigId: auth.config.id,
        widgetContactId: auth.contact.id,
        displayId,
        status: "open",
        waitingSince: new Date(),
        additionalAttributes: additionalAttributes || {},
      }).returning();
      
      if (message) {
        await db.insert(widgetMessages).values({
          companyId: auth.config.companyId,
          widgetConversationId: conversation.id,
          messageType: "incoming",
          senderId: auth.contact.id,
          senderType: "Contact",
          content: message,
          contentType: "text",
        });
        
        await db.update(widgetConversations)
          .set({ messagesCount: 1, unreadMessagesCount: 1, lastActivityAt: new Date() })
          .where(eq(widgetConversations.id, conversation.id));
      }
      
      res.json({ conversation });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/widget/conversations/:conversationId", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { conversationId } = req.params;
      
      const [conversation] = await db.select()
        .from(widgetConversations)
        .where(
          and(
            eq(widgetConversations.id, conversationId),
            eq(widgetConversations.widgetContactId, auth.contact.id)
          )
        )
        .limit(1);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      res.json({ conversation });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/widget/conversations/:conversationId/messages", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { conversationId } = req.params;
      const { limit = "50" } = req.query;
      
      const [conversation] = await db.select()
        .from(widgetConversations)
        .where(
          and(
            eq(widgetConversations.id, conversationId),
            eq(widgetConversations.widgetContactId, auth.contact.id)
          )
        )
        .limit(1);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const messages = await db.select()
        .from(widgetMessages)
        .where(
          and(
            eq(widgetMessages.widgetConversationId, conversationId),
            eq(widgetMessages.private, false)
          )
        )
        .orderBy(asc(widgetMessages.createdAt))
        .limit(parseInt(limit as string, 10));
      
      await db.update(widgetConversations)
        .set({ contactLastSeenAt: new Date() })
        .where(eq(widgetConversations.id, conversationId));
      
      res.json({ messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/widget/conversations/:conversationId/messages", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact || !auth.config) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { conversationId } = req.params;
      const { content, contentType = "text", attachments, echoId } = req.body;
      
      const [conversation] = await db.select()
        .from(widgetConversations)
        .where(
          and(
            eq(widgetConversations.id, conversationId),
            eq(widgetConversations.widgetContactId, auth.contact.id)
          )
        )
        .limit(1);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.status === "resolved") {
        await db.update(widgetConversations)
          .set({ status: "open" })
          .where(eq(widgetConversations.id, conversationId));
      }
      
      const [message] = await db.insert(widgetMessages).values({
        companyId: auth.config.companyId,
        widgetConversationId: conversationId,
        messageType: "incoming",
        senderId: auth.contact.id,
        senderType: "Contact",
        content,
        contentType,
        attachments: attachments || [],
        externalSourceId: echoId,
      }).returning();
      
      await db.update(widgetConversations)
        .set({
          messagesCount: sql`${widgetConversations.messagesCount} + 1`,
          unreadMessagesCount: sql`${widgetConversations.unreadMessagesCount} + 1`,
          waitingSince: new Date(),
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(widgetConversations.id, conversationId));
      
      await db.update(widgetContacts)
        .set({ lastActivityAt: new Date() })
        .where(eq(widgetContacts.id, auth.contact.id));
      
      res.json({ message, echoId });
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.post("/api/widget/conversations/:conversationId/resolve", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact || !auth.config) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { conversationId } = req.params;
      
      if (!(auth.config.featureFlags! & 4)) {
        return res.status(403).json({ error: "End conversation feature is disabled" });
      }
      
      const [conversation] = await db.update(widgetConversations)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(
          and(
            eq(widgetConversations.id, conversationId),
            eq(widgetConversations.widgetContactId, auth.contact.id)
          )
        )
        .returning();
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      res.json({ conversation });
    } catch (error) {
      console.error("Error resolving conversation:", error);
      res.status(500).json({ error: "Failed to resolve conversation" });
    }
  });

  app.post("/api/widget/conversations/:conversationId/csat", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact || !auth.config) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { conversationId } = req.params;
      const { rating, feedbackMessage } = req.body;
      
      if (!auth.config.csatSurveyEnabled) {
        return res.status(403).json({ error: "CSAT surveys are disabled" });
      }
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      const [conversation] = await db.select()
        .from(widgetConversations)
        .where(
          and(
            eq(widgetConversations.id, conversationId),
            eq(widgetConversations.widgetContactId, auth.contact.id)
          )
        )
        .limit(1);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const existing = await db.select()
        .from(widgetCsatResponses)
        .where(eq(widgetCsatResponses.widgetConversationId, conversationId))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(400).json({ error: "CSAT already submitted" });
      }
      
      const [csat] = await db.insert(widgetCsatResponses).values({
        companyId: auth.config.companyId,
        widgetConversationId: conversationId,
        widgetContactId: auth.contact.id,
        assigneeId: conversation.assigneeId,
        rating,
        feedbackMessage,
      }).returning();
      
      res.json({ csat });
    } catch (error) {
      console.error("Error submitting CSAT:", error);
      res.status(500).json({ error: "Failed to submit CSAT" });
    }
  });

  app.post("/api/widget/conversations/:conversationId/typing", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact) {
        return res.status(401).json({ error: auth.error });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating typing status:", error);
      res.status(500).json({ error: "Failed to update typing status" });
    }
  });

  app.post("/api/widget/conversations/:conversationId/read", async (req: Request, res: Response) => {
    try {
      const auth = await authenticateWidget(req);
      if (!auth.valid || !auth.contact) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { conversationId } = req.params;
      
      await db.update(widgetConversations)
        .set({ contactLastSeenAt: new Date() })
        .where(
          and(
            eq(widgetConversations.id, conversationId),
            eq(widgetConversations.widgetContactId, auth.contact.id)
          )
        );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking as read:", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  });
}
