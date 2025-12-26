import { nanoid } from "nanoid";
import type { Request } from "express";

/**
 * TraceContext interface for chat widget instrumentation
 */
export interface TraceContext {
  traceId: string;
  companyId: string;
  widgetId: string;
  deviceId: string;
  contactId: string | null;
  conversationId: string | null;
  sessionId: string | null;
  status: string | null;
  lastMessageId: string | null;
  unreadCount: number | null;
  timestamp: string; // ISO
  action: string;
}

/**
 * Generates a unique trace ID in the format cw-{timestamp}-{random}
 */
export function generateTraceId(): string {
  const timestamp = Date.now();
  const random = nanoid(8);
  return `cw-${timestamp}-${random}`;
}

/**
 * Creates a new TraceContext with a generated traceId
 */
export function createTraceContext(params: Omit<TraceContext, "traceId" | "timestamp">): TraceContext {
  return {
    ...params,
    traceId: generateTraceId(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Logs a structured chat event to the console
 */
export function logChatEvent(context: TraceContext): void {
  const {
    action,
    traceId,
    companyId,
    widgetId,
    deviceId,
    contactId,
    conversationId,
    sessionId,
    status,
    lastMessageId,
    unreadCount,
  } = context;

  console.log(
    `[ChatWidget] action=${action} traceId=${traceId} companyId=${companyId} widgetId=${widgetId} deviceId=${deviceId} contactId=${contactId ?? ""} conversationId=${conversationId ?? ""} sessionId=${sessionId ?? ""} status=${status ?? ""} lastMessageId=${lastMessageId ?? ""} unreadCount=${unreadCount ?? ""}`
  );
}

/**
 * Extracts trace fields from an Express request (query or body)
 */
export function extractTraceFromRequest(req: Request): Partial<TraceContext> {
  const source = { ...req.query, ...req.body };
  
  return {
    traceId: (source.traceId as string) || (source.trace_id as string),
    companyId: (source.companyId as string) || (source.company_id as string),
    widgetId: (source.widgetId as string) || (source.widget_id as string),
    deviceId: (source.deviceId as string) || (source.device_id as string),
    contactId: (source.contactId as string) || (source.contact_id as string) || null,
    conversationId: (source.conversationId as string) || (source.conversation_id as string) || null,
    sessionId: (source.sessionId as string) || (source.session_id as string) || null,
    status: (source.status as string) || null,
    lastMessageId: (source.lastMessageId as string) || (source.last_message_id as string) || null,
    unreadCount: source.unreadCount !== undefined ? Number(source.unreadCount) : null,
    action: (source.action as string) || "",
  };
}
