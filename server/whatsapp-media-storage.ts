import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export interface WhatsAppMediaFile {
  id: string;
  companyId: string;
  chatId: string;
  messageId: string;
  mimetype: string;
  filename: string;
  size: number;
  storagePath: string;
  createdAt: Date;
}

export interface UploadMediaOptions {
  companyId: string;
  chatId: string;
  messageId: string;
  buffer: Buffer;
  mimetype: string;
  filename?: string;
}

export interface GetMediaOptions {
  companyId: string;
  storagePath: string;
}

class WhatsAppMediaStorageService {
  private bucketName: string | null = null;
  private isConfigured: boolean = false;
  private configError: string | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const mediaDir = process.env.WHATSAPP_MEDIA_DIR;
    if (!mediaDir) {
      this.configError = "WHATSAPP_MEDIA_DIR not set. Create a bucket in Object Storage and set WHATSAPP_MEDIA_DIR env var (format: /bucket-name/whatsapp-media).";
      console.log(`[WhatsApp Media Storage] ${this.configError}`);
      return;
    }

    try {
      const parts = mediaDir.split("/").filter(Boolean);
      if (parts.length < 1) {
        this.configError = "WHATSAPP_MEDIA_DIR must be in format /bucket-name/optional-prefix";
        console.log(`[WhatsApp Media Storage] ${this.configError}`);
        return;
      }
      this.bucketName = parts[0];
      this.isConfigured = true;
      console.log(`[WhatsApp Media Storage] Configured with bucket: ${this.bucketName}`);
    } catch (error) {
      this.configError = `Failed to parse WHATSAPP_MEDIA_DIR: ${error}`;
      console.log(`[WhatsApp Media Storage] ${this.configError}`);
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  getConfigError(): string | null {
    return this.configError;
  }

  private getStoragePath(companyId: string, chatId: string, messageId: string, ext: string): string {
    const mediaDir = process.env.WHATSAPP_MEDIA_DIR || "";
    const prefix = mediaDir.split("/").filter(Boolean).slice(1).join("/");
    const basePath = prefix ? `${prefix}/` : "";
    const sanitizedChatId = chatId.replace(/[^a-zA-Z0-9@.-]/g, "_");
    return `${basePath}${companyId}/${sanitizedChatId}/${messageId}${ext}`;
  }

  private getExtensionFromMimetype(mimetype: string): string {
    const mimeToExt: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/3gpp": ".3gp",
      "video/quicktime": ".mov",
      "audio/ogg": ".ogg",
      "audio/mpeg": ".mp3",
      "audio/mp4": ".m4a",
      "audio/aac": ".aac",
      "audio/webm": ".weba",
      "application/pdf": ".pdf",
      "application/vnd.ms-excel": ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      "text/plain": ".txt",
    };
    return mimeToExt[mimetype] || ".bin";
  }

  async uploadMedia(options: UploadMediaOptions): Promise<WhatsAppMediaFile | null> {
    if (!this.isConfigured || !this.bucketName) {
      console.log("[WhatsApp Media Storage] Not configured, skipping upload");
      return null;
    }

    const { companyId, chatId, messageId, buffer, mimetype, filename } = options;
    const ext = this.getExtensionFromMimetype(mimetype);
    const storagePath = this.getStoragePath(companyId, chatId, messageId, ext);

    try {
      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType: mimetype,
          metadata: {
            companyId,
            chatId,
            messageId,
            originalFilename: filename || `media${ext}`,
          },
        },
      });

      const mediaFile: WhatsAppMediaFile = {
        id: randomUUID(),
        companyId,
        chatId,
        messageId,
        mimetype,
        filename: filename || `media${ext}`,
        size: buffer.length,
        storagePath,
        createdAt: new Date(),
      };

      console.log(`[WhatsApp Media Storage] Uploaded: ${storagePath} (${buffer.length} bytes)`);
      return mediaFile;
    } catch (error) {
      console.error(`[WhatsApp Media Storage] Upload failed:`, error);
      return null;
    }
  }

  async getMedia(options: GetMediaOptions): Promise<{ buffer: Buffer; mimetype: string } | null> {
    if (!this.isConfigured || !this.bucketName) {
      console.log("[WhatsApp Media Storage] Not configured, cannot retrieve media");
      return null;
    }

    const { storagePath } = options;

    try {
      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        console.log(`[WhatsApp Media Storage] File not found: ${storagePath}`);
        return null;
      }

      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      const mimetype = metadata.contentType || "application/octet-stream";

      return { buffer, mimetype };
    } catch (error) {
      console.error(`[WhatsApp Media Storage] Get media failed:`, error);
      return null;
    }
  }

  async getMediaUrl(storagePath: string, ttlSeconds: number = 3600): Promise<string | null> {
    if (!this.isConfigured || !this.bucketName) {
      return null;
    }

    try {
      const response = await fetch(
        `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket_name: this.bucketName,
            object_name: storagePath,
            method: "GET",
            expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          }),
        }
      );

      if (!response.ok) {
        console.error(`[WhatsApp Media Storage] Failed to sign URL: ${response.status}`);
        return null;
      }

      const { signed_url } = await response.json();
      return signed_url;
    } catch (error) {
      console.error(`[WhatsApp Media Storage] Sign URL failed:`, error);
      return null;
    }
  }

  async deleteMedia(storagePath: string): Promise<boolean> {
    if (!this.isConfigured || !this.bucketName) {
      return false;
    }

    try {
      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(storagePath);
      await file.delete({ ignoreNotFound: true });
      console.log(`[WhatsApp Media Storage] Deleted: ${storagePath}`);
      return true;
    } catch (error) {
      console.error(`[WhatsApp Media Storage] Delete failed:`, error);
      return false;
    }
  }

  async listMedia(companyId: string, chatId?: string): Promise<string[]> {
    if (!this.isConfigured || !this.bucketName) {
      return [];
    }

    try {
      const mediaDir = process.env.WHATSAPP_MEDIA_DIR || "";
      const prefix = mediaDir.split("/").filter(Boolean).slice(1).join("/");
      const basePath = prefix ? `${prefix}/` : "";
      const searchPrefix = chatId 
        ? `${basePath}${companyId}/${chatId.replace(/[^a-zA-Z0-9@.-]/g, "_")}/`
        : `${basePath}${companyId}/`;

      const bucket = objectStorageClient.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix: searchPrefix });
      
      return files.map(f => f.name);
    } catch (error) {
      console.error(`[WhatsApp Media Storage] List failed:`, error);
      return [];
    }
  }
}

export const whatsappMediaStorage = new WhatsAppMediaStorageService();
