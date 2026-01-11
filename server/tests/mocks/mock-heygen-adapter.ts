/**
 * Mock Heygen Adapter for Testing
 * 
 * This adapter simulates Heygen API responses for testing the asset factory
 * without making real API calls or requiring an API key.
 */

export interface MockAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url: string;
}

export interface MockVideoParams {
  script: string;
  avatarId: string;
  templateId?: string;
}

export interface MockVideoStatus {
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  error?: string;
}

const MOCK_AVATARS: MockAvatar[] = [
  {
    avatar_id: "mock-avatar-1",
    avatar_name: "Josh (Mock)",
    gender: "male",
    preview_image_url: "https://example.com/mock-josh.jpg",
    preview_video_url: "https://example.com/mock-josh.mp4"
  },
  {
    avatar_id: "mock-avatar-2",
    avatar_name: "Emma (Mock)",
    gender: "female",
    preview_image_url: "https://example.com/mock-emma.jpg",
    preview_video_url: "https://example.com/mock-emma.mp4"
  },
  {
    avatar_id: "mock-avatar-3",
    avatar_name: "Alex (Mock)",
    gender: "neutral",
    preview_image_url: "https://example.com/mock-alex.jpg",
    preview_video_url: "https://example.com/mock-alex.mp4"
  }
];

const mockVideoJobs: Map<string, { status: MockVideoStatus; createdAt: Date }> = new Map();

export const mockHeygenAdapter = {
  async getAvatars(): Promise<MockAvatar[]> {
    await simulateLatency(100);
    return MOCK_AVATARS;
  },

  async createVideo(params: MockVideoParams): Promise<string> {
    await simulateLatency(200);
    
    const avatar = MOCK_AVATARS.find(a => a.avatar_id === params.avatarId);
    if (!avatar) {
      throw new Error(`Avatar not found: ${params.avatarId}`);
    }
    
    const videoId = `mock-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    mockVideoJobs.set(videoId, {
      status: { status: "processing" },
      createdAt: new Date()
    });
    
    setTimeout(() => {
      const job = mockVideoJobs.get(videoId);
      if (job) {
        job.status = {
          status: "completed",
          video_url: `https://mock-heygen.com/videos/${videoId}.mp4`
        };
      }
    }, 3000);
    
    return videoId;
  },

  async getVideoStatus(videoId: string): Promise<MockVideoStatus> {
    await simulateLatency(100);
    
    const job = mockVideoJobs.get(videoId);
    if (!job) {
      return { status: "failed", error: "Video not found" };
    }
    
    return job.status;
  }
};

async function simulateLatency(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isMockMode(): boolean {
  return process.env.ASSET_FACTORY_MOCK_MODE === "true";
}
