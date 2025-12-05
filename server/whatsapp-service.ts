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
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode';
import { EventEmitter } from 'events';
import { db } from './db';
import { 
  whatsappSessions, 
  whatsappChats, 
  whatsappMessages,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// ============================================================
// PostgreSQL Auth State Adapter
// ============================================================
// This replaces useMultiFileAuthState - stores auth in database instead of files

async function usePostgresAuthState(companyId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  removeCreds: () => Promise<void>;
}> {
  const KEY_PREFIX = `${companyId}:`;
  
  const getKey = async (key: string): Promise<any> => {
    const result = await db.select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.id, KEY_PREFIX + key))
      .limit(1);
    
    if (result.length === 0) return null;
    return JSON.parse(result[0].data, BufferJSON.reviver);
  };
  
  const setKey = async (key: string, data: any): Promise<void> => {
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await db.insert(whatsappSessions)
      .values({
        id: KEY_PREFIX + key,
        companyId,
        data: serialized,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: whatsappSessions.id,
        set: { data: serialized, updatedAt: new Date() },
      });
  };
  
  const removeKey = async (key: string): Promise<void> => {
    await db.delete(whatsappSessions)
      .where(eq(whatsappSessions.id, KEY_PREFIX + key));
  };
  
  let creds = await getKey('creds');
  if (!creds) {
    creds = initAuthCreds();
  }
  
  return {
    state: {
      creds,
      keys: {
        get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
          const data: { [id: string]: any } = {};
          for (const id of ids) {
            const value = await getKey(`${type}-${id}`);
            if (value) {
              data[id] = value;
            }
          }
          return data;
        },
        set: async (data: any) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries as any)) {
              if (value) {
                await setKey(`${type}-${id}`, value);
              } else {
                await removeKey(`${type}-${id}`);
              }
            }
          }
        },
      },
    },
    saveCreds: async () => {
      await setKey('creds', creds);
    },
    removeCreds: async () => {
      await db.delete(whatsappSessions)
        .where(eq(whatsappSessions.companyId, companyId));
    },
  };
}

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
  removeCreds: () => Promise<void>;
  selfJid: string | null;
  companyId: string;
}

class WhatsAppService extends EventEmitter {
  private sessions: Map<string, CompanySession> = new Map();
  private initializingCompanies: Set<string> = new Set();
  private logger = P({ level: 'warn' });
  
  async getClientForCompany(companyId: string): Promise<CompanySession | null> {
    if (this.sessions.has(companyId)) {
      return this.sessions.get(companyId)!;
    }
    return null;
  }
  
  async initializeClient(companyId: string): Promise<CompanySession> {
    if (this.initializingCompanies.has(companyId)) {
      console.log(`[WhatsApp] Already initializing for company ${companyId}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const existing = this.sessions.get(companyId);
      if (existing) return existing;
    }
    
    const existing = this.sessions.get(companyId);
    if (existing?.status.isReady) {
      return existing;
    }
    
    this.initializingCompanies.add(companyId);
    
    try {
      console.log(`[WhatsApp] Initializing client for company ${companyId}`);
      
      const { state, saveCreds, removeCreds } = await usePostgresAuthState(companyId);
      
      const hasSavedSession = !!(state.creds?.me?.id);
      
      const { version } = await fetchLatestBaileysVersion();
      console.log(`[WhatsApp] Using Baileys version ${version.join('.')}`);
      
      const sock = makeWASocket({
        version,
        auth: state,
        logger: this.logger,
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
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
        removeCreds,
        selfJid: state.creds?.me?.id || null,
        companyId,
      };
      
      this.sessions.set(companyId, session);
      
      sock.ev.on('connection.update', async (update) => {
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
          
          if (reason === DisconnectReason.loggedOut) {
            console.log(`[WhatsApp] Logged out, clearing session for company ${companyId}`);
            await removeCreds();
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
            console.log(`[WhatsApp] Attempting to reconnect for company ${companyId}...`);
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
      });
      
      sock.ev.on('creds.update', async () => {
        await saveCreds();
      });
      
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
          if (!msg.message) continue;
          
          try {
            await this.persistMessage(companyId, msg);
            this.emit('message', { companyId, message: msg });
          } catch (error) {
            console.error(`[WhatsApp] Error persisting message:`, error);
          }
        }
      });
      
      // CRITICAL: Listen for chats.upsert to capture chat list
      sock.ev.on('chats.upsert', async (chats) => {
        console.log(`[WhatsApp] Received ${chats.length} chats for company ${companyId}`);
        
        for (const chat of chats) {
          try {
            const chatId = chat.id;
            const isGroup = isJidGroup(chatId);
            const timestamp = chat.conversationTimestamp ? Number(chat.conversationTimestamp) : Math.floor(Date.now() / 1000);
            
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
                muteExpiration: (chat as any).muteExpiration || null,
              })
              .onConflictDoUpdate({
                target: [whatsappChats.companyId, whatsappChats.chatId],
                set: {
                  name: chat.name || sql`${whatsappChats.name}`,
                  unreadCount: chat.unreadCount || 0,
                  lastMessageTimestamp: timestamp,
                  isArchived: chat.archived || false,
                  isPinned: chat.pinned ? true : false,
                  muteExpiration: (chat as any).muteExpiration || null,
                  updatedAt: new Date(),
                },
              });
          } catch (error) {
            console.error(`[WhatsApp] Error saving chat ${chat.id}:`, error);
          }
        }
      });
      
      // Listen for chats.update (status changes, read receipts, etc)
      sock.ev.on('chats.update', async (updates) => {
        for (const update of updates) {
          try {
            const updateData: any = { updatedAt: new Date() };
            
            if (update.unreadCount !== undefined) updateData.unreadCount = update.unreadCount;
            if (update.archived !== undefined) updateData.isArchived = update.archived;
            if (update.pinned !== undefined) updateData.isPinned = update.pinned ? true : false;
            if ((update as any).muteExpiration !== undefined) updateData.muteExpiration = (update as any).muteExpiration;
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
      });
      
      // Listen for contacts.upsert to get contact names
      sock.ev.on('contacts.upsert', async (contacts) => {
        console.log(`[WhatsApp] Received ${contacts.length} contacts for company ${companyId}`);
        
        for (const contact of contacts) {
          try {
            const name = contact.name || contact.notify || contact.verifiedName;
            if (name) {
              await db.update(whatsappChats)
                .set({ name, updatedAt: new Date() })
                .where(and(
                  eq(whatsappChats.companyId, companyId),
                  eq(whatsappChats.chatId, contact.id)
                ));
            }
          } catch (error) {
            console.error(`[WhatsApp] Error updating contact name:`, error);
          }
        }
      });
      
      // Listen for messaging-history.set (initial sync of chats and messages)
      sock.ev.on('messaging-history.set', async ({ chats: historyChats, messages: historyMessages, isLatest }) => {
        console.log(`[WhatsApp] History sync for company ${companyId}: ${historyChats?.length || 0} chats, ${historyMessages?.length || 0} messages, isLatest: ${isLatest}`);
        
        // Process chats from history
        if (historyChats && historyChats.length > 0) {
          for (const chat of historyChats) {
            try {
              const chatId = chat.id;
              const isGroup = isJidGroup(chatId);
              const timestamp = chat.conversationTimestamp ? Number(chat.conversationTimestamp) : Math.floor(Date.now() / 1000);
              
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
                  muteExpiration: (chat as any).muteExpiration || null,
                })
                .onConflictDoUpdate({
                  target: [whatsappChats.companyId, whatsappChats.chatId],
                  set: {
                    name: chat.name || sql`${whatsappChats.name}`,
                    unreadCount: chat.unreadCount || 0,
                    lastMessageTimestamp: timestamp,
                    isArchived: chat.archived || false,
                    isPinned: chat.pinned ? true : false,
                    muteExpiration: (chat as any).muteExpiration || null,
                    updatedAt: new Date(),
                  },
                });
            } catch (error) {
              console.error(`[WhatsApp] Error saving history chat:`, error);
            }
          }
        }
        
        // Process messages from history
        if (historyMessages && historyMessages.length > 0) {
          for (const msg of historyMessages) {
            try {
              await this.persistMessage(companyId, msg);
            } catch (error) {
              console.error(`[WhatsApp] Error persisting history message:`, error);
            }
          }
        }
      });
      
      return session;
    } finally {
      this.initializingCompanies.delete(companyId);
    }
  }
  
  private async persistMessage(companyId: string, msg: WAMessage): Promise<void> {
    const chatId = msg.key.remoteJid;
    if (!chatId) return;
    
    await this.ensureChat(companyId, chatId, msg);
    
    const messageContent = msg.message;
    let text = '';
    let mediaType: string | null = null;
    let mediaUrl: string | null = null;
    
    if (messageContent?.conversation) {
      text = messageContent.conversation;
    } else if (messageContent?.extendedTextMessage) {
      text = messageContent.extendedTextMessage.text || '';
    } else if (messageContent?.imageMessage) {
      mediaType = 'image';
      text = messageContent.imageMessage.caption || '';
    } else if (messageContent?.videoMessage) {
      mediaType = 'video';
      text = messageContent.videoMessage.caption || '';
    } else if (messageContent?.audioMessage) {
      mediaType = 'audio';
    } else if (messageContent?.documentMessage) {
      mediaType = 'document';
      text = messageContent.documentMessage.fileName || '';
    } else if (messageContent?.stickerMessage) {
      mediaType = 'sticker';
    }
    
    const timestamp = Number(msg.messageTimestamp);
    
    await db.insert(whatsappMessages)
      .values({
        companyId,
        chatId,
        messageId: msg.key.id || '',
        fromMe: msg.key.fromMe || false,
        senderId: msg.key.participant || chatId,
        text,
        mediaType,
        mediaUrl,
        timestamp,
        quotedMessageId: messageContent?.extendedTextMessage?.contextInfo?.stanzaId || null,
        isForwarded: messageContent?.extendedTextMessage?.contextInfo?.isForwarded || false,
        rawData: msg as any,
      })
      .onConflictDoNothing();
    
    await db.update(whatsappChats)
      .set({ 
        lastMessageTimestamp: timestamp,
        lastMessageContent: text.substring(0, 500),
        lastMessageFromMe: msg.key.fromMe || false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(whatsappChats.companyId, companyId),
        eq(whatsappChats.chatId, chatId)
      ));
  }
  
  private async ensureChat(companyId: string, chatId: string, msg?: WAMessage): Promise<string> {
    const existing = await db.select()
      .from(whatsappChats)
      .where(and(
        eq(whatsappChats.companyId, companyId),
        eq(whatsappChats.chatId, chatId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0].id;
    }
    
    const isGroup = isJidGroup(chatId);
    const [created] = await db.insert(whatsappChats)
      .values({
        companyId,
        chatId,
        chatType: isGroup ? 'group' : 'individual',
        name: msg?.pushName || null,
        pushName: msg?.pushName || null,
      })
      .returning();
    
    return created.id;
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
  
  async logout(companyId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    if (session) {
      try {
        await session.sock.logout();
      } catch (e) {
        console.log('[WhatsApp] Error during logout:', e);
      }
      await session.removeCreds();
      this.sessions.delete(companyId);
    }
  }
  
  async sendText(companyId: string, chatId: string, text: string): Promise<proto.WebMessageInfo | null> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) {
      throw new Error('WhatsApp not connected');
    }
    
    const result = await session.sock.sendMessage(chatId, { text });
    if (result) {
      await this.persistMessage(companyId, result);
    }
    return result ?? null;
  }
  
  async sendMedia(
    companyId: string, 
    chatId: string, 
    url: string, 
    caption?: string,
    type: 'image' | 'video' | 'document' | 'audio' = 'image'
  ): Promise<proto.WebMessageInfo | null> {
    const session = this.sessions.get(companyId);
    if (!session?.status.isReady) {
      throw new Error('WhatsApp not connected');
    }
    
    let message: any;
    switch (type) {
      case 'image':
        message = { image: { url }, caption };
        break;
      case 'video':
        message = { video: { url }, caption };
        break;
      case 'audio':
        message = { audio: { url }, mimetype: 'audio/mp4' };
        break;
      case 'document':
        message = { document: { url }, caption };
        break;
    }
    
    const result = await session.sock.sendMessage(chatId, message);
    if (result) {
      await this.persistMessage(companyId, result);
    }
    return result ?? null;
  }
  
  async getChats(companyId: string): Promise<any[]> {
    return db.select()
      .from(whatsappChats)
      .where(eq(whatsappChats.companyId, companyId))
      .orderBy(desc(whatsappChats.lastMessageTimestamp));
  }
  
  async getMessages(companyId: string, chatId: string, limit: number = 50): Promise<any[]> {
    return db.select()
      .from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.companyId, companyId),
        eq(whatsappMessages.chatId, chatId)
      ))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);
  }
  
  async hasSavedSession(companyId: string): Promise<boolean> {
    const result = await db.select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.companyId, companyId))
      .limit(1);
    return result.length > 0;
  }
}

export const whatsappService = new WhatsAppService();
