import type { WASocket } from "@whiskeysockets/baileys";
import {
  initializeClient,
  getSession,
  getSocket,
  getConnectionStatus,
  disconnectClient,
  logoutClient,
  isSessionActive,
} from "./client-manager";
import { setupEventHandlers, sendTextMessage, markChatAsRead } from "./event-handlers";
import type {
  WhatsAppV2StorageInterface,
  WhatsAppV2ConnectionStatus,
  WhatsAppV2ServiceConfig,
  WhatsAppV2ChatWithContact,
  SelectWhatsappV2Message,
} from "./types";

export * from "./types";
export { usePostgresAuthState } from "./postgres-auth";

class WhatsAppV2Service {
  private storage: WhatsAppV2StorageInterface;

  constructor(storage: WhatsAppV2StorageInterface) {
    this.storage = storage;
  }

  async connect(config: WhatsAppV2ServiceConfig): Promise<WASocket> {
    const socket = await initializeClient(this.storage, config);
    
    setupEventHandlers(
      socket,
      this.storage,
      config.companyId,
      config.onNewMessage
    );

    return socket;
  }

  getStatus(companyId: string): WhatsAppV2ConnectionStatus {
    return getConnectionStatus(companyId);
  }

  isConnected(companyId: string): boolean {
    return isSessionActive(companyId);
  }

  async disconnect(companyId: string): Promise<void> {
    await disconnectClient(companyId);
  }

  async logout(companyId: string): Promise<void> {
    await logoutClient(this.storage, companyId);
  }

  async sendMessage(
    companyId: string,
    jid: string,
    text: string
  ): Promise<SelectWhatsappV2Message> {
    const socket = getSocket(companyId);
    if (!socket) {
      throw new Error("WhatsApp not connected");
    }
    return sendTextMessage(socket, this.storage, companyId, jid, text);
  }

  async markAsRead(companyId: string, jid: string): Promise<void> {
    const socket = getSocket(companyId);
    if (!socket) {
      throw new Error("WhatsApp not connected");
    }
    await markChatAsRead(socket, this.storage, companyId, jid);
  }

  async getChats(companyId: string): Promise<WhatsAppV2ChatWithContact[]> {
    return this.storage.getChatsWithMessages(companyId);
  }

  async getMessages(
    chatId: string,
    limit?: number,
    beforeTimestamp?: number
  ): Promise<SelectWhatsappV2Message[]> {
    return this.storage.getMessagesByChat(chatId, limit, beforeTimestamp);
  }

  getSocket(companyId: string): WASocket | null {
    return getSocket(companyId);
  }
}

let serviceInstance: WhatsAppV2Service | null = null;

export function createWhatsAppV2Service(
  storage: WhatsAppV2StorageInterface
): WhatsAppV2Service {
  if (!serviceInstance) {
    serviceInstance = new WhatsAppV2Service(storage);
  }
  return serviceInstance;
}

export function getWhatsAppV2Service(): WhatsAppV2Service | null {
  return serviceInstance;
}

export { WhatsAppV2Service };
