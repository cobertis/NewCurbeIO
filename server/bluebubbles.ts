import type { CompanySettings } from "@shared/schema";
import { blacklistService } from "./services/blacklist-service";
import { storage } from "./storage";

/**
 * Extract phone number from iMessage chatGuid
 * Format: "iMessage;-;+13105551234" or "SMS;-;+13105551234"
 * Returns the phone number or null if not found
 */
function extractPhoneFromChatGuid(chatGuid: string): string | null {
  const parts = chatGuid.split(';-;');
  if (parts.length >= 2) {
    return parts[1];
  }
  return null;
}

interface BlueBubblesConfig {
  serverUrl: string;
  password: string;
}

interface SendMessageRequest {
  chatGuid: string;
  message: string;
  method?: 'private-api' | 'apple-script';
  subject?: string;
  effectId?: string;
  selectedMessageGuid?: string; // For replies
  partIndex?: number; // For replies (default: 0)
  tempGuid?: string; // For webhook reconciliation
}

interface SendMessageResponse {
  status: number;
  message: string;
  data: {
    guid: string;
    chatGuid: string;
    message: string;
    dateCreated: number;
  };
}

interface SendReactionRequest {
  chatGuid: string;
  messageGuid: string;
  reaction: string;
  remove?: boolean;
}

interface Chat {
  guid: string;
  chatIdentifier: string;
  displayName: string;
  participants: string[];
  lastMessage?: {
    guid: string;
    text: string;
    dateCreated: number;
    isFromMe: boolean;
    dateRead?: number;
  };
}

interface Message {
  guid: string;
  text: string;
  subject?: string;
  dateCreated: number;
  dateRead?: number;
  dateDelivered?: number;
  isFromMe: boolean;
  handle?: {
    address: string;
    displayName?: string;
  };
  hasAttachments: boolean;
  attachments: Array<{
    guid: string;
    mimeType: string;
    fileName: string;
    totalBytes: number;
  }>;
  expressiveSendStyleId?: string;
  associatedMessageGuid?: string; // For reactions
  associatedMessageType?: string; // 'reaction', 'reply', etc.
}

export class BlueBubblesClient {
  private baseUrl: string;
  private password: string;

  constructor(config: BlueBubblesConfig) {
    this.baseUrl = config.serverUrl.replace(/\/$/, '');
    this.password = config.password;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    
    // BlueBubbles uses Basic Auth or password in query
    const urlWithAuth = new URL(url);
    urlWithAuth.searchParams.set('password', this.password);

    const response = await fetch(urlWithAuth.toString(), {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BlueBubbles API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async sendMessage(request: SendMessageRequest, companyId?: string): Promise<SendMessageResponse> {
    // Check blacklist before sending (if companyId provided)
    if (companyId) {
      const recipientPhone = extractPhoneFromChatGuid(request.chatGuid);
      if (recipientPhone) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "imessage",
          identifier: recipientPhone
        });
      } else {
        console.warn(`[iMessage] Could not extract phone number from chatGuid: ${request.chatGuid}`);
      }
    }
    
    const payload: any = {
      chatGuid: request.chatGuid,
      message: request.message,
      method: request.method || 'private-api',
      subject: request.subject,
      effectId: request.effectId,
    };
    
    // Add tempGuid for webhook reconciliation (prevents duplicates)
    if (request.tempGuid) {
      payload.tempGuid = request.tempGuid;
      console.log('[iMessage] Sending message with tempGuid:', request.tempGuid);
    }
    
    // Add reply fields if provided
    if (request.selectedMessageGuid) {
      payload.selectedMessageGuid = request.selectedMessageGuid;
      payload.partIndex = request.partIndex || 0;
    }
    
    return this.request<SendMessageResponse>('/api/v1/message/text', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendAttachment(
    chatGuid: string, 
    attachmentPath: string, 
    tempGuid?: string, 
    isAudioMessage: boolean = false,
    audioMetadata?: {
      duration: number;
      waveform: number[];
      mimeType: string;
      uti: string;
      codec: string;
      sampleRate: number;
    },
    companyId?: string
  ): Promise<SendMessageResponse> {
    // Check blacklist before sending (if companyId provided)
    if (companyId) {
      const recipientPhone = extractPhoneFromChatGuid(chatGuid);
      if (recipientPhone) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "imessage",
          identifier: recipientPhone
        });
      } else {
        console.warn(`[iMessage] Could not extract phone number from chatGuid: ${chatGuid}`);
      }
    }
    
    // BlueBubbles expects a file path or Buffer, not a File object
    // When called from our API, we'll pass the file path from multer upload
    const formData = new FormData();
    formData.append('chatGuid', chatGuid);
    formData.append('method', 'private-api'); // CRITICAL: Force Private API for audio messages
    
    // Use provided tempGuid or generate a new one (for webhook reconciliation)
    const messageGuid = tempGuid || `temp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    formData.append('tempGuid', messageGuid);
    
    // Read file from disk and append as blob
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(attachmentPath);
    const fileName = attachmentPath.split('/').pop() || 'attachment';
    
    // Determine MIME type based on file extension or audioMetadata
    let mimeType = audioMetadata?.mimeType || 'application/octet-stream';
    if (!audioMetadata) {
      if (fileName.endsWith('.caf')) {
        mimeType = 'audio/x-caf';
      } else if (fileName.endsWith('.m4a')) {
        mimeType = 'audio/mp4';
      } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (fileName.endsWith('.png')) {
        mimeType = 'image/png';
      }
    }
    
    // Create blob with correct MIME type
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('attachment', blob, fileName);
    formData.append('name', fileName);
    
    // CRITICAL: Mark as audio message (voice memo) for iMessage
    // BlueBubbles requires BOTH:
    // 1. isAudioMessage as top-level FormData field
    // 2. isAudioMessage inside payloadJson for Private API
    if (isAudioMessage && audioMetadata) {
      // Add isAudioMessage as separate top-level field
      formData.append('isAudioMessage', 'true');
      
      // Add metadata as payloadJson with isAudioMessage flag inside
      const payloadJson = {
        text: '', // CORRECT field name for BlueBubbles
        metadata: {
          duration: audioMetadata.duration,
          waveform: audioMetadata.waveform,
          uti: audioMetadata.uti,
          mimeType: audioMetadata.mimeType,
          codec: audioMetadata.codec,
          sampleRate: audioMetadata.sampleRate
        },
        isAudioMessage: true // CRITICAL: BlueBubbles Private API needs this inside payloadJson too
      };
      
      formData.append('payloadJson', JSON.stringify(payloadJson));
      console.log(`[iMessage] Sending voice memo: ${audioMetadata.codec} @ ${audioMetadata.sampleRate}Hz, duration: ${audioMetadata.duration}ms, waveform: ${audioMetadata.waveform.length} samples`);
    }

    const urlWithAuth = new URL(`${this.baseUrl}/api/v1/message/attachment`);
    urlWithAuth.searchParams.set('password', this.password);

    console.log('[iMessage] Sending attachment with tempGuid:', messageGuid);
    console.log('[iMessage] ChatGuid:', chatGuid);
    console.log('[iMessage] File:', fileName, 'MIME:', mimeType, 'Size:', fileBuffer.length);
    console.log('[iMessage] isAudioMessage:', isAudioMessage);
    console.log('[iMessage] BlueBubbles URL:', urlWithAuth.toString().replace(this.password, '***'));

    const response = await fetch(urlWithAuth.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[iMessage] BlueBubbles error response:', response.status, errorText);
      throw new Error(`BlueBubbles API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[iMessage] Attachment sent successfully:', result);
    return result;
  }

  async sendReaction(params: SendReactionRequest): Promise<SendMessageResponse> {
    // Map emoji reactions to BlueBubbles keywords
    const reactionMap: Record<string, string> = {
      '❤️': 'love',
      '👍': 'like',
      '👎': 'dislike',
      '😂': 'laugh',
      '!!': 'emphasize',
      '?': 'question',
      '❓': 'question'
    };

    const mappedReaction = reactionMap[params.reaction] || params.reaction;

    return this.request<SendMessageResponse>('/api/v1/message/reaction', {
      method: 'POST',
      body: JSON.stringify({
        chatGuid: params.chatGuid,
        messageGuid: params.messageGuid,
        reaction: mappedReaction,
        remove: params.remove || false,
        part: 0,
        forcePrivateApi: true
      }),
    });
  }

  async unsendMessage(messageGuid: string, partIndex: number = 0): Promise<SendMessageResponse> {
    // Unsend (retract) a message - removes it from all devices
    // Requires macOS 13+ and Private API enabled
    return this.request<SendMessageResponse>(`/api/v1/message/${messageGuid}/unsend`, {
      method: 'POST',
      body: JSON.stringify({
        partIndex: partIndex
      }),
    });
  }

  async getChats(offset = 0, limit = 100): Promise<{ data: Chat[] }> {
    return this.request<{ data: Chat[] }>(
      `/api/v1/chat?offset=${offset}&limit=${limit}&with=lastMessage`
    );
  }

  async getChat(chatGuid: string): Promise<{ data: Chat }> {
    return this.request<{ data: Chat }>(`/api/v1/chat/${encodeURIComponent(chatGuid)}?with=participants,lastMessage`);
  }

  async createChat(addresses: string[], service: string = 'iMessage'): Promise<{ data: Chat }> {
    console.log(`[BlueBubbles] Creating new chat with addresses: ${addresses.join(', ')}, service: ${service}`);
    return this.request<{ data: Chat }>('/api/v1/chat/new', {
      method: 'POST',
      body: JSON.stringify({
        addresses,
        service,
      }),
    });
  }

  async getChatMessages(
    chatGuid: string,
    offset = 0,
    limit = 100
  ): Promise<{ data: Message[] }> {
    return this.request<{ data: Message[] }>(
      `/api/v1/chat/${encodeURIComponent(chatGuid)}/message?offset=${offset}&limit=${limit}&with=attachment,handle`
    );
  }

  async markAsRead(chatGuid: string): Promise<void> {
    await this.request(`/api/v1/chat/${encodeURIComponent(chatGuid)}/read`, {
      method: 'POST',
    });
  }

  async sendTypingIndicator(chatGuid: string, isTyping: boolean): Promise<void> {
    try {
      await this.request(`/api/v1/chat/${encodeURIComponent(chatGuid)}/typing`, {
        method: 'POST',
        body: JSON.stringify({ display: isTyping }),
      });
      console.log(`[BlueBubbles] Typing indicator sent: ${isTyping ? 'start' : 'stop'} for chat ${chatGuid}`);
    } catch (error) {
      console.error('[BlueBubbles] Failed to send typing indicator:', error);
    }
  }

  async getServerInfo(): Promise<{
    status: number;
    message: string;
    data: {
      version: string;
      privateApi: boolean;
    };
  }> {
    return this.request('/api/v1/server/info');
  }

  async getAttachmentStream(guid: string): Promise<Response> {
    // Download attachment from BlueBubbles server using /download endpoint for binary data
    const urlWithAuth = new URL(`${this.baseUrl}/api/v1/attachment/${encodeURIComponent(guid)}/download`);
    urlWithAuth.searchParams.set('password', this.password);

    console.log('[BlueBubbles] Downloading attachment from:', urlWithAuth.toString().replace(this.password, '***'));

    const response = await fetch(urlWithAuth.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BlueBubbles] Attachment download failed:', response.status, errorText);
      throw new Error(`BlueBubbles API error: ${response.status} - ${errorText}`);
    }

    console.log('[BlueBubbles] Attachment downloaded successfully. Content-Type:', response.headers.get('content-type'));
    return response;
  }

  static createFromSettings(settings: CompanySettings): BlueBubblesClient | null {
    const imessageSettings = settings.imessageSettings as {
      serverUrl?: string;
      password?: string;
      isEnabled?: boolean;
    };

    if (!imessageSettings?.isEnabled || !imessageSettings.serverUrl || !imessageSettings.password) {
      return null;
    }

    return new BlueBubblesClient({
      serverUrl: imessageSettings.serverUrl,
      password: imessageSettings.password,
    });
  }
}

interface CachedClient {
  client: BlueBubblesClient;
  configHash: string;
  loadedAt: Date;
}

class BlueBubblesClientManager {
  private clients = new Map<string, CachedClient>();

  async getClient(companyId: string): Promise<BlueBubblesClient> {
    const settings = await storage.getCompanySettings(companyId);
    if (!settings) {
      throw new Error('Company settings not found');
    }

    const imessageSettings = settings.imessageSettings as {
      serverUrl?: string;
      password?: string;
      isEnabled?: boolean;
    };

    if (!imessageSettings?.isEnabled || !imessageSettings.serverUrl || !imessageSettings.password) {
      throw new Error('BlueBubbles not configured for this company');
    }

    const configHash = JSON.stringify({
      url: imessageSettings.serverUrl,
      hasPassword: !!imessageSettings.password,
    });

    const cached = this.clients.get(companyId);
    if (cached && cached.configHash === configHash) {
      return cached.client;
    }

    const client = new BlueBubblesClient({
      serverUrl: imessageSettings.serverUrl,
      password: imessageSettings.password,
    });

    this.clients.set(companyId, {
      client,
      configHash,
      loadedAt: new Date(),
    });

    console.log(`[BlueBubblesManager] Client created/updated for company: ${companyId}`);
    return client;
  }

  invalidateClient(companyId: string): void {
    this.clients.delete(companyId);
    console.log(`[BlueBubblesManager] Client cache invalidated for company: ${companyId}`);
  }

  async sendMessage(companyId: string, request: SendMessageRequest): Promise<SendMessageResponse> {
    const client = await this.getClient(companyId);
    return client.sendMessage(request, companyId);
  }

  async sendAttachment(
    companyId: string,
    chatGuid: string,
    attachmentPath: string,
    tempGuid?: string,
    isAudioMessage: boolean = false,
    audioMetadata?: {
      duration: number;
      waveform: number[];
      mimeType: string;
      uti: string;
      codec: string;
      sampleRate: number;
    }
  ): Promise<SendMessageResponse> {
    const client = await this.getClient(companyId);
    return client.sendAttachment(chatGuid, attachmentPath, tempGuid, isAudioMessage, audioMetadata, companyId);
  }

  async getChats(companyId: string, offset = 0, limit = 100): Promise<{ data: Chat[] }> {
    const client = await this.getClient(companyId);
    return client.getChats(offset, limit);
  }

  async getChat(companyId: string, chatGuid: string): Promise<{ data: Chat }> {
    const client = await this.getClient(companyId);
    return client.getChat(chatGuid);
  }

  async createChat(companyId: string, addresses: string[], service: string = 'iMessage'): Promise<{ data: Chat }> {
    const client = await this.getClient(companyId);
    return client.createChat(addresses, service);
  }

  async getChatMessages(companyId: string, chatGuid: string, offset = 0, limit = 100): Promise<{ data: Message[] }> {
    const client = await this.getClient(companyId);
    return client.getChatMessages(chatGuid, offset, limit);
  }

  async sendReaction(companyId: string, request: SendReactionRequest): Promise<SendMessageResponse> {
    const client = await this.getClient(companyId);
    return client.sendReaction(request);
  }

  async getAttachmentStream(companyId: string, guid: string): Promise<Response> {
    const client = await this.getClient(companyId);
    return client.getAttachmentStream(guid);
  }

  async markAsRead(companyId: string, chatGuid: string): Promise<void> {
    const client = await this.getClient(companyId);
    return client.markAsRead(chatGuid);
  }

  async sendTypingIndicator(companyId: string, chatGuid: string, isTyping: boolean): Promise<void> {
    const client = await this.getClient(companyId);
    return client.sendTypingIndicator(chatGuid, isTyping);
  }

  async getServerInfo(companyId: string): Promise<any> {
    const client = await this.getClient(companyId);
    return client.getServerInfo();
  }

  async unsendMessage(companyId: string, messageGuid: string, partIndex: number = 0): Promise<SendMessageResponse> {
    const client = await this.getClient(companyId);
    return client.unsendMessage(messageGuid, partIndex);
  }
}

export const blueBubblesManager = new BlueBubblesClientManager();

// Deprecated: Old singleton export for backward compatibility
// New code should use blueBubblesManager instead
export const blueBubblesClient = {
  sendMessage: async (request: SendMessageRequest, companyId?: string): Promise<SendMessageResponse> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.sendMessage(companyId, request);
  },
  
  sendAttachment: async (
    chatGuid: string, 
    attachmentPath: string, 
    tempGuid?: string, 
    isAudioMessage: boolean = false,
    audioMetadata?: {
      duration: number;
      waveform: number[];
      mimeType: string;
      uti: string;
      codec: string;
      sampleRate: number;
    },
    companyId?: string
  ): Promise<SendMessageResponse> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.sendAttachment(companyId, chatGuid, attachmentPath, tempGuid, isAudioMessage, audioMetadata);
  },
  
  getChats: async (companyId: string, offset = 0, limit = 100): Promise<{ data: Chat[] }> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.getChats(companyId, offset, limit);
  },
  
  getChat: async (companyId: string, chatGuid: string): Promise<{ data: Chat }> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.getChat(companyId, chatGuid);
  },
  
  createChat: async (companyId: string, addresses: string[], service: string = 'iMessage'): Promise<{ data: Chat }> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.createChat(companyId, addresses, service);
  },
  
  getChatMessages: async (companyId: string, chatGuid: string, offset = 0, limit = 100): Promise<{ data: Message[] }> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.getChatMessages(companyId, chatGuid, offset, limit);
  },
  
  markAsRead: async (companyId: string, chatGuid: string): Promise<void> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.markAsRead(companyId, chatGuid);
  },
  
  getServerInfo: async (companyId: string): Promise<any> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.getServerInfo(companyId);
  },
  
  sendReaction: async (companyId: string, params: SendReactionRequest): Promise<SendMessageResponse> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.sendReaction(companyId, params);
  },
  
  unsendMessage: async (companyId: string, messageGuid: string, partIndex: number = 0): Promise<SendMessageResponse> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.unsendMessage(companyId, messageGuid, partIndex);
  },
  
  getAttachmentStream: async (companyId: string, guid: string): Promise<Response> => {
    if (!companyId) {
      throw new Error('companyId is required for multi-tenant support');
    }
    return blueBubblesManager.getAttachmentStream(companyId, guid);
  },
  
  // Deprecated: These methods no longer needed with manager pattern
  initialize: (settings: CompanySettings): boolean => {
    console.warn('[BlueBubbles] initialize() is deprecated. The manager handles initialization automatically per company.');
    return true;
  },
  
  isInitialized: (): boolean => {
    console.warn('[BlueBubbles] isInitialized() is deprecated. The manager handles initialization automatically per company.');
    return true;
  }
};

export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // BlueBubbles doesn't have built-in webhook signature validation by default
  // This is a simple implementation - you may want to enhance it based on your security needs
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}
