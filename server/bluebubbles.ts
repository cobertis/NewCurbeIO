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

  async sendAttachment(chatGuid: string, attachment: File): Promise<SendMessageResponse> {
    const formData = new FormData();
    formData.append('chatGuid', chatGuid);
    formData.append('attachment', attachment);

    const urlWithAuth = new URL(`${this.baseUrl}/api/v1/message/attachment`);
    urlWithAuth.searchParams.set('password', this.password);

    const response = await fetch(urlWithAuth.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`BlueBubbles API error: ${response.status}`);
    }

    return response.json();
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
