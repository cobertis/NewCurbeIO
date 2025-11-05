import axios, { AxiosInstance } from "axios";

const BULKVS_API_BASE = "https://portal.bulkvs.com/api/v1.0";

class BulkVSClient {
  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;
  private accountId?: string;

  constructor() {
    this.apiKey = process.env.BULKVS_API_KEY || "";
    this.apiSecret = process.env.BULKVS_API_SECRET || "";
    this.accountId = process.env.BULKVS_ACCOUNT_ID;

    if (!this.apiKey || !this.apiSecret) {
      console.warn("[BulkVS] API credentials not configured. BulkVS features will be disabled.");
    }

    this.client = axios.create({
      baseURL: BULKVS_API_BASE,
      auth: {
        username: this.apiKey,
        password: this.apiSecret,
      },
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }

  async accountDetail() {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.get("/accountDetail");
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] accountDetail error:", error.response?.data || error.message);
      throw error;
    }
  }

  async listAvailableDIDs(params: {
    npa?: string;
    ratecenter?: string;
    state?: string;
    limit?: number;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      console.log("[BulkVS] Searching for available DIDs with params:", params);
      const response = await this.client.get("/didAvailableList", { params });
      console.log("[BulkVS] API Response status:", response.status);
      console.log("[BulkVS] API Response data type:", typeof response.data);
      console.log("[BulkVS] API Response data:", JSON.stringify(response.data).substring(0, 500));
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] listAvailableDIDs error:", error.response?.data || error.message);
      throw error;
    }
  }

  async buyDID(did: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.post("/didPurchase", {
        accountId: this.accountId,
        did,
      });
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] buyDID error:", error.response?.data || error.message);
      throw error;
    }
  }

  async enableSmsMms(did: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.post("/smsEnable", {
        accountId: this.accountId,
        did,
        sms: true,
        mms: true,
      });
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] enableSmsMms error:", error.response?.data || error.message);
      throw error;
    }
  }

  async setMessagingWebhook(did: string, webhookUrl: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.post("/smsSetWebhook", {
        accountId: this.accountId,
        did,
        url: webhookUrl,
      });
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] setMessagingWebhook error:", error.response?.data || error.message);
      throw error;
    }
  }

  async assignToCampaign(did: string, campaignId: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.post("/smsAssignCampaign", {
        accountId: this.accountId,
        did,
        campaignId,
      });
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] assignToCampaign error:", error.response?.data || error.message);
      throw error;
    }
  }

  async messageSend(payload: {
    from: string;
    to: string;
    body?: string;
    mediaUrl?: string;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.post("/messageSend", payload);
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] messageSend error:", error.response?.data || error.message);
      throw error;
    }
  }

  async messageStatus(providerMsgId: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.get("/messageStatus", {
        params: { id: providerMsgId },
      });
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] messageStatus error:", error.response?.data || error.message);
      throw error;
    }
  }
}

export const bulkVSClient = new BulkVSClient();
