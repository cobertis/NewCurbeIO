import { db } from "../db";
import { vipPassDevices, vipPassInstances, vipPassNotifications, vipPassDesigns } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import http2 from "http2";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import crypto from "crypto";

interface ApnsConfig {
  teamId: string;
  keyId: string;
  authKeyPath: string;
  passTypeIdentifier: string;
  environment: "development" | "production";
}

export class VipPassApnsService {
  private jwtTokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  private async getApnsConfig(companyId: string): Promise<ApnsConfig | null> {
    const companyKeyPath = path.join(process.cwd(), "certificates", `company_${companyId}`, "authkey.p8");
    const sharedKeyPath = path.join(process.cwd(), "certificates", "apns", "authkey.p8");
    
    const [design] = await db
      .select()
      .from(vipPassDesigns)
      .where(
        and(
          eq(vipPassDesigns.companyId, companyId),
          eq(vipPassDesigns.isActive, true)
        )
      )
      .limit(1);
    
    if (!design?.passTypeIdentifier || !design?.teamIdentifier) {
      console.log("[APNs] Pass design not configured with passTypeIdentifier and teamIdentifier");
      return null;
    }

    let authKeyPath: string | null = null;
    if (fs.existsSync(companyKeyPath)) {
      authKeyPath = companyKeyPath;
    } else if (fs.existsSync(sharedKeyPath)) {
      authKeyPath = sharedKeyPath;
    }

    if (!authKeyPath) {
      console.log("[APNs] No APNs auth key found");
      return null;
    }

    const keyId = process.env.APNS_KEY_ID || "";
    
    if (!keyId) {
      console.log("[APNs] APNS_KEY_ID not configured");
      return null;
    }

    return {
      teamId: design.teamIdentifier,
      keyId,
      authKeyPath,
      passTypeIdentifier: design.passTypeIdentifier,
      environment: (process.env.APNS_ENV as "development" | "production") || "development",
    };
  }

  private generateApnsToken(config: ApnsConfig): string {
    const cacheKey = `${config.teamId}_${config.keyId}`;
    const cached = this.jwtTokenCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now() + 600000) {
      return cached.token;
    }

    const authKey = fs.readFileSync(config.authKeyPath, "utf-8");
    const now = Math.floor(Date.now() / 1000);
    
    const token = jwt.sign(
      {
        iss: config.teamId,
        iat: now,
      },
      authKey,
      {
        algorithm: "ES256",
        keyid: config.keyId,
      }
    );

    this.jwtTokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + 3000000,
    });

    return token;
  }

  private getApnsHost(environment: "development" | "production"): string {
    return environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.development.push.apple.com";
  }

  private async sendPushToDevice(
    config: ApnsConfig,
    pushToken: string
  ): Promise<{ success: boolean; error?: string }> {
    const jwtToken = this.generateApnsToken(config);
    const host = this.getApnsHost(config.environment);

    return new Promise((resolve) => {
      const client = http2.connect(host);

      client.on("error", (err) => {
        client.close();
        resolve({ success: false, error: err.message });
      });

      const headers = {
        ":method": "POST",
        ":path": `/3/device/${pushToken}`,
        "authorization": `bearer ${jwtToken}`,
        "apns-topic": config.passTypeIdentifier,
        "apns-push-type": "background",
        "apns-priority": "5",
      };

      const req = client.request(headers);
      const payload = JSON.stringify({});

      req.setEncoding("utf8");

      let responseData = "";
      let statusCode: number | undefined;

      req.on("response", (headers) => {
        statusCode = headers[":status"];
      });

      req.on("data", (chunk) => {
        responseData += chunk;
      });

      req.on("end", () => {
        client.close();
        
        if (statusCode === 200) {
          resolve({ success: true });
        } else {
          resolve({ 
            success: false, 
            error: `APNs returned ${statusCode}: ${responseData}` 
          });
        }
      });

      req.on("error", (err) => {
        client.close();
        resolve({ success: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }

  async registerDevice(
    companyId: string,
    passSerialNumber: string,
    deviceLibraryIdentifier: string,
    pushToken: string
  ): Promise<boolean> {
    const [passInstance] = await db
      .select()
      .from(vipPassInstances)
      .where(
        and(
          eq(vipPassInstances.serialNumber, passSerialNumber),
          eq(vipPassInstances.companyId, companyId)
        )
      )
      .limit(1);

    if (!passInstance) {
      console.log("[APNs] Pass instance not found:", passSerialNumber);
      return false;
    }

    const [existingDevice] = await db
      .select()
      .from(vipPassDevices)
      .where(
        and(
          eq(vipPassDevices.passInstanceId, passInstance.id),
          eq(vipPassDevices.deviceLibraryIdentifier, deviceLibraryIdentifier)
        )
      )
      .limit(1);

    if (existingDevice) {
      if (existingDevice.pushToken !== pushToken) {
        await db
          .update(vipPassDevices)
          .set({
            pushToken,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(vipPassDevices.id, existingDevice.id));
      }
      return false;
    }

    await db.insert(vipPassDevices).values({
      id: crypto.randomUUID(),
      companyId,
      passInstanceId: passInstance.id,
      deviceLibraryIdentifier,
      pushToken,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return true;
  }

  async unregisterDevice(
    companyId: string,
    passSerialNumber: string,
    deviceLibraryIdentifier: string
  ): Promise<boolean> {
    const [passInstance] = await db
      .select()
      .from(vipPassInstances)
      .where(
        and(
          eq(vipPassInstances.serialNumber, passSerialNumber),
          eq(vipPassInstances.companyId, companyId)
        )
      )
      .limit(1);

    if (!passInstance) {
      return false;
    }

    await db
      .update(vipPassDevices)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vipPassDevices.passInstanceId, passInstance.id),
          eq(vipPassDevices.deviceLibraryIdentifier, deviceLibraryIdentifier)
        )
      );

    return true;
  }

  async sendPushToPass(companyId: string, passInstanceId: string, message: string): Promise<{
    sentCount: number;
    successCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const config = await this.getApnsConfig(companyId);
    
    if (!config) {
      return {
        sentCount: 0,
        successCount: 0,
        failedCount: 0,
        errors: ["APNs not configured for this company"],
      };
    }

    const devices = await db
      .select()
      .from(vipPassDevices)
      .where(
        and(
          eq(vipPassDevices.passInstanceId, passInstanceId),
          eq(vipPassDevices.isActive, true)
        )
      );

    if (devices.length === 0) {
      return {
        sentCount: 0,
        successCount: 0,
        failedCount: 0,
        errors: ["No registered devices for this pass"],
      };
    }

    const results = await Promise.all(
      devices.map((device) => this.sendPushToDevice(config, device.pushToken))
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;
    const errors = results
      .filter((r) => !r.success && r.error)
      .map((r) => r.error!);

    await db.insert(vipPassNotifications).values({
      id: crypto.randomUUID(),
      companyId,
      passInstanceId,
      targetType: "single",
      message,
      sentCount: devices.length,
      successCount,
      failedCount,
      createdAt: new Date(),
    });

    return {
      sentCount: devices.length,
      successCount,
      failedCount,
      errors,
    };
  }

  async sendPushToAllPasses(companyId: string, message: string): Promise<{
    sentCount: number;
    successCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const config = await this.getApnsConfig(companyId);
    
    if (!config) {
      return {
        sentCount: 0,
        successCount: 0,
        failedCount: 0,
        errors: ["APNs not configured for this company"],
      };
    }

    const devices = await db
      .select()
      .from(vipPassDevices)
      .where(
        and(
          eq(vipPassDevices.companyId, companyId),
          eq(vipPassDevices.isActive, true)
        )
      );

    if (devices.length === 0) {
      return {
        sentCount: 0,
        successCount: 0,
        failedCount: 0,
        errors: ["No registered devices for any passes"],
      };
    }

    const results = await Promise.all(
      devices.map((device) => this.sendPushToDevice(config, device.pushToken))
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;
    const errors = results
      .filter((r) => !r.success && r.error)
      .map((r) => r.error!);

    await db.insert(vipPassNotifications).values({
      id: crypto.randomUUID(),
      companyId,
      passInstanceId: null,
      targetType: "all",
      message,
      sentCount: devices.length,
      successCount,
      failedCount,
      createdAt: new Date(),
    });

    return {
      sentCount: devices.length,
      successCount,
      failedCount,
      errors,
    };
  }

  async getNotificationHistory(companyId: string, limit = 50) {
    return await db
      .select()
      .from(vipPassNotifications)
      .where(eq(vipPassNotifications.companyId, companyId))
      .orderBy(vipPassNotifications.createdAt)
      .limit(limit);
  }

  async getDevicesCount(companyId: string): Promise<number> {
    const devices = await db
      .select()
      .from(vipPassDevices)
      .where(
        and(
          eq(vipPassDevices.companyId, companyId),
          eq(vipPassDevices.isActive, true)
        )
      );

    return devices.length;
  }
}

export const vipPassApnsService = new VipPassApnsService();
