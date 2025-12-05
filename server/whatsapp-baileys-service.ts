import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  BaileysEventMap,
  proto,
  downloadMediaMessage,
  getContentType,
  jidNormalizedUser,
  isJidGroup,
  WAMessage,
  MessageUpsertType,
  ConnectionState,
  makeInMemoryStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { db } from './db';
import { whatsappReactions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { notificationService } from './notification-service';
import { storage } from './storage';
import { broadcastWhatsAppCall, broadcastWhatsAppMessage } from './websocket';

interface WhatsAppSessionStatus {
  isReady: boolean;
  isAuthenticated: boolean;
  qrCode: string | null;
  qrReceivedAt: number | null;
  status: 'disconnected' | 'qr_received' | 'authenticated' | 'ready';
}

interface StoredChat {
  id: string;
  name?: string;
  conversationTimestamp?: number;
  unreadCount?: number;
  archived?: boolean;
  pinned?: number;
  lastMessage?: any;
}

interface StoredContact {
  id: string;
  name?: string;
  notify?: string;
}

interface CompanyBaileysClient {
  sock: WASocket;
  store: ReturnType<typeof makeInMemoryStore>;
  chats: Map<string, StoredChat>;
  contacts: Map<string, StoredContact>;
  status: WhatsAppSessionStatus;
  messageHandlers: Map<string, (message: any) => void>;
  messageStore: Map<string, proto.IWebMessageInfo>;
  saveCreds: () => Promise<void>;
}

class WhatsAppBaileysService extends EventEmitter {
  private clients: Map<string, CompanyBaileysClient> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private loggedOutCompanies: Set<string> = new Set();
  private messageReactions: Map<string, Array<{ emoji: string; senderId: string }>> = new Map();
  private sentMediaCache: Map<string, { mimetype: string; data: string }> = new Map();
  private readonly AVATARS_DIR = path.join(process.cwd(), 'server', 'avatars');
  private readonly AUTH_DIR = '.baileys_auth';
  private initializationLock: Map<string, Promise<CompanyBaileysClient>> = new Map();
  private globalInitLock: Promise<void> | null = null;
  private readonly MESSAGE_STORE_MAX_SIZE = 500;
  private readonly MEDIA_CACHE_MAX_SIZE = 100;

  constructor() {
    super();
    if (!fs.existsSync(this.AUTH_DIR)) {
      fs.mkdirSync(this.AUTH_DIR, { recursive: true });
    }
  }

  private pruneMessageStore(companyId: string): void {
    const client = this.clients.get(companyId);
    if (!client || client.messageStore.size <= this.MESSAGE_STORE_MAX_SIZE) {
      return;
    }
    
    const messages = Array.from(client.messageStore.entries())
      .map(([id, msg]) => ({
        id,
        timestamp: Number(msg.messageTimestamp) || 0
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const toRemove = messages.slice(0, messages.length - this.MESSAGE_STORE_MAX_SIZE);
    for (const { id } of toRemove) {
      client.messageStore.delete(id);
    }
    
    if (toRemove.length > 0) {
      console.log(`[Baileys] Pruned ${toRemove.length} old messages from store for company: ${companyId}`);
    }
  }

  private pruneMediaCache(): void {
    if (this.sentMediaCache.size <= this.MEDIA_CACHE_MAX_SIZE) {
      return;
    }
    
    const keys = Array.from(this.sentMediaCache.keys());
    const toRemove = keys.slice(0, keys.length - this.MEDIA_CACHE_MAX_SIZE);
    for (const key of toRemove) {
      this.sentMediaCache.delete(key);
    }
    
    if (toRemove.length > 0) {
      console.log(`[Baileys] Pruned ${toRemove.length} old entries from media cache`);
    }
  }

  private getAuthPath(companyId: string): string {
    return path.join(this.AUTH_DIR, companyId);
  }

  hasAuthenticatedSession(companyId: string): boolean {
    if (this.loggedOutCompanies.has(companyId)) {
      return false;
    }
    const authPath = this.getAuthPath(companyId);
    const credsPath = path.join(authPath, 'creds.json');
    try {
      return fs.existsSync(credsPath);
    } catch {
      return false;
    }
  }

  hasSavedSession(companyId: string): boolean {
    if (this.loggedOutCompanies.has(companyId)) {
      return false;
    }
    return this.hasAuthenticatedSession(companyId);
  }

  isLoggedOut(companyId: string): boolean {
    return this.loggedOutCompanies.has(companyId);
  }

  clearLoggedOutStatus(companyId: string): void {
    this.loggedOutCompanies.delete(companyId);
    console.log(`[Baileys] Cleared logged out status for company: ${companyId}`);
  }

  getSavedSessionCompanyIds(): string[] {
    try {
      if (!fs.existsSync(this.AUTH_DIR)) {
        return [];
      }
      const entries = fs.readdirSync(this.AUTH_DIR, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      console.error('[Baileys] Error reading saved sessions:', error);
      return [];
    }
  }

  async autoConnectSavedSessions(): Promise<void> {
    const savedCompanyIds = this.getSavedSessionCompanyIds();
    if (savedCompanyIds.length === 0) {
      console.log('[Baileys] No saved sessions found');
      return;
    }
    console.log(`[Baileys] Found ${savedCompanyIds.length} saved session(s) - will connect on-demand`);
  }

  startConnectionHealthCheck(): void {
    const HEALTH_CHECK_INTERVAL = 60000;
    setInterval(async () => {
      if (this.clients.size === 0) {
        return;
      }
      console.log(`[Baileys] Health check: Checking ${this.clients.size} active session(s)`);
      for (const [companyId, client] of this.clients) {
        const isReady = client.status?.isReady === true;
        if (isReady) {
          console.log(`[Baileys] Health check: Session ${companyId} is connected`);
        }
      }
    }, HEALTH_CHECK_INTERVAL);
    console.log('[Baileys] Connection health check started');
  }

  async shutdownAllClients(): Promise<void> {
    for (const [companyId, client] of this.clients) {
      try {
        console.log(`[Baileys] Shutting down client for company: ${companyId}`);
        client.sock.end(undefined);
      } catch (error) {
        console.error(`[Baileys] Error shutting down client for ${companyId}:`, error);
      }
    }
    this.clients.clear();
  }

  async shutdownClientForCompany(companyId: string): Promise<void> {
    const client = this.clients.get(companyId);
    if (client) {
      try {
        console.log(`[Baileys] Shutting down client for company: ${companyId}`);
        client.sock.end(undefined);
        this.clients.delete(companyId);
      } catch (error) {
        console.error(`[Baileys] Error shutting down client for ${companyId}:`, error);
        this.clients.delete(companyId);
      }
    }
  }

  async getClientForCompany(companyId: string): Promise<CompanyBaileysClient> {
    if (this.clients.has(companyId)) {
      const existingClient = this.clients.get(companyId)!;
      if (existingClient.status.isReady || existingClient.status.status === 'qr_received') {
        return existingClient;
      }
      if (existingClient.status.status === 'disconnected') {
        await this.shutdownClientForCompany(companyId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        return existingClient;
      }
    }

    if (this.initializationLock.has(companyId)) {
      console.log(`[Baileys] Waiting for existing initialization of company: ${companyId}`);
      return this.initializationLock.get(companyId)!;
    }

    if (this.globalInitLock) {
      console.log(`[Baileys] Waiting for global init lock before initializing company: ${companyId}`);
      await this.globalInitLock;
    }

    const initPromise = this.serializedCreateClient(companyId);
    this.initializationLock.set(companyId, initPromise);

    try {
      const result = await initPromise;
      return result;
    } finally {
      this.initializationLock.delete(companyId);
    }
  }

  private async serializedCreateClient(companyId: string): Promise<CompanyBaileysClient> {
    let resolveLock: (() => void) | undefined;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.globalInitLock = lockPromise;

    console.log(`[Baileys] 🔒 Acquired global init lock for company: ${companyId}`);

    try {
      return await this.createClientForCompany(companyId);
    } finally {
      this.globalInitLock = null;
      if (resolveLock) {
        resolveLock();
      }
      console.log(`[Baileys] 🔓 Released global init lock for company: ${companyId}`);
    }
  }

  async createClientForCompany(companyId: string): Promise<CompanyBaileysClient> {
    console.log(`[Baileys] Creating new client for company: ${companyId}`);

    const authPath = this.getAuthPath(companyId);
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const logger = P({ level: 'silent' }) as any;

    // Create in-memory store for this company (handles history sync)
    const store = makeInMemoryStore({ logger });

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['Curbe CRM', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      markOnlineOnConnect: true,
      syncFullHistory: true, // Enable history sync to get chats
      getMessage: async (key) => {
        // Required for retrying failed messages and history sync
        if (store) {
          const msg = await store.loadMessage(key.remoteJid!, key.id!);
          return msg?.message || undefined;
        }
        return proto.Message.fromObject({});
      },
    });

    // Bind store to socket events (critical for history sync)
    store.bind(sock.ev);

    const sessionStatus: WhatsAppSessionStatus = {
      isReady: false,
      isAuthenticated: false,
      qrCode: null,
      qrReceivedAt: null,
      status: 'disconnected',
    };

    const companyClient: CompanyBaileysClient = {
      sock,
      store,
      chats: new Map(),
      contacts: new Map(),
      status: sessionStatus,
      messageHandlers: new Map(),
      messageStore: new Map(),
      saveCreds,
    };

    this.clients.set(companyId, companyClient);
    this.setupEventHandlers(companyId, companyClient);

    return companyClient;
  }

  private setupEventHandlers(companyId: string, companyClient: CompanyBaileysClient): void {
    const { sock, status, saveCreds } = companyClient;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await qrcode.toDataURL(qr, { width: 256 });
          status.qrCode = qrDataUrl;
          status.qrReceivedAt = Date.now();
          status.status = 'qr_received';
          status.isAuthenticated = false;
          status.isReady = false;
          console.log(`[Baileys] QR code received for company: ${companyId}`);
          this.emit('qr', { companyId, qrCode: qrDataUrl });
          this.emit('status_change', { companyId, status: { ...status } });
        } catch (error) {
          console.error(`[Baileys] Error generating QR code for company ${companyId}:`, error);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        console.log(`[Baileys] Connection closed for company ${companyId}. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);
        
        status.isReady = false;
        status.isAuthenticated = false;
        status.status = 'disconnected';
        status.qrCode = null;
        status.qrReceivedAt = null;
        
        this.emit('disconnected', { companyId, reason: String(statusCode) });
        this.emit('status_change', { companyId, status: { ...status } });

        if (statusCode === DisconnectReason.loggedOut) {
          this.loggedOutCompanies.add(companyId);
          this.clients.delete(companyId);
          const authPath = this.getAuthPath(companyId);
          try {
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          } catch (error) {
            console.error(`[Baileys] Error removing auth files for ${companyId}:`, error);
          }
        } else if (shouldReconnect) {
          this.scheduleReconnect(companyId);
        }
      } else if (connection === 'open') {
        console.log(`[Baileys] ✅ Connection opened for company: ${companyId}`);
        status.isReady = true;
        status.isAuthenticated = true;
        status.status = 'ready';
        status.qrCode = null;
        status.qrReceivedAt = null;
        
        this.reconnectAttempts.delete(companyId);
        const timer = this.reconnectTimers.get(companyId);
        if (timer) {
          clearTimeout(timer);
          this.reconnectTimers.delete(companyId);
        }

        this.emit('ready', { companyId });
        this.emit('authenticated', { companyId });
        this.emit('status_change', { companyId, status: { ...status } });

        // Fetch participating groups to populate chats (workaround for Baileys v7 history sync issue)
        console.log(`[Baileys] Attempting to fetch groups for company: ${companyId}`);
        try {
          const groups = await sock.groupFetchAllParticipating();
          console.log(`[Baileys] groupFetchAllParticipating returned:`, groups ? Object.keys(groups).length : 'null', 'groups');
          if (groups && Object.keys(groups).length > 0) {
            for (const [groupId, groupMetadata] of Object.entries(groups)) {
              if (!companyClient.chats.has(groupId)) {
                companyClient.chats.set(groupId, {
                  id: groupId,
                  name: (groupMetadata as any).subject || groupId.replace('@g.us', ''),
                  conversationTimestamp: (groupMetadata as any).subjectTime || Math.floor(Date.now() / 1000),
                  unreadCount: 0,
                  archived: false,
                });
              }
            }
            console.log(`[Baileys] Stored ${companyClient.chats.size} groups for company: ${companyId}`);
          } else {
            console.log(`[Baileys] No groups found for company: ${companyId}`);
          }
        } catch (error: any) {
          console.log(`[Baileys] Could not fetch groups for ${companyId}:`, error?.message || error);
        }

        try {
          const savedReactions = await db
            .select()
            .from(whatsappReactions)
            .where(eq(whatsappReactions.companyId, companyId));
          
          for (const reaction of savedReactions) {
            const cacheKey = `${companyId}:${reaction.messageId}`;
            const existingReactions = this.messageReactions.get(cacheKey) || [];
            existingReactions.push({ emoji: reaction.emoji, senderId: reaction.senderId });
            this.messageReactions.set(cacheKey, existingReactions);
          }
          console.log(`[Baileys] Hydrated ${savedReactions.length} reactions for company: ${companyId}`);
        } catch (error) {
          console.error(`[Baileys] Failed to hydrate reactions for ${companyId}:`, error);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }: { messages: WAMessage[]; type: MessageUpsertType }) => {
      for (const msg of messages) {
        if (!msg.key.remoteJid) continue;

        const messageId = msg.key.id || '';
        companyClient.messageStore.set(messageId, msg);
        this.pruneMessageStore(companyId);

        const chatId = msg.key.remoteJid;
        const messageTimestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000);
        
        // Auto-create or update chat when receiving messages (workaround for Baileys v7 history sync issue)
        const existingChat = companyClient.chats.get(chatId);
        const chatName = msg.pushName || existingChat?.name || chatId.replace('@s.whatsapp.net', '').replace('@g.us', '');
        
        companyClient.chats.set(chatId, {
          id: chatId,
          name: chatName,
          conversationTimestamp: messageTimestamp,
          unreadCount: (existingChat?.unreadCount || 0) + (msg.key.fromMe ? 0 : 1),
          archived: existingChat?.archived || false,
          pinned: existingChat?.pinned,
          lastMessage: msg,
        });

        if (msg.key.fromMe) continue;
        if (type !== 'notify') continue;

        const senderId = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || '';
        const senderNumber = senderId.replace('@s.whatsapp.net', '').replace('@g.us', '');
        const messageContent = this.extractMessageContent(msg);
        const hasMedia = this.hasMediaContent(msg);

        console.log(`[Baileys] Message received for company ${companyId}: ${chatId}, ${messageContent.substring(0, 50)}`);

        this.emit('message', { companyId, message: msg });

        for (const handler of companyClient.messageHandlers.values()) {
          try {
            handler(msg);
          } catch (error) {
            console.error(`[Baileys] Error in message handler for company ${companyId}:`, error);
          }
        }

        const isGroup = isJidGroup(chatId);
        
        try {
          await notificationService.notifyWhatsAppMessage(companyId, {
            chatId,
            senderName: pushname || this.formatPhoneNumber(senderNumber) || 'Unknown',
            senderNumber,
            messageText: messageContent,
            hasMedia,
            mediaType: this.getMediaType(msg),
            isGroup,
            groupName: isGroup ? chatId : undefined,
          });

          broadcastWhatsAppMessage(companyId, {
            chatId,
            senderName: pushname || senderNumber,
            senderNumber,
            messageText: messageContent,
            hasMedia,
            mediaType: this.getMediaType(msg),
            isGroup,
            groupName: isGroup ? chatId : undefined,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error(`[Baileys] Error in message notification for company ${companyId}:`, error);
        }
      }
    });

    sock.ev.on('messages.reaction', async (reactions: { key: proto.IMessageKey; reaction: proto.IReaction }[]) => {
      for (const { key, reaction } of reactions) {
        const messageId = key.id || '';
        const senderId = reaction.key?.participant || reaction.key?.remoteJid || '';
        const emoji = reaction.text || '';
        
        const cacheKey = `${companyId}:${messageId}`;
        const existingReactions = this.messageReactions.get(cacheKey) || [];

        if (emoji === '') {
          const filtered = existingReactions.filter(r => r.senderId !== senderId);
          if (filtered.length > 0) {
            this.messageReactions.set(cacheKey, filtered);
          } else {
            this.messageReactions.delete(cacheKey);
          }
          try {
            await db.delete(whatsappReactions).where(
              and(
                eq(whatsappReactions.companyId, companyId),
                eq(whatsappReactions.messageId, messageId),
                eq(whatsappReactions.senderId, senderId)
              )
            );
          } catch (error) {
            console.error(`[Baileys] Error removing reaction from DB:`, error);
          }
        } else {
          const existingIndex = existingReactions.findIndex(r => r.senderId === senderId);
          if (existingIndex >= 0) {
            existingReactions[existingIndex].emoji = emoji;
          } else {
            existingReactions.push({ emoji, senderId });
          }
          this.messageReactions.set(cacheKey, existingReactions);
          try {
            await db.insert(whatsappReactions).values({
              companyId,
              messageId,
              emoji,
              senderId,
            }).onConflictDoUpdate({
              target: [whatsappReactions.companyId, whatsappReactions.messageId, whatsappReactions.senderId],
              set: { emoji },
            });
          } catch (error) {
            console.error(`[Baileys] Error saving reaction to DB:`, error);
          }
        }

        console.log(`[Baileys] Reaction for company ${companyId}: ${emoji} on message ${messageId}`);
        this.emit('message_reaction', { companyId, messageId, emoji, senderId });
      }
    });

    // Handle messaging history sync (primary source of chats in Baileys v7)
    sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest, progress }) => {
      console.log(`[Baileys] History sync for company ${companyId}: ${chats?.length || 0} chats, ${contacts?.length || 0} contacts, isLatest: ${isLatest}, progress: ${progress}%`);
      
      // Store chats
      if (chats && Array.isArray(chats)) {
        for (const chat of chats) {
          if (chat.id) {
            companyClient.chats.set(chat.id, {
              id: chat.id,
              name: chat.name || undefined,
              conversationTimestamp: chat.conversationTimestamp ? Number(chat.conversationTimestamp) : undefined,
              unreadCount: chat.unreadCount || 0,
              archived: chat.archived || false,
              pinned: chat.pinned || undefined,
              lastMessage: chat.lastMessage || undefined,
            });
          }
        }
        console.log(`[Baileys] Stored ${companyClient.chats.size} total chats for company ${companyId}`);
      }
      
      // Store contacts
      if (contacts && Array.isArray(contacts)) {
        for (const contact of contacts) {
          if (contact.id) {
            companyClient.contacts.set(contact.id, {
              id: contact.id,
              name: contact.name || undefined,
              notify: contact.notify || undefined,
            });
          }
        }
        console.log(`[Baileys] Stored ${companyClient.contacts.size} total contacts for company ${companyId}`);
      }
    });

    // Handle real-time chat updates
    sock.ev.on('chats.upsert', (chats: any[]) => {
      console.log(`[Baileys] Chats upsert for company ${companyId}: ${chats.length} chats`);
      for (const chat of chats) {
        if (chat.id) {
          const existing = companyClient.chats.get(chat.id) || {};
          companyClient.chats.set(chat.id, {
            ...existing,
            id: chat.id,
            name: chat.name || existing.name,
            conversationTimestamp: chat.conversationTimestamp ? Number(chat.conversationTimestamp) : existing.conversationTimestamp,
            unreadCount: chat.unreadCount ?? existing.unreadCount,
            archived: chat.archived ?? existing.archived,
            pinned: chat.pinned ?? existing.pinned,
            lastMessage: chat.lastMessage || existing.lastMessage,
          });
        }
      }
    });

    // Handle chat updates (read status, archive, etc.)
    sock.ev.on('chats.update', (updates: any[]) => {
      for (const update of updates) {
        if (update.id) {
          const existing = companyClient.chats.get(update.id);
          if (existing) {
            companyClient.chats.set(update.id, {
              ...existing,
              ...update,
              conversationTimestamp: update.conversationTimestamp ? Number(update.conversationTimestamp) : existing.conversationTimestamp,
            });
          }
        }
      }
    });

    // Handle contact updates
    sock.ev.on('contacts.upsert', (contacts: any[]) => {
      console.log(`[Baileys] Contacts upsert for company ${companyId}: ${contacts.length} contacts`);
      for (const contact of contacts) {
        if (contact.id) {
          companyClient.contacts.set(contact.id, {
            id: contact.id,
            name: contact.name || undefined,
            notify: contact.notify || undefined,
          });
        }
      }
    });

    // Handle contact updates
    sock.ev.on('contacts.update', (updates: any[]) => {
      for (const update of updates) {
        if (update.id) {
          const existing = companyClient.contacts.get(update.id);
          if (existing) {
            companyClient.contacts.set(update.id, {
              ...existing,
              ...update,
            });
          }
        }
      }
    });
  }

  private extractMessageContent(msg: WAMessage): string {
    const message = msg.message;
    if (!message) return '';

    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId;
    if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return message.listResponseMessage.singleSelectReply.selectedRowId;
    
    return '';
  }

  private hasMediaContent(msg: WAMessage): boolean {
    const message = msg.message;
    if (!message) return false;
    return !!(
      message.imageMessage ||
      message.videoMessage ||
      message.audioMessage ||
      message.documentMessage ||
      message.stickerMessage
    );
  }

  private getMediaType(msg: WAMessage): string {
    const message = msg.message;
    if (!message) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';
    return 'text';
  }

  private formatPhoneNumber(digits: string): string {
    if (!digits) return '';
    const cleaned = digits.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    return `+${cleaned}`;
  }

  private async scheduleReconnect(companyId: string): Promise<void> {
    const existingTimer = this.reconnectTimers.get(companyId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const attempts = this.reconnectAttempts.get(companyId) || 0;
    const delays = [2000, 4000, 8000, 16000, 30000];
    const delay = delays[Math.min(attempts, delays.length - 1)];

    console.log(`[Baileys] Scheduling reconnect for company ${companyId} in ${delay}ms (attempt ${attempts + 1})`);

    const timer = setTimeout(async () => {
      try {
        console.log(`[Baileys] Attempting to reconnect company ${companyId}...`);
        this.clients.delete(companyId);
        await this.createClientForCompany(companyId);
        this.reconnectAttempts.delete(companyId);
        this.reconnectTimers.delete(companyId);
        console.log(`[Baileys] Successfully reconnected company ${companyId}`);
      } catch (error) {
        console.error(`[Baileys] Reconnect failed for company ${companyId}:`, error);
        this.reconnectAttempts.set(companyId, attempts + 1);
        this.scheduleReconnect(companyId);
      }
    }, delay);

    this.reconnectTimers.set(companyId, timer);
    this.reconnectAttempts.set(companyId, attempts + 1);
  }

  getSessionStatus(companyId: string): WhatsAppSessionStatus {
    const companyClient = this.clients.get(companyId);
    if (!companyClient) {
      return {
        isReady: false,
        isAuthenticated: false,
        qrCode: null,
        qrReceivedAt: null,
        status: 'disconnected',
      };
    }
    return { ...companyClient.status };
  }

  getStatus(companyId: string): WhatsAppSessionStatus {
    return this.getSessionStatus(companyId);
  }

  isReady(companyId: string): boolean {
    const companyClient = this.clients.get(companyId);
    return companyClient?.status.isReady === true;
  }

  getQRCode(companyId: string): string | null {
    const companyClient = this.clients.get(companyId);
    return companyClient?.status.qrCode || null;
  }

  getCachedReactions(companyId: string, messageId: string): Array<{ emoji: string; senderId: string }> {
    const cacheKey = `${companyId}:${messageId}`;
    return this.messageReactions.get(cacheKey) || [];
  }

  async updateReactionCache(companyId: string, messageId: string, emoji: string, senderId: string): Promise<void> {
    const cacheKey = `${companyId}:${messageId}`;
    let existingReactions = this.messageReactions.get(cacheKey) || [];

    if (emoji === '') {
      existingReactions = existingReactions.filter(r => r.senderId !== senderId);
      if (existingReactions.length > 0) {
        this.messageReactions.set(cacheKey, existingReactions);
      } else {
        this.messageReactions.delete(cacheKey);
      }
      try {
        await db.delete(whatsappReactions).where(
          and(
            eq(whatsappReactions.companyId, companyId),
            eq(whatsappReactions.messageId, messageId),
            eq(whatsappReactions.senderId, senderId)
          )
        );
      } catch (error) {
        console.error(`[Baileys] Error removing reaction from DB:`, error);
      }
    } else {
      existingReactions = existingReactions.filter(r => r.senderId !== senderId);
      existingReactions.push({ emoji, senderId });
      this.messageReactions.set(cacheKey, existingReactions);
      try {
        await db.insert(whatsappReactions).values({
          companyId,
          messageId,
          emoji,
          senderId,
        }).onConflictDoUpdate({
          target: [whatsappReactions.companyId, whatsappReactions.messageId, whatsappReactions.senderId],
          set: { emoji },
        });
      } catch (error) {
        console.error(`[Baileys] Error saving reaction to DB:`, error);
      }
    }
  }

  private normalizeWhatsAppId(contactId: string): string {
    if (!contactId) return '';
    let normalized = contactId.trim();
    normalized = normalized.replace(/[^0-9@.a-z]/gi, '');
    if (!normalized.includes('@')) {
      normalized = `${normalized}@s.whatsapp.net`;
    }
    return normalized;
  }

  async getChats(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;
    
    try {
      // Use makeInMemoryStore chats (populated by history sync)
      const storeChats = client.store.chats.all();
      console.log(`[Baileys] Found ${storeChats.length} chats from store for company ${companyId}`);
      
      // Also merge any manually tracked chats
      const manualChats = Array.from(client.chats.values());
      
      // Create a merged map to avoid duplicates
      const chatMap = new Map<string, any>();
      
      // Add store chats first (these come from history sync)
      for (const chat of storeChats) {
        chatMap.set(chat.id, {
          id: { _serialized: chat.id },
          name: chat.name || chat.id.replace('@s.whatsapp.net', '').replace('@g.us', ''),
          isGroup: isJidGroup(chat.id),
          timestamp: chat.conversationTimestamp || 0,
          unreadCount: chat.unreadCount || 0,
          archived: chat.archived || false,
          pinned: chat.pinned || 0,
          lastMessage: null,
        });
      }
      
      // Override with manual chats (these may have additional data)
      for (const chat of manualChats) {
        chatMap.set(chat.id, {
          id: { _serialized: chat.id },
          name: chat.name || chat.id.replace('@s.whatsapp.net', '').replace('@g.us', ''),
          isGroup: isJidGroup(chat.id),
          timestamp: chat.conversationTimestamp || 0,
          unreadCount: chat.unreadCount || 0,
          archived: chat.archived || false,
          pinned: chat.pinned || 0,
          lastMessage: chat.lastMessage || null,
        });
      }
      
      const allChats = Array.from(chatMap.values());
      console.log(`[Baileys] Total merged chats: ${allChats.length} for company ${companyId}`);
      
      return allChats;
    } catch (error) {
      console.error(`[Baileys] Error getting chats for company ${companyId}:`, error);
      return [];
    }
  }

  async getChatById(companyId: string, chatId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const isGroup = isJidGroup(normalizedId);
      let name = normalizedId.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      if (isGroup) {
        try {
          const groupMetadata = await client.sock.groupMetadata(normalizedId);
          name = groupMetadata.subject || name;
        } catch {
        }
      }

      return {
        id: { _serialized: normalizedId },
        name,
        isGroup,
        timestamp: Date.now(),
        unreadCount: 0,
      };
    } catch (error) {
      console.error(`[Baileys] Error getting chat ${chatId} for company ${companyId}:`, error);
      throw error;
    }
  }

  async getChatMessages(companyId: string, chatId: string, limit: number = 50): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      // Use store to get messages (populated by history sync)
      const storeMessages = await client.store.loadMessages(normalizedId, limit);
      
      if (storeMessages && storeMessages.length > 0) {
        console.log(`[Baileys] Found ${storeMessages.length} messages from store for chat ${normalizedId}`);
        return storeMessages.map(msg => this.convertBaileysMessage(msg));
      }
      
      // Fallback to manual message store
      const messages = Array.from(client.messageStore.values())
        .filter(msg => msg.key.remoteJid === normalizedId)
        .slice(-limit)
        .map(msg => this.convertBaileysMessage(msg));
      
      return messages;
    } catch (error) {
      console.error(`[Baileys] Error getting messages for chat ${chatId}:`, error);
      return [];
    }
  }

  private convertBaileysMessage(msg: WAMessage): any {
    const messageId = msg.key.id || '';
    const chatId = msg.key.remoteJid || '';
    const fromMe = msg.key.fromMe || false;
    const senderId = msg.key.participant || msg.key.remoteJid || '';
    const timestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) : Date.now() / 1000;
    const body = this.extractMessageContent(msg);
    const hasMedia = this.hasMediaContent(msg);
    const type = this.getMediaType(msg);

    return {
      id: { _serialized: messageId },
      from: senderId,
      to: chatId,
      body,
      type,
      timestamp,
      fromMe,
      hasMedia,
      hasQuotedMsg: !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
      _data: msg,
    };
  }

  async sendMessage(companyId: string, to: string, message: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(to);
    const client = this.clients.get(companyId)!;

    try {
      const result = await client.sock.sendMessage(normalizedId, { text: message });
      console.log(`[Baileys] Message sent for company ${companyId} to ${normalizedId}`);
      
      if (result) {
        client.messageStore.set(result.key.id || '', {
          key: result.key,
          message: { conversation: message },
          messageTimestamp: Math.floor(Date.now() / 1000),
        } as WAMessage);
        this.pruneMessageStore(companyId);
      }

      return {
        id: { _serialized: result?.key.id || '' },
        from: client.sock.user?.id || '',
        to: normalizedId,
        body: message,
        timestamp: Date.now() / 1000,
        fromMe: true,
      };
    } catch (error) {
      console.error(`[Baileys] Error sending message for company ${companyId}:`, error);
      throw error;
    }
  }

  async sendMedia(
    companyId: string,
    to: string,
    mediaBuffer: Buffer,
    options: {
      mimetype: string;
      filename?: string;
      caption?: string;
    }
  ): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(to);
    const client = this.clients.get(companyId)!;

    try {
      let messageContent: any;
      const mimetype = options.mimetype.toLowerCase();

      if (mimetype.startsWith('image/')) {
        messageContent = {
          image: mediaBuffer,
          caption: options.caption,
          mimetype: options.mimetype,
        };
      } else if (mimetype.startsWith('video/')) {
        messageContent = {
          video: mediaBuffer,
          caption: options.caption,
          mimetype: options.mimetype,
        };
      } else if (mimetype.startsWith('audio/')) {
        messageContent = {
          audio: mediaBuffer,
          mimetype: options.mimetype,
          ptt: mimetype.includes('ogg'),
        };
      } else {
        messageContent = {
          document: mediaBuffer,
          mimetype: options.mimetype,
          fileName: options.filename || 'file',
          caption: options.caption,
        };
      }

      const result = await client.sock.sendMessage(normalizedId, messageContent);
      console.log(`[Baileys] Media sent for company ${companyId} to ${normalizedId}`);

      if (result?.key.id) {
        this.sentMediaCache.set(result.key.id, {
          mimetype: options.mimetype,
          data: mediaBuffer.toString('base64'),
        });
        this.pruneMediaCache();
      }

      return {
        id: { _serialized: result?.key.id || '' },
        from: client.sock.user?.id || '',
        to: normalizedId,
        hasMedia: true,
        timestamp: Date.now() / 1000,
        fromMe: true,
      };
    } catch (error) {
      console.error(`[Baileys] Error sending media for company ${companyId}:`, error);
      throw error;
    }
  }

  async getContacts(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const contacts = Array.from(client.contacts.values());
      if (contacts.length > 0) {
        return contacts.map((contact) => ({
          id: { _serialized: contact.id },
          name: contact.name || contact.notify || contact.id.replace('@s.whatsapp.net', ''),
          number: contact.id.replace('@s.whatsapp.net', ''),
          pushname: contact.notify || null,
          isMyContact: true,
          isBlocked: false,
        }));
      }
      return [];
    } catch (error) {
      console.error(`[Baileys] Error getting contacts for company ${companyId}:`, error);
      return [];
    }
  }

  async getContactById(companyId: string, contactId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(contactId);
    const client = this.clients.get(companyId)!;

    try {
      const contact = client.contacts.get(normalizedId);
      const number = normalizedId.replace('@s.whatsapp.net', '');

      return {
        id: { _serialized: normalizedId },
        name: contact?.name || contact?.notify || number,
        number,
        pushname: contact?.notify || null,
        isMyContact: !!contact,
        isBlocked: false,
      };
    } catch (error) {
      console.error(`[Baileys] Error getting contact ${contactId} for company ${companyId}:`, error);
      throw error;
    }
  }

  async getProfilePicture(companyId: string, contactId: string): Promise<string | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(contactId);
    const client = this.clients.get(companyId)!;

    try {
      const url = await client.sock.profilePictureUrl(normalizedId, 'image');
      return url || null;
    } catch (error: any) {
      if (error?.message?.includes('not-authorized') || error?.message?.includes('401')) {
        return null;
      }
      console.error(`[Baileys] Error getting profile picture for ${contactId}:`, error);
      return null;
    }
  }

  async getProfilePicUrl(companyId: string, contactId: string): Promise<string | null> {
    return this.getProfilePicture(companyId, contactId);
  }

  async markChatAsRead(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const messages = Array.from(client.messageStore.values())
        .filter(msg => msg.key.remoteJid === normalizedId && !msg.key.fromMe)
        .slice(-10);

      if (messages.length > 0) {
        await client.sock.readMessages(messages.map(msg => msg.key));
      }
      console.log(`[Baileys] Chat marked as read for company ${companyId}: ${normalizedId}`);
    } catch (error) {
      console.error(`[Baileys] Error marking chat as read for company ${companyId}:`, error);
      throw error;
    }
  }

  async reactToMessage(companyId: string, messageId: string, emoji: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const message = client.messageStore.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      await client.sock.sendMessage(message.key.remoteJid!, {
        react: {
          text: emoji,
          key: message.key,
        },
      });

      const myId = client.sock.user?.id || 'unknown';
      await this.updateReactionCache(companyId, messageId, emoji, myId);

      console.log(`[Baileys] Reaction sent for company ${companyId}: ${emoji} on message ${messageId}`);
    } catch (error) {
      console.error(`[Baileys] Error reacting to message for company ${companyId}:`, error);
      throw error;
    }
  }

  async replyMessage(companyId: string, messageId: string, content: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const message = client.messageStore.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      const result = await client.sock.sendMessage(message.key.remoteJid!, {
        text: content,
      }, {
        quoted: message,
      });

      console.log(`[Baileys] Reply sent for company ${companyId} to message ${messageId}`);
      return {
        id: { _serialized: result?.key.id || '' },
        from: client.sock.user?.id || '',
        to: message.key.remoteJid,
        body: content,
        timestamp: Date.now() / 1000,
        fromMe: true,
      };
    } catch (error) {
      console.error(`[Baileys] Error replying to message for company ${companyId}:`, error);
      throw error;
    }
  }

  async downloadMedia(companyId: string, messageId: string): Promise<{ mimetype: string; data: string } | null> {
    const cachedMedia = this.sentMediaCache.get(messageId);
    if (cachedMedia) {
      console.log(`[Baileys] Media found in cache for message ${messageId}`);
      return cachedMedia;
    }

    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const message = client.messageStore.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: P({ level: 'silent' }) as any,
          reuploadRequest: client.sock.updateMediaMessage,
        }
      );

      const messageContent = message.message;
      let mimetype = 'application/octet-stream';
      
      if (messageContent?.imageMessage) {
        mimetype = messageContent.imageMessage.mimetype || 'image/jpeg';
      } else if (messageContent?.videoMessage) {
        mimetype = messageContent.videoMessage.mimetype || 'video/mp4';
      } else if (messageContent?.audioMessage) {
        mimetype = messageContent.audioMessage.mimetype || 'audio/ogg';
      } else if (messageContent?.documentMessage) {
        mimetype = messageContent.documentMessage.mimetype || 'application/octet-stream';
      }

      const result = {
        mimetype,
        data: (buffer as Buffer).toString('base64'),
      };

      console.log(`[Baileys] Media downloaded for company ${companyId} from message ${messageId}`);
      return result;
    } catch (error) {
      console.error(`[Baileys] Error downloading media for company ${companyId}:`, error);
      throw error;
    }
  }

  async logout(companyId: string): Promise<void> {
    console.log(`[Baileys] === LOGOUT for company: ${companyId} ===`);
    
    this.loggedOutCompanies.add(companyId);
    
    const timer = this.reconnectTimers.get(companyId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(companyId);
    }
    this.reconnectAttempts.delete(companyId);

    const client = this.clients.get(companyId);
    if (client) {
      try {
        await client.sock.logout();
      } catch (error) {
        console.log(`[Baileys] Error during logout:`, error);
      }
      try {
        client.sock.end(undefined);
      } catch (error) {
        console.log(`[Baileys] Error ending socket:`, error);
      }
      this.clients.delete(companyId);
    }

    const authPath = this.getAuthPath(companyId);
    try {
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log(`[Baileys] Auth files deleted for company: ${companyId}`);
      }
    } catch (error) {
      console.error(`[Baileys] Error deleting auth files for ${companyId}:`, error);
    }

    this.emit('logout', { companyId });
    console.log(`[Baileys] === LOGOUT COMPLETE for company: ${companyId} ===`);
  }

  async destroy(companyId: string): Promise<void> {
    const client = this.clients.get(companyId);
    if (client) {
      try {
        client.sock.end(undefined);
        this.clients.delete(companyId);
        console.log(`[Baileys] Client destroyed for company: ${companyId}`);
      } catch (error) {
        console.error(`[Baileys] Failed to destroy client for company ${companyId}:`, error);
      }
    }
  }

  async destroyAll(): Promise<void> {
    console.log(`[Baileys] Destroying all ${this.clients.size} client instances`);
    const destroyPromises = Array.from(this.clients.keys()).map(companyId =>
      this.destroy(companyId)
    );
    await Promise.allSettled(destroyPromises);
    this.clients.clear();
  }

  async restartClientForCompany(companyId: string, force: boolean = false): Promise<CompanyBaileysClient> {
    const existingClient = this.clients.get(companyId);
    if (existingClient && !force) {
      const hasQRActive = existingClient.status?.status === 'qr_received' && existingClient.status?.qrCode;
      if (hasQRActive) {
        console.log(`[Baileys] SKIPPING restart for company ${companyId} - QR code is active`);
        return existingClient;
      }
    }

    console.log(`[Baileys] Restarting client for company: ${companyId}`);

    if (existingClient) {
      try {
        existingClient.sock.end(undefined);
      } catch (error) {
        console.error(`[Baileys] Error destroying existing client:`, error);
      }
      this.clients.delete(companyId);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    return await this.getClientForCompany(companyId);
  }

  async sendTyping(companyId: string, chatId: string, duration: number = 5000): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.sendPresenceUpdate('composing', normalizedId);
      if (duration > 0) {
        setTimeout(async () => {
          try {
            await client.sock.sendPresenceUpdate('paused', normalizedId);
          } catch (error) {
            console.error(`[Baileys] Error stopping typing:`, error);
          }
        }, duration);
      }
      console.log(`[Baileys] Typing indicator sent for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error sending typing indicator:`, error);
      throw error;
    }
  }

  async stopTyping(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.sendPresenceUpdate('paused', normalizedId);
      console.log(`[Baileys] Typing stopped for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error stopping typing:`, error);
      throw error;
    }
  }

  async sendRecording(companyId: string, chatId: string, duration: number = 5000): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.sendPresenceUpdate('recording', normalizedId);
      if (duration > 0) {
        setTimeout(async () => {
          try {
            await client.sock.sendPresenceUpdate('paused', normalizedId);
          } catch (error) {
            console.error(`[Baileys] Error stopping recording:`, error);
          }
        }, duration);
      }
      console.log(`[Baileys] Recording indicator sent for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error sending recording indicator:`, error);
      throw error;
    }
  }

  async isRegisteredUser(companyId: string, phoneNumber: string): Promise<boolean> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      const [result] = await client.sock.onWhatsApp(cleanNumber);
      return result?.exists || false;
    } catch (error) {
      console.error(`[Baileys] Error checking user registration:`, error);
      return false;
    }
  }

  async getNumberId(companyId: string, phoneNumber: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      const [result] = await client.sock.onWhatsApp(cleanNumber);
      if (result?.exists) {
        return {
          _serialized: result.jid,
          user: cleanNumber,
        };
      }
      return null;
    } catch (error) {
      console.error(`[Baileys] Error getting number ID:`, error);
      return null;
    }
  }

  async validateAndGetNumberId(companyId: string, phoneNumber: string): Promise<{
    isValid: boolean;
    whatsappId: string | null;
    formattedNumber: string;
  }> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    try {
      const formatsToTry = [
        cleanNumber,
        cleanNumber.startsWith('1') && cleanNumber.length === 11 ? cleanNumber.substring(1) : null,
        !cleanNumber.startsWith('1') && cleanNumber.length === 10 ? '1' + cleanNumber : null,
      ].filter(Boolean) as string[];

      for (const numberFormat of formatsToTry) {
        const [result] = await client.sock.onWhatsApp(numberFormat);
        if (result?.exists) {
          return {
            isValid: true,
            whatsappId: result.jid,
            formattedNumber: numberFormat,
          };
        }
      }

      return {
        isValid: false,
        whatsappId: null,
        formattedNumber: cleanNumber,
      };
    } catch (error) {
      console.error(`[Baileys] Error validating number:`, error);
      return {
        isValid: false,
        whatsappId: null,
        formattedNumber: cleanNumber,
      };
    }
  }

  async getMyProfile(companyId: string): Promise<{
    wid: string;
    pushname: string;
    profilePicUrl: string | null;
    about: string | null;
    phoneNumber: string;
  }> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const user = client.sock.user;
      if (!user) {
        throw new Error('User info not available');
      }

      const wid = user.id;
      const phoneNumber = wid.replace('@s.whatsapp.net', '');
      const pushname = user.name || '';

      let profilePicUrl: string | null = null;
      try {
        profilePicUrl = await client.sock.profilePictureUrl(wid, 'image');
      } catch {
      }

      let about: string | null = null;
      try {
        const status = await client.sock.fetchStatus(wid);
        about = status?.status || null;
      } catch {
      }

      return { wid, pushname, profilePicUrl, about, phoneNumber };
    } catch (error) {
      console.error(`[Baileys] Error getting my profile:`, error);
      throw error;
    }
  }

  async createGroup(companyId: string, title: string, participants: string[]): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const normalizedParticipants = participants.map(p => this.normalizeWhatsAppId(p));
      const result = await client.sock.groupCreate(title, normalizedParticipants);
      console.log(`[Baileys] Group created for company ${companyId}: ${title}`);
      return result;
    } catch (error) {
      console.error(`[Baileys] Error creating group:`, error);
      throw error;
    }
  }

  async addParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const normalizedParticipants = participants.map(p => this.normalizeWhatsAppId(p));
      await client.sock.groupParticipantsUpdate(normalizedChatId, normalizedParticipants, 'add');
      console.log(`[Baileys] Participants added to group ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error adding participants:`, error);
      throw error;
    }
  }

  async removeParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const normalizedParticipants = participants.map(p => this.normalizeWhatsAppId(p));
      await client.sock.groupParticipantsUpdate(normalizedChatId, normalizedParticipants, 'remove');
      console.log(`[Baileys] Participants removed from group ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error removing participants:`, error);
      throw error;
    }
  }

  async promoteParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const normalizedParticipants = participants.map(p => this.normalizeWhatsAppId(p));
      await client.sock.groupParticipantsUpdate(normalizedChatId, normalizedParticipants, 'promote');
      console.log(`[Baileys] Participants promoted in group ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error promoting participants:`, error);
      throw error;
    }
  }

  async demoteParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const normalizedParticipants = participants.map(p => this.normalizeWhatsAppId(p));
      await client.sock.groupParticipantsUpdate(normalizedChatId, normalizedParticipants, 'demote');
      console.log(`[Baileys] Participants demoted in group ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error demoting participants:`, error);
      throw error;
    }
  }

  async leaveGroup(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.groupLeave(normalizedChatId);
      console.log(`[Baileys] Left group ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error leaving group:`, error);
      throw error;
    }
  }

  async getGroupInviteCode(companyId: string, chatId: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const code = await client.sock.groupInviteCode(normalizedChatId);
      return code || '';
    } catch (error) {
      console.error(`[Baileys] Error getting group invite code:`, error);
      throw error;
    }
  }

  async revokeGroupInvite(companyId: string, chatId: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const code = await client.sock.groupRevokeInvite(normalizedChatId);
      return code || '';
    } catch (error) {
      console.error(`[Baileys] Error revoking group invite:`, error);
      throw error;
    }
  }

  async setGroupSubject(companyId: string, chatId: string, subject: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.groupUpdateSubject(normalizedChatId, subject);
      console.log(`[Baileys] Group subject updated for ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error setting group subject:`, error);
      throw error;
    }
  }

  async setGroupDescription(companyId: string, chatId: string, description: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.groupUpdateDescription(normalizedChatId, description);
      console.log(`[Baileys] Group description updated for ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error setting group description:`, error);
      throw error;
    }
  }

  async getGroupMetadata(companyId: string, chatId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const metadata = await client.sock.groupMetadata(normalizedChatId);
      return metadata;
    } catch (error) {
      console.error(`[Baileys] Error getting group metadata:`, error);
      throw error;
    }
  }

  async archiveChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.chatModify({ archive: true, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Chat archived: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error archiving chat:`, error);
      throw error;
    }
  }

  async unarchiveChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.chatModify({ archive: false, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Chat unarchived: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error unarchiving chat:`, error);
      throw error;
    }
  }

  async pinChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.chatModify({ pin: true, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Chat pinned: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error pinning chat:`, error);
      throw error;
    }
  }

  async unpinChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.chatModify({ pin: false, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Chat unpinned: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error unpinning chat:`, error);
      throw error;
    }
  }

  async muteChat(companyId: string, chatId: string, unmuteDate?: Date): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const muteUntil = unmuteDate ? Math.floor(unmuteDate.getTime() / 1000) : undefined;
      await client.sock.chatModify({ mute: muteUntil || -1, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Chat muted: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error muting chat:`, error);
      throw error;
    }
  }

  async unmuteChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.chatModify({ mute: null, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Chat unmuted: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error unmuting chat:`, error);
      throw error;
    }
  }

  async deleteChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.chatModify({ delete: true, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Chat deleted: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error deleting chat:`, error);
      throw error;
    }
  }

  async clearMessages(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.chatModify({ clear: { messages: [] }, lastMessages: [] }, normalizedChatId);
      console.log(`[Baileys] Messages cleared for chat: ${chatId}`);
    } catch (error) {
      console.error(`[Baileys] Error clearing messages:`, error);
      throw error;
    }
  }

  async sendPresenceAvailable(companyId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      await client.sock.sendPresenceUpdate('available');
      console.log(`[Baileys] Presence set to available for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error sending presence available:`, error);
      throw error;
    }
  }

  async sendPresenceUnavailable(companyId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      await client.sock.sendPresenceUpdate('unavailable');
      console.log(`[Baileys] Presence set to unavailable for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error sending presence unavailable:`, error);
      throw error;
    }
  }

  async setStatus(companyId: string, status: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      await client.sock.updateProfileStatus(status);
      console.log(`[Baileys] Status updated for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error setting status:`, error);
      throw error;
    }
  }

  async setDisplayName(companyId: string, displayName: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      await client.sock.updateProfileName(displayName);
      console.log(`[Baileys] Display name updated for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error setting display name:`, error);
      throw error;
    }
  }

  async setProfilePicture(companyId: string, imageBuffer: Buffer): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const userId = client.sock.user?.id;
      if (!userId) {
        throw new Error('User ID not available');
      }
      await client.sock.updateProfilePicture(userId, imageBuffer);
      console.log(`[Baileys] Profile picture updated for company ${companyId}`);
    } catch (error) {
      console.error(`[Baileys] Error setting profile picture:`, error);
      throw error;
    }
  }

  async blockContact(companyId: string, contactId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(contactId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.updateBlockStatus(normalizedId, 'block');
      console.log(`[Baileys] Contact blocked: ${contactId}`);
    } catch (error) {
      console.error(`[Baileys] Error blocking contact:`, error);
      throw error;
    }
  }

  async unblockContact(companyId: string, contactId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(contactId);
    const client = this.clients.get(companyId)!;

    try {
      await client.sock.updateBlockStatus(normalizedId, 'unblock');
      console.log(`[Baileys] Contact unblocked: ${contactId}`);
    } catch (error) {
      console.error(`[Baileys] Error unblocking contact:`, error);
      throw error;
    }
  }

  async forwardMessage(companyId: string, messageId: string, chatId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedChatId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const message = client.messageStore.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      const result = await client.sock.sendMessage(normalizedChatId, { forward: message });
      console.log(`[Baileys] Message forwarded to ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[Baileys] Error forwarding message:`, error);
      throw error;
    }
  }

  async deleteMessage(companyId: string, messageId: string, forEveryone: boolean = false): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const message = client.messageStore.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      if (forEveryone) {
        await client.sock.sendMessage(message.key.remoteJid!, { delete: message.key });
      } else {
        await client.sock.chatModify(
          { clear: { messages: [{ id: message.key.id!, fromMe: message.key.fromMe || false, timestamp: Number(message.messageTimestamp) }] }, lastMessages: [] },
          message.key.remoteJid!
        );
      }
      
      client.messageStore.delete(messageId);
      console.log(`[Baileys] Message deleted: ${messageId}`);
    } catch (error) {
      console.error(`[Baileys] Error deleting message:`, error);
      throw error;
    }
  }

  async starMessage(companyId: string, messageId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const message = client.messageStore.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      await client.sock.chatModify(
        { star: { messages: [{ id: message.key.id!, fromMe: message.key.fromMe || false }], star: true }, lastMessages: [] },
        message.key.remoteJid!
      );
      console.log(`[Baileys] Message starred: ${messageId}`);
    } catch (error) {
      console.error(`[Baileys] Error starring message:`, error);
      throw error;
    }
  }

  async unstarMessage(companyId: string, messageId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;

    try {
      const message = client.messageStore.get(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      await client.sock.chatModify(
        { star: { messages: [{ id: message.key.id!, fromMe: message.key.fromMe || false }], star: false }, lastMessages: [] },
        message.key.remoteJid!
      );
      console.log(`[Baileys] Message unstarred: ${messageId}`);
    } catch (error) {
      console.error(`[Baileys] Error unstarring message:`, error);
      throw error;
    }
  }

  async sendLocation(companyId: string, chatId: string, latitude: number, longitude: number, name?: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const result = await client.sock.sendMessage(normalizedId, {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
          name,
        },
      });
      console.log(`[Baileys] Location sent to ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[Baileys] Error sending location:`, error);
      throw error;
    }
  }

  async sendContactCard(companyId: string, chatId: string, contactVCard: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(chatId);
    const client = this.clients.get(companyId)!;

    try {
      const result = await client.sock.sendMessage(normalizedId, {
        contacts: {
          displayName: 'Contact',
          contacts: [{ vcard: contactVCard }],
        },
      });
      console.log(`[Baileys] Contact card sent to ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[Baileys] Error sending contact card:`, error);
      throw error;
    }
  }

  async getContactProfile(companyId: string, contactId: string): Promise<{
    id: string;
    name: string;
    number: string;
    profilePicUrl: string | null;
    isBlocked: boolean;
    isBusiness: boolean;
    pushname: string | null;
  }> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(contactId);
    const client = this.clients.get(companyId)!;
    const number = normalizedId.replace('@s.whatsapp.net', '');

    try {
      const contact = client.contacts.get(normalizedId);

      let profilePicUrl: string | null = null;
      try {
        profilePicUrl = await client.sock.profilePictureUrl(normalizedId, 'image');
      } catch {
      }

      return {
        id: normalizedId,
        name: contact?.name || contact?.notify || number,
        number,
        profilePicUrl,
        isBlocked: false,
        isBusiness: false,
        pushname: contact?.notify || null,
      };
    } catch (error) {
      console.error(`[Baileys] Error getting contact profile:`, error);
      throw error;
    }
  }

  async getContactInfo(companyId: string, contactId: string): Promise<{
    id: string;
    name: string | null;
    number: string;
    about: string | null;
    profilePic: string | null;
    pushname: string | null;
    isBusiness: boolean;
    isBlocked: boolean;
    isEnterprise: boolean;
    isUser: boolean;
    labels: string[];
  }> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const normalizedId = this.normalizeWhatsAppId(contactId);
    const client = this.clients.get(companyId)!;
    const number = normalizedId.replace('@s.whatsapp.net', '');

    try {
      const contact = client.contacts.get(normalizedId);

      let profilePic: string | null = null;
      try {
        profilePic = await client.sock.profilePictureUrl(normalizedId, 'image');
      } catch {
      }

      let about: string | null = null;
      try {
        const status = await client.sock.fetchStatus(normalizedId);
        about = status?.status || null;
      } catch {
      }

      return {
        id: normalizedId,
        name: contact?.name || null,
        number,
        about,
        profilePic,
        pushname: contact?.notify || null,
        isBusiness: false,
        isBlocked: false,
        isEnterprise: false,
        isUser: true,
        labels: [],
      };
    } catch (error) {
      console.error(`[Baileys] Error getting contact info:`, error);
      throw error;
    }
  }

  async getMessageById(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const client = this.clients.get(companyId)!;
    const message = client.messageStore.get(messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    return this.convertBaileysMessage(message);
  }

  onMessageHandler(companyId: string, handlerId: string, handler: (message: any) => void): void {
    const client = this.clients.get(companyId);
    if (client) {
      client.messageHandlers.set(handlerId, handler);
    }
  }

  offMessageHandler(companyId: string, handlerId: string): void {
    const client = this.clients.get(companyId);
    if (client) {
      client.messageHandlers.delete(handlerId);
    }
  }
}

export const whatsappBaileysService = new WhatsAppBaileysService();
