import { Client, LocalAuth, Message, Chat, Contact } from 'whatsapp-web.js';
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

class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private sessionStatus: WhatsAppSessionStatus = {
    isReady: false,
    isAuthenticated: false,
    qrCode: null,
    status: 'disconnected',
  };
  private messageHandlers: Map<string, (message: Message) => void> = new Map();

  constructor() {
    super();
  }

  /**
   * Initialize WhatsApp client with session persistence
   */
  async initialize(): Promise<void> {
    if (this.client) {
      console.log('[WhatsApp] Client already initialized');
      return;
    }

    console.log('[WhatsApp] Initializing client with session persistence');

    // Create client with LocalAuth strategy for session persistence
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth',
      }),
      puppeteer: {
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

    // Set up event handlers
    this.setupEventHandlers();

    // Initialize the client
    try {
      await this.client.initialize();
      console.log('[WhatsApp] Client initialization started');
    } catch (error) {
      console.error('[WhatsApp] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Set up WhatsApp client event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    // QR code received - need to scan
    this.client.on('qr', async (qr: string) => {
      console.log('[WhatsApp] QR Code received');
      
      // Generate QR code as data URL for frontend
      try {
        const qrDataUrl = await qrcode.toDataURL(qr);
        this.sessionStatus.qrCode = qrDataUrl;
        this.sessionStatus.status = 'qr_received';
        this.sessionStatus.isAuthenticated = false;
        this.sessionStatus.isReady = false;
        
        // Also log to terminal for debugging
        qrcodeTerminal.generate(qr, { small: true });
        
        this.emit('qr', qrDataUrl);
      } catch (error) {
        console.error('[WhatsApp] Failed to generate QR code:', error);
      }
    });

    // Client authenticated
    this.client.on('authenticated', () => {
      console.log('[WhatsApp] Client authenticated');
      this.sessionStatus.isAuthenticated = true;
      this.sessionStatus.status = 'authenticated';
      this.sessionStatus.qrCode = null;
      this.emit('authenticated');
    });

    // Authentication failure
    this.client.on('auth_failure', (msg: string) => {
      console.error('[WhatsApp] Authentication failure:', msg);
      this.sessionStatus.isAuthenticated = false;
      this.sessionStatus.status = 'disconnected';
      this.emit('auth_failure', msg);
    });

    // Client is ready
    this.client.on('ready', () => {
      console.log('[WhatsApp] Client is ready');
      this.sessionStatus.isReady = true;
      this.sessionStatus.isAuthenticated = true;
      this.sessionStatus.status = 'ready';
      this.sessionStatus.qrCode = null;
      this.emit('ready');
    });

    // Incoming message
    this.client.on('message', async (message: Message) => {
      console.log('[WhatsApp] Message received:', message.from, message.body);
      this.emit('message', message);
      
      // Call registered message handlers
      for (const handler of this.messageHandlers.values()) {
        try {
          handler(message);
        } catch (error) {
          console.error('[WhatsApp] Error in message handler:', error);
        }
      }
    });

    // Message acknowledgement (status update)
    this.client.on('message_ack', (message: Message, ack: number) => {
      // ack values: 0 = error, 1 = pending, 2 = server received, 3 = delivered, 4 = read
      const statusMap: { [key: number]: string } = {
        0: 'failed',
        1: 'pending',
        2: 'sent',
        3: 'delivered',
        4: 'read',
      };
      
      const status = statusMap[ack] || 'pending';
      console.log('[WhatsApp] Message status update:', message.id._serialized, status);
      this.emit('message_status', { messageId: message.id._serialized, status });
    });

    // Disconnected
    this.client.on('disconnected', (reason: string) => {
      console.log('[WhatsApp] Client disconnected:', reason);
      this.sessionStatus.isReady = false;
      this.sessionStatus.isAuthenticated = false;
      this.sessionStatus.status = 'disconnected';
      this.sessionStatus.qrCode = null;
      this.emit('disconnected', reason);
    });

    // Loading screen
    this.client.on('loading_screen', (percent: number, message: string) => {
      console.log('[WhatsApp] Loading:', percent, message);
    });
  }

  /**
   * Get current session status
   */
  getSessionStatus(): WhatsAppSessionStatus {
    return { ...this.sessionStatus };
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.sessionStatus.isReady && this.client !== null;
  }

  /**
   * Get all contacts
   */
  async getContacts(): Promise<Contact[]> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contacts = await this.client.getContacts();
      // Filter out group chats and return only individual contacts
      return contacts.filter(contact => !contact.isGroup);
    } catch (error) {
      console.error('[WhatsApp] Failed to get contacts:', error);
      throw error;
    }
  }

  /**
   * Get all chats
   */
  async getChats(): Promise<Chat[]> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chats = await this.client.getChats();
      return chats;
    } catch (error) {
      console.error('[WhatsApp] Failed to get chats:', error);
      throw error;
    }
  }

  /**
   * Get messages for a specific chat
   */
  async getChatMessages(chatId: string, limit: number = 50): Promise<Message[]> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      return messages;
    } catch (error) {
      console.error('[WhatsApp] Failed to get chat messages:', error);
      throw error;
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(to: string, message: string): Promise<Message> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Ensure the number is in the correct format (e.g., "1234567890@c.us")
      const chatId = to.includes('@') ? to : `${to}@c.us`;
      const sentMessage = await this.client.sendMessage(chatId, message);
      console.log('[WhatsApp] Message sent to', chatId);
      return sentMessage;
    } catch (error) {
      console.error('[WhatsApp] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send a message with media
   */
  async sendMediaMessage(to: string, media: any, caption?: string): Promise<Message> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chatId = to.includes('@') ? to : `${to}@c.us`;
      const sentMessage = await this.client.sendMessage(chatId, media, { caption });
      console.log('[WhatsApp] Media message sent to', chatId);
      return sentMessage;
    } catch (error) {
      console.error('[WhatsApp] Failed to send media message:', error);
      throw error;
    }
  }

  /**
   * Mark chat as read
   */
  async markChatAsRead(chatId: string): Promise<void> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chat = await this.client.getChatById(chatId);
      await chat.sendSeen();
      console.log('[WhatsApp] Chat marked as read:', chatId);
    } catch (error) {
      console.error('[WhatsApp] Failed to mark chat as read:', error);
      throw error;
    }
  }

  /**
   * Get contact by ID
   */
  async getContactById(contactId: string): Promise<Contact | null> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contact = await this.client.getContactById(contactId);
      return contact;
    } catch (error) {
      console.error('[WhatsApp] Failed to get contact:', error);
      return null;
    }
  }

  /**
   * Get profile picture URL for a contact
   */
  async getProfilePicUrl(contactId: string): Promise<string | null> {
    if (!this.isReady() || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const profilePicUrl = await this.client.getProfilePicUrl(contactId);
      return profilePicUrl || null;
    } catch (error) {
      console.error('[WhatsApp] Failed to get profile picture:', error);
      return null;
    }
  }

  /**
   * Register a message handler
   */
  onMessage(id: string, handler: (message: Message) => void): void {
    this.messageHandlers.set(id, handler);
  }

  /**
   * Unregister a message handler
   */
  offMessage(id: string): void {
    this.messageHandlers.delete(id);
  }

  /**
   * Logout and destroy session
   */
  async logout(): Promise<void> {
    if (!this.client) {
      throw new Error('WhatsApp client is not initialized');
    }

    try {
      console.log('[WhatsApp] Logging out and destroying session');
      await this.client.logout();
      await this.client.destroy();
      
      this.client = null;
      this.sessionStatus = {
        isReady: false,
        isAuthenticated: false,
        qrCode: null,
        status: 'disconnected',
      };
      
      this.emit('logout');
      console.log('[WhatsApp] Logged out successfully');
    } catch (error) {
      console.error('[WhatsApp] Failed to logout:', error);
      throw error;
    }
  }

  /**
   * Destroy the client
   */
  async destroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
        this.client = null;
        this.sessionStatus = {
          isReady: false,
          isAuthenticated: false,
          qrCode: null,
          status: 'disconnected',
        };
        console.log('[WhatsApp] Client destroyed');
      } catch (error) {
        console.error('[WhatsApp] Failed to destroy client:', error);
      }
    }
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();

// Auto-initialize on server start
(async () => {
  try {
    await whatsappService.initialize();
  } catch (error) {
    console.error('[WhatsApp] Failed to auto-initialize:', error);
  }
})();
