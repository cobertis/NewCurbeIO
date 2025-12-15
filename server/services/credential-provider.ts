import { SecretsService } from "./secrets-service";
import type { ApiProvider } from "@shared/schema";

type CredentialCache = Map<string, { value: any; expires: number }>;

const cache: CredentialCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const secretsService = new SecretsService();

function getCacheKey(provider: string, key?: string): string {
  return key ? `${provider}:${key}` : provider;
}

function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, value: T): void {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}

export const credentialProvider = {
  async getStripe(): Promise<{ secretKey: string; webhookSecret: string; publishableKey: string }> {
    const cacheKey = getCacheKey('stripe');
    const cached = getFromCache<{ secretKey: string; webhookSecret: string; publishableKey: string }>(cacheKey);
    if (cached) return cached;

    const secretKey = await secretsService.getCredential("stripe" as ApiProvider, "secret_key") || 
                      process.env.STRIPE_SECRET_KEY || '';
    const webhookSecret = await secretsService.getCredential("stripe" as ApiProvider, "webhook_secret") || 
                          process.env.STRIPE_WEBHOOK_SECRET || '';
    const publishableKey = await secretsService.getCredential("stripe" as ApiProvider, "publishable_key") || 
                           process.env.STRIPE_PUBLISHABLE_KEY || '';
    
    const result = { secretKey, webhookSecret, publishableKey };
    setCache(cacheKey, result);
    return result;
  },

  async getTwilio(): Promise<{ accountSid: string; authToken: string; phoneNumber: string }> {
    const cacheKey = getCacheKey('twilio');
    const cached = getFromCache<{ accountSid: string; authToken: string; phoneNumber: string }>(cacheKey);
    if (cached) return cached;

    const accountSid = await secretsService.getCredential("twilio" as ApiProvider, "account_sid") || 
                       process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = await secretsService.getCredential("twilio" as ApiProvider, "auth_token") || 
                      process.env.TWILIO_AUTH_TOKEN || '';
    const phoneNumber = await secretsService.getCredential("twilio" as ApiProvider, "phone_number") || 
                        process.env.TWILIO_PHONE_NUMBER || '';
    
    const result = { accountSid, authToken, phoneNumber };
    setCache(cacheKey, result);
    return result;
  },

  async getBulkVS(): Promise<{ apiKey: string; apiSecret: string; accountId: string }> {
    const cacheKey = getCacheKey('bulkvs');
    const cached = getFromCache<{ apiKey: string; apiSecret: string; accountId: string }>(cacheKey);
    if (cached) return cached;

    const apiKey = await secretsService.getCredential("bulkvs" as ApiProvider, "api_key") || 
                   process.env.BULKVS_API_KEY || '';
    const apiSecret = await secretsService.getCredential("bulkvs" as ApiProvider, "api_secret") || 
                      process.env.BULKVS_API_SECRET || '';
    const accountId = await secretsService.getCredential("bulkvs" as ApiProvider, "account_id") || 
                      process.env.BULKVS_ACCOUNT_ID || '';
    
    const result = { apiKey, apiSecret, accountId };
    setCache(cacheKey, result);
    return result;
  },

  async getNodemailer(): Promise<{ host: string; port: number; user: string; password: string; fromEmail: string }> {
    const cacheKey = getCacheKey('nodemailer');
    const cached = getFromCache<{ host: string; port: number; user: string; password: string; fromEmail: string }>(cacheKey);
    if (cached) return cached;

    const host = await secretsService.getCredential("nodemailer" as ApiProvider, "host") || 
                 process.env.SMTP_HOST || '';
    const portStr = await secretsService.getCredential("nodemailer" as ApiProvider, "port") || 
                    process.env.SMTP_PORT || '587';
    const port = parseInt(portStr, 10);
    const user = await secretsService.getCredential("nodemailer" as ApiProvider, "user") || 
                 process.env.SMTP_USER || '';
    const password = await secretsService.getCredential("nodemailer" as ApiProvider, "password") || 
                     process.env.SMTP_PASSWORD || '';
    const fromEmail = await secretsService.getCredential("nodemailer" as ApiProvider, "from_email") || 
                      process.env.SMTP_FROM_EMAIL || user;
    
    const result = { host, port, user, password, fromEmail };
    setCache(cacheKey, result);
    return result;
  },

  async getImapBounce(): Promise<{ host: string; port: number; user: string; password: string; tls: boolean }> {
    const cacheKey = getCacheKey('imap_bounce');
    const cached = getFromCache<{ host: string; port: number; user: string; password: string; tls: boolean }>(cacheKey);
    if (cached) return cached;

    const host = await secretsService.getCredential("nodemailer" as ApiProvider, "bounce_imap_host") || 
                 process.env.BOUNCE_IMAP_HOST || '';
    const portStr = await secretsService.getCredential("nodemailer" as ApiProvider, "bounce_imap_port") || 
                    process.env.BOUNCE_IMAP_PORT || '993';
    const port = parseInt(portStr, 10);
    const user = await secretsService.getCredential("nodemailer" as ApiProvider, "bounce_imap_user") || 
                 process.env.BOUNCE_IMAP_USER || '';
    const password = await secretsService.getCredential("nodemailer" as ApiProvider, "bounce_imap_password") || 
                     process.env.BOUNCE_IMAP_PASSWORD || '';
    const tlsStr = await secretsService.getCredential("nodemailer" as ApiProvider, "bounce_imap_tls") || 
                   process.env.BOUNCE_IMAP_TLS || 'true';
    const tls = tlsStr !== 'false';
    
    const result = { host, port, user, password, tls };
    setCache(cacheKey, result);
    return result;
  },

  async getGooglePlaces(): Promise<{ apiKey: string }> {
    const cacheKey = getCacheKey('google_places');
    const cached = getFromCache<{ apiKey: string }>(cacheKey);
    if (cached) return cached;

    const apiKey = await secretsService.getCredential("google_places" as ApiProvider, "api_key") || 
                   process.env.GOOGLE_PLACES_API_KEY || '';
    
    const result = { apiKey };
    setCache(cacheKey, result);
    return result;
  },

  async getCloudflare(): Promise<{ apiToken: string; zoneId: string }> {
    const cacheKey = getCacheKey('cloudflare');
    const cached = getFromCache<{ apiToken: string; zoneId: string }>(cacheKey);
    if (cached) return cached;

    const apiToken = await secretsService.getCredential("cloudflare" as ApiProvider, "api_token") || 
                     process.env.CLOUDFLARE_API_TOKEN || '';
    const zoneId = await secretsService.getCredential("cloudflare" as ApiProvider, "zone_id") || 
                   process.env.CLOUDFLARE_ZONE_ID || '';
    
    const result = { apiToken, zoneId };
    setCache(cacheKey, result);
    return result;
  },

  async getEvolutionAPI(): Promise<{ baseUrl: string; globalApiKey: string }> {
    const cacheKey = getCacheKey('evolution_api');
    const cached = getFromCache<{ baseUrl: string; globalApiKey: string }>(cacheKey);
    if (cached) return cached;

    const baseUrl = await secretsService.getCredential("evolution" as ApiProvider, "base_url") || 
                    process.env.EVOLUTION_API_URL || '';
    const globalApiKey = await secretsService.getCredential("evolution" as ApiProvider, "api_key") || 
                         process.env.EVOLUTION_API_KEY || '';
    
    const result = { baseUrl, globalApiKey };
    setCache(cacheKey, result);
    return result;
  },

  async getWebPush(): Promise<{ publicKey: string; privateKey: string; subject: string; internalApiKey: string }> {
    const cacheKey = getCacheKey('web_push');
    const cached = getFromCache<{ publicKey: string; privateKey: string; subject: string; internalApiKey: string }>(cacheKey);
    if (cached) return cached;

    const publicKey = await secretsService.getCredential("web_push" as ApiProvider, "public_key") || 
                      process.env.VAPID_PUBLIC_KEY || '';
    const privateKey = await secretsService.getCredential("web_push" as ApiProvider, "private_key") || 
                       process.env.VAPID_PRIVATE_KEY || '';
    const subject = await secretsService.getCredential("web_push" as ApiProvider, "subject") || 
                    process.env.VAPID_SUBJECT || 'mailto:support@curbe.io';
    const internalApiKey = await secretsService.getCredential("web_push" as ApiProvider, "internal_api_key") || 
                           process.env.PUSH_INTERNAL_API_KEY || '';
    
    const result = { publicKey, privateKey, subject, internalApiKey };
    setCache(cacheKey, result);
    return result;
  },

  async get(service: string, key: string): Promise<string> {
    const cacheKey = getCacheKey(service, key);
    const cached = getFromCache<string>(cacheKey);
    if (cached) return cached;

    const value = await secretsService.getCredential(service as ApiProvider, key) || 
                  process.env[`${service.toUpperCase()}_${key.toUpperCase()}`] || '';
    
    setCache(cacheKey, value);
    return value;
  },

  invalidate(provider: string, keyName?: string): void {
    if (keyName) {
      cache.delete(getCacheKey(provider, keyName));
    } else {
      cache.delete(getCacheKey(provider));
      const keys = Array.from(cache.keys());
      for (const key of keys) {
        if (key.startsWith(`${provider}:`)) {
          cache.delete(key);
        }
      }
    }
  },

  invalidateAll(): void {
    cache.clear();
  }
};

export default credentialProvider;
