import { getTelnyxMasterApiKey } from "./telnyx-numbers-service";
import { getCompanyManagedAccountId } from "./telnyx-managed-accounts";
import FormData from "form-data";
import { Readable } from "stream";
import https from "https";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

export interface TelnyxMediaUploadResult {
  success: boolean;
  mediaId?: string;
  mediaName?: string;
  mediaUrl?: string;
  error?: string;
}

export interface TelnyxMediaDeleteResult {
  success: boolean;
  error?: string;
}

export async function uploadMediaToTelnyx(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  companyId?: string
): Promise<TelnyxMediaUploadResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Get managed account ID if companyId is provided
    // This is CRITICAL: Media must be uploaded to the managed account
    // for Call Control to access it (media is NOT shared between accounts)
    let managedAccountId: string | null = null;
    if (companyId) {
      managedAccountId = await getCompanyManagedAccountId(companyId);
      console.log("[TelnyxMedia] Using managed account for upload:", managedAccountId);
    }
    
    // Convert buffer to readable stream for proper multipart handling
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);
    
    // Create proper multipart/form-data
    const formData = new FormData();
    formData.append("media", bufferStream, {
      filename: fileName,
      contentType: mimeType,
      knownLength: fileBuffer.length,
    });
    
    // Build headers - include X-Managed-Account-Id if we have a managed account
    const headers: Record<string, string> = {
      ...formData.getHeaders(),
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    };
    
    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }
    
    // Use https module for proper multipart streaming
    const response = await new Promise<Response>((resolve, reject) => {
      const req = https.request({
        hostname: "api.telnyx.com",
        port: 443,
        path: "/v2/media",
        method: "POST",
        headers,
      }, (res: any) => {
        let data = "";
        res.on("data", (chunk: string) => data += chunk);
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => data,
            json: async () => JSON.parse(data),
          } as any);
        });
      });
      
      req.on("error", reject);
      formData.pipe(req);
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TelnyxMedia] Upload failed:", response.status, errorText);
      return {
        success: false,
        error: `Telnyx upload failed: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json() as any;
    const mediaData = result.data;
    
    console.log("[TelnyxMedia] Upload success:", {
      mediaName: mediaData.media_name,
      contentType: mediaData.content_type,
    });

    // Use the media_name for playback (this is the ID for Telnyx)
    return {
      success: true,
      mediaId: mediaData.media_name,
      mediaName: mediaData.media_name,
      mediaUrl: `https://api.telnyx.com/v2/media/${mediaData.media_name}/download`,
    };
  } catch (error: any) {
    console.error("[TelnyxMedia] Upload error:", error);
    return {
      success: false,
      error: error.message || "Unknown error uploading to Telnyx",
    };
  }
}

export async function deleteMediaFromTelnyx(mediaId: string, companyId?: string): Promise<TelnyxMediaDeleteResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Get managed account ID if companyId is provided
    let managedAccountId: string | null = null;
    if (companyId) {
      managedAccountId = await getCompanyManagedAccountId(companyId);
      console.log("[TelnyxMedia] Using managed account for delete:", managedAccountId);
    }
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }
    
    const response = await fetch(`${TELNYX_API_BASE}/media/${mediaId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[TelnyxMedia] Media already deleted or not found:", mediaId);
        return { success: true };
      }
      
      const errorText = await response.text();
      console.error("[TelnyxMedia] Delete failed:", response.status, errorText);
      return {
        success: false,
        error: `Telnyx delete failed: ${response.status} - ${errorText}`,
      };
    }

    console.log("[TelnyxMedia] Delete success:", mediaId);
    return { success: true };
  } catch (error: any) {
    console.error("[TelnyxMedia] Delete error:", error);
    return {
      success: false,
      error: error.message || "Unknown error deleting from Telnyx",
    };
  }
}

export async function getMediaFromTelnyx(mediaId: string): Promise<any> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const response = await fetch(`${TELNYX_API_BASE}/media/${mediaId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as any;
    return result.data;
  } catch (error: any) {
    console.error("[TelnyxMedia] Get error:", error);
    return null;
  }
}
