import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { telnyxConversations, users, tasks, aiActionLogs, contacts } from "@shared/schema";

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
  {
    name: "create_ticket",
    description: "Create a support ticket for customer issues that need tracking and follow-up",
    parameters: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "Optional contact ID to associate with the ticket",
        },
        subject: {
          type: "string",
          description: "Subject/title of the ticket",
        },
        priority: {
          type: "string",
          description: "Ticket priority level",
          enum: ["low", "medium", "high", "urgent"],
        },
        summary: {
          type: "string",
          description: "Detailed summary of the issue or request",
        },
        tags: {
          type: "array",
          description: "Array of tags to categorize the ticket",
        },
      },
      required: ["subject", "priority", "summary"],
    },
  },
  {
    name: "update_contact_field",
    description: "Update a specific field on the customer's contact record in the CRM",
    parameters: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The ID of the contact to update",
        },
        field_name: {
          type: "string",
          description: "Name of the field to update (firstName, lastName, email, notes, companyName)",
          enum: ["firstName", "lastName", "email", "notes", "companyName", "phoneDisplay"],
        },
        field_value: {
          type: "string",
          description: "The new value to set for the field",
        },
      },
      required: ["contact_id", "field_name", "field_value"],
    },
  },
  {
    name: "assign_conversation",
    description: "Assign the current conversation to a specific agent/team member",
    parameters: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "The user ID of the agent to assign the conversation to",
        },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "tag_conversation",
    description: "Add tags to the current conversation for categorization and filtering",
    parameters: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "Array of tag strings to apply to the conversation",
        },
      },
      required: ["tags"],
    },
  },
];

const AUTOPILOT_TOOL_LEVELS: Record<number, string[]> = {
  1: ["send_message", "transfer_to_human"],
  2: ["send_message", "transfer_to_human", "create_task", "update_conversation_status", "assign_conversation", "tag_conversation"],
  3: ["send_message", "transfer_to_human", "create_task", "update_conversation_status", "assign_conversation", "tag_conversation", "create_ticket", "update_contact_field"],
};

const COPILOT_TOOLS = [
  "search_knowledge_base",
  "get_customer_info",
  "transfer_to_human",
  "create_task",
  "update_conversation_status",
  "send_message",
  "assign_conversation",
  "tag_conversation",
  "create_ticket",
  "update_contact_field",
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

  getToolsForMode(mode: "copilot" | "autopilot", autopilotLevel: number = 1): Array<{
    type: "function";
    function: ToolDefinition;
  }> {
    const allowedToolNames = mode === "copilot" 
      ? COPILOT_TOOLS 
      : AUTOPILOT_TOOL_LEVELS[autopilotLevel] || AUTOPILOT_TOOL_LEVELS[1];

    return toolDefinitions
      .filter((tool) => allowedToolNames.includes(tool.name))
      .map((tool) => ({
        type: "function" as const,
        function: tool,
      }));
  }

  isToolAllowed(toolName: string, mode: "copilot" | "autopilot", autopilotLevel: number = 1): boolean {
    const allowedToolNames = mode === "copilot"
      ? COPILOT_TOOLS
      : AUTOPILOT_TOOL_LEVELS[autopilotLevel] || AUTOPILOT_TOOL_LEVELS[1];

    return allowedToolNames.includes(toolName);
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

        case "create_ticket":
          return await this.createTicket(args, context);

        case "update_contact_field":
          return await this.updateContactField(args.contact_id, args.field_name, args.field_value, context);

        case "assign_conversation":
          return await this.assignConversation(args.agent_id, context);

        case "tag_conversation":
          return await this.tagConversation(args.tags, context);

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

  private async createTicket(args: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    if (args.contact_id) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.id, args.contact_id),
          eq(contacts.companyId, context.companyId)
        ))
        .limit(1);

      if (!contact) {
        return {
          success: false,
          error: "Contact not found or does not belong to this company",
        };
      }
    }

    const priorityMap: Record<string, string> = {
      low: "low",
      medium: "medium",
      high: "high",
      urgent: "high",
    };

    const dueDate = new Date();
    if (args.priority === "urgent") {
      dueDate.setDate(dueDate.getDate() + 1);
    } else if (args.priority === "high") {
      dueDate.setDate(dueDate.getDate() + 3);
    } else {
      dueDate.setDate(dueDate.getDate() + 7);
    }

    const ticketDescription = [
      `**Summary:** ${args.summary}`,
      args.contact_id ? `**Contact ID:** ${args.contact_id}` : null,
      args.tags?.length ? `**Tags:** ${args.tags.join(", ")}` : null,
      `**Conversation:** ${context.conversationId}`,
    ].filter(Boolean).join("\n\n");

    const [ticket] = await db.insert(tasks).values({
      companyId: context.companyId,
      title: `[TICKET] ${args.subject}`,
      description: ticketDescription,
      priority: priorityMap[args.priority] || "medium",
      dueDate: dueDate.toISOString().split("T")[0],
      status: "pending",
      createdBy: context.userId || null,
    } as any).returning();

    if (context.runId) {
      await db.insert(aiActionLogs).values({
        companyId: context.companyId,
        runId: context.runId,
        toolName: "create_ticket",
        args: args,
        result: { ticketId: ticket?.id },
        success: true,
      });
    }

    return {
      success: true,
      message: `Ticket created: ${args.subject}`,
      data: { ticketId: ticket?.id, priority: args.priority },
    };
  }

  private async updateContactField(
    contactId: string,
    fieldName: string,
    fieldValue: string,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const [existingContact] = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.companyId, context.companyId)
      ))
      .limit(1);

    if (!existingContact) {
      return {
        success: false,
        error: "Contact not found or does not belong to this company",
      };
    }

    const allowedFields = ["firstName", "lastName", "email", "notes", "companyName", "phoneDisplay"];
    if (!allowedFields.includes(fieldName)) {
      return {
        success: false,
        error: `Field '${fieldName}' is not allowed to be updated. Allowed fields: ${allowedFields.join(", ")}`,
      };
    }

    const updateData: Record<string, any> = {
      [fieldName]: fieldValue,
      updatedAt: new Date(),
    };

    await db
      .update(contacts)
      .set(updateData)
      .where(and(
        eq(contacts.id, contactId),
        eq(contacts.companyId, context.companyId)
      ));

    if (context.runId) {
      await db.insert(aiActionLogs).values({
        companyId: context.companyId,
        runId: context.runId,
        toolName: "update_contact_field",
        args: { contactId, fieldName, fieldValue },
        result: { updated: true, field: fieldName },
        success: true,
      });
    }

    return {
      success: true,
      message: `Contact field '${fieldName}' updated successfully`,
      data: { contactId, field: fieldName, value: fieldValue },
    };
  }

  private async assignConversation(agentId: string, context: ToolExecutionContext): Promise<ToolResult> {
    const [agent] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, agentId),
        eq(users.companyId, context.companyId)
      ))
      .limit(1);

    if (!agent) {
      return {
        success: false,
        error: "Agent not found or does not belong to this company",
      };
    }

    await db
      .update(telnyxConversations)
      .set({
        assignedTo: agentId,
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
        toolName: "assign_conversation",
        args: { agentId },
        result: { assigned: true, agentName: `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || agent.email },
        success: true,
      });
    }

    return {
      success: true,
      message: `Conversation assigned to ${agent.firstName || agent.email}`,
      data: { agentId, agentName: `${agent.firstName || ""} ${agent.lastName || ""}`.trim() || agent.email },
    };
  }

  private async tagConversation(tags: string[], context: ToolExecutionContext): Promise<ToolResult> {
    if (!Array.isArray(tags) || tags.length === 0) {
      return {
        success: false,
        error: "Tags must be a non-empty array of strings",
      };
    }

    const sanitizedTags = tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean);
    if (sanitizedTags.length === 0) {
      return {
        success: false,
        error: "No valid tags provided after sanitization",
      };
    }

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

    if (context.runId) {
      await db.insert(aiActionLogs).values({
        companyId: context.companyId,
        runId: context.runId,
        toolName: "tag_conversation",
        args: { tags: sanitizedTags },
        result: { tagged: true, tags: sanitizedTags },
        success: true,
      });
    }

    return {
      success: true,
      message: `Conversation tagged with: ${sanitizedTags.join(", ")}`,
      data: { tags: sanitizedTags, conversationId: context.conversationId },
    };
  }
}

export const aiToolRegistry = new AiToolRegistry();
