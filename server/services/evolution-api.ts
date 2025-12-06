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
      rejectCall: false,
      groupsIgnore: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: true,
    });
  }

  async getWebhook(instanceName: string): Promise<any> {
    console.log(`[Evolution API] Getting webhook config for: ${instanceName}`);
    return this.request("GET", `/webhook/find/${instanceName}`);
  }

async setWebhook(instanceName: string, webhookUrl: string): Promise<any> {
    console.log(`[Evolution API] Setting webhook for ${instanceName}: ${webhookUrl}`);
    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: [
          "APPLICATION_STARTUP",
          "QRCODE_UPDATED",
          "MESSAGES_SET",
          "MESSAGES_UPSERT",
          "MESSAGES_EDITED",
          "MESSAGES_UPDATE",
          "MESSAGES_DELETE",
          "SEND_MESSAGE",
          "SEND_MESSAGE_UPDATE",
          "CONTACTS_SET",
          "CONTACTS_UPSERT",
          "CONTACTS_UPDATE",
          "PRESENCE_UPDATE",
          "CHATS_SET",
          "CHATS_UPSERT",
          "CHATS_UPDATE",
          "CHATS_DELETE",
          "GROUPS_UPSERT",
          "GROUP_UPDATE",
          "GROUP_PARTICIPANTS_UPDATE",
          "CONNECTION_UPDATE",
          "LABELS_EDIT",
          "LABELS_ASSOCIATION",
          "CALL",
          "TYPEBOT_START",
          "TYPEBOT_CHANGE_STATUS",
          "REMOVE_INSTANCE",
          "LOGOUT_INSTANCE",
        ],
      },
    };
    console.log(`[Evolution API] Webhook payload:`, JSON.stringify(payload, null, 2));
    const result = await this.request("POST", `/webhook/set/${instanceName}`, payload);
    console.log(`[Evolution API] Webhook set response:`, JSON.stringify(result, null, 2));
    return result;
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

  async sendMediaMessage(
    instanceName: string, 
    number: string, 
    mediaType: "image" | "video" | "audio" | "document",
    base64: string,
    mimetype: string,
    caption?: string,
    fileName?: string
  ): Promise<any> {
    console.log(`[Evolution API] Sending ${mediaType} to ${number} via ${instanceName}`);
    
    const normalizedNumber = number.replace(/\D/g, "");
    
    let cleanBase64 = base64;
    if (base64.includes(",")) {
      cleanBase64 = base64.split(",")[1];
    }
    if (cleanBase64.startsWith("data:")) {
      cleanBase64 = cleanBase64.replace(/^data:[^;]+;base64,/, "");
    }
    
    const mediaEndpoints: Record<string, string> = {
      image: "sendMedia",
      video: "sendMedia", 
      audio: "sendWhatsAppAudio",
      document: "sendMedia"
    };
    
    const endpoint = mediaEndpoints[mediaType] || "sendMedia";
    
    const payload: any = {
      number: normalizedNumber,
      mediatype: mediaType,
      media: cleanBase64,
      mimetype,
    };
    
    if (caption) payload.caption = caption;
    if (fileName) payload.fileName = fileName;
    
    return this.request("POST", `/message/${endpoint}/${instanceName}`, payload);
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

  async sendWhatsAppAudio(instanceName: string, number: string, base64: string): Promise<any> {
    const remoteJid = number.includes("@") ? number : `${number.replace(/\D/g, "")}@s.whatsapp.net`;
    console.log(`[Evolution API] Sending WhatsApp audio to ${remoteJid} via ${instanceName}`);
    return this.request('POST', `/message/sendWhatsAppAudio/${instanceName}`, {
      number: remoteJid,
      audio: base64,
      delay: 1200,
    });
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

  /**
   * Validates a phone number from Evolution API responses
   * Preserves the exact digit sequence - only validates, does not modify
   * @param candidate - The string to validate
   * @returns Original digits if valid, or null if clearly invalid
   */
  private normalizeToE164(candidate: string | null | undefined): string | null {
    if (!candidate) return null;
    
    // Extract digits only - preserve EXACTLY as received
    const digits = candidate.replace(/\D/g, '');
    
    // Reject empty or too short (less than 10 digits)
    if (digits.length < 10) {
      console.log(`[Evolution API] normalizeToE164: rejected "${digits}" (too short: ${digits.length} < 10)`);
      return null;
    }
    
    // Accept any number up to 25 digits (Evolution returns various formats)
    // Store the full number exactly as received
    if (digits.length > 25) {
      console.log(`[Evolution API] normalizeToE164: rejected "${digits}" (too long: ${digits.length} > 25)`);
      return null;
    }
    
    // Reject if it's all zeros (invalid)
    if (/^0+$/.test(digits)) {
      console.log(`[Evolution API] normalizeToE164: rejected "${digits}" (all zeros)`);
      return null;
    }
    
    // Store exactly as received - frontend will handle display formatting
    console.log(`[Evolution API] normalizeToE164: accepted "${digits}" (length ${digits.length})`);
    return digits;
  }

  /**
   * Fetches the business profile for a WhatsApp Business ID (@lid)
   * Returns the real phone number (E.164 normalized) and business name if available
   * 
   * @param instanceName - The Evolution API instance name
   * @param jid - The @lid JID to look up (e.g., "12345678901234567@lid")
   * @returns Object with businessPhone (E.164 digits) and businessName, or null if not found
   */
  async getBusinessProfile(
    instanceName: string,
    jid: string
  ): Promise<{ businessPhone: string | null; businessName: string | null }> {
    console.log(`[Evolution API] Fetching business profile for ${jid}`);
    try {
      const response: any = await this.request("POST", `/chat/fetchProfile/${instanceName}`, {
        number: jid
      });
      
      console.log(`[Evolution API] Business profile response:`, JSON.stringify(response).slice(0, 500));
      
      let businessPhone: string | null = null;
      let businessName: string | null = null;
      
      // Try multiple sources for the phone number, in order of preference:
      // 1. response.number.user (most reliable)
      // 2. response.wid (can be JID or object)
      // 3. response.id
      const phoneCandidates: string[] = [];
      
      if (response?.number?.user) {
        phoneCandidates.push(response.number.user);
      }
      if (response?.wid) {
        if (typeof response.wid === 'string') {
          phoneCandidates.push(response.wid.split('@')[0]);
        } else if (response.wid?.user) {
          phoneCandidates.push(response.wid.user);
        }
      }
      if (response?.id && typeof response.id === 'string') {
        phoneCandidates.push(response.id.split('@')[0]);
      }
      
      // Validate each candidate until we find a valid E.164 number
      for (const candidate of phoneCandidates) {
        const normalized = this.normalizeToE164(candidate);
        if (normalized) {
          businessPhone = normalized;
          break;
        }
      }
      
      // Extract business name from multiple sources
      businessName = response?.verifiedName || response?.pushName || response?.name || null;
      
      console.log(`[Evolution API] Extracted businessPhone: ${businessPhone}, businessName: ${businessName}`);
      return { businessPhone, businessName };
    } catch (error: any) {
      console.log(`[Evolution API] Failed to fetch business profile:`, error.message);
      return { businessPhone: null, businessName: null };
    }
  }

  /**
   * Downloads media from a message and returns it as base64
   * This is the fallback when webhookBase64 is not available (SaaS Evolution API)
   */
  async getBase64FromMediaMessage(
    instanceName: string, 
    messageId: string, 
    remoteJid: string
  ): Promise<{ base64: string; mimetype: string } | null> {
    console.log(`[Evolution API] Downloading media for message ${messageId}`);
    try {
      const response: any = await this.request("POST", `/chat/getBase64FromMediaMessage/${instanceName}`, {
        message: {
          key: {
            id: messageId,
            remoteJid: remoteJid
          }
        },
        convertToMp4: false
      });
      
      if (response?.base64 && response?.mimetype) {
        console.log(`[Evolution API] Media downloaded successfully: ${response.mimetype}`);
        return {
          base64: response.base64,
          mimetype: response.mimetype
        };
      }
      
      console.log(`[Evolution API] No media found in response`);
      return null;
    } catch (error: any) {
      console.log(`[Evolution API] Failed to download media:`, error.message);
      return null;
    }
  }
}

export const evolutionApi = new EvolutionApiService();
export type { EvolutionInstanceResponse, EvolutionConnectionState, EvolutionMessage };
