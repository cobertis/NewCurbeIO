import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer, unique } from "drizzle-orm/pg-core";
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
  address: text("address").notNull(), // Company address (street address)
  addressLine2: text("address_line_2"), // Suite, Apt, Unit, etc.
  domain: text("domain"), // Custom domain
  logo: text("logo"), // Logo URL
  website: text("website"),
  industry: text("industry"),
  companySize: text("company_size"), // e.g., "1-10", "11-50", "51-200", etc.
  timezone: text("timezone").default("UTC"),
  isActive: boolean("is_active").notNull().default(true),
  
  // Business Profile - General Information
  legalName: text("legal_name"), // Legal business name
  currency: text("currency").default("USD"), // Business currency
  apiKey: text("api_key"), // API key
  
  // Business Profile - Physical Address
  city: text("city"), // City
  state: text("state"), // State/Province/Region
  country: text("country").default("United States"), // Country
  postalCode: text("postal_code"), // Postal/Zip code
  platformLanguage: text("platform_language").default("English (United States)"), // Platform language
  outboundLanguage: text("outbound_language").default("Spanish (United States)"), // Outbound communication language
  
  // Business Profile - Business Information
  businessType: text("business_type"), // e.g., "Limited Liability Company Or Sole-Proprietorship"
  registrationIdType: text("registration_id_type"), // e.g., "USA: Employer Identification Number (EIN)"
  registrationNumber: text("registration_number"), // Business registration number
  isNotRegistered: boolean("is_not_registered").default(false), // Checkbox for not registered
  regionsOfOperation: text("regions_of_operation").array(), // Business regions
  
  // Business Profile - Authorized Representative
  representativeFirstName: text("representative_first_name"), // Authorized representative first name
  representativeLastName: text("representative_last_name"), // Authorized representative last name
  representativeEmail: text("representative_email"), // Representative email
  representativePosition: text("representative_position"), // Job position
  representativePhone: text("representative_phone"), // Representative phone
  
  // Stripe Billing Information
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID
  stripePaymentMethodId: text("stripe_payment_method_id"), // Stripe default payment method ID
  
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
  dateOfBirth: timestamp("date_of_birth"), // Date of birth
  preferredLanguage: text("preferred_language").default("en"), // Preferred language (en, es, etc.)
  timezone: text("timezone").default("America/New_York"), // User's timezone preference
  address: text("address"), // Office address
  
  // Role within the company
  role: text("role").notNull().default("member"), // superadmin, admin, member, viewer
  
  // Multi-tenant reference
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
  
  // User status
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  
  // Email marketing subscription
  emailSubscribed: boolean("email_subscribed").notNull().default(true), // Subscribed to marketing emails
  
  // SMS marketing subscription
  smsSubscribed: boolean("sms_subscribed").notNull().default(true), // Subscribed to marketing SMS
  
  // Email preferences
  emailNotifications: boolean("email_notifications").notNull().default(true), // General email notifications
  invoiceAlerts: boolean("invoice_alerts").notNull().default(true), // Invoice notification emails
  
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
  
  // Stripe Integration
  stripeProductId: text("stripe_product_id").unique(), // Stripe Product ID
  stripePriceId: text("stripe_price_id").unique(), // Stripe Price ID for monthly recurring charge
  stripeAnnualPriceId: text("stripe_annual_price_id"), // Stripe Price ID for annual recurring charge
  stripeSetupFeePriceId: text("stripe_setup_fee_price_id"), // Stripe Price ID for one-time setup fee
  
  // Pricing
  price: integer("price").notNull(), // in cents (monthly price)
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
// BILLING ADDRESSES
// =====================================================

export const billingAddresses = pgTable("billing_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
  
  // Billing contact information
  fullName: text("full_name").notNull(),
  
  // Address details
  country: text("country").notNull(),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBillingAddressSchema = createInsertSchema(billingAddresses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BillingAddress = typeof billingAddresses.$inferSelect;
export type InsertBillingAddress = z.infer<typeof insertBillingAddressSchema>;

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
  broadcastId: varchar("broadcast_id"), // Link to broadcast_notifications for tracking read stats
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// BROADCAST NOTIFICATIONS (History)
// =====================================================

export const broadcastNotifications = pgTable("broadcast_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // info, success, warning, error
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  sentBy: varchar("sent_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  totalRecipients: integer("total_recipients").notNull().default(0),
  totalRead: integer("total_read").notNull().default(0),
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
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
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
    website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    address: z.string().min(1, "Address is required"),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().default("United States"),
  }),
  // Admin user data (password will be set during account activation)
  admin: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(1, "Phone number is required for 2FA"), // Required for OTP/2FA
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
  dateOfBirth: z.string().optional().or(z.literal("")), // Accept string from frontend
  emailSubscribed: z.boolean().optional().default(true), // Default to true for marketing emails
  smsSubscribed: z.boolean().optional().default(true), // Default to true for marketing SMS
  emailNotifications: z.boolean().optional().default(true), // Default to true for notifications
  invoiceAlerts: z.boolean().optional().default(true), // Default to true for invoice alerts
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.union([
    z.string().url(),
    z.string().regex(/^data:image\/(png|jpg|jpeg|gif|webp);base64,/, "Avatar must be a valid URL or base64 image"),
    z.literal(""),
    z.null()
  ]).optional(),
  phone: z.string().regex(phoneRegex, "Phone must be in E.164 format (e.g., +14155552671)").optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  preferredLanguage: z.string().optional(),
  timezone: z.string().optional(),
  address: z.string().optional(),
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

export const insertBroadcastNotificationSchema = createInsertSchema(broadcastNotifications).omit({
  id: true,
  createdAt: true,
});

export type BroadcastNotification = typeof broadcastNotifications.$inferSelect;
export type InsertBroadcastNotification = z.infer<typeof insertBroadcastNotificationSchema>;

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

// =====================================================
// CONTACT LISTS (for segmentation)
// =====================================================

export const contactLists = pgTable("contact_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contactListSchema = createInsertSchema(contactLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContactList = typeof contactLists.$inferSelect;
export type InsertContactList = z.infer<typeof contactListSchema>;

// Contact List Members (many-to-many relationship)
export const contactListMembers = pgTable("contact_list_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => contactLists.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
  uniqueListUser: unique().on(table.listId, table.userId),
}));

export const contactListMemberSchema = createInsertSchema(contactListMembers).omit({
  id: true,
  addedAt: true,
});

export type ContactListMember = typeof contactListMembers.$inferSelect;
export type InsertContactListMember = z.infer<typeof contactListMemberSchema>;

// =====================================================
// EMAIL CAMPAIGNS
// =====================================================

export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(), // Email subject
  htmlContent: text("html_content").notNull(), // HTML email content
  textContent: text("text_content"), // Plain text fallback
  status: text("status").notNull().default("draft"), // draft, sending, sent, failed
  targetListId: varchar("target_list_id").references(() => contactLists.id, { onDelete: "set null" }), // Optional: send to specific list
  sentAt: timestamp("sent_at"), // When the campaign was sent
  sentBy: varchar("sent_by").references(() => users.id, { onDelete: "set null" }), // Who sent it
  recipientCount: integer("recipient_count").default(0), // Number of recipients
  openCount: integer("open_count").default(0), // Total opens (including multiple from same user)
  uniqueOpenCount: integer("unique_open_count").default(0), // Unique users who opened
  clickCount: integer("click_count").default(0), // Total clicks
  uniqueClickCount: integer("unique_click_count").default(0), // Unique users who clicked
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

// =====================================================
// CAMPAIGN EMAILS - Individual Email Tracking
// =====================================================

export const campaignEmails = pgTable("campaign_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(), // Email address at time of sending
  status: text("status").notNull().default("sent"), // sent, delivered, opened, clicked, bounced, failed, unsubscribed
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  errorMessage: text("error_message"), // Error details if status is 'failed' or 'bounced'
});

export const insertCampaignEmailSchema = createInsertSchema(campaignEmails).omit({
  id: true,
  sentAt: true,
});

export type CampaignEmail = typeof campaignEmails.$inferSelect;
export type InsertCampaignEmail = z.infer<typeof insertCampaignEmailSchema>;

// =====================================================
// EMAIL TRACKING - Opens and Clicks
// =====================================================

export const emailOpens = pgTable("email_opens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userAgent: text("user_agent"), // Browser/email client info
  ipAddress: text("ip_address"), // For geographic tracking
  openedAt: timestamp("opened_at").notNull().defaultNow(),
});

export const emailOpenSchema = createInsertSchema(emailOpens).omit({
  id: true,
  openedAt: true,
});

export type EmailOpen = typeof emailOpens.$inferSelect;
export type InsertEmailOpen = z.infer<typeof emailOpenSchema>;

export const linkClicks = pgTable("link_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(), // The original destination URL
  userAgent: text("user_agent"), // Browser info
  ipAddress: text("ip_address"), // For geographic tracking
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
});

export const linkClickSchema = createInsertSchema(linkClicks).omit({
  id: true,
  clickedAt: true,
});

export type LinkClick = typeof linkClicks.$inferSelect;
export type InsertLinkClick = z.infer<typeof linkClickSchema>;

export const campaignUnsubscribes = pgTable("campaign_unsubscribes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => emailCampaigns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  unsubscribedAt: timestamp("unsubscribed_at").notNull().defaultNow(),
}, (table) => ({
  uniqueCampaignUser: unique().on(table.campaignId, table.userId),
}));

export const campaignUnsubscribeSchema = createInsertSchema(campaignUnsubscribes).omit({
  id: true,
  unsubscribedAt: true,
});

export type CampaignUnsubscribe = typeof campaignUnsubscribes.$inferSelect;
export type InsertCampaignUnsubscribe = z.infer<typeof campaignUnsubscribeSchema>;

// =====================================================
// SMS CAMPAIGNS
// =====================================================

export const smsCampaigns = pgTable("sms_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  message: text("message").notNull(), // SMS message content (max 1600 characters for long SMS)
  status: text("status").notNull().default("draft"), // draft, sending, sent, failed
  targetListId: varchar("target_list_id").references(() => contactLists.id, { onDelete: "set null" }), // Optional: specific contact list
  sentAt: timestamp("sent_at"),
  sentBy: varchar("sent_by").references(() => users.id, { onDelete: "set null" }),
  recipientCount: integer("recipient_count"), // Total recipients
  deliveredCount: integer("delivered_count").default(0), // Successfully delivered
  failedCount: integer("failed_count").default(0), // Failed deliveries
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSmsCampaignSchema = createInsertSchema(smsCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SmsCampaign = typeof smsCampaigns.$inferSelect;
export type InsertSmsCampaign = z.infer<typeof insertSmsCampaignSchema>;

// =====================================================
// CAMPAIGN SMS MESSAGES - Individual SMS Tracking
// =====================================================

export const campaignSmsMessages = pgTable("campaign_sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => smsCampaigns.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(), // Phone number at time of sending
  status: text("status").notNull().default("sent"), // sent, delivered, failed
  twilioMessageSid: text("twilio_message_sid"), // Twilio Message SID for tracking
  errorCode: text("error_code"), // Error code if failed
  errorMessage: text("error_message"), // Error message if failed
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
});

export const campaignSmsMessageSchema = createInsertSchema(campaignSmsMessages).omit({
  id: true,
  sentAt: true,
  deliveredAt: true,
  failedAt: true,
});

export type CampaignSmsMessage = typeof campaignSmsMessages.$inferSelect;
export type InsertCampaignSmsMessage = z.infer<typeof campaignSmsMessageSchema>;

// =====================================================
// INCOMING SMS MESSAGES - User Replies
// =====================================================

export const incomingSmsMessages = pgTable("incoming_sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  twilioMessageSid: text("twilio_message_sid").notNull().unique(), // Twilio Message SID
  fromPhone: text("from_phone").notNull(), // Sender phone number
  toPhone: text("to_phone").notNull(), // Our Twilio number
  messageBody: text("message_body").notNull(), // Message content
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // Matched user if found
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }), // Multi-tenant reference
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false), // Mark as read/unread
});

export const insertIncomingSmsMessageSchema = createInsertSchema(incomingSmsMessages).omit({
  id: true,
  receivedAt: true,
});

export type IncomingSmsMessage = typeof incomingSmsMessages.$inferSelect;
export type InsertIncomingSmsMessage = z.infer<typeof insertIncomingSmsMessageSchema>;

// Outgoing SMS Messages (Manual Replies)
export const outgoingSmsMessages = pgTable("outgoing_sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  twilioMessageSid: text("twilio_message_sid").unique(), // Twilio Message SID
  toPhone: text("to_phone").notNull(), // Recipient phone number
  fromPhone: text("from_phone").notNull(), // Our Twilio number
  messageBody: text("message_body").notNull(), // Message content
  status: text("status").notNull().default("sending"), // sending, sent, delivered, failed
  sentBy: varchar("sent_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Who sent it
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // Recipient user if matched
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }), // Multi-tenant reference
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  errorCode: text("error_code"), // Twilio error code if failed
  errorMessage: text("error_message"), // Error details if failed
});

export const insertOutgoingSmsMessageSchema = createInsertSchema(outgoingSmsMessages).omit({
  id: true,
  sentAt: true,
});

export type OutgoingSmsMessage = typeof outgoingSmsMessages.$inferSelect;
export type InsertOutgoingSmsMessage = z.infer<typeof insertOutgoingSmsMessageSchema>;

// =====================================================
// SMS CHAT NOTES (Internal notes for SMS conversations)
// =====================================================

export const smsChatNotes = pgTable("sms_chat_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(), // The phone number this note is about
  note: text("note").notNull(), // The actual note content
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), // Multi-tenant reference
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Who created the note
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSmsChatNoteSchema = createInsertSchema(smsChatNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SmsChatNote = typeof smsChatNotes.$inferSelect;
export type InsertSmsChatNote = z.infer<typeof insertSmsChatNoteSchema>;
