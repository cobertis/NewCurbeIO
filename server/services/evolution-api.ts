import type { WhatsappInstance, InsertWhatsappInstance, WhatsappMessage, InsertWhatsappMessage, WhatsappConversation } from "@shared/schema";

interface EvolutionInstanceResponse {
  instance: {
    instanceName: string;
    status: string;
  };
  hash?: string;
  qrcode?: {
    base64: string;
  };
}

interface EvolutionConnectionState {
  instance: {
    instanceName: string;
    state: "open" | "close" | "connecting";
  };
}

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string; url?: string };
    videoMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string };
    documentMessage?: { fileName?: string; url?: string };
  };
  messageTimestamp: number;
  status?: string;
}

class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || "https://evolution.curbe.io";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[Evolution API] ${method} ${endpoint}`);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`[Evolution API] Error ${response.status}: ${error}`);
        throw new Error(`Evolution API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log(`[Evolution API] Success: ${method} ${endpoint}`);
      return data;
    } catch (error) {
      console.log(`[Evolution API] Request failed:`, error);
      throw error;
    }
  }

  async createInstance(instanceName: string): Promise<EvolutionInstanceResponse> {
    console.log(`[Evolution API] Creating instance: ${instanceName}`);
    return this.request("POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
  }

  async getConnectionState(instanceName: string): Promise<EvolutionConnectionState> {
    console.log(`[Evolution API] Getting connection state for: ${instanceName}`);
    return this.request("GET", `/instance/connectionState/${instanceName}`);
  }

  async setSettings(instanceName: string): Promise<any> {
    console.log(`[Evolution API] Setting instance settings for: ${instanceName}`);
    return this.request("POST", `/settings/set/${instanceName}`, {
      rejectCall: true,
      ignoreGroups: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: true,
    });
  }

  async setWebhook(instanceName: string, webhookUrl: string): Promise<any> {
    console.log(`[Evolution API] Setting webhook for ${instanceName}: ${webhookUrl}`);
    return this.request("POST", `/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: [
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "SEND_MESSAGE",
          "CHATS_UPSERT",
          "CONTACTS_UPSERT",
        ],
      },
    });
  }

  async fetchQrCode(instanceName: string): Promise<{ base64: string }> {
    console.log(`[Evolution API] Fetching QR code for: ${instanceName}`);
    return this.request("GET", `/instance/connect/${instanceName}`);
  }

  async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
    console.log(`[Evolution API] Sending message to ${number} via ${instanceName}`);
    return this.request("POST", `/message/sendText/${instanceName}`, {
      number,
      text,
    });
  }

  async fetchChats(instanceName: string): Promise<any[]> {
    console.log(`[Evolution API] Fetching chats for: ${instanceName}`);
    return this.request("POST", `/chat/findChats/${instanceName}`, {
      where: {},
    });
  }

  async fetchMessages(instanceName: string, remoteJid: string, limit: number = 50): Promise<EvolutionMessage[]> {
    console.log(`[Evolution API] Fetching messages from ${remoteJid} via ${instanceName}`);
    const response: any = await this.request("POST", `/chat/findMessages/${instanceName}`, {
      where: { key: { remoteJid } },
      limit,
    });
    
    // Evolution API v2 returns {messages: {records: [...], total, pages}}
    if (response?.messages?.records) {
      console.log(`[Evolution API] Found ${response.messages.records.length} messages`);
      return response.messages.records;
    }
    
    // Fallback if format is different
    if (Array.isArray(response)) {
      return response;
    }
    
    console.log(`[Evolution API] Unexpected response format:`, JSON.stringify(response).slice(0, 200));
    return [];
  }

  async deleteInstance(instanceName: string): Promise<any> {
    console.log(`[Evolution API] Deleting instance: ${instanceName}`);
    return this.request("DELETE", `/instance/delete/${instanceName}`);
  }

  async logoutInstance(instanceName: string): Promise<any> {
    console.log(`[Evolution API] Logging out instance: ${instanceName}`);
    return this.request("DELETE", `/instance/logout/${instanceName}`);
  }

  async getInstanceInfo(instanceName: string): Promise<any> {
    console.log(`[Evolution API] Getting instance info: ${instanceName}`);
    return this.request("GET", `/instance/fetchInstances?instanceName=${instanceName}`);
  }

  async fetchProfilePicture(instanceName: string, number: string): Promise<{ profilePictureUrl?: string }> {
    try {
      return this.request("POST", `/chat/fetchProfilePictureUrl/${instanceName}`, {
        number,
      });
    } catch (error) {
      return { profilePictureUrl: undefined };
    }
  }

  async fetchContacts(instanceName: string): Promise<any[]> {
    console.log(`[Evolution API] Fetching contacts for: ${instanceName}`);
    try {
      return this.request("POST", `/chat/findContacts/${instanceName}`, {
        where: {},
      });
    } catch (error) {
      return [];
    }
  }

  extractMessageText(message: EvolutionMessage): string {
    const msg = message.message;
    if (!msg) return "";
    
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.fileName) return `Document: ${msg.documentMessage.fileName}`;
    if (msg.audioMessage) return "🎤 Voice message";
    
    return "";
  }

  extractMessageType(message: EvolutionMessage): string {
    const msg = message.message;
    if (!msg) return "text";
    
    if (msg.imageMessage) return "image";
    if (msg.videoMessage) return "video";
    if (msg.audioMessage) return "audio";
    if (msg.documentMessage) return "document";
    
    return "text";
  }
}

export const evolutionApi = new EvolutionApiService();
export type { EvolutionInstanceResponse, EvolutionConnectionState, EvolutionMessage };
