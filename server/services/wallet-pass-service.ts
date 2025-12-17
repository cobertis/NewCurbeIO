import { db } from "../db";
import { 
  walletMembers, walletPasses, walletLinks, walletEvents, walletDevices, walletSettings,
  InsertWalletMember, InsertWalletPass, InsertWalletLink, InsertWalletEvent, InsertWalletDevice, InsertWalletSettings,
  WalletMember, WalletPass, WalletLink, WalletEvent, WalletDevice, WalletSettings
} from "@shared/schema";
import { eq, and, or, desc, gte, lte, sql, count } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
import * as UAParser from "ua-parser-js";

// Encryption key is stored per-tenant in walletSettings table
// These functions require a 32-character key from the database

function encrypt(text: string, encryptionKey: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error("Encryption key must be at least 32 characters. Configure it in Wallet Settings.");
  }
  const key = encryptionKey.slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "utf8"), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string, encryptionKey: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error("Encryption key must be at least 32 characters. Configure it in Wallet Settings.");
  }
  const key = encryptionKey.slice(0, 32);
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "utf8"), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function generateAuthToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateSerialNumber(): string {
  return nanoid(16).toUpperCase();
}

function generateSlug(): string {
  return nanoid(10);
}

export interface DeviceInfo {
  userAgent?: string;
  os?: string;
  deviceType?: string;
  browser?: string;
  ip?: string;
  country?: string;
  region?: string;
  referrer?: string;
}

function parseUserAgent(userAgent?: string): Partial<DeviceInfo> {
  if (!userAgent) return {};
  const parser = new UAParser.UAParser(userAgent);
  const result = parser.getResult();
  return {
    userAgent,
    os: result.os.name ? `${result.os.name} ${result.os.version || ""}`.trim() : undefined,
    deviceType: result.device.type || "desktop",
    browser: result.browser.name ? `${result.browser.name} ${result.browser.version || ""}`.trim() : undefined,
  };
}

function detectOS(userAgent?: string): "ios" | "android" | "desktop" {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  if (ua.includes("android")) return "android";
  return "desktop";
}

export const walletPassService = {
  async createMember(data: InsertWalletMember): Promise<WalletMember> {
    const [member] = await db.insert(walletMembers).values({
      ...data,
      memberId: data.memberId || generateSlug(),
    }).returning();
    return member;
  },

  async getMember(id: string): Promise<WalletMember | undefined> {
    const [member] = await db.select().from(walletMembers).where(eq(walletMembers.id, id));
    return member;
  },

  async getMemberByMemberId(companyId: string, memberId: string): Promise<WalletMember | undefined> {
    const [member] = await db.select().from(walletMembers)
      .where(and(eq(walletMembers.companyId, companyId), eq(walletMembers.memberId, memberId)));
    return member;
  },

  async listMembers(companyId: string): Promise<WalletMember[]> {
    return db.select().from(walletMembers)
      .where(eq(walletMembers.companyId, companyId))
      .orderBy(desc(walletMembers.createdAt));
  },

  async updateMember(id: string, data: Partial<InsertWalletMember>): Promise<WalletMember | undefined> {
    const [member] = await db.update(walletMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(walletMembers.id, id))
      .returning();
    return member;
  },

  async deleteMember(id: string): Promise<boolean> {
    await db.delete(walletMembers).where(eq(walletMembers.id, id));
    return true;
  },

  async createPass(data: Omit<InsertWalletPass, "serialNumber" | "authToken">, encryptionKey: string): Promise<WalletPass> {
    const serialNumber = generateSerialNumber();
    const authToken = encrypt(generateAuthToken(), encryptionKey);
    
    const [pass] = await db.insert(walletPasses).values({
      ...data,
      serialNumber,
      authToken,
    }).returning();
    return pass;
  },

  async getPass(id: string): Promise<WalletPass | undefined> {
    const [pass] = await db.select().from(walletPasses).where(eq(walletPasses.id, id));
    return pass;
  },

  async getPassBySerial(serialNumber: string): Promise<WalletPass | undefined> {
    const [pass] = await db.select().from(walletPasses).where(eq(walletPasses.serialNumber, serialNumber));
    return pass;
  },

  async getPassByMember(memberId: string): Promise<WalletPass | undefined> {
    const [pass] = await db.select().from(walletPasses)
      .where(eq(walletPasses.memberId, memberId))
      .orderBy(desc(walletPasses.createdAt))
      .limit(1);
    return pass;
  },

  async listPasses(companyId: string): Promise<WalletPass[]> {
    return db.select().from(walletPasses)
      .where(eq(walletPasses.companyId, companyId))
      .orderBy(desc(walletPasses.createdAt));
  },

  async updatePass(id: string, data: Partial<WalletPass>): Promise<WalletPass | undefined> {
    const [pass] = await db.update(walletPasses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(walletPasses.id, id))
      .returning();
    return pass;
  },

  async updatePassStatus(id: string, appleStatus?: "created" | "installed" | "revoked", googleStatus?: "created" | "saved" | "revoked" | "unknown"): Promise<void> {
    const updates: Partial<WalletPass> = { updatedAt: new Date() };
    if (appleStatus) updates.appleStatus = appleStatus;
    if (googleStatus) updates.googleStatus = googleStatus;
    await db.update(walletPasses).set(updates).where(eq(walletPasses.id, id));
  },

  async revokePass(id: string): Promise<void> {
    await db.update(walletPasses).set({
      appleStatus: "revoked",
      googleStatus: "revoked",
      updatedAt: new Date(),
    }).where(eq(walletPasses.id, id));
  },

  async regeneratePass(id: string, encryptionKey: string): Promise<WalletPass | undefined> {
    const newSerialNumber = generateSerialNumber();
    const newAuthToken = encrypt(generateAuthToken(), encryptionKey);
    const [pass] = await db.update(walletPasses)
      .set({
        serialNumber: newSerialNumber,
        authToken: newAuthToken,
        appleStatus: "created",
        googleStatus: "created",
        updatedAt: new Date(),
      })
      .where(eq(walletPasses.id, id))
      .returning();
    
    if (pass) {
      await db.delete(walletDevices).where(eq(walletDevices.walletPassId, id));
    }
    return pass;
  },

  validateAuthToken(pass: WalletPass, token: string, encryptionKey: string): boolean {
    try {
      const decrypted = decrypt(pass.authToken, encryptionKey);
      return decrypted === token;
    } catch {
      return false;
    }
  },

  getDecryptedAuthToken(pass: WalletPass, encryptionKey: string): string {
    return decrypt(pass.authToken, encryptionKey);
  },

  async createLink(data: Omit<InsertWalletLink, "slug">): Promise<WalletLink> {
    const slug = generateSlug();
    const baseUrl = process.env.BASE_URL || (process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : "http://localhost:5000");
    
    const [link] = await db.insert(walletLinks).values({
      ...data,
      slug,
      url: `${baseUrl}/w/${slug}`,
    }).returning();
    return link;
  },

  async getLinkBySlug(slug: string): Promise<WalletLink | undefined> {
    const [link] = await db.select().from(walletLinks).where(eq(walletLinks.slug, slug));
    return link;
  },

  async getLinkByMember(memberId: string): Promise<WalletLink | undefined> {
    const [link] = await db.select().from(walletLinks)
      .where(eq(walletLinks.memberId, memberId))
      .orderBy(desc(walletLinks.createdAt))
      .limit(1);
    return link;
  },

  async logEvent(
    companyId: string,
    type: InsertWalletEvent["type"],
    deviceInfo: DeviceInfo,
    memberId?: string,
    walletPassId?: string,
    metadata?: Record<string, unknown>
  ): Promise<WalletEvent> {
    const parsed = parseUserAgent(deviceInfo.userAgent);
    const [event] = await db.insert(walletEvents).values({
      companyId,
      memberId,
      walletPassId,
      type,
      userAgent: deviceInfo.userAgent,
      os: parsed.os || deviceInfo.os,
      deviceType: parsed.deviceType || deviceInfo.deviceType,
      browser: parsed.browser || deviceInfo.browser,
      ip: deviceInfo.ip,
      country: deviceInfo.country,
      region: deviceInfo.region,
      referrer: deviceInfo.referrer,
      metadata,
    }).returning();
    return event;
  },

  async registerDevice(walletPassId: string, deviceLibraryIdentifier: string, pushToken?: string, deviceInfo?: Record<string, unknown>, encryptionKey?: string): Promise<WalletDevice> {
    const existing = await db.select().from(walletDevices)
      .where(and(
        eq(walletDevices.walletPassId, walletPassId),
        eq(walletDevices.deviceLibraryIdentifier, deviceLibraryIdentifier)
      ));

    if (existing.length > 0) {
      const [device] = await db.update(walletDevices)
        .set({ 
          pushToken: pushToken && encryptionKey ? encrypt(pushToken, encryptionKey) : existing[0].pushToken,
          deviceInfo,
          lastSeenAt: new Date() 
        })
        .where(eq(walletDevices.id, existing[0].id))
        .returning();
      return device;
    }

    const [device] = await db.insert(walletDevices).values({
      walletPassId,
      deviceLibraryIdentifier,
      pushToken: pushToken && encryptionKey ? encrypt(pushToken, encryptionKey) : null,
      deviceInfo,
    }).returning();
    return device;
  },

  async unregisterDevice(walletPassId: string, deviceLibraryIdentifier: string): Promise<boolean> {
    await db.delete(walletDevices)
      .where(and(
        eq(walletDevices.walletPassId, walletPassId),
        eq(walletDevices.deviceLibraryIdentifier, deviceLibraryIdentifier)
      ));
    return true;
  },

  async getDevicesForPass(walletPassId: string): Promise<WalletDevice[]> {
    return db.select().from(walletDevices).where(eq(walletDevices.walletPassId, walletPassId));
  },

  async getUpdatedPassesForDevice(deviceLibraryIdentifier: string, updatedSince?: Date): Promise<WalletPass[]> {
    const devices = await db.select().from(walletDevices)
      .where(eq(walletDevices.deviceLibraryIdentifier, deviceLibraryIdentifier));
    
    if (devices.length === 0) {
      return [];
    }
    
    const passIds = devices.map(d => d.walletPassId);
    
    const passes = await db.select().from(walletPasses)
      .where(
        and(
          sql`${walletPasses.id} IN ${passIds}`,
          updatedSince ? gte(walletPasses.updatedAt, updatedSince) : sql`1=1`
        )
      );
    
    return passes;
  },

  async getAnalyticsSummary(companyId: string, from?: Date, to?: Date): Promise<{
    totalMembers: number;
    totalLinks: number;
    totalOpens: number;
    appleDownloads: number;
    appleInstalls: number;
    googleClicks: number;
    googleSaved: number;
    errors: number;
    installedPassesCount: number;
    registeredDevicesCount: number;
  }> {
    const conditions = [eq(walletEvents.companyId, companyId)];
    if (from) conditions.push(gte(walletEvents.createdAt, from));
    if (to) conditions.push(lte(walletEvents.createdAt, to));

    const events = await db.select({
      type: walletEvents.type,
      count: count(),
    })
    .from(walletEvents)
    .where(and(...conditions))
    .groupBy(walletEvents.type);

    const counts: Record<string, number> = {};
    events.forEach(e => { counts[e.type] = Number(e.count); });

    const [linksResult] = await db.select({ count: count() })
      .from(walletLinks)
      .where(eq(walletLinks.companyId, companyId));

    const [membersResult] = await db.select({ count: count() })
      .from(walletMembers)
      .where(eq(walletMembers.companyId, companyId));

    // Count passes with "installed" status (Apple) or "saved" status (Google)
    const [installedPassesResult] = await db.select({ count: count() })
      .from(walletPasses)
      .where(and(
        eq(walletPasses.companyId, companyId),
        or(
          eq(walletPasses.appleStatus, "installed"),
          eq(walletPasses.googleStatus, "saved")
        )
      ));

    // Count unique registered devices (actual installs confirmed by Apple callback)
    const registeredDevicesResult = await db.execute(sql`
      SELECT COUNT(DISTINCT wd.id) as count
      FROM wallet_devices wd
      JOIN wallet_passes wp ON wp.id = wd.wallet_pass_id
      WHERE wp.company_id = ${companyId}
    `);

    return {
      totalMembers: Number(membersResult?.count || 0),
      totalLinks: Number(linksResult?.count || 0),
      totalOpens: counts["link_open"] || 0,
      appleDownloads: counts["apple_pkpass_download"] || 0,
      appleInstalls: counts["apple_device_registered"] || 0,
      googleClicks: counts["google_save_clicked"] || 0,
      googleSaved: counts["google_saved_confirmed"] || 0,
      errors: (counts["apple_pass_error"] || 0) + (counts["google_error"] || 0),
      installedPassesCount: Number(installedPassesResult?.count || 0),
      registeredDevicesCount: Number((registeredDevicesResult.rows[0] as any)?.count || 0),
    };
  },

  async getEventsByDay(companyId: string, from: Date, to: Date): Promise<{ date: string; count: number; type: string }[]> {
    const result = await db.execute(sql`
      SELECT 
        DATE(created_at) as date,
        type,
        COUNT(*) as count
      FROM wallet_events
      WHERE company_id = ${companyId}
        AND created_at >= ${from}
        AND created_at <= ${to}
      GROUP BY DATE(created_at), type
      ORDER BY date ASC
    `);
    return result.rows as any[];
  },

  async getEvents(companyId: string, options?: {
    memberId?: string;
    type?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<WalletEvent[]> {
    const conditions = [eq(walletEvents.companyId, companyId)];
    if (options?.memberId) conditions.push(eq(walletEvents.memberId, options.memberId));
    if (options?.type) conditions.push(eq(walletEvents.type, options.type as any));
    if (options?.from) conditions.push(gte(walletEvents.createdAt, options.from));
    if (options?.to) conditions.push(lte(walletEvents.createdAt, options.to));

    return db.select().from(walletEvents)
      .where(and(...conditions))
      .orderBy(desc(walletEvents.createdAt))
      .limit(options?.limit || 100)
      .offset(options?.offset || 0);
  },

  detectOS,
  parseUserAgent,
  generateSlug,

  async getWalletSettings(companyId: string): Promise<WalletSettings | undefined> {
    const [settings] = await db.select().from(walletSettings).where(eq(walletSettings.companyId, companyId));
    return settings;
  },

  async saveWalletSettings(companyId: string, data: Partial<InsertWalletSettings>): Promise<WalletSettings> {
    const existing = await this.getWalletSettings(companyId);
    
    if (existing) {
      const [updated] = await db.update(walletSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(walletSettings.companyId, companyId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(walletSettings).values({
        ...data,
        companyId,
      }).returning();
      return created;
    }
  },

  generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString("hex").slice(0, 32);
  },
};

export default walletPassService;
