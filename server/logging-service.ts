import type { Request } from "express";
import type { IStorage } from "./storage";
import type { InsertActivityLog } from "@shared/schema";

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
      const ipAddress = req.ip || req.connection.remoteAddress || null;
      const userAgent = req.get("user-agent") || null;

      const logEntry: InsertActivityLog = {
        companyId: companyId || null,
        userId,
        action,
        entity,
        entityId: entityId || null,
        metadata: metadata || {},
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
      | "login_credentials_verified"
      | "login_trusted_device"
      | "otp_sent" 
      | "otp_send_failed" 
      | "otp_verify_failed" 
      | "login_with_otp"
      | "otp_resent"
      | "account_activated";
    userId?: string;
    email: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      req: params.req,
      action: `auth_${params.action}`,
      entity: "authentication",
      entityId: params.userId,
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
