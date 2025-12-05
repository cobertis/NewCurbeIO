import type { proto, WASocket, ConnectionState, BaileysEventMap } from "@whiskeysockets/baileys";
import type {
  SelectWhatsappV2AuthSession,
  SelectWhatsappV2Contact,
  SelectWhatsappV2Chat,
  SelectWhatsappV2Message,
  InsertWhatsappV2AuthSession,
  InsertWhatsappV2Contact,
  InsertWhatsappV2Chat,
  InsertWhatsappV2Message,
} from "@shared/schema";

export type {
  SelectWhatsappV2AuthSession,
  SelectWhatsappV2Contact,
  SelectWhatsappV2Chat,
  SelectWhatsappV2Message,
  InsertWhatsappV2AuthSession,
  InsertWhatsappV2Contact,
  InsertWhatsappV2Chat,
  InsertWhatsappV2Message,
};

export interface WhatsAppV2Session {
  companyId: string;
  socket: WASocket | null;
  connectionState: ConnectionState;
  qrCode: string | null;
  isConnecting: boolean;
  lastError: string | null;
}

export interface WhatsAppV2ConnectionStatus {
  companyId: string;
  isConnected: boolean;
  connectionState: "close" | "connecting" | "open";
  qrCode: string | null;
  lastError: string | null;
  phoneNumber: string | null;
}

export interface WhatsAppV2AuthState {
  creds: any;
  keys: {
    get: (type: string, ids: string[]) => Promise<{ [key: string]: any }>;
    set: (data: { [key: string]: { [key: string]: any } }) => Promise<void>;
  };
}

export interface WhatsAppV2MessagePayload {
  jid: string;
  text?: string;
  media?: {
    url: string;
    mimetype: string;
    caption?: string;
  };
}

export interface WhatsAppV2ChatWithContact extends SelectWhatsappV2Chat {
  contact: SelectWhatsappV2Contact | null;
  lastMessage: SelectWhatsappV2Message | null;
}

export interface WhatsAppV2MessageWithMedia extends SelectWhatsappV2Message {
  mediaBuffer?: Buffer;
}

export type WhatsAppV2EventType = 
  | "connection.update"
  | "creds.update"
  | "messages.upsert"
  | "messages.update"
  | "contacts.upsert"
  | "chats.update";

export interface WhatsAppV2StorageInterface {
  getAuthSession(companyId: string, sessionId: string): Promise<SelectWhatsappV2AuthSession | null>;
  setAuthSession(data: InsertWhatsappV2AuthSession): Promise<void>;
  deleteAuthSession(companyId: string, sessionId: string): Promise<void>;
  getAllAuthSessions(companyId: string): Promise<SelectWhatsappV2AuthSession[]>;
  clearAllAuthSessions(companyId: string): Promise<void>;
  
  getContact(companyId: string, jid: string): Promise<SelectWhatsappV2Contact | null>;
  upsertContact(data: InsertWhatsappV2Contact): Promise<SelectWhatsappV2Contact>;
  getContacts(companyId: string): Promise<SelectWhatsappV2Contact[]>;
  
  getChat(companyId: string, jid: string): Promise<SelectWhatsappV2Chat | null>;
  upsertChat(data: InsertWhatsappV2Chat): Promise<SelectWhatsappV2Chat>;
  getChatsWithMessages(companyId: string): Promise<WhatsAppV2ChatWithContact[]>;
  updateChatLastMessage(chatId: string, messageId: string, timestamp: number): Promise<void>;
  updateChatUnreadCount(chatId: string, count: number): Promise<void>;
  
  getMessage(companyId: string, messageKey: string): Promise<SelectWhatsappV2Message | null>;
  insertMessage(data: InsertWhatsappV2Message): Promise<SelectWhatsappV2Message>;
  getMessagesByChat(chatId: string, limit?: number, beforeTimestamp?: number): Promise<SelectWhatsappV2Message[]>;
  updateMessageStatus(companyId: string, messageKey: string, status: string): Promise<void>;
}

export interface WhatsAppV2ServiceConfig {
  companyId: string;
  onQRCode?: (qr: string) => void;
  onConnectionUpdate?: (status: WhatsAppV2ConnectionStatus) => void;
  onNewMessage?: (message: SelectWhatsappV2Message) => void;
}

export const MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  STICKER: "sticker",
  UNKNOWN: "unknown",
} as const;

export const MESSAGE_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
} as const;

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];

export function extractPhoneFromJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
}

export function formatPhoneToJid(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `${cleaned}@s.whatsapp.net`;
}

export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

export function getMessageType(message: proto.IMessage): MessageType {
  if (message.conversation || message.extendedTextMessage) return MESSAGE_TYPES.TEXT;
  if (message.imageMessage) return MESSAGE_TYPES.IMAGE;
  if (message.videoMessage) return MESSAGE_TYPES.VIDEO;
  if (message.audioMessage) return MESSAGE_TYPES.AUDIO;
  if (message.documentMessage) return MESSAGE_TYPES.DOCUMENT;
  if (message.stickerMessage) return MESSAGE_TYPES.STICKER;
  return MESSAGE_TYPES.UNKNOWN;
}

export function extractTextContent(message: proto.IMessage): string | null {
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  return null;
}
