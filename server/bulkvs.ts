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
    npa: string; // Required by BulkVS API
    nxx?: string;
    lca?: string;
    limit?: number;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      // BulkVS API uses capital first letter for params
      const apiParams: any = {
        Npa: params.npa,
      };
      
      if (params.nxx) apiParams.Nxx = params.nxx;
      if (params.lca) apiParams.Lca = params.lca;
      if (params.limit) apiParams.Limit = params.limit;
      
      console.log("[BulkVS] Searching for available DIDs with params:", apiParams);
      const response = await this.client.get("/orderTn", { params: apiParams });
      console.log("[BulkVS] API Response status:", response.status);
      console.log("[BulkVS] API Response data:", JSON.stringify(response.data).substring(0, 500));
      
      // API returns array with TN, Rate Center, State, Tier, Per Minute Rate, Mrc, Nrc
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] listAvailableDIDs error:", error.response?.data || error.message);
      throw error;
    }
  }

  async buyDID(tn: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const response = await this.client.post("/orderTn", {
        TN: tn, // BulkVS API uses capital TN
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

  /**
   * Update CNAM (Caller ID Name) for a phone number
   * CNAM rules:
   * - Max 15 characters
   * - Alphanumeric and spaces only
   * - Takes 5-7 business days to propagate
   */
  async updateCNAM(did: string, cnam: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    // Sanitize CNAM to meet industry standards
    const sanitizedCnam = this.sanitizeCNAM(cnam);
    
    try {
      console.log(`[BulkVS] Updating CNAM for ${did} to "${sanitizedCnam}"...`);
      
      // Try the /updateCnam endpoint
      const response = await this.client.post("/updateCnam", {
        did,
        cnam: sanitizedCnam,
      });
      
      console.log("[BulkVS] updateCNAM response:", response.data);
      return { success: true, cnam: sanitizedCnam };
    } catch (error: any) {
      console.error("[BulkVS] updateCNAM error:", error.response?.data || error.message);
      
      // If endpoint doesn't exist, log warning but don't fail
      if (error.response?.status === 404 || error.response?.status === 405) {
        console.warn("[BulkVS] CNAM update endpoint not available. CNAM must be configured manually in portal.");
        return { 
          success: false, 
          cnam: sanitizedCnam, 
          message: "CNAM endpoint not available. Configure manually in BulkVS portal." 
        };
      }
      
      throw error;
    }
  }

  /**
   * Sanitize CNAM to meet industry standards
   * Rules:
   * - Max 15 characters
   * - Alphanumeric and spaces only
   * - Remove special characters
   */
  private sanitizeCNAM(cnam: string): string {
    // Remove special characters, keep only alphanumeric and spaces
    let sanitized = cnam.replace(/[^a-zA-Z0-9 ]/g, '');
    
    // Trim to max 15 characters
    if (sanitized.length > 15) {
      sanitized = sanitized.substring(0, 15);
    }
    
    // Trim spaces
    sanitized = sanitized.trim();
    
    return sanitized;
  }
}

export const bulkVSClient = new BulkVSClient();
