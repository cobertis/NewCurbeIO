import { getTelnyxMasterApiKey } from "./telnyx-numbers-service";
import FormData from "form-data";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

export interface TelnyxMediaUploadResult {
  success: boolean;
  mediaId?: string;
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
  mimeType: string
): Promise<TelnyxMediaUploadResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    // Create proper multipart/form-data with the file buffer
    const formData = new FormData();
    formData.append("media_name", fileName);
    formData.append("media", fileBuffer, {
      filename: fileName,
      contentType: mimeType,
    });
    
    const response = await fetch(`${TELNYX_API_BASE}/media`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
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
      mediaId: mediaData.id,
      mediaName: mediaData.media_name,
    });

    // The download URL format for Telnyx media
    const mediaUrl = `https://api.telnyx.com/v2/media/${mediaData.id}/download`;

    return {
      success: true,
      mediaId: mediaData.id,
      mediaUrl: mediaUrl,
    };
  } catch (error: any) {
    console.error("[TelnyxMedia] Upload error:", error);
    return {
      success: false,
      error: error.message || "Unknown error uploading to Telnyx",
    };
  }
}

export async function deleteMediaFromTelnyx(mediaId: string): Promise<TelnyxMediaDeleteResult> {
  try {
    const apiKey = await getTelnyxMasterApiKey();
    
    const response = await fetch(`${TELNYX_API_BASE}/media/${mediaId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
