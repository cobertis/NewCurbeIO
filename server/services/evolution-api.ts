import type { WhatsappInstance, InsertWhatsappInstance, WhatsappMessage, InsertWhatsappMessage, WhatsappConversation } from "@shared/schema";
import { credentialProvider } from "./credential-provider";

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
    senderPn?: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text: string };
    imageMessage?: { caption?: string; url?: string };
    videoMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string };
    documentMessage?: { fileName?: string; url?: string };
    reactionMessage?: {
      key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
      };
      text: string;
      senderTimestampMs?: string;
    };
  };
  messageTimestamp: number;
  status?: string;
}

let evolutionApiInstance: EvolutionApiService | null = null;
let evolutionInitialized = false;
let evolutionInitPromise: Promise<EvolutionApiService | null> | null = null;

class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
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
    
    if (response?.messages?.records) {
      console.log(`[Evolution API] Found ${response.messages.records.length} messages`);
      return response.messages.records;
    }
    
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
    
    if (msg.reactionMessage) return "reaction";
    if (msg.imageMessage) return "image";
    if (msg.videoMessage) return "video";
    if (msg.audioMessage) return "audio";
    if (msg.documentMessage) return "document";
    
    return "text";
  }

  extractReactionData(message: EvolutionMessage): { emoji: string; targetMessageId: string } | null {
    const reactionMsg = message.message?.reactionMessage;
    if (!reactionMsg) return null;
    
    return {
      emoji: reactionMsg.text || "",
      targetMessageId: reactionMsg.key?.id || ""
    };
  }

  private normalizeToE164(candidate: string | null | undefined): string | null {
    if (!candidate) return null;
    
    const digits = candidate.replace(/\D/g, '');
    
    if (digits.length < 10) {
      console.log(`[Evolution API] normalizeToE164: rejected "${digits}" (too short: ${digits.length} < 10)`);
      return null;
    }
    
    if (digits.length > 25) {
      console.log(`[Evolution API] normalizeToE164: rejected "${digits}" (too long: ${digits.length} > 25)`);
      return null;
    }
    
    if (/^0+$/.test(digits)) {
      console.log(`[Evolution API] normalizeToE164: rejected "${digits}" (all zeros)`);
      return null;
    }
    
    console.log(`[Evolution API] normalizeToE164: accepted "${digits}" (length ${digits.length})`);
    return digits;
  }

  async getBusinessProfile(
    instanceName: string,
    jid: string
  ): Promise<{ businessPhone: string | null; businessName: string | null; pushName: string | null }> {
    console.log(`[Evolution API] Fetching business profile for ${jid}`);
    try {
      const response: any = await this.request("POST", `/chat/fetchProfile/${instanceName}`, {
        number: jid
      });
      
      console.log(`[Evolution API] Business profile response:`, JSON.stringify(response).slice(0, 500));
      
      let businessPhone: string | null = null;
      let businessName: string | null = null;
      
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
      
      for (const candidate of phoneCandidates) {
        const normalized = this.normalizeToE164(candidate);
        if (normalized) {
          businessPhone = normalized;
          break;
        }
      }
      
      businessName = response?.verifiedName || response?.pushName || response?.name || null;
      
      const pushName = response?.pushName || response?.name || null;
      
      console.log(`[Evolution API] Extracted businessPhone: ${businessPhone}, businessName: ${businessName}, pushName: ${pushName}`);
      return { businessPhone, businessName, pushName };
    } catch (error: any) {
      console.log(`[Evolution API] Failed to fetch business profile:`, error.message);
      return { businessPhone: null, businessName: null, pushName: null };
    }
  }

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

  async markMessagesAsRead(instanceName: string, readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>): Promise<void> {
    try {
      await this.request("POST", `/chat/markMessageAsRead/${instanceName}`, { readMessages });
      console.log(`[Evolution API] Marked ${readMessages.length} messages as read`);
    } catch (error: any) {
      console.error(`[Evolution API] Failed to mark messages as read:`, error.message);
    }
  }

  async sendTyping(instanceName: string, remoteJid: string): Promise<void> {
    try {
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
      console.log(`[Evolution API] Sending typing to ${phoneNumber} via ${instanceName}`);
      await this.request("POST", `/chat/sendPresence/${instanceName}`, {
        number: phoneNumber,
        delay: 1200,
        presence: "composing"
      });
      console.log(`[Evolution API] Typing indicator sent to ${remoteJid}`);
    } catch (error: any) {
      console.error(`[Evolution API] Failed to send typing:`, error.message);
    }
  }

  async sendPresenceStatus(instanceName: string, remoteJid: string, presence: "available" | "unavailable"): Promise<void> {
    try {
      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
      console.log(`[Evolution API] Setting presence to ${presence} for ${phoneNumber} via ${instanceName}`);
      await this.request("POST", `/chat/sendPresence/${instanceName}`, {
        number: phoneNumber,
        delay: 3000,
        presence
      });
      console.log(`[Evolution API] Presence ${presence} sent to ${phoneNumber}`);
    } catch (error: any) {
      console.error(`[Evolution API] Failed to set presence:`, error.message);
    }
  }

  async setGlobalPresence(instanceName: string, presence: "available" | "unavailable"): Promise<void> {
    try {
      await this.request("POST", `/instance/setPresence/${instanceName}`, {
        presence
      });
    } catch (error: any) {
      // Silently ignore "Connection Closed" errors - this is a known Evolution API bug
      // that doesn't affect actual message sending/receiving functionality
      if (!error.message?.includes("Connection Closed")) {
        console.error(`[Evolution API] Failed to set global presence:`, error.message);
      }
    }
  }

  private normalizeEmoji(emoji: string): string {
    if (!emoji) return emoji;
    return emoji.replace(/[\uFE0E\uFE0F]/g, '');
  }

  async sendReaction(
    instanceName: string,
    remoteJid: string,
    messageId: string,
    reactionEmoji: string,
    messageFromMe: boolean
  ): Promise<any> {
    try {
      const normalizedEmoji = this.normalizeEmoji(reactionEmoji);
      console.log(`[Evolution API] Sending reaction "${normalizedEmoji}" (original: "${reactionEmoji}") to message ${messageId} in ${remoteJid}`);
      const response = await this.request("POST", `/message/sendReaction/${instanceName}`, {
        reaction: normalizedEmoji,
        key: {
          remoteJid: remoteJid,
          fromMe: messageFromMe,
          id: messageId
        }
      });
      console.log(`[Evolution API] Reaction sent successfully`);
      return response;
    } catch (error: any) {
      console.error(`[Evolution API] Failed to send reaction:`, error.message);
      throw error;
    }
  }
}

async function initEvolutionApi(): Promise<EvolutionApiService | null> {
  if (evolutionInitialized) {
    return evolutionApiInstance;
  }

  if (evolutionInitPromise) {
    return evolutionInitPromise;
  }

  evolutionInitPromise = (async () => {
    try {
      const { baseUrl, globalApiKey } = await credentialProvider.getEvolutionAPI();

      if (!baseUrl || !globalApiKey) {
        console.warn("⚠️  Evolution API credentials not configured. WhatsApp service will not be available.");
        evolutionInitialized = true;
        return null;
      }

      evolutionApiInstance = new EvolutionApiService(baseUrl, globalApiKey);
      evolutionInitialized = true;
      console.log("Evolution API service initialized successfully");
      return evolutionApiInstance;
    } catch (error) {
      console.error("Failed to initialize Evolution API service:", error);
      evolutionInitialized = true;
      return null;
    }
  })();

  return evolutionInitPromise;
}

export async function getEvolutionApiClient(): Promise<EvolutionApiService | null> {
  return initEvolutionApi();
}

async function ensureEvolutionApiConfigured(): Promise<EvolutionApiService> {
  const client = await initEvolutionApi();
  if (!client) {
    throw new Error("Evolution API service not initialized");
  }
  return client;
}

class EvolutionApiProxy {
  async isInitialized(): Promise<boolean> {
    const client = await initEvolutionApi();
    return client !== null;
  }

  async createInstance(instanceName: string): Promise<EvolutionInstanceResponse> {
    const client = await ensureEvolutionApiConfigured();
    return client.createInstance(instanceName);
  }

  async getConnectionState(instanceName: string): Promise<EvolutionConnectionState> {
    const client = await ensureEvolutionApiConfigured();
    return client.getConnectionState(instanceName);
  }

  async setSettings(instanceName: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.setSettings(instanceName);
  }

  async getWebhook(instanceName: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.getWebhook(instanceName);
  }

  async setWebhook(instanceName: string, webhookUrl: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.setWebhook(instanceName, webhookUrl);
  }

  async fetchQrCode(instanceName: string): Promise<{ base64: string }> {
    const client = await ensureEvolutionApiConfigured();
    return client.fetchQrCode(instanceName);
  }

  async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.sendTextMessage(instanceName, number, text);
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
    const client = await ensureEvolutionApiConfigured();
    return client.sendMediaMessage(instanceName, number, mediaType, base64, mimetype, caption, fileName);
  }

  async fetchChats(instanceName: string): Promise<any[]> {
    const client = await ensureEvolutionApiConfigured();
    return client.fetchChats(instanceName);
  }

  async fetchMessages(instanceName: string, remoteJid: string, limit: number = 50): Promise<EvolutionMessage[]> {
    const client = await ensureEvolutionApiConfigured();
    return client.fetchMessages(instanceName, remoteJid, limit);
  }

  async deleteInstance(instanceName: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.deleteInstance(instanceName);
  }

  async logoutInstance(instanceName: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.logoutInstance(instanceName);
  }

  async getInstanceInfo(instanceName: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.getInstanceInfo(instanceName);
  }

  async fetchProfilePicture(instanceName: string, number: string): Promise<{ profilePictureUrl?: string }> {
    const client = await ensureEvolutionApiConfigured();
    return client.fetchProfilePicture(instanceName, number);
  }

  async sendWhatsAppAudio(instanceName: string, number: string, base64: string): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.sendWhatsAppAudio(instanceName, number, base64);
  }

  async fetchContacts(instanceName: string): Promise<any[]> {
    const client = await ensureEvolutionApiConfigured();
    return client.fetchContacts(instanceName);
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
    
    if (msg.reactionMessage) return "reaction";
    if (msg.imageMessage) return "image";
    if (msg.videoMessage) return "video";
    if (msg.audioMessage) return "audio";
    if (msg.documentMessage) return "document";
    
    return "text";
  }

  extractReactionData(message: EvolutionMessage): { emoji: string; targetMessageId: string } | null {
    const reactionMsg = message.message?.reactionMessage;
    if (!reactionMsg) return null;
    
    return {
      emoji: reactionMsg.text || "",
      targetMessageId: reactionMsg.key?.id || ""
    };
  }

  async getBusinessProfile(
    instanceName: string,
    jid: string
  ): Promise<{ businessPhone: string | null; businessName: string | null; pushName: string | null }> {
    const client = await ensureEvolutionApiConfigured();
    return client.getBusinessProfile(instanceName, jid);
  }

  async getBase64FromMediaMessage(
    instanceName: string,
    messageId: string,
    remoteJid: string
  ): Promise<{ base64: string; mimetype: string } | null> {
    const client = await ensureEvolutionApiConfigured();
    return client.getBase64FromMediaMessage(instanceName, messageId, remoteJid);
  }

  async markMessagesAsRead(instanceName: string, readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>): Promise<void> {
    const client = await ensureEvolutionApiConfigured();
    return client.markMessagesAsRead(instanceName, readMessages);
  }

  async sendTyping(instanceName: string, remoteJid: string): Promise<void> {
    const client = await ensureEvolutionApiConfigured();
    return client.sendTyping(instanceName, remoteJid);
  }

  async sendPresenceStatus(instanceName: string, remoteJid: string, presence: "available" | "unavailable"): Promise<void> {
    const client = await ensureEvolutionApiConfigured();
    return client.sendPresenceStatus(instanceName, remoteJid, presence);
  }

  async setGlobalPresence(instanceName: string, presence: "available" | "unavailable"): Promise<void> {
    const client = await ensureEvolutionApiConfigured();
    return client.setGlobalPresence(instanceName, presence);
  }

  async sendReaction(
    instanceName: string,
    remoteJid: string,
    messageId: string,
    reactionEmoji: string,
    messageFromMe: boolean
  ): Promise<any> {
    const client = await ensureEvolutionApiConfigured();
    return client.sendReaction(instanceName, remoteJid, messageId, reactionEmoji, messageFromMe);
  }
}

export const evolutionApi = new EvolutionApiProxy();
export type { EvolutionInstanceResponse, EvolutionConnectionState, EvolutionMessage };
