import { db } from "../db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { 
  aiAssistantSettings, 
  aiRuns, 
  aiActionLogs,
  telnyxConversations,
  telnyxMessages 
} from "@shared/schema";
import { aiOpenAIService } from "./ai-openai-service";
import { aiToolRegistry } from "./ai-tool-registry";
import { nanoid } from "nanoid";

const DEFAULT_SYSTEM_PROMPT = `You are a helpful customer support assistant. Be professional, friendly, and concise. If you don't know something, say so and offer to connect the customer with a human agent.`;

export interface AutopilotResponse {
  shouldRespond: boolean;
  response?: string;
  actions?: Array<{
    action: string;
    result: any;
  }>;
  runId?: string;
  requiresApproval?: boolean;
}

export class AiAutopilotService {
  async processIncomingMessage(
    companyId: string,
    conversationId: string,
    messageContent: string,
    messageFrom: string
  ): Promise<AutopilotResponse> {
    console.log(`[Autopilot] Processing message for company ${companyId}, conversation ${conversationId}`);

    const { aiDeskService } = await import("./ai-desk-service");
    
    const settings = await aiDeskService.getAiSettings(companyId);
    if (!settings?.autopilotEnabled) {
      console.log(`[Autopilot] Autopilot is disabled for company ${companyId}`);
      return { shouldRespond: false };
    }

    const runId = nanoid();
    const startTime = Date.now();
    
    const [run] = await db.insert(aiRuns).values({
      id: runId,
      companyId,
      conversationId,
      mode: "autopilot",
      status: "running",
      inputText: messageContent,
      model: "gpt-4o-mini",
    }).returning();

    try {
      const recentMessages = await this.getRecentMessages(conversationId, 10);
      const kbContext = await this.getKnowledgeBaseContext(companyId, messageContent);
      const conversation = await this.getConversation(companyId, conversationId);

      const systemPrompt = this.buildSystemPrompt(kbContext, conversation);
      const messages = this.buildMessageHistory(recentMessages, messageContent);

      const response = await aiOpenAIService.chatWithTools(
        systemPrompt,
        messages,
        aiToolRegistry.getToolsForOpenAI()
      );

      const actions: Array<{ action: string; result: any }> = [];
      let finalResponse: string | undefined;

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const result = await aiToolRegistry.executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            {
              companyId,
              conversationId,
              runId,
            }
          );

          actions.push({
            action: toolCall.function.name,
            result,
          });

          if (toolCall.function.name === "send_message" && result.success) {
            finalResponse = result.data?.message;
          }
        }
      }

      if (!finalResponse && response.content) {
        finalResponse = response.content;
      }

      const latencyMs = Date.now() - startTime;

      await db
        .update(aiRuns)
        .set({
          status: "completed",
          outputText: finalResponse,
          tokensIn: response.usage?.prompt_tokens || 0,
          tokensOut: response.usage?.completion_tokens || 0,
          latencyMs,
        })
        .where(eq(aiRuns.id, runId));

      return {
        shouldRespond: true,
        response: finalResponse,
        actions,
        runId,
        requiresApproval: false,
      };
    } catch (error: any) {
      console.error(`[Autopilot] Error processing message:`, error);

      await db
        .update(aiRuns)
        .set({
          status: "failed",
        })
        .where(eq(aiRuns.id, runId));

      return { shouldRespond: false };
    }
  }

  async approveAndSendResponse(
    companyId: string,
    runId: string,
    approvedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const [run] = await db
      .select()
      .from(aiRuns)
      .where(and(eq(aiRuns.id, runId), eq(aiRuns.companyId, companyId)))
      .limit(1);

    if (!run) {
      return { success: false, error: "Run not found" };
    }

    if (!run.outputText) {
      return { success: false, error: "No response to send" };
    }

    await db.insert(aiActionLogs).values({
      companyId,
      runId,
      toolName: "message_approved",
      args: { approvedBy },
      result: { sent: true },
      success: true,
    });

    return { success: true };
  }

  async rejectResponse(
    companyId: string,
    runId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const [run] = await db
      .select()
      .from(aiRuns)
      .where(and(eq(aiRuns.id, runId), eq(aiRuns.companyId, companyId)))
      .limit(1);

    if (!run) {
      return { success: false, error: "Run not found" };
    }

    await db.insert(aiActionLogs).values({
      companyId,
      runId,
      toolName: "message_rejected",
      args: { rejectedBy, reason },
      result: { rejected: true },
      success: true,
    });

    await db
      .update(aiRuns)
      .set({ status: "failed" })
      .where(eq(aiRuns.id, runId));

    return { success: true };
  }

  async getPendingApprovals(companyId: string): Promise<any[]> {
    const { aiDeskService } = await import("./ai-desk-service");
    const settings = await aiDeskService.getAiSettings(companyId);
    if (!settings || !settings.autopilotEnabled) {
      return [];
    }

    const runs = await db
      .select()
      .from(aiRuns)
      .where(and(
        eq(aiRuns.companyId, companyId),
        eq(aiRuns.status, "completed")
      ))
      .orderBy(desc(aiRuns.createdAt))
      .limit(50);

    return runs.filter(r => r.outputText);
  }

  private async getRecentMessages(
    conversationId: string,
    limit: number
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const messages = await db
      .select()
      .from(telnyxMessages)
      .where(eq(telnyxMessages.conversationId, conversationId))
      .orderBy(desc(telnyxMessages.createdAt))
      .limit(limit);

    return messages.reverse().map((m) => ({
      role: m.direction === "inbound" ? "user" as const : "assistant" as const,
      content: m.text || "",
    }));
  }

  private async getKnowledgeBaseContext(
    companyId: string,
    query: string
  ): Promise<string> {
    try {
      const { aiDeskService } = await import("./ai-desk-service");
      const chunks = await aiDeskService.searchChunks(companyId, query, 3);
      if (chunks.length === 0) return "";

      return chunks.map((c: { content: string }) => c.content).join("\n\n---\n\n");
    } catch {
      return "";
    }
  }

  private async getConversation(companyId: string, conversationId: string) {
    const [conversation] = await db
      .select()
      .from(telnyxConversations)
      .where(and(
        eq(telnyxConversations.id, conversationId),
        eq(telnyxConversations.companyId, companyId)
      ))
      .limit(1);
    return conversation;
  }

  private buildSystemPrompt(
    kbContext: string,
    conversation: any
  ): string {
    let prompt = DEFAULT_SYSTEM_PROMPT;

    if (kbContext) {
      prompt += `\n\n## Knowledge Base Context\nUse the following information to help answer questions:\n\n${kbContext}`;
    }

    if (conversation) {
      prompt += `\n\n## Customer Information\n- Name: ${conversation.displayName || "Unknown"}\n- Channel: ${conversation.channel || "chat"}`;
    }

    prompt += `\n\n## Instructions
- Always be helpful and professional
- Use the knowledge base to answer questions when relevant
- If you cannot help, use the transfer_to_human tool
- Keep responses concise and clear
- Never make up information`;

    return prompt;
  }

  private buildMessageHistory(
    recentMessages: Array<{ role: "user" | "assistant"; content: string }>,
    currentMessage: string
  ): Array<{ role: "user" | "assistant"; content: string }> {
    const messages = [...recentMessages];

    if (!messages.find(m => m.content === currentMessage)) {
      messages.push({ role: "user", content: currentMessage });
    }

    return messages;
  }
}

export const aiAutopilotService = new AiAutopilotService();
