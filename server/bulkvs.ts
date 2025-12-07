import axios, { AxiosInstance } from "axios";
import { formatForBulkVS } from "@shared/phone";
import { blacklistService } from "./services/blacklist-service";
import { credentialProvider } from "./services/credential-provider";

const BULKVS_API_BASE = "https://portal.bulkvs.com/api/v1.0";

let bulkVSClientInstance: BulkVSClient | null = null;
let bulkVSInitialized = false;
let bulkVSInitPromise: Promise<BulkVSClient | null> | null = null;

class BulkVSClient {
  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;
  private accountId?: string;

  constructor(apiKey: string, apiSecret: string, accountId?: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.accountId = accountId;

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
    npa: string;
    nxx?: string;
    lca?: string;
    limit?: number;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
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
        TN: tn,
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
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Enabling SMS/MMS for ${normalizedDid}...`);
      
      const response = await this.client.post("/tnRecord", {
        TN: normalizedDid,
        Sms: true,
        Mms: true,
      });
      
      console.log("[BulkVS] ✓ SMS/MMS enabled successfully");
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] enableSmsMms error:", error.response?.data || error.message);
      throw error;
    }
  }

  async listWebhooks() {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      console.log(`[BulkVS] Listing all webhooks...`);
      
      const response = await this.client.get("/webHooks");
      
      console.log("[BulkVS] Webhooks:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] listWebhooks error:", error.response?.data || error.message);
      throw error;
    }
  }

  async clearWebhook(did: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Clearing webhook and call forwarding from ${normalizedDid}...`);
      
      const response = await this.client.post("/tnRecord", {
        TN: normalizedDid,
        Webhook: "default",
        "Call Forward": "",
      });
      
      console.log("[BulkVS] ✓ Webhook and call forwarding cleared from number");
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] clearWebhook error:", error.response?.data || error.message);
      throw error;
    }
  }

  async deleteWebhook(webhookName: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      console.log(`[BulkVS] Deleting webhook "${webhookName}"...`);
      
      const response = await this.client.delete(`/webHooks/${encodeURIComponent(webhookName)}`);
      
      console.log("[BulkVS] ✓ Webhook deleted successfully");
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] deleteWebhook error:", error.response?.data || error.message);
      throw error;
    }
  }

  async setMessagingWebhook(did: string, webhookName: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Assigning webhook "${webhookName}" to ${normalizedDid}...`);
      
      const response = await this.client.post("/tnRecord", {
        TN: normalizedDid,
        Webhook: webhookName,
      });
      
      console.log("[BulkVS] ✓ Webhook assigned successfully");
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] setMessagingWebhook error:", error.response?.data || error.message);
      throw error;
    }
  }

  async assignToCampaign(did: string, campaignId: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Assigning ${normalizedDid} to campaign ${campaignId}...`);
      
      const response = await this.client.post("/tnRecord", {
        TN: normalizedDid,
        Tcr: campaignId,
      });
      
      console.log("[BulkVS] ✓ Campaign assigned successfully");
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
  }, companyId?: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      if (companyId) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "sms",
          identifier: payload.to
        });
      }
      
      const normalizedFrom = formatForBulkVS(payload.from);
      const normalizedTo = formatForBulkVS(payload.to);
      
      console.log(`[BulkVS] Sending message from ${normalizedFrom} to ${normalizedTo}`);
      
      const bulkvsPayload: any = {
        From: normalizedFrom,
        To: [normalizedTo],
      };
      
      bulkvsPayload.Message = payload.body || "";
      
      if (payload.mediaUrl) {
        bulkvsPayload.MediaURLs = [payload.mediaUrl];
        console.log("[BulkVS] MMS detected - MediaURLs:", bulkvsPayload.MediaURLs);
      }
      
      console.log("[BulkVS] Complete payload being sent to BulkVS:", JSON.stringify(bulkvsPayload, null, 2));
      
      const response = await this.client.post("/messageSend", bulkvsPayload);
      
      console.log("[BulkVS] BulkVS API response:", JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error: any) {
      if (error.message?.includes('blacklisted')) {
        console.log(`[BLACKLIST] Blocked outbound message to ${payload.to} on sms`);
      } else {
        console.error("[BulkVS] messageSend error:", error.response?.data || error.message);
      }
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

  async updateCNAM(did: string, cnam: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    const sanitizedCnam = this.sanitizeCNAM(cnam);
    
    try {
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Updating CNAM (Lidb) for ${normalizedDid} to "${sanitizedCnam}"...`);
      
      const requestBody = {
        TN: normalizedDid,
        Lidb: sanitizedCnam,
      };
      
      console.log(`[BulkVS] Request body:`, JSON.stringify(requestBody));
      console.log(`[BulkVS] Making POST request to /tnRecord...`);
      
      const response = await this.client.post("/tnRecord", requestBody);
      
      console.log("[BulkVS] Response status:", response.status);
      
      console.log("[BulkVS] updateCNAM response:", JSON.stringify(response.data));
      return { success: true, cnam: sanitizedCnam };
    } catch (error: any) {
      console.error("[BulkVS] updateCNAM error:", error.response?.data || error.message);
      
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

  private sanitizeCNAM(cnam: string): string {
    let sanitized = cnam.replace(/[^a-zA-Z0-9 ]/g, '');
    
    if (sanitized.length > 15) {
      sanitized = sanitized.substring(0, 15);
    }
    
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  async updateCallForwarding(did: string, forwardNumber: string | null) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const normalizedDid = formatForBulkVS(did);
      const normalizedForwardNumber = forwardNumber ? formatForBulkVS(forwardNumber) : null;
      
      console.log(`[BulkVS] Updating call forwarding for ${normalizedDid}...`);
      console.log(`[BulkVS] Forward to: ${normalizedForwardNumber || "DISABLED"}`);
      
      const requestBody: any = {
        TN: normalizedDid,
      };
      
      if (normalizedForwardNumber) {
        requestBody["Call Forward"] = normalizedForwardNumber;
      } else {
        requestBody["Call Forward"] = null;
      }
      
      console.log(`[BulkVS] Request body:`, JSON.stringify(requestBody));
      
      const response = await this.client.post("/tnRecord", requestBody);
      
      console.log("[BulkVS] ✓ Call forwarding updated successfully");
      return { 
        success: true, 
        forwardNumber: normalizedForwardNumber,
        message: normalizedForwardNumber 
          ? `Call forwarding enabled to ${forwardNumber}` 
          : "Call forwarding disabled"
      };
    } catch (error: any) {
      console.error("[BulkVS] updateCallForwarding error:", error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        throw new Error("Phone number not found in BulkVS");
      } else if (error.response?.status === 403) {
        throw new Error("Insufficient permissions or service not enabled");
      } else if (error.response?.status === 400) {
        throw new Error("Invalid phone number format or parameters");
      }
      
      throw new Error(`Failed to update call forwarding: ${error.response?.data?.message || error.message}`);
    }
  }

  async activateNumber(params: {
    did: string;
    companyName: string;
    webhookName: string;
    callForwardNumber?: string | null;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    const { did, companyName, webhookName, callForwardNumber } = params;
    const FIXED_CAMPAIGN_ID = "C3JXHXH";
    
    const result = {
      did,
      smsEnabled: false,
      webhookConfigured: false,
      cnamUpdated: false,
      campaignAssigned: false,
      callForwardingConfigured: false,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      const normalizedDid = formatForBulkVS(did);
      const sanitizedCnam = this.sanitizeCNAM(companyName);
      
      console.log(`[BulkVS] Activating ${normalizedDid} with all settings...`);
      console.log(`[BulkVS] - SMS/MMS: enabled`);
      console.log(`[BulkVS] - Webhook: ${webhookName}`);
      console.log(`[BulkVS] - CNAM: ${sanitizedCnam}`);
      console.log(`[BulkVS] - Campaign: ${FIXED_CAMPAIGN_ID}`);
      console.log(`[BulkVS] - Call Forward: ${callForwardNumber || 'disabled'}`);
      
      const requestBody: any = {
        TN: normalizedDid,
        Sms: true,
        Mms: true,
        Webhook: webhookName,
        Lidb: sanitizedCnam,
        Tcr: FIXED_CAMPAIGN_ID,
      };
      
      if (callForwardNumber) {
        const normalizedForward = formatForBulkVS(callForwardNumber);
        requestBody["Call Forward"] = normalizedForward;
      }
      
      console.log(`[BulkVS] POST /tnRecord request:`, JSON.stringify(requestBody, null, 2));
      
      const response = await this.client.post("/tnRecord", requestBody);
      
      console.log(`[BulkVS] ✓ Phone number fully configured:`, response.data);
      
      result.smsEnabled = true;
      result.webhookConfigured = true;
      result.cnamUpdated = true;
      result.campaignAssigned = true;
      result.callForwardingConfigured = !!callForwardNumber;
      
      console.log(`[BulkVS] ✓ Activation complete for ${did}`);
      console.log(`[BulkVS] All features configured successfully in one call`);

      return result;
    } catch (error: any) {
      console.error(`[BulkVS] Number activation failed for ${did}:`, error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        throw new Error("Phone number not found in BulkVS");
      } else if (error.response?.status === 403) {
        throw new Error("Insufficient permissions or service not enabled");
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid configuration: ${error.response?.data?.message || error.message}`);
      }
      
      throw new Error(`Failed to activate phone number: ${error.response?.data?.message || error.message}`);
    }
  }

  async createOrUpdateWebhook(params: {
    webhookName: string;
    webhookUrl: string;
    description?: string;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      console.log(`[BulkVS] Creating/updating webhook "${params.webhookName}"...`);
      
      const response = await this.client.put("/webHooks", {
        Webhook: params.webhookName,
        Description: params.description || `Inbound messages for ${params.webhookName}`,
        Url: params.webhookUrl,
        Dlr: true,
        Method: "POST",
      });
      
      console.log(`[BulkVS] ✓ Webhook created/updated successfully:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] createOrUpdateWebhook error:", error.response?.data || error.message);
      throw error;
    }
  }

  async assignWebhookToNumber(did: string, webhookName: string) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Assigning webhook "${webhookName}" to ${normalizedDid}...`);
      
      const response = await this.client.post("/tnRecord", {
        TN: normalizedDid,
        Webhook: webhookName,
      });
      
      console.log(`[BulkVS] ✓ Webhook assigned to number successfully`);
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] assignWebhookToNumber error:", error.response?.data || error.message);
      throw error;
    }
  }
}

async function initBulkVS(): Promise<BulkVSClient | null> {
  if (bulkVSInitialized) {
    return bulkVSClientInstance;
  }

  if (bulkVSInitPromise) {
    return bulkVSInitPromise;
  }

  bulkVSInitPromise = (async () => {
    try {
      const { apiKey, apiSecret, accountId } = await credentialProvider.getBulkVS();

      if (!apiKey || !apiSecret) {
        console.warn("⚠️  BulkVS credentials not configured. BulkVS features will be disabled.");
        bulkVSInitialized = true;
        return null;
      }

      bulkVSClientInstance = new BulkVSClient(apiKey, apiSecret, accountId);
      bulkVSInitialized = true;
      console.log("BulkVS service initialized successfully");
      return bulkVSClientInstance;
    } catch (error) {
      console.error("Failed to initialize BulkVS service:", error);
      bulkVSInitialized = true;
      return null;
    }
  })();

  return bulkVSInitPromise;
}

export async function getBulkVSClient(): Promise<BulkVSClient | null> {
  return initBulkVS();
}

async function ensureBulkVSConfigured(): Promise<BulkVSClient> {
  const client = await initBulkVS();
  if (!client) {
    throw new Error("BulkVS service not initialized");
  }
  return client;
}

class BulkVSService {
  async isConfigured(): Promise<boolean> {
    const client = await initBulkVS();
    return client !== null && client.isConfigured();
  }

  async accountDetail() {
    const client = await ensureBulkVSConfigured();
    return client.accountDetail();
  }

  async listAvailableDIDs(params: { npa: string; nxx?: string; lca?: string; limit?: number }) {
    const client = await ensureBulkVSConfigured();
    return client.listAvailableDIDs(params);
  }

  async buyDID(tn: string) {
    const client = await ensureBulkVSConfigured();
    return client.buyDID(tn);
  }

  async enableSmsMms(did: string) {
    const client = await ensureBulkVSConfigured();
    return client.enableSmsMms(did);
  }

  async listWebhooks() {
    const client = await ensureBulkVSConfigured();
    return client.listWebhooks();
  }

  async clearWebhook(did: string) {
    const client = await ensureBulkVSConfigured();
    return client.clearWebhook(did);
  }

  async deleteWebhook(webhookName: string) {
    const client = await ensureBulkVSConfigured();
    return client.deleteWebhook(webhookName);
  }

  async setMessagingWebhook(did: string, webhookName: string) {
    const client = await ensureBulkVSConfigured();
    return client.setMessagingWebhook(did, webhookName);
  }

  async assignToCampaign(did: string, campaignId: string) {
    const client = await ensureBulkVSConfigured();
    return client.assignToCampaign(did, campaignId);
  }

  async messageSend(payload: { from: string; to: string; body?: string; mediaUrl?: string }, companyId?: string) {
    const client = await ensureBulkVSConfigured();
    return client.messageSend(payload, companyId);
  }

  async messageStatus(providerMsgId: string) {
    const client = await ensureBulkVSConfigured();
    return client.messageStatus(providerMsgId);
  }

  async updateCNAM(did: string, cnam: string) {
    const client = await ensureBulkVSConfigured();
    return client.updateCNAM(did, cnam);
  }

  async updateCallForwarding(did: string, forwardNumber: string | null) {
    const client = await ensureBulkVSConfigured();
    return client.updateCallForwarding(did, forwardNumber);
  }

  async activateNumber(params: { did: string; companyName: string; webhookName: string; callForwardNumber?: string | null }) {
    const client = await ensureBulkVSConfigured();
    return client.activateNumber(params);
  }

  async createOrUpdateWebhook(params: { webhookName: string; webhookUrl: string; description?: string }) {
    const client = await ensureBulkVSConfigured();
    return client.createOrUpdateWebhook(params);
  }

  async assignWebhookToNumber(did: string, webhookName: string) {
    const client = await ensureBulkVSConfigured();
    return client.assignWebhookToNumber(did, webhookName);
  }
}

export const bulkVSClient = new BulkVSService();
