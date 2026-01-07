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

export function clearCredentialCache(provider?: string): void {
  if (provider) {
    // Clear specific provider cache
    const keys = Array.from(cache.keys());
    for (const key of keys) {
      if (key.startsWith(provider)) {
        cache.delete(key);
      }
    }
  } else {
    // Clear all cache
    cache.clear();
  }
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

    const host = await secretsService.getCredential("imap_bounce" as ApiProvider, "host") || 
                 process.env.BOUNCE_IMAP_HOST || '';
    const portStr = await secretsService.getCredential("imap_bounce" as ApiProvider, "port") || 
                    process.env.BOUNCE_IMAP_PORT || '993';
    const port = parseInt(portStr, 10);
    const user = await secretsService.getCredential("imap_bounce" as ApiProvider, "user") || 
                 process.env.BOUNCE_IMAP_USER || '';
    const password = await secretsService.getCredential("imap_bounce" as ApiProvider, "password") || 
                     process.env.BOUNCE_IMAP_PASSWORD || '';
    const tlsStr = await secretsService.getCredential("imap_bounce" as ApiProvider, "tls") || 
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

    const baseUrl = await secretsService.getCredential("evolution_api" as ApiProvider, "base_url") || 
                    process.env.EVOLUTION_API_URL || '';
    const globalApiKey = await secretsService.getCredential("evolution_api" as ApiProvider, "global_api_key") || 
                         process.env.EVOLUTION_API_KEY || '';
    
    const result = { baseUrl, globalApiKey };
    setCache(cacheKey, result);
    return result;
  },

  async getCmsApi(): Promise<{ apiKey: string }> {
    const cacheKey = getCacheKey('cms_api');
    const cached = getFromCache<{ apiKey: string }>(cacheKey);
    if (cached) return cached;

    const apiKey = await secretsService.getCredential("cms_api" as ApiProvider, "api_key") || 
                   process.env.CMS_API_KEY || '';
    
    const result = { apiKey };
    setCache(cacheKey, result);
    return result;
  },

  async getTelnyx(): Promise<{ apiKey: string; publicKey: string }> {
    const cacheKey = getCacheKey('telnyx');
    const cached = getFromCache<{ apiKey: string; publicKey: string }>(cacheKey);
    if (cached) return cached;

    const apiKey = await secretsService.getCredential("telnyx" as ApiProvider, "api_key") || 
                   process.env.TELNYX_API_KEY || '';
    const publicKey = await secretsService.getCredential("telnyx" as ApiProvider, "public_key") || 
                      process.env.TELNYX_PUBLIC_KEY || '';
    
    const result = { apiKey, publicKey };
    setCache(cacheKey, result);
    return result;
  },

  async getGoogleOAuth(): Promise<{ clientId: string; clientSecret: string }> {
    const cacheKey = getCacheKey('google_oauth');
    const cached = getFromCache<{ clientId: string; clientSecret: string }>(cacheKey);
    if (cached) return cached;

    const clientId = await secretsService.getCredential("google_oauth" as ApiProvider, "client_id") || '';
    const clientSecret = await secretsService.getCredential("google_oauth" as ApiProvider, "client_secret") || '';
    
    const result = { clientId, clientSecret };
    setCache(cacheKey, result);
    return result;
  },

  async getMeta(): Promise<{ appId: string; appSecret: string; webhookVerifyToken: string; facebookConfigId: string; instagramConfigId: string; whatsappConfigId: string }> {
    const cacheKey = getCacheKey('meta');
    const cached = getFromCache<{ appId: string; appSecret: string; webhookVerifyToken: string; facebookConfigId: string; instagramConfigId: string; whatsappConfigId: string }>(cacheKey);
    if (cached) return cached;

    const appId = await secretsService.getCredential("meta" as ApiProvider, "app_id") || 
                  process.env.META_APP_ID || '';
    const appSecret = await secretsService.getCredential("meta" as ApiProvider, "app_secret") || 
                      process.env.META_APP_SECRET || '';
    const webhookVerifyToken = await secretsService.getCredential("meta" as ApiProvider, "webhook_verify_token") || 
                               process.env.META_WEBHOOK_VERIFY_TOKEN || '';
    
    // Unified config_id field - same config_id works for Facebook, Instagram, and WhatsApp
    const unifiedConfigId = await secretsService.getCredential("meta" as ApiProvider, "config_id") || 
                            process.env.META_BUSINESS_LOGIN_CONFIG_ID || '';
    
    const facebookConfigId = await secretsService.getCredential("meta" as ApiProvider, "facebook_config_id") || 
                             unifiedConfigId || process.env.META_FACEBOOK_CONFIG_ID || '';
    const instagramConfigId = await secretsService.getCredential("meta" as ApiProvider, "instagram_config_id") || 
                              unifiedConfigId || process.env.META_INSTAGRAM_CONFIG_ID || '';
    const whatsappConfigId = await secretsService.getCredential("meta" as ApiProvider, "whatsapp_config_id") || 
                             unifiedConfigId || process.env.META_WHATSAPP_CONFIG_ID || '';
    
    const result = { appId, appSecret, webhookVerifyToken, facebookConfigId, instagramConfigId, whatsappConfigId };
    setCache(cacheKey, result);
    return result;
  },

  async getTiktok(): Promise<{ clientKey: string; clientSecret: string }> {
    const cacheKey = getCacheKey('tiktok');
    const cached = getFromCache<{ clientKey: string; clientSecret: string }>(cacheKey);
    if (cached) return cached;

    const clientKey = await secretsService.getCredential("tiktok" as ApiProvider, "client_key") || 
                      process.env.TIKTOK_CLIENT_KEY || '';
    const clientSecret = await secretsService.getCredential("tiktok" as ApiProvider, "client_secret") || 
                         process.env.TIKTOK_CLIENT_SECRET || '';
    
    const result = { clientKey, clientSecret };
    setCache(cacheKey, result);
    return result;
  },

  async getTelegram(): Promise<{ botToken: string; botUsername: string; webhookSecret: string }> {
    const cacheKey = getCacheKey('telegram');
    const cached = getFromCache<{ botToken: string; botUsername: string; webhookSecret: string }>(cacheKey);
    if (cached) return cached;

    const botToken = await secretsService.getCredential("telegram" as ApiProvider, "bot_token") || 
                     process.env.TELEGRAM_BOT_TOKEN || '';
    const botUsername = await secretsService.getCredential("telegram" as ApiProvider, "bot_username") || 
                        process.env.TELEGRAM_BOT_USERNAME || '';
    const webhookSecret = await secretsService.getCredential("telegram" as ApiProvider, "webhook_secret") || 
                          process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN || '';
    
    const result = { botToken, botUsername, webhookSecret };
    setCache(cacheKey, result);
    return result;
  },

  async getAwsSes(): Promise<{ accessKeyId: string; secretAccessKey: string; region: string }> {
    const cacheKey = getCacheKey('aws_ses');
    const cached = getFromCache<{ accessKeyId: string; secretAccessKey: string; region: string }>(cacheKey);
    if (cached) return cached;

    const accessKeyId = await secretsService.getCredential("aws_ses" as ApiProvider, "access_key_id") || 
                        process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = await secretsService.getCredential("aws_ses" as ApiProvider, "secret_access_key") || 
                            process.env.AWS_SECRET_ACCESS_KEY || '';
    const region = await secretsService.getCredential("aws_ses" as ApiProvider, "region") || 
                   process.env.AWS_SES_REGION || 'us-east-1';
    
    const result = { accessKeyId, secretAccessKey, region };
    setCache(cacheKey, result);
    return result;
  },

  async getOpenai(): Promise<{ apiKey: string }> {
    const cacheKey = getCacheKey('openai');
    const cached = getFromCache<{ apiKey: string }>(cacheKey);
    if (cached) return cached;

    const apiKey = await secretsService.getCredential("openai" as ApiProvider, "api_key") || 
                   process.env.AI_INTEGRATIONS_OPENAI_API_KEY || 
                   process.env.OPENAI_API_KEY || '';
    
    const result = { apiKey };
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
