import axios, { AxiosInstance } from "axios";
import { formatForBulkVS } from "@shared/phone";
import { blacklistService } from "./services/blacklist-service";

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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Enabling SMS/MMS for ${normalizedDid}...`);
      
      // Use /tnRecord endpoint to enable SMS and MMS
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
      
      // Use GET /webHooks endpoint to list all webhooks
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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Clearing webhook and call forwarding from ${normalizedDid}...`);
      
      // Use /tnRecord endpoint to remove webhook and call forwarding (set to default)
      const response = await this.client.post("/tnRecord", {
        TN: normalizedDid,
        Webhook: "default", // Set to default webhook to disassociate
        "Call Forward": "", // Clear call forwarding
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
      
      // Use DELETE /webHooks endpoint to delete webhook
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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Assigning webhook "${webhookName}" to ${normalizedDid}...`);
      
      // Use /tnRecord endpoint to assign webhook to number
      const response = await this.client.post("/tnRecord", {
        TN: normalizedDid,
        Webhook: webhookName, // Name of the webhook (company slug)
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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Assigning ${normalizedDid} to campaign ${campaignId}...`);
      
      // Use /tnRecord endpoint to assign campaign (Tcr = The Campaign Registry)
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
      // Check blacklist before sending (if companyId provided)
      if (companyId) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "sms",
          identifier: payload.to
        });
      }
      
      // Normalize phone numbers to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedFrom = formatForBulkVS(payload.from);
      const normalizedTo = formatForBulkVS(payload.to);
      
      console.log(`[BulkVS] Sending message from ${normalizedFrom} to ${normalizedTo}`);
      
      // BulkVS API format (official documentation):
      // - From: 11-digit number (e.g., "13109060901")
      // - To: ARRAY of 11-digit numbers (e.g., ["13105551212"])
      // - Message: text content
      // - delivery_status_webhook_url: optional webhook URL
      // 
      // NOTE: Campaign ID (Tcr) is configured once on the phone number via /tnRecord,
      // NOT sent with each message. MediaURLs support is not in official docs.
      const bulkvsPayload: any = {
        From: normalizedFrom,
        To: [normalizedTo], // Must be an array
      };
      
      // CRITICAL: Message field is REQUIRED by BulkVS API, even for MMS-only
      // Without Message field, the API accepts the request but doesn't deliver the media
      bulkvsPayload.Message = payload.body || "";
      
      // Add Media if mediaUrl is provided (MMS)
      // According to BulkVS API documentation: use "MediaURLs" (plural) as array
      if (payload.mediaUrl) {
        bulkvsPayload.MediaURLs = [payload.mediaUrl];
        console.log("[BulkVS] MMS detected - MediaURLs:", bulkvsPayload.MediaURLs);
      }
      
      console.log("[BulkVS] Complete payload being sent to BulkVS:", JSON.stringify(bulkvsPayload, null, 2));
      
      const response = await this.client.post("/messageSend", bulkvsPayload);
      
      console.log("[BulkVS] BulkVS API response:", JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error: any) {
      // Log blacklist rejections distinctly
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

  /**
   * Update CNAM (Caller ID Name) for a phone number
   * Uses POST /tnRecord endpoint with "Lid" (Listed ID) field
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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Updating CNAM (Lidb) for ${normalizedDid} to "${sanitizedCnam}"...`);
      
      // Use /tnRecord endpoint with "Lidb" field (Line Information Database = Caller ID Name)
      // According to BulkVS API docs, the request format is:
      // { "TN": "phone_number", "Lidb": "caller_id_name", ... }
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

  /**
   * Update Call Forwarding for a phone number
   * Uses POST /tnRecord endpoint to update routing configuration
   * @param did - Phone number in E.164 format (e.g., +13109060901)
   * @param forwardNumber - Destination number to forward calls to (E.164 format), or null to disable
   */
  async updateCallForwarding(did: string, forwardNumber: string | null) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    try {
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      const normalizedForwardNumber = forwardNumber ? formatForBulkVS(forwardNumber) : null;
      
      console.log(`[BulkVS] Updating call forwarding for ${normalizedDid}...`);
      console.log(`[BulkVS] Forward to: ${normalizedForwardNumber || "DISABLED"}`);
      
      // Use /tnRecord endpoint to update call forwarding
      // According to BulkVS API docs, the field is "Call Forward"
      const requestBody: any = {
        TN: normalizedDid,
      };
      
      // Set "Call Forward" field - null or empty string disables forwarding
      if (normalizedForwardNumber) {
        requestBody["Call Forward"] = normalizedForwardNumber;
      } else {
        requestBody["Call Forward"] = null; // Explicitly disable
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
      
      // Provide helpful error message
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
  /**
   * Complete activation sequence for a phone number
   * Uses a SINGLE POST /tnRecord call to configure all settings at once:
   * - SMS/MMS enabled
   * - Webhook assignment
   * - CNAM (Caller ID Name) 
   * - Campaign assignment (10DLC)
   * - Call forwarding (optional)
   * 
   * @param did - Phone number in E.164 format
   * @param companyName - Company name for CNAM (Lidb field)
   * @param webhookName - Webhook name to assign (must be created first via PUT /webHooks)
   * @param callForwardNumber - Optional call forwarding destination
   * @returns Activation result with status
   */
  async activateNumber(params: {
    did: string;
    companyName: string;
    webhookName: string;
    callForwardNumber?: string | null;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    const { did, companyName, webhookName, callForwardNumber } = params;
    const FIXED_CAMPAIGN_ID = "C3JXHXH"; // BulkVS messaging campaign ID
    
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
      // Normalize DID to 11-digit format for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      const sanitizedCnam = this.sanitizeCNAM(companyName);
      
      console.log(`[BulkVS] Activating ${normalizedDid} with all settings...`);
      console.log(`[BulkVS] - SMS/MMS: enabled`);
      console.log(`[BulkVS] - Webhook: ${webhookName}`);
      console.log(`[BulkVS] - CNAM: ${sanitizedCnam}`);
      console.log(`[BulkVS] - Campaign: ${FIXED_CAMPAIGN_ID}`);
      console.log(`[BulkVS] - Call Forward: ${callForwardNumber || 'disabled'}`);
      
      // Build request body with all configuration fields
      const requestBody: any = {
        TN: normalizedDid,
        Sms: true,                    // Enable SMS
        Mms: true,                    // Enable MMS
        Webhook: webhookName,         // Assign webhook by name
        Lidb: sanitizedCnam,          // Set CNAM (Caller ID Name)
        Tcr: FIXED_CAMPAIGN_ID,       // Assign to 10DLC campaign
      };
      
      // Add call forwarding if specified
      if (callForwardNumber) {
        const normalizedForward = formatForBulkVS(callForwardNumber);
        requestBody["Call Forward"] = normalizedForward;
      }
      
      console.log(`[BulkVS] POST /tnRecord request:`, JSON.stringify(requestBody, null, 2));
      
      // Make single API call to configure everything
      const response = await this.client.post("/tnRecord", requestBody);
      
      console.log(`[BulkVS] ✓ Phone number fully configured:`, response.data);
      
      // Mark all as successful
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
      
      // Provide helpful error messages
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

  /**
   * Create or update a webhook in BulkVS
   * Uses PUT /webHooks endpoint
   */
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
        Dlr: true, // Enable delivery receipts
        Method: "POST", // POST method for webhook
      });
      
      console.log(`[BulkVS] ✓ Webhook created/updated successfully:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error("[BulkVS] createOrUpdateWebhook error:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Assign webhook to a phone number
   * Uses POST /tnRecord endpoint with Webhook field
   */
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

export const bulkVSClient = new BulkVSClient();
