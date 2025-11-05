import axios, { AxiosInstance } from "axios";
import { formatForBulkVS } from "@shared/phone";

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
      
      const response = await this.client.post("/smsEnable", {
        accountId: this.accountId,
        did: normalizedDid,
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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      const response = await this.client.post("/smsSetWebhook", {
        accountId: this.accountId,
        did: normalizedDid,
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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      const response = await this.client.post("/smsAssignCampaign", {
        accountId: this.accountId,
        did: normalizedDid,
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
      // Normalize DID to 11-digit format (1NXXNXXXXXX) for BulkVS API
      const normalizedDid = formatForBulkVS(did);
      
      console.log(`[BulkVS] Updating CNAM for ${normalizedDid} to "${sanitizedCnam}"...`);
      
      // Try the /updateCnam endpoint
      const response = await this.client.post("/updateCnam", {
        did: normalizedDid,
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
      const tn = formatForBulkVS(did);
      const callForward = forwardNumber ? formatForBulkVS(forwardNumber) : "";
      
      console.log(`[BulkVS] Updating call forwarding for ${tn}...`);
      console.log(`[BulkVS] Forward to: ${callForward || "DISABLED"}`);
      
      // BulkVS API: POST /tnRecord to update telephone number record
      const response = await this.client.post("/tnRecord", {
        TN: tn,
        "Call Forward": callForward, // Empty string disables call forwarding
      });
      
      console.log("[BulkVS] Call forwarding updated successfully:", response.data);
      return { 
        success: true, 
        forwardNumber: callForward,
        message: callForward 
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
   * This function enables all required features for a number to work properly:
   * 1. SMS/MMS enable (CRITICAL - hard-stop if fails)
   * 2. Webhook setup (CRITICAL)
   * 3. CNAM update (soft-fail)
   * 4. Messaging campaign assignment (soft-fail)
   * 5. Call forwarding (soft-fail, only if configured)
   * 
   * @param did - Phone number in E.164 format
   * @param companyName - Company name for CNAM
   * @param webhookUrl - Webhook URL for incoming messages
   * @param callForwardNumber - Optional call forwarding destination
   * @returns Activation result with status for each step
   */
  async activateNumber(params: {
    did: string;
    companyName: string;
    webhookUrl: string;
    callForwardNumber?: string | null;
  }) {
    if (!this.isConfigured()) throw new Error("BulkVS not configured");
    
    const { did, companyName, webhookUrl, callForwardNumber } = params;
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
      // STEP 1: Enable SMS/MMS (CRITICAL - hard-stop if fails)
      console.log(`[BulkVS] [1/5] Enabling SMS/MMS for ${did}...`);
      try {
        await this.enableSmsMms(did);
        result.smsEnabled = true;
        console.log(`[BulkVS] ✓ SMS/MMS enabled successfully`);
      } catch (error: any) {
        const errorMsg = `Failed to enable SMS/MMS: ${error.message}`;
        console.error(`[BulkVS] ✗ ${errorMsg}`);
        result.errors.push(errorMsg);
        // HARD-STOP: SMS/MMS is critical, throw error
        throw new Error(`Critical error during number activation: ${errorMsg}`);
      }

      // STEP 2: Configure webhook (CRITICAL)
      console.log(`[BulkVS] [2/5] Configuring messaging webhook...`);
      try {
        await this.setMessagingWebhook(did, webhookUrl);
        result.webhookConfigured = true;
        console.log(`[BulkVS] ✓ Webhook configured successfully`);
      } catch (error: any) {
        const errorMsg = `Failed to configure webhook: ${error.message}`;
        console.error(`[BulkVS] ✗ ${errorMsg}`);
        result.errors.push(errorMsg);
        // HARD-STOP: Webhook is critical for receiving messages
        throw new Error(`Critical error during number activation: ${errorMsg}`);
      }

      // STEP 3: Update CNAM (SOFT-FAIL)
      console.log(`[BulkVS] [3/5] Updating CNAM to "${companyName}"...`);
      try {
        const cnamResult = await this.updateCNAM(did, companyName);
        if (cnamResult.success) {
          result.cnamUpdated = true;
          console.log(`[BulkVS] ✓ CNAM updated to "${cnamResult.cnam}"`);
        } else {
          result.warnings.push(cnamResult.message || "CNAM update not available");
          console.log(`[BulkVS] ⚠ CNAM warning: ${cnamResult.message}`);
        }
      } catch (error: any) {
        const warnMsg = `Failed to update CNAM: ${error.message}`;
        result.warnings.push(warnMsg);
        console.warn(`[BulkVS] ⚠ ${warnMsg} (continuing...)`);
      }

      // STEP 4: Assign to messaging campaign (SOFT-FAIL)
      console.log(`[BulkVS] [4/5] Assigning to messaging campaign ${FIXED_CAMPAIGN_ID}...`);
      try {
        await this.assignToCampaign(did, FIXED_CAMPAIGN_ID);
        result.campaignAssigned = true;
        console.log(`[BulkVS] ✓ Campaign assigned successfully`);
      } catch (error: any) {
        const warnMsg = `Failed to assign campaign: ${error.message}`;
        result.warnings.push(warnMsg);
        console.warn(`[BulkVS] ⚠ ${warnMsg} (continuing...)`);
      }

      // STEP 5: Configure call forwarding (SOFT-FAIL, only if specified)
      if (callForwardNumber) {
        console.log(`[BulkVS] [5/5] Configuring call forwarding to ${callForwardNumber}...`);
        try {
          await this.updateCallForwarding(did, callForwardNumber);
          result.callForwardingConfigured = true;
          console.log(`[BulkVS] ✓ Call forwarding configured successfully`);
        } catch (error: any) {
          const warnMsg = `Failed to configure call forwarding: ${error.message}`;
          result.warnings.push(warnMsg);
          console.warn(`[BulkVS] ⚠ ${warnMsg} (continuing...)`);
        }
      } else {
        console.log(`[BulkVS] [5/5] Skipping call forwarding (not configured)`);
      }

      console.log(`[BulkVS] ✓ Number activation complete for ${did}`);
      console.log(`[BulkVS] Results: SMS=${result.smsEnabled}, Webhook=${result.webhookConfigured}, CNAM=${result.cnamUpdated}, Campaign=${result.campaignAssigned}, CallFwd=${result.callForwardingConfigured}`);
      
      if (result.warnings.length > 0) {
        console.log(`[BulkVS] Warnings (${result.warnings.length}):`, result.warnings);
      }

      return result;
    } catch (error: any) {
      console.error(`[BulkVS] Number activation failed for ${did}:`, error.message);
      throw error;
    }
  }
}

export const bulkVSClient = new BulkVSClient();
