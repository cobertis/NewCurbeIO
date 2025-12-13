import { db } from "../db";
import {
  pbxSettings,
  pbxIvrs,
  pbxMenuOptions,
  pbxQueues,
  pbxQueueMembers,
  pbxQueueAds,
  pbxQueueHoldMusic,
  pbxExtensions,
  pbxAgentStatus,
  pbxActiveCalls,
  pbxAudioFiles,
  users,
  telephonySettings,
  PbxSettings,
  PbxIvr,
  PbxMenuOption,
  PbxQueue,
  PbxQueueMember,
  PbxQueueAd,
  PbxExtension,
  PbxAgentStatus,
  PbxActiveCall,
  PbxAudioFile,
  PbxAgentStatusType,
} from "@shared/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { TelephonyProvisioningService } from "./telephony-provisioning-service";

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

    let result: PbxSettings;

    if (existing) {
      const [updated] = await db
        .update(pbxSettings)
        .set({ ...safeData, updatedAt: new Date() })
        .where(eq(pbxSettings.id, existing.id))
        .returning();
      result = updated;
    } else {
      const [created] = await db
        .insert(pbxSettings)
        .values({ ...safeData, companyId } as any)
        .returning();
      result = created;
    }

    // Auto-provision Call Control when IVR is enabled
    if (safeData.ivrEnabled === true) {
      await this.autoProvisionCallControl(companyId);
    }

    return result;
  }

  private async autoProvisionCallControl(companyId: string): Promise<void> {
    try {
      console.log(`[PBX] Auto-provisioning Call Control for company: ${companyId}`);
      
      // Get Telnyx settings for this company
      const [settings] = await db
        .select()
        .from(telephonySettings)
        .where(eq(telephonySettings.companyId, companyId));

      if (!settings?.managedAccountId) {
        console.log(`[PBX] No Telnyx managed account found for company: ${companyId}`);
        return;
      }

      // Check if already provisioned with Call Control App
      if (settings.callControlAppId) {
        console.log(`[PBX] Company already has Call Control App: ${settings.callControlAppId}, skipping provisioning`);
        return;
      }

      const provisioningService = new TelephonyProvisioningService();
      
      // Migrate all phone numbers to Call Control Application
      const result = await provisioningService.migrateToCallControl(companyId);
      
      if (result.success) {
        console.log(`[PBX] Call Control provisioning successful. App: ${result.callControlAppId}, Migrated: ${result.migratedCount} numbers`);
      } else {
        console.error(`[PBX] Call Control provisioning had errors:`, result.errors);
      }
    } catch (error) {
      console.error(`[PBX] Auto-provisioning error:`, error);
    }
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

  async syncQueueMembers(companyId: string, queueId: string, memberIds: string[]): Promise<void> {
    // Get existing members
    const existingMembers = await db
      .select({ userId: pbxQueueMembers.userId })
      .from(pbxQueueMembers)
      .where(and(eq(pbxQueueMembers.companyId, companyId), eq(pbxQueueMembers.queueId, queueId)));
    
    const existingUserIds = existingMembers.map(m => m.userId);
    
    // Find members to add and remove
    const toAdd = memberIds.filter(id => !existingUserIds.includes(id));
    const toRemove = existingUserIds.filter(id => !memberIds.includes(id));
    
    // Remove members no longer in the list
    if (toRemove.length > 0) {
      await db
        .delete(pbxQueueMembers)
        .where(
          and(
            eq(pbxQueueMembers.companyId, companyId),
            eq(pbxQueueMembers.queueId, queueId),
            inArray(pbxQueueMembers.userId, toRemove)
          )
        );
    }
    
    // Add new members
    for (let i = 0; i < toAdd.length; i++) {
      await this.addQueueMember(companyId, queueId, toAdd[i], i + 1);
    }
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

  async getExtensionByUserId(companyId: string, userId: string): Promise<any | null> {
    const [extension] = await db
      .select({
        id: pbxExtensions.id,
        companyId: pbxExtensions.companyId,
        userId: pbxExtensions.userId,
        extensionNumber: pbxExtensions.extension,
        displayName: pbxExtensions.displayName,
        ringTimeout: pbxExtensions.ringTimeout,
        isActive: pbxExtensions.isActive,
      })
      .from(pbxExtensions)
      .where(and(
        eq(pbxExtensions.companyId, companyId),
        eq(pbxExtensions.userId, userId),
        eq(pbxExtensions.isActive, true)
      ))
      .limit(1);
    return extension || null;
  }

  async getNextExtensionNumber(companyId: string): Promise<string> {
    const settings = await this.getPbxSettings(companyId);
    const ivrExtension = parseInt(settings?.ivrExtension || "100", 10);
    
    const existingExtensions = await db
      .select({ extension: pbxExtensions.extension })
      .from(pbxExtensions)
      .where(eq(pbxExtensions.companyId, companyId));
    
    const usedNumbers = new Set(
      existingExtensions.map(e => parseInt(e.extension, 10)).filter(n => !isNaN(n))
    );
    
    let nextExtension = ivrExtension + 1;
    while (usedNumbers.has(nextExtension)) {
      nextExtension++;
    }
    
    return nextExtension.toString();
  }

  async validateExtensionNumber(companyId: string, extensionNumber: string, excludeExtensionId?: string): Promise<{ valid: boolean; error?: string }> {
    const settings = await this.getPbxSettings(companyId);
    const ivrExtension = parseInt(settings?.ivrExtension || "100", 10);
    const extNum = parseInt(extensionNumber, 10);
    
    if (isNaN(extNum)) {
      return { valid: false, error: "Extension must be a number" };
    }
    
    if (extNum <= ivrExtension) {
      return { valid: false, error: `Extension must be greater than IVR extension (${ivrExtension})` };
    }
    
    const existingQuery = db
      .select({ id: pbxExtensions.id })
      .from(pbxExtensions)
      .where(
        and(
          eq(pbxExtensions.companyId, companyId),
          eq(pbxExtensions.extension, extensionNumber)
        )
      );
    
    const existing = await existingQuery;
    
    if (existing.length > 0 && (!excludeExtensionId || existing[0].id !== excludeExtensionId)) {
      return { valid: false, error: `Extension ${extensionNumber} is already in use` };
    }
    
    return { valid: true };
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

  async getActiveCall(callControlId: string): Promise<PbxActiveCall | null> {
    const [call] = await db
      .select()
      .from(pbxActiveCalls)
      .where(eq(pbxActiveCalls.callControlId, callControlId));
    return call || null;
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

  // =====================================================
  // IVR CRUD Operations - Multiple IVRs per company
  // =====================================================

  async getIvrs(companyId: string): Promise<PbxIvr[]> {
    return db
      .select()
      .from(pbxIvrs)
      .where(eq(pbxIvrs.companyId, companyId))
      .orderBy(asc(pbxIvrs.name));
  }

  async getIvr(companyId: string, ivrId: string): Promise<PbxIvr | null> {
    const [ivr] = await db
      .select()
      .from(pbxIvrs)
      .where(and(eq(pbxIvrs.companyId, companyId), eq(pbxIvrs.id, ivrId)));
    return ivr || null;
  }

  async getIvrByExtension(companyId: string, extension: string): Promise<PbxIvr | null> {
    const [ivr] = await db
      .select()
      .from(pbxIvrs)
      .where(and(eq(pbxIvrs.companyId, companyId), eq(pbxIvrs.extension, extension)));
    return ivr || null;
  }

  async getDefaultIvr(companyId: string): Promise<PbxIvr | null> {
    const [ivr] = await db
      .select()
      .from(pbxIvrs)
      .where(and(eq(pbxIvrs.companyId, companyId), eq(pbxIvrs.isDefault, true)));
    return ivr || null;
  }

  async createIvr(companyId: string, data: Record<string, any>): Promise<PbxIvr> {
    const { companyId: _, id: __, ...safeData } = data;
    
    // Auto-extract media_name from Telnyx Media Storage URLs
    if (safeData.greetingAudioUrl && safeData.greetingAudioUrl.includes('api.telnyx.com/v2/media/')) {
      const match = safeData.greetingAudioUrl.match(/api\.telnyx\.com\/v2\/media\/([^/]+)/);
      if (match && match[1]) {
        safeData.greetingMediaName = match[1];
        console.log(`[PBX] Extracted greetingMediaName from URL: ${safeData.greetingMediaName}`);
      }
    }
    
    // If this is the first IVR or marked as default, ensure only one default
    if (safeData.isDefault) {
      await db
        .update(pbxIvrs)
        .set({ isDefault: false })
        .where(eq(pbxIvrs.companyId, companyId));
    }
    
    const [ivr] = await db
      .insert(pbxIvrs)
      .values({ ...safeData, companyId } as any)
      .returning();
    
    // If this is the first IVR, make it default
    const count = await db.select().from(pbxIvrs).where(eq(pbxIvrs.companyId, companyId));
    if (count.length === 1) {
      await db.update(pbxIvrs).set({ isDefault: true }).where(eq(pbxIvrs.id, ivr.id));
      ivr.isDefault = true;
    }
    
    return ivr;
  }

  async updateIvr(companyId: string, ivrId: string, data: Record<string, any>): Promise<PbxIvr | null> {
    const { companyId: _, id: __, ...safeData } = data;
    
    // Auto-extract media_name from Telnyx Media Storage URLs
    if (safeData.greetingAudioUrl && safeData.greetingAudioUrl.includes('api.telnyx.com/v2/media/')) {
      const match = safeData.greetingAudioUrl.match(/api\.telnyx\.com\/v2\/media\/([^/]+)/);
      if (match && match[1]) {
        safeData.greetingMediaName = match[1];
        console.log(`[PBX] Extracted greetingMediaName from URL: ${safeData.greetingMediaName}`);
      }
    }
    
    // If setting as default, clear other defaults first
    if (safeData.isDefault) {
      await db
        .update(pbxIvrs)
        .set({ isDefault: false })
        .where(eq(pbxIvrs.companyId, companyId));
    }
    
    const [ivr] = await db
      .update(pbxIvrs)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(eq(pbxIvrs.companyId, companyId), eq(pbxIvrs.id, ivrId)))
      .returning();
    return ivr || null;
  }

  async deleteIvr(companyId: string, ivrId: string): Promise<boolean> {
    // Check if this IVR has menu options - we need to delete them first
    await db
      .delete(pbxMenuOptions)
      .where(and(eq(pbxMenuOptions.companyId, companyId), eq(pbxMenuOptions.ivrId, ivrId)));
    
    await db
      .delete(pbxIvrs)
      .where(and(eq(pbxIvrs.companyId, companyId), eq(pbxIvrs.id, ivrId)));
    return true;
  }

  // Get menu options for a specific IVR
  async getIvrMenuOptions(companyId: string, ivrId: string): Promise<PbxMenuOption[]> {
    return db
      .select()
      .from(pbxMenuOptions)
      .where(and(eq(pbxMenuOptions.companyId, companyId), eq(pbxMenuOptions.ivrId, ivrId)))
      .orderBy(asc(pbxMenuOptions.displayOrder));
  }

  // Create menu option for specific IVR
  async createIvrMenuOption(companyId: string, ivrId: string, data: Record<string, any>): Promise<PbxMenuOption> {
    const { companyId: _, ivrId: __, id: ___, ...safeData } = data;
    const [option] = await db
      .insert(pbxMenuOptions)
      .values({ ...safeData, companyId, ivrId } as any)
      .returning();
    return option;
  }

  // Update menu option
  async updateIvrMenuOption(companyId: string, optionId: string, data: Record<string, any>): Promise<PbxMenuOption | null> {
    const { companyId: _, id: __, ...safeData } = data;
    const [option] = await db
      .update(pbxMenuOptions)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(eq(pbxMenuOptions.companyId, companyId), eq(pbxMenuOptions.id, optionId)))
      .returning();
    return option || null;
  }

  // Delete menu option
  async deleteIvrMenuOption(companyId: string, optionId: string): Promise<boolean> {
    await db
      .delete(pbxMenuOptions)
      .where(and(eq(pbxMenuOptions.companyId, companyId), eq(pbxMenuOptions.id, optionId)));
    return true;
  }

  // Get next available IVR extension for a company
  async getNextIvrExtension(companyId: string): Promise<string> {
    const ivrs = await db
      .select({ extension: pbxIvrs.extension })
      .from(pbxIvrs)
      .where(eq(pbxIvrs.companyId, companyId));
    
    const usedExtensions = new Set(ivrs.map(i => parseInt(i.extension, 10)).filter(n => !isNaN(n)));
    
    // Start from 1000 for IVR extensions
    let nextExt = 1000;
    while (usedExtensions.has(nextExt)) {
      nextExt++;
    }
    return nextExt.toString();
  }

  // =====================================================
  // Queue Ads CRUD Operations
  // =====================================================

  async getQueueAds(companyId: string, queueId: string): Promise<any[]> {
    const ads = await db
      .select({
        id: pbxQueueAds.id,
        companyId: pbxQueueAds.companyId,
        queueId: pbxQueueAds.queueId,
        audioFileId: pbxQueueAds.audioFileId,
        displayOrder: pbxQueueAds.displayOrder,
        isActive: pbxQueueAds.isActive,
        createdAt: pbxQueueAds.createdAt,
        audioFile: {
          id: pbxAudioFiles.id,
          name: pbxAudioFiles.name,
          fileUrl: pbxAudioFiles.fileUrl,
          duration: pbxAudioFiles.duration,
          telnyxMediaId: pbxAudioFiles.telnyxMediaId,
        },
      })
      .from(pbxQueueAds)
      .innerJoin(pbxAudioFiles, eq(pbxQueueAds.audioFileId, pbxAudioFiles.id))
      .where(and(eq(pbxQueueAds.companyId, companyId), eq(pbxQueueAds.queueId, queueId)))
      .orderBy(asc(pbxQueueAds.displayOrder));
    return ads;
  }

  async getActiveQueueAds(companyId: string, queueId: string): Promise<any[]> {
    const ads = await db
      .select({
        id: pbxQueueAds.id,
        audioFileId: pbxQueueAds.audioFileId,
        displayOrder: pbxQueueAds.displayOrder,
        audioFile: {
          id: pbxAudioFiles.id,
          name: pbxAudioFiles.name,
          fileUrl: pbxAudioFiles.fileUrl,
          telnyxMediaId: pbxAudioFiles.telnyxMediaId,
        },
      })
      .from(pbxQueueAds)
      .innerJoin(pbxAudioFiles, eq(pbxQueueAds.audioFileId, pbxAudioFiles.id))
      .where(
        and(
          eq(pbxQueueAds.companyId, companyId),
          eq(pbxQueueAds.queueId, queueId),
          eq(pbxQueueAds.isActive, true)
        )
      )
      .orderBy(asc(pbxQueueAds.displayOrder));
    return ads;
  }

  async addQueueAd(
    companyId: string,
    queueId: string,
    audioFileId: string,
    displayOrder: number = 0
  ): Promise<PbxQueueAd> {
    const [ad] = await db
      .insert(pbxQueueAds)
      .values({ companyId, queueId, audioFileId, displayOrder } as any)
      .returning();
    return ad;
  }

  async updateQueueAd(
    companyId: string,
    adId: string,
    data: { displayOrder?: number; isActive?: boolean }
  ): Promise<PbxQueueAd | null> {
    const [updated] = await db
      .update(pbxQueueAds)
      .set(data)
      .where(and(eq(pbxQueueAds.companyId, companyId), eq(pbxQueueAds.id, adId)))
      .returning();
    return updated || null;
  }

  async removeQueueAd(companyId: string, adId: string): Promise<boolean> {
    await db
      .delete(pbxQueueAds)
      .where(and(eq(pbxQueueAds.companyId, companyId), eq(pbxQueueAds.id, adId)));
    return true;
  }

  // Queue Hold Music Methods
  async getQueueHoldMusic(companyId: string, queueId: string): Promise<any[]> {
    const holdMusic = await db
      .select({
        id: pbxQueueHoldMusic.id,
        companyId: pbxQueueHoldMusic.companyId,
        queueId: pbxQueueHoldMusic.queueId,
        audioFileId: pbxQueueHoldMusic.audioFileId,
        displayOrder: pbxQueueHoldMusic.displayOrder,
        isActive: pbxQueueHoldMusic.isActive,
        createdAt: pbxQueueHoldMusic.createdAt,
        audioFile: {
          id: pbxAudioFiles.id,
          name: pbxAudioFiles.name,
          fileUrl: pbxAudioFiles.fileUrl,
          duration: pbxAudioFiles.duration,
          telnyxMediaId: pbxAudioFiles.telnyxMediaId,
        },
      })
      .from(pbxQueueHoldMusic)
      .innerJoin(pbxAudioFiles, eq(pbxQueueHoldMusic.audioFileId, pbxAudioFiles.id))
      .where(and(eq(pbxQueueHoldMusic.companyId, companyId), eq(pbxQueueHoldMusic.queueId, queueId)))
      .orderBy(asc(pbxQueueHoldMusic.displayOrder));
    return holdMusic;
  }

  async addQueueHoldMusic(
    companyId: string,
    queueId: string,
    audioFileId: string,
    displayOrder: number = 0
  ): Promise<any> {
    const [holdMusic] = await db
      .insert(pbxQueueHoldMusic)
      .values({ companyId, queueId, audioFileId, displayOrder } as any)
      .returning();
    return holdMusic;
  }

  async updateQueueHoldMusic(
    companyId: string,
    holdMusicId: string,
    data: { displayOrder?: number; isActive?: boolean }
  ): Promise<any | null> {
    const [updated] = await db
      .update(pbxQueueHoldMusic)
      .set(data)
      .where(and(eq(pbxQueueHoldMusic.companyId, companyId), eq(pbxQueueHoldMusic.id, holdMusicId)))
      .returning();
    return updated || null;
  }

  async removeQueueHoldMusic(companyId: string, holdMusicId: string): Promise<boolean> {
    await db
      .delete(pbxQueueHoldMusic)
      .where(and(eq(pbxQueueHoldMusic.companyId, companyId), eq(pbxQueueHoldMusic.id, holdMusicId)));
    return true;
  }

  async syncQueueHoldMusic(companyId: string, queueId: string, audioFileIds: string[]): Promise<void> {
    // Delete all existing hold music for the queue
    await db
      .delete(pbxQueueHoldMusic)
      .where(and(eq(pbxQueueHoldMusic.companyId, companyId), eq(pbxQueueHoldMusic.queueId, queueId)));
    
    // Insert new hold music entries with display order
    if (audioFileIds.length > 0) {
      const values = audioFileIds.map((audioFileId, index) => ({
        companyId,
        queueId,
        audioFileId,
        displayOrder: index,
      }));
      await db.insert(pbxQueueHoldMusic).values(values as any);
    }
  }
}

export const pbxService = new PbxService();
