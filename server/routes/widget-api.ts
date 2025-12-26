import { Express, Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import { 
  widgetConfigs, widgetContacts, widgetConversations, 
  widgetMessages, widgetCsatResponses, users 
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

  // =====================================================
  // WIDGET ADMIN API ROUTES
  // These routes require session authentication for admin users
  // =====================================================

  async function requireAdminAuth(req: Request, res: Response): Promise<{ user: typeof users.$inferSelect } | null> {
    const userId = (req as any).session?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return null;
    }
    
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user || !user.companyId) {
      res.status(401).json({ error: "User not found or not associated with a company" });
      return null;
    }
    
    if (user.role !== "admin" && user.role !== "superadmin") {
      res.status(403).json({ error: "Admin access required" });
      return null;
    }
    
    return { user };
  }

  function generateWebsiteToken(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  function generateHmacToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  app.get("/api/widget/admin/widgets", async (req: Request, res: Response) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth) return;
      
      const widgets = await db.select()
        .from(widgetConfigs)
        .where(eq(widgetConfigs.companyId, auth.user.companyId!))
        .orderBy(desc(widgetConfigs.createdAt));
      
      res.json({ widgets });
    } catch (error) {
      console.error("Error fetching widgets:", error);
      res.status(500).json({ error: "Failed to fetch widgets" });
    }
  });

  app.post("/api/widget/admin/widgets", async (req: Request, res: Response) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth) return;
      
      const {
        name,
        websiteUrl,
        allowedDomains,
        widgetColor,
        position,
        welcomeTitle,
        welcomeTagline,
        preChatFormEnabled,
        preChatFormOptions,
        replyTime,
        featureFlags,
        hmacMandatory,
        showBranding,
        isActive,
      } = req.body;
      
      const websiteToken = generateWebsiteToken();
      const hmacToken = generateHmacToken();
      
      const [widget] = await db.insert(widgetConfigs).values({
        companyId: auth.user.companyId!,
        websiteToken,
        hmacToken,
        name: name || "Website Widget",
        websiteUrl,
        allowedDomains,
        widgetColor: widgetColor || "#2563eb",
        position: position || "right",
        welcomeTitle: welcomeTitle || "Hi there!",
        welcomeTagline: welcomeTagline || "We usually reply in a few minutes.",
        preChatFormEnabled: preChatFormEnabled ?? false,
        preChatFormOptions,
        replyTime: replyTime || "in_a_few_minutes",
        featureFlags: featureFlags ?? 7,
        hmacMandatory: hmacMandatory ?? false,
        showBranding: showBranding ?? true,
        isActive: isActive ?? true,
      }).returning();
      
      res.status(201).json({ widget });
    } catch (error) {
      console.error("Error creating widget:", error);
      res.status(500).json({ error: "Failed to create widget" });
    }
  });

  app.get("/api/widget/admin/widgets/:id", async (req: Request, res: Response) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth) return;
      
      const { id } = req.params;
      
      const [widget] = await db.select()
        .from(widgetConfigs)
        .where(
          and(
            eq(widgetConfigs.id, id),
            eq(widgetConfigs.companyId, auth.user.companyId!)
          )
        )
        .limit(1);
      
      if (!widget) {
        return res.status(404).json({ error: "Widget not found" });
      }
      
      res.json({ widget });
    } catch (error) {
      console.error("Error fetching widget:", error);
      res.status(500).json({ error: "Failed to fetch widget" });
    }
  });

  app.patch("/api/widget/admin/widgets/:id", async (req: Request, res: Response) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth) return;
      
      const { id } = req.params;
      const {
        name,
        websiteUrl,
        allowedDomains,
        widgetColor,
        position,
        welcomeTitle,
        welcomeTagline,
        preChatFormEnabled,
        preChatFormOptions,
        replyTime,
        featureFlags,
        hmacMandatory,
        showBranding,
        isActive,
      } = req.body;
      
      const [existing] = await db.select()
        .from(widgetConfigs)
        .where(
          and(
            eq(widgetConfigs.id, id),
            eq(widgetConfigs.companyId, auth.user.companyId!)
          )
        )
        .limit(1);
      
      if (!existing) {
        return res.status(404).json({ error: "Widget not found" });
      }
      
      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl;
      if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
      if (widgetColor !== undefined) updateData.widgetColor = widgetColor;
      if (position !== undefined) updateData.position = position;
      if (welcomeTitle !== undefined) updateData.welcomeTitle = welcomeTitle;
      if (welcomeTagline !== undefined) updateData.welcomeTagline = welcomeTagline;
      if (preChatFormEnabled !== undefined) updateData.preChatFormEnabled = preChatFormEnabled;
      if (preChatFormOptions !== undefined) updateData.preChatFormOptions = preChatFormOptions;
      if (replyTime !== undefined) updateData.replyTime = replyTime;
      if (featureFlags !== undefined) updateData.featureFlags = featureFlags;
      if (hmacMandatory !== undefined) updateData.hmacMandatory = hmacMandatory;
      if (showBranding !== undefined) updateData.showBranding = showBranding;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const [widget] = await db.update(widgetConfigs)
        .set(updateData)
        .where(eq(widgetConfigs.id, id))
        .returning();
      
      res.json({ widget });
    } catch (error) {
      console.error("Error updating widget:", error);
      res.status(500).json({ error: "Failed to update widget" });
    }
  });

  app.delete("/api/widget/admin/widgets/:id", async (req: Request, res: Response) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth) return;
      
      const { id } = req.params;
      
      const [existing] = await db.select()
        .from(widgetConfigs)
        .where(
          and(
            eq(widgetConfigs.id, id),
            eq(widgetConfigs.companyId, auth.user.companyId!)
          )
        )
        .limit(1);
      
      if (!existing) {
        return res.status(404).json({ error: "Widget not found" });
      }
      
      await db.delete(widgetConfigs)
        .where(eq(widgetConfigs.id, id));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting widget:", error);
      res.status(500).json({ error: "Failed to delete widget" });
    }
  });

  app.post("/api/widget/admin/widgets/:id/regenerate-hmac", async (req: Request, res: Response) => {
    try {
      const auth = await requireAdminAuth(req, res);
      if (!auth) return;
      
      const { id } = req.params;
      
      const [existing] = await db.select()
        .from(widgetConfigs)
        .where(
          and(
            eq(widgetConfigs.id, id),
            eq(widgetConfigs.companyId, auth.user.companyId!)
          )
        )
        .limit(1);
      
      if (!existing) {
        return res.status(404).json({ error: "Widget not found" });
      }
      
      const newHmacToken = generateHmacToken();
      
      const [widget] = await db.update(widgetConfigs)
        .set({ hmacToken: newHmacToken, updatedAt: new Date() })
        .where(eq(widgetConfigs.id, id))
        .returning();
      
      res.json({ widget });
    } catch (error) {
      console.error("Error regenerating HMAC token:", error);
      res.status(500).json({ error: "Failed to regenerate HMAC token" });
    }
  });
}
