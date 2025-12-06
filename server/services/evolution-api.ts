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

  async setWebhook(instanceName: string, webhookUrl: string): Promise<any> {
    console.log(`[Evolution API] Setting webhook for ${instanceName}: ${webhookUrl}`);
    return this.request("POST", `/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE", 
          "CONNECTION_UPDATE",
          "CONTACTS_UPSERT",
          "QRCODE_UPDATED",
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
    return this.request("GET", `/chat/findChats/${instanceName}`);
  }

  async fetchMessages(instanceName: string, remoteJid: string, limit: number = 50): Promise<EvolutionMessage[]> {
    console.log(`[Evolution API] Fetching messages from ${remoteJid} via ${instanceName}`);
    return this.request("POST", `/chat/findMessages/${instanceName}`, {
      where: { key: { remoteJid } },
      limit,
    });
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
