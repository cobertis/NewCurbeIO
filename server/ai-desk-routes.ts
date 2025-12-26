import { Express, Request, Response } from "express";
import { z } from "zod";
import { aiDeskService } from "./services/ai-desk-service";
import { aiOpenAIService } from "./services/ai-openai-service";
import { aiIngestionService } from "./services/ai-ingestion-service";

const getCompanyId = (req: Request): string | null => {
  const user = (req as any).user;
  return user?.companyId || null;
};

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
          maxPages: z.number().min(1).max(100).optional(),
          sameDomainOnly: z.boolean().optional(),
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
          maxPages: z.number().min(1).max(100).optional(),
          sameDomainOnly: z.boolean().optional(),
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
        message: z.string().min(1),
        conversationId: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const startTime = Date.now();

      const { embedding } = await aiOpenAIService.createEmbedding(data.message);
      const chunks = await aiDeskService.searchChunksByEmbedding(
        companyId,
        JSON.stringify(embedding),
        5
      );

      const relevantChunks = chunks.map((c) => ({
        id: c.id,
        content: c.content,
        meta: c.meta as any,
      }));

      const result = await aiOpenAIService.generateDraftReply(data.message, relevantChunks);
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
        inputText: data.message,
        outputText: result.draftReply,
        citations: result.citations,
        model: "gpt-4o-mini",
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs,
        costEstimate: String(aiOpenAIService.estimateCost(result.tokensIn, result.tokensOut)),
      });

      res.json({
        runId: run.id,
        draftReply: result.draftReply,
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

      res.json({ success: true, messageId: result.messageId });
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
}
