import type { Request } from "express";
import type { IStorage } from "./storage";
import type { InsertActivityLog } from "@shared/schema";

/**
 * Get detailed geolocation data from IP address using ip-api.com
 */
async function getGeoLocationData(ip: string | null): Promise<Record<string, any>> {
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      country: 'Local',
      countryCode: 'LOCAL',
      region: 'N/A',
      regionName: 'N/A',
      city: 'Localhost',
      zip: 'N/A',
      lat: 0,
      lon: 0,
      timezone: 'UTC',
      isp: 'Local Network',
      org: 'Local',
      as: 'N/A',
      query: ip || 'unknown'
    };
  }

  try {
    // Use ip-api.com (free, no API key required)
    // Fields: country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Curbe-Admin/1.0'
      }
    });

    if (!response.ok) {
      console.warn(`[GEOLOCATION] Failed to fetch data for IP ${ip}: ${response.status}`);
      return { query: ip };
    }

    const data = await response.json();
    
    if (data.status === 'fail') {
      console.warn(`[GEOLOCATION] IP lookup failed for ${ip}: ${data.message}`);
      return { query: ip, error: data.message };
    }

    return data;
  } catch (error) {
    console.error(`[GEOLOCATION] Error fetching geolocation for IP ${ip}:`, error);
    return { query: ip };
  }
}

/**
 * Centralized logging service for audit trail
 * Logs all actions performed in the system
 */
export class LoggingService {
  constructor(private storage: IStorage) {}

  /**
   * Log an activity with automatic extraction of request context
   */
  async log(params: {
    req: Request;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, any>;
    companyId?: string;
  }): Promise<void> {
    try {
      const { req, action, entity, entityId, metadata, companyId } = params;
      
      // Extract user ID from session
      const userId = req.session.userId || null;
      
      // Extract IP and User Agent
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || req.connection.remoteAddress || null;
      const userAgent = req.get("user-agent") || null;

      // Get detailed geolocation data
      const geoData = await getGeoLocationData(ipAddress);

      const logEntry: InsertActivityLog = {
        companyId: companyId || null,
        userId,
        action,
        entity,
        entityId: entityId || null,
        metadata: {
          ...metadata,
          ...geoData
        },
        ipAddress,
        userAgent,
      };

      await this.storage.createActivityLog(logEntry);
    } catch (error) {
      // Don't throw errors from logging - just log them
      console.error("Failed to create activity log:", error);
    }
  }

  /**
   * Log authentication events (login, logout, OTP)
   */
  async logAuth(params: {
    req: Request;
    action: 
      | "login" 
      | "logout" 
      | "login_failed" 
      | "login_no_2fa"
      | "login_credentials_verified"
      | "login_trusted_device"
      | "otp_sent" 
      | "otp_send_failed" 
      | "otp_verify_failed" 
      | "login_with_otp"
      | "otp_resent"
      | "account_activated"
      | "password_reset_requested"
      | "password_reset_completed"
      | "pii_reveal";
    userId?: string;
    email: string;
    companyId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      req: params.req,
      action: `auth_${params.action}`,
      entity: "authentication",
      entityId: params.userId,
      companyId: params.companyId,
      metadata: {
        email: params.email,
        ...params.metadata,
      },
    });
  }

  /**
   * Log CRUD operations
   */
  async logCrud(params: {
    req: Request;
    operation: "create" | "read" | "update" | "delete";
    entity: string;
    entityId?: string;
    companyId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { req, operation, entity, entityId, companyId, metadata } = params;
    
    await this.log({
      req,
      action: `${entity}_${operation}`,
      entity,
      entityId,
      companyId,
      metadata,
    });
  }

  /**
   * Log configuration changes
   */
  async logConfigChange(params: {
    req: Request;
    configType: string;
    companyId?: string;
    changes: Record<string, any>;
  }): Promise<void> {
    await this.log({
      req: params.req,
      action: `config_change_${params.configType}`,
      entity: "configuration",
      companyId: params.companyId,
      metadata: {
        changes: params.changes,
      },
    });
  }

  /**
   * Log email sending events
   */
  async logEmail(params: {
    req: Request;
    action: "sent" | "failed";
    recipient: string;
    templateSlug?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      req: params.req,
      action: `email_${params.action}`,
      entity: "email",
      metadata: {
        recipient: params.recipient,
        templateSlug: params.templateSlug,
        ...params.metadata,
      },
    });
  }

  /**
   * Log payment/subscription events
   */
  async logPayment(params: {
    req: Request;
    action: string;
    entityId: string;
    companyId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      req: params.req,
      action: `payment_${params.action}`,
      entity: "payment",
      entityId: params.entityId,
      companyId: params.companyId,
      metadata: params.metadata,
    });
  }
}
