import crypto from "crypto";
import { db } from "../db";
import { 
  systemApiCredentials, 
  systemApiCredentialsAudit,
  type ApiProvider,
  type SystemApiCredential,
  type CredentialAuditAction,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const masterKey = process.env.SECRETS_MASTER_KEY;
  if (!masterKey) {
    const errorMessage = "CRITICAL SECURITY ERROR: SECRETS_MASTER_KEY environment variable is required for AES-256-GCM encryption but is not set. Please set SECRETS_MASTER_KEY to a 64-character hex string (32 bytes) before starting the application.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  if (masterKey.length !== 64) {
    const errorMessage = `CRITICAL SECURITY ERROR: SECRETS_MASTER_KEY must be exactly 64 hex characters (32 bytes) for AES-256-GCM encryption. Current length: ${masterKey.length}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  return Buffer.from(masterKey, "hex");
}

export class SecretsService {
  private masterKey: Buffer;

  constructor() {
    this.masterKey = getMasterKey();
  }

  encrypt(plaintext: string): { encryptedValue: string; iv: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedValue: encrypted + authTag.toString("hex"),
      iv: iv.toString("hex"),
    };
  }

  decrypt(encryptedValue: string, iv: string): string {
    const ivBuffer = Buffer.from(iv, "hex");
    const encrypted = encryptedValue.slice(0, -AUTH_TAG_LENGTH * 2);
    const authTag = Buffer.from(encryptedValue.slice(-AUTH_TAG_LENGTH * 2), "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, ivBuffer);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }

  async storeCredential(
    provider: ApiProvider,
    keyName: string,
    value: string,
    options: {
      environment?: string;
      description?: string;
      createdBy?: string;
    } = {}
  ): Promise<SystemApiCredential> {
    const { encryptedValue, iv } = this.encrypt(value);
    
    const existing = await db.query.systemApiCredentials.findFirst({
      where: and(
        eq(systemApiCredentials.provider, provider),
        eq(systemApiCredentials.keyName, keyName),
        eq(systemApiCredentials.environment, options.environment || "production")
      ),
    });

    let credential: SystemApiCredential;

    if (existing) {
      const [updated] = await db
        .update(systemApiCredentials)
        .set({
          encryptedValue,
          iv,
          updatedAt: new Date(),
          updatedBy: options.createdBy,
          description: options.description,
        })
        .where(eq(systemApiCredentials.id, existing.id))
        .returning();
      credential = updated;

      if (options.createdBy) {
        await this.logAudit(credential.id, provider, keyName, "updated", options.createdBy);
      }
    } else {
      const [created] = await db
        .insert(systemApiCredentials)
        .values({
          provider,
          keyName,
          encryptedValue,
          iv,
          environment: options.environment || "production",
          description: options.description,
          createdBy: options.createdBy,
          updatedBy: options.createdBy,
        })
        .returning();
      credential = created;

      if (options.createdBy) {
        await this.logAudit(credential.id, provider, keyName, "created", options.createdBy);
      }
    }

    return credential;
  }

  async getCredential(
    provider: ApiProvider,
    keyName: string
  ): Promise<string | null> {
    const credential = await db.query.systemApiCredentials.findFirst({
      where: and(
        eq(systemApiCredentials.provider, provider),
        eq(systemApiCredentials.keyName, keyName),
        eq(systemApiCredentials.isActive, true)
      ),
    });

    if (!credential) {
      return null;
    }

    return this.decrypt(credential.encryptedValue, credential.iv);
  }

  async listCredentials(provider?: ApiProvider): Promise<Omit<SystemApiCredential, "encryptedValue" | "iv">[]> {
    const where = provider ? eq(systemApiCredentials.provider, provider) : undefined;
    
    const credentials = await db.query.systemApiCredentials.findMany({
      where,
      columns: {
        id: true,
        provider: true,
        keyName: true,
        keyVersion: true,
        environment: true,
        description: true,
        isActive: true,
        lastRotatedAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
      },
      orderBy: [desc(systemApiCredentials.updatedAt)],
    });

    return credentials;
  }

  async deleteCredential(id: string, actorId: string): Promise<boolean> {
    const credential = await db.query.systemApiCredentials.findFirst({
      where: eq(systemApiCredentials.id, id),
    });

    if (!credential) {
      return false;
    }

    await this.logAudit(id, credential.provider as ApiProvider, credential.keyName, "deleted", actorId);

    await db.delete(systemApiCredentials).where(eq(systemApiCredentials.id, id));

    return true;
  }

  async rotateCredential(
    id: string,
    newValue: string,
    actorId: string
  ): Promise<SystemApiCredential | null> {
    const credential = await db.query.systemApiCredentials.findFirst({
      where: eq(systemApiCredentials.id, id),
    });

    if (!credential) {
      return null;
    }

    const { encryptedValue, iv } = this.encrypt(newValue);

    const [updated] = await db
      .update(systemApiCredentials)
      .set({
        encryptedValue,
        iv,
        keyVersion: credential.keyVersion + 1,
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(systemApiCredentials.id, id))
      .returning();

    await this.logAudit(id, credential.provider as ApiProvider, credential.keyName, "rotated", actorId);

    return updated;
  }

  async toggleCredential(id: string, isActive: boolean, actorId: string): Promise<SystemApiCredential | null> {
    const [updated] = await db
      .update(systemApiCredentials)
      .set({
        isActive,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(systemApiCredentials.id, id))
      .returning();

    if (updated) {
      await this.logAudit(id, updated.provider as ApiProvider, updated.keyName, "updated", actorId, {
        action: isActive ? "enabled" : "disabled",
      });
    }

    return updated || null;
  }

  private async logAudit(
    credentialId: string,
    provider: ApiProvider,
    keyName: string,
    action: CredentialAuditAction,
    actorId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await db.insert(systemApiCredentialsAudit).values({
      credentialId,
      provider,
      keyName,
      action,
      actorId,
      ipAddress,
      userAgent,
      metadata: metadata || null,
    });
  }

  async getAuditLog(
    credentialId?: string,
    limit: number = 50
  ): Promise<typeof systemApiCredentialsAudit.$inferSelect[]> {
    const where = credentialId 
      ? eq(systemApiCredentialsAudit.credentialId, credentialId) 
      : undefined;

    return db.query.systemApiCredentialsAudit.findMany({
      where,
      orderBy: [desc(systemApiCredentialsAudit.createdAt)],
      limit,
    });
  }

  async logCredentialView(
    id: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const credential = await db.query.systemApiCredentials.findFirst({
      where: eq(systemApiCredentials.id, id),
    });

    if (credential) {
      await this.logAudit(
        id, 
        credential.provider as ApiProvider, 
        credential.keyName, 
        "viewed", 
        actorId,
        undefined,
        ipAddress,
        userAgent
      );
    }
  }
}

export const secretsService = new SecretsService();
