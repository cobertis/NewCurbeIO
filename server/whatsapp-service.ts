import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  proto,
  downloadMediaMessage,
  jidNormalizedUser,
  isJidGroup,
  WAMessage,
  Browsers,
  makeCacheableSignalKeyStore,
  WAMessageKey,
  WAMessageContent,
} from '@whiskeysockets/baileys';
import { useBaileysAuthState } from 'baileysauth';
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode';
import { EventEmitter } from 'events';
import { db } from './db';
import { 
  whatsappChats, 
  whatsappMessages,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import NodeCache from '@cacheable/node-cache';
import type { CacheStore } from '@whiskeysockets/baileys';

// Database URL for baileysauth
const DATABASE_URL = process.env.DATABASE_URL || '';

interface SessionStatus {
  isReady: boolean;
  isAuthenticated: boolean;
  qrCode: string | null;
  qrDataUrl: string | null;
  status: 'disconnected' | 'qr_received' | 'authenticated' | 'ready';
  hasSavedSession: boolean;
}

interface CompanySession {
  sock: WASocket;
  status: SessionStatus;
  saveCreds: () => Promise<void>;
  wipeCreds: () => Promise<void>;
  selfJid: string | null;
  companyId: string;
}

class WhatsAppService extends EventEmitter {
  private sessions: Map<string, CompanySession> = new Map();
  private initMutex: Map<string, Promise<CompanySession>> = new Map();
  private logger = P({ level: 'warn' });
  // Keep retry counter cache outside socket to prevent loops across restarts
  // As per official Baileys example: external map to store retry counts of messages
  // when decryption/encryption fails - keep this out of the socket itself
  private msgRetryCounterCache: CacheStore = new NodeCache();
  
  async getClientForCompany(companyId: string): Promise<CompanySession | null> {
    if (this.sessions.has(companyId)) {
      return this.sessions.get(companyId)!;
    }
    return null;
  }
  
  async hasSavedSession(companyId: string): Promise<boolean> {
    // Check if we have an active session first
    const existing = this.sessions.get(companyId);
    if (existing?.status.isAuthenticated) {
      return true;
    }
    
    // Check database for saved auth state using baileysauth
    try {
      const sessionId = `wa_${companyId}`;
      const { state } = await useBaileysAuthState(DATABASE_URL, sessionId);
      return !!(state.creds?.me?.id);
    } catch (error) {
      console.log(`[WhatsApp] Error checking saved session:`, error);
      return false;
    }
  }
  
  private async closeExistingSocket(companyId: string): Promise<void> {
    const existing = this.sessions.get(companyId);
    if (existing?.sock) {
      console.log(`[WhatsApp] Closing existing socket for company ${companyId}`);
      try {
        existing.sock.ev.removeAllListeners();
        existing.sock.end(undefined);
      } catch (e) {
        console.log(`[WhatsApp] Error closing socket:`, e);
      }
      this.sessions.delete(companyId);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  async initializeClient(companyId: string): Promise<CompanySession> {
    // Use mutex to prevent concurrent initialization
    const existingMutex = this.initMutex.get(companyId);
    if (existingMutex) {
      console.log(`[WhatsApp] Waiting for existing initialization for company ${companyId}`);
      return existingMutex;
    }
    
    const existing = this.sessions.get(companyId);
    if (existing?.status.isReady) {
      return existing;
    }
    
    const initPromise = this.doInitializeClient(companyId);
    this.initMutex.set(companyId, initPromise);
    
    try {
      return await initPromise;
    } finally {
      this.initMutex.delete(companyId);
    }
  }
  
  private async doInitializeClient(companyId: string): Promise<CompanySession> {
    await this.closeExistingSocket(companyId);
    
    try {
      console.log(`[WhatsApp] Initializing client for company ${companyId}`);
      
      // Use baileysauth library for PostgreSQL auth state
      // Session ID format: wa_<companyId>
      const sessionId = `wa_${companyId}`;
      const { saveCreds, wipeCreds, state } = await useBaileysAuthState(DATABASE_URL, sessionId);
      
      const hasSavedSession = !!(state.creds?.me?.id);
      console.log(`[WhatsApp] Auth state loaded, hasSavedSession: ${hasSavedSession}`);
      
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`[WhatsApp] Using WA v${version.join('.')}, isLatest: ${isLatest}`);
      
      const sock = makeWASocket({
        version,
        logger: this.logger,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger),
        },
        msgRetryCounterCache: this.msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        getMessage: this.getMessage.bind(this, companyId),
      });
      
      const session: CompanySession = {
        sock,
        status: {
          isReady: false,
          isAuthenticated: hasSavedSession,
          qrCode: null,
          qrDataUrl: null,
          status: hasSavedSession ? 'authenticated' : 'disconnected',
          hasSavedSession,
        },
        saveCreds,
        wipeCreds,
        selfJid: state.creds?.me?.id || null,
        companyId,
      };
      
      this.sessions.set(companyId, session);
      
      // Use the official Baileys pattern with ev.process for batch event handling
      sock.ev.process(async (events) => {
        // Connection updates
        if (events['connection.update']) {
          const update = events['connection.update'];
          const { connection, lastDisconnect, qr } = update;
          
          if (qr) {
            console.log(`[WhatsApp] QR code received for company ${companyId}`);
            session.status.qrCode = qr;
            session.status.qrDataUrl = await qrcode.toDataURL(qr);
            session.status.status = 'qr_received';
            this.emit('qr', { companyId, qr, qrDataUrl: session.status.qrDataUrl });
          }
          
          if (connection === 'close') {
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
            console.log(`[WhatsApp] Connection closed for company ${companyId}, reason: ${reason}`);
            
            session.status.isReady = false;
            session.status.status = 'disconnected';
            
            if (reason === DisconnectReason.loggedOut) {
              console.log(`[WhatsApp] Logged out, clearing session for company ${companyId}`);
              await wipeCreds();
              this.sessions.delete(companyId);
              session.status = {
                isReady: false,
                isAuthenticated: false,
                qrCode: null,
                qrDataUrl: null,
                status: 'disconnected',
                hasSavedSession: false,
              };
              this.emit('logout', { companyId });
            } else {
              // Reconnect if not logged out
              console.log(`[WhatsApp] Reconnecting for company ${companyId}...`);
              setTimeout(() => {
                this.initializeClient(companyId).catch(console.error);
              }, 3000);
            }
          }
          
          if (connection === 'open') {
            console.log(`[WhatsApp] Connected successfully for company ${companyId}`);
            session.status.isReady = true;
            session.status.isAuthenticated = true;
            session.status.status = 'ready';
            session.status.qrCode = null;
            session.status.qrDataUrl = null;
            session.selfJid = sock.user?.id || null;
            this.emit('ready', { companyId, selfJid: session.selfJid });
          }
        }
        
        // Credentials updated - save them
        if (events['creds.update']) {
          await saveCreds();
        }
        
        // History received - this is where chats and messages come from
        if (events['messaging-history.set']) {
          const { chats, contacts, messages, isLatest, progress, syncType } = events['messaging-history.set'];
          console.log(`[WhatsApp] History sync: ${chats.length} chats, ${contacts.length} contacts, ${messages.length} msgs (isLatest: ${isLatest}, progress: ${progress}%, syncType: ${syncType})`);
          
          // Save chats from history
          for (const chat of chats) {
            try {
              await this.persistChat(companyId, chat);
            } catch (error) {
              console.error(`[WhatsApp] Error saving chat from history:`, error);
            }
          }
          
          // Save messages from history
          for (const msg of messages) {
            try {
              await this.persistMessage(companyId, msg);
            } catch (error) {
              console.error(`[WhatsApp] Error saving message from history:`, error);
            }
          }
        }
        
        // New messages received
        if (events['messages.upsert']) {
          const upsert = events['messages.upsert'];
          console.log(`[WhatsApp] Messages upsert: ${upsert.messages.length} messages, type: ${upsert.type}`);
          
          for (const msg of upsert.messages) {
            if (!msg.message) continue;
            
            try {
              await this.persistMessage(companyId, msg);
              this.emit('message', { companyId, message: msg });
            } catch (error) {
              console.error(`[WhatsApp] Error persisting message:`, error);
            }
          }
        }
        
        // Chat updates
        if (events['chats.upsert']) {
          const chats = events['chats.upsert'];
          console.log(`[WhatsApp] Chats upsert: ${chats.length} chats`);
          
          for (const chat of chats) {
            try {
              await this.persistChat(companyId, chat);
            } catch (error) {
              console.error(`[WhatsApp] Error saving chat:`, error);
            }
          }
        }
        
        if (events['chats.update']) {
          for (const update of events['chats.update']) {
            try {
              const updateData: any = { updatedAt: new Date() };
              
              if (update.unreadCount !== undefined) updateData.unreadCount = update.unreadCount;
              if (update.archived !== undefined) updateData.isArchived = update.archived;
              if (update.pinned !== undefined) updateData.isPinned = update.pinned ? true : false;
              if (update.conversationTimestamp) updateData.lastMessageTimestamp = Number(update.conversationTimestamp);
              
              await db.update(whatsappChats)
                .set(updateData)
                .where(and(
                  eq(whatsappChats.companyId, companyId),
                  eq(whatsappChats.chatId, update.id!)
                ));
            } catch (error) {
              console.error(`[WhatsApp] Error updating chat:`, error);
            }
          }
        }
        
        // Contacts updates
        if (events['contacts.update']) {
          for (const contact of events['contacts.update']) {
            try {
              if (contact.id && contact.notify) {
                await db.update(whatsappChats)
                  .set({ name: contact.notify, updatedAt: new Date() })
                  .where(and(
                    eq(whatsappChats.companyId, companyId),
                    eq(whatsappChats.chatId, contact.id)
                  ));
              }
            } catch (error) {
              console.error(`[WhatsApp] Error updating contact:`, error);
            }
          }
        }
      });
      
      return session;
    } catch (error) {
      console.error(`[WhatsApp] Error initializing client:`, error);
      throw error;
    }
  }
  
  // getMessage for retry logic
  private async getMessage(companyId: string, key: WAMessageKey): Promise<WAMessageContent | undefined> {
    const msg = await db.select()
      .from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.companyId, companyId),
        eq(whatsappMessages.messageId, key.id || '')
      ))
      .limit(1);
    
    if (msg.length > 0 && msg[0].rawData) {
      return (msg[0].rawData as any).message;
    }
    
    // Return empty message for retry
    return proto.Message.fromObject({});
  }
  
  private async persistChat(companyId: string, chat: any): Promise<void> {
    const chatId = chat.id;
    const isGroup = isJidGroup(chatId);
    const timestamp = chat.conversationTimestamp ? Number(chat.conversationTimestamp) : 
                     chat.lastMsgTimestamp ? Number(chat.lastMsgTimestamp) : 
                     Math.floor(Date.now() / 1000);
    
    await db.insert(whatsappChats)
      .values({
        companyId,
        chatId,
        name: chat.name || null,
        chatType: isGroup ? 'group' : 'individual',
        unreadCount: chat.unreadCount || 0,
        lastMessageTimestamp: timestamp,
        isArchived: chat.archived || false,
        isPinned: chat.pinned ? true : false,
      })
      .onConflictDoUpdate({
        target: [whatsappChats.companyId, whatsappChats.chatId],
        set: {
          name: chat.name || sql`${whatsappChats.name}`,
          unreadCount: chat.unreadCount || 0,
          lastMessageTimestamp: timestamp,
          isArchived: chat.archived || false,
          isPinned: chat.pinned ? true : false,
          updatedAt: new Date(),
        },
      });
  }
  
  private async persistMessage(companyId: string, msg: WAMessage): Promise<void> {
    const chatId = msg.key.remoteJid;
    if (!chatId) return;
    
    const isGroup = isJidGroup(chatId);
    const isFromMe = msg.key.fromMe || false;
    const senderJid = isGroup 
      ? (msg.key.participant || chatId)
      : (isFromMe ? 'me' : chatId);
    
    // Extract message content
    let content = '';
    let mediaType: string | null = null;
    let mediaUrl: string | null = null;
    
    const message = msg.message;
    if (message) {
      if (message.conversation) {
        content = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        content = message.extendedTextMessage.text;
      } else if (message.imageMessage) {
        content = message.imageMessage.caption || '[Image]';
        mediaType = 'image';
      } else if (message.videoMessage) {
        content = message.videoMessage.caption || '[Video]';
        mediaType = 'video';
      } else if (message.audioMessage) {
        content = '[Audio]';
        mediaType = 'audio';
      } else if (message.documentMessage) {
        content = message.documentMessage.fileName || '[Document]';
        mediaType = 'document';
      } else if (message.stickerMessage) {
        content = '[Sticker]';
        mediaType = 'sticker';
      } else if (message.reactionMessage) {
        content = message.reactionMessage.text || '';
        mediaType = 'reaction';
      }
    }
    
    const timestamp = msg.messageTimestamp 
      ? (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp))
      : Math.floor(Date.now() / 1000);
    
    // Insert message
    await db.insert(whatsappMessages)
      .values({
        companyId,
        chatId,
        messageId: msg.key.id || '',
        senderJid,
        content,
        mediaType,
        mediaUrl,
        isFromMe,
        timestamp,
        rawData: msg as any,
      })
      .onConflictDoNothing();
    
    // Update chat with last message
    await db.update(whatsappChats)
      .set({
        lastMessageContent: content.substring(0, 255),
        lastMessageTimestamp: timestamp,
        updatedAt: new Date(),
      })
      .where(and(
        eq(whatsappChats.companyId, companyId),
        eq(whatsappChats.chatId, chatId)
      ));
    
    // Ensure chat exists
    await db.insert(whatsappChats)
      .values({
        companyId,
        chatId,
        chatType: isGroup ? 'group' : 'individual',
        lastMessageContent: content.substring(0, 255),
        lastMessageTimestamp: timestamp,
      })
      .onConflictDoNothing();
  }
  
  async disconnect(companyId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (session?.sock) {
      try {
        session.sock.ev.removeAllListeners();
        session.sock.logout();
        await session.wipeCreds();
      } catch (e) {
        console.error(`[WhatsApp] Error disconnecting:`, e);
      }
      this.sessions.delete(companyId);
    }
  }
  
  getStatus(companyId: string): SessionStatus {
    const session = this.sessions.get(companyId);
    if (!session) {
      return {
        isReady: false,
        isAuthenticated: false,
        qrCode: null,
        qrDataUrl: null,
        status: 'disconnected',
        hasSavedSession: false,
      };
    }
    return session.status;
  }
  
  async sendMessage(companyId: string, jid: string, content: string): Promise<WAMessage | null> {
    const session = this.sessions.get(companyId);
    if (!session?.sock || !session.status.isReady) {
      throw new Error('WhatsApp not connected');
    }
    
    const normalizedJid = jidNormalizedUser(jid);
    const result = await session.sock.sendMessage(normalizedJid, { text: content });
    
    if (result) {
      await this.persistMessage(companyId, result);
    }
    
    return result;
  }
  
  // Alias for sendMessage
  async sendText(companyId: string, jid: string, text: string): Promise<WAMessage | null> {
    return this.sendMessage(companyId, jid, text);
  }
  
  async logout(companyId: string): Promise<void> {
    return this.disconnect(companyId);
  }
  
  async sendMedia(companyId: string, jid: string, urlOrBuffer: string | Buffer, caption?: string, type?: string): Promise<WAMessage | null> {
    const session = this.sessions.get(companyId);
    if (!session?.sock || !session.status.isReady) {
      throw new Error('WhatsApp not connected');
    }
    
    const normalizedJid = jidNormalizedUser(jid);
    
    let messageContent: any;
    const mediaType = type || 'image';
    
    if (typeof urlOrBuffer === 'string') {
      // URL-based media
      if (mediaType === 'image') {
        messageContent = { image: { url: urlOrBuffer }, caption };
      } else if (mediaType === 'video') {
        messageContent = { video: { url: urlOrBuffer }, caption };
      } else if (mediaType === 'audio') {
        messageContent = { audio: { url: urlOrBuffer } };
      } else {
        messageContent = { document: { url: urlOrBuffer }, caption, fileName: 'file' };
      }
    } else {
      // Buffer-based media
      if (mediaType === 'image') {
        messageContent = { image: urlOrBuffer, caption };
      } else if (mediaType === 'video') {
        messageContent = { video: urlOrBuffer, caption };
      } else if (mediaType === 'audio') {
        messageContent = { audio: urlOrBuffer };
      } else {
        messageContent = { document: urlOrBuffer, fileName: 'file' };
      }
    }
    
    const result = await session.sock.sendMessage(normalizedJid, messageContent);
    
    if (result) {
      await this.persistMessage(companyId, result);
    }
    
    return result;
  }
  
  async getChats(companyId: string): Promise<any[]> {
    const chats = await db.select()
      .from(whatsappChats)
      .where(and(
        eq(whatsappChats.companyId, companyId),
        sql`${whatsappChats.lastMessageTimestamp} IS NOT NULL AND ${whatsappChats.lastMessageTimestamp} > 0`
      ))
      .orderBy(desc(whatsappChats.lastMessageTimestamp));
    
    // Map to frontend expected format
    return chats.map(chat => ({
      id: chat.id,
      chatId: chat.chatId,
      name: chat.name || chat.pushName || chat.chatId?.split('@')[0] || 'Unknown',
      isGroup: chat.chatType === 'group',
      timestamp: chat.lastMessageTimestamp || 0,
      unreadCount: chat.unreadCount || 0,
      isPinned: chat.isPinned || false,
      isArchived: chat.isArchived || false,
      isMuted: chat.muteExpiration ? new Date(chat.muteExpiration) > new Date() : false,
      profilePicUrl: chat.profilePicUrl || null,
      lastMessage: chat.lastMessageContent ? {
        body: chat.lastMessageContent,
        timestamp: chat.lastMessageTimestamp || 0,
        from: chat.lastMessageFromMe ? 'me' : chat.chatId,
        type: 'chat',
        hasMedia: false,
      } : undefined,
    }));
  }
  
  async getMessages(companyId: string, chatIdOrUuid: string, limit: number = 50): Promise<any[]> {
    // chatIdOrUuid could be either the internal UUID or the WhatsApp JID
    // First, try to find the chat by UUID to get the actual chatId (JID)
    let actualChatId = chatIdOrUuid;
    
    // If it looks like a UUID (contains hyphens and no @), look up the chat
    if (chatIdOrUuid.includes('-') && !chatIdOrUuid.includes('@')) {
      const chat = await db.select()
        .from(whatsappChats)
        .where(and(
          eq(whatsappChats.companyId, companyId),
          eq(whatsappChats.id, chatIdOrUuid)
        ))
        .limit(1);
      
      if (chat.length > 0 && chat[0].chatId) {
        actualChatId = chat[0].chatId;
      }
    }
    
    const messages = await db.select()
      .from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.companyId, companyId),
        eq(whatsappMessages.chatId, actualChatId)
      ))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);
    
    // Map to frontend expected format
    return messages.reverse().map(msg => ({
      id: msg.messageId,
      body: msg.text || '',
      from: msg.senderId || '',
      to: msg.chatId,
      timestamp: msg.timestamp || 0,
      isFromMe: msg.fromMe || false,
      hasMedia: !!msg.mediaType,
      type: msg.mediaType || 'chat',
      mediaUrl: msg.mediaUrl || undefined,
      ack: 4, // Assume read for history
    }));
  }
  
  async getProfilePicture(companyId: string, jid: string): Promise<string | null> {
    const session = this.sessions.get(companyId);
    if (!session?.sock || !session.status.isReady) {
      return null;
    }
    
    try {
      const url = await session.sock.profilePictureUrl(jid, 'image');
      return url ?? null;
    } catch (e) {
      return null;
    }
  }
  
  async markAsRead(companyId: string, chatId: string, messageIds: string[]): Promise<void> {
    const session = this.sessions.get(companyId);
    if (!session?.sock || !session.status.isReady) {
      return;
    }
    
    const keys = messageIds.map(id => ({
      remoteJid: chatId,
      id,
      fromMe: false,
    }));
    
    await session.sock.readMessages(keys);
  }
}

export const whatsappService = new WhatsAppService();
