import { db } from "../db";
import { systemConfig } from "@shared/schema";
import { eq } from "drizzle-orm";

interface CacheEntry {
  value: string;
  timestamp: number;
}

interface SetOptions {
  description?: string;
  isPublic?: boolean;
  updatedBy?: string;
}

const DEFAULT_CONFIGS: Record<string, { value: string; description: string; isPublic: boolean }> = {
  APP_URL: {
    value: process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase() || 'replit'}.repl.co`
      : 'http://localhost:5000',
    description: 'The public URL of the application',
    isPublic: true,
  },
};

class SystemConfigService {
  private cache: Map<string, CacheEntry> = new Map();
  private publicConfigCache: { data: Record<string, string>; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      for (const [key, config] of Object.entries(DEFAULT_CONFIGS)) {
        const existing = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
        
        if (existing.length === 0) {
          await db.insert(systemConfig).values({
            key,
            value: config.value,
            description: config.description,
            isPublic: config.isPublic,
          });
          console.log(`[SystemConfig] Initialized default config: ${key}`);
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error('[SystemConfig] Failed to initialize defaults:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    try {
      const result = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
      
      if (result.length > 0) {
        this.cache.set(key, { value: result[0].value, timestamp: Date.now() });
        return result[0].value;
      }
      
      const defaultConfig = DEFAULT_CONFIGS[key];
      if (defaultConfig) {
        return defaultConfig.value;
      }
      
      return null;
    } catch (error) {
      console.error(`[SystemConfig] Failed to get config ${key}:`, error);
      
      const defaultConfig = DEFAULT_CONFIGS[key];
      if (defaultConfig) {
        return defaultConfig.value;
      }
      
      return null;
    }
  }

  async set(key: string, value: string, options?: SetOptions): Promise<void> {
    try {
      const existing = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
      
      if (existing.length > 0) {
        await db.update(systemConfig)
          .set({
            value,
            description: options?.description !== undefined ? options.description : existing[0].description,
            isPublic: options?.isPublic !== undefined ? options.isPublic : existing[0].isPublic,
            updatedBy: options?.updatedBy || null,
            updatedAt: new Date(),
          })
          .where(eq(systemConfig.key, key));
      } else {
        await db.insert(systemConfig).values({
          key,
          value,
          description: options?.description || null,
          isPublic: options?.isPublic ?? false,
          updatedBy: options?.updatedBy || null,
        });
      }

      this.cache.set(key, { value, timestamp: Date.now() });
      this.publicConfigCache = null;
    } catch (error) {
      console.error(`[SystemConfig] Failed to set config ${key}:`, error);
      throw error;
    }
  }

  async getAll(): Promise<Array<{
    key: string;
    value: string;
    description: string | null;
    isPublic: boolean;
    updatedAt: Date;
    updatedBy: string | null;
    createdAt: Date;
  }>> {
    try {
      const results = await db.select().from(systemConfig);
      return results;
    } catch (error) {
      console.error('[SystemConfig] Failed to get all configs:', error);
      return [];
    }
  }

  async getPublicConfig(): Promise<Record<string, string>> {
    if (this.publicConfigCache && Date.now() - this.publicConfigCache.timestamp < this.CACHE_TTL) {
      return this.publicConfigCache.data;
    }

    try {
      const results = await db.select()
        .from(systemConfig)
        .where(eq(systemConfig.isPublic, true));
      
      const config: Record<string, string> = {};
      for (const row of results) {
        config[row.key] = row.value;
      }
      
      this.publicConfigCache = { data: config, timestamp: Date.now() };
      return config;
    } catch (error) {
      console.error('[SystemConfig] Failed to get public config:', error);
      return {};
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await db.delete(systemConfig).where(eq(systemConfig.key, key));
      this.cache.delete(key);
      this.publicConfigCache = null;
      return true;
    } catch (error) {
      console.error(`[SystemConfig] Failed to delete config ${key}:`, error);
      return false;
    }
  }

  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    this.publicConfigCache = null;
  }

  async getAppUrl(): Promise<string> {
    const url = await this.get('APP_URL');
    return url || DEFAULT_CONFIGS.APP_URL.value;
  }
}

export const systemConfigService = new SystemConfigService();
