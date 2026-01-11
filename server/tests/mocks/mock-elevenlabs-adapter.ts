/**
 * Mock ElevenLabs Adapter for Testing
 * 
 * This adapter simulates ElevenLabs API responses for testing the asset factory
 * without making real API calls or requiring an API key.
 */

import * as fs from "fs";
import * as path from "path";

export interface MockVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

export interface MockSpeechParams {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

const MOCK_VOICES: MockVoice[] = [
  {
    voice_id: "mock-voice-1",
    name: "Rachel (Mock)",
    category: "premade",
    labels: { accent: "american", gender: "female", age: "young" }
  },
  {
    voice_id: "mock-voice-2", 
    name: "Drew (Mock)",
    category: "premade",
    labels: { accent: "american", gender: "male", age: "middle-aged" }
  },
  {
    voice_id: "mock-voice-3",
    name: "Sarah (Mock)",
    category: "premade",
    labels: { accent: "british", gender: "female", age: "young" }
  }
];

export const mockElevenLabsAdapter = {
  async getVoices(): Promise<MockVoice[]> {
    await simulateLatency(100);
    return MOCK_VOICES;
  },

  async generateSpeech(
    params: MockSpeechParams,
    companyId: string,
    assetId: string
  ): Promise<string> {
    await simulateLatency(500);
    
    const voice = MOCK_VOICES.find(v => v.voice_id === params.voiceId);
    if (!voice) {
      throw new Error(`Voice not found: ${params.voiceId}`);
    }
    
    const audioDir = path.join("server/public/assets/audio", companyId);
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const filePath = path.join(audioDir, `${assetId}.mp3`);
    const mockAudioContent = Buffer.from("MOCK_AUDIO_CONTENT_" + params.text.slice(0, 50));
    fs.writeFileSync(filePath, mockAudioContent);
    
    return `/assets/audio/${companyId}/${assetId}.mp3`;
  }
};

async function simulateLatency(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isMockMode(): boolean {
  return process.env.ASSET_FACTORY_MOCK_MODE === "true";
}
