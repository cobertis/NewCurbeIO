import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  proto,
  downloadMediaMessage,
  jidNormalizedUser,
  isJidGroup,
  WAMessage,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { db } from './db';
import { whatsappReactions, whatsappChats, whatsappMessages } from '@shared/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { notificationService } from './notification-service';
import { broadcastWhatsAppMessage } from './websocket';
import { whatsappMediaStorage } from './whatsapp-media-storage';

interface SessionStatus {
  isReady: boolean;
  isAuthenticated: boolean;
  qrCode: string | null;
  qrReceivedAt: number | null;
  status: 'disconnected' | 'qr_received' | 'authenticated' | 'ready';
}

interface SessionMetrics {
  connectedAt: Date | null;
  lastActivityAt: Date | null;
  messagesSent: number;
  messagesReceived: number;
  reconnectCount: number;
  lastDisconnectReason: string | null;
}

interface CompanySession {
  sock: WASocket;
  status: SessionStatus;
  saveCreds: () => Promise<void>;
  selfJid: string | null;
  messageHandlers: Map<string, (message: any) => void>;
}

function isSystemJid(jid: string | undefined | null, selfJid?: string | null): boolean {
  if (!jid) return true;
  if (jid === 'status@broadcast') return true;
  if (jid.endsWith('@server') || jid.endsWith('@broadcast')) return true;
  if (jid.includes('@newsletter')) return true;
  if (jid.endsWith('@lid')) return true;
  if (selfJid) {
    const normalizedSelf = jidNormalizedUser(selfJid);
    const normalizedJid = jidNormalizedUser(jid);
    if (normalizedSelf === normalizedJid) return true;
  }
  return false;
}

function normalizeWhatsAppId(contactId: string): string {
  if (!contactId) return '';
  let normalized = contactId.trim().replace(/[^0-9@.a-z]/gi, '');
  if (!normalized.includes('@')) {
    normalized = `${normalized}@s.whatsapp.net`;
  }
  return normalized;
}

function extractMessageContent(msg: WAMessage): string {
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

function getMediaType(msg: WAMessage): string {
  const message = msg.message;
  if (!message) return 'text';
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.documentMessage) return 'document';
  if (message.stickerMessage) return 'sticker';
  return 'text';
}

function hasMediaContent(msg: WAMessage): boolean {
  const message = msg.message;
  if (!message) return false;
  return !!(message.imageMessage || message.videoMessage || message.audioMessage || 
            message.documentMessage || message.stickerMessage);
}

class WhatsAppBaileysService extends EventEmitter {
  private sessions: Map<string, CompanySession> = new Map();
  private metrics: Map<string, SessionMetrics> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private loggedOutCompanies: Set<string> = new Set();
  private initLocks: Map<string, Promise<CompanySession>> = new Map();
  private sentMediaCache: Map<string, { mimetype: string; data: string }> = new Map();
  private readonly AUTH_DIR = '.baileys_auth';

  constructor() {
    super();
    if (!fs.existsSync(this.AUTH_DIR)) {
      fs.mkdirSync(this.AUTH_DIR, { recursive: true });
    }
  }

  private getAuthPath(companyId: string): string {
    return path.join(this.AUTH_DIR, companyId);
  }

  hasAuthenticatedSession(companyId: string): boolean {
    if (this.loggedOutCompanies.has(companyId)) return false;
    const credsPath = path.join(this.getAuthPath(companyId), 'creds.json');
    try { return fs.existsSync(credsPath); } catch { return false; }
  }

  hasSavedSession(companyId: string): boolean {
    return !this.loggedOutCompanies.has(companyId) && this.hasAuthenticatedSession(companyId);
  }

  isLoggedOut(companyId: string): boolean {
    return this.loggedOutCompanies.has(companyId);
  }

  clearLoggedOutStatus(companyId: string): void {
    this.loggedOutCompanies.delete(companyId);
    console.log(`[Baileys] Cleared logged out status for company: ${companyId}`);
  }

  isReady(companyId: string): boolean {
    return this.sessions.get(companyId)?.status.isReady === true;
  }

  getSessionStatus(companyId: string): SessionStatus {
    const session = this.sessions.get(companyId);
    if (!session) {
      return { isReady: false, isAuthenticated: false, qrCode: null, qrReceivedAt: null, status: 'disconnected' };
    }
    return { ...session.status };
  }

  getStatus(companyId: string): SessionStatus {
    return this.getSessionStatus(companyId);
  }

  getQRCode(companyId: string): string | null {
    return this.sessions.get(companyId)?.status.qrCode || null;
  }

  getSessionMetrics(companyId: string): SessionMetrics & { uptime: number | null } {
    const m = this.metrics.get(companyId) || {
      connectedAt: null, lastActivityAt: null, messagesSent: 0,
      messagesReceived: 0, reconnectCount: 0, lastDisconnectReason: null
    };
    const uptime = m.connectedAt ? Math.floor((Date.now() - m.connectedAt.getTime()) / 1000) : null;
    return { ...m, uptime };
  }

  getAllSessionsMetrics(): Map<string, SessionMetrics & { uptime: number | null; status: string }> {
    const result = new Map<string, SessionMetrics & { uptime: number | null; status: string }>();
    for (const [companyId, m] of this.metrics) {
      const session = this.sessions.get(companyId);
      const uptime = m.connectedAt ? Math.floor((Date.now() - m.connectedAt.getTime()) / 1000) : null;
      result.set(companyId, { ...m, uptime, status: session?.status.status || 'disconnected' });
    }
    return result;
  }

  async getClientForCompany(companyId: string): Promise<CompanySession> {
    const existing = this.sessions.get(companyId);
    if (existing && (existing.status.isReady || existing.status.status === 'qr_received')) {
      return existing;
    }
    if (existing?.status.status === 'disconnected') {
      await this.shutdownSession(companyId);
      await new Promise(r => setTimeout(r, 1000));
    }
    if (this.initLocks.has(companyId)) {
      return this.initLocks.get(companyId)!;
    }
    const initPromise = this.createSession(companyId);
    this.initLocks.set(companyId, initPromise);
    try {
      return await initPromise;
    } finally {
      this.initLocks.delete(companyId);
    }
  }

  private async createSession(companyId: string): Promise<CompanySession> {
    console.log(`[Baileys] Creating session for company: ${companyId}`);
    const authPath = this.getAuthPath(companyId);
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();
    const logger = P({ level: 'silent' }) as any;

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Desktop'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      markOnlineOnConnect: false,
      syncFullHistory: true,
      shouldSyncHistoryMessage: () => true,
    });

    const session: CompanySession = {
      sock,
      status: { isReady: false, isAuthenticated: false, qrCode: null, qrReceivedAt: null, status: 'disconnected' },
      saveCreds,
      selfJid: null,
      messageHandlers: new Map(),
    };

    if (!this.metrics.has(companyId)) {
      this.metrics.set(companyId, {
        connectedAt: null, lastActivityAt: null, messagesSent: 0,
        messagesReceived: 0, reconnectCount: 0, lastDisconnectReason: null
      });
    }

    this.sessions.set(companyId, session);
    this.setupEventHandlers(companyId, session);
    return session;
  }

  private setupEventHandlers(companyId: string, session: CompanySession): void {
    const { sock, saveCreds } = session;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const metrics = this.metrics.get(companyId)!;

      if (qr) {
        try {
          const qrDataUrl = await qrcode.toDataURL(qr);
          session.status = { ...session.status, qrCode: qrDataUrl, qrReceivedAt: Date.now(), status: 'qr_received' };
          console.log(`[Baileys] QR code generated for company: ${companyId}`);
        } catch (err) {
          console.error(`[Baileys] Error generating QR:`, err);
        }
      }

      if (connection === 'open') {
        session.selfJid = sock.user?.id || null;
        session.status = { isReady: true, isAuthenticated: true, qrCode: null, qrReceivedAt: null, status: 'ready' };
        metrics.connectedAt = new Date();
        metrics.lastActivityAt = new Date();
        this.reconnectAttempts.delete(companyId);
        console.log(`[Baileys] Connected for company: ${companyId}, selfJid: ${session.selfJid}`);
        this.emit('ready', { companyId });
        
        // Fetch groups after connection (workaround for missing history sync on reconnect)
        this.fetchAndStoreGroups(companyId, sock, session.selfJid).catch(err => {
          console.error(`[Baileys] Error fetching groups:`, err);
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = DisconnectReason[statusCode] || `Unknown (${statusCode})`;
        metrics.lastDisconnectReason = reason;
        session.status = { ...session.status, isReady: false, status: 'disconnected' };
        console.log(`[Baileys] Disconnected for company ${companyId}: ${reason}`);

        if (statusCode === DisconnectReason.loggedOut) {
          this.loggedOutCompanies.add(companyId);
          this.sessions.delete(companyId);
          this.deleteAuthFiles(companyId);
          this.emit('logout', { companyId });
        } else if (!this.loggedOutCompanies.has(companyId)) {
          this.scheduleReconnect(companyId);
        }
      }
    });

    sock.ev.on('messaging-history.set', async ({ chats, messages }) => {
      console.log(`[Baileys] History sync for ${companyId}: ${chats?.length || 0} chats, ${messages?.length || 0} messages`);
      if (chats?.length) {
        for (const chat of chats) {
          const chatId = chat.id;
          const isFiltered = isSystemJid(chatId, session.selfJid);
          console.log(`[Baileys] History chat: ${chatId}, selfJid: ${session.selfJid}, filtered: ${isFiltered}`);
          if (isFiltered) continue;
          await this.upsertChatToDb(companyId, chat);
          console.log(`[Baileys] Chat saved to DB: ${chatId}`);
        }
      }
      if (messages?.length) {
        for (const msg of messages as proto.IWebMessageInfo[]) {
          console.log(`[Baileys] History message from: ${msg.key?.remoteJid}, id: ${msg.key?.id}`);
        }
        await this.upsertMessagesToDb(companyId, messages as proto.IWebMessageInfo[], session.selfJid);
      }
    });

    sock.ev.on('chats.upsert', async (chats) => {
      for (const chat of chats) {
        if (isSystemJid(chat.id, session.selfJid)) continue;
        await this.upsertChatToDb(companyId, chat);
      }
    });

    sock.ev.on('chats.update', async (updates) => {
      for (const update of updates) {
        if (!update.id || isSystemJid(update.id, session.selfJid)) continue;
        await this.updateChatInDb(companyId, update.id, update);
      }
    });

    sock.ev.on('chats.delete', async (chatIds) => {
      for (const chatId of chatIds) {
        await this.archiveChatInDb(companyId, chatId);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      const metrics = this.metrics.get(companyId)!;
      metrics.lastActivityAt = new Date();

      for (const msg of messages) {
        const chatId = msg.key?.remoteJid;
        if (!chatId || isSystemJid(chatId, session.selfJid)) continue;

        await this.upsertMessageToDb(companyId, msg);
        await this.updateChatLastMessage(companyId, chatId, msg);

        if (type === 'notify' && !msg.key?.fromMe) {
          metrics.messagesReceived++;
          const content = extractMessageContent(msg);
          const senderNumber = (msg.key?.participant || msg.key?.remoteJid || '').replace(/@.*/, '');
          
          try {
            await notificationService.notifyWhatsAppMessage(companyId, {
              chatId,
              senderName: msg.pushName || senderNumber,
              senderNumber,
              messageText: content,
              hasMedia: hasMediaContent(msg),
              mediaType: getMediaType(msg),
              isGroup: isJidGroup(chatId),
            });

            broadcastWhatsAppMessage(companyId, {
              chatId,
              senderName: msg.pushName || senderNumber,
              senderNumber,
              messageText: content,
              hasMedia: hasMediaContent(msg),
              mediaType: getMediaType(msg),
              isGroup: isJidGroup(chatId),
              timestamp: new Date(),
            });
          } catch (err) {
            console.error(`[Baileys] Notification error:`, err);
          }

          for (const handler of session.messageHandlers.values()) {
            try { handler(msg); } catch (e) { console.error('[Baileys] Handler error:', e); }
          }
          this.emit('message', { companyId, message: msg });
        }
      }
    });

    sock.ev.on('messages.reaction', async (reactions) => {
      for (const { key, reaction } of reactions) {
        const messageId = key.id || '';
        const senderId = reaction.key?.participant || reaction.key?.remoteJid || '';
        const emoji = reaction.text || '';

        if (emoji === '') {
          await db.delete(whatsappReactions).where(
            and(eq(whatsappReactions.companyId, companyId), eq(whatsappReactions.messageId, messageId), eq(whatsappReactions.senderId, senderId))
          ).catch(() => {});
        } else {
          await db.insert(whatsappReactions).values({ companyId, messageId, emoji, senderId })
            .onConflictDoUpdate({ target: [whatsappReactions.companyId, whatsappReactions.messageId, whatsappReactions.senderId], set: { emoji } })
            .catch(() => {});
        }
        this.emit('message_reaction', { companyId, messageId, emoji, senderId });
      }
    });

    sock.ev.on('messages.delete', async (deletion: any) => {
      const keys = deletion.keys || (deletion.key ? [deletion.key] : []);
      for (const key of keys) {
        if (key.id) {
          await db.delete(whatsappMessages).where(
            and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, key.id))
          ).catch(() => {});
        }
      }
    });
  }

  private async fetchAndStoreGroups(companyId: string, sock: WASocket, selfJid: string | null): Promise<void> {
    try {
      console.log(`[Baileys] Fetching groups for company: ${companyId}`);
      const groups = await sock.groupFetchAllParticipating();
      
      if (groups && Object.keys(groups).length > 0) {
        console.log(`[Baileys] Found ${Object.keys(groups).length} groups for company: ${companyId}`);
        
        for (const [groupId, groupMetadata] of Object.entries(groups)) {
          if (isSystemJid(groupId, selfJid)) continue;
          
          const groupData = groupMetadata as any;
          await this.upsertChatToDb(companyId, {
            id: groupId,
            name: groupData.subject || groupId.replace('@g.us', ''),
            conversationTimestamp: groupData.subjectTime || Math.floor(Date.now() / 1000),
            unreadCount: 0,
            archived: false,
            pinned: false,
          });
        }
        console.log(`[Baileys] Stored ${Object.keys(groups).length} groups for company: ${companyId}`);
      } else {
        console.log(`[Baileys] No groups found for company: ${companyId}`);
      }
    } catch (err: any) {
      console.log(`[Baileys] Could not fetch groups:`, err?.message || err);
    }
  }

  private async upsertChatToDb(companyId: string, chat: any): Promise<void> {
    try {
      const isGroup = chat.id.endsWith('@g.us');
      const timestamp = chat.conversationTimestamp ? Number(chat.conversationTimestamp) : null;
      const lastContent = chat.lastMessage ? extractMessageContent(chat.lastMessage as WAMessage) : null;
      const lastFromMe = chat.lastMessage?.key?.fromMe ?? false;

      await db.insert(whatsappChats).values({
        companyId,
        chatId: chat.id,
        chatType: isGroup ? 'group' : 'individual',
        name: chat.name || null,
        pushName: chat.name || null,
        lastMessageTimestamp: timestamp,
        lastMessageContent: lastContent?.substring(0, 500) || null,
        lastMessageFromMe: lastFromMe,
        unreadCount: chat.unreadCount || 0,
        isArchived: chat.archived || false,
        isPinned: !!chat.pinned,
      }).onConflictDoUpdate({
        target: [whatsappChats.companyId, whatsappChats.chatId],
        set: {
          name: chat.name || null,
          lastMessageTimestamp: timestamp,
          lastMessageContent: lastContent?.substring(0, 500) || null,
          lastMessageFromMe: lastFromMe,
          unreadCount: chat.unreadCount || 0,
          isArchived: chat.archived || false,
          isPinned: !!chat.pinned,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`[Baileys] Error upserting chat:`, err);
    }
  }

  private async updateChatInDb(companyId: string, chatId: string, update: any): Promise<void> {
    try {
      const setData: any = { updatedAt: new Date() };
      if (update.unreadCount !== undefined) setData.unreadCount = update.unreadCount;
      if (update.archived !== undefined) setData.isArchived = update.archived;
      if (update.pinned !== undefined) setData.isPinned = !!update.pinned;
      if (update.conversationTimestamp) setData.lastMessageTimestamp = Number(update.conversationTimestamp);

      await db.update(whatsappChats).set(setData)
        .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, chatId)));
    } catch (err) {
      console.error(`[Baileys] Error updating chat:`, err);
    }
  }

  private async archiveChatInDb(companyId: string, chatId: string): Promise<void> {
    try {
      await db.update(whatsappChats).set({ isArchived: true, updatedAt: new Date() })
        .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, chatId)));
      console.log(`[Baileys] Archived chat ${chatId} for company ${companyId}`);
    } catch (err) {
      console.error(`[Baileys] Error archiving chat:`, err);
    }
  }

  private async upsertMessageToDb(companyId: string, msg: proto.IWebMessageInfo): Promise<void> {
    const chatId = msg.key?.remoteJid;
    const messageId = msg.key?.id;
    if (!chatId || !messageId) return;

    try {
      await db.insert(whatsappMessages).values({
        companyId,
        chatId,
        messageId,
        fromMe: msg.key?.fromMe || false,
        senderId: msg.key?.participant || msg.key?.remoteJid || null,
        text: extractMessageContent(msg)?.substring(0, 5000) || null,
        mediaType: getMediaType(msg) || null,
        mediaUrl: null,
        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000),
        quotedMessageId: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
        isForwarded: !!msg.message?.extendedTextMessage?.contextInfo?.isForwarded,
        rawData: msg as any,
      }).onConflictDoNothing();
    } catch (err) {
      // Silent fail for duplicate messages
    }
  }

  private async upsertMessagesToDb(companyId: string, messages: proto.IWebMessageInfo[], selfJid: string | null): Promise<void> {
    const values = messages
      .filter(msg => msg.key?.remoteJid && msg.key?.id && !isSystemJid(msg.key.remoteJid, selfJid))
      .map(msg => ({
        companyId,
        chatId: msg.key!.remoteJid!,
        messageId: msg.key!.id!,
        fromMe: msg.key?.fromMe || false,
        senderId: msg.key?.participant || msg.key?.remoteJid || null,
        text: extractMessageContent(msg)?.substring(0, 5000) || null,
        mediaType: getMediaType(msg) || null,
        mediaUrl: null,
        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000),
        quotedMessageId: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
        isForwarded: !!msg.message?.extendedTextMessage?.contextInfo?.isForwarded,
        rawData: msg as any,
      }));

    if (values.length === 0) return;

    try {
      for (let i = 0; i < values.length; i += 100) {
        await db.insert(whatsappMessages).values(values.slice(i, i + 100)).onConflictDoNothing();
      }
      console.log(`[Baileys] Persisted ${values.length} messages for company ${companyId}`);
    } catch (err) {
      console.error(`[Baileys] Error persisting messages:`, err);
    }
  }

  private async updateChatLastMessage(companyId: string, chatId: string, msg: proto.IWebMessageInfo): Promise<void> {
    try {
      const timestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000);
      await db.update(whatsappChats).set({
        lastMessageTimestamp: timestamp,
        lastMessageContent: extractMessageContent(msg)?.substring(0, 500) || null,
        lastMessageFromMe: msg.key?.fromMe || false,
        updatedAt: new Date(),
      }).where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, chatId)));
    } catch (err) {
      // Silent fail
    }
  }

  private scheduleReconnect(companyId: string): void {
    const timer = this.reconnectTimers.get(companyId);
    if (timer) clearTimeout(timer);

    const attempts = this.reconnectAttempts.get(companyId) || 0;
    if (attempts >= 10) {
      console.log(`[Baileys] Max reconnect attempts reached for ${companyId}`);
      this.reconnectAttempts.delete(companyId);
      return;
    }

    const delay = Math.min(2000 * Math.pow(2, attempts), 60000) + Math.floor(Math.random() * 5000);
    console.log(`[Baileys] Scheduling reconnect for ${companyId} in ${delay}ms (attempt ${attempts + 1})`);

    const newTimer = setTimeout(async () => {
      try {
        this.sessions.delete(companyId);
        await this.createSession(companyId);
        this.reconnectAttempts.delete(companyId);
        this.reconnectTimers.delete(companyId);
        const metrics = this.metrics.get(companyId);
        if (metrics) metrics.reconnectCount++;
      } catch (err) {
        console.error(`[Baileys] Reconnect failed for ${companyId}:`, err);
        this.reconnectAttempts.set(companyId, attempts + 1);
        this.scheduleReconnect(companyId);
      }
    }, delay);

    this.reconnectTimers.set(companyId, newTimer);
    this.reconnectAttempts.set(companyId, attempts + 1);
  }

  private async shutdownSession(companyId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (session) {
      try { session.sock.end(undefined); } catch {}
      this.sessions.delete(companyId);
    }
  }

  private deleteAuthFiles(companyId: string): void {
    const authPath = this.getAuthPath(companyId);
    try {
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log(`[Baileys] Auth files deleted for ${companyId}`);
      }
    } catch (err) {
      console.error(`[Baileys] Error deleting auth files:`, err);
    }
  }

  async getChats(companyId: string): Promise<any[]> {
    try {
      const chats = await db.select().from(whatsappChats)
        .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.isArchived, false)))
        .orderBy(desc(whatsappChats.lastMessageTimestamp));

      return chats.map(chat => ({
        id: { _serialized: chat.chatId },
        name: chat.name || chat.chatId.replace(/@.*/, ''),
        isGroup: chat.chatType === 'group',
        timestamp: chat.lastMessageTimestamp || 0,
        unreadCount: chat.unreadCount || 0,
        archived: chat.isArchived || false,
        pinned: chat.isPinned ? 1 : 0,
        lastMessage: chat.lastMessageContent ? {
          body: chat.lastMessageContent,
          type: 'text',
          timestamp: chat.lastMessageTimestamp || 0,
          fromMe: chat.lastMessageFromMe || false,
          hasMedia: false,
        } : null,
      }));
    } catch (err) {
      console.error(`[Baileys] Error getting chats from DB:`, err);
      return [];
    }
  }

  async getChatById(companyId: string, chatId: string): Promise<any> {
    try {
      const normalizedId = normalizeWhatsAppId(chatId);
      const [chat] = await db.select().from(whatsappChats)
        .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));

      if (!chat) return null;

      return {
        id: { _serialized: chat.chatId },
        name: chat.name || chat.chatId.replace(/@.*/, ''),
        isGroup: chat.chatType === 'group',
        timestamp: chat.lastMessageTimestamp || 0,
        unreadCount: chat.unreadCount || 0,
      };
    } catch (err) {
      console.error(`[Baileys] Error getting chat:`, err);
      return null;
    }
  }

  async getChatMessages(companyId: string, chatId: string, limit: number = 50): Promise<any[]> {
    try {
      const normalizedId = normalizeWhatsAppId(chatId);
      const messages = await db.select().from(whatsappMessages)
        .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.chatId, normalizedId)))
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(limit);

      return messages.reverse().map(msg => ({
        id: { _serialized: msg.messageId },
        from: msg.senderId || normalizedId,
        to: normalizedId,
        body: msg.text || '',
        type: msg.mediaType || 'text',
        timestamp: msg.timestamp,
        fromMe: msg.fromMe,
        hasMedia: msg.mediaType && msg.mediaType !== 'text',
      }));
    } catch (err) {
      console.error(`[Baileys] Error getting messages from DB:`, err);
      return [];
    }
  }

  async loadMessagesFromDb(companyId: string, chatId: string, limit: number = 50, before?: number): Promise<proto.IWebMessageInfo[]> {
    try {
      const conditions = [eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.chatId, chatId)];
      if (before) conditions.push(lt(whatsappMessages.timestamp, before));

      const messages = await db.select().from(whatsappMessages)
        .where(and(...conditions))
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(limit);

      return messages.map(m => m.rawData as proto.IWebMessageInfo).filter(Boolean).reverse();
    } catch (err) {
      console.error(`[Baileys] Error loading messages from DB:`, err);
      return [];
    }
  }

  async getContacts(companyId: string): Promise<any[]> {
    const chats = await this.getChats(companyId);
    return chats.filter(c => !c.isGroup).map(c => ({
      id: c.id,
      name: c.name,
      number: c.id._serialized.replace(/@.*/, ''),
      isGroup: false,
    }));
  }

  async sendMessage(companyId: string, to: string, message: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const normalizedId = normalizeWhatsAppId(to);
    try {
      const result = await session.sock.sendMessage(normalizedId, { text: message });
      const metrics = this.metrics.get(companyId);
      if (metrics) metrics.messagesSent++;

      const sentMsg: proto.IWebMessageInfo = {
        key: result?.key,
        message: { conversation: message },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: session.sock.user?.name,
      };
      await this.upsertMessageToDb(companyId, sentMsg);
      await this.updateChatLastMessage(companyId, normalizedId, sentMsg);

      return {
        id: { _serialized: result?.key.id || '' },
        from: session.sock.user?.id || '',
        to: normalizedId,
        body: message,
        timestamp: Date.now() / 1000,
        fromMe: true,
      };
    } catch (err) {
      console.error(`[Baileys] Error sending message:`, err);
      throw err;
    }
  }

  async sendMedia(companyId: string, to: string, mediaBuffer: Buffer, options: { mimetype: string; filename?: string; caption?: string }): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const normalizedId = normalizeWhatsAppId(to);
    const { mimetype, filename, caption } = options;

    try {
      let messageContent: any;
      if (mimetype.startsWith('image/')) {
        messageContent = { image: mediaBuffer, caption, mimetype };
      } else if (mimetype.startsWith('video/')) {
        messageContent = { video: mediaBuffer, caption, mimetype };
      } else if (mimetype.startsWith('audio/')) {
        messageContent = { audio: mediaBuffer, mimetype, ptt: mimetype.includes('ogg') };
      } else {
        messageContent = { document: mediaBuffer, mimetype, fileName: filename || 'file' };
      }

      const result = await session.sock.sendMessage(normalizedId, messageContent);
      const metrics = this.metrics.get(companyId);
      if (metrics) metrics.messagesSent++;

      if (result?.key.id) {
        this.sentMediaCache.set(result.key.id, { mimetype, data: mediaBuffer.toString('base64') });
        if (this.sentMediaCache.size > 100) {
          const firstKey = this.sentMediaCache.keys().next().value;
          if (firstKey) this.sentMediaCache.delete(firstKey);
        }
      }

      return {
        id: { _serialized: result?.key.id || '' },
        from: session.sock.user?.id || '',
        to: normalizedId,
        body: caption || '',
        timestamp: Date.now() / 1000,
        fromMe: true,
        hasMedia: true,
        type: mimetype.startsWith('image/') ? 'image' : mimetype.startsWith('video/') ? 'video' : mimetype.startsWith('audio/') ? 'audio' : 'document',
      };
    } catch (err) {
      console.error(`[Baileys] Error sending media:`, err);
      throw err;
    }
  }

  async replyMessage(companyId: string, messageId: string, content: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const [dbMsg] = await db.select().from(whatsappMessages)
      .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, messageId)));

    if (!dbMsg?.rawData) throw new Error('Message not found');

    const quoted = dbMsg.rawData as WAMessage;
    const chatId = quoted.key?.remoteJid;
    if (!chatId) throw new Error('Invalid message');

    const result = await session.sock.sendMessage(chatId, { text: content }, { quoted });
    return {
      id: { _serialized: result?.key.id || '' },
      from: session.sock.user?.id || '',
      to: chatId,
      body: content,
      timestamp: Date.now() / 1000,
      fromMe: true,
    };
  }

  async markChatAsRead(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const normalizedId = normalizeWhatsAppId(chatId);
    try {
      await session.sock.readMessages([{ remoteJid: normalizedId, id: undefined as any, participant: undefined }]);
      await db.update(whatsappChats).set({ unreadCount: 0, updatedAt: new Date() })
        .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));
    } catch (err) {
      console.error(`[Baileys] Error marking as read:`, err);
      throw err;
    }
  }

  async sendSeen(companyId: string, chatId: string): Promise<void> {
    return this.markChatAsRead(companyId, chatId);
  }

  async getProfilePicUrl(companyId: string, contactId: string): Promise<string | null> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) return null;

    try {
      return await session.sock.profilePictureUrl(normalizeWhatsAppId(contactId), 'image') || null;
    } catch {
      return null;
    }
  }

  async downloadMedia(companyId: string, messageId: string, chatId?: string): Promise<{ mimetype: string; data: string } | null> {
    const cached = this.sentMediaCache.get(messageId);
    if (cached) return cached;

    const [dbMsg] = await db.select().from(whatsappMessages)
      .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, messageId)));

    if (!dbMsg?.rawData) throw new Error('Message not found');

    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const msg = dbMsg.rawData as WAMessage;
    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
        logger: P({ level: 'silent' }) as any,
        reuploadRequest: session.sock.updateMediaMessage,
      });

      const messageContent = msg.message;
      let mimetype = 'application/octet-stream';
      if (messageContent?.imageMessage) mimetype = messageContent.imageMessage.mimetype || 'image/jpeg';
      else if (messageContent?.videoMessage) mimetype = messageContent.videoMessage.mimetype || 'video/mp4';
      else if (messageContent?.audioMessage) mimetype = messageContent.audioMessage.mimetype || 'audio/ogg';
      else if (messageContent?.documentMessage) mimetype = messageContent.documentMessage.mimetype || 'application/octet-stream';
      else if (messageContent?.stickerMessage) mimetype = messageContent.stickerMessage.mimetype || 'image/webp';

      return { mimetype, data: (buffer as Buffer).toString('base64') };
    } catch (err) {
      console.error(`[Baileys] Error downloading media:`, err);
      throw err;
    }
  }

  async forwardMessage(companyId: string, messageId: string, chatId: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const [dbMsg] = await db.select().from(whatsappMessages)
      .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, messageId)));

    if (!dbMsg?.rawData) throw new Error('Message not found');

    const msg = dbMsg.rawData as WAMessage;
    const normalizedChatId = normalizeWhatsAppId(chatId);

    const result = await session.sock.sendMessage(normalizedChatId, { forward: msg });
    return {
      id: { _serialized: result?.key.id || '' },
      from: session.sock.user?.id || '',
      to: normalizedChatId,
      timestamp: Date.now() / 1000,
      fromMe: true,
    };
  }

  async deleteMessage(companyId: string, messageId: string, forEveryone: boolean = false): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const [dbMsg] = await db.select().from(whatsappMessages)
      .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, messageId)));

    if (!dbMsg?.rawData) throw new Error('Message not found');

    const msg = dbMsg.rawData as WAMessage;
    const chatId = msg.key?.remoteJid;
    if (!chatId) throw new Error('Invalid message');

    if (forEveryone) {
      await session.sock.sendMessage(chatId, { delete: msg.key as proto.IMessageKey });
    } else {
      await session.sock.chatModify({ clear: { messages: [{ id: msg.key?.id!, fromMe: msg.key?.fromMe || false, timestamp: Number(msg.messageTimestamp) }] } }, chatId);
    }

    await db.delete(whatsappMessages).where(
      and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, messageId))
    );
  }

  async reactToMessage(companyId: string, messageId: string, emoji: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const [dbMsg] = await db.select().from(whatsappMessages)
      .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, messageId)));

    if (!dbMsg?.rawData) throw new Error('Message not found');

    const msg = dbMsg.rawData as WAMessage;
    await session.sock.sendMessage(msg.key?.remoteJid!, { react: { text: emoji, key: msg.key as proto.IMessageKey } });

    const myId = session.sock.user?.id || '';
    if (emoji) {
      await db.insert(whatsappReactions).values({ companyId, messageId, emoji, senderId: myId })
        .onConflictDoUpdate({ target: [whatsappReactions.companyId, whatsappReactions.messageId, whatsappReactions.senderId], set: { emoji } });
    } else {
      await db.delete(whatsappReactions).where(
        and(eq(whatsappReactions.companyId, companyId), eq(whatsappReactions.messageId, messageId), eq(whatsappReactions.senderId, myId))
      );
    }
  }

  getCachedReactions(companyId: string, messageId: string): Array<{ emoji: string; senderId: string }> {
    return [];
  }

  async getReactionsFromDb(companyId: string, messageId: string): Promise<Array<{ emoji: string; senderId: string }>> {
    const reactions = await db.select().from(whatsappReactions)
      .where(and(eq(whatsappReactions.companyId, companyId), eq(whatsappReactions.messageId, messageId)));
    return reactions.map(r => ({ emoji: r.emoji, senderId: r.senderId }));
  }

  async sendTyping(companyId: string, chatId: string, duration: number = 5000): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.sendPresenceUpdate('composing', normalizedId);
    if (duration > 0) {
      setTimeout(() => {
        session.sock.sendPresenceUpdate('paused', normalizedId).catch(() => {});
      }, duration);
    }
  }

  async stopTyping(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.sendPresenceUpdate('paused', normalizeWhatsAppId(chatId));
  }

  async sendRecording(companyId: string, chatId: string, duration: number = 5000): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.sendPresenceUpdate('recording', normalizedId);
    if (duration > 0) {
      setTimeout(() => {
        session.sock.sendPresenceUpdate('paused', normalizedId).catch(() => {});
      }, duration);
    }
  }

  async getPresence(companyId: string, chatId: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) return null;
    try {
      await session.sock.presenceSubscribe(normalizeWhatsAppId(chatId));
      return { isOnline: false, lastSeen: null };
    } catch {
      return null;
    }
  }

  async isRegisteredUser(companyId: string, phoneNumber: string): Promise<boolean> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    try {
      const results = await session.sock.onWhatsApp(phoneNumber.replace(/\D/g, ''));
      return results?.[0]?.exists || false;
    } catch {
      return false;
    }
  }

  async getNumberId(companyId: string, phoneNumber: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    try {
      const results = await session.sock.onWhatsApp(phoneNumber.replace(/\D/g, ''));
      if (results?.[0]?.exists) {
        return { _serialized: results[0].jid, user: phoneNumber.replace(/\D/g, '') };
      }
      return null;
    } catch {
      return null;
    }
  }

  async getMyProfile(companyId: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const user = session.sock.user;
    if (!user) throw new Error('User info not available');

    const wid = user.id;
    const phoneNumber = wid.replace(/@s\.whatsapp\.net$/, '').replace(/:\d+$/, '');
    let profilePicUrl: string | null = null;
    try { profilePicUrl = await session.sock.profilePictureUrl(wid, 'image') || null; } catch {}

    return { wid, pushname: user.name || '', profilePicUrl, phoneNumber };
  }

  async getContactProfile(companyId: string, contactId: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');

    const normalizedId = normalizeWhatsAppId(contactId);
    const number = normalizedId.replace(/@.*/, '');

    let profilePicUrl: string | null = null;
    try { profilePicUrl = await session.sock.profilePictureUrl(normalizedId, 'image') || null; } catch {}

    return {
      id: normalizedId,
      name: number,
      number,
      profilePicUrl,
      isBlocked: false,
      isBusiness: false,
      pushname: null,
    };
  }

  async getContactInfo(companyId: string, contactId: string): Promise<any> {
    return this.getContactProfile(companyId, contactId);
  }

  async archiveChat(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.chatModify({ archive: true, lastMessages: [] }, normalizedId);
    await this.archiveChatInDb(companyId, normalizedId);
  }

  async unarchiveChat(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.chatModify({ archive: false, lastMessages: [] }, normalizedId);
    await db.update(whatsappChats).set({ isArchived: false, updatedAt: new Date() })
      .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));
  }

  async pinChat(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.chatModify({ pin: true }, normalizedId);
    await db.update(whatsappChats).set({ isPinned: true, updatedAt: new Date() })
      .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));
  }

  async unpinChat(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.chatModify({ pin: false }, normalizedId);
    await db.update(whatsappChats).set({ isPinned: false, updatedAt: new Date() })
      .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));
  }

  async muteChat(companyId: string, chatId: string, muteExpiration?: number): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    const expiration = muteExpiration || Math.floor(Date.now() / 1000) + (8 * 60 * 60);
    await session.sock.chatModify({ mute: expiration }, normalizedId);
    await db.update(whatsappChats).set({ muteExpiration: expiration, updatedAt: new Date() })
      .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));
  }

  async unmuteChat(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.chatModify({ mute: null }, normalizedId);
    await db.update(whatsappChats).set({ muteExpiration: null, updatedAt: new Date() })
      .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));
  }

  async deleteChat(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    try {
      await session.sock.chatModify({ delete: true, lastMessages: [] }, normalizedId);
    } catch {}
    await this.archiveChatInDb(companyId, normalizedId);
  }

  async clearChat(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.chatModify({ clear: { messages: [] } }, normalizedId);
    await db.delete(whatsappMessages).where(
      and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.chatId, normalizedId))
    );
  }

  async markChatAsUnread(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    await session.sock.chatModify({ markRead: false, lastMessages: [] }, normalizedId);
    await db.update(whatsappChats).set({ unreadCount: 1, updatedAt: new Date() })
      .where(and(eq(whatsappChats.companyId, companyId), eq(whatsappChats.chatId, normalizedId)));
  }

  async starMessage(companyId: string, messageId: string): Promise<void> {
    console.log(`[Baileys] Star message not fully supported, messageId: ${messageId}`);
  }

  async unstarMessage(companyId: string, messageId: string): Promise<void> {
    console.log(`[Baileys] Unstar message not fully supported, messageId: ${messageId}`);
  }

  async sendLocation(companyId: string, chatId: string, latitude: number, longitude: number, name?: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    const result = await session.sock.sendMessage(normalizedId, { location: { degreesLatitude: latitude, degreesLongitude: longitude, name } });
    return { id: { _serialized: result?.key.id || '' }, timestamp: Date.now() / 1000, fromMe: true };
  }

  async sendContactCard(companyId: string, chatId: string, contactVCard: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    const normalizedId = normalizeWhatsAppId(chatId);
    const result = await session.sock.sendMessage(normalizedId, { contacts: { displayName: 'Contact', contacts: [{ vcard: contactVCard }] } });
    return { id: { _serialized: result?.key.id || '' }, timestamp: Date.now() / 1000, fromMe: true };
  }

  async createGroup(companyId: string, title: string, participants: string[]): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    return await session.sock.groupCreate(title, participants.map(normalizeWhatsAppId));
  }

  async addParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.groupParticipantsUpdate(normalizeWhatsAppId(chatId), participants.map(normalizeWhatsAppId), 'add');
  }

  async removeParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.groupParticipantsUpdate(normalizeWhatsAppId(chatId), participants.map(normalizeWhatsAppId), 'remove');
  }

  async promoteParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.groupParticipantsUpdate(normalizeWhatsAppId(chatId), participants.map(normalizeWhatsAppId), 'promote');
  }

  async demoteParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.groupParticipantsUpdate(normalizeWhatsAppId(chatId), participants.map(normalizeWhatsAppId), 'demote');
  }

  async leaveGroup(companyId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.groupLeave(normalizeWhatsAppId(chatId));
  }

  async getGroupInviteCode(companyId: string, chatId: string): Promise<string> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    return await session.sock.groupInviteCode(normalizeWhatsAppId(chatId)) || '';
  }

  async revokeGroupInvite(companyId: string, chatId: string): Promise<string> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    return await session.sock.groupRevokeInvite(normalizeWhatsAppId(chatId)) || '';
  }

  async setGroupSubject(companyId: string, chatId: string, subject: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.groupUpdateSubject(normalizeWhatsAppId(chatId), subject);
  }

  async setGroupDescription(companyId: string, chatId: string, description: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    await session.sock.groupUpdateDescription(normalizeWhatsAppId(chatId), description);
  }

  async getGroupMetadata(companyId: string, chatId: string): Promise<any> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) throw new Error('WhatsApp client is not ready');
    return await session.sock.groupMetadata(normalizeWhatsAppId(chatId));
  }

  async logout(companyId: string): Promise<void> {
    console.log(`[Baileys] Logging out company: ${companyId}`);
    this.loggedOutCompanies.add(companyId);

    const timer = this.reconnectTimers.get(companyId);
    if (timer) { clearTimeout(timer); this.reconnectTimers.delete(companyId); }
    this.reconnectAttempts.delete(companyId);

    const session = this.sessions.get(companyId);
    if (session) {
      try { await session.sock.logout(); } catch {}
      try { session.sock.end(undefined); } catch {}
      this.sessions.delete(companyId);
    }

    this.deleteAuthFiles(companyId);
    this.emit('logout', { companyId });
  }

  async destroy(companyId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (session) {
      try { session.sock.end(undefined); } catch {}
      this.sessions.delete(companyId);
    }
  }

  async destroyAll(): Promise<void> {
    for (const companyId of this.sessions.keys()) {
      await this.destroy(companyId);
    }
  }

  async restartClientForCompany(companyId: string, force: boolean = false): Promise<CompanySession> {
    const existing = this.sessions.get(companyId);
    if (existing && !force && existing.status.status === 'qr_received') {
      return existing;
    }
    await this.destroy(companyId);
    await new Promise(r => setTimeout(r, 2000));
    return await this.getClientForCompany(companyId);
  }

  onMessageHandler(companyId: string, handlerId: string, handler: (message: any) => void): void {
    this.sessions.get(companyId)?.messageHandlers.set(handlerId, handler);
  }

  offMessageHandler(companyId: string, handlerId: string): void {
    this.sessions.get(companyId)?.messageHandlers.delete(handlerId);
  }

  async searchMessages(companyId: string, query: string, chatId?: string, limit: number = 50): Promise<any[]> {
    try {
      const conditions = [eq(whatsappMessages.companyId, companyId)];
      if (chatId) conditions.push(eq(whatsappMessages.chatId, normalizeWhatsAppId(chatId)));

      const messages = await db.select().from(whatsappMessages)
        .where(and(...conditions))
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(500);

      const queryLower = query.toLowerCase();
      return messages
        .filter(m => m.text?.toLowerCase().includes(queryLower))
        .slice(0, limit)
        .map(m => ({
          id: { _serialized: m.messageId },
          chatId: m.chatId,
          body: m.text || '',
          timestamp: m.timestamp,
          fromMe: m.fromMe,
        }));
    } catch (err) {
      console.error(`[Baileys] Search error:`, err);
      return [];
    }
  }

  async getPollVotes(companyId: string, messageId: string): Promise<any[]> {
    return [];
  }

  async getMessageById(companyId: string, messageId: string): Promise<any> {
    const [dbMsg] = await db.select().from(whatsappMessages)
      .where(and(eq(whatsappMessages.companyId, companyId), eq(whatsappMessages.messageId, messageId)));

    if (!dbMsg) throw new Error('Message not found');

    return {
      id: { _serialized: dbMsg.messageId },
      from: dbMsg.senderId,
      to: dbMsg.chatId,
      body: dbMsg.text || '',
      type: dbMsg.mediaType || 'text',
      timestamp: dbMsg.timestamp,
      fromMe: dbMsg.fromMe,
      hasMedia: dbMsg.mediaType && dbMsg.mediaType !== 'text',
    };
  }

  async getChatContact(companyId: string, chatId: string): Promise<any> {
    return this.getContactProfile(companyId, chatId);
  }

  async syncHistory(companyId: string, chatId?: string): Promise<void> {
    console.log(`[Baileys] Manual sync requested for ${companyId}${chatId ? `, chat: ${chatId}` : ''}`);
  }

  async clearState(companyId: string, chatId?: string): Promise<void> {
    console.log(`[Baileys] Clear state requested for ${companyId}${chatId ? `, chat: ${chatId}` : ''}`);
  }

  async getChannels(companyId: string): Promise<any[]> { return []; }
  async createChannel(companyId: string, title: string, options?: any): Promise<any> { throw new Error('Channels not supported'); }
  async deleteChannel(companyId: string, channelId: string): Promise<void> {}
  async getChannelByInviteCode(companyId: string, inviteCode: string): Promise<any> { return null; }
  async searchChannels(companyId: string, options: any): Promise<any[]> { return []; }
  async subscribeToChannel(companyId: string, channelId: string): Promise<any> { return null; }
  async unsubscribeFromChannel(companyId: string, channelId: string): Promise<any> { return null; }
  async getChannelMessages(companyId: string, channelId: string, limit?: number): Promise<any[]> { return []; }
  async sendChannelMessage(companyId: string, channelId: string, content: any): Promise<any> { return null; }
  async sendChannelSeen(companyId: string, channelId: string): Promise<void> {}
  async setChannelSubject(companyId: string, channelId: string, subject: string): Promise<void> {}
  async setChannelDescription(companyId: string, channelId: string, description: string): Promise<void> {}
  async setChannelPicture(companyId: string, channelId: string, media: any): Promise<void> {}
  async setChannelReactionSetting(companyId: string, channelId: string, reactionCode: number): Promise<void> {}
  async muteChannel(companyId: string, channelId: string): Promise<void> {}
  async unmuteChannel(companyId: string, channelId: string): Promise<void> {}
  async getChannelSubscribers(companyId: string, channelId: string, limit?: number): Promise<any[]> { return []; }
  async sendChannelAdminInvite(companyId: string, channelId: string, chatId: string): Promise<any> { return null; }
  async acceptChannelAdminInvite(companyId: string, channelId: string): Promise<any> { return null; }
  async revokeChannelAdminInvite(companyId: string, channelId: string, userId: string): Promise<any> { return null; }
  async demoteChannelAdmin(companyId: string, channelId: string, userId: string): Promise<any> { return null; }
  async transferChannelOwnership(companyId: string, channelId: string, newOwnerId: string): Promise<any> { return null; }
  async getBroadcasts(companyId: string): Promise<any[]> { return []; }
  async getBroadcastChat(companyId: string, broadcastId: string): Promise<any> { return null; }
  async getBroadcastContact(companyId: string, broadcastId: string): Promise<any> { return null; }
  async getCallHistory(companyId: string, limit?: number): Promise<any[]> { return []; }
  async rejectCall(companyId: string, callId: string): Promise<void> {}
  async setAutoDownloadAudio(companyId: string, enabled: boolean): Promise<void> {}
  async setAutoDownloadDocuments(companyId: string, enabled: boolean): Promise<void> {}
  async setAutoDownloadPhotos(companyId: string, enabled: boolean): Promise<void> {}
  async setAutoDownloadVideos(companyId: string, enabled: boolean): Promise<void> {}
  async validateAndGetNumberId(companyId: string, phoneNumber: string): Promise<{ isValid: boolean; whatsappId: string | null; formattedNumber: string }> {
    const id = await this.getNumberId(companyId, phoneNumber);
    return { isValid: !!id, whatsappId: id?._serialized || null, formattedNumber: phoneNumber.replace(/\D/g, '') };
  }

  autoConnectSavedSessions(): void {
    console.log('[Baileys] Sessions will connect on-demand');
  }

  startConnectionHealthCheck(): void {
    setInterval(() => {
      if (this.sessions.size > 0) {
        console.log(`[Baileys] Health check: ${this.sessions.size} active sessions`);
      }
    }, 60000);
  }

  shutdownAllClients(): Promise<void> {
    return this.destroyAll();
  }

  shutdownClientForCompany(companyId: string): Promise<void> {
    return this.destroy(companyId);
  }

  getSavedSessionCompanyIds(): string[] {
    try {
      if (!fs.existsSync(this.AUTH_DIR)) return [];
      return fs.readdirSync(this.AUTH_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch {
      return [];
    }
  }

  async updateReactionCache(companyId: string, messageId: string, emoji: string, senderId: string): Promise<void> {
    if (emoji) {
      await db.insert(whatsappReactions).values({ companyId, messageId, emoji, senderId })
        .onConflictDoUpdate({ target: [whatsappReactions.companyId, whatsappReactions.messageId, whatsappReactions.senderId], set: { emoji } })
        .catch(() => {});
    } else {
      await db.delete(whatsappReactions).where(
        and(eq(whatsappReactions.companyId, companyId), eq(whatsappReactions.messageId, messageId), eq(whatsappReactions.senderId, senderId))
      ).catch(() => {});
    }
  }
}

export const whatsappBaileysService = new WhatsAppBaileysService();
