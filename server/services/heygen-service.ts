import { credentialProvider } from "./credential-provider";
import fetch from "node-fetch";

const HEYGEN_API_BASE = "https://api.heygen.com/v1";

export interface HeygenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
}

export interface HeygenAvatarsResponse {
  error?: string;
  data?: {
    avatars: HeygenAvatar[];
  };
}

export interface CreateVideoOptions {
  script: string;
  avatarId: string;
  templateId?: string;
  voiceId?: string;
}

export interface CreateVideoResponse {
  error?: string;
  data?: {
    video_id: string;
  };
}

export interface VideoStatusResponse {
  error?: string;
  data?: {
    status: "processing" | "completed" | "failed" | "pending";
    video_url?: string;
    error?: string;
    thumbnail_url?: string;
    duration?: number;
  };
}

export const heygenService = {
  async getApiKey(): Promise<string> {
    const { apiKey } = await credentialProvider.getHeygen();
    return apiKey;
  },

  async getAvatars(): Promise<HeygenAvatar[]> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error("Heygen API key not configured");
    }
    
    const response = await fetch(`${HEYGEN_API_BASE}/avatar.list`, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Heygen API error: ${response.status} - ${errorText}`);
    }
    
    const data = (await response.json()) as HeygenAvatarsResponse;
    
    if (data.error) {
      throw new Error(`Heygen API error: ${data.error}`);
    }
    
    return data.data?.avatars || [];
  },

  async createVideo(options: CreateVideoOptions): Promise<string> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error("Heygen API key not configured");
    }
    
    const { script, avatarId, templateId, voiceId } = options;
    
    const requestBody: any = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarId,
            avatar_style: "normal",
          },
          voice: voiceId ? { type: "audio", audio_url: voiceId } : { type: "text", input_text: script },
          background: {
            type: "color",
            value: "#FFFFFF",
          },
        },
      ],
      dimension: {
        width: 1280,
        height: 720,
      },
    };
    
    if (templateId) {
      requestBody.template_id = templateId;
    }
    
    const response = await fetch(`${HEYGEN_API_BASE}/video.generate`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Heygen API error: ${response.status} - ${errorText}`);
    }
    
    const data = (await response.json()) as CreateVideoResponse;
    
    if (data.error) {
      throw new Error(`Heygen API error: ${data.error}`);
    }
    
    if (!data.data?.video_id) {
      throw new Error("Heygen API did not return a video_id");
    }
    
    return data.data.video_id;
  },

  async getVideoStatus(videoId: string): Promise<{
    status: "processing" | "completed" | "failed" | "pending";
    videoUrl?: string;
    error?: string;
    thumbnailUrl?: string;
    duration?: number;
  }> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error("Heygen API key not configured");
    }
    
    const response = await fetch(
      `${HEYGEN_API_BASE}/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Heygen API error: ${response.status} - ${errorText}`);
    }
    
    const data = (await response.json()) as VideoStatusResponse;
    
    if (data.error) {
      throw new Error(`Heygen API error: ${data.error}`);
    }
    
    return {
      status: data.data?.status || "pending",
      videoUrl: data.data?.video_url,
      error: data.data?.error,
      thumbnailUrl: data.data?.thumbnail_url,
      duration: data.data?.duration,
    };
  },
};

export default heygenService;
