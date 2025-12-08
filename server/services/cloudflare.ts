import { credentialProvider } from "./credential-provider";

interface CloudflareSSLSettings {
  method: "http" | "txt" | "email";
  type: "dv";
  settings: {
    http2: "on" | "off";
    min_tls_version: "1.0" | "1.1" | "1.2" | "1.3";
  };
}

interface CloudflareCustomHostnameRequest {
  hostname: string;
  ssl: CloudflareSSLSettings;
}

interface CloudflareOwnershipVerification {
  type: string;
  name: string;
  value: string;
}

interface CloudflareSSLResponse {
  id: string;
  type: string;
  method: string;
  status: string;
  validation_records?: Array<{
    txt_name?: string;
    txt_value?: string;
    http_url?: string;
    http_body?: string;
    cname?: string;
    cname_target?: string;
  }>;
  settings: {
    http2: string;
    min_tls_version: string;
    tls_1_3: string;
  };
}

interface CloudflareCustomHostnameResponse {
  id: string;
  hostname: string;
  ssl: CloudflareSSLResponse;
  status: string;
  ownership_verification?: CloudflareOwnershipVerification;
  ownership_verification_http?: {
    http_url: string;
    http_body: string;
  };
  created_at: string;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
}

export interface CustomDomainResult {
  success: boolean;
  hostnameId?: string;
  hostname?: string;
  status?: string;
  cnameTarget?: string;
  cnameHost?: string;
  sslStatus?: string;
  validationRecords?: Array<{
    type: string;
    name: string;
    value: string;
  }>;
  error?: string;
}

class CloudflareService {
  private readonly BASE_URL = "https://api.cloudflare.com/client/v4";

  private async getCredentials(): Promise<{ apiToken: string; zoneId: string }> {
    const { apiToken, zoneId } = await credentialProvider.getCloudflare();
    
    console.log("[Cloudflare] Debug - apiToken length:", apiToken?.length || 0);
    console.log("[Cloudflare] Debug - zoneId length:", zoneId?.length || 0);
    console.log("[Cloudflare] Debug - apiToken first 10 chars:", apiToken?.substring(0, 10) || "null");
    
    if (!apiToken) {
      throw new Error("Cloudflare API token not configured. Please add it in System Settings.");
    }
    if (!zoneId) {
      throw new Error("Cloudflare Zone ID not configured. Please add it in System Settings.");
    }
    
    return { apiToken, zoneId };
  }

  async createCustomHostname(hostname: string): Promise<CustomDomainResult> {
    try {
      const { apiToken, zoneId } = await this.getCredentials();

      const requestBody: CloudflareCustomHostnameRequest = {
        hostname,
        ssl: {
          method: "http",
          type: "dv",
          settings: {
            http2: "on",
            min_tls_version: "1.2",
          },
        },
      };

      const response = await fetch(
        `${this.BASE_URL}/zones/${zoneId}/custom_hostnames`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data: CloudflareApiResponse<CloudflareCustomHostnameResponse> = await response.json();
      
      console.log("[Cloudflare] Full API response:", JSON.stringify(data, null, 2));

      if (!data.success) {
        const errorDetails = data.errors.map(e => `[${e.code}] ${e.message}`).join(", ");
        console.error("[Cloudflare] Create hostname failed:", errorDetails);
        console.error("[Cloudflare] Error codes:", data.errors.map(e => e.code));
        return {
          success: false,
          error: errorDetails || "Failed to create custom hostname",
        };
      }

      const result = data.result;
      
      const validationRecords: Array<{ type: string; name: string; value: string }> = [];
      
      if (result.ssl?.validation_records) {
        for (const record of result.ssl.validation_records) {
          if (record.txt_name && record.txt_value) {
            validationRecords.push({
              type: "TXT",
              name: record.txt_name,
              value: record.txt_value,
            });
          }
          if (record.cname && record.cname_target) {
            validationRecords.push({
              type: "CNAME",
              name: record.cname,
              value: record.cname_target,
            });
          }
        }
      }

      console.log(`[Cloudflare] Custom hostname created: ${hostname} (ID: ${result.id})`);

      return {
        success: true,
        hostnameId: result.id,
        hostname: result.hostname,
        status: result.status,
        sslStatus: result.ssl?.status,
        cnameTarget: "app.curbe.io",
        cnameHost: "@",
        validationRecords,
      };
    } catch (error) {
      console.error("[Cloudflare] Error creating custom hostname:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getCustomHostname(hostnameId: string): Promise<CustomDomainResult> {
    try {
      const { apiToken, zoneId } = await this.getCredentials();

      const response = await fetch(
        `${this.BASE_URL}/zones/${zoneId}/custom_hostnames/${hostnameId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data: CloudflareApiResponse<CloudflareCustomHostnameResponse> = await response.json();

      if (!data.success) {
        const errorMessage = data.errors.map(e => e.message).join(", ");
        return {
          success: false,
          error: errorMessage || "Failed to get custom hostname",
        };
      }

      const result = data.result;
      
      return {
        success: true,
        hostnameId: result.id,
        hostname: result.hostname,
        status: result.status,
        sslStatus: result.ssl?.status,
        cnameTarget: "app.curbe.io",
        cnameHost: "@",
      };
    } catch (error) {
      console.error("[Cloudflare] Error getting custom hostname:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async deleteCustomHostname(hostnameId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { apiToken, zoneId } = await this.getCredentials();

      const response = await fetch(
        `${this.BASE_URL}/zones/${zoneId}/custom_hostnames/${hostnameId}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data: CloudflareApiResponse<{ id: string }> = await response.json();

      if (!data.success) {
        const errorMessage = data.errors.map(e => e.message).join(", ");
        return {
          success: false,
          error: errorMessage || "Failed to delete custom hostname",
        };
      }

      console.log(`[Cloudflare] Custom hostname deleted: ${hostnameId}`);
      return { success: true };
    } catch (error) {
      console.error("[Cloudflare] Error deleting custom hostname:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async refreshCustomHostname(hostnameId: string): Promise<CustomDomainResult> {
    try {
      const { apiToken, zoneId } = await this.getCredentials();

      const response = await fetch(
        `${this.BASE_URL}/zones/${zoneId}/custom_hostnames/${hostnameId}`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ssl: {
              method: "http",
              type: "dv",
            },
          }),
        }
      );

      const data: CloudflareApiResponse<CloudflareCustomHostnameResponse> = await response.json();

      if (!data.success) {
        const errorMessage = data.errors.map(e => e.message).join(", ");
        return {
          success: false,
          error: errorMessage || "Failed to refresh custom hostname",
        };
      }

      const result = data.result;
      
      return {
        success: true,
        hostnameId: result.id,
        hostname: result.hostname,
        status: result.status,
        sslStatus: result.ssl?.status,
      };
    } catch (error) {
      console.error("[Cloudflare] Error refreshing custom hostname:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

export const cloudflareService = new CloudflareService();
