import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../db";
import { widgetSessions, widgetContacts, widgetConfigs } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "widget-jwt-secret-change-in-production";
const TOKEN_EXPIRY_DAYS = 180; // 6 months like Chatwoot

export interface WidgetTokenPayload {
  sourceId: string;
  widgetConfigId: string;
  companyId: string;
  contactId?: string;
  identifier?: string;
  iat?: number;
  exp?: number;
}

export interface IdentityVerificationPayload {
  identifier: string;
  email?: string;
  name?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  customAttributes?: Record<string, any>;
}

function generateSourceId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateHmacSignature(data: string, hmacToken: string): string {
  return crypto.createHmac("sha256", hmacToken).update(data).digest("hex");
}

export function verifyHmacSignature(identifier: string, signature: string, hmacToken: string): boolean {
  try {
    const expectedSignature = generateHmacSignature(identifier, hmacToken);
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function createWidgetToken(
  widgetConfigId: string,
  companyId: string,
  deviceId?: string,
  userAgent?: string
): Promise<{ token: string; sourceId: string; contactId: string }> {
  const sourceId = generateSourceId();
  
  const [contact] = await db.insert(widgetContacts).values({
    companyId,
    widgetConfigId,
    sourceId,
    contactType: "visitor",
  }).returning();
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);
  
  const payload: WidgetTokenPayload = {
    sourceId,
    widgetConfigId,
    companyId,
    contactId: contact.id,
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRY_DAYS}d` });
  
  await db.insert(widgetSessions).values({
    companyId,
    widgetConfigId,
    widgetContactId: contact.id,
    tokenHash: hashToken(token),
    deviceId,
    userAgent,
    expiresAt,
  });
  
  return { token, sourceId, contactId: contact.id };
}

export async function verifyWidgetToken(token: string): Promise<{
  valid: boolean;
  payload?: WidgetTokenPayload;
  contact?: typeof widgetContacts.$inferSelect;
}> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as WidgetTokenPayload;
    
    const [session] = await db.select()
      .from(widgetSessions)
      .where(
        and(
          eq(widgetSessions.tokenHash, hashToken(token)),
          gt(widgetSessions.expiresAt, new Date()),
          isNull(widgetSessions.revokedAt)
        )
      )
      .limit(1);
    
    if (!session) {
      return { valid: false };
    }
    
    await db.update(widgetSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(widgetSessions.id, session.id));
    
    const [contact] = await db.select()
      .from(widgetContacts)
      .where(eq(widgetContacts.id, session.widgetContactId))
      .limit(1);
    
    return { valid: true, payload, contact };
  } catch {
    return { valid: false };
  }
}

export async function refreshWidgetToken(oldToken: string): Promise<{
  success: boolean;
  newToken?: string;
  error?: string;
}> {
  const { valid, payload, contact } = await verifyWidgetToken(oldToken);
  
  if (!valid || !payload || !contact) {
    return { success: false, error: "Invalid or expired token" };
  }
  
  await db.update(widgetSessions)
    .set({ revokedAt: new Date() })
    .where(eq(widgetSessions.tokenHash, hashToken(oldToken)));
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);
  
  const newPayload: WidgetTokenPayload = {
    sourceId: payload.sourceId,
    widgetConfigId: payload.widgetConfigId,
    companyId: payload.companyId,
    contactId: contact.id,
    identifier: contact.identifier || undefined,
  };
  
  const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRY_DAYS}d` });
  
  await db.insert(widgetSessions).values({
    companyId: payload.companyId,
    widgetConfigId: payload.widgetConfigId,
    widgetContactId: contact.id,
    tokenHash: hashToken(newToken),
    expiresAt,
  });
  
  return { success: true, newToken };
}

export async function identifyContact(
  token: string,
  identityData: IdentityVerificationPayload,
  hmacSignature?: string
): Promise<{
  success: boolean;
  contact?: typeof widgetContacts.$inferSelect;
  error?: string;
}> {
  const { valid, payload, contact } = await verifyWidgetToken(token);
  
  if (!valid || !payload || !contact) {
    return { success: false, error: "Invalid token" };
  }
  
  const [widgetConfig] = await db.select()
    .from(widgetConfigs)
    .where(eq(widgetConfigs.id, payload.widgetConfigId))
    .limit(1);
  
  if (!widgetConfig) {
    return { success: false, error: "Widget configuration not found" };
  }
  
  if (widgetConfig.hmacMandatory) {
    if (!hmacSignature) {
      return { success: false, error: "HMAC signature required" };
    }
    
    if (!verifyHmacSignature(identityData.identifier, hmacSignature, widgetConfig.hmacToken)) {
      return { success: false, error: "Invalid HMAC signature" };
    }
  }
  
  const existingContacts = await db.select()
    .from(widgetContacts)
    .where(
      and(
        eq(widgetContacts.widgetConfigId, payload.widgetConfigId),
        eq(widgetContacts.identifier, identityData.identifier)
      )
    )
    .limit(1);
  
  if (existingContacts.length > 0 && existingContacts[0].id !== contact.id) {
    const existingContact = existingContacts[0];
    
    await db.update(widgetContacts)
      .set({
        name: identityData.name || existingContact.name,
        email: identityData.email || existingContact.email,
        phoneNumber: identityData.phoneNumber || existingContact.phoneNumber,
        avatarUrl: identityData.avatarUrl || existingContact.avatarUrl,
        customAttributes: { ...existingContact.customAttributes, ...identityData.customAttributes },
        contactType: "lead",
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(widgetContacts.id, existingContact.id));
    
    await db.update(widgetSessions)
      .set({ widgetContactId: existingContact.id })
      .where(eq(widgetSessions.widgetContactId, contact.id));
    
    await db.delete(widgetContacts).where(eq(widgetContacts.id, contact.id));
    
    const [mergedContact] = await db.select()
      .from(widgetContacts)
      .where(eq(widgetContacts.id, existingContact.id))
      .limit(1);
    
    return { success: true, contact: mergedContact };
  }
  
  const [updatedContact] = await db.update(widgetContacts)
    .set({
      identifier: identityData.identifier,
      name: identityData.name || contact.name,
      email: identityData.email || contact.email,
      phoneNumber: identityData.phoneNumber || contact.phoneNumber,
      avatarUrl: identityData.avatarUrl || contact.avatarUrl,
      customAttributes: { ...contact.customAttributes, ...identityData.customAttributes },
      contactType: "lead",
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(widgetContacts.id, contact.id))
    .returning();
  
  return { success: true, contact: updatedContact };
}

export async function revokeAllSessions(contactId: string): Promise<void> {
  await db.update(widgetSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(widgetSessions.widgetContactId, contactId),
        isNull(widgetSessions.revokedAt)
      )
    );
}
