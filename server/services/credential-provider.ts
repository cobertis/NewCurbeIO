import { secretsService } from "./secrets-service";
import type { ApiProvider } from "@shared/schema";

type CredentialKey = {
  provider: ApiProvider;
  keyName: string;
  envVar: string;
};

const CREDENTIAL_MAPPINGS: CredentialKey[] = [
  { provider: "stripe", keyName: "secret_key", envVar: "STRIPE_SECRET_KEY" },
  { provider: "stripe", keyName: "publishable_key", envVar: "VITE_STRIPE_PUBLISHABLE_KEY" },
  { provider: "stripe", keyName: "webhook_secret", envVar: "STRIPE_WEBHOOK_SECRET" },
  
  { provider: "telnyx", keyName: "api_key", envVar: "TELNYX_API_KEY" },
  { provider: "telnyx", keyName: "public_key", envVar: "TELNYX_PUBLIC_KEY" },
  { provider: "telnyx", keyName: "app_id", envVar: "TELNYX_APP_ID" },
  { provider: "telnyx", keyName: "messaging_profile_id", envVar: "TELNYX_MESSAGING_PROFILE_ID" },
  
  { provider: "twilio", keyName: "account_sid", envVar: "TWILIO_ACCOUNT_SID" },
  { provider: "twilio", keyName: "auth_token", envVar: "TWILIO_AUTH_TOKEN" },
  { provider: "twilio", keyName: "phone_number", envVar: "TWILIO_PHONE_NUMBER" },
  
  
  { provider: "bluebubbles", keyName: "server_url", envVar: "BLUEBUBBLES_SERVER_URL" },
  { provider: "bluebubbles", keyName: "password", envVar: "BLUEBUBBLES_PASSWORD" },
  
  { provider: "evolution_api", keyName: "base_url", envVar: "EVOLUTION_API_BASE_URL" },
  { provider: "evolution_api", keyName: "global_api_key", envVar: "EVOLUTION_API_GLOBAL_API_KEY" },
  
  { provider: "google_places", keyName: "api_key", envVar: "GOOGLE_PLACES_API_KEY" },
  
  { provider: "nodemailer", keyName: "host", envVar: "SMTP_HOST" },
  { provider: "nodemailer", keyName: "port", envVar: "SMTP_PORT" },
  { provider: "nodemailer", keyName: "user", envVar: "SMTP_USER" },
  { provider: "nodemailer", keyName: "password", envVar: "SMTP_PASSWORD" },
  { provider: "nodemailer", keyName: "from_email", envVar: "SMTP_FROM_EMAIL" },
  
  { provider: "openai", keyName: "api_key", envVar: "OPENAI_API_KEY" },
  
  { provider: "cms_api", keyName: "api_key", envVar: "CMS_API_KEY" },
  { provider: "cms_api", keyName: "base_url", envVar: "CMS_API_BASE_URL" },
];

class CredentialProvider {
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private getCacheKey(provider: ApiProvider, keyName: string): string {
    return `${provider}:${keyName}`;
  }

  async get(provider: ApiProvider, keyName: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(provider, keyName);
    
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    try {
      const dbValue = await secretsService.getCredential(provider, keyName);
      if (dbValue) {
        this.cache.set(cacheKey, { value: dbValue, timestamp: Date.now() });
        return dbValue;
      }
    } catch (error) {
      console.warn(`Failed to get credential from DB: ${provider}/${keyName}`, error);
    }

    // All credentials must be stored in the database - no env fallback
    return null;
  }

  async getRequired(provider: ApiProvider, keyName: string): Promise<string> {
    const value = await this.get(provider, keyName);
    if (!value) {
      throw new Error(`Required credential not found: ${provider}/${keyName}`);
    }
    return value;
  }

  async getMultiple(
    provider: ApiProvider,
    keyNames: string[]
  ): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    
    await Promise.all(
      keyNames.map(async (keyName) => {
        results[keyName] = await this.get(provider, keyName);
      })
    );
    
    return results;
  }

  async getStripe(): Promise<{
    secretKey: string | null;
    publishableKey: string | null;
    webhookSecret: string | null;
  }> {
    const [secretKey, publishableKey, webhookSecret] = await Promise.all([
      this.get("stripe", "secret_key"),
      this.get("stripe", "publishable_key"),
      this.get("stripe", "webhook_secret"),
    ]);
    return { secretKey, publishableKey, webhookSecret };
  }

  async getTelnyx(): Promise<{
    apiKey: string | null;
    publicKey: string | null;
    appId: string | null;
    messagingProfileId: string | null;
  }> {
    const [apiKey, publicKey, appId, messagingProfileId] = await Promise.all([
      this.get("telnyx", "api_key"),
      this.get("telnyx", "public_key"),
      this.get("telnyx", "app_id"),
      this.get("telnyx", "messaging_profile_id"),
    ]);
    return { apiKey, publicKey, appId, messagingProfileId };
  }

  async getTwilio(): Promise<{
    accountSid: string | null;
    authToken: string | null;
    phoneNumber: string | null;
  }> {
    const [accountSid, authToken, phoneNumber] = await Promise.all([
      this.get("twilio", "account_sid"),
      this.get("twilio", "auth_token"),
      this.get("twilio", "phone_number"),
    ]);
    return { accountSid, authToken, phoneNumber };
  }


  async getBlueBubbles(): Promise<{
    serverUrl: string | null;
    password: string | null;
  }> {
    const [serverUrl, password] = await Promise.all([
      this.get("bluebubbles", "server_url"),
      this.get("bluebubbles", "password"),
    ]);
    return { serverUrl, password };
  }

  async getEvolutionAPI(): Promise<{
    baseUrl: string | null;
    globalApiKey: string | null;
  }> {
    const [baseUrl, globalApiKey] = await Promise.all([
      this.get("evolution_api", "base_url"),
      this.get("evolution_api", "global_api_key"),
    ]);
    return { baseUrl, globalApiKey };
  }

  async getNodemailer(): Promise<{
    host: string | null;
    port: string | null;
    user: string | null;
    password: string | null;
    fromEmail: string | null;
  }> {
    const [host, port, user, password, fromEmail] = await Promise.all([
      this.get("nodemailer", "host"),
      this.get("nodemailer", "port"),
      this.get("nodemailer", "user"),
      this.get("nodemailer", "password"),
      this.get("nodemailer", "from_email"),
    ]);
    return { host, port, user, password, fromEmail };
  }

  async getGooglePlaces(): Promise<{
    apiKey: string | null;
  }> {
    const apiKey = await this.get("google_places", "api_key");
    return { apiKey };
  }

  clearCache(credentialKey?: string): void {
    if (credentialKey) {
      this.cache.delete(credentialKey);
    } else {
      this.cache.clear();
    }
  }

  invalidate(provider: ApiProvider, keyName: string): void {
    const cacheKey = this.getCacheKey(provider, keyName);
    this.cache.delete(cacheKey);
  }

  invalidateProvider(provider: ApiProvider): void {
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(`${provider}:`)) {
        this.cache.delete(key);
      }
    }
  }
}

export const credentialProvider = new CredentialProvider();
