import { credentialProvider } from "./credential-provider";
import fetch from "node-fetch";
import { promises as fs } from "fs";
import path from "path";

const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

export interface GenerateSpeechOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

export const elevenLabsService = {
  async getApiKey(): Promise<string> {
    const { apiKey } = await credentialProvider.getElevenLabs();
    return apiKey;
  },

  async getVoices(): Promise<ElevenLabsVoice[]> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }
    
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }
    
    const data = (await response.json()) as ElevenLabsVoicesResponse;
    return data.voices || [];
  },

  async generateSpeech(
    options: GenerateSpeechOptions,
    companyId: string,
    assetId: string
  ): Promise<{ url: string; filePath: string }> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }
    
    const { text, voiceId, modelId, stability, similarityBoost } = options;
    
    const requestBody: any = {
      text,
      model_id: modelId || "eleven_multilingual_v2",
      voice_settings: {
        stability: stability ?? 0.5,
        similarity_boost: similarityBoost ?? 0.75,
      },
    };
    
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }
    
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    const assetsDir = path.join(process.cwd(), "public", "assets", "audio", companyId);
    await fs.mkdir(assetsDir, { recursive: true });
    
    const fileName = `${assetId}.mp3`;
    const filePath = path.join(assetsDir, fileName);
    
    await fs.writeFile(filePath, audioBuffer);
    
    const url = `/assets/audio/${companyId}/${fileName}`;
    
    return { url, filePath };
  },
};

export default elevenLabsService;
