import "express-session";
import type { User } from "@shared/schema";

// Session user interface with all properties used in routes
export interface SessionUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  companyId: string | null;
  isActive: boolean;
  emailVerified: boolean;
  twoFactorEmailEnabled: boolean;
  twoFactorSmsEnabled: boolean;
  phone?: string | null;
  avatar?: string | null;
  dateOfBirth?: Date | null;
  preferredLanguage?: string | null;
  timezone?: string | null;
  status: string;
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    user?: SessionUser; // Add typed user to session
    pendingUserId?: string;
    deviceInfo?: string;
    ipAddress?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Audit log action types
export type AuditAction = 
  // Auth actions
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
  | "pii_reveal"
  // Subscription actions
  | "subscription_updated"
  | "subscription_created"
  | "plan_selected"
  // Payment actions
  | "set_default"
  // Task actions
  | "completed"
  | "snoozed"
  // Quote/Policy actions
  | "select_plan"
  | "submit_quote_as_policy"
  | "update_statuses"
  | "sent"
  | "set_primary"
  // Sync actions
  | "sync"
  // View actions (add missing ones)
  | "view_quotes"
  | "view_quote"
  | "view_quote_detail"
  | "view_quote_members"
  | "view_quote_member"
  | "view_immigration"
  | "view_payment_methods"
  | "view_payment_method"
  | "view_applicant_policies"
  | "view_policys"
  | "view_policy"
  | "view_policy_detail"
  | "view_policy_members"
  | "view_policy_member";
