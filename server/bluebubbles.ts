import type { CompanySettings } from "@shared/schema";

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

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('/api/v1/message/text', {
      method: 'POST',
      body: JSON.stringify({
        chatGuid: request.chatGuid,
        message: request.message,
        method: request.method || 'private-api',
        subject: request.subject,
        effectId: request.effectId,
      }),
    });
  }

  async sendAttachment(chatGuid: string, attachmentPath: string): Promise<SendMessageResponse> {
    // BlueBubbles expects a file path or Buffer, not a File object
    // When called from our API, we'll pass the file path from multer upload
    const formData = new FormData();
    formData.append('chatGuid', chatGuid);
    
    // Read file from disk and append as blob
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(attachmentPath);
    const fileName = attachmentPath.split('/').pop() || 'attachment';
    const blob = new Blob([fileBuffer]);
    formData.append('attachment', blob, fileName);
    formData.append('name', fileName);

    const urlWithAuth = new URL(`${this.baseUrl}/api/v1/message/attachment`);
    urlWithAuth.searchParams.set('password', this.password);

    const response = await fetch(urlWithAuth.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BlueBubbles API error: ${response.status} - ${errorText}`);
    }

    return response.json();
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
  sendMessage: async (request: SendMessageRequest): Promise<SendMessageResponse> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.sendMessage(request);
  },
  
  sendAttachment: async (chatGuid: string, attachment: File): Promise<SendMessageResponse> => {
    if (!blueBubblesClientInstance) {
      throw new Error('BlueBubbles client not initialized. Please configure iMessage settings.');
    }
    return blueBubblesClientInstance.sendAttachment(chatGuid, attachment);
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
