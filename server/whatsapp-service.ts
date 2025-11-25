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
  client: Client;
  status: WhatsAppSessionStatus;
  messageHandlers: Map<string, (message: Message) => void>;
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
    client.on('message', async (message: Message) => {
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
    client.on('message_ack', (message: Message, ack: number) => {
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
  async getContacts(companyId: string): Promise<Contact[]> {
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
  async getChats(companyId: string): Promise<Chat[]> {
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
  async getChatMessages(companyId: string, chatId: string, limit: number = 50): Promise<Message[]> {
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
  async sendMessage(companyId: string, to: string, message: string): Promise<Message> {
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
  async sendMediaMessage(companyId: string, to: string, media: any, caption?: string): Promise<Message> {
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
  async getContactById(companyId: string, contactId: string): Promise<Contact | null> {
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

  /**
   * Register a message handler for a company
   */
  onMessage(companyId: string, id: string, handler: (message: Message) => void): void {
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
