import webpush from "web-push";
import { db } from "../db";
import { pushSubscriptions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { credentialProvider } from "./credential-provider";

export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: PushAction[];
  notificationType?: 'TRANSACTIONAL' | 'REMINDER' | 'ACTION_REQUIRED' | 'INFO';
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
  internalApiKey: string;
  configured: boolean;
}

let vapidConfig: VapidConfig | null = null;

async function getVapidConfig(): Promise<VapidConfig> {
  if (vapidConfig) {
    return vapidConfig;
  }

  const creds = await credentialProvider.getWebPush();
  
  const configured = !!(creds.publicKey && creds.privateKey);
  
  if (configured) {
    try {
      webpush.setVapidDetails(creds.subject, creds.publicKey, creds.privateKey);
      console.log("[WebPush] VAPID keys configured successfully");
    } catch (error) {
      console.error("[WebPush] Failed to configure VAPID keys:", error);
      vapidConfig = {
        publicKey: '',
        privateKey: '',
        subject: '',
        internalApiKey: '',
        configured: false
      };
      return vapidConfig;
    }
  } else {
    console.log("[WebPush] VAPID keys not configured - push notifications disabled");
  }

  vapidConfig = {
    publicKey: creds.publicKey,
    privateKey: creds.privateKey,
    subject: creds.subject,
    internalApiKey: creds.internalApiKey,
    configured
  };

  return vapidConfig;
}

export function invalidateVapidCache(): void {
  vapidConfig = null;
  credentialProvider.invalidate('web_push');
}

export class WebPushService {
  async isConfigured(): Promise<boolean> {
    const config = await getVapidConfig();
    return config.configured;
  }

  async getPublicKey(): Promise<string | null> {
    const config = await getVapidConfig();
    return config.publicKey || null;
  }

  async getInternalApiKey(): Promise<string | null> {
    const config = await getVapidConfig();
    return config.internalApiKey || null;
  }

  async subscribe(data: {
    companyId: string;
    contactId?: string | null;
    passInstanceId?: string | null;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
    platform?: string | null;
  }): Promise<{ id: string }> {
    const now = new Date();

    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, data.endpoint))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(pushSubscriptions)
        .set({
          companyId: data.companyId,
          contactId: data.contactId,
          passInstanceId: data.passInstanceId,
          p256dh: data.p256dh,
          auth: data.auth,
          userAgent: data.userAgent,
          platform: data.platform,
          updatedAt: now,
        })
        .where(eq(pushSubscriptions.id, existing[0].id));
      return { id: existing[0].id };
    }

    const [result] = await db
      .insert(pushSubscriptions)
      .values({
        companyId: data.companyId,
        contactId: data.contactId,
        passInstanceId: data.passInstanceId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent,
        platform: data.platform,
      })
      .returning({ id: pushSubscriptions.id });

    return result;
  }

  async unsubscribe(endpoint: string): Promise<boolean> {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return true;
  }

  async sendPush(
    subscriptionId: string,
    payload: PushPayload
  ): Promise<{ success: boolean; error?: string }> {
    const config = await getVapidConfig();
    if (!config.configured) {
      return { success: false, error: "VAPID not configured" };
    }

    const [sub] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscriptionId))
      .limit(1);

    if (!sub) {
      return { success: false, error: "Subscription not found" };
    }

    return this.sendToEndpoint(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
      sub.id
    );
  }

  async sendToEndpoint(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: PushPayload,
    subscriptionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const config = await getVapidConfig();
    if (!config.configured) {
      return { success: false, error: "VAPID not configured" };
    }

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return { success: true };
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        if (subscriptionId) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, subscriptionId));
          console.log(`[WebPush] Removed dead subscription ${subscriptionId}`);
        }
        return { success: false, error: "Subscription expired" };
      }
      console.error("[WebPush] Send error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async sendToPassInstance(
    passInstanceId: string,
    payload: PushPayload
  ): Promise<{ sent: number; failed: number }> {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.passInstanceId, passInstanceId));

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const result = await this.sendToEndpoint(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        sub.id
      );
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  async sendToContact(
    companyId: string,
    contactId: string,
    payload: PushPayload
  ): Promise<{ sent: number; failed: number }> {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.companyId, companyId),
          eq(pushSubscriptions.contactId, contactId)
        )
      );

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const result = await this.sendToEndpoint(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        sub.id
      );
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  async getSubscriptionsByPassInstance(passInstanceId: string) {
    return db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.passInstanceId, passInstanceId));
  }

  async getSubscriptionsByContact(companyId: string, contactId: string) {
    return db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.companyId, companyId),
          eq(pushSubscriptions.contactId, contactId)
        )
      );
  }

  async getSubscriptionsCountByCompany(companyId: string): Promise<number> {
    const result = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.companyId, companyId));
    return result.length;
  }

  async getSubscriptionsCountByPlatform(companyId: string): Promise<{ android: number; ios: number; desktop: number }> {
    const subscriptions = await db
      .select({ platform: pushSubscriptions.platform })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.companyId, companyId));
    
    let android = 0;
    let ios = 0;
    let desktop = 0;
    
    for (const sub of subscriptions) {
      const platform = (sub.platform || '').toLowerCase();
      if (platform === 'android') {
        android++;
      } else if (platform === 'ios') {
        ios++;
      } else {
        desktop++;
      }
    }
    
    return { android, ios, desktop };
  }
}

export const webPushService = new WebPushService();
