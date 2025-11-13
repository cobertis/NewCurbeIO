import type { CompanySettings } from "@shared/schema";
import { blacklistService } from "./services/blacklist-service";

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

// Singleton instance - will be initialized on demand
let blueBubblesClientInstance: BlueBubblesClient | null = null;

// Export a singleton getter that creates/returns the client
export const blueBubblesClient = {
  sendMessage: async (request: SendMessageRequest, companyId?: string): Promise<SendMessageResponse> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.sendMessage(request, companyId);
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
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.sendAttachment(chatGuid, attachmentPath, tempGuid, isAudioMessage, audioMetadata, companyId);
  },
  
  getChats: async (offset = 0, limit = 100): Promise<{ data: Chat[] }> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.getChats(offset, limit);
  },
  
  getChat: async (chatGuid: string): Promise<{ data: Chat }> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.getChat(chatGuid);
  },
  
  getChatMessages: async (chatGuid: string, offset = 0, limit = 100): Promise<{ data: Message[] }> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.getChatMessages(chatGuid, offset, limit);
  },
  
  markAsRead: async (chatGuid: string): Promise<void> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.markAsRead(chatGuid);
  },
  
  getServerInfo: async (): Promise<any> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.getServerInfo();
  },
  
  sendReaction: async (params: SendReactionRequest): Promise<SendMessageResponse> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.sendReaction(params);
  },
  
  unsendMessage: async (messageGuid: string, partIndex: number = 0): Promise<SendMessageResponse> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.unsendMessage(messageGuid, partIndex);
  },
  
  getAttachmentStream: async (guid: string): Promise<Response> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.getAttachmentStream(guid);
  },
  
  initialize: (settings: CompanySettings): boolean => {
    blueBubblesClientInstance = BlueBubblesClient.createFromSettings(settings);
    return blueBubblesClientInstance !== null;
  },
  
  isInitialized: (): boolean => {
    return blueBubblesClientInstance !== null;
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
