import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { telnyxConversations, users, tasks, aiActionLogs } from "@shared/schema";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface ToolExecutionContext {
  companyId: string;
  userId?: string;
  conversationId: string;
  runId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

interface KbChunk {
  content: string;
  metadata?: {
    sourceUrl?: string;
    [key: string]: any;
  };
}

const toolDefinitions: ToolDefinition[] = [
  {
    name: "search_knowledge_base",
    description: "Search the company knowledge base for relevant information to answer customer questions",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant knowledge base articles",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_customer_info",
    description: "Get information about the current customer from CRM",
    parameters: {
      type: "object",
      properties: {
        field: {
          type: "string",
          description: "Specific field to retrieve (name, email, phone, recent_interactions, all)",
          enum: ["name", "email", "phone", "recent_interactions", "all"],
        },
      },
      required: [],
    },
  },
  {
    name: "transfer_to_human",
    description: "Transfer the conversation to a human agent when the AI cannot adequately help",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Brief reason for the transfer",
        },
        priority: {
          type: "string",
          description: "Priority level for human agent",
          enum: ["low", "normal", "high", "urgent"],
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "create_task",
    description: "Create a follow-up task for a team member",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Task title",
        },
        description: {
          type: "string",
          description: "Task description with context",
        },
        priority: {
          type: "string",
          description: "Task priority",
          enum: ["low", "medium", "high"],
        },
        dueInDays: {
          type: "number",
          description: "Number of days until the task is due",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_conversation_status",
    description: "Update the status of the current conversation",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "New conversation status",
          enum: ["open", "pending", "solved", "snoozed"],
        },
        snoozeUntil: {
          type: "string",
          description: "ISO date string for when to unsnooze (only if status is snoozed)",
        },
      },
      required: ["status"],
    },
  },
  {
    name: "send_message",
    description: "Send a message to the customer. Use this to respond to the customer.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message content to send to the customer",
        },
      },
      required: ["message"],
    },
  },
];

export class AiToolRegistry {
  getToolDefinitions(): ToolDefinition[] {
    return toolDefinitions;
  }

  getToolsForOpenAI(): Array<{
    type: "function";
    function: ToolDefinition;
  }> {
    return toolDefinitions.map((tool) => ({
      type: "function" as const,
      function: tool,
    }));
  }

  async executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    console.log(`[AiToolRegistry] Executing tool: ${toolName}`, { args, conversationId: context.conversationId });

    try {
      switch (toolName) {
        case "search_knowledge_base":
          return await this.searchKnowledgeBase(args.query, context);

        case "get_customer_info":
          return await this.getCustomerInfo(args.field || "all", context);

        case "transfer_to_human":
          return await this.transferToHuman(args.reason, args.priority || "normal", context);

        case "create_task":
          return await this.createTask(args, context);

        case "update_conversation_status":
          return await this.updateConversationStatus(args.status, args.snoozeUntil, context);

        case "send_message":
          return await this.sendMessage(args.message, context);

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error: any) {
      console.error(`[AiToolRegistry] Tool execution error: ${toolName}`, error);
      return {
        success: false,
        error: error.message || "Tool execution failed",
      };
    }
  }

  private async searchKnowledgeBase(query: string, context: ToolExecutionContext): Promise<ToolResult> {
    const { aiDeskService } = await import("./ai-desk-service");

    try {
      const chunks: KbChunk[] = await aiDeskService.searchChunks(context.companyId, query, 3);
      if (chunks.length === 0) {
        return {
          success: true,
          data: null,
          message: "No relevant information found in knowledge base",
        };
      }

      return {
        success: true,
        data: chunks.map((c: KbChunk) => ({
          content: c.content,
          source: c.metadata?.sourceUrl || "Knowledge Base",
        })),
        message: `Found ${chunks.length} relevant articles`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getCustomerInfo(field: string, context: ToolExecutionContext): Promise<ToolResult> {
    const [conversation] = await db
      .select()
      .from(telnyxConversations)
      .where(and(
        eq(telnyxConversations.id, context.conversationId),
        eq(telnyxConversations.companyId, context.companyId)
      ))
      .limit(1);

    if (!conversation) {
      return {
        success: false,
        error: "Conversation not found",
      };
    }

    const customerData: Record<string, any> = {
      name: conversation.displayName || "Unknown",
      email: conversation.email || null,
      phone: conversation.phoneNumber,
    };

    if (field === "all") {
      return {
        success: true,
        data: customerData,
      };
    }

    return {
      success: true,
      data: { [field]: customerData[field] },
    };
  }

  private async transferToHuman(reason: string, priority: string, context: ToolExecutionContext): Promise<ToolResult> {
    await db
      .update(telnyxConversations)
      .set({
        status: "open",
        assignedTo: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(telnyxConversations.id, context.conversationId),
        eq(telnyxConversations.companyId, context.companyId)
      ));

    if (context.runId) {
      await db.insert(aiActionLogs).values({
        companyId: context.companyId,
        runId: context.runId,
        toolName: "transfer_to_human",
        args: { reason, priority },
        result: { transferred: true },
        success: true,
      });
    }

    return {
      success: true,
      message: `Conversation transferred to human agent. Reason: ${reason}`,
      data: { transferred: true, priority },
    };
  }

  private async createTask(args: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    const dueDate = args.dueInDays
      ? new Date(Date.now() + args.dueInDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [task] = await db.insert(tasks).values({
      companyId: context.companyId,
      title: args.title,
      description: args.description || "",
      priority: args.priority || "medium",
      dueDate: dueDate,
      status: "pending",
      createdBy: context.userId || null,
    } as any).returning();

    if (context.runId) {
      await db.insert(aiActionLogs).values({
        companyId: context.companyId,
        runId: context.runId,
        toolName: "create_task",
        args: args,
        result: { taskId: task?.id },
        success: true,
      });
    }

    return {
      success: true,
      message: `Task created: ${args.title}`,
      data: { taskId: task?.id },
    };
  }

  private async updateConversationStatus(
    status: string,
    snoozeUntil: string | undefined,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "snoozed" && snoozeUntil) {
      updateData.snoozedUntil = new Date(snoozeUntil);
    }

    await db
      .update(telnyxConversations)
      .set(updateData)
      .where(and(
        eq(telnyxConversations.id, context.conversationId),
        eq(telnyxConversations.companyId, context.companyId)
      ));

    if (context.runId) {
      await db.insert(aiActionLogs).values({
        companyId: context.companyId,
        runId: context.runId,
        toolName: "update_conversation_status",
        args: { status, snoozeUntil },
        result: { updated: true },
        success: true,
      });
    }

    return {
      success: true,
      message: `Conversation status updated to ${status}`,
    };
  }

  private async sendMessage(message: string, context: ToolExecutionContext): Promise<ToolResult> {
    return {
      success: true,
      data: { message, requiresApproval: true },
      message: "Message prepared for sending (requires approval if Autopilot mode is not fully autonomous)",
    };
  }
}

export const aiToolRegistry = new AiToolRegistry();
