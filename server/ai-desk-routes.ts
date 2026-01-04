import { Express, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { aiDeskService } from "./services/ai-desk-service";
import { aiOpenAIService } from "./services/ai-openai-service";
import { aiIngestionService } from "./services/ai-ingestion-service";

const getCompanyId = (req: Request): string | null => {
  const user = (req as any).user;
  return user?.companyId || null;
};

const uploadsDir = path.join(process.cwd(), "uploads", "kb-files");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const kbFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `kb-${uniqueSuffix}${ext}`);
  },
});

const kbFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
  ];
  const allowedExtensions = [".pdf", ".docx", ".txt", ".md"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOCX, TXT, and MD files are allowed"));
  }
};

const kbUpload = multer({
  storage: kbFileStorage,
  fileFilter: kbFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

export function registerAiDeskRoutes(app: Express, requireAuth: any, requireActiveCompany: any) {
  
  app.get("/api/ai/settings", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      let settings = await aiDeskService.getAiSettings(companyId);
      if (!settings) {
        settings = await aiDeskService.upsertAiSettings(companyId, {});
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ai/settings", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        copilotEnabled: z.boolean().optional(),
        autopilotEnabled: z.boolean().optional(),
        autopilotLevel: z.number().int().min(1).max(3).optional(),
        confidenceThreshold: z.number().min(0).max(1).optional(),
        allowedTools: z.array(z.string()).optional(),
        escalationRules: z.record(z.string()).optional(),
      });

      const data = schema.parse(req.body);
      const settings = await aiDeskService.upsertAiSettings(companyId, data as any);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/ai/kb/sources", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const sources = await aiDeskService.listKbSources(companyId);
      res.json(sources);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/kb/sources", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        type: z.enum(["url", "file"]),
        name: z.string().min(1),
        url: z.string().url().optional(),
        config: z.object({
          maxPages: z.number().min(1).max(200).optional(),
          sameDomainOnly: z.boolean().optional(),
          excludeLegal: z.boolean().optional(),
        }).optional(),
      });

      const data = schema.parse(req.body);
      const source = await aiDeskService.createKbSource({
        companyId,
        type: data.type,
        name: data.name,
        url: data.url,
        config: data.config || {},
        status: "idle",
        pagesCount: 0,
        chunksCount: 0,
      });
      res.status(201).json(source);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/ai/kb/sources/:sourceId", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const source = await aiDeskService.getKbSource(companyId, req.params.sourceId);
      if (!source) return res.status(404).json({ error: "Source not found" });
      res.json(source);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/ai/kb/sources/:sourceId", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        name: z.string().min(1).optional(),
        url: z.string().url().optional(),
        config: z.object({
          maxPages: z.number().min(1).max(200).optional(),
          sameDomainOnly: z.boolean().optional(),
          excludeLegal: z.boolean().optional(),
        }).optional(),
      });

      const data = schema.parse(req.body);
      const source = await aiDeskService.updateKbSource(companyId, req.params.sourceId, data);
      if (!source) return res.status(404).json({ error: "Source not found" });
      res.json(source);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/ai/kb/sources/:sourceId", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      await aiDeskService.deleteKbSource(companyId, req.params.sourceId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create URL source with config options
  app.post("/api/ai/kb/sources/url", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        name: z.string().min(1),
        url: z.string().url(),
        maxPages: z.number().min(1).max(200).optional(),
        sameDomainOnly: z.boolean().optional(),
        excludeLegal: z.boolean().optional(),
        includePaths: z.array(z.string()).optional(),
        excludePaths: z.array(z.string()).optional(),
      });

      const data = schema.parse(req.body);
      const source = await aiDeskService.createKbSource({
        companyId,
        type: "url",
        name: data.name,
        url: data.url,
        config: {
          maxPages: data.maxPages ?? 25,
          sameDomainOnly: data.sameDomainOnly ?? true,
          excludeLegal: data.excludeLegal ?? true,
          includePaths: data.includePaths ?? [],
          excludePaths: data.excludePaths ?? [],
        },
        status: "idle",
        pagesCount: 0,
        chunksCount: 0,
      });
      res.status(201).json({ source });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Create File source (multipart upload)
  app.post("/api/ai/kb/sources/file", requireAuth, requireActiveCompany, kbUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const name = req.body.name || file.originalname;
      const storageKey = path.join("uploads", "kb-files", file.filename);

      // Create file record
      const fileRecord = await aiDeskService.createFile({
        companyId,
        storageKey,
        mimeType: file.mimetype,
        originalName: file.originalname,
        size: file.size,
      });

      // Create source record linked to file
      const source = await aiDeskService.createKbSource({
        companyId,
        type: "file",
        name,
        fileId: fileRecord.id,
        config: {},
        status: "idle",
        pagesCount: 0,
        chunksCount: 0,
      });

      res.status(201).json({ source, file: fileRecord });

      // Start background ingestion
      aiIngestionService.syncSource(companyId, source.id).catch((err) => {
        console.error("[AI-Desk] File ingestion error:", err);
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/ai/kb/sources/:sourceId/sync", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const source = await aiDeskService.getKbSource(companyId, req.params.sourceId);
      if (!source) return res.status(404).json({ error: "Source not found" });

      res.json({ message: "Sync started", status: "syncing" });

      aiIngestionService.syncSource(companyId, req.params.sourceId).catch((err) => {
        console.error("[AI-Desk] Sync error:", err);
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/kb/sources/:sourceId/purge-legal", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const source = await aiDeskService.getKbSource(companyId, req.params.sourceId);
      if (!source) return res.status(404).json({ error: "Source not found" });

      const result = await aiDeskService.purgeLegalPages(companyId, req.params.sourceId);
      console.log(`[AI-Desk] Purged legal pages from source ${req.params.sourceId}: ${result.documentsDeleted} docs, ${result.chunksDeleted} chunks`);
      
      res.json({ 
        message: "Legal pages purged", 
        documentsDeleted: result.documentsDeleted,
        chunksDeleted: result.chunksDeleted 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/kb/sources/:sourceId/documents", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const documents = await aiDeskService.listDocuments(companyId, req.params.sourceId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get chunks for a source (with content preview)
  app.get("/api/ai/kb/sources/:sourceId/chunks", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const chunks = await aiDeskService.listChunksBySource(companyId, req.params.sourceId);
      res.json(chunks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/kb/query", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).optional(),
      });

      const data = schema.parse(req.body);
      
      const { embedding } = await aiOpenAIService.createEmbedding(data.query);
      const chunks = await aiDeskService.searchChunksByEmbedding(
        companyId,
        JSON.stringify(embedding),
        data.limit ?? 5
      );

      res.json({
        query: data.query,
        results: chunks.map((c) => ({
          id: c.id,
          content: c.content,
          similarity: c.similarity,
          documentId: c.documentId,
          meta: c.meta,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/copilot/draft", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        message: z.string().min(1).optional(),
        conversationId: z.string().optional(),
        lastMessages: z.array(z.object({
          direction: z.string(),
          text: z.string(),
          createdAt: z.string().optional(),
        })).optional(),
        question: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const startTime = Date.now();

      let messageToProcess = data.message || "";
      if (data.lastMessages && data.lastMessages.length > 0) {
        const conversationContext = data.lastMessages.map(m => 
          `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.text}`
        ).join('\n');
        messageToProcess = data.question 
          ? `Conversation:\n${conversationContext}\n\nQuestion: ${data.question}`
          : `Based on this conversation, suggest a helpful reply:\n${conversationContext}`;
      }

      if (!messageToProcess) {
        return res.status(400).json({ error: "Either message or lastMessages is required" });
      }

      const { embedding } = await aiOpenAIService.createEmbedding(messageToProcess);
      const chunks = await aiDeskService.searchChunksByEmbedding(
        companyId,
        JSON.stringify(embedding),
        5
      );

      console.log(`[Pulse AI Copilot] Company: ${companyId} | Found ${chunks.length} KB chunks | Top similarities:`, 
        chunks.slice(0, 3).map(c => ({ id: c.id.slice(0, 8), similarity: c.similarity?.toFixed(3) }))
      );

      const relevantChunks = chunks.map((c) => ({
        id: c.id,
        content: c.content,
        meta: c.meta as any,
      }));

      const result = await aiOpenAIService.generateDraftReply(messageToProcess, relevantChunks);
      const latencyMs = Date.now() - startTime;

      const run = await aiDeskService.createRun({
        companyId,
        conversationId: data.conversationId,
        mode: "copilot",
        status: "completed",
        intent: result.intent,
        confidence: String(result.confidence),
        needsHuman: result.needsHuman,
        missingFields: result.missingFields,
        inputText: messageToProcess,
        outputText: result.draftReply,
        citations: result.citations,
        model: "gpt-4o-mini",
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs,
        costEstimate: String(aiOpenAIService.estimateCost(result.tokensIn, result.tokensOut)),
        aiReplyOriginal: result.draftReply,
      });

      res.json({
        success: true,
        runId: run.id,
        draft: result.draftReply,
        draftReply: result.draftReply,
        source: "knowledge_base",
        intent: result.intent,
        confidence: result.confidence,
        needsHuman: result.needsHuman,
        missingFields: result.missingFields,
        citations: result.citations,
        latencyMs,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/runs", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const conversationId = req.query.conversationId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      const runs = await aiDeskService.listRuns(companyId, { conversationId, limit });
      res.json(runs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/runs/:runId/feedback", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        finalReply: z.string(),
      });

      const { finalReply } = schema.parse(req.body);
      const run = await aiDeskService.recordReplyFeedback(companyId, req.params.runId, finalReply);
      
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }

      res.json({ success: true, run });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/runs/:runId/actions", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const actions = await aiDeskService.listActionLogs(companyId, req.params.runId);
      res.json(actions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/usage", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const startDate = new Date(req.query.startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      const endDate = new Date(req.query.endDate as string || new Date());

      const stats = await aiDeskService.getUsageStats(companyId, startDate, endDate);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/metrics", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const days = parseInt(req.query.days as string) || 30;
      const metrics = await aiDeskService.getAiMetrics(companyId, days);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/autopilot/pending", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const { aiAutopilotService } = await import("./services/ai-autopilot-service");
      const pending = await aiAutopilotService.getPendingApprovals(companyId);
      res.json({ pending });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/autopilot/approve/:runId", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const userId = req.user?.id;
      if (!companyId || !userId) return res.status(400).json({ error: "No company or user" });

      const { aiAutopilotService } = await import("./services/ai-autopilot-service");
      const result = await aiAutopilotService.approveAndSendResponse(companyId, req.params.runId, userId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        success: true, 
        messageId: result.messageId,
        executedTools: result.executedTools,
        alreadyProcessed: result.alreadyProcessed 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/autopilot/reject/:runId", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      const userId = req.user?.id;
      if (!companyId || !userId) return res.status(400).json({ error: "No company or user" });

      const { reason } = req.body;
      const { aiAutopilotService } = await import("./services/ai-autopilot-service");
      const result = await aiAutopilotService.rejectResponse(companyId, req.params.runId, userId, reason);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // Pulse AI Chat Messages (per conversation persistence)
  // =====================================================

  app.get("/api/ai/conversations/:conversationId/chat-messages", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const { conversationId } = req.params;
      const messages = await aiDeskService.getPulseAiChatMessages(companyId, conversationId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/conversations/:conversationId/chat-messages", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const { conversationId } = req.params;
      const schema = z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      });

      const data = schema.parse(req.body);
      const message = await aiDeskService.createPulseAiChatMessage({
        companyId,
        conversationId,
        role: data.role,
        content: data.content,
      });
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/ai/conversations/:conversationId/chat-messages", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const { conversationId } = req.params;
      await aiDeskService.clearPulseAiChatMessages(companyId, conversationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // Thread Summary - Generate AI summary and suggestions
  // =====================================================

  app.post("/api/ai/thread-summary", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(400).json({ error: "No company" });

      const schema = z.object({
        conversationId: z.string().min(1),
      });

      const { conversationId } = schema.parse(req.body);

      const { db } = await import("./db");
      const { eq, asc } = await import("drizzle-orm");
      const { telnyxMessages, telnyxConversations, imessageConversations, imessageMessages } = await import("@shared/schema");

      // First try Telnyx/SMS conversation
      let messagesResult: Array<{ text: string | null; direction?: string; fromMe?: boolean; isInternalNote?: boolean | null }> = [];
      
      const [conversation] = await db
        .select()
        .from(telnyxConversations)
        .where(eq(telnyxConversations.id, conversationId))
        .limit(1);

      if (conversation && conversation.companyId === companyId) {
        messagesResult = await db
          .select()
          .from(telnyxMessages)
          .where(eq(telnyxMessages.conversationId, conversationId))
          .orderBy(asc(telnyxMessages.createdAt));
      } else {
        // Try iMessage conversation
        const [imessageConv] = await db
          .select()
          .from(imessageConversations)
          .where(eq(imessageConversations.id, conversationId))
          .limit(1);

        if (imessageConv && imessageConv.companyId === companyId) {
          const imessageResult = await db
            .select()
            .from(imessageMessages)
            .where(eq(imessageMessages.conversationId, conversationId))
            .orderBy(asc(imessageMessages.dateSent));
          
          messagesResult = imessageResult.map(m => ({
            text: m.text,
            direction: m.fromMe ? "outbound" : "inbound",
            fromMe: m.fromMe,
            isInternalNote: false,
          }));
        } else {
          return res.status(404).json({ error: "Conversation not found" });
        }
      }

      if (messagesResult.length === 0) {
        return res.json({
          summary: "No messages in this conversation yet.",
          suggestions: [],
        });
      }

      const messageHistory = messagesResult
        .filter((m) => !m.isInternalNote && m.text)
        .map((m) => {
          const role = m.direction === "inbound" || m.fromMe === false ? "Customer" : "Agent";
          return `${role}: ${m.text}`;
        })
        .join("\n");

      const systemPrompt = `You are an AI assistant helping customer service agents understand conversations and craft responses.

Analyze the following conversation and provide:
1. A concise summary (2-3 sentences) of the key points discussed
2. Three response suggestions for the agent to use:
   - Offer: A proactive offer to help or provide additional value
   - Encourage: A supportive/positive response to keep the customer engaged  
   - Suggest: A specific next step or recommendation

Respond in valid JSON format:
{
  "summary": "Brief summary of the conversation...",
  "suggestions": [
    { "type": "offer", "text": "Response text..." },
    { "type": "encourage", "text": "Response text..." },
    { "type": "suggest", "text": "Response text..." }
  ]
}

Keep each suggestion under 150 characters. Be professional and helpful.`;

      const result = await aiOpenAIService.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Conversation:\n${messageHistory}` },
        ],
        { temperature: 0.3, maxTokens: 800 }
      );

      let parsed: { summary: string; suggestions: Array<{ type: string; text: string }> };
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");
        parsed = JSON.parse(jsonMatch[0]);
        
        if (!parsed.summary || !Array.isArray(parsed.suggestions)) {
          throw new Error("Invalid response structure");
        }
      } catch (e) {
        parsed = {
          summary: "Unable to generate summary. Please try again.",
          suggestions: [
            { type: "offer", text: "How can I help you further today?" },
            { type: "encourage", text: "Thank you for reaching out to us!" },
            { type: "suggest", text: "Would you like me to provide more information?" },
          ],
        };
      }

      res.json(parsed);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
