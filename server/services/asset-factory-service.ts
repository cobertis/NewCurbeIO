import { db } from "../db";
import { orchestratorAssets } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export type AssetType = "audio" | "video";
export type AssetProvider = "elevenlabs" | "heygen" | "manual";
export type AssetStatus = "draft" | "generating" | "ready" | "failed";

export interface AssetInput {
  text?: string;
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  script?: string;
  avatarId?: string;
  templateId?: string;
  providerJobId?: string;
}

export interface AssetOutput {
  assetUrl?: string;
  duration?: number;
  fileSize?: number;
  videoUrl?: string;
}

export const assetFactoryService = {
  async listAssets(
    companyId: string,
    campaignId?: string,
    type?: AssetType
  ) {
    const conditions = [eq(orchestratorAssets.companyId, companyId)];
    
    if (campaignId) {
      conditions.push(eq(orchestratorAssets.campaignId, campaignId));
    }
    
    if (type) {
      conditions.push(eq(orchestratorAssets.type, type));
    }
    
    return await db
      .select()
      .from(orchestratorAssets)
      .where(and(...conditions))
      .orderBy(desc(orchestratorAssets.createdAt));
  },

  async getAsset(assetId: string, companyId: string) {
    const [asset] = await db
      .select()
      .from(orchestratorAssets)
      .where(
        and(
          eq(orchestratorAssets.id, assetId),
          eq(orchestratorAssets.companyId, companyId)
        )
      )
      .limit(1);
    
    return asset || null;
  },

  async createAudioAsset(
    companyId: string,
    campaignId: string | null,
    name: string,
    input: AssetInput,
    provider: AssetProvider,
    createdBy?: string
  ) {
    const [asset] = await db
      .insert(orchestratorAssets)
      .values({
        companyId,
        campaignId,
        type: "audio",
        provider,
        status: "draft",
        name,
        inputJson: input,
        createdBy,
      })
      .returning();
    
    return asset;
  },

  async createVideoAsset(
    companyId: string,
    campaignId: string | null,
    name: string,
    input: AssetInput,
    provider: AssetProvider,
    createdBy?: string
  ) {
    const [asset] = await db
      .insert(orchestratorAssets)
      .values({
        companyId,
        campaignId,
        type: "video",
        provider,
        status: "draft",
        name,
        inputJson: input,
        createdBy,
      })
      .returning();
    
    return asset;
  },

  async updateAssetStatus(
    assetId: string,
    status: AssetStatus,
    output?: AssetOutput,
    error?: string
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (output) {
      updateData.outputJson = output;
    }
    
    if (error) {
      updateData.error = error;
    }
    
    const [asset] = await db
      .update(orchestratorAssets)
      .set(updateData)
      .where(eq(orchestratorAssets.id, assetId))
      .returning();
    
    return asset;
  },

  async updateAssetInput(assetId: string, input: AssetInput) {
    const [asset] = await db
      .update(orchestratorAssets)
      .set({
        inputJson: input,
        updatedAt: new Date(),
      })
      .where(eq(orchestratorAssets.id, assetId))
      .returning();
    
    return asset;
  },

  async deleteAsset(assetId: string, companyId: string) {
    const result = await db
      .delete(orchestratorAssets)
      .where(
        and(
          eq(orchestratorAssets.id, assetId),
          eq(orchestratorAssets.companyId, companyId)
        )
      )
      .returning();
    
    return result.length > 0;
  },
};

export default assetFactoryService;
