import { db } from "../db";
import {
  pbxSettings,
  pbxMenuOptions,
  pbxQueues,
  pbxQueueMembers,
  pbxExtensions,
  pbxAgentStatus,
  pbxActiveCalls,
  pbxAudioFiles,
  users,
  PbxSettings,
  PbxMenuOption,
  PbxQueue,
  PbxQueueMember,
  PbxExtension,
  PbxAgentStatus,
  PbxActiveCall,
  PbxAudioFile,
  PbxAgentStatusType,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

export class PbxService {
  async getPbxSettings(companyId: string): Promise<PbxSettings | null> {
    const [settings] = await db
      .select()
      .from(pbxSettings)
      .where(eq(pbxSettings.companyId, companyId));
    return settings || null;
  }

  async createOrUpdatePbxSettings(
    companyId: string,
    data: Record<string, any>
  ): Promise<PbxSettings> {
    const { companyId: _, id: __, ...safeData } = data;
    const existing = await this.getPbxSettings(companyId);

    if (existing) {
      const [updated] = await db
        .update(pbxSettings)
        .set({ ...safeData, updatedAt: new Date() })
        .where(eq(pbxSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(pbxSettings)
      .values({ ...safeData, companyId } as any)
      .returning();
    return created;
  }

  async getQueues(companyId: string): Promise<PbxQueue[]> {
    return db
      .select()
      .from(pbxQueues)
      .where(eq(pbxQueues.companyId, companyId))
      .orderBy(asc(pbxQueues.name));
  }

  async getQueue(companyId: string, queueId: string): Promise<PbxQueue | null> {
    const [queue] = await db
      .select()
      .from(pbxQueues)
      .where(and(eq(pbxQueues.companyId, companyId), eq(pbxQueues.id, queueId)));
    return queue || null;
  }

  async createQueue(companyId: string, data: Record<string, any>): Promise<PbxQueue> {
    const { companyId: _, id: __, ...safeData } = data;
    const [queue] = await db
      .insert(pbxQueues)
      .values({ ...safeData, companyId } as any)
      .returning();
    return queue;
  }

  async updateQueue(
    companyId: string,
    queueId: string,
    data: Record<string, any>
  ): Promise<PbxQueue | null> {
    const { companyId: _, id: __, ...safeData } = data;
    const [updated] = await db
      .update(pbxQueues)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(eq(pbxQueues.companyId, companyId), eq(pbxQueues.id, queueId)))
      .returning();
    return updated || null;
  }

  async deleteQueue(companyId: string, queueId: string): Promise<boolean> {
    await db
      .delete(pbxQueues)
      .where(and(eq(pbxQueues.companyId, companyId), eq(pbxQueues.id, queueId)));
    return true;
  }

  async getQueueMembers(companyId: string, queueId: string): Promise<any[]> {
    const members = await db
      .select({
        id: pbxQueueMembers.id,
        companyId: pbxQueueMembers.companyId,
        queueId: pbxQueueMembers.queueId,
        userId: pbxQueueMembers.userId,
        priority: pbxQueueMembers.priority,
        isActive: pbxQueueMembers.isActive,
        createdAt: pbxQueueMembers.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(pbxQueueMembers)
      .innerJoin(users, eq(pbxQueueMembers.userId, users.id))
      .where(and(eq(pbxQueueMembers.companyId, companyId), eq(pbxQueueMembers.queueId, queueId)))
      .orderBy(asc(pbxQueueMembers.priority));
    return members;
  }

  async addQueueMember(
    companyId: string,
    queueId: string,
    userId: string,
    priority: number = 1
  ): Promise<PbxQueueMember> {
    const [member] = await db
      .insert(pbxQueueMembers)
      .values({ companyId, queueId, userId, priority } as any)
      .onConflictDoUpdate({
        target: [pbxQueueMembers.queueId, pbxQueueMembers.userId],
        set: { priority, isActive: true },
      })
      .returning();
    return member;
  }

  async removeQueueMember(companyId: string, queueId: string, userId: string): Promise<boolean> {
    await db
      .delete(pbxQueueMembers)
      .where(
        and(
          eq(pbxQueueMembers.companyId, companyId),
          eq(pbxQueueMembers.queueId, queueId),
          eq(pbxQueueMembers.userId, userId)
        )
      );
    return true;
  }

  async getExtensions(companyId: string): Promise<any[]> {
    const extensions = await db
      .select({
        id: pbxExtensions.id,
        companyId: pbxExtensions.companyId,
        userId: pbxExtensions.userId,
        extension: pbxExtensions.extension,
        displayName: pbxExtensions.displayName,
        ringTimeout: pbxExtensions.ringTimeout,
        voicemailEnabled: pbxExtensions.voicemailEnabled,
        voicemailGreetingUrl: pbxExtensions.voicemailGreetingUrl,
        voicemailEmail: pbxExtensions.voicemailEmail,
        forwardOnBusy: pbxExtensions.forwardOnBusy,
        forwardOnNoAnswer: pbxExtensions.forwardOnNoAnswer,
        forwardNumber: pbxExtensions.forwardNumber,
        dndEnabled: pbxExtensions.dndEnabled,
        isActive: pbxExtensions.isActive,
        createdAt: pbxExtensions.createdAt,
        updatedAt: pbxExtensions.updatedAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(pbxExtensions)
      .innerJoin(users, eq(pbxExtensions.userId, users.id))
      .where(eq(pbxExtensions.companyId, companyId))
      .orderBy(asc(pbxExtensions.extension));
    return extensions;
  }

  async createExtension(companyId: string, data: Record<string, any>): Promise<PbxExtension> {
    const { companyId: _, id: __, ...safeData } = data;
    const [extension] = await db
      .insert(pbxExtensions)
      .values({ ...safeData, companyId } as any)
      .returning();
    return extension;
  }

  async updateExtension(
    companyId: string,
    extensionId: string,
    data: Record<string, any>
  ): Promise<PbxExtension | null> {
    const { companyId: _, id: __, ...safeData } = data;
    const [updated] = await db
      .update(pbxExtensions)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(eq(pbxExtensions.companyId, companyId), eq(pbxExtensions.id, extensionId)))
      .returning();
    return updated || null;
  }

  async deleteExtension(companyId: string, extensionId: string): Promise<boolean> {
    await db
      .delete(pbxExtensions)
      .where(and(eq(pbxExtensions.companyId, companyId), eq(pbxExtensions.id, extensionId)));
    return true;
  }

  async getMenuOptions(companyId: string, pbxSettingsId: string): Promise<PbxMenuOption[]> {
    return db
      .select()
      .from(pbxMenuOptions)
      .where(
        and(eq(pbxMenuOptions.companyId, companyId), eq(pbxMenuOptions.pbxSettingsId, pbxSettingsId))
      )
      .orderBy(asc(pbxMenuOptions.displayOrder));
  }

  async createMenuOption(companyId: string, data: Record<string, any>): Promise<PbxMenuOption> {
    const { companyId: _, id: __, ...safeData } = data;
    const [option] = await db
      .insert(pbxMenuOptions)
      .values({ ...safeData, companyId } as any)
      .returning();
    return option;
  }

  async updateMenuOption(
    companyId: string,
    optionId: string,
    data: Record<string, any>
  ): Promise<PbxMenuOption | null> {
    const { companyId: _, id: __, ...safeData } = data;
    const [updated] = await db
      .update(pbxMenuOptions)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(eq(pbxMenuOptions.companyId, companyId), eq(pbxMenuOptions.id, optionId)))
      .returning();
    return updated || null;
  }

  async deleteMenuOption(companyId: string, optionId: string): Promise<boolean> {
    await db
      .delete(pbxMenuOptions)
      .where(and(eq(pbxMenuOptions.companyId, companyId), eq(pbxMenuOptions.id, optionId)));
    return true;
  }

  async getAgentStatus(companyId: string, userId: string): Promise<PbxAgentStatus | null> {
    const [status] = await db
      .select()
      .from(pbxAgentStatus)
      .where(and(eq(pbxAgentStatus.companyId, companyId), eq(pbxAgentStatus.userId, userId)));
    return status || null;
  }

  async updateAgentStatus(
    companyId: string,
    userId: string,
    status: PbxAgentStatusType,
    callId?: string
  ): Promise<PbxAgentStatus> {
    const existing = await this.getAgentStatus(companyId, userId);

    const data: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "busy" && callId) {
      data.currentCallId = callId;
      data.inCallSince = new Date();
    } else if (status === "available") {
      data.currentCallId = null;
      data.inCallSince = null;
      if (existing?.currentCallId) {
        data.lastCallEndedAt = new Date();
        data.callsHandledToday = (existing.callsHandledToday || 0) + 1;
      }
    }

    if (existing) {
      const [updated] = await db
        .update(pbxAgentStatus)
        .set(data)
        .where(eq(pbxAgentStatus.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(pbxAgentStatus)
      .values({ companyId, userId, ...data } as any)
      .returning();
    return created;
  }

  async getAvailableAgentsForQueue(companyId: string, queueId: string): Promise<string[]> {
    const members = await db
      .select({
        userId: pbxQueueMembers.userId,
        priority: pbxQueueMembers.priority,
        agentStatus: pbxAgentStatus.status,
        sipRegistered: pbxAgentStatus.sipRegistered,
      })
      .from(pbxQueueMembers)
      .leftJoin(
        pbxAgentStatus,
        and(
          eq(pbxQueueMembers.userId, pbxAgentStatus.userId),
          eq(pbxQueueMembers.companyId, pbxAgentStatus.companyId)
        )
      )
      .where(
        and(
          eq(pbxQueueMembers.companyId, companyId),
          eq(pbxQueueMembers.queueId, queueId),
          eq(pbxQueueMembers.isActive, true)
        )
      )
      .orderBy(asc(pbxQueueMembers.priority));

    return members
      .filter((m) => m.agentStatus === "available" && m.sipRegistered)
      .map((m) => m.userId);
  }

  async trackActiveCall(
    companyId: string,
    callControlId: string,
    fromNumber: string,
    toNumber: string,
    state: "ivr" | "queue" | "ringing" | "connected" | "hold" | "transferring",
    metadata?: Record<string, any>
  ): Promise<PbxActiveCall> {
    const existing = await db
      .select()
      .from(pbxActiveCalls)
      .where(eq(pbxActiveCalls.callControlId, callControlId));

    if (existing.length > 0) {
      const [updated] = await db
        .update(pbxActiveCalls)
        .set({ state, metadata: metadata || existing[0].metadata })
        .where(eq(pbxActiveCalls.callControlId, callControlId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(pbxActiveCalls)
      .values({
        companyId,
        callControlId,
        fromNumber,
        toNumber,
        state,
        metadata,
      } as any)
      .returning();
    return created;
  }

  async removeActiveCall(callControlId: string): Promise<void> {
    await db.delete(pbxActiveCalls).where(eq(pbxActiveCalls.callControlId, callControlId));
  }

  async getAudioFiles(companyId: string, audioType?: string): Promise<PbxAudioFile[]> {
    if (audioType) {
      return db
        .select()
        .from(pbxAudioFiles)
        .where(and(eq(pbxAudioFiles.companyId, companyId), eq(pbxAudioFiles.audioType, audioType as any)));
    }
    return db.select().from(pbxAudioFiles).where(eq(pbxAudioFiles.companyId, companyId));
  }

  async createAudioFile(
    companyId: string,
    data: {
      name: string;
      description?: string;
      fileUrl: string;
      fileName: string;
      fileSize?: number;
      duration?: number;
      mimeType?: string;
      audioType: "greeting" | "hold_music" | "announcement" | "voicemail_greeting";
      ttsGenerated?: boolean;
      ttsText?: string;
    }
  ): Promise<PbxAudioFile> {
    const [file] = await db
      .insert(pbxAudioFiles)
      .values({ companyId, ...data } as any)
      .returning();
    return file;
  }

  async deleteAudioFile(companyId: string, fileId: string): Promise<boolean> {
    await db
      .delete(pbxAudioFiles)
      .where(and(eq(pbxAudioFiles.companyId, companyId), eq(pbxAudioFiles.id, fileId)));
    return true;
  }
}

export const pbxService = new PbxService();
