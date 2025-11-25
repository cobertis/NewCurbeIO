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

  constructor() {
    super();
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

    // Disconnected
    client.on('disconnected', (reason: string) => {
      console.log(`[WhatsApp] Client disconnected for company ${companyId}:`, reason);
      status.isReady = false;
      status.isAuthenticated = false;
      status.status = 'disconnected';
      status.qrCode = null;
      this.emit('disconnected', { companyId, reason });
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
   * Get all contacts for a company
   */
  async getContacts(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const contacts = await companyClient.client.getContacts();
      // Filter out group chats and return only individual contacts
      return contacts.filter(contact => !contact.isGroup);
    } catch (error) {
      console.error(`[WhatsApp] Failed to get contacts for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get all chats for a company
   */
  async getChats(companyId: string): Promise<any[]> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const companyClient = this.clients.get(companyId)!;

    try {
      const chats = await companyClient.client.getChats();
      return chats;
    } catch (error) {
      console.error(`[WhatsApp] Failed to get chats for company ${companyId}:`, error);
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
      return messages;
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

  // ============================================================================
  // GROUP OPERATIONS (ESENCIAL)
  // ============================================================================

  /**
   * Create a new group
   */
  async createGroup(companyId: string, name: string, participants: string[]): Promise<any> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const group = await companyClient.client.createGroup(name, participants);
      console.log(`[WhatsApp] Group created for company ${companyId}: ${name}`);
      return group;
    } catch (error) {
      console.error(`[WhatsApp] Error creating group for company ${companyId}:`, error);
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
   * Set group to admins-only messaging
   */
  async setGroupMessagesAdminsOnly(companyId: string, chatId: string, adminsOnly: boolean): Promise<void> {
    if (!this.isReady(companyId)) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const companyClient = await this.getClientForCompany(companyId);
      const chat = await companyClient.client.getChatById(chatId);
      await chat.setMessagesAdminsOnly(adminsOnly);
      console.log(`[WhatsApp] Group admins-only setting updated for company ${companyId}: ${chatId} - ${adminsOnly}`);
    } catch (error) {
      console.error(`[WhatsApp] Error setting group admins-only for company ${companyId}:`, error);
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
}

// Export singleton service instance (but now it manages multiple clients internally)
export const whatsappService = new WhatsAppService();

// No auto-initialization - clients are created on-demand per company
console.log('[WhatsApp] Multi-tenant WhatsApp service initialized');
