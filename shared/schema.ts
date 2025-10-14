import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =====================================================
// COMPANIES (Multi-tenant organizations)
// =====================================================

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  email: text("email").notNull(), // Company contact email
  phone: text("phone").notNull(), // Company phone number
  address: text("address").notNull(), // Company address
  domain: text("domain"), // Custom domain
  logo: text("logo"), // Logo URL
  website: text("website"),
  industry: text("industry"),
  companySize: text("company_size"), // e.g., "1-10", "11-50", "51-200", etc.
  timezone: text("timezone").default("UTC"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// COMPANY SETTINGS & CONFIGURATION
// =====================================================

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Branding
  primaryColor: text("primary_color").default("#2196F3"),
  secondaryColor: text("secondary_color").default("#1976D2"),
  
  // Features enabled/disabled
  features: jsonb("features").default({
    analytics: true,
    apiAccess: false,
    customBranding: false,
    sso: false,
  }),
  
  // Email settings
  emailSettings: jsonb("email_settings").default({
    fromName: "",
    fromEmail: "",
    replyToEmail: "",
  }),
  
  // Notification preferences
  notificationSettings: jsonb("notification_settings").default({
    emailNotifications: true,
    slackWebhook: "",
    webhookUrl: "",
  }),
  
  // Security settings
  securitySettings: jsonb("security_settings").default({
    passwordMinLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    sessionTimeout: 7200, // seconds
    twoFactorRequired: false,
  }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// SYSTEM FEATURES (Modular functionality)
// =====================================================

export const features = pgTable("features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // e.g., "Consentimientos", "Encuestas", "Reportes"
  key: text("key").notNull().unique(), // e.g., "consents", "surveys", "reports"
  description: text("description"),
  category: text("category"), // e.g., "compliance", "engagement", "analytics"
  icon: text("icon"), // Lucide icon name
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Many-to-many relationship: Companies <-> Features
export const companyFeatures = pgTable("company_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  featureId: varchar("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
  enabledAt: timestamp("enabled_at").notNull().defaultNow(),
  enabledBy: varchar("enabled_by").references(() => users.id, { onDelete: "set null" }), // Who enabled it
});

// =====================================================
// USERS
// =====================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"), // Nullable - set during account activation
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatar: text("avatar"),
  phone: text("phone"),
  
  // Role within the company
  role: text("role").notNull().default("member"), // superadmin, admin, member, viewer
  
  // Multi-tenant reference
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
  
  // User status
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  
  // Security
  lastLoginAt: timestamp("last_login_at"),
  passwordChangedAt: timestamp("password_changed_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// OTP CODES (Two-Factor Authentication)
// =====================================================

export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // 6-digit code
  method: text("method").notNull(), // "email" or "sms"
  expiresAt: timestamp("expires_at").notNull(), // Expires in 5 minutes
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// ACTIVATION TOKENS (Account Activation)
// =====================================================

export const activationTokens = pgTable("activation_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // Secure random token
  expiresAt: timestamp("expires_at").notNull(), // Expires in 7 days
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivationTokenSchema = createInsertSchema(activationTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertActivationToken = z.infer<typeof insertActivationTokenSchema>;
export type SelectActivationToken = typeof activationTokens.$inferSelect;

// =====================================================
// TRUSTED DEVICES (Remember this device)
// =====================================================

export const trustedDevices = pgTable("trusted_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceToken: text("device_token").notNull().unique(), // Secure random token stored in cookie
  deviceName: text("device_name"), // Browser/device info for user reference
  expiresAt: timestamp("expires_at").notNull(), // 30 days from creation
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTrustedDeviceSchema = createInsertSchema(trustedDevices).omit({
  id: true,
  createdAt: true,
});

export type InsertTrustedDevice = z.infer<typeof insertTrustedDeviceSchema>;
export type SelectTrustedDevice = typeof trustedDevices.$inferSelect;

// =====================================================
// BILLING PLANS
// =====================================================

export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Starter, Professional, Enterprise
  description: text("description"),
  stripePriceId: text("stripe_price_id").unique(), // Stripe Price ID
  
  // Pricing
  price: integer("price").notNull(), // in cents
  currency: text("currency").notNull().default("usd"),
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, yearly
  
  // Setup fee (one-time charge)
  setupFee: integer("setup_fee").notNull().default(0), // in cents
  
  // Trial period
  trialDays: integer("trial_days").notNull().default(0), // 0 = no trial, 7, 14, 30, etc.
  
  // Features & limits
  features: jsonb("features").default({
    maxUsers: 10,
    maxStorage: 10,
    apiAccess: false,
    customBranding: false,
    prioritySupport: false,
  }),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// SUBSCRIPTIONS & BILLING
// =====================================================

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").references(() => plans.id, { onDelete: "set null" }),
  
  // Subscription status
  status: text("status").notNull().default("active"), // active, trialing, past_due, cancelled, unpaid
  
  // Trial period
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  
  // Subscription period
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  
  // Stripe integration
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeLatestInvoiceId: text("stripe_latest_invoice_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
});

// =====================================================
// INVOICES
// =====================================================

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  
  // Invoice details
  invoiceNumber: text("invoice_number").notNull().unique(),
  status: text("status").notNull().default("draft"), // draft, open, paid, void, uncollectible
  
  // Amounts (in cents)
  subtotal: integer("subtotal").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull(),
  amountPaid: integer("amount_paid").notNull().default(0),
  amountDue: integer("amount_due").notNull(),
  currency: text("currency").notNull().default("usd"),
  
  // Dates
  invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  
  // Stripe integration
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  stripeHostedInvoiceUrl: text("stripe_hosted_invoice_url"),
  stripeInvoicePdf: text("stripe_invoice_pdf"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// INVOICE ITEMS
// =====================================================

export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  
  // Item details
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull(), // in cents
  amount: integer("amount").notNull(), // quantity * unitPrice (in cents)
  
  // Type of charge
  type: text("type").notNull().default("subscription"), // subscription, setup_fee, usage, credit
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// PAYMENTS
// =====================================================

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  
  // Payment details
  amount: integer("amount").notNull(), // in cents
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull(), // succeeded, pending, failed, refunded
  paymentMethod: text("payment_method"), // card, bank_transfer, etc.
  
  // Stripe integration
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeChargeId: text("stripe_charge_id"),
  
  // Payment metadata
  metadata: jsonb("metadata").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  failedAt: timestamp("failed_at"),
  refundedAt: timestamp("refunded_at"),
});

// =====================================================
// INVITATIONS
// =====================================================

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  invitedBy: varchar("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// ACTIVITY LOGS / AUDIT TRAIL
// =====================================================

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Activity details
  action: text("action").notNull(), // user_created, user_updated, settings_changed, etc.
  entity: text("entity").notNull(), // user, company, settings, etc.
  entityId: text("entity_id"),
  
  // Additional context
  metadata: jsonb("metadata").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// API KEYS
// =====================================================

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// NOTIFICATIONS
// =====================================================

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // info, success, warning, error, email
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  emailSent: boolean("email_sent").notNull().default(false),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// ZOD SCHEMAS FOR VALIDATION
// =====================================================

// Companies
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  domain: z.string().optional(),
  logo: z.string().url().optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "At least one field must be provided",
});

// Schema for creating a company with admin user
export const createCompanyWithAdminSchema = z.object({
  // Company data (email is taken from admin.email)
  company: z.object({
    name: z.string().min(1, "Company name is required"),
    slug: z.string().min(1, "Slug is required"),
    phone: z.string().min(1, "Phone is required"),
    address: z.string().min(1, "Address is required"),
  }),
  // Admin user data (password will be set during account activation)
  admin: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().optional(), // Optional phone number for 2FA
  }),
});

// Company Settings
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanySettingsSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  features: z.record(z.boolean()).optional(),
  emailSettings: z.record(z.string()).optional(),
  notificationSettings: z.record(z.any()).optional(),
  securitySettings: z.record(z.any()).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "At least one field must be provided",
});

// Features
export const insertFeatureSchema = createInsertSchema(features).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateFeatureSchema = z.object({
  name: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "At least one field must be provided",
});

// Company Features
export const insertCompanyFeatureSchema = createInsertSchema(companyFeatures).omit({
  id: true,
  enabledAt: true,
});

// Phone number validation (E.164 format: +[country code][number])
const phoneRegex = /^\+[1-9]\d{1,14}$/;

// Users
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  emailVerifiedAt: true,
}).extend({
  password: z.string().min(6).optional(), // Optional - set during activation
  role: z.enum(["superadmin", "admin", "member", "viewer"]),
  companyId: z.string().optional(),
  phone: z.string().regex(phoneRegex, "Phone must be in E.164 format (e.g., +14155552671)").optional().or(z.literal("")),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.string().url().optional(),
  phone: z.string().regex(phoneRegex, "Phone must be in E.164 format (e.g., +14155552671)").optional().or(z.literal("")),
  role: z.enum(["superadmin", "admin", "member", "viewer"]).optional(),
  companyId: z.string().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "At least one field must be provided",
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Plans
export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  stripePriceId: z.string().optional(),
  price: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  setupFee: z.number().int().min(0).optional(),
  trialDays: z.number().int().min(0).optional(),
  features: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "At least one field must be provided",
});

// Subscriptions
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
});

export const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  status: z.enum(["active", "trialing", "past_due", "cancelled", "unpaid"]).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "At least one field must be provided",
});

// Invoices
export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Invoice Items
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
  createdAt: true,
});

// Payments
export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  failedAt: true,
  refundedAt: true,
});

// Invitations
export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

// Activity Logs
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

// API Keys
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

// Notifications
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
  emailSentAt: true,
});

// OTP Codes
export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
  used: true,
  usedAt: true,
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Feature = typeof features.$inferSelect;
export type InsertFeature = z.infer<typeof insertFeatureSchema>;

export type CompanyFeature = typeof companyFeatures.$inferSelect;
export type InsertCompanyFeature = z.infer<typeof insertCompanyFeatureSchema>;

export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;

// =====================================================
// EMAIL TEMPLATES
// =====================================================

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Template name (e.g., "Welcome Email", "Password Reset")
  slug: text("slug").notNull().unique(), // URL-friendly identifier (e.g., "welcome", "password-reset")
  subject: text("subject").notNull(), // Email subject line
  htmlContent: text("html_content").notNull(), // HTML email content
  textContent: text("text_content"), // Plain text fallback
  variables: jsonb("variables").default([]), // Available variables like {{name}}, {{link}}, etc.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
