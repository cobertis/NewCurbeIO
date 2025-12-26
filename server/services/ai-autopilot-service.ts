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
      const conversation = await this.getConversation(companyId, conversationId);
      if (!conversation) {
        console.log(`[Autopilot] Conversation ${conversationId} not found for company ${companyId}`);
        await db.update(aiRuns).set({ status: "failed" }).where(eq(aiRuns.id, runId));
        return { shouldRespond: false };
      }
      
      const recentMessages = await this.getRecentMessages(companyId, conversationId, 10);
      const kbContext = await this.getKnowledgeBaseContext(companyId, messageContent);

      const systemPrompt = this.buildSystemPrompt(kbContext, conversation);
      const messages = this.buildMessageHistory(recentMessages, messageContent);

      const response = await aiOpenAIService.chatWithTools(
        systemPrompt,
        messages,
        aiToolRegistry.getToolsForOpenAI()
      );

      const actions: Array<{ action: string; result: any }> = [];
      let finalResponse: string | undefined;
      let needsHuman = false;

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
          
          if (toolCall.function.name === "transfer_to_human") {
            needsHuman = true;
          }
        }
      }

      if (!finalResponse && response.content) {
        finalResponse = response.content;
      }

      const latencyMs = Date.now() - startTime;
      
      const confidenceThreshold = settings.confidenceThreshold 
        ? parseFloat(settings.confidenceThreshold.toString()) 
        : 0.75;
      
      const responseConfidence = 0.85;
      
      const requiresApproval = this.checkIfApprovalRequired(
        needsHuman,
        responseConfidence,
        confidenceThreshold,
        settings
      );

      if (requiresApproval) {
        console.log(`[Autopilot] Response requires approval for run ${runId}`);
        
        await db
          .update(aiRuns)
          .set({
            status: "pending_approval",
            outputText: finalResponse,
            needsHuman,
            confidence: String(responseConfidence),
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
          requiresApproval: true,
        };
      }

      await db
        .update(aiRuns)
        .set({
          status: "completed",
          outputText: finalResponse,
          needsHuman,
          confidence: String(responseConfidence),
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

  private checkIfApprovalRequired(
    needsHuman: boolean,
    confidence: number,
    confidenceThreshold: number,
    settings: any
  ): boolean {
    if (needsHuman) {
      console.log(`[Autopilot] Approval required: needsHuman flag is true`);
      return true;
    }

    if (confidence < confidenceThreshold) {
      console.log(`[Autopilot] Approval required: confidence ${confidence} below threshold ${confidenceThreshold}`);
      return true;
    }

    const escalationRules = settings.escalationRules as Record<string, string> | null;
    if (escalationRules && Object.values(escalationRules).includes('human')) {
      console.log(`[Autopilot] Approval required: escalation rules require human review`);
      return true;
    }

    return false;
  }

  async approveAndSendResponse(
    companyId: string,
    runId: string,
    approvedBy: string
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const [run] = await db
      .select()
      .from(aiRuns)
      .where(and(eq(aiRuns.id, runId), eq(aiRuns.companyId, companyId)))
      .limit(1);

    if (!run) {
      return { success: false, error: "Run not found" };
    }

    if (run.status !== "pending_approval") {
      return { success: false, error: `Run is not pending approval (status: ${run.status})` };
    }

    if (!run.outputText) {
      return { success: false, error: "No response to send" };
    }

    if (!run.conversationId) {
      return { success: false, error: "No conversation associated with this run" };
    }

    const [conversation] = await db
      .select()
      .from(telnyxConversations)
      .where(and(
        eq(telnyxConversations.id, run.conversationId),
        eq(telnyxConversations.companyId, companyId)
      ))
      .limit(1);

    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    try {
      const { sendTelnyxMessage } = await import("./telnyx-messaging-service");
      
      const sendResult = await sendTelnyxMessage({
        from: conversation.companyPhoneNumber,
        to: conversation.phoneNumber,
        text: run.outputText,
        companyId,
      });

      if (!sendResult.success) {
        console.error(`[Autopilot] Failed to send approved message:`, sendResult.error);
        return { success: false, error: sendResult.error || "Failed to send message" };
      }

      const [message] = await db.insert(telnyxMessages).values({
        conversationId: conversation.id,
        direction: "outbound",
        messageType: "outgoing",
        channel: conversation.channel || "sms",
        text: run.outputText,
        contentType: "text",
        status: "sent",
        telnyxMessageId: sendResult.messageId,
        sentAt: new Date(),
      }).returning();

      await db
        .update(telnyxConversations)
        .set({
          lastMessage: run.outputText.substring(0, 200),
          lastMessageAt: new Date(),
        })
        .where(eq(telnyxConversations.id, conversation.id));

      await db
        .update(aiRuns)
        .set({ status: "completed" })
        .where(eq(aiRuns.id, runId));

      await db.insert(aiActionLogs).values({
        companyId,
        runId,
        toolName: "message_approved",
        args: { approvedBy },
        result: { 
          sent: true, 
          messageId: message?.id,
          telnyxMessageId: sendResult.messageId 
        },
        success: true,
      });

      console.log(`[Autopilot] Approved and sent message for run ${runId}`);

      return { success: true, messageId: message?.id };
    } catch (error: any) {
      console.error(`[Autopilot] Error sending approved message:`, error);
      return { success: false, error: error.message || "Failed to send message" };
    }
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

    if (run.status !== "pending_approval") {
      return { success: false, error: `Run is not pending approval (status: ${run.status})` };
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
      .set({ 
        status: "rejected",
        outputText: null,
      })
      .where(eq(aiRuns.id, runId));

    console.log(`[Autopilot] Rejected response for run ${runId}. Reason: ${reason || 'No reason provided'}`);

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
        eq(aiRuns.status, "pending_approval")
      ))
      .orderBy(desc(aiRuns.createdAt))
      .limit(50);

    return runs;
  }

  private async getRecentMessages(
    companyId: string,
    conversationId: string,
    limit: number
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const messages = await db
      .select({
        direction: telnyxMessages.direction,
        text: telnyxMessages.text,
        createdAt: telnyxMessages.createdAt,
      })
      .from(telnyxMessages)
      .innerJoin(
        telnyxConversations,
        eq(telnyxMessages.conversationId, telnyxConversations.id)
      )
      .where(and(
        eq(telnyxMessages.conversationId, conversationId),
        eq(telnyxConversations.companyId, companyId)
      ))
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
