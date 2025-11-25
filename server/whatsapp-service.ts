import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, Message, Chat, Contact } = pkg as any;
import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import path from 'path';
import { EventEmitter } from 'events';

interface WhatsAppSessionStatus {
  isReady: boolean;
  isAuthenticated: boolean;
  qrCode: string | null;
  status: 'disconnected' | 'qr_received' | 'authenticated' | 'ready';
}

interface CompanyWhatsAppClient {
  client: any;
  status: WhatsAppSessionStatus;
  messageHandlers: Map<string, (message: any) => void>;
}

/**
 * Multi-tenant WhatsApp Service
 * Each company has its own isolated WhatsApp client instance with separate auth data
 */
class WhatsAppService extends EventEmitter {
  // Map of companyId -> WhatsApp client instance
  private clients: Map<string, CompanyWhatsAppClient> = new Map();
  
  // Reconnection management
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Cache for message reactions (companyId:messageId -> reactions array)
  private messageReactions: Map<string, Array<{ emoji: string; senderId: string }>> = new Map();

  constructor() {
    super();
  }

  /**
   * Schedule automatic reconnection with exponential backoff
   */
  private async scheduleReconnect(companyId: string) {
    // Clear existing timer
    const existingTimer = this.reconnectTimers.get(companyId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate backoff
    const attempts = this.reconnectAttempts.get(companyId) || 0;
    const delays = [2000, 4000, 8000, 16000, 30000]; // 2s, 4s, 8s, 16s, max 30s
    const delay = delays[Math.min(attempts, delays.length - 1)];

    console.log(`[WhatsApp] Scheduling reconnect for company ${companyId} in ${delay}ms (attempt ${attempts + 1})`);

    const timer = setTimeout(async () => {
      try {
        console.log(`[WhatsApp] Attempting to reconnect company ${companyId}...`);
        
        // Get existing client
        const existingClient = this.clients.get(companyId);
        if (existingClient) {
          // Update status to show reconnecting
          existingClient.status.status = 'disconnected';
          this.emit('status_change', { companyId, status: existingClient.status });
          
          // Try to destroy properly
          try {
            await existingClient.client.destroy();
          } catch (e) {
            console.log(`[WhatsApp] Error destroying old client: ${e}`);
          }
          this.clients.delete(companyId);
        }

        // Create new client
        await this.createClientForCompany(companyId);
        
        // Reset attempts on success
        this.reconnectAttempts.delete(companyId);
        this.reconnectTimers.delete(companyId);
        
        console.log(`[WhatsApp] Successfully reconnected company ${companyId}`);
      } catch (error) {
        console.error(`[WhatsApp] Reconnect failed for company ${companyId}:`, error);
        
        // Increment attempts and schedule next try
        this.reconnectAttempts.set(companyId, attempts + 1);
        this.scheduleReconnect(companyId);
      }
    }, delay);

    this.reconnectTimers.set(companyId, timer);
    this.reconnectAttempts.set(companyId, attempts + 1);
  }

  /**
   * Get or create WhatsApp client for a specific company
   */
  async getClientForCompany(companyId: string): Promise<CompanyWhatsAppClient> {
    // Return existing client if already initialized
    if (this.clients.has(companyId)) {
      return this.clients.get(companyId)!;
    }

    // Create new client for this company
    return await this.createClientForCompany(companyId);
  }

  /**
   * Create a new WhatsApp client instance for a company
   */
  async createClientForCompany(companyId: string): Promise<CompanyWhatsAppClient> {
    console.log(`[WhatsApp] Creating new client for company: ${companyId}`);

    // Create company-specific auth directory
    const authPath = path.join('.wwebjs_auth', companyId);

    // Create client with company-specific LocalAuth strategy
    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: authPath,
        clientId: companyId, // Use companyId as client identifier
      }),
      puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    // Initial session status for this company
    const sessionStatus: WhatsAppSessionStatus = {
      isReady: false,
      isAuthenticated: false,
      qrCode: null,
      status: 'disconnected',
    };

    const companyClient: CompanyWhatsAppClient = {
      client,
      status: sessionStatus,
      messageHandlers: new Map(),
    };

    // Store in map before setting up handlers
    this.clients.set(companyId, companyClient);

    // Set up event handlers for this specific company client
    this.setupEventHandlers(companyId, companyClient);

    // Initialize the client
    try {
      await client.initialize();
      console.log(`[WhatsApp] Client initialization started for company: ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Failed to initialize client for company ${companyId}:`, error);
      // Remove from map if initialization fails
      this.clients.delete(companyId);
      throw error;
    }

    return companyClient;
  }

  /**
   * Set up WhatsApp client event handlers for a specific company
   */
  private setupEventHandlers(companyId: string, companyClient: CompanyWhatsAppClient): void {
    const { client, status } = companyClient;

    // QR code received - need to scan
    client.on('qr', async (qr: string) => {
      console.log(`[WhatsApp] QR Code received for company: ${companyId}`);
      
      // Generate QR code as data URL for frontend
      try {
        const qrDataUrl = await qrcode.toDataURL(qr);
        status.qrCode = qrDataUrl;
        status.status = 'qr_received';
        status.isAuthenticated = false;
        status.isReady = false;
        
        // Also log to terminal for debugging
        qrcodeTerminal.generate(qr, { small: true });
        
        this.emit('qr', { companyId, qrCode: qrDataUrl });
      } catch (error) {
        console.error(`[WhatsApp] Failed to generate QR code for company ${companyId}:`, error);
      }
    });

    // Client authenticated
    client.on('authenticated', () => {
      console.log(`[WhatsApp] Client authenticated for company: ${companyId}`);
      status.isAuthenticated = true;
      status.status = 'authenticated';
      status.qrCode = null;
      this.emit('authenticated', { companyId });
    });

    // Authentication failure
    client.on('auth_failure', (msg: string) => {
      console.error(`[WhatsApp] Authentication failure for company ${companyId}:`, msg);
      status.isAuthenticated = false;
      status.status = 'disconnected';
      this.emit('auth_failure', { companyId, message: msg });
      
      // Schedule automatic reconnection
      this.scheduleReconnect(companyId);
    });

    // Client is ready
    client.on('ready', () => {
      console.log(`[WhatsApp] Client is ready for company: ${companyId}`);
      status.isReady = true;
      status.isAuthenticated = true;
      status.status = 'ready';
      status.qrCode = null;
      this.emit('ready', { companyId });
    });

    // Incoming message
    client.on('message', async (message: any) => {
      console.log(`[WhatsApp] Message received for company ${companyId}:`, message.from, message.body);
      this.emit('message', { companyId, message });
      
      // Call registered message handlers for this company
      for (const handler of companyClient.messageHandlers.values()) {
        try {
          handler(message);
        } catch (error) {
          console.error(`[WhatsApp] Error in message handler for company ${companyId}:`, error);
        }
      }
    });

    // Message acknowledgement (status update)
    client.on('message_ack', (message: any, ack: number) => {
      // ack values: 0 = error, 1 = pending, 2 = server received, 3 = delivered, 4 = read
      const statusMap: { [key: number]: string } = {
        0: 'failed',
        1: 'pending',
        2: 'sent',
        3: 'delivered',
        4: 'read',
      };
      
      const messageStatus = statusMap[ack] || 'pending';
      console.log(`[WhatsApp] Message status update for company ${companyId}:`, message.id._serialized, messageStatus);
      this.emit('message_status', { companyId, messageId: message.id._serialized, status: messageStatus });
    });

    // Message reaction event - cache reactions for display
    client.on('message_reaction', (reaction: any) => {
      try {
        const messageId = reaction.msgId?._serialized || reaction.id?.parentMsgKey?._serialized;
        const senderId = reaction.senderId || reaction.id?.participant;
        const emoji = reaction.reaction || '';
        
        if (messageId) {
          const cacheKey = `${companyId}:${messageId}`;
          const existingReactions = this.messageReactions.get(cacheKey) || [];
          
          if (emoji === '') {
            // Reaction removed - filter out this sender's reaction
            const filtered = existingReactions.filter(r => r.senderId !== senderId);
            if (filtered.length > 0) {
              this.messageReactions.set(cacheKey, filtered);
            } else {
              this.messageReactions.delete(cacheKey);
            }
          } else {
            // Reaction added/changed - update or add
            const existingIndex = existingReactions.findIndex(r => r.senderId === senderId);
            if (existingIndex >= 0) {
              existingReactions[existingIndex].emoji = emoji;
            } else {
              existingReactions.push({ emoji, senderId });
            }
            this.messageReactions.set(cacheKey, existingReactions);
          }
          
          console.log(`[WhatsApp] Reaction cached for company ${companyId}: ${emoji} on message ${messageId}`);
          this.emit('message_reaction', { companyId, messageId, emoji, senderId });
        }
      } catch (error) {
        console.error(`[WhatsApp] Error processing reaction for company ${companyId}:`, error);
      }
    });

    // Disconnected
    client.on('disconnected', (reason: string) => {
      console.log(`[WhatsApp] Client disconnected for company ${companyId}:`, reason);
      status.isReady = false;
      status.isAuthenticated = false;
      status.status = 'disconnected';
      status.qrCode = null;
      this.emit('disconnected', { companyId, reason });
      
      // Schedule automatic reconnection
      this.scheduleReconnect(companyId);
    });

    // Loading screen
    client.on('loading_screen', (percent: number, message: string) => {
      console.log(`[WhatsApp] Loading for company ${companyId}:`, percent, message);
    });
  }

  /**
   * Get current session status for a company
   */
  getSessionStatus(companyId: string): WhatsAppSessionStatus {
    const companyClient = this.clients.get(companyId);
    if (!companyClient) {
      return {
        isReady: false,
        isAuthenticated: false,
        qrCode: null,
        status: 'disconnected',
      };
    }
    return { ...companyClient.status };
  }

  /**
   * Check if client is ready for a company
   */
  isReady(companyId: string): boolean {
    const companyClient = this.clients.get(companyId);
    return companyClient?.status.isReady === true && companyClient.client !== null;
  }

  /**
   * Get cached reactions for a message
   */
  getCachedReactions(companyId: string, messageId: string): Array<{ emoji: string; senderId: string }> {
    const cacheKey = `${companyId}:${messageId}`;
    return this.messageReactions.get(cacheKey) || [];
  }

  /**
   * Update reaction cache when sending a reaction
   */
  updateReactionCache(companyId: string, messageId: string, emoji: string, senderId: string): void {
    const cacheKey = `${companyId}:${messageId}`;
    const existingReactions = this.messageReactions.get(cacheKey) || [];
    
    if (emoji === '') {
      // Remove reaction
      const filtered = existingReactions.filter(r => r.senderId !== senderId);
      if (filtered.length > 0) {
        this.messageReactions.set(cacheKey, filtered);
      } else {
        this.messageReactions.delete(cacheKey);
      }
    } else {
      // Add/update reaction
      const existingIndex = existingReactions.findIndex(r => r.senderId === senderId);
      if (existingIndex >= 0) {
        existingReactions[existingIndex].emoji = emoji;
      } else {
        existingReactions.push({ emoji, senderId });
      }
      this.messageReactions.set(cacheKey, existingReactions);
    }
  }

  /**
   * Load message reactions - returns cached or fetches from message.getReactions()
   */
  async loadMessageReactions(companyId: string, messageId: string, msg: any): Promise<Array<{ emoji: string; senderId: string }>> {
    const cacheKey = `${companyId}:${messageId}`;
    
    // Return cached if available
    const cached = this.messageReactions.get(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }
    
    // Try to fetch reactions from the message object
    try {
      if (msg && typeof msg.getReactions === 'function') {
        const reactionGroups = await msg.getReactions();
        if (reactionGroups && reactionGroups.length > 0) {
          const reactions: Array<{ emoji: string; senderId: string }> = [];
          for (const group of reactionGroups) {
            // Each group has { id (emoji), aggregateEmoji, senders }
            const emoji = group.aggregateEmoji || group.id;
            if (group.senders && Array.isArray(group.senders)) {
              for (const sender of group.senders) {
                reactions.push({
                  emoji,
                  senderId: sender.id || sender._serialized || 'unknown',
                });
              }
            }
          }
          // Cache the results
          if (reactions.length > 0) {
            this.messageReactions.set(cacheKey, reactions);
          }
          return reactions;
        }
      }
    } catch (error) {
      // Silently fail - reactions are not critical
      console.log(`[WhatsApp] Could not load reactions for message ${messageId}:`, error);
    }
    
    return [];
  }

  /**
   * Get all contacts for a company
   */
  async getContacts(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const contacts = await companyClient.client.getContacts();
      
      // Filter out:
      // 1. Groups
      // 2. Broadcast lists and status
      // 3. Contacts without valid phone numbers
      return contacts.filter((contact: any) => {
        // Exclude groups
        if (contact.isGroup) return false;
        
        // Exclude broadcast and status
        if (contact.id._serialized.includes('broadcast') || 
            contact.id._serialized.includes('status')) {
          return false;
        }
        
        // Only include if there's a numeric user ID (phone number)
        const userId = contact.id.user;
        if (!userId || !/^\d+$/.test(userId)) {
          return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error(`[WhatsApp] Failed to get contacts for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get all chats for a company
   * Filters out system chats that cannot be permanently deleted (0@c.us, status, broadcast)
   */
  async getChats(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const chats = await companyClient.client.getChats();
      
      // Filter out only system chats that cannot be permanently deleted
      const SYSTEM_CHAT_IDS = ['0@c.us', 'status@broadcast'];
      
      return chats.filter((chat: any) => {
        const chatId = chat.id?._serialized || chat.id;
        
        // Exclude known system chat IDs
        if (SYSTEM_CHAT_IDS.includes(chatId)) {
          return false;
        }
        
        // Exclude chats with user ID "0" (WhatsApp service notifications)
        if (chat.id?.user === '0' || chat.id?.user === 0) {
          return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error(`[WhatsApp] Failed to get chats for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific chat by ID
   * @param companyId Company ID
   * @param chatId The chat ID to retrieve
   * @returns The chat object
   */
  async getChatById(companyId: string, chatId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const chat = await companyClient.client.getChatById(chatId);
      return chat;
    } catch (error) {
      console.error(`[WhatsApp] Failed to get chat ${chatId} for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get poll votes for a message by message ID (Client-level function)
   * @param companyId Company ID
   * @param messageId The message ID of the poll
   * @returns Array of poll votes
   */
  async getPollVotes(companyId: string, messageId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const pollVotes = await companyClient.client.getPollVotes(messageId);
      return pollVotes || [];
    } catch (error) {
      console.error(`[WhatsApp] Failed to get poll votes for message ${messageId} for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get messages for a specific chat (company-scoped)
   */
  async getChatMessages(companyId: string, chatId: string, limit: number = 50): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const chat = await companyClient.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      
      // Filter out empty/system messages that WhatsApp creates
      const SYSTEM_MESSAGE_TYPES = ['notification', 'protocol', 'e2e_notification', 'gp2', 'revoked'];
      
      return messages.filter((msg: any) => {
        // Filter out system message types
        if (SYSTEM_MESSAGE_TYPES.includes(msg.type)) {
          return false;
        }
        
        // Filter out messages with empty body (system placeholders)
        const body = msg.body || '';
        if (body.trim() === '') {
          return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error(`[WhatsApp] Failed to get chat messages for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send a text message (company-scoped)
   */
  async sendMessage(companyId: string, to: string, message: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      // Ensure the number is in the correct format (e.g., "1234567890@c.us")
      const chatId = to.includes('@') ? to : `${to}@c.us`;
      const sentMessage = await companyClient.client.sendMessage(chatId, message);
      console.log(`[WhatsApp] Message sent to ${chatId} for company ${companyId}`);
      return sentMessage;
    } catch (error) {
      console.error(`[WhatsApp] Failed to send message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send a message with media (company-scoped)
   */
  async sendMediaMessage(companyId: string, to: string, media: any, caption?: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const chatId = to.includes('@') ? to : `${to}@c.us`;
      const sentMessage = await companyClient.client.sendMessage(chatId, media, { caption });
      console.log(`[WhatsApp] Media message sent to ${chatId} for company ${companyId}`);
      return sentMessage;
    } catch (error) {
      console.error(`[WhatsApp] Failed to send media message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send media to a chat (image, video, audio, document) using raw buffer data
   * @param companyId Company ID
   * @param chatId Chat ID to send to
   * @param buffer File buffer data
   * @param mimetype MIME type of the file
   * @param filename Original filename
   * @param caption Optional caption for the media
   * @param sendAsVoiceNote If true, send as voice note/PTT (for audio files)
   */
  async sendMedia(
    companyId: string, 
    chatId: string, 
    buffer: Buffer, 
    mimetype: string, 
    filename: string, 
    caption?: string,
    sendAsVoiceNote: boolean = false
  ): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      // Import MessageMedia from whatsapp-web.js
      const { MessageMedia } = pkg;
      
      // Create MessageMedia from buffer
      const media = new MessageMedia(mimetype, buffer.toString('base64'), filename);
      
      // Get the chat
      const chat = await companyClient.client.getChatById(chatId);
      
      // Send options
      const sendOptions: any = {};
      if (caption) {
        sendOptions.caption = caption;
      }
      
      // If it's audio and should be sent as voice note
      if (sendAsVoiceNote && mimetype.startsWith('audio/')) {
        sendOptions.sendAudioAsVoice = true;
      }
      
      // Send the media message
      const sentMessage = await chat.sendMessage(media, sendOptions);
      console.log(`[WhatsApp] Media sent to ${chatId} for company ${companyId}: ${mimetype}, ${filename}`);
      return sentMessage;
    } catch (error) {
      console.error(`[WhatsApp] Failed to send media for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Mark chat as read (company-scoped)
   */
  async markChatAsRead(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const chat = await companyClient.client.getChatById(chatId);
      await chat.sendSeen();
      console.log(`[WhatsApp] Chat marked as read for company ${companyId}:`, chatId);
    } catch (error) {
      console.error(`[WhatsApp] Failed to mark chat as read for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send seen/read receipt for a chat (alias for markChatAsRead)
   */
  async sendSeen(companyId: string, chatId: string): Promise<void> {
    const companyClient = await this.getClientForCompany(companyId);
    if (!companyClient.client || !companyClient.status.isReady) {
      throw new Error('WhatsApp client not ready');
    }
    
    try {
      const chat = await companyClient.client.getChatById(chatId);
      await chat.sendSeen();
      console.log(`[WhatsApp] Sent seen for company ${companyId} to chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Failed to send seen for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get contact by ID (company-scoped)
   */
  async getContactById(companyId: string, contactId: string): Promise<any | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const contact = await companyClient.client.getContactById(contactId);
      return contact;
    } catch (error) {
      console.error(`[WhatsApp] Failed to get contact for company ${companyId}:`, error);
      return null;
    }
  }

  /**
   * Normalize WhatsApp ID to ensure @c.us suffix
   */
  private normalizeWhatsAppId(id: string): string {
    return id.includes('@') ? id : `${id}@c.us`;
  }

  /**
   * Get profile picture URL for a contact (company-scoped)
   */
  async getProfilePicUrl(companyId: string, contactId: string): Promise<string | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const profilePicUrl = await companyClient.client.getProfilePicUrl(contactId);
      return profilePicUrl || null;
    } catch (error) {
      console.error(`[WhatsApp] Failed to get profile picture for company ${companyId}:`, error);
      return null;
    }
  }

  /**
   * Get profile picture URL for a contact using normalized ID
   */
  async getProfilePicture(companyId: string, contactId: string): Promise<string | null> {
    const client = await this.getClientForCompany(companyId);
    if (!client.status.isReady) {
      throw new Error('WhatsApp not ready');
    }
    
    const normalizedId = this.normalizeWhatsAppId(contactId);
    try {
      const url = await client.client.getProfilePicUrl(normalizedId);
      return url || null;
    } catch (error) {
      console.log(`[WhatsApp] Could not get profile picture for ${contactId}`);
      return null;
    }
  }

  /**
   * Get complete contact info including about status
   */
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
    const client = await this.getClientForCompany(companyId);
    if (!client.status.isReady) {
      throw new Error('WhatsApp not ready');
    }
    
    const normalizedId = this.normalizeWhatsAppId(contactId);
    
    try {
      const contact = await client.client.getContactById(normalizedId);
      
      let about: string | null = null;
      try {
        about = await contact.getAbout?.() || null;
      } catch (e) {
        console.log(`[WhatsApp] Could not get about for ${contactId}`);
      }
      
      let profilePic: string | null = null;
      try {
        profilePic = await client.client.getProfilePicUrl(normalizedId);
      } catch (e) {
        console.log(`[WhatsApp] Could not get profile pic for ${contactId}`);
      }
      
      console.log(`[WhatsApp] Contact info retrieved for company ${companyId}: ${contactId}`);
      
      return {
        id: contact.id._serialized,
        name: contact.name || contact.pushname || null,
        number: contact.number,
        about,
        profilePic,
        pushname: contact.pushname || null,
        isBusiness: contact.isBusiness || false,
        isBlocked: contact.isBlocked || false,
        isEnterprise: contact.isEnterprise || false,
        isUser: contact.isUser || false,
        labels: contact.labels || [],
      };
    } catch (error) {
      console.error(`[WhatsApp] Error getting contact info for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // MESSAGE OPERATIONS (CRÍTICO)
  // ============================================================================

  /**
   * Reply to a message
   */
  async replyMessage(companyId: string, messageId: string, content: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      const reply = await message.reply(content);
      console.log(`[WhatsApp] Reply sent for company ${companyId} to message ${messageId}`);
      return reply;
    } catch (error) {
      console.error(`[WhatsApp] Error replying to message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Forward a message to another chat
   */
  async forwardMessage(companyId: string, messageId: string, chatId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      const forwardedMessage = await message.forward(chatId);
      console.log(`[WhatsApp] Message forwarded for company ${companyId} from ${messageId} to ${chatId}`);
      return forwardedMessage;
    } catch (error) {
      console.error(`[WhatsApp] Error forwarding message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(companyId: string, messageId: string, forEveryone: boolean = false): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      await message.delete(forEveryone);
      console.log(`[WhatsApp] Message deleted for company ${companyId}: ${messageId} (forEveryone: ${forEveryone})`);
    } catch (error) {
      console.error(`[WhatsApp] Error deleting message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Star a message
   */
  async starMessage(companyId: string, messageId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      await message.star();
      console.log(`[WhatsApp] Message starred for company ${companyId}: ${messageId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error starring message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unstar a message
   */
  async unstarMessage(companyId: string, messageId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      await message.unstar();
      console.log(`[WhatsApp] Message unstarred for company ${companyId}: ${messageId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error unstarring message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Download media from a message
   */
  async downloadMedia(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      
      if (!message.hasMedia) {
        throw new Error('Message does not contain media');
      }

      const media = await message.downloadMedia();
      console.log(`[WhatsApp] Media downloaded for company ${companyId} from message ${messageId}`);
      return media;
    } catch (error) {
      console.error(`[WhatsApp] Error downloading media for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get quoted message (the message being replied to)
   */
  async getQuotedMessage(companyId: string, messageId: string): Promise<any | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      
      if (!message.hasQuotedMsg) {
        return null;
      }

      const quotedMessage = await message.getQuotedMessage();
      console.log(`[WhatsApp] Quoted message retrieved for company ${companyId}`);
      return quotedMessage;
    } catch (error) {
      console.error(`[WhatsApp] Error getting quoted message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get message info (read receipts, delivery status)
   */
  async getMessageInfo(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      const info = await message.getInfo();
      console.log(`[WhatsApp] Message info retrieved for company ${companyId}: ${messageId}`);
      return info;
    } catch (error) {
      console.error(`[WhatsApp] Error getting message info for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * React to a message with an emoji
   */
  async reactToMessage(companyId: string, messageId: string, emoji: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const message = await companyClient.client.getMessageById(messageId);
      await message.react(emoji);
      console.log(`[WhatsApp] Reaction sent for company ${companyId}: ${emoji} on message ${messageId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error reacting to message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(companyId: string, messageId: string, newContent: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const result = await message.edit(newContent);
          console.log(`[WhatsApp] Message edited for company ${companyId}: ${messageId}`);
          return result;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error editing message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Pin a message (duration in seconds)
   */
  async pinMessage(companyId: string, messageId: string, duration: number): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const result = await message.pin(duration);
          console.log(`[WhatsApp] Message pinned for company ${companyId}: ${messageId} (duration: ${duration}s)`);
          return result;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error pinning message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unpin a message
   */
  async unpinMessage(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const result = await message.unpin();
          console.log(`[WhatsApp] Message unpinned for company ${companyId}: ${messageId}`);
          return result;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error unpinning message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Reload message from WhatsApp
   */
  async reloadMessage(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const result = await message.reload();
          console.log(`[WhatsApp] Message reloaded for company ${companyId}: ${messageId}`);
          return result;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error reloading message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get reactions on a message
   */
  async getMessageReactions(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const reactions = await message.getReactions();
          console.log(`[WhatsApp] Reactions retrieved for company ${companyId}: ${messageId}`);
          return reactions;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting message reactions for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get users mentioned in message
   */
  async getMessageMentions(companyId: string, messageId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const mentions = await message.getMentions();
          console.log(`[WhatsApp] Mentions retrieved for company ${companyId}: ${messageId}`);
          return mentions;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting message mentions for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get groups mentioned in message
   */
  async getMessageGroupMentions(companyId: string, messageId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const groupMentions = await message.getGroupMentions();
          console.log(`[WhatsApp] Group mentions retrieved for company ${companyId}: ${messageId}`);
          return groupMentions;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting message group mentions for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get poll votes from a poll message
   */
  async getMessagePollVotes(companyId: string, messageId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const pollVotes = await message.getVotes();
          console.log(`[WhatsApp] Poll votes retrieved for company ${companyId}: ${messageId}`);
          return pollVotes;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting message poll votes for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get the chat from a message
   */
  async getMessageChat(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const messageChat = await message.getChat();
          console.log(`[WhatsApp] Chat retrieved from message for company ${companyId}: ${messageId}`);
          return messageChat;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting chat from message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get the contact who sent a message
   */
  async getMessageContact(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const contact = await message.getContact();
          console.log(`[WhatsApp] Contact retrieved from message for company ${companyId}: ${messageId}`);
          return contact;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting contact from message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get order info from a message
   */
  async getMessageOrder(companyId: string, messageId: string): Promise<any | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const order = await message.getOrder();
          console.log(`[WhatsApp] Order info retrieved from message for company ${companyId}: ${messageId}`);
          return order;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting order from message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get payment info from a message
   */
  async getMessagePayment(companyId: string, messageId: string): Promise<any | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const payment = await message.getPayment();
          console.log(`[WhatsApp] Payment info retrieved from message for company ${companyId}: ${messageId}`);
          return payment;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error getting payment from message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Edit a scheduled event message
   */
  async editScheduledEvent(companyId: string, messageId: string, editedEventObject: any): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const result = await message.editScheduledEvent(editedEventObject);
          console.log(`[WhatsApp] Scheduled event edited for company ${companyId}: ${messageId}`);
          return result;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error editing scheduled event for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Accept a group V4 invite from a message
   */
  async acceptMessageGroupV4Invite(companyId: string, messageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChats();
      for (const chat of chats) {
        const messages = await chat.fetchMessages({ limit: 100 });
        const message = messages.find((m: any) => m.id._serialized === messageId);
        if (message) {
          const result = await message.acceptGroupV4Invite();
          console.log(`[WhatsApp] Group V4 invite accepted for company ${companyId}: ${messageId}`);
          return result;
        }
      }
      throw new Error('Message not found');
    } catch (error) {
      console.error(`[WhatsApp] Error accepting group V4 invite for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CHAT OPERATIONS (IMPORTANTE)
  // ============================================================================

  /**
   * Archive a chat
   */
  async archiveChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.archive();
      console.log(`[WhatsApp] Chat archived for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error archiving chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unarchive a chat
   */
  async unarchiveChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.unarchive();
      console.log(`[WhatsApp] Chat unarchived for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error unarchiving chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Pin a chat
   */
  async pinChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.pin();
      console.log(`[WhatsApp] Chat pinned for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error pinning chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unpin a chat
   */
  async unpinChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.unpin();
      console.log(`[WhatsApp] Chat unpinned for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error unpinning chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Mute a chat
   */
  async muteChat(companyId: string, chatId: string, duration?: number): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.mute(duration);
      console.log(`[WhatsApp] Chat muted for company ${companyId}: ${chatId} (duration: ${duration || 'forever'})`);
    } catch (error) {
      console.error(`[WhatsApp] Error muting chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unmute a chat
   */
  async unmuteChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.unmute();
      console.log(`[WhatsApp] Chat unmuted for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error unmuting chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all messages in a chat
   */
  async clearChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.clearMessages();
      console.log(`[WhatsApp] Chat cleared for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error clearing chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a chat
   */
  async deleteChat(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      
      // First clear all messages from the chat history
      await chat.clearMessages();
      console.log(`[WhatsApp] Chat messages cleared for company ${companyId}: ${chatId}`);
      
      // Then delete the chat itself
      await chat.delete();
      console.log(`[WhatsApp] Chat deleted for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error deleting chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Mark chat as unread
   */
  async markChatUnread(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.markUnread();
      console.log(`[WhatsApp] Chat marked as unread for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error marking chat as unread for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(companyId: string, chatId: string, duration: number = 5000): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.sendStateTyping();
      
      if (duration > 0) {
        setTimeout(async () => {
          try {
            await chat.clearState();
          } catch (err) {
            console.error(`[WhatsApp] Error clearing typing state:`, err);
          }
        }, duration);
      }
      
      console.log(`[WhatsApp] Typing indicator sent for company ${companyId} in chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending typing indicator for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.clearState();
      
      console.log(`[WhatsApp] Typing indicator stopped for company ${companyId} in chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error stopping typing indicator for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send recording indicator
   */
  async sendRecording(companyId: string, chatId: string, duration: number = 5000): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.sendStateRecording();
      
      if (duration > 0) {
        setTimeout(async () => {
          try {
            await chat.clearState();
          } catch (err) {
            console.error(`[WhatsApp] Error clearing recording state:`, err);
          }
        }, duration);
      }
      
      console.log(`[WhatsApp] Recording indicator sent for company ${companyId} in chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending recording indicator for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Clear typing/recording state immediately for a chat
   * Stops any typing or recording indicator being shown to the recipient
   */
  async clearState(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(chatId);
      await chat.clearState();
      console.log(`[WhatsApp] Cleared state for chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error clearing state:`, error);
      throw error;
    }
  }

  /**
   * Get contact presence status (typing, recording, online)
   */
  async getContactPresence(companyId: string, chatId: string): Promise<{ isTyping: boolean; isRecording: boolean; isOnline: boolean; lastSeen: string | null }> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      
      let isOnline = false;
      let lastSeen: string | null = null;
      
      if (!chat.isGroup) {
        const contact = await companyClient.client.getContactById(chatId);
        if (contact) {
          try {
            const presence = await (contact as any).getPresence?.();
            if (presence) {
              isOnline = presence.status === 'available' || presence.status === 'composing';
              if (presence.lastSeen) {
                const lastSeenDate = new Date(presence.lastSeen * 1000);
                const now = new Date();
                const diff = now.getTime() - lastSeenDate.getTime();
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);
                
                if (days > 0) {
                  lastSeen = `última vez hace ${days} día${days > 1 ? 's' : ''}`;
                } else if (hours > 0) {
                  lastSeen = `última vez hace ${hours} hora${hours > 1 ? 's' : ''}`;
                } else if (minutes > 0) {
                  lastSeen = `última vez hace ${minutes} min`;
                } else {
                  lastSeen = 'en línea recientemente';
                }
              }
            }
          } catch (presenceError) {
            console.debug('[WhatsApp] Could not get presence:', presenceError);
          }
        }
      }
      
      return {
        isTyping: false,
        isRecording: false,
        isOnline,
        lastSeen
      };
    } catch (error) {
      console.error(`[WhatsApp] Error getting contact presence for company ${companyId}:`, error);
      return {
        isTyping: false,
        isRecording: false,
        isOnline: false,
        lastSeen: null
      };
    }
  }

  // ============================================================================
  // CHAT-BUSINESS OPERATIONS (WhatsApp Business)
  // ============================================================================

  /**
   * Get customer note for a chat (WhatsApp Business feature)
   */
  async getChatCustomerNote(companyId: string, chatId: string): Promise<any | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(chatId);
      const note = await chat.getCustomerNote();
      console.log(`[WhatsApp] Got customer note for chat ${chatId}`);
      return note;
    } catch (error) {
      console.error(`[WhatsApp] Error getting chat customer note:`, error);
      throw error;
    }
  }

  /**
   * Add or edit customer note for a chat (WhatsApp Business feature)
   */
  async addOrEditChatCustomerNote(companyId: string, chatId: string, note: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(chatId);
      const result = await chat.addOrEditCustomerNote(note);
      console.log(`[WhatsApp] Added/edited customer note for chat ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error adding/editing chat customer note:`, error);
      throw error;
    }
  }

  // ============================================================================
  // SEARCH OPERATIONS (ÚTIL)
  // ============================================================================

  /**
   * Search messages globally or in a specific chat
   */
  async searchMessages(companyId: string, query: string, options?: { chatId?: string; limit?: number }): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      
      if (options?.chatId) {
        const chat = await companyClient.client.getChatById(options.chatId);
        const messages = await chat.fetchMessages({ limit: options.limit || 1000 });
        const filtered = messages.filter((msg: any) => 
          msg.body.toLowerCase().includes(query.toLowerCase())
        );
        console.log(`[WhatsApp] Search in chat for company ${companyId}: found ${filtered.length} results`);
        return filtered;
      } else {
        const chats = await companyClient.client.getChats();
        const allMessages: any[] = [];
        
        for (const chat of chats) {
          const messages = await chat.fetchMessages({ limit: options?.limit || 100 });
          const filtered = messages.filter((msg: any) => 
            msg.body.toLowerCase().includes(query.toLowerCase())
          );
          allMessages.push(...filtered);
        }
        
        console.log(`[WhatsApp] Global search for company ${companyId}: found ${allMessages.length} results`);
        return allMessages;
      }
    } catch (error) {
      console.error(`[WhatsApp] Error searching messages for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CONTACT OPERATIONS (NECESARIO)
  // ============================================================================

  /**
   * Get WhatsApp ID for a phone number
   */
  async getNumberId(companyId: string, phoneNumber: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const numberId = await companyClient.client.getNumberId(phoneNumber);
      console.log(`[WhatsApp] Number ID retrieved for company ${companyId}: ${phoneNumber}`);
      return numberId;
    } catch (error) {
      console.error(`[WhatsApp] Error getting number ID for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a number is registered on WhatsApp
   */
  async isRegisteredUser(companyId: string, phoneNumber: string): Promise<boolean> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const numberId = await companyClient.client.getNumberId(phoneNumber);
      const isRegistered = numberId !== null && numberId !== undefined;
      console.log(`[WhatsApp] User registration check for company ${companyId}: ${phoneNumber} - ${isRegistered}`);
      return isRegistered;
    } catch (error) {
      console.error(`[WhatsApp] Error checking user registration for company ${companyId}:`, error);
      return false;
    }
  }

  /**
   * Block a contact
   */
  async blockContact(companyId: string, contactId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const contact = await companyClient.client.getContactById(contactId);
      await contact.block();
      console.log(`[WhatsApp] Contact blocked for company ${companyId}: ${contactId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error blocking contact for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unblock a contact
   */
  async unblockContact(companyId: string, contactId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const contact = await companyClient.client.getContactById(contactId);
      await contact.unblock();
      console.log(`[WhatsApp] Contact unblocked for company ${companyId}: ${contactId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error unblocking contact for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete contact profile with profile picture URL
   */
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

    try {
      const companyClient = await this.getClientForCompany(companyId);
      
      // Normalize the contact ID to ensure @c.us suffix
      const normalizedId = contactId.includes('@') ? contactId : `${contactId}@c.us`;
      
      const contact = await companyClient.client.getContactById(normalizedId);
      
      // Try to get profile picture URL (may fail silently)
      let profilePicUrl: string | null = null;
      try {
        profilePicUrl = await contact.getProfilePicUrl();
      } catch (e) {
        console.log(`[WhatsApp] Could not get profile pic for ${contactId}`);
      }

      console.log(`[WhatsApp] Contact profile retrieved for company ${companyId}: ${contactId}`);
      
      return {
        id: contact.id._serialized,
        name: contact.pushname || contact.name || contact.number,
        number: contact.number,
        profilePicUrl,
        isBlocked: contact.isBlocked || false,
        isBusiness: contact.isBusiness || false,
        pushname: contact.pushname || null,
      };
    } catch (error) {
      console.error(`[WhatsApp] Error getting contact profile for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Validate a phone number and check if it's registered on WhatsApp
   * Returns the WhatsApp ID if valid, null otherwise
   */
  async validateAndGetNumberId(companyId: string, phoneNumber: string): Promise<{
    isValid: boolean;
    whatsappId: string | null;
    formattedNumber: string;
  }> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      
      // Clean the phone number - remove everything except digits
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Get the WhatsApp number ID
      const numberId = await companyClient.client.getNumberId(cleanNumber);
      
      if (numberId) {
        console.log(`[WhatsApp] Valid WhatsApp number for company ${companyId}: ${cleanNumber}`);
        return {
          isValid: true,
          whatsappId: numberId._serialized,
          formattedNumber: numberId.user,
        };
      } else {
        console.log(`[WhatsApp] Invalid WhatsApp number for company ${companyId}: ${cleanNumber}`);
        return {
          isValid: false,
          whatsappId: null,
          formattedNumber: cleanNumber,
        };
      }
    } catch (error) {
      console.error(`[WhatsApp] Error validating number for company ${companyId}:`, error);
      return {
        isValid: false,
        whatsappId: null,
        formattedNumber: phoneNumber.replace(/\D/g, ''),
      };
    }
  }

  /**
   * Get chat from a contact
   */
  async getContactChat(companyId: string, contactId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const normalizedId = contactId.includes('@') ? contactId : `${contactId}@c.us`;
      const contact = await companyClient.client.getContactById(normalizedId);
      const chat = await contact.getChat();
      console.log(`[WhatsApp] Got chat for contact ${contactId}`);
      return chat;
    } catch (error) {
      console.error(`[WhatsApp] Error getting contact chat:`, error);
      throw error;
    }
  }

  // ============================================================================
  // GROUP OPERATIONS (ESENCIAL)
  // ============================================================================

  /**
   * Create a new group
   */
  async createGroup(companyId: string, title: string, participants: string[], options?: any): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const result = await companyClient.client.createGroup(title, participants, options);
      console.log(`[WhatsApp] Group created for company ${companyId}: ${title}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error creating group:`, error);
      throw error;
    }
  }

  /**
   * Accept a group invite and return the chat ID
   * @param companyId Company ID
   * @param inviteCode The invite code from a group invite link
   * @returns The chat ID of the joined group
   */
  async acceptInvite(companyId: string, inviteCode: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chatId = await companyClient.client.acceptInvite(inviteCode);
      console.log(`[WhatsApp] Group invite accepted for company ${companyId}: ${chatId}`);
      return chatId;
    } catch (error) {
      console.error(`[WhatsApp] Error accepting group invite:`, error);
      throw error;
    }
  }

  /**
   * Accept a private group invite (GroupV4)
   * @param companyId Company ID
   * @param inviteInfo The invite info object from a private group invite
   * @returns Object containing status of the invite acceptance
   */
  async acceptGroupV4Invite(companyId: string, inviteInfo: any): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const result = await companyClient.client.acceptGroupV4Invite(inviteInfo);
      console.log(`[WhatsApp] Private group invite (V4) accepted for company ${companyId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error accepting private group invite (V4):`, error);
      throw error;
    }
  }

  /**
   * Add participants to a group
   */
  async addParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.addParticipants(participants);
      console.log(`[WhatsApp] Participants added to group for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error adding participants for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Remove participants from a group
   */
  async removeParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.removeParticipants(participants);
      console.log(`[WhatsApp] Participants removed from group for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error removing participants for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Promote participants to group admins
   */
  async promoteParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.promoteParticipants(participants);
      console.log(`[WhatsApp] Participants promoted to admin for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error promoting participants for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Demote participants from group admins
   */
  async demoteParticipants(companyId: string, chatId: string, participants: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.demoteParticipants(participants);
      console.log(`[WhatsApp] Participants demoted from admin for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error demoting participants for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set group subject (name)
   */
  async setGroupSubject(companyId: string, chatId: string, subject: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.setSubject(subject);
      console.log(`[WhatsApp] Group subject updated for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting group subject for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set group description
   */
  async setGroupDescription(companyId: string, chatId: string, description: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.setDescription(description);
      console.log(`[WhatsApp] Group description updated for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting group description for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Leave a group
   */
  async leaveGroup(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.leave();
      console.log(`[WhatsApp] Left group for company ${companyId}: ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error leaving group for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set if only admins can send messages in a group
   */
  async setGroupMessagesAdminsOnly(companyId: string, chatId: string, adminsOnly: boolean = true): Promise<boolean> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      const result = await chat.setMessagesAdminsOnly(adminsOnly);
      console.log(`[WhatsApp] Set messages admins only to ${adminsOnly} for group ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error setting messages admins only:`, error);
      throw error;
    }
  }

  /**
   * Get pending group membership requests
   */
  async getGroupMembershipRequests(companyId: string, chatId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      const requests = await chat.getGroupMembershipRequests();
      console.log(`[WhatsApp] Group membership requests retrieved for company ${companyId}: ${chatId}`);
      return requests;
    } catch (error) {
      console.error(`[WhatsApp] Error getting membership requests for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Approve group membership requests
   * @param companyId Company ID
   * @param chatId Group chat ID
   * @param options Optional options with requesterIds to approve specific requests
   */
  async approveGroupMembershipRequests(
    companyId: string, 
    chatId: string, 
    options?: { requesterIds?: string[] }
  ): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      const result = await chat.approveGroupMembershipRequests(options);
      console.log(`[WhatsApp] Group membership requests approved for company ${companyId}: ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error approving membership requests for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Reject group membership requests
   * @param companyId Company ID
   * @param chatId Group chat ID
   * @param options Optional options with requesterIds to reject specific requests
   */
  async rejectGroupMembershipRequests(
    companyId: string, 
    chatId: string, 
    options?: { requesterIds?: string[] }
  ): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      const result = await chat.rejectGroupMembershipRequests(options);
      console.log(`[WhatsApp] Group membership requests rejected for company ${companyId}: ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error rejecting membership requests for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set if only admins can add members to the group
   */
  async setGroupAddMembersAdminsOnly(companyId: string, chatId: string, adminsOnly: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      await chat.setAddMembersAdminsOnly(adminsOnly);
      console.log(`[WhatsApp] Group add-members-admins-only setting updated for company ${companyId}: ${chatId} - ${adminsOnly}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting add-members-admins-only for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set if only admins can edit group info
   */
  async setGroupInfoAdminsOnly(companyId: string, chatId: string, adminsOnly: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      await chat.setInfoAdminsOnly(adminsOnly);
      console.log(`[WhatsApp] Group info-admins-only setting updated for company ${companyId}: ${chatId} - ${adminsOnly}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting info-admins-only for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set group profile picture
   * @param companyId Company ID
   * @param chatId Group chat ID
   * @param base64Image Base64 encoded image data
   */
  async setGroupPicture(companyId: string, chatId: string, base64Image: string): Promise<boolean> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      
      const { MessageMedia } = pkg;
      const media = new MessageMedia('image/jpeg', base64Image);
      const result = await chat.setPicture(media);
      
      console.log(`[WhatsApp] Group picture updated for company ${companyId}: ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error setting group picture for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete group profile picture
   */
  async deleteGroupPicture(companyId: string, chatId: string): Promise<boolean> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) throw new Error('Not a group chat');
      const result = await chat.deletePicture();
      console.log(`[WhatsApp] Group picture deleted for company ${companyId}: ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error deleting group picture for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get invite code info without joining the group
   * @param companyId Company ID
   * @param inviteCode The invite code (e.g., from a chat.whatsapp.com/XXX link)
   */
  async getInviteInfo(companyId: string, inviteCode: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const inviteInfo = await companyClient.client.getInviteInfo(inviteCode);
      console.log(`[WhatsApp] Invite info retrieved for company ${companyId}: ${inviteCode}`);
      return inviteInfo;
    } catch (error) {
      console.error(`[WhatsApp] Error getting invite info for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // SPECIAL CONTENT (CONTENIDO ESPECIAL)
  // ============================================================================

  /**
   * Send location message
   */
  async sendLocation(
    companyId: string, 
    chatId: string, 
    latitude: number, 
    longitude: number, 
    name?: string, 
    address?: string
  ): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const location = await companyClient.client.sendMessage(chatId, {
        location: {
          latitude,
          longitude,
          name,
          address,
        },
      } as any);
      console.log(`[WhatsApp] Location sent for company ${companyId} to ${chatId}`);
      return location;
    } catch (error) {
      console.error(`[WhatsApp] Error sending location for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send contact card
   */
  async sendContactCard(companyId: string, chatId: string, contactId: string | string[]): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      
      const contactIds = Array.isArray(contactId) ? contactId : [contactId];
      const contacts = await Promise.all(
        contactIds.map(id => companyClient.client.getContactById(id))
      );
      
      const sentMessage = await chat.sendMessage(contacts.length > 1 ? contacts : contacts[0]);
      console.log(`[WhatsApp] Contact card sent for company ${companyId} to ${chatId}`);
      return sentMessage;
    } catch (error) {
      console.error(`[WhatsApp] Error sending contact card for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send poll message
   */
  async sendPoll(
    companyId: string, 
    chatId: string, 
    question: string, 
    options: string[], 
    allowMultiple: boolean = false
  ): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const poll = await companyClient.client.sendMessage(chatId, {
        poll: {
          name: question,
          options: options.map(option => ({ name: option })),
          allowMultipleAnswers: allowMultiple,
        },
      } as any);
      console.log(`[WhatsApp] Poll sent for company ${companyId} to ${chatId}: "${question}"`);
      return poll;
    } catch (error) {
      console.error(`[WhatsApp] Error sending poll for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // HANDLER MANAGEMENT AND CLEANUP
  // ============================================================================

  /**
   * Register a message handler for a company
   */
  onMessage(companyId: string, id: string, handler: (message: any) => void): void {
    const companyClient = this.clients.get(companyId);
    if (companyClient) {
      companyClient.messageHandlers.set(id, handler);
    }
  }

  /**
   * Unregister a message handler for a company
   */
  offMessage(companyId: string, id: string): void {
    const companyClient = this.clients.get(companyId);
    if (companyClient) {
      companyClient.messageHandlers.delete(id);
    }
  }

  /**
   * Logout and destroy session for a specific company
   */
  async logout(companyId: string): Promise<void> {
    const companyClient = this.clients.get(companyId);
    if (!companyClient) {
      throw new Error('WhatsApp client is not initialized for this company');
    }

    try {
      console.log(`[WhatsApp] Logging out and destroying session for company: ${companyId}`);
      await companyClient.client.logout();
      await companyClient.client.destroy();
      
      // Remove from clients map
      this.clients.delete(companyId);
      
      this.emit('logout', { companyId });
      console.log(`[WhatsApp] Logged out successfully for company: ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Failed to logout for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Destroy the client for a specific company
   */
  async destroy(companyId: string): Promise<void> {
    const companyClient = this.clients.get(companyId);
    if (companyClient) {
      try {
        await companyClient.client.destroy();
        this.clients.delete(companyId);
        console.log(`[WhatsApp] Client destroyed for company: ${companyId}`);
      } catch (error) {
        console.error(`[WhatsApp] Failed to destroy client for company ${companyId}:`, error);
      }
    }
  }

  /**
   * Destroy all clients (for cleanup on server shutdown)
   */
  async destroyAll(): Promise<void> {
    console.log(`[WhatsApp] Destroying all ${this.clients.size} client instances`);
    const destroyPromises = Array.from(this.clients.keys()).map(companyId => 
      this.destroy(companyId)
    );
    await Promise.allSettled(destroyPromises);
    this.clients.clear();
  }

  // ============================================================================
  // ADDITIONAL FEATURES (STICKERS, INVITES, PROFILE SETTINGS, LABELS)
  // ============================================================================

  /**
   * Send a sticker
   */
  async sendSticker(companyId: string, chatId: string, stickerMedia: { data: string; mimetype: string }): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const { MessageMedia } = pkg;
      const media = new MessageMedia(stickerMedia.mimetype, stickerMedia.data);
      const chat = await companyClient.client.getChatById(chatId);
      const result = await chat.sendMessage(media, { sendMediaAsSticker: true });
      console.log(`[WhatsApp] Sticker sent for company ${companyId} to chat ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error sending sticker:`, error);
      throw error;
    }
  }

  /**
   * Join a group by invitation code
   */
  async joinGroupByInvite(companyId: string, inviteCode: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const result = await companyClient.client.acceptInvite(inviteCode);
      console.log(`[WhatsApp] Joined group by invite for company ${companyId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error joining group by invite:`, error);
      throw error;
    }
  }

  /**
   * Get group invitation code
   */
  async getGroupInviteCode(companyId: string, chatId: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) {
        throw new Error('Chat is not a group');
      }
      const inviteCode = await chat.getInviteCode();
      console.log(`[WhatsApp] Got invite code for company ${companyId} group ${chatId}`);
      return inviteCode;
    } catch (error) {
      console.error(`[WhatsApp] Error getting group invite code:`, error);
      throw error;
    }
  }

  /**
   * Revoke group invitation code (generates a new one)
   */
  async revokeGroupInvite(companyId: string, chatId: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      if (!chat.isGroup) {
        throw new Error('Chat is not a group');
      }
      const newInviteCode = await chat.revokeInvite();
      console.log(`[WhatsApp] Revoked invite code for company ${companyId} group ${chatId}`);
      return newInviteCode;
    } catch (error) {
      console.error(`[WhatsApp] Error revoking group invite:`, error);
      throw error;
    }
  }

  /**
   * Alias for revokeGroupInvite - exact match with documentation
   */
  async revokeGroupInviteCode(companyId: string, chatId: string): Promise<string> {
    return this.revokeGroupInvite(companyId, chatId);
  }

  /**
   * Set profile status/about message
   */
  async setStatus(companyId: string, status: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      await companyClient.client.setStatus(status);
      console.log(`[WhatsApp] Status set for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting status:`, error);
      throw error;
    }
  }

  /**
   * Set display name (profile name)
   */
  async setDisplayName(companyId: string, displayName: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      await companyClient.client.setDisplayName(displayName);
      console.log(`[WhatsApp] Display name set for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting display name:`, error);
      throw error;
    }
  }

  /**
   * Get labels (WhatsApp Business feature)
   */
  async getLabels(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const labels = await companyClient.client.getLabels();
      console.log(`[WhatsApp] Labels retrieved for company ${companyId}`);
      return labels;
    } catch (error) {
      console.error(`[WhatsApp] Error getting labels:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CHAT ADDITIONAL METHODS (CUSTOMER NOTES, LABELS, PINNED MESSAGES, SYNC)
  // ============================================================================

  /**
   * Add or edit customer note for a chat (WhatsApp Business feature)
   */
  async addOrEditCustomerNote(companyId: string, chatId: string, note: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.addOrEditCustomerNote(note);
      console.log(`[WhatsApp] Customer note updated for chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error updating customer note:`, error);
      throw error;
    }
  }

  /**
   * Get customer note for a chat (WhatsApp Business feature)
   */
  async getCustomerNote(companyId: string, chatId: string): Promise<string | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      const note = await chat.getCustomerNote();
      console.log(`[WhatsApp] Customer note retrieved for chat ${chatId}`);
      return note;
    } catch (error) {
      console.error(`[WhatsApp] Error getting customer note:`, error);
      throw error;
    }
  }

  /**
   * Get labels for a specific chat (WhatsApp Business feature)
   */
  async getChatLabels(companyId: string, chatId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      const labels = await chat.getLabels();
      console.log(`[WhatsApp] Labels retrieved for chat ${chatId}`);
      return labels || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting chat labels:`, error);
      throw error;
    }
  }

  /**
   * Change labels for a chat (WhatsApp Business feature)
   */
  async changeChatLabels(companyId: string, chatId: string, labelIds: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.changeLabels(labelIds);
      console.log(`[WhatsApp] Labels changed for chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error changing chat labels:`, error);
      throw error;
    }
  }

  /**
   * Get pinned messages from a chat (CLIENT-level API)
   */
  async getPinnedMessages(companyId: string, chatId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const pinnedMessages = await companyClient.client.getPinnedMessages(chatId);
      console.log(`[WhatsApp] Got pinned messages for company ${companyId}`);
      return pinnedMessages || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting pinned messages:`, error);
      throw error;
    }
  }

  /**
   * Get pinned messages for a specific chat (CHAT-level API)
   * Uses the chat object method to retrieve pinned messages
   */
  async getChatPinnedMessages(companyId: string, chatId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      const pinnedMessages = await chat.fetchMessages({ limit: 1000 });
      const pinned = pinnedMessages.filter((msg: any) => msg.isPinned);
      console.log(`[WhatsApp] Chat pinned messages retrieved for company ${companyId}, chat ${chatId}: ${pinned.length} messages`);
      return pinned;
    } catch (error) {
      console.error(`[WhatsApp] Error getting chat pinned messages for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Sync chat history
   */
  async syncHistory(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.syncHistory();
      console.log(`[WhatsApp] History synced for chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error syncing history:`, error);
      throw error;
    }
  }

  /**
   * Sync chat history (alias for syncHistory for consistent naming)
   */
  async syncChatHistory(companyId: string, chatId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.syncHistory();
      console.log(`[WhatsApp] Chat history synced for company ${companyId}, chat ${chatId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error syncing chat history for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get chat contact
   */
  async getChatContact(companyId: string, chatId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      const contact = await chat.getContact();
      console.log(`[WhatsApp] Contact retrieved for chat ${chatId}`);
      return contact;
    } catch (error) {
      console.error(`[WhatsApp] Error getting chat contact:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CLIENT STATE/PRESENCE FUNCTIONS
  // ============================================================================

  /**
   * Get client connection state
   */
  async getState(companyId: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const state = await companyClient.client.getState();
      console.log(`[WhatsApp] State retrieved for company ${companyId}: ${state}`);
      return state;
    } catch (error) {
      console.error(`[WhatsApp] Error getting state for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get WhatsApp Web version
   */
  async getWWebVersion(companyId: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const version = await companyClient.client.getWWebVersion();
      console.log(`[WhatsApp] WWeb version retrieved for company ${companyId}: ${version}`);
      return version;
    } catch (error) {
      console.error(`[WhatsApp] Error getting WWeb version for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send presence available (online status)
   */
  async sendPresenceAvailable(companyId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.sendPresenceAvailable();
      console.log(`[WhatsApp] Presence set to available for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending presence available for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send presence unavailable (offline status)
   */
  async sendPresenceUnavailable(companyId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.sendPresenceUnavailable();
      console.log(`[WhatsApp] Presence set to unavailable for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending presence unavailable for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get all blocked contacts
   */
  async getBlockedContacts(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const blockedContacts = await companyClient.client.getBlockedContacts();
      console.log(`[WhatsApp] Blocked contacts retrieved for company ${companyId}: ${blockedContacts?.length || 0} contacts`);
      return blockedContacts || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting blocked contacts for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get contact LID and phone for user IDs
   * @param companyId Company ID
   * @param userIds Array of user IDs to look up
   * @returns Array of contact LID and phone information
   */
  async getContactLidAndPhone(companyId: string, userIds: string[]): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const contactInfo = await companyClient.client.getContactLidAndPhone(userIds);
      console.log(`[WhatsApp] Contact LID and phone retrieved for company ${companyId}: ${userIds.length} users`);
      return contactInfo || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting contact LID and phone for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Create a call link for voice or video calls
   * @param companyId Company ID
   * @param startTime Optional start time for the call
   * @param callType Type of call: 'voice' or 'video'
   * @returns The created call link
   */
  async createCallLink(companyId: string, startTime?: Date, callType: 'voice' | 'video' = 'voice'): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const callLink = await companyClient.client.createCallLink(startTime, callType);
      console.log(`[WhatsApp] Call link created for company ${companyId}: type=${callType}`);
      return callLink;
    } catch (error) {
      console.error(`[WhatsApp] Error creating call link for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // LABEL FUNCTIONS
  // ============================================================================

  /**
   * Get label by ID (WhatsApp Business feature)
   */
  async getLabelById(companyId: string, labelId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const label = await companyClient.client.getLabelById(labelId);
      console.log(`[WhatsApp] Label retrieved for company ${companyId}: ${labelId}`);
      return label;
    } catch (error) {
      console.error(`[WhatsApp] Error getting label by ID for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get chats by label ID (WhatsApp Business feature)
   */
  async getChatsByLabelId(companyId: string, labelId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chats = await companyClient.client.getChatsByLabelId(labelId);
      console.log(`[WhatsApp] Chats by label retrieved for company ${companyId}: ${labelId} (${chats?.length || 0} chats)`);
      return chats || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting chats by label ID for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get chats using Label object's getChats method (WhatsApp Business feature)
   * This uses the Label instance method rather than Client method
   */
  async getLabelChats(companyId: string, labelId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const label = await companyClient.client.getLabelById(labelId);
      if (!label) {
        throw new Error(`Label not found: ${labelId}`);
      }
      const chats = await label.getChats();
      console.log(`[WhatsApp] Label chats retrieved for company ${companyId}: ${labelId} (${chats?.length || 0} chats)`);
      return chats || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting label chats for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CONTACT UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Get country code for a phone number
   */
  async getCountryCode(companyId: string, number: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const countryCode = await companyClient.client.getCountryCode(number);
      console.log(`[WhatsApp] Country code retrieved for company ${companyId}: ${number} -> ${countryCode}`);
      return countryCode;
    } catch (error) {
      console.error(`[WhatsApp] Error getting country code for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get formatted phone number
   */
  async getFormattedNumber(companyId: string, number: string): Promise<string> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const formattedNumber = await companyClient.client.getFormattedNumber(number);
      console.log(`[WhatsApp] Formatted number retrieved for company ${companyId}: ${number} -> ${formattedNumber}`);
      return formattedNumber;
    } catch (error) {
      console.error(`[WhatsApp] Error getting formatted number for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get contact's about/status message
   */
  async getContactAbout(companyId: string, contactId: string): Promise<string | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const normalizedId = this.normalizeWhatsAppId(contactId);
      const contact = await companyClient.client.getContactById(normalizedId);
      const about = await contact.getAbout();
      console.log(`[WhatsApp] About retrieved for company ${companyId}, contact ${contactId}`);
      return about || null;
    } catch (error) {
      console.error(`[WhatsApp] Error getting contact about for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // PHASE 2: PROFILE FUNCTIONS
  // ============================================================================

  /**
   * Set client's profile picture
   * @param companyId Company ID
   * @param media Base64 encoded image data (with or without data URI prefix)
   */
  async setProfilePicture(companyId: string, media: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const { MessageMedia } = pkg;
      
      let base64Data = media;
      let mimetype = 'image/jpeg';
      
      if (media.includes(',')) {
        const parts = media.split(',');
        const mimeMatch = parts[0].match(/data:([^;]+)/);
        if (mimeMatch) {
          mimetype = mimeMatch[1];
        }
        base64Data = parts[1];
      }
      
      const mediaObj = new MessageMedia(mimetype, base64Data, 'profile-picture');
      await companyClient.client.setProfilePicture(mediaObj);
      console.log(`[WhatsApp] Profile picture set for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting profile picture for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete client's profile picture
   * @param companyId Company ID
   */
  async deleteProfilePicture(companyId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.deleteProfilePicture();
      console.log(`[WhatsApp] Profile picture deleted for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error deleting profile picture for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // PHASE 2: ADDRESSBOOK FUNCTIONS
  // ============================================================================

  /**
   * Save or edit an addressbook contact
   * @param companyId Company ID
   * @param phoneNumber Phone number of the contact
   * @param firstName First name of the contact
   * @param lastName Last name of the contact (optional)
   * @param syncToAddressbook Whether to sync to phone's addressbook
   */
  async saveOrEditAddressbookContact(
    companyId: string,
    phoneNumber: string,
    firstName: string,
    lastName?: string,
    syncToAddressbook: boolean = false
  ): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      const contactId = this.normalizeWhatsAppId(cleanNumber);
      
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;
      
      const result = await companyClient.client.addOrModifyContact(
        contactId,
        fullName,
        { syncToAddressbook }
      );
      
      console.log(`[WhatsApp] Addressbook contact saved/edited for company ${companyId}: ${phoneNumber} -> ${fullName}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error saving/editing addressbook contact for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an addressbook contact
   * @param companyId Company ID
   * @param phoneNumber Phone number of the contact to delete
   */
  async deleteAddressbookContact(companyId: string, phoneNumber: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      const contactId = this.normalizeWhatsAppId(cleanNumber);
      
      await companyClient.client.removeContact(contactId);
      console.log(`[WhatsApp] Addressbook contact deleted for company ${companyId}: ${phoneNumber}`);
    } catch (error) {
      console.error(`[WhatsApp] Error deleting addressbook contact for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // PHASE 2: CONTACT INFO FUNCTIONS
  // ============================================================================

  /**
   * Get common groups with a contact
   * @param companyId Company ID
   * @param contactId Contact ID or phone number
   * @returns Array of common groups
   */
  async getCommonGroups(companyId: string, contactId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const normalizedId = this.normalizeWhatsAppId(contactId);
      const contact = await companyClient.client.getContactById(normalizedId);
      const commonGroups = await contact.getCommonGroups();
      console.log(`[WhatsApp] Common groups retrieved for company ${companyId}, contact ${contactId}: ${commonGroups?.length || 0} groups`);
      return commonGroups || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting common groups for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get device count for a contact (number of devices/sessions)
   * @param companyId Company ID
   * @param userId User ID or phone number
   * @returns Number of devices registered for this user
   */
  async getContactDeviceCount(companyId: string, userId: string): Promise<number> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const cleanNumber = userId.replace(/\D/g, '');
      const deviceCount = await companyClient.client.getContactDeviceCount(cleanNumber);
      console.log(`[WhatsApp] Device count retrieved for company ${companyId}, user ${userId}: ${deviceCount}`);
      return deviceCount || 0;
    } catch (error) {
      console.error(`[WhatsApp] Error getting device count for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CHANNEL OPERATIONS
  // ============================================================================

  // -------------------- CHANNEL BASIC FUNCTIONS --------------------

  /**
   * Get all channels
   * @param companyId Company ID
   * @returns Array of channels
   */
  async getChannels(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channels = await companyClient.client.getChannels();
      console.log(`[WhatsApp] Channels retrieved for company ${companyId}: ${channels?.length || 0} channels`);
      return channels || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting channels for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new channel
   * @param companyId Company ID
   * @param title Channel title/name
   * @param options Optional channel creation options (description, picture, etc.)
   * @returns Created channel object
   */
  async createChannel(companyId: string, title: string, options?: {
    description?: string;
    picture?: string;
  }): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.createChannel(title, options);
      console.log(`[WhatsApp] Channel created for company ${companyId}: ${title}`);
      return channel;
    } catch (error) {
      console.error(`[WhatsApp] Error creating channel for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a channel
   * @param companyId Company ID
   * @param channelId Channel ID to delete
   */
  async deleteChannel(companyId: string, channelId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      await channel.delete();
      console.log(`[WhatsApp] Channel deleted for company ${companyId}: ${channelId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error deleting channel for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get channel by invite code
   * @param companyId Company ID
   * @param inviteCode Channel invite code
   * @returns Channel object
   */
  async getChannelByInviteCode(companyId: string, inviteCode: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChannelByInviteCode(inviteCode);
      console.log(`[WhatsApp] Channel retrieved by invite code for company ${companyId}: ${inviteCode}`);
      return channel;
    } catch (error) {
      console.error(`[WhatsApp] Error getting channel by invite code for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Search for channels
   * @param companyId Company ID
   * @param searchOptions Search options (name, countryCodes, view count range, etc.)
   * @returns Array of matching channels
   */
  async searchChannels(companyId: string, searchOptions: {
    name?: string;
    countryCodes?: string[];
    view?: [number, number];
    sort?: string;
    limit?: number;
  }): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channels = await companyClient.client.searchChannels(searchOptions);
      console.log(`[WhatsApp] Channels searched for company ${companyId}: found ${channels?.length || 0} channels`);
      return channels || [];
    } catch (error) {
      console.error(`[WhatsApp] Error searching channels for company ${companyId}:`, error);
      throw error;
    }
  }

  // -------------------- CHANNEL SUBSCRIPTION --------------------

  /**
   * Subscribe to a channel
   * @param companyId Company ID
   * @param channelId Channel ID to subscribe to
   * @returns Subscription result
   */
  async subscribeToChannel(companyId: string, channelId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const result = await channel.subscribe();
      console.log(`[WhatsApp] Subscribed to channel for company ${companyId}: ${channelId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error subscribing to channel for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a channel
   * @param companyId Company ID
   * @param channelId Channel ID to unsubscribe from
   * @returns Unsubscription result
   */
  async unsubscribeFromChannel(companyId: string, channelId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const result = await channel.unsubscribe();
      console.log(`[WhatsApp] Unsubscribed from channel for company ${companyId}: ${channelId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error unsubscribing from channel for company ${companyId}:`, error);
      throw error;
    }
  }

  // -------------------- CHANNEL MESSAGES --------------------

  /**
   * Get channel messages
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param limit Number of messages to fetch (default: 50)
   * @returns Array of channel messages
   */
  async getChannelMessages(companyId: string, channelId: string, limit: number = 50): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const messages = await channel.fetchMessages({ limit });
      console.log(`[WhatsApp] Channel messages retrieved for company ${companyId}: ${channelId} (${messages?.length || 0} messages)`);
      return messages || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting channel messages for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Alias for getChannelMessages - exact match with Channel.fetchMessages documentation
   */
  async fetchChannelMessages(companyId: string, channelId: string, limit: number = 50): Promise<any[]> {
    return this.getChannelMessages(companyId, channelId, limit);
  }

  /**
   * Send message to a channel
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param content Message content (text, media, etc.)
   * @returns Sent message object
   */
  async sendChannelMessage(companyId: string, channelId: string, content: string | any): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const message = await channel.sendMessage(content);
      console.log(`[WhatsApp] Message sent to channel for company ${companyId}: ${channelId}`);
      return message;
    } catch (error) {
      console.error(`[WhatsApp] Error sending message to channel for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Mark channel as seen
   * @param companyId Company ID
   * @param channelId Channel ID
   */
  async sendChannelSeen(companyId: string, channelId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      await channel.sendSeen();
      console.log(`[WhatsApp] Channel marked as seen for company ${companyId}: ${channelId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error marking channel as seen for company ${companyId}:`, error);
      throw error;
    }
  }

  // -------------------- CHANNEL SETTINGS --------------------

  /**
   * Update channel title/subject
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param subject New channel title/subject
   */
  async setChannelSubject(companyId: string, channelId: string, subject: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      await channel.setSubject(subject);
      console.log(`[WhatsApp] Channel subject updated for company ${companyId}: ${channelId} -> ${subject}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting channel subject for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Update channel description
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param description New channel description
   */
  async setChannelDescription(companyId: string, channelId: string, description: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      await channel.setDescription(description);
      console.log(`[WhatsApp] Channel description updated for company ${companyId}: ${channelId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting channel description for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set channel profile picture
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param base64Image Base64 encoded image data (with or without data URI prefix)
   */
  async setChannelPicture(companyId: string, channelId: string, base64Image: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const { MessageMedia } = pkg;
      
      let base64Data = base64Image;
      let mimetype = 'image/jpeg';
      
      if (base64Image.includes(',')) {
        const parts = base64Image.split(',');
        const mimeMatch = parts[0].match(/data:([^;]+)/);
        if (mimeMatch) {
          mimetype = mimeMatch[1];
        }
        base64Data = parts[1];
      }
      
      const media = new MessageMedia(mimetype, base64Data, 'channel-picture');
      const channel = await companyClient.client.getChatById(channelId);
      await channel.setPicture(media);
      console.log(`[WhatsApp] Channel picture set for company ${companyId}: ${channelId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting channel picture for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set channel reaction settings
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param reactionCode Reaction setting code (0=none, 1=basic, 2=all)
   */
  async setChannelReactionSetting(companyId: string, channelId: string, reactionCode: 0 | 1 | 2): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      await channel.setReactionSetting(reactionCode);
      const settingNames = { 0: 'none', 1: 'basic', 2: 'all' };
      console.log(`[WhatsApp] Channel reaction setting updated for company ${companyId}: ${channelId} -> ${settingNames[reactionCode]}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting channel reaction setting for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Mute channel notifications
   * @param companyId Company ID
   * @param channelId Channel ID
   */
  async muteChannel(companyId: string, channelId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      await channel.mute();
      console.log(`[WhatsApp] Channel muted for company ${companyId}: ${channelId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error muting channel for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Unmute channel notifications
   * @param companyId Company ID
   * @param channelId Channel ID
   */
  async unmuteChannel(companyId: string, channelId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      await channel.unmute();
      console.log(`[WhatsApp] Channel unmuted for company ${companyId}: ${channelId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error unmuting channel for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get channel subscribers
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param limit Maximum number of subscribers to fetch
   * @returns Array of channel subscribers
   */
  async getChannelSubscribers(companyId: string, channelId: string, limit?: number): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const subscribers = await channel.getSubscribers(limit);
      console.log(`[WhatsApp] Channel subscribers retrieved for company ${companyId}: ${channelId} (${subscribers?.length || 0} subscribers)`);
      return subscribers || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting channel subscribers for company ${companyId}:`, error);
      throw error;
    }
  }

  // -------------------- CHANNEL ADMIN --------------------

  /**
   * Send admin invite to a user for a channel
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param chatId User's chat ID to invite as admin
   * @returns Invite result
   */
  async sendChannelAdminInvite(companyId: string, channelId: string, chatId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const result = await channel.sendAdminInvite(chatId);
      console.log(`[WhatsApp] Admin invite sent for channel for company ${companyId}: ${channelId} -> ${chatId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error sending admin invite for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Accept admin invite for a channel
   * @param companyId Company ID
   * @param channelId Channel ID
   * @returns Accept result
   */
  async acceptChannelAdminInvite(companyId: string, channelId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const result = await channel.acceptAdminInvite();
      console.log(`[WhatsApp] Admin invite accepted for channel for company ${companyId}: ${channelId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error accepting admin invite for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Revoke admin invite for a user
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param userId User ID whose invite to revoke
   * @returns Revoke result
   */
  async revokeChannelAdminInvite(companyId: string, channelId: string, userId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const result = await channel.revokeAdminInvite(userId);
      console.log(`[WhatsApp] Admin invite revoked for channel for company ${companyId}: ${channelId} -> ${userId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error revoking admin invite for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Demote a channel admin
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param userId User ID to demote
   * @returns Demote result
   */
  async demoteChannelAdmin(companyId: string, channelId: string, userId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const result = await channel.demoteAdmin(userId);
      console.log(`[WhatsApp] Admin demoted for channel for company ${companyId}: ${channelId} -> ${userId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error demoting admin for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Transfer channel ownership to another user
   * @param companyId Company ID
   * @param channelId Channel ID
   * @param newOwnerId New owner's user ID
   * @returns Transfer result
   */
  async transferChannelOwnership(companyId: string, channelId: string, newOwnerId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const channel = await companyClient.client.getChatById(channelId);
      const result = await channel.transferOwnership(newOwnerId);
      console.log(`[WhatsApp] Channel ownership transferred for company ${companyId}: ${channelId} -> ${newOwnerId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error transferring channel ownership for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============ BROADCAST OPERATIONS ============

  /**
   * Get all broadcast lists for a company
   * @param companyId Company ID
   * @returns Array of broadcast lists
   */
  async getBroadcasts(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const broadcasts = await companyClient.client.getBroadcasts();
      console.log(`[WhatsApp] Broadcasts retrieved for company ${companyId}: ${broadcasts?.length || 0} broadcasts`);
      return broadcasts || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting broadcasts for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get chat for a specific broadcast list
   * @param companyId Company ID
   * @param broadcastId Broadcast list ID
   * @returns Broadcast chat object
   */
  async getBroadcastChat(companyId: string, broadcastId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const chat = await companyClient.client.getChatById(broadcastId);
      console.log(`[WhatsApp] Broadcast chat retrieved for company ${companyId}: ${broadcastId}`);
      return chat;
    } catch (error) {
      console.error(`[WhatsApp] Error getting broadcast chat for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get contact info for a broadcast list
   * @param companyId Company ID
   * @param broadcastId Broadcast list ID
   * @returns Broadcast contact object
   */
  async getBroadcastContact(companyId: string, broadcastId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const contact = await companyClient.client.getContactById(broadcastId);
      console.log(`[WhatsApp] Broadcast contact retrieved for company ${companyId}: ${broadcastId}`);
      return contact;
    } catch (error) {
      console.error(`[WhatsApp] Error getting broadcast contact for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============ CALL OPERATIONS ============

  /**
   * Reject an incoming call
   * Note: This requires having the Call object from the 'call' event
   * @param companyId Company ID
   * @param callId Call ID to reject
   */
  async rejectCall(companyId: string, callId: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const call = await companyClient.client.getCallById(callId);
      if (!call) {
        throw new Error('Call not found');
      }
      await call.reject();
      console.log(`[WhatsApp] Call rejected for company ${companyId}: ${callId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error rejecting call for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============ AUTO-DOWNLOAD SETTINGS ============

  /**
   * Set auto-download audio setting
   * @param companyId Company ID
   * @param flag Enable or disable auto-download
   */
  async setAutoDownloadAudio(companyId: string, flag: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.setAutoDownloadAudio(flag);
      console.log(`[WhatsApp] Auto-download audio set to ${flag} for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting auto-download audio for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set auto-download documents setting
   * @param companyId Company ID
   * @param flag Enable or disable auto-download
   */
  async setAutoDownloadDocuments(companyId: string, flag: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.setAutoDownloadDocuments(flag);
      console.log(`[WhatsApp] Auto-download documents set to ${flag} for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting auto-download documents for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set auto-download photos setting
   * @param companyId Company ID
   * @param flag Enable or disable auto-download
   */
  async setAutoDownloadPhotos(companyId: string, flag: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.setAutoDownloadPhotos(flag);
      console.log(`[WhatsApp] Auto-download photos set to ${flag} for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting auto-download photos for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set auto-download videos setting
   * @param companyId Company ID
   * @param flag Enable or disable auto-download
   */
  async setAutoDownloadVideos(companyId: string, flag: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.setAutoDownloadVideos(flag);
      console.log(`[WhatsApp] Auto-download videos set to ${flag} for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting auto-download videos for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set background sync setting
   * @param companyId Company ID
   * @param flag Enable or disable background sync
   */
  async setBackgroundSync(companyId: string, flag: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.setBackgroundSync(flag);
      console.log(`[WhatsApp] Background sync set to ${flag} for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting background sync for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CLIENT PROFILE OPERATIONS
  // ============================================================================

  /**
   * Set display name for the WhatsApp client
   * @param companyId Company ID
   * @param displayName The display name to set
   */
  async setDisplayName(companyId: string, displayName: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.setDisplayName(displayName);
      console.log(`[WhatsApp] Display name set for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting display name for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Set status message for the WhatsApp client
   * @param companyId Company ID
   * @param status The status message to set
   */
  async setStatus(companyId: string, status: string): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.setStatus(status);
      console.log(`[WhatsApp] Status set for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting status for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Request a pairing code for phone number authentication (alternative to QR)
   * @param companyId Company ID
   * @param phoneNumber Phone number to request pairing code for (in international format without +)
   * @param showNotification Whether to show notification on phone
   * @param intervalMs Interval in ms to wait before sending another code
   * @returns The pairing code
   */
  async requestPairingCode(companyId: string, phoneNumber: string, showNotification: boolean = true, intervalMs?: number): Promise<string> {
    const companyClient = this.clients.get(companyId);
    if (!companyClient) {
      throw new Error('WhatsApp client not found for company');
    }
    try {
      const code = await companyClient.client.requestPairingCode(phoneNumber, showNotification, intervalMs);
      console.log(`[WhatsApp] Pairing code requested for company ${companyId}`);
      return code;
    } catch (error) {
      console.error(`[WhatsApp] Error requesting pairing code for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Reset the client state (useful for troubleshooting connection issues)
   * @param companyId Company ID
   */
  async resetState(companyId: string): Promise<void> {
    const companyClient = this.clients.get(companyId);
    if (!companyClient) {
      throw new Error('WhatsApp client not found for company');
    }
    try {
      await companyClient.client.resetState();
      console.log(`[WhatsApp] State reset for company ${companyId}`);
    } catch (error) {
      console.error(`[WhatsApp] Error resetting state for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // LABEL OPERATIONS (WhatsApp Business)
  // ============================================================================

  /**
   * Get all labels (WhatsApp Business feature)
   * @param companyId Company ID
   * @returns Array of labels
   */
  async getLabels(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const labels = await companyClient.client.getLabels();
      console.log(`[WhatsApp] Labels retrieved for company ${companyId}: ${labels?.length || 0} labels`);
      return labels || [];
    } catch (error) {
      console.error(`[WhatsApp] Error getting labels for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Add or remove labels from chats (WhatsApp Business feature)
   * @param companyId Company ID
   * @param labelIds Array of label IDs to add/remove
   * @param chatIds Array of chat IDs to apply labels to
   */
  async addOrRemoveLabels(companyId: string, labelIds: string[], chatIds: string[]): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      await companyClient.client.addOrRemoveLabels(labelIds, chatIds);
      console.log(`[WhatsApp] Labels modified for company ${companyId}: ${labelIds.length} labels on ${chatIds.length} chats`);
    } catch (error) {
      console.error(`[WhatsApp] Error adding/removing labels for company ${companyId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CLIENT OPERATIONS (WhatsApp Business)
  // ============================================================================

  /**
   * Get customer note for a user (WhatsApp Business feature)
   * @param companyId Company ID
   * @param userId The user ID to get the note for
   * @returns The customer note or null if not found
   */
  async getCustomerNote(companyId: string, userId: string): Promise<any | null> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const note = await companyClient.client.getCustomerNote(userId);
      console.log(`[WhatsApp] Got customer note for company ${companyId}`);
      return note;
    } catch (error) {
      console.error(`[WhatsApp] Error getting customer note:`, error);
      throw error;
    }
  }

  /**
   * Add or edit customer note for a user (WhatsApp Business feature)
   * @param companyId Company ID
   * @param userId The user ID to set the note for
   * @param note The note content to add or edit
   * @returns The result of the operation
   */
  async addOrEditCustomerNote(companyId: string, userId: string, note: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const result = await companyClient.client.addOrEditCustomerNote(userId, note);
      console.log(`[WhatsApp] Added/edited customer note for company ${companyId}, user ${userId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error adding/editing customer note for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send a response to a scheduled event (WhatsApp Business feature)
   * @param companyId Company ID
   * @param response The response to send ('going', 'notGoing', or 'maybe')
   * @param eventMessageId The message ID of the scheduled event
   * @returns The result of the operation
   */
  async sendResponseToScheduledEvent(companyId: string, response: 'going' | 'notGoing' | 'maybe', eventMessageId: string): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }
    const companyClient = this.clients.get(companyId)!;
    try {
      const result = await companyClient.client.sendResponseToScheduledEvent(response, eventMessageId);
      console.log(`[WhatsApp] Sent response '${response}' to scheduled event for company ${companyId}, event ${eventMessageId}`);
      return result;
    } catch (error) {
      console.error(`[WhatsApp] Error sending response to scheduled event for company ${companyId}:`, error);
      throw error;
    }
  }
}

// Export singleton service instance (but now it manages multiple clients internally)
export const whatsappService = new WhatsAppService();

// No auto-initialization - clients are created on-demand per company
console.log('[WhatsApp] Multi-tenant WhatsApp service initialized');
