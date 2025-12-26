import { db } from "../db";
import { eq, and, desc, asc, sql, isNull, inArray } from "drizzle-orm";
import {
  aiKbSources,
  aiKbDocuments,
  aiKbChunks,
  aiAssistantSettings,
  aiRuns,
  aiActionLogs,
  type AiKbSource,
  type InsertAiKbSource,
  type AiKbDocument,
  type InsertAiKbDocument,
  type AiKbChunk,
  type InsertAiKbChunk,
  type AiAssistantSettings,
  type InsertAiAssistantSettings,
  type AiRun,
  type InsertAiRun,
  type AiActionLog,
  type InsertAiActionLog,
} from "@shared/schema";

export class AiDeskService {
  async getAiSettings(companyId: string): Promise<AiAssistantSettings | null> {
    const [settings] = await db
      .select()
      .from(aiAssistantSettings)
      .where(eq(aiAssistantSettings.companyId, companyId))
      .limit(1);
    return settings ?? null;
  }

  async upsertAiSettings(companyId: string, data: Partial<InsertAiAssistantSettings>): Promise<AiAssistantSettings> {
    const existing = await this.getAiSettings(companyId);
    if (existing) {
      const [updated] = await db
        .update(aiAssistantSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(aiAssistantSettings.companyId, companyId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(aiAssistantSettings)
      .values({ companyId, ...data })
      .returning();
    return created;
  }

  async listKbSources(companyId: string): Promise<AiKbSource[]> {
    return db
      .select()
      .from(aiKbSources)
      .where(eq(aiKbSources.companyId, companyId))
      .orderBy(desc(aiKbSources.createdAt));
  }

  async getKbSource(companyId: string, sourceId: string): Promise<AiKbSource | null> {
    const [source] = await db
      .select()
      .from(aiKbSources)
      .where(and(
        eq(aiKbSources.id, sourceId),
        eq(aiKbSources.companyId, companyId)
      ))
      .limit(1);
    return source ?? null;
  }

  async createKbSource(data: InsertAiKbSource): Promise<AiKbSource> {
    const [source] = await db
      .insert(aiKbSources)
      .values(data)
      .returning();
    return source;
  }

  async updateKbSource(companyId: string, sourceId: string, data: Partial<InsertAiKbSource>): Promise<AiKbSource | null> {
    const [updated] = await db
      .update(aiKbSources)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(aiKbSources.id, sourceId),
        eq(aiKbSources.companyId, companyId)
      ))
      .returning();
    return updated ?? null;
  }

  async deleteKbSource(companyId: string, sourceId: string): Promise<boolean> {
    const result = await db
      .delete(aiKbSources)
      .where(and(
        eq(aiKbSources.id, sourceId),
        eq(aiKbSources.companyId, companyId)
      ));
    return true;
  }

  async updateKbSourceStatus(
    companyId: string,
    sourceId: string,
    status: string,
    error?: string
  ): Promise<void> {
    await db
      .update(aiKbSources)
      .set({
        status,
        lastError: error ?? null,
        lastSyncedAt: status === "ready" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(and(
        eq(aiKbSources.id, sourceId),
        eq(aiKbSources.companyId, companyId)
      ));
  }

  async listDocuments(companyId: string, sourceId: string): Promise<AiKbDocument[]> {
    return db
      .select()
      .from(aiKbDocuments)
      .where(and(
        eq(aiKbDocuments.companyId, companyId),
        eq(aiKbDocuments.sourceId, sourceId)
      ))
      .orderBy(desc(aiKbDocuments.createdAt));
  }

  async getDocumentByHash(companyId: string, sourceId: string, hash: string): Promise<AiKbDocument | null> {
    const [doc] = await db
      .select()
      .from(aiKbDocuments)
      .where(and(
        eq(aiKbDocuments.companyId, companyId),
        eq(aiKbDocuments.sourceId, sourceId),
        eq(aiKbDocuments.contentHash, hash)
      ))
      .limit(1);
    return doc ?? null;
  }

  async createDocument(data: InsertAiKbDocument): Promise<AiKbDocument> {
    const [doc] = await db
      .insert(aiKbDocuments)
      .values(data)
      .returning();
    return doc;
  }

  async deleteDocumentsBySource(companyId: string, sourceId: string): Promise<void> {
    await db
      .delete(aiKbDocuments)
      .where(and(
        eq(aiKbDocuments.companyId, companyId),
        eq(aiKbDocuments.sourceId, sourceId)
      ));
  }

  async listChunks(companyId: string, documentId: string): Promise<AiKbChunk[]> {
    return db
      .select()
      .from(aiKbChunks)
      .where(and(
        eq(aiKbChunks.companyId, companyId),
        eq(aiKbChunks.documentId, documentId)
      ))
      .orderBy(asc(aiKbChunks.chunkIndex));
  }

  async createChunks(chunks: InsertAiKbChunk[]): Promise<AiKbChunk[]> {
    if (chunks.length === 0) return [];
    return db.insert(aiKbChunks).values(chunks).returning();
  }

  async deleteChunksByDocument(companyId: string, documentId: string): Promise<void> {
    await db
      .delete(aiKbChunks)
      .where(and(
        eq(aiKbChunks.companyId, companyId),
        eq(aiKbChunks.documentId, documentId)
      ));
  }

  async searchChunks(
    companyId: string,
    query: string,
    limit: number = 5
  ): Promise<(AiKbChunk & { similarity?: number })[]> {
    const { aiOpenAIService } = await import("./ai-openai-service");
    try {
      const embeddingJson = await aiOpenAIService.getEmbedding(query);
      return this.searchChunksByEmbedding(companyId, embeddingJson, limit);
    } catch (error) {
      console.error("[AiDeskService] Failed to get embedding for search:", error);
      return [];
    }
  }

  async searchChunksByEmbedding(
    companyId: string,
    embeddingJson: string,
    limit: number = 5
  ): Promise<(AiKbChunk & { similarity?: number })[]> {
    const chunks = await db
      .select()
      .from(aiKbChunks)
      .where(eq(aiKbChunks.companyId, companyId))
      .limit(limit * 10);

    if (chunks.length === 0) return [];

    const queryEmbedding = JSON.parse(embeddingJson) as number[];
    
    const withSimilarity = chunks
      .filter((c) => c.embedding)
      .map((chunk) => {
        const chunkEmbedding = JSON.parse(chunk.embedding!) as number[];
        const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
        return { ...chunk, similarity };
      })
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, limit);

    return withSimilarity;
  }

  async updateSourceCounts(companyId: string, sourceId: string): Promise<void> {
    const [docCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiKbDocuments)
      .where(and(
        eq(aiKbDocuments.companyId, companyId),
        eq(aiKbDocuments.sourceId, sourceId)
      ));

    const [chunkCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiKbChunks)
      .innerJoin(aiKbDocuments, eq(aiKbChunks.documentId, aiKbDocuments.id))
      .where(and(
        eq(aiKbDocuments.companyId, companyId),
        eq(aiKbDocuments.sourceId, sourceId)
      ));

    await db
      .update(aiKbSources)
      .set({
        pagesCount: Number(docCount?.count ?? 0),
        chunksCount: Number(chunkCount?.count ?? 0),
        updatedAt: new Date(),
      })
      .where(and(
        eq(aiKbSources.id, sourceId),
        eq(aiKbSources.companyId, companyId)
      ));
  }

  async createRun(data: InsertAiRun): Promise<AiRun> {
    const [run] = await db.insert(aiRuns).values(data).returning();
    return run;
  }

  async updateRun(companyId: string, runId: string, data: Partial<InsertAiRun>): Promise<AiRun | null> {
    const [updated] = await db
      .update(aiRuns)
      .set(data)
      .where(and(
        eq(aiRuns.id, runId),
        eq(aiRuns.companyId, companyId)
      ))
      .returning();
    return updated ?? null;
  }

  async listRuns(companyId: string, options?: { conversationId?: string; limit?: number }): Promise<AiRun[]> {
    let query = db
      .select()
      .from(aiRuns)
      .where(eq(aiRuns.companyId, companyId))
      .orderBy(desc(aiRuns.createdAt))
      .limit(options?.limit ?? 50);

    if (options?.conversationId) {
      query = db
        .select()
        .from(aiRuns)
        .where(and(
          eq(aiRuns.companyId, companyId),
          eq(aiRuns.conversationId, options.conversationId)
        ))
        .orderBy(desc(aiRuns.createdAt))
        .limit(options?.limit ?? 50);
    }

    return query;
  }

  async createActionLog(data: InsertAiActionLog): Promise<AiActionLog> {
    const [log] = await db.insert(aiActionLogs).values(data).returning();
    return log;
  }

  async listActionLogs(companyId: string, runId: string): Promise<AiActionLog[]> {
    return db
      .select()
      .from(aiActionLogs)
      .where(and(
        eq(aiActionLogs.companyId, companyId),
        eq(aiActionLogs.runId, runId)
      ))
      .orderBy(asc(aiActionLogs.createdAt));
  }

  async approveAction(companyId: string, actionId: string, userId: string): Promise<AiActionLog | null> {
    const [updated] = await db
      .update(aiActionLogs)
      .set({
        approvedByUserId: userId,
        approvedAt: new Date(),
      })
      .where(and(
        eq(aiActionLogs.id, actionId),
        eq(aiActionLogs.companyId, companyId)
      ))
      .returning();
    return updated ?? null;
  }

  async getUsageStats(companyId: string, startDate: Date, endDate: Date): Promise<{
    totalRuns: number;
    copilotRuns: number;
    autopilotRuns: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
    avgLatencyMs: number;
  }> {
    const runs = await db
      .select()
      .from(aiRuns)
      .where(and(
        eq(aiRuns.companyId, companyId),
        sql`${aiRuns.createdAt} >= ${startDate}`,
        sql`${aiRuns.createdAt} <= ${endDate}`
      ));

    const copilotRuns = runs.filter((r) => r.mode === "copilot");
    const autopilotRuns = runs.filter((r) => r.mode === "autopilot");

    return {
      totalRuns: runs.length,
      copilotRuns: copilotRuns.length,
      autopilotRuns: autopilotRuns.length,
      totalTokensIn: runs.reduce((acc, r) => acc + (r.tokensIn ?? 0), 0),
      totalTokensOut: runs.reduce((acc, r) => acc + (r.tokensOut ?? 0), 0),
      totalCost: runs.reduce((acc, r) => acc + Number(r.costEstimate ?? 0), 0),
      avgLatencyMs: runs.length > 0
        ? runs.reduce((acc, r) => acc + (r.latencyMs ?? 0), 0) / runs.length
        : 0,
    };
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const aiDeskService = new AiDeskService();
