import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, boolean, jsonb, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { validateCardNumber, validateCVV, validateExpirationDate } from './creditCardUtils';

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
  businessCategory: text("business_category"), // Main business category (e.g., "Healthcare", "Technology")
  businessNiche: text("business_niche"), // Specific business niche within category
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
  dateOfBirth: date("date_of_birth"), // Date of birth (yyyy-MM-dd)
  preferredLanguage: text("preferred_language").default("en"), // Preferred language (en, es, etc.)
  timezone: text("timezone").default("America/New_York"), // User's timezone preference
  address: text("address"), // Office address
  
  // Insurance Profile Information
  agentInternalCode: text("agent_internal_code"), // Agent internal code assigned by agency
  instructionLevel: text("instruction_level"), // Licensed insurance agent, etc.
  nationalProducerNumber: text("national_producer_number"), // NPN
  federallyFacilitatedMarketplace: text("federally_facilitated_marketplace"), // FFM
  referredBy: text("referred_by"), // Referred by
  
  // Role within the company
  role: text("role").notNull().default("member"), // superadmin, admin, member, viewer
  
  // Multi-tenant reference
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
  
  // User status
  status: text("status").notNull().default("active"), // 'pending_activation', 'active', 'deactivated'
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
  twoFactorEmailEnabled: boolean("two_factor_email_enabled").notNull().default(true), // Email 2FA enabled by default
  twoFactorSmsEnabled: boolean("two_factor_sms_enabled").notNull().default(true), // SMS 2FA enabled by default
  
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
// PASSWORD RESET TOKENS (Password Reset)
// =====================================================

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // Secure random token
  expiresAt: timestamp("expires_at").notNull(), // Expires in 1 hour
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type SelectPasswordResetToken = typeof passwordResetTokens.$inferSelect;

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
  annualPrice: integer("annual_price"), // in cents (annual price if available)
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
  companyId: varchar("company_id").notNull().unique().references(() => companies.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").references(() => plans.id, { onDelete: "set null" }),
  
  // Subscription status
  status: text("status").notNull().default("active"), // active, trialing, past_due, cancelled, unpaid
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, yearly - what the customer selected
  
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
// SUBSCRIPTION DISCOUNTS
// =====================================================

export const subscriptionDiscounts = pgTable("subscription_discounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Stripe integration
  stripeCouponId: text("stripe_coupon_id"),
  stripePromotionCode: text("stripe_promotion_code"),
  
  // Discount details
  discountPercentage: integer("discount_percentage").notNull(), // e.g., 20 for 20% off
  discountMonths: integer("discount_months").notNull(), // Number of months the discount applies
  discountEndDate: timestamp("discount_end_date").notNull(),
  
  // Tracking
  appliedBy: varchar("applied_by").references(() => users.id),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  status: text("status").notNull().default("active"), // active, expired
  
  // Additional data
  metadata: jsonb("metadata").default({}),
});

export const insertSubscriptionDiscountSchema = createInsertSchema(subscriptionDiscounts).omit({
  id: true,
  appliedAt: true,
});

export type SubscriptionDiscount = typeof subscriptionDiscounts.$inferSelect;
export type InsertSubscriptionDiscount = z.infer<typeof insertSubscriptionDiscountSchema>;

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
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  domain: z.string().optional(),
  logo: z.union([z.string().url(), z.null()]).optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  legalName: z.string().optional(),
  currency: z.string().optional(),
  platformLanguage: z.string().optional(),
  outboundLanguage: z.string().optional(),
  businessType: z.string().optional(),
  businessCategory: z.string().optional(),
  businessNiche: z.string().optional(),
  registrationIdType: z.string().optional(),
  registrationNumber: z.string().optional(),
  isNotRegistered: z.boolean().optional(),
  regionsOfOperation: z.array(z.string()).optional(),
  representativeFirstName: z.string().optional(),
  representativeLastName: z.string().optional(),
  representativeEmail: z.string().email().optional().or(z.literal("")),
  representativePosition: z.string().optional(),
  representativePhone: z.string().optional(),
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
    addressLine2: z.string().optional(),
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
  status: z.enum(["pending_activation", "active", "deactivated"]).optional(),
  agentInternalCode: z.string().optional(),
  instructionLevel: z.string().optional(),
  nationalProducerNumber: z.string().regex(/^\d{6,10}$/, "NPN must be 6-10 digits").optional().or(z.literal("")),
  federallyFacilitatedMarketplace: z.string().optional(),
  referredBy: z.string().optional(),
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

// =====================================================
// QUOTE NOTES (Internal notes for insurance quotes)
// =====================================================

export const quoteNotes = pgTable("quote_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }), // The quote this note is about
  note: text("note").notNull(), // The actual note content
  attachments: text("attachments").array(), // Array of image URLs/paths attached to this note
  isImportant: boolean("is_important").notNull().default(false), // Whether this is an important note (shown with red border)
  isPinned: boolean("is_pinned").notNull().default(false), // Whether this note is pinned to the top
  isResolved: boolean("is_resolved").notNull().default(false), // Whether this note is resolved/completed
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), // Multi-tenant reference
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Who created the note
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuoteNoteSchema = createInsertSchema(quoteNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type QuoteNote = typeof quoteNotes.$inferSelect;
export type InsertQuoteNote = z.infer<typeof insertQuoteNoteSchema>;

// =====================================================
// QUOTE DOCUMENTS (Document management for insurance quotes)
// =====================================================

export const quoteDocuments = pgTable("quote_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }), // The quote this document belongs to
  fileName: text("file_name").notNull(), // Original file name
  fileUrl: text("file_url").notNull(), // Path/URL to the uploaded file
  fileType: text("file_type").notNull(), // MIME type (e.g., application/pdf, image/jpeg)
  fileSize: integer("file_size").notNull(), // File size in bytes
  category: text("category").notNull().default("other"), // Document category: passport, drivers_license, state_id, birth_certificate, parole, permanent_residence, work_permit, i94, other
  description: text("description"), // Optional description of the document
  belongsTo: varchar("belongs_to").references(() => quoteMembers.id, { onDelete: "cascade" }), // Optional: Which family member this document belongs to
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }), // Multi-tenant reference
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }), // Who uploaded the document
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuoteDocumentSchema = createInsertSchema(quoteDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type QuoteDocument = typeof quoteDocuments.$inferSelect;
export type InsertQuoteDocument = z.infer<typeof insertQuoteDocumentSchema>;

// =====================================================
// FINANCIAL SUPPORT TICKETS
// =====================================================

export const financialSupportTickets = pgTable("financial_support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Ticket information
  situation: text("situation").notNull(), // User's financial situation explanation
  proposedSolution: text("proposed_solution").notNull(), // User's proposed solution
  status: text("status").notNull().default("pending"), // pending, under_review, approved, rejected, closed
  
  // Response from support team
  adminResponse: text("admin_response"), // Response from admin
  respondedBy: varchar("responded_by").references(() => users.id, { onDelete: "set null" }), // Admin who responded
  respondedAt: timestamp("responded_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialSupportTicketSchema = createInsertSchema(financialSupportTickets).omit({
  id: true,
  status: true,
  adminResponse: true,
  respondedBy: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type FinancialSupportTicket = typeof financialSupportTickets.$inferSelect;
export type InsertFinancialSupportTicket = z.infer<typeof insertFinancialSupportTicketSchema>;

// =====================================================
// QUOTES (Insurance Quote Management)
// =====================================================

export const quotes = pgTable("quotes", {
  id: varchar("id", { length: 8 }).primaryKey(), // Short 8-character unique identifier
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }), // User who created the quote
  
  // Step 1: Policy Information
  effectiveDate: date("effective_date").notNull(), // Policy effective date (yyyy-MM-dd)
  agentId: varchar("agent_id").references(() => users.id, { onDelete: "set null" }), // Agent on record for this client
  productType: text("product_type").notNull(), // medicare, medicaid, aca, life, private, dental, vision, supplemental, annuities, final_expense, travel
  
  // Step 2: Personal Information (Client)
  clientFirstName: text("client_first_name").notNull(),
  clientMiddleName: text("client_middle_name"),
  clientLastName: text("client_last_name").notNull(),
  clientSecondLastName: text("client_second_last_name"),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientDateOfBirth: date("client_date_of_birth"), // Date of birth (yyyy-MM-dd)
  clientGender: text("client_gender"), // male, female, other
  clientIsApplicant: boolean("client_is_applicant").default(false),
  clientTobaccoUser: boolean("client_tobacco_user").default(false),
  clientPregnant: boolean("client_pregnant").default(false),
  clientSsn: text("client_ssn"), // Encrypted/masked SSN
  clientPreferredLanguage: text("client_preferred_language"), // English, Spanish, etc.
  clientCountryOfBirth: text("client_country_of_birth"), // Country of birth
  clientMaritalStatus: text("client_marital_status"), // single, married, divorced, widowed
  clientWeight: text("client_weight"), // Weight in lbs
  clientHeight: text("client_height"), // Height in feet and inches (e.g., "5'10")
  
  // Step 3: Family Group
  annualHouseholdIncome: text("annual_household_income"), // Stored as text to handle currency formatting
  familyGroupSize: integer("family_group_size"),
  spouses: jsonb("spouses").default([]), // Array of spouse objects
  dependents: jsonb("dependents").default([]), // Array of dependent objects
  
  // Step 4: Addresses
  // Physical Address (Optional - often same as mailing)
  physical_street: text("physical_street"),
  physical_address_line_2: text("physical_address_line_2"), // Apt, Suite, Unit, etc.
  physical_city: text("physical_city"),
  physical_state: text("physical_state"),
  physical_postal_code: text("physical_postal_code"),
  physical_county: text("physical_county"),
  
  // Mailing Address (Optional)
  mailing_street: text("mailing_street"),
  mailing_address_line_2: text("mailing_address_line_2"),
  mailing_city: text("mailing_city"),
  mailing_state: text("mailing_state"),
  mailing_postal_code: text("mailing_postal_code"),
  mailing_county: text("mailing_county"),
  
  // Billing Address (Optional)
  billing_street: text("billing_street"),
  billing_address_line_2: text("billing_address_line_2"),
  billing_city: text("billing_city"),
  billing_state: text("billing_state"),
  billing_postal_code: text("billing_postal_code"),
  billing_county: text("billing_county"),
  
  // Shared field for all addresses
  country: text("country").notNull().default("United States"),
  
  // Quote Status
  status: text("status").notNull().default("draft"), // draft, submitted, pending_review, approved, rejected, converted_to_policy
  
  // Additional Information
  notes: text("notes"), // Internal notes
  estimatedPremium: text("estimated_premium"), // Estimated premium amount
  
  // Selected Plan from Marketplace
  selectedPlan: jsonb("selected_plan"), // Complete plan object selected from marketplace
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Spouse validation schema for quotes
export const spouseSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  secondLastName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"), // Date as string (yyyy-MM-dd)
  ssn: z.string().min(1, "SSN is required"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  isApplicant: z.boolean().default(false),
  isPrimaryDependent: z.boolean().default(false),
  tobaccoUser: z.boolean().default(false),
  pregnant: z.boolean().default(false),
  preferredLanguage: z.string().optional(),
  countryOfBirth: z.string().optional(),
  maritalStatus: z.string().optional(), // single, married, divorced, widowed
  weight: z.string().optional(), // Weight in lbs
  height: z.string().optional(), // Height in feet (e.g., "5'10")
});

// Dependent validation schema for quotes
export const dependentSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  secondLastName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"), // Date as string (yyyy-MM-dd)
  ssn: z.string().min(1, "SSN is required"),
  gender: z.enum(["male", "female", "other"]),
  relation: z.enum(["child", "parent", "sibling", "other"]),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  isApplicant: z.boolean().default(false),
  isPrimaryDependent: z.boolean().default(false),
  tobaccoUser: z.boolean().default(false),
  pregnant: z.boolean().default(false),
  preferredLanguage: z.string().optional(),
  countryOfBirth: z.string().optional(),
  maritalStatus: z.string().optional(), // single, married, divorced, widowed
  weight: z.string().optional(), // Weight in lbs
  height: z.string().optional(), // Height in feet (e.g., "5'10")
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Override date fields to accept yyyy-MM-dd strings instead of Date objects
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  clientDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format").optional(),
  // Override spouses and dependents to use proper validation
  spouses: z.array(spouseSchema).optional(),
  dependents: z.array(dependentSchema).optional(),
});

// Update schema for PATCH requests - all fields optional but validated if provided
export const updateQuoteSchema = insertQuoteSchema.partial().omit({
  companyId: true,
  createdBy: true,
});

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

// =====================================================
// QUOTE MEMBERS (Normalized member data)
// =====================================================

export const quoteMembers = pgTable("quote_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  quoteId: varchar("quote_id", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }),
  
  // Member role and identification
  role: text("role").notNull(), // client, spouse, dependent
  
  // Personal Information
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  secondLastName: text("second_last_name"),
  dateOfBirth: date("date_of_birth"), // Date of birth (yyyy-MM-dd)
  ssn: text("ssn"), // Encrypted SSN
  gender: text("gender"), // male, female, other
  phone: text("phone"),
  email: text("email"),
  
  // Additional Information
  isApplicant: boolean("is_applicant").default(false),
  isPrimaryDependent: boolean("is_primary_dependent").default(false), // Dependent of primary policyholder
  tobaccoUser: boolean("tobacco_user").default(false),
  pregnant: boolean("pregnant").default(false),
  preferredLanguage: text("preferred_language"),
  countryOfBirth: text("country_of_birth"),
  maritalStatus: text("marital_status"), // single, married, divorced, widowed
  weight: text("weight"), // Weight in lbs
  height: text("height"), // Height in feet and inches
  
  // For dependents only
  relation: text("relation"), // child, parent, sibling, other (only for dependents)
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// QUOTE MEMBER INCOME (Income information)
// =====================================================

export const quoteMemberIncome = pgTable("quote_member_income", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => quoteMembers.id, { onDelete: "cascade" }).unique(),
  
  // Employment Information
  employmentStatus: text("employment_status"), // employed, self_employed, unemployed, retired, student, disabled
  employerName: text("employer_name"),
  jobTitle: text("job_title"),
  position: text("position"), // Job position/title (alias for jobTitle)
  employerPhone: text("employer_phone"), // Employer contact phone
  selfEmployed: boolean("self_employed").default(false), // Self-employed flag
  yearsEmployed: integer("years_employed"),
  
  // Income Details
  annualIncome: text("annual_income"), // Encrypted - stored as text (value entered by user according to frequency)
  incomeFrequency: text("income_frequency"), // annually, monthly, weekly, biweekly
  totalAnnualIncome: text("total_annual_income"), // Encrypted - calculated annual total for summing
  
  // Additional Income
  hasAdditionalIncome: boolean("has_additional_income").default(false),
  additionalIncomeSources: jsonb("additional_income_sources").default([]), // [{ type: 'rental', amount: '1000' }, ...]
  
  // Tax Information
  taxFilingStatus: text("tax_filing_status"), // single, married_filing_jointly, married_filing_separately, head_of_household
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// QUOTE MEMBER IMMIGRATION (Immigration status)
// =====================================================

export const quoteMemberImmigration = pgTable("quote_member_immigration", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => quoteMembers.id, { onDelete: "cascade" }).unique(),
  
  // Citizenship Information
  citizenshipStatus: text("citizenship_status"), // us_citizen, permanent_resident, visa_holder, refugee, asylum_seeker, undocumented
  immigrationStatus: text("immigration_status"), // asylum, citizen, humanitarian_parole, resident, temporary_protected_status, work_authorization, other
  immigrationStatusCategory: text("immigration_status_category"), // I-94, Parole, etc.
  
  // Visa/Green Card Information
  visaType: text("visa_type"), // H1B, F1, J1, L1, O1, etc. (only if visa_holder)
  visaNumber: text("visa_number"), // Encrypted
  greenCardNumber: text("green_card_number"), // Encrypted
  
  // Entry and Status
  entryDate: timestamp("entry_date"), // Date of entry to US
  visaExpirationDate: timestamp("visa_expiration_date"),
  
  // Work Authorization
  hasWorkAuthorization: boolean("has_work_authorization").default(false),
  workAuthorizationType: text("work_authorization_type"), // EAD, visa_based, citizen, etc.
  workAuthorizationExpiration: timestamp("work_authorization_expiration"),
  
  // Document Numbers
  i94Number: text("i94_number"), // Encrypted
  uscisNumber: text("uscis_number"), // Encrypted - USCIS/Alien Registration Number
  naturalizationNumber: text("naturalization_number"), // Encrypted - Naturalization Certificate Number
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// QUOTE MEMBER DOCUMENTS (Document uploads)
// =====================================================

export const quoteMemberDocuments = pgTable("quote_member_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => quoteMembers.id, { onDelete: "cascade" }),
  
  // Document Information
  documentType: text("document_type").notNull(), // passport, visa, work_permit, green_card, tax_return, pay_stub, proof_of_residence, birth_certificate, other
  documentName: text("document_name").notNull(), // Original filename
  documentPath: text("document_path").notNull(), // Relative path to file on disk
  
  // File Metadata
  fileType: text("file_type").notNull(), // MIME type (e.g., application/pdf, image/jpeg)
  fileSize: integer("file_size").notNull(), // File size in bytes
  
  // Optional Description
  description: text("description"),
  
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// QUOTE PAYMENT METHODS (Credit cards and bank accounts)
// =====================================================

export const quotePaymentMethods = pgTable("quote_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  quoteId: varchar("quote_id", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }),
  
  // Payment Method Type
  paymentType: text("payment_type").notNull(), // 'card' or 'bank_account'
  
  // Credit/Debit Card Fields (PLAIN TEXT - no encryption per user requirement)
  cardNumber: text("card_number"), // Full card number in plain text
  cardHolderName: text("card_holder_name"),
  expirationMonth: text("expiration_month"), // MM
  expirationYear: text("expiration_year"), // YYYY
  cvv: text("cvv"), // CVV in plain text
  billingZip: text("billing_zip"),
  
  // Bank Account Fields (PLAIN TEXT - no encryption per user requirement)
  bankName: text("bank_name"),
  accountNumber: text("account_number"), // Account number in plain text
  routingNumber: text("routing_number"), // Routing number in plain text
  accountHolderName: text("account_holder_name"),
  accountType: text("account_type"), // 'checking' or 'savings'
  
  // Metadata
  isDefault: boolean("is_default").default(false), // Mark one as default payment method
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// ZOD SCHEMAS FOR NORMALIZED TABLES
// =====================================================

// Quote Member Insert Schema
export const insertQuoteMemberSchema = createInsertSchema(quoteMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Override date field to accept yyyy-MM-dd string instead of Date object
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format").optional(),
});

export const updateQuoteMemberSchema = insertQuoteMemberSchema.partial().omit({
  companyId: true,
  quoteId: true,
  role: true,
});

// Income Insert Schema
export const insertQuoteMemberIncomeSchema = createInsertSchema(quoteMemberIncome).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  additionalIncomeSources: z.array(z.object({
    type: z.string(),
    amount: z.string(),
    description: z.string().optional(),
  })).optional(),
});

export const updateQuoteMemberIncomeSchema = insertQuoteMemberIncomeSchema.partial().omit({
  companyId: true,
  memberId: true,
});

// Immigration Insert Schema
export const insertQuoteMemberImmigrationSchema = createInsertSchema(quoteMemberImmigration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateQuoteMemberImmigrationSchema = insertQuoteMemberImmigrationSchema.partial().omit({
  companyId: true,
  memberId: true,
});

// Document Insert Schema
export const insertQuoteMemberDocumentSchema = createInsertSchema(quoteMemberDocuments).omit({
  id: true,
  createdAt: true,
  uploadedAt: true,
});

// Types
export type QuoteMember = typeof quoteMembers.$inferSelect;
export type InsertQuoteMember = z.infer<typeof insertQuoteMemberSchema>;
export type UpdateQuoteMember = z.infer<typeof updateQuoteMemberSchema>;

export type QuoteMemberIncome = typeof quoteMemberIncome.$inferSelect;
export type InsertQuoteMemberIncome = z.infer<typeof insertQuoteMemberIncomeSchema>;
export type UpdateQuoteMemberIncome = z.infer<typeof updateQuoteMemberIncomeSchema>;

export type QuoteMemberImmigration = typeof quoteMemberImmigration.$inferSelect;
export type InsertQuoteMemberImmigration = z.infer<typeof insertQuoteMemberImmigrationSchema>;
export type UpdateQuoteMemberImmigration = z.infer<typeof updateQuoteMemberImmigrationSchema>;

export type QuoteMemberDocument = typeof quoteMemberDocuments.$inferSelect;
export type InsertQuoteMemberDocument = z.infer<typeof insertQuoteMemberDocumentSchema>;

// Payment Method Schemas with comprehensive validation
const basePaymentMethodSchema = createInsertSchema(quotePaymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  paymentType: z.enum(['card', 'bank_account'], { required_error: "Payment type is required" }),
  
  // Card validation (only when paymentType is 'card')
  // NOTE: We only validate format (numeric, length) NOT Luhn algorithm
  // This is a storage system, not a payment processor - any number can be stored
  cardNumber: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const cleaned = val.replace(/\s/g, '');
      // Just validate it's numeric and has reasonable length (13-19 digits)
      return /^\d{13,19}$/.test(cleaned);
    },
    { message: "Card number must be 13-19 digits" }
  ),
  cardHolderName: z.string().optional(),
  expirationMonth: z.string().optional().refine(
    (val) => !val || /^(0[1-9]|1[0-2])$/.test(val),
    { message: "Month must be 01-12" }
  ),
  expirationYear: z.string().optional().refine(
    (val) => !val || /^\d{4}$/.test(val),
    { message: "Year must be 4 digits (YYYY)" }
  ),
  cvv: z.string().optional(),
  billingZip: z.string().optional().refine(
    (val) => !val || /^\d{5}(-\d{4})?$/.test(val),
    { message: "ZIP code must be 5 digits or 5+4 format" }
  ),
  
  // Bank account validation (only when paymentType is 'bank_account')
  bankName: z.string().optional(),
  accountNumber: z.string().optional().refine(
    (val) => !val || /^\d{4,17}$/.test(val),
    { message: "Account number must be 4-17 digits" }
  ),
  routingNumber: z.string().optional().refine(
    (val) => !val || /^\d{9}$/.test(val),
    { message: "Routing number must be exactly 9 digits" }
  ),
  accountHolderName: z.string().optional(),
  accountType: z.enum(['checking', 'savings']).optional(),
  
  isDefault: z.boolean().default(false),
});

export const insertPaymentMethodSchema = basePaymentMethodSchema.superRefine((data, ctx) => {
  // Validate expiration date if both month and year are provided
  if (data.expirationMonth && data.expirationYear) {
    // Handle both 2-digit (YY) and 4-digit (YYYY) year formats
    const year = data.expirationYear.length === 4 
      ? data.expirationYear.slice(2) 
      : data.expirationYear;
    const expiration = data.expirationMonth + year;
    const result = validateExpirationDate(expiration);
    if (!result.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || "Invalid expiration date",
        path: ['expirationMonth'],
      });
    }
  }
  
  // Validate CVV against card number if both are provided
  if (data.cvv && data.cardNumber) {
    const result = validateCVV(data.cvv, data.cardNumber);
    if (!result.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || "Invalid CVV",
        path: ['cvv'],
      });
    }
  }
});

export const updatePaymentMethodSchema = basePaymentMethodSchema.partial().omit({
  companyId: true,
  quoteId: true,
});

export type QuotePaymentMethod = typeof quotePaymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type UpdatePaymentMethod = z.infer<typeof updatePaymentMethodSchema>;

// =====================================================
// QUOTE REMINDERS
// =====================================================

export const quoteReminders = pgTable("quote_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  quoteId: varchar("quote_id", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  // Reminder Details
  dueDate: date("due_date").notNull(), // yyyy-MM-dd format
  dueTime: text("due_time").notNull(), // HH:mm format (24-hour)
  timezone: text("timezone").notNull().default("America/New_York"),
  
  // Notification Settings
  reminderBefore: text("reminder_before"), // e.g., "15min", "1hour", "1day", "1week"
  reminderType: text("reminder_type").notNull(), // e.g., "follow_up", "document_request", "payment_due", "policy_renewal", "other"
  notifyUsers: text("notify_users").array(), // Array of user IDs to notify
  
  // Content
  title: text("title"), // Short title/summary
  description: text("description"), // Detailed description
  
  // Privacy & Status
  isPrivate: boolean("is_private").default(false), // Only visible to creator if true
  status: text("status").notNull().default("pending"), // "pending", "completed", "snoozed", "cancelled"
  priority: text("priority").default("medium"), // "low", "medium", "high", "urgent"
  
  // Completion & Snooze
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  snoozedUntil: timestamp("snoozed_until"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Reminder Insert Schema
export const insertQuoteReminderSchema = createInsertSchema(quoteReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completedBy: true,
}).extend({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm format (24-hour)"),
  reminderType: z.enum(["follow_up", "document_request", "payment_due", "policy_renewal", "call_client", "send_email", "review_application", "other"]),
  status: z.enum(["pending", "completed", "snoozed", "cancelled"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  notifyUsers: z.array(z.string()).optional(),
});

export const updateQuoteReminderSchema = insertQuoteReminderSchema.partial().omit({
  companyId: true,
  quoteId: true,
  createdBy: true,
});

export type QuoteReminder = typeof quoteReminders.$inferSelect;
export type InsertQuoteReminder = z.infer<typeof insertQuoteReminderSchema>;
export type UpdateQuoteReminder = z.infer<typeof updateQuoteReminderSchema>;

// =====================================================
// CONSENT DOCUMENTS (Legal consent forms for quotes)
// =====================================================

export const consentDocuments = pgTable("consent_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quoteId", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }),
  companyId: varchar("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Status and delivery
  status: text("status").notNull().default("draft"), // draft, sent, viewed, signed, void
  deliveryChannel: text("deliveryChannel"), // email, sms, link
  deliveryTarget: text("deliveryTarget"), // email address, phone number, or null for link
  
  // Security token for public access (cryptographically secure 8-character ID)
  token: varchar("token", { length: 8 }).notNull().unique(), // Cryptographically secure 8-character ID for public access URL
  
  // Signature information
  signedByName: text("signedByName"),
  signedByEmail: text("signedByEmail"),
  signedByPhone: text("signedByPhone"),
  signatureImage: text("signatureImage"), // Base64 encoded signature image from signature pad
  
  // Digital audit trail
  signerIp: varchar("signerIp"),
  signerUserAgent: text("signerUserAgent"),
  signerTimezone: varchar("signerTimezone"),
  signerLocation: varchar("signerLocation"), // Lat/long coordinates
  signerPlatform: varchar("signerPlatform"), // Desktop/Mobile/Tablet
  signerBrowser: varchar("signerBrowser"), // Chrome, Firefox, Safari, etc.
  
  // Timestamps
  sentAt: timestamp("sentAt"),
  viewedAt: timestamp("viewedAt"),
  signedAt: timestamp("signedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  createdBy: varchar("createdBy").notNull().references(() => users.id),
});

// =====================================================
// CONSENT SIGNATURE EVENTS (Audit trail for consent documents)
// =====================================================

export const consentSignatureEvents = pgTable("consent_signature_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consentDocumentId: varchar("consentDocumentId").notNull().references(() => consentDocuments.id, { onDelete: "cascade" }),
  
  // Event details
  eventType: text("eventType").notNull(), // generated, sent, delivered, viewed, signed, failed
  payload: jsonb("payload").default({}), // Event-specific data
  
  // Timestamps and actor
  occurredAt: timestamp("occurredAt").notNull().defaultNow(),
  actorId: varchar("actorId").references(() => users.id), // User who triggered the event (nullable for public actions)
});

// =====================================================
// CONSENT DOCUMENT SCHEMAS
// =====================================================

export const insertConsentDocumentSchema = createInsertSchema(consentDocuments).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  viewedAt: true,
  signedAt: true,
}).extend({
  status: z.enum(["draft", "sent", "viewed", "signed", "void"]).default("draft"),
  deliveryChannel: z.enum(["email", "sms", "link"]).optional(),
});

export const insertConsentEventSchema = createInsertSchema(consentSignatureEvents).omit({
  id: true,
  occurredAt: true,
}).extend({
  eventType: z.enum(["generated", "sent", "delivered", "viewed", "signed", "failed"]),
  payload: z.record(z.any()).optional(),
});

export type ConsentDocument = typeof consentDocuments.$inferSelect;
export type InsertConsentDocument = z.infer<typeof insertConsentDocumentSchema>;

export type ConsentSignatureEvent = typeof consentSignatureEvents.$inferSelect;
export type InsertConsentEvent = z.infer<typeof insertConsentEventSchema>;
