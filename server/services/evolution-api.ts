// WhatsApp Evolution API - DISABLED
// This file contains stub functions that return empty/error responses
// WhatsApp functionality has been removed from this application

class EvolutionApiStub {
  async getInstanceInfo(instanceName: string): Promise<any[]> {
    return [];
  }

  async fetchQrCode(instanceName: string): Promise<any> {
    return null;
  }

  async createInstance(instanceName: string): Promise<any> {
    throw new Error("WhatsApp functionality is disabled");
  }

  async deleteInstance(instanceName: string): Promise<void> {
    return;
  }

  async setSettings(instanceName: string): Promise<void> {
    return;
  }

  async setWebhook(instanceName: string, webhookUrl: string): Promise<void> {
    return;
  }

  async getWebhook(instanceName: string): Promise<any> {
    return null;
  }

  async logoutInstance(instanceName: string): Promise<void> {
    return;
  }

  async fetchProfilePicture(instanceName: string, remoteJid: string): Promise<any> {
    return null;
  }

  async getBusinessProfile(instanceName: string, remoteJid: string): Promise<any> {
    return null;
  }

  async fetchMessages(instanceName: string, remoteJid: string, count: number): Promise<any[]> {
    return [];
  }

  async fetchChats(instanceName: string): Promise<any[]> {
    return [];
  }

  async sendTextMessage(instanceName: string, number: string, text: string): Promise<any> {
    throw new Error("WhatsApp functionality is disabled");
  }

  async sendMediaMessage(instanceName: string, ...args: any[]): Promise<any> {
    throw new Error("WhatsApp functionality is disabled");
  }

  async sendWhatsAppAudio(instanceName: string, number: string, base64: string): Promise<any> {
    throw new Error("WhatsApp functionality is disabled");
  }

  async sendTyping(instanceName: string, remoteJid: string): Promise<void> {
    return;
  }

  async setGlobalPresence(instanceName: string, presence: string): Promise<void> {
    return;
  }

  async getBase64FromMediaMessage(instanceName: string, ...args: any[]): Promise<any> {
    return null;
  }

  async sendReaction(instanceName: string, ...args: any[]): Promise<any> {
    throw new Error("WhatsApp functionality is disabled");
  }

  async markAsRead(instanceName: string, remoteJid: string, messages: any[]): Promise<void> {
    return;
  }

  extractMessageText(msg: any): string {
    return "";
  }

  extractMessageType(msg: any): string {
    return "text";
  }

  extractReactionData(msg: any): any {
    return null;
  }
}

export const evolutionApi = new EvolutionApiStub();
