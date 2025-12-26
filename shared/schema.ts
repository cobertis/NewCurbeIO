
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, boolean, jsonb, integer, numeric, unique, index, uniqueIndex, AnyPgColumn, serial, bigint, pgEnum } from "drizzle-orm/pg-core";
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
  phone: text("phone"), // Company phone number (optional, set during onboarding)
  address: text("address"), // Company address (optional, set during onboarding)
  addressLine2: text("address_line_2"), // Suite, Apt, Unit, etc.
  domain: text("domain"), // Custom domain
  customDomain: text("custom_domain"), // White-label custom domain (verified via Cloudflare)
  customDomainStatus: text("custom_domain_status"), // Status: pending, active, pending_validation, deleted
  cloudflareHostnameId: text("cloudflare_hostname_id"), // Cloudflare custom hostname ID
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
  
  // iMessage/BlueBubbles settings
  imessageSettings: jsonb("imessage_settings").default({
    serverUrl: "", // BlueBubbles server URL (e.g., "https://your-server.ngrok.io")
    password: "", // BlueBubbles server password/guid
    isEnabled: false, // Whether iMessage is enabled for this company
    webhookSecret: "", // Secret for validating incoming webhooks from BlueBubbles
  }),
  
  // Holiday settings
  holidayCountryCode: text("holiday_country_code").default("US"), // Country code for public holidays (ISO 3166-1 alpha-2)
  
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
}, (table) => ({
  // Prevent duplicate feature assignments to same company
  companyFeatureUnique: uniqueIndex("company_features_company_feature_unique").on(table.companyId, table.featureId),
}));

// =====================================================
// USERS
// =====================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"), // Nullable - set during account activation
  firstName: text("first_name"),
  lastName: text("last_name"),
  slug: text("slug").unique(), // URL-friendly identifier for webhook URLs
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
  role: text("role").notNull().default("agent"), // superadmin, admin, agent
  
  // Multi-tenant reference
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
  
  // Data visibility
  viewAllCompanyData: boolean("view_all_company_data").notNull().default(false), // If true, user can see all company data; if false, only their own data
  
  // User status
  status: text("status").notNull().default("active"), // 'pending_activation', 'active', 'deactivated'
  agentAvailabilityStatus: text("agent_availability_status").notNull().default("offline"), // 'online', 'offline', 'busy' - for live chat routing
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  
  // Email marketing subscription
  emailSubscribed: boolean("email_subscribed").notNull().default(true), // Subscribed to marketing emails
  
  // SMS marketing subscription
  smsSubscribed: boolean("sms_subscribed").notNull().default(true), // Subscribed to marketing SMS
  
  // SIP WebPhone Settings
  sipExtension: text("sip_extension"), // SIP extension number (e.g., "101")
  sipPassword: text("sip_password"), // SIP password for WebRTC registration
  sipServer: text("sip_server"), // SIP server URL (e.g., "wss://pbx.example.com:8089/ws")
  sipEnabled: boolean("sip_enabled").notNull().default(false), // Whether WebPhone is enabled for this user
  
  // Email preferences
  emailNotifications: boolean("email_notifications").notNull().default(true), // General email notifications
  invoiceAlerts: boolean("invoice_alerts").notNull().default(true), // Invoice notification emails
  
  // Billing
  stripeCustomerId: text("stripe_customer_id"), // User's own Stripe customer ID for billing
  googleId: text("google_id"), // Google OAuth ID for SSO
  
  // Security
  lastLoginAt: timestamp("last_login_at"),
  passwordChangedAt: timestamp("password_changed_at"),
  twoFactorEmailEnabled: boolean("two_factor_email_enabled").notNull().default(false), // Email 2FA disabled by default
  twoFactorSmsEnabled: boolean("two_factor_sms_enabled").notNull().default(false), // SMS 2FA disabled by default
  
  // Onboarding
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false), // Whether user has completed onboarding
  
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
  
  // Display features for public pricing page (array of feature names with included status)
  displayFeatures: jsonb("display_features").default([]),
  
  // User limits (null = unlimited)
  maxUsers: integer("max_users"), // Shared=1, Dedicated=5, Unlimited=null
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// SUBSCRIPTIONS & BILLING
// =====================================================


// =====================================================
// PLAN FEATURES (Master list of features for public display)
// =====================================================

export const planFeatures = pgTable("plan_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "CMS API (CRM Integration)"
  description: text("description"), // Optional longer description
  sortOrder: integer("sort_order").notNull().default(0), // Display order
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// PLAN FEATURE ASSIGNMENTS (Per-plan feature inclusion toggles)
// =====================================================

export const planFeatureAssignments = pgTable("plan_feature_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  featureId: varchar("feature_id").notNull().references(() => planFeatures.id, { onDelete: "cascade" }),
  included: boolean("included").notNull().default(true), // true = green checkmark, false = red X
  sortOrder: integer("sort_order").notNull().default(0), // Display order within this plan
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // User who owns this invoice (for user-scoped billing)
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
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // User who made this payment
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
// USER PAYMENT METHODS (User-scoped Stripe payment methods)
// =====================================================

export const userPaymentMethods = pgTable("user_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Stripe integration
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"), // User's Stripe customer ID
  
  // Card details (for display only, from Stripe)
  type: text("type").notNull().default("card"), // card, bank_account, etc.
  brand: text("brand"), // visa, mastercard, amex, etc.
  last4: text("last_4"), // Last 4 digits
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),
  
  // Status
  isDefault: boolean("is_default").notNull().default(false),
  status: text("status").notNull().default("active").$type<"active" | "expired" | "removed">(),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("user_payment_methods_company_id_idx").on(table.companyId),
  ownerUserIdIdx: index("user_payment_methods_owner_user_id_idx").on(table.ownerUserId),
  stripePaymentMethodIdx: index("user_payment_methods_stripe_pm_idx").on(table.stripePaymentMethodId),
}));

export const insertUserPaymentMethodSchema = createInsertSchema(userPaymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserPaymentMethod = typeof userPaymentMethods.$inferSelect;
export type InsertUserPaymentMethod = z.infer<typeof insertUserPaymentMethodSchema>;

// =====================================================
// BILLING ADDRESSES
// =====================================================

export const billingAddresses = pgTable("billing_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // User who owns this billing address
  
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
}, (table) => ({
  companyIdIdx: index("billing_addresses_company_id_idx").on(table.companyId),
  ownerUserIdIdx: index("billing_addresses_owner_user_id_idx").on(table.ownerUserId),
}));

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
  role: text("role").notNull().default("agent"),
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

// iMessage Settings Schema
export const insertImessageSettingsSchema = z.object({
  serverUrl: z.string().url("Must be a valid URL").min(1, "Server URL is required"),
  password: z.string().min(1, "Password is required"),
  isEnabled: z.boolean(),
  webhookSecret: z.string().optional(),
});

export type InsertImessageSettings = z.infer<typeof insertImessageSettingsSchema>;

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
  role: z.enum(["superadmin", "admin", "agent"]),
  companyId: z.string().optional(),
  viewAllCompanyData: z.boolean().optional().default(false), // Default to false - users see only their own data
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
    z.string().regex(/^data:image\/[\w+\-.]+;base64,/, "Avatar must be a valid URL or base64 image"),
    z.literal(""),
    z.null()
  ]).optional(),
  phone: z.string().regex(phoneRegex, "Phone must be in E.164 format (e.g., +14155552671)").optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  preferredLanguage: z.string().optional(),
  timezone: z.string().optional(),
  address: z.string().optional(),
  role: z.enum(["superadmin", "admin", "agent"]).optional(),
  companyId: z.string().optional(),
  viewAllCompanyData: z.boolean().optional(), // Allow updating data visibility
  isActive: z.boolean().optional(),
  status: z.enum(["pending_activation", "active", "deactivated"]).optional(),
  agentAvailabilityStatus: z.enum(["online", "offline", "busy"]).optional(),
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

export const insertPlanFeatureSchema = createInsertSchema(planFeatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;

export const insertPlanFeatureAssignmentSchema = createInsertSchema(planFeatureAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PlanFeatureAssignment = typeof planFeatureAssignments.$inferSelect;
export type InsertPlanFeatureAssignment = z.infer<typeof insertPlanFeatureAssignmentSchema>;

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
  contactId: varchar("contact_id").notNull().references(() => manualContacts.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueListContact: unique().on(table.listId, table.contactId),
  // Performance indexes
  listIdIndex: index("contact_list_members_list_id_idx").on(table.listId),
  contactIdIndex: index("contact_list_members_contact_id_idx").on(table.contactId),
}));

export const contactListMemberSchema = createInsertSchema(contactListMembers).omit({
  id: true,
  addedAt: true,
});

export type ContactListMember = typeof contactListMembers.$inferSelect;
export type InsertContactListMember = z.infer<typeof contactListMemberSchema>;

// Bulk add to list response schema
export const bulkAddToListResponseSchema = z.object({
  addedCount: z.number(),
  skippedCount: z.number(),
  duplicates: z.array(z.string()),
});

export type BulkAddToListResponse = z.infer<typeof bulkAddToListResponseSchema>;

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
  documentsStatus: text("documents_status").notNull().default("pending"), // pending, processing, declined, completed
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, auto_pay, failed, paid, not_applicable
  
  // Additional Information
  notes: text("notes"), // Internal notes
  estimatedPremium: text("estimated_premium"), // Estimated premium amount
  
  // Selected Plan from Marketplace
  selectedPlan: jsonb("selected_plan"), // Complete plan object selected from marketplace
  
  // APTC (Advanced Premium Tax Credit) Persistence
  aptcAmount: numeric("aptc_amount", { precision: 10, scale: 2 }), // Dollar amount of tax credit
  aptcSource: text("aptc_source"), // "calculated", "manual", "previous_year", etc.
  aptcCapturedAt: timestamp("aptc_captured_at"), // When APTC was captured
  
  // Additional Policy/Quote Fields
  memberId: varchar("member_id").references((): AnyPgColumn => quoteMembers.id, { onDelete: "set null" }), // Primary member/client ID reference
  npnMarketplace: text("npn_marketplace"), // NPN for marketplace transactions
  
  // Archive status
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at"),
  
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
  specialEnrollmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format").optional(),
  cancellationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format").optional(),
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
// QUOTE PLANS (Multiple plans per quote)
// =====================================================

export const quotePlans = pgTable("quote_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Plan source: marketplace or manual
  source: text("source").notNull().default("marketplace"), // "marketplace" | "manual"
  
  // Plan data as JSONB (stores full plan object)
  planData: jsonb("plan_data").notNull(),
  
  // Primary plan flag (first plan added is primary by default)
  isPrimary: boolean("is_primary").default(false).notNull(),
  
  // Order for display
  displayOrder: integer("display_order").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuotePlanSchema = createInsertSchema(quotePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateQuotePlanSchema = insertQuotePlanSchema.partial().omit({
  quoteId: true,
  companyId: true,
});

export type QuotePlan = typeof quotePlans.$inferSelect;
export type InsertQuotePlan = z.infer<typeof insertQuotePlanSchema>;

// =====================================================
// QUOTE MEMBERS (Normalized member data)
// =====================================================

export const quoteMembers = pgTable("quote_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  quoteId: varchar("quote_id", { length: 8 }).notNull().references((): AnyPgColumn => quotes.id, { onDelete: "cascade" }),
  
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
// QUOTE FOLDERS (Organizational folders for quotes)
// =====================================================

export const quoteFolders = pgTable("quote_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  type: text("type").notNull(), // "agency" | "personal"
  
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
}));

export const insertQuoteFolderSchema = createInsertSchema(quoteFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Folder name is required").max(50, "Folder name must be 50 characters or less"),
  type: z.enum(["agency", "personal"]),
});

export const updateQuoteFolderSchema = insertQuoteFolderSchema.partial().omit({
  companyId: true,
  createdBy: true,
});

export type QuoteFolder = typeof quoteFolders.$inferSelect;
export type InsertQuoteFolder = z.infer<typeof insertQuoteFolderSchema>;

// =====================================================
// QUOTE FOLDER ASSIGNMENTS (Assign quotes to folders)
// =====================================================

export const quoteFolderAssignments = pgTable("quote_folder_assignments", {
  quoteId: varchar("quote_id", { length: 8 }).notNull().references(() => quotes.id, { onDelete: "cascade" }).primaryKey(),
  folderId: varchar("folder_id").notNull().references(() => quoteFolders.id, { onDelete: "cascade" }),
  
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const insertQuoteFolderAssignmentSchema = createInsertSchema(quoteFolderAssignments).omit({
  assignedAt: true,
});

export type QuoteFolderAssignment = typeof quoteFolderAssignments.$inferSelect;
export type InsertQuoteFolderAssignment = z.infer<typeof insertQuoteFolderAssignmentSchema>;

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

// =====================================================
// POLICY NOTES (Internal notes for insurance policies)
// =====================================================

export const policyNotes = pgTable("policy_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  attachments: text("attachments").array(),
  isImportant: boolean("is_important").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  isResolved: boolean("is_resolved").notNull().default(false),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPolicyNoteSchema = createInsertSchema(policyNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PolicyNote = typeof policyNotes.$inferSelect;
export type InsertPolicyNote = z.infer<typeof insertPolicyNoteSchema>;

// =====================================================
// POLICY DOCUMENTS (Document management for insurance policies)
// =====================================================

export const policyDocuments = pgTable("policy_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  category: text("category").notNull().default("other"),
  description: text("description"),
  belongsTo: varchar("belongs_to").references(() => policyMembers.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPolicyDocumentSchema = createInsertSchema(policyDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PolicyDocument = typeof policyDocuments.$inferSelect;
export type InsertPolicyDocument = z.infer<typeof insertPolicyDocumentSchema>;

// =====================================================
// POLICIES (Insurance Policy Management)
// =====================================================

export const policies = pgTable("policies", {
  id: varchar("id", { length: 8 }).primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Step 1: Policy Information
  effectiveDate: date("effective_date").notNull(),
  agentId: varchar("agent_id").references(() => users.id, { onDelete: "set null" }),
  productType: text("product_type").notNull(),
  
  // Marketplace & Enrollment Information
  memberId: text("member_id"),
  npnMarketplace: text("npn_marketplace"),
  marketplaceId: text("marketplace_id"),
  ffmMarketplace: text("ffm_marketplace"),
  specialEnrollmentReason: text("special_enrollment_reason"),
  cancellationDate: date("cancellation_date"),
  specialEnrollmentDate: date("special_enrollment_date"),
  
  // Step 2: Personal Information (Client)
  clientFirstName: text("client_first_name").notNull(),
  clientMiddleName: text("client_middle_name"),
  clientLastName: text("client_last_name").notNull(),
  clientSecondLastName: text("client_second_last_name"),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientDateOfBirth: date("client_date_of_birth"),
  clientGender: text("client_gender"),
  clientIsApplicant: boolean("client_is_applicant").default(false),
  clientTobaccoUser: boolean("client_tobacco_user").default(false),
  clientPregnant: boolean("client_pregnant").default(false),
  clientSsn: text("client_ssn"),
  clientPreferredLanguage: text("client_preferred_language"),
  clientCountryOfBirth: text("client_country_of_birth"),
  clientMaritalStatus: text("client_marital_status"),
  clientWeight: text("client_weight"),
  clientHeight: text("client_height"),
  
  // Step 3: Family Group
  annualHouseholdIncome: text("annual_household_income"),
  familyGroupSize: integer("family_group_size"),
  spouses: jsonb("spouses").default([]),
  dependents: jsonb("dependents").default([]),
  
  // Step 4: Addresses
  physical_street: text("physical_street"),
  physical_address_line_2: text("physical_address_line_2"),
  physical_city: text("physical_city"),
  physical_state: text("physical_state"),
  physical_postal_code: text("physical_postal_code"),
  physical_county: text("physical_county"),
  
  mailing_street: text("mailing_street"),
  mailing_address_line_2: text("mailing_address_line_2"),
  mailing_city: text("mailing_city"),
  mailing_state: text("mailing_state"),
  mailing_postal_code: text("mailing_postal_code"),
  mailing_county: text("mailing_county"),
  
  billing_street: text("billing_street"),
  billing_address_line_2: text("billing_address_line_2"),
  billing_city: text("billing_city"),
  billing_state: text("billing_state"),
  billing_postal_code: text("billing_postal_code"),
  billing_county: text("billing_county"),
  
  country: text("country").notNull().default("United States"),
  
  // Policy Status
  status: text("status").notNull().default("new"),
  documentsStatus: text("documents_status").notNull().default("pending"), // pending, processing, declined, completed
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, auto_pay, failed, paid, not_applicable
  consentStatus: text("consent_status").notNull().default("not_sent"), // not_sent, sent, signed, failed
  
  // Additional Information
  notes: text("notes"),
  estimatedPremium: text("estimated_premium"),
  
  // Selected Plan from Marketplace
  selectedPlan: jsonb("selected_plan"),
  
  // APTC (Advanced Premium Tax Credit) Persistence
  aptcAmount: numeric("aptc_amount", { precision: 10, scale: 2 }), // Dollar amount of tax credit
  aptcSource: text("aptc_source"), // "calculated", "manual", "previous_year", etc.
  aptcCapturedAt: timestamp("aptc_captured_at"), // When APTC was captured
  
  // Archive status
  isArchived: boolean("is_archived").default(false).notNull(),
  
  // Block status
  isBlocked: boolean("is_blocked").default(false).notNull(),
  blockedBy: varchar("blocked_by").references(() => users.id, { onDelete: "set null" }),
  blockedAt: timestamp("blocked_at"),
  
  // Renewal tracking (OEP 2026)
  renewalTargetYear: integer("renewal_target_year"),
  renewalStatus: text("renewal_status").default("pending").notNull(),
  renewedFromPolicyId: varchar("renewed_from_policy_id", { length: 8 }).references((): AnyPgColumn => policies.id, { onDelete: "set null" }),
  renewedToPolicyId: varchar("renewed_to_policy_id", { length: 8 }).references((): AnyPgColumn => policies.id, { onDelete: "set null" }),
  renewedAt: timestamp("renewed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  updatedAtIdx: index('policies_updated_at_idx').on(t.updatedAt),
  companyIdIdx: index('policies_company_id_idx').on(t.companyId),
  statusIdx: index('policies_status_idx').on(t.status),
  companyIdStatusIdx: index('policies_company_id_status_idx').on(t.companyId, t.status),
}));

export const insertPolicySchema = createInsertSchema(policies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  renewalTargetYear: true,
  renewalStatus: true,
  renewedFromPolicyId: true,
  renewedToPolicyId: true,
  renewedAt: true,
}).extend({
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  clientDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format").optional(),
  spouses: z.array(spouseSchema).optional(),
  dependents: z.array(dependentSchema).optional(),
});

export const updatePolicySchema = insertPolicySchema.partial().omit({
  companyId: true,
  createdBy: true,
});

export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = z.infer<typeof insertPolicySchema>;

// =====================================================
// POLICY PLANS (Multiple plans per policy)
// =====================================================

export const policyPlans = pgTable("policy_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Plan source: marketplace or manual
  source: text("source").notNull().default("marketplace"), // "marketplace" | "manual"
  
  // Plan data as JSONB (stores full plan object)
  planData: jsonb("plan_data").notNull(),
  
  // Primary plan flag (first plan added is primary by default)
  isPrimary: boolean("is_primary").default(false).notNull(),
  
  // Order for display
  displayOrder: integer("display_order").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPolicyPlanSchema = createInsertSchema(policyPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePolicyPlanSchema = insertPolicyPlanSchema.partial().omit({
  policyId: true,
  companyId: true,
});

export type PolicyPlan = typeof policyPlans.$inferSelect;
export type InsertPolicyPlan = z.infer<typeof insertPolicyPlanSchema>;

// =====================================================
// POLICY MEMBERS (Normalized member data)
// =====================================================

export const policyMembers = pgTable("policy_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  policyId: varchar("policy_id", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }),
  
  role: text("role").notNull(),
  
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  secondLastName: text("second_last_name"),
  dateOfBirth: date("date_of_birth"),
  ssn: text("ssn"),
  gender: text("gender"),
  phone: text("phone"),
  email: text("email"),
  
  isApplicant: boolean("is_applicant").default(false),
  isPrimaryDependent: boolean("is_primary_dependent").default(false),
  tobaccoUser: boolean("tobacco_user").default(false),
  pregnant: boolean("pregnant").default(false),
  preferredLanguage: text("preferred_language"),
  countryOfBirth: text("country_of_birth"),
  maritalStatus: text("marital_status"),
  weight: text("weight"),
  height: text("height"),
  
  relation: text("relation"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  ssnIdx: index('policy_members_ssn_idx').on(t.ssn),
  emailIdx: index('policy_members_email_idx').on(t.email),
}));

// =====================================================
// POLICY MEMBER INCOME (Income information)
// =====================================================

export const policyMemberIncome = pgTable("policy_member_income", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => policyMembers.id, { onDelete: "cascade" }).unique(),
  
  employmentStatus: text("employment_status"),
  employerName: text("employer_name"),
  jobTitle: text("job_title"),
  position: text("position"),
  employerPhone: text("employer_phone"),
  selfEmployed: boolean("self_employed").default(false),
  yearsEmployed: integer("years_employed"),
  
  annualIncome: text("annual_income"),
  incomeFrequency: text("income_frequency"),
  totalAnnualIncome: text("total_annual_income"),
  
  hasAdditionalIncome: boolean("has_additional_income").default(false),
  additionalIncomeSources: jsonb("additional_income_sources").default([]),
  
  taxFilingStatus: text("tax_filing_status"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// POLICY MEMBER IMMIGRATION (Immigration status)
// =====================================================

export const policyMemberImmigration = pgTable("policy_member_immigration", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => policyMembers.id, { onDelete: "cascade" }).unique(),
  
  citizenshipStatus: text("citizenship_status"),
  immigrationStatus: text("immigration_status"),
  immigrationStatusCategory: text("immigration_status_category"),
  
  visaType: text("visa_type"),
  visaNumber: text("visa_number"),
  greenCardNumber: text("green_card_number"),
  
  entryDate: timestamp("entry_date"),
  visaExpirationDate: timestamp("visa_expiration_date"),
  
  hasWorkAuthorization: boolean("has_work_authorization").default(false),
  workAuthorizationType: text("work_authorization_type"),
  workAuthorizationExpiration: timestamp("work_authorization_expiration"),
  
  i94Number: text("i94_number"),
  uscisNumber: text("uscis_number"),
  naturalizationNumber: text("naturalization_number"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// POLICY MEMBER DOCUMENTS (Document uploads)
// =====================================================

export const policyMemberDocuments = pgTable("policy_member_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull().references(() => policyMembers.id, { onDelete: "cascade" }),
  
  documentType: text("document_type").notNull(),
  documentName: text("document_name").notNull(),
  documentPath: text("document_path").notNull(),
  
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  
  description: text("description"),
  
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =====================================================
// POLICY PAYMENT METHODS (Credit cards and bank accounts)
// =====================================================

export const policyPaymentMethods = pgTable("policy_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  policyId: varchar("policy_id", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }),
  
  paymentType: text("payment_type").notNull(),
  
  cardNumber: text("card_number"),
  cardHolderName: text("card_holder_name"),
  expirationMonth: text("expiration_month"),
  expirationYear: text("expiration_year"),
  cvv: text("cvv"),
  billingZip: text("billing_zip"),
  
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  routingNumber: text("routing_number"),
  accountHolderName: text("account_holder_name"),
  accountType: text("account_type"),
  
  isDefault: boolean("is_default").default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// =====================================================
// ZOD SCHEMAS FOR POLICY NORMALIZED TABLES
// =====================================================

export const insertPolicyMemberSchema = createInsertSchema(policyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format").optional(),
});

export const updatePolicyMemberSchema = insertPolicyMemberSchema.partial().omit({
  companyId: true,
  policyId: true,
  role: true,
});

export const insertPolicyMemberIncomeSchema = createInsertSchema(policyMemberIncome).omit({
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

export const updatePolicyMemberIncomeSchema = insertPolicyMemberIncomeSchema.partial().omit({
  companyId: true,
  memberId: true,
});

export const insertPolicyMemberImmigrationSchema = createInsertSchema(policyMemberImmigration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePolicyMemberImmigrationSchema = insertPolicyMemberImmigrationSchema.partial().omit({
  companyId: true,
  memberId: true,
});

export const insertPolicyMemberDocumentSchema = createInsertSchema(policyMemberDocuments).omit({
  id: true,
  createdAt: true,
  uploadedAt: true,
});

export type PolicyMember = typeof policyMembers.$inferSelect;
export type InsertPolicyMember = z.infer<typeof insertPolicyMemberSchema>;
export type UpdatePolicyMember = z.infer<typeof updatePolicyMemberSchema>;

export type PolicyMemberIncome = typeof policyMemberIncome.$inferSelect;
export type InsertPolicyMemberIncome = z.infer<typeof insertPolicyMemberIncomeSchema>;
export type UpdatePolicyMemberIncome = z.infer<typeof updatePolicyMemberIncomeSchema>;

export type PolicyMemberImmigration = typeof policyMemberImmigration.$inferSelect;
export type InsertPolicyMemberImmigration = z.infer<typeof insertPolicyMemberImmigrationSchema>;
export type UpdatePolicyMemberImmigration = z.infer<typeof updatePolicyMemberImmigrationSchema>;

export type PolicyMemberDocument = typeof policyMemberDocuments.$inferSelect;
export type InsertPolicyMemberDocument = z.infer<typeof insertPolicyMemberDocumentSchema>;

const basePolicyPaymentMethodSchema = createInsertSchema(policyPaymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  paymentType: z.enum(['card', 'bank_account'], { required_error: "Payment type is required" }),
  
  cardNumber: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const cleaned = val.replace(/\s/g, '');
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

export const insertPolicyPaymentMethodSchema = basePolicyPaymentMethodSchema.superRefine((data, ctx) => {
  if (data.expirationMonth && data.expirationYear) {
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

export const updatePolicyPaymentMethodSchema = basePolicyPaymentMethodSchema.partial().omit({
  companyId: true,
  policyId: true,
});

export type PolicyPaymentMethod = typeof policyPaymentMethods.$inferSelect;
export type InsertPolicyPaymentMethod = z.infer<typeof insertPolicyPaymentMethodSchema>;
export type UpdatePolicyPaymentMethod = z.infer<typeof updatePolicyPaymentMethodSchema>;

// =====================================================
// POLICY REMINDERS
// =====================================================

export const policyReminders = pgTable("policy_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  policyId: varchar("policy_id", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  dueDate: date("due_date").notNull(),
  dueTime: text("due_time").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  
  reminderBefore: text("reminder_before"),
  reminderType: text("reminder_type").notNull(),
  notifyUsers: text("notify_users").array(),
  
  title: text("title"),
  description: text("description"),
  
  isPrivate: boolean("is_private").default(false),
  status: text("status").notNull().default("pending"),
  priority: text("priority").default("medium"),
  
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  snoozedUntil: timestamp("snoozed_until"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPolicyReminderSchema = createInsertSchema(policyReminders).omit({
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

export const updatePolicyReminderSchema = insertPolicyReminderSchema.partial().omit({
  companyId: true,
  policyId: true,
  createdBy: true,
});

export type PolicyReminder = typeof policyReminders.$inferSelect;
export type InsertPolicyReminder = z.infer<typeof insertPolicyReminderSchema>;
export type UpdatePolicyReminder = z.infer<typeof updatePolicyReminderSchema>;

// =====================================================
// POLICY CONSENT DOCUMENTS (Legal consent forms for policies)
// =====================================================

export const policyConsentDocuments = pgTable("policy_consent_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: varchar("policyId", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }),
  companyId: varchar("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  status: text("status").notNull().default("draft"),
  deliveryChannel: text("deliveryChannel"),
  deliveryTarget: text("deliveryTarget"),
  
  token: varchar("token", { length: 64 }).notNull().unique(),
  
  signedByName: text("signedByName"),
  signedByEmail: text("signedByEmail"),
  signedByPhone: text("signedByPhone"),
  signatureImage: text("signatureImage"),
  
  signerIp: varchar("signerIp"),
  signerUserAgent: text("signerUserAgent"),
  signerTimezone: varchar("signerTimezone"),
  signerLocation: varchar("signerLocation"),
  signerPlatform: varchar("signerPlatform"),
  signerBrowser: varchar("signerBrowser"),
  
  sentAt: timestamp("sentAt"),
  viewedAt: timestamp("viewedAt"),
  signedAt: timestamp("signedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  createdBy: varchar("createdBy").notNull().references(() => users.id),
});

// =====================================================
// POLICY CONSENT SIGNATURE EVENTS (Audit trail for policy consent documents)
// =====================================================

export const policyConsentSignatureEvents = pgTable("policy_consent_signature_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consentDocumentId: varchar("consentDocumentId").notNull().references(() => policyConsentDocuments.id, { onDelete: "cascade" }),
  
  eventType: text("eventType").notNull(),
  payload: jsonb("payload").default({}),
  
  occurredAt: timestamp("occurredAt").notNull().defaultNow(),
  actorId: varchar("actorId").references(() => users.id),
});

// =====================================================
// POLICY CONSENT DOCUMENT SCHEMAS
// =====================================================

export const insertPolicyConsentDocumentSchema = createInsertSchema(policyConsentDocuments).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  viewedAt: true,
  signedAt: true,
}).extend({
  status: z.enum(["draft", "sent", "viewed", "signed", "void"]).default("draft"),
  deliveryChannel: z.enum(["email", "sms", "link"]).optional(),
});

export const insertPolicyConsentEventSchema = createInsertSchema(policyConsentSignatureEvents).omit({
  id: true,
  occurredAt: true,
}).extend({
  eventType: z.enum(["generated", "sent", "delivered", "viewed", "signed", "failed"]),
  payload: z.record(z.any()).optional(),
});

export type PolicyConsentDocument = typeof policyConsentDocuments.$inferSelect;
export type InsertPolicyConsentDocument = z.infer<typeof insertPolicyConsentDocumentSchema>;

export type PolicyConsentSignatureEvent = typeof policyConsentSignatureEvents.$inferSelect;
export type InsertPolicyConsentEvent = z.infer<typeof insertPolicyConsentEventSchema>;

// =====================================================
// POLICY FOLDERS (Organizational folders for policies)
// =====================================================

export const policyFolders = pgTable("policy_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  type: text("type").notNull(), // "agency" | "personal"
  
  // For personal folders, this is the owner user ID
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  // Partial unique index for AGENCY folders: company-wide unique names
  // NOTE: Partial indexes are created via SQL, not Drizzle schema
  // See: CREATE UNIQUE INDEX unique_agency_folder_name_idx ON policy_folders(company_id, name) WHERE type = 'agency';
  // Partial unique index for PERSONAL folders: unique per user + company
  // See: CREATE UNIQUE INDEX unique_personal_folder_name_idx ON policy_folders(company_id, created_by, name) WHERE type = 'personal';
}));

export const insertPolicyFolderSchema = createInsertSchema(policyFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Folder name is required").max(50, "Folder name must be 50 characters or less"),
  type: z.enum(["agency", "personal"]),
});

export const updatePolicyFolderSchema = insertPolicyFolderSchema.partial().omit({
  companyId: true,
  createdBy: true,
});

export type PolicyFolder = typeof policyFolders.$inferSelect;
export type InsertPolicyFolder = z.infer<typeof insertPolicyFolderSchema>;

// =====================================================
// POLICY FOLDER ASSIGNMENTS (Assign policies to folders)
// =====================================================

export const policyFolderAssignments = pgTable("policy_folder_assignments", {
  policyId: varchar("policy_id", { length: 8 }).notNull().references(() => policies.id, { onDelete: "cascade" }).primaryKey(),
  folderId: varchar("folder_id").notNull().references(() => policyFolders.id, { onDelete: "cascade" }),
  
  assignedBy: varchar("assigned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

export const insertPolicyFolderAssignmentSchema = createInsertSchema(policyFolderAssignments).omit({
  assignedAt: true,
});

export type PolicyFolderAssignment = typeof policyFolderAssignments.$inferSelect;
export type InsertPolicyFolderAssignment = z.infer<typeof insertPolicyFolderAssignmentSchema>;

// =====================================================
// LANDING PAGES (Bio Link Builder)
// =====================================================

export const landingPages = pgTable("landing_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  
  profileName: text("profile_name"),
  profileBio: text("profile_bio"),
  profilePhoto: text("profile_photo"),
  profilePhone: text("profile_phone"),
  profileEmail: text("profile_email"),
  
  theme: jsonb("theme").default({
    layout: "list",
    primaryColor: "#8B5CF6",
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Inter",
    fontWeight: "regular",
    buttonStyle: "rounded",
    buttonColor: "#8B5CF6",
    buttonTextColor: "#ffffff",
    backgroundImage: null,
    backgroundGradient: null,
  }),
  
  seo: jsonb("seo").default({
    title: "",
    description: "",
    ogImage: null,
  }),
  
  isPublished: boolean("is_published").notNull().default(false),
  isPasswordProtected: boolean("is_password_protected").notNull().default(false),
  password: text("password"),
  
  viewCount: integer("view_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const landingBlocks = pgTable("landing_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  landingPageId: varchar("landing_page_id").notNull().references(() => landingPages.id, { onDelete: "cascade" }),
  
  type: text("type").notNull(),
  
  content: jsonb("content").default({}),
  
  position: integer("position").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  
  clickCount: integer("click_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const landingAnalytics = pgTable("landing_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  landingPageId: varchar("landing_page_id").notNull().references(() => landingPages.id, { onDelete: "cascade" }),
  blockId: varchar("block_id").references(() => landingBlocks.id, { onDelete: "set null" }),
  
  eventType: text("event_type").notNull(),
  
  metadata: jsonb("metadata").default({}),
  
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});

export const insertLandingPageSchema = createInsertSchema(landingPages).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
}).extend({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  theme: z.record(z.any()).optional(),
  seo: z.record(z.any()).optional(),
});

export const updateLandingPageSchema = createInsertSchema(landingPages).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
}).extend({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens").optional(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  profileName: z.string().max(100).optional(),
  profileBio: z.string().max(500).optional(),
  profilePhoto: z.string().optional(),
  theme: z.record(z.any()).optional(),
  seo: z.record(z.any()).optional(),
  isPublished: z.boolean().optional(),
  isPasswordProtected: z.boolean().optional(),
  password: z.string().optional(),
}).partial();

export const insertLandingBlockSchema = createInsertSchema(landingBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  clickCount: true,
}).extend({
  type: z.enum(["link", "social", "video", "text", "image", "email", "divider", "contact", "maps", "lead-form", "calendar", "testimonials", "faq", "stats"]),
  content: z.record(z.any()),
  position: z.number().int().min(0),
});

export const insertLandingAnalyticsSchema = createInsertSchema(landingAnalytics).omit({
  id: true,
  occurredAt: true,
}).extend({
  eventType: z.enum(["view", "click", "submit"]),
  metadata: z.record(z.any()).optional(),
});

// Landing page leads capture
export const landingLeads = pgTable("landing_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  landingPageId: varchar("landing_page_id").notNull().references(() => landingPages.id, { onDelete: "cascade" }),
  blockId: varchar("block_id").references(() => landingBlocks.id, { onDelete: "set null" }),
  
  // Lead info
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message"),
  formData: jsonb("form_data").default({}), // Any additional custom fields
  
  // Metadata
  source: text("source"), // utm params, referrer, etc.
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Landing page appointment availability settings
export const appointmentAvailability = pgTable("appointment_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // General settings
  appointmentDuration: integer("appointment_duration").notNull().default(30), // minutes
  bufferTime: integer("buffer_time").notNull().default(0), // minutes between appointments
  minAdvanceTime: integer("min_advance_time").notNull().default(60), // minutes before an appointment can be booked
  maxAdvanceDays: integer("max_advance_days").notNull().default(30), // days in advance appointments can be booked
  
  // Timezone for availability
  timezone: text("timezone").notNull().default("America/New_York"),
  
  // Weekly availability - JSON object with days and time ranges
  weeklyAvailability: jsonb("weekly_availability").notNull().default({
    monday: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
    tuesday: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
    wednesday: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
    thursday: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
    friday: { enabled: true, slots: [{ start: "09:00", end: "17:00" }] },
    saturday: { enabled: false, slots: [] },
    sunday: { enabled: false, slots: [] },
  }),
  
  // Date overrides (blocked dates, special availability)
  dateOverrides: jsonb("date_overrides").notNull().default([]),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Landing page appointments
export const landingAppointments = pgTable("landing_appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  landingPageId: varchar("landing_page_id").notNull().references(() => landingPages.id, { onDelete: "cascade" }),
  blockId: varchar("block_id").references(() => landingBlocks.id, { onDelete: "set null" }),
  
  // Appointment info
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  appointmentDate: text("appointment_date").notNull(), // yyyy-MM-dd
  appointmentTime: text("appointment_time").notNull(), // HH:mm
  duration: integer("duration").notNull().default(30), // minutes
  notes: text("notes"),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled, completed
  
  // Metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==============================================
// MANUAL CALENDAR EVENTS (Standalone)
// ==============================================

// Manual Birthdays (not tied to quotes/policies)
export const manualBirthdays = pgTable("manual_birthdays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  clientName: text("client_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(), // yyyy-MM-dd
  role: text("role").notNull(), // Primary, Spouse, Dependent
  
  // Optional link to quote or policy
  quoteId: varchar("quote_id", { length: 8 }).references(() => quotes.id, { onDelete: "cascade" }),
  policyId: varchar("policy_id", { length: 8 }).references(() => policies.id, { onDelete: "cascade" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Standalone Reminders (not tied to quotes/policies)
export const standaloneReminders = pgTable("standalone_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date").notNull(),
  dueTime: text("due_time").notNull(), // HH:mm format (24-hour)
  timezone: text("timezone").notNull().default("America/New_York"),
  setReminderBefore: text("set_reminder_before"), // "1 hour before", "30 minutes before", etc.
  reminderType: text("reminder_type").notNull(), // Income Verification, Follow up call, etc.
  notifyUserIds: text("notify_user_ids").array(), // Array of user IDs to notify
  isPrivate: boolean("is_private").notNull().default(false),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, completed, snoozed
  
  // Optional link to quote or policy
  quoteId: varchar("quote_id", { length: 8 }).references(() => quotes.id, { onDelete: "cascade" }),
  policyId: varchar("policy_id", { length: 8 }).references(() => policies.id, { onDelete: "cascade" }),
  
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  snoozedUntil: timestamp("snoozed_until"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Manual Appointments (created via calendar, not landing pages)
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  clientName: text("client_name").notNull(),
  appointmentDate: text("appointment_date").notNull(), // yyyy-MM-dd
  appointmentTime: text("appointment_time").notNull(), // HH:mm
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled, completed
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas for manual events
export const insertManualBirthdaySchema = createInsertSchema(manualBirthdays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  clientName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  role: z.enum(["Primary", "Spouse", "Dependent"]),
  quoteId: z.string().optional(),
  policyId: z.string().optional(),
});

export const insertStandaloneReminderSchema = createInsertSchema(standaloneReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  completedBy: true,
  snoozedUntil: true,
}).extend({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm format (24-hour)"),
  timezone: z.string().default("America/New_York"),
  setReminderBefore: z.string().optional(),
  reminderType: z.string().min(1).max(200),
  notifyUserIds: z.array(z.string()).optional(),
  isPrivate: z.boolean().default(false),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["pending", "completed", "snoozed"]).default("pending"),
  quoteId: z.string().optional(),
  policyId: z.string().optional(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  clientName: z.string().min(1).max(100),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).default("pending"),
});

export type ManualBirthday = typeof manualBirthdays.$inferSelect;
export type InsertManualBirthday = z.infer<typeof insertManualBirthdaySchema>;

export type StandaloneReminder = typeof standaloneReminders.$inferSelect;
export type InsertStandaloneReminder = z.infer<typeof insertStandaloneReminderSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export const insertLandingLeadSchema = createInsertSchema(landingLeads).omit({
  id: true,
  createdAt: true,
}).extend({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  message: z.string().max(1000).optional(),
  formData: z.record(z.any()).optional(),
  source: z.string().max(500).optional(),
  ipAddress: z.string().max(50).optional(),
  userAgent: z.string().max(500).optional(),
});

export const insertAppointmentAvailabilitySchema = createInsertSchema(appointmentAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  appointmentDuration: z.number().int().min(15).max(240).default(30),
  bufferTime: z.number().int().min(0).max(120).default(0),
  minAdvanceTime: z.number().int().min(0).max(10080).default(60),
  maxAdvanceDays: z.number().int().min(1).max(365).default(30),
  timezone: z.string().default("America/New_York"),
  weeklyAvailability: z.object({
    monday: z.object({ enabled: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }),
    tuesday: z.object({ enabled: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }),
    wednesday: z.object({ enabled: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }),
    thursday: z.object({ enabled: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }),
    friday: z.object({ enabled: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }),
    saturday: z.object({ enabled: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }),
    sunday: z.object({ enabled: z.boolean(), slots: z.array(z.object({ start: z.string(), end: z.string() })) }),
  }),
  dateOverrides: z.array(z.any()).default([]),
});

export const insertLandingAppointmentSchema = createInsertSchema(landingAppointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  fullName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  duration: z.number().int().min(15).max(240).default(30),
  notes: z.string().max(1000).optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]).default("pending"),
  ipAddress: z.string().max(50).optional(),
  userAgent: z.string().max(500).optional(),
});

export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;

export type LandingBlock = typeof landingBlocks.$inferSelect;
export type InsertLandingBlock = z.infer<typeof insertLandingBlockSchema>;

export type LandingAnalytics = typeof landingAnalytics.$inferSelect;
export type InsertLandingAnalytics = z.infer<typeof insertLandingAnalyticsSchema>;

export type LandingLead = typeof landingLeads.$inferSelect;
export type InsertLandingLead = z.infer<typeof insertLandingLeadSchema>;

export type LandingAppointment = typeof landingAppointments.$inferSelect;
export type InsertLandingAppointment = z.infer<typeof insertLandingAppointmentSchema>;

export type AppointmentAvailability = typeof appointmentAvailability.$inferSelect;
export type InsertAppointmentAvailability = z.infer<typeof insertAppointmentAvailabilitySchema>;

// =====================================================
// BULKVS CHAT SYSTEM (Individual user SMS/MMS messaging)
// =====================================================

// BulkVS Phone Numbers - cada usuario tiene su propio número
export const bulkvsPhoneNumbers = pgTable("bulkvs_phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  did: text("did").notNull().unique(), // E.164 format number (e.g., +17865551234)
  displayName: text("display_name"), // Friendly name for the number
  cnam: text("cnam"), // Caller ID Name (max 15 chars, alphanumeric + spaces only)
  
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  mmsEnabled: boolean("mms_enabled").notNull().default(false),
  
  campaignId: text("campaign_id"), // 10DLC campaign ID
  
  // Webhook Configuration (for incoming messages)
  webhookName: text("webhook_name"), // BulkVS webhook name/identifier
  webhookToken: text("webhook_token"), // Secure token for webhook URL validation
  webhookUrl: text("webhook_url"), // Full webhook URL
  
  // Call Forward Configuration
  callForwardEnabled: boolean("call_forward_enabled").notNull().default(false),
  callForwardNumber: text("call_forward_number"), // Phone number to forward calls to (E.164 format)
  
  // Metadata
  areaCode: text("area_code"), // NPA (e.g., "786")
  rateCenter: text("rate_center"),
  state: text("state"),
  
  status: text("status").notNull().default("active"), // active, suspended, cancelled
  
  // Billing Information (charged to user monthly)
  monthlyPrice: text("monthly_price").notNull().default("10.00"), // Fixed $10/month charged to user
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID for recurring billing
  stripeProductId: text("stripe_product_id"), // Stripe product ID
  stripePriceId: text("stripe_price_id"), // Stripe price ID
  nextBillingDate: timestamp("next_billing_date"), // Next billing date (30 days from purchase)
  billingStatus: text("billing_status").default("active"), // active, cancelled, past_due, etc.
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// BulkVS Campaigns - 10DLC campaigns
export const bulkvsCampaigns = pgTable("bulkvs_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  providerId: text("provider_id"), // Campaign ID in BulkVS/TCR
  brandId: text("brand_id"), // TCR Brand ID
  useCase: text("use_case"), // Campaign use case description
  status: text("status").notNull().default("pending"), // pending, active, suspended
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// BulkVS Threads - conversaciones con contactos externos
export const bulkvsThreads = pgTable("bulkvs_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumberId: varchar("phone_number_id").notNull().references(() => bulkvsPhoneNumbers.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  externalPhone: text("external_phone").notNull(), // E.164 contact phone
  displayName: text("display_name"), // Contact name
  
  labels: text("labels").array().default([]), // Tags ["client", "hot_lead", etc]
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  isMuted: boolean("is_muted").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false), // Block contact from sending/receiving
  
  unreadCount: integer("unread_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastMessagePreview: text("last_message_preview"), // First 100 chars of last message
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// BulkVS Messages - mensajes SMS/MMS
export const bulkvsMessages = pgTable("bulkvs_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => bulkvsThreads.id, { onDelete: "cascade" }),
  
  direction: text("direction").notNull(), // "inbound" | "outbound"
  status: text("status").notNull().default("queued"), // queued, sent, delivered, failed, read
  
  from: text("from").notNull(), // E.164 sender
  to: text("to").notNull(), // E.164 recipient
  
  body: text("body"), // Message text
  mediaUrl: text("media_url"), // MMS attachment URL
  mediaType: text("media_type"), // image/jpeg, image/png, video/mp4, etc
  
  providerMsgId: text("provider_msg_id"), // BulkVS message ID
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  readAt: timestamp("read_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Create unique index for thread lookup
export const bulkvsThreadsIndex = unique("bulkvs_threads_unique_idx").on(
  bulkvsThreads.phoneNumberId,
  bulkvsThreads.externalPhone
);

// =====================================================
// MANUAL CONTACTS (Standalone contacts added from SMS/Chat)
// =====================================================

// Manual Contacts - contactos agregados manualmente desde el chat
export const manualContacts = pgTable("manual_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Who created this contact
  
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(), // E.164 or 11-digit format
  
  status: text("status").notNull().default("Regular contact"), // Contact status: Regular contact, Contacted, Not Contacted, Blacklist
  notes: text("notes"), // Optional notes about contact
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Unique constraints
  uniqueCompanyEmail: uniqueIndex("manual_contacts_company_email_unique").on(table.companyId, table.email).where(sql`${table.email} IS NOT NULL`),
  uniqueCompanyPhone: uniqueIndex("manual_contacts_company_phone_unique").on(table.companyId, table.phone),
  // Performance indexes
  companyIdIndex: index("manual_contacts_company_id_idx").on(table.companyId),
  emailIndex: index("manual_contacts_email_idx").on(table.email),
  phoneIndex: index("manual_contacts_phone_idx").on(table.phone),
}));

// =====================================================
// UNIFIED CONTACTS (Canonical contact registry)
// =====================================================

// Contacts - Single canonical record per unique person across all sources
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Canonical identity (deduplicated across sources)
  firstName: text("first_name"),
  lastName: text("last_name"),
  displayName: text("display_name"), // Computed display name for UI
  companyName: text("company_name"), // For business contacts
  
  // Contact information (normalized)
  email: text("email"), // Lowercase, trimmed
  phoneNormalized: text("phone_normalized"), // E.164 format (+17865551234)
  phoneDisplay: text("phone_display"), // Original format for display
  
  // Metadata
  notes: text("notes"),
  tags: text("tags").array(), // Array of tags for filtering
  lastContactedAt: timestamp("last_contacted_at"),
  
  // Email bounce tracking
  emailBounced: boolean("email_bounced").notNull().default(false), // True if email has bounced
  emailBouncedAt: timestamp("email_bounced_at"), // When the bounce was detected
  emailBounceReason: text("email_bounce_reason"), // Reason for bounce if available
  
  // Telegram fields
  telegramUserId: text("telegram_user_id"), // Telegram user ID
  telegramUsername: text("telegram_username"), // @username
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraints - one canonical contact per phone/email per company
  uniqueCompanyEmail: uniqueIndex("contacts_company_email_unique").on(table.companyId, table.email).where(sql`${table.email} IS NOT NULL`),
  uniqueCompanyPhone: uniqueIndex("contacts_company_phone_unique").on(table.companyId, table.phoneNormalized).where(sql`${table.phoneNormalized} IS NOT NULL`),
  uniqueCompanyTelegramUserId: uniqueIndex("contacts_company_telegram_user_id_unique").on(table.companyId, table.telegramUserId).where(sql`${table.telegramUserId} IS NOT NULL`),
  // Performance indexes
  companyIdIndex: index("contacts_company_id_idx").on(table.companyId),
  emailIndex: index("contacts_email_idx").on(table.email),
  phoneIndex: index("contacts_phone_normalized_idx").on(table.phoneNormalized),
  emailBouncedIndex: index("contacts_email_bounced_idx").on(table.emailBounced),
}));

// Contact Sources - Track where each contact appears (quote, policy, lead, SMS, etc.)
export const contactSources = pgTable("contact_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Source information
  sourceType: text("source_type").notNull(), // "quote", "policy", "lead", "sms_inbound", "manual", "imessage_inbound"
  sourceId: text("source_id").notNull(), // ID of the source record (quoteId, policyId, leadId, messageId, etc.)
  sourceName: text("source_name"), // Human-readable source name for display
  
  // Source-specific data (stored as JSON for flexibility)
  sourceData: jsonb("source_data"), // Original data from source (firstName, lastName, role, etc.)
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint - one source entry per contact+source combination
  uniqueContactSource: uniqueIndex("contact_sources_unique").on(table.contactId, table.sourceType, table.sourceId),
  // Performance indexes
  contactIdIndex: index("contact_sources_contact_id_idx").on(table.contactId),
  companyIdIndex: index("contact_sources_company_id_idx").on(table.companyId),
  sourceTypeIndex: index("contact_sources_source_type_idx").on(table.sourceType),
  sourceIdIndex: index("contact_sources_source_id_idx").on(table.sourceId),
}));

// Insert schemas
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email().toLowerCase().optional(),
  phoneNormalized: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format").optional(),
  tags: z.array(z.string()).optional(),
});

export const insertContactSourceSchema = createInsertSchema(contactSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  sourceType: z.enum(["quote", "policy", "lead", "sms_inbound", "manual", "imessage_inbound"]),
  sourceData: z.record(z.any()).optional(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type ContactSource = typeof contactSources.$inferSelect;
export type InsertContactSource = z.infer<typeof insertContactSourceSchema>;

// =====================================================
// BLACKLIST (Multi-channel communication blocking)
// =====================================================

export const blacklistEntries = pgTable("blacklist_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Multi-channel support
  channel: text("channel").notNull(), // "sms", "imessage", "email", "all"
  identifier: text("identifier").notNull(), // Normalized: E.164 for phone, lowercase trimmed for email
  
  // Lifecycle
  isActive: boolean("is_active").notNull().default(true),
  reason: text("reason").notNull(), // "stop", "manual", "bounced", "complaint"
  
  // Metadata
  addedBy: varchar("added_by").references(() => users.id), // User who added (null for auto)
  removedBy: varchar("removed_by").references(() => users.id), // User who removed
  sourceMessageId: varchar("source_message_id"), // Link to message that triggered STOP
  notes: text("notes"), // Admin notes
  metadata: jsonb("metadata"), // Additional context
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
}, (table) => ({
  // Partial unique index: only one active entry per company+channel+identifier
  uniqueActiveEntry: uniqueIndex("blacklist_active_unique").on(table.companyId, table.channel, table.identifier).where(sql`${table.isActive} = true`),
  // Performance indexes
  companyIdIndex: index("blacklist_company_id_idx").on(table.companyId),
  identifierIndex: index("blacklist_identifier_idx").on(table.identifier),
  channelIndex: index("blacklist_channel_idx").on(table.channel),
  isActiveIndex: index("blacklist_is_active_idx").on(table.isActive),
}));

// Insert schemas
export const insertBlacklistEntrySchema = createInsertSchema(blacklistEntries).omit({
  id: true,
  createdAt: true,
  removedAt: true,
}).extend({
  channel: z.enum(["sms", "imessage", "email", "all"]),
  identifier: z.string().min(1, "Identifier is required"),
  reason: z.enum(["stop", "manual", "bounced", "complaint"]),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type BlacklistEntry = typeof blacklistEntries.$inferSelect;
export type InsertBlacklistEntry = z.infer<typeof insertBlacklistEntrySchema>;

// Contact Engagements - Track contact campaign history
export const contactEngagements = pgTable("contact_engagements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => manualContacts.id, { onDelete: "cascade" }),
  
  campaignType: text("campaign_type").notNull(), // "email", "sms", "call", "meeting", etc.
  campaignId: varchar("campaign_id"), // Reference to campaign ID (email/sms campaign)
  campaignName: text("campaign_name"), // Campaign name for quick reference
  
  status: text("status").notNull(), // "sent", "opened", "clicked", "replied", "bounced", "unsubscribed"
  engagementDate: timestamp("engagement_date", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"), // Additional campaign-specific data
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Indexes for performance
  contactIdIndex: index("contact_engagements_contact_id_idx").on(table.contactId),
  companyIdIndex: index("contact_engagements_company_id_idx").on(table.companyId),
  engagementDateIndex: index("contact_engagements_date_idx").on(table.engagementDate),
}));

// Insert schemas
export const insertContactEngagementSchema = createInsertSchema(contactEngagements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  campaignType: z.enum(["email", "sms", "call", "meeting", "other"]),
  status: z.enum(["sent", "opened", "clicked", "replied", "bounced", "unsubscribed"]),
  metadata: z.record(z.any()).optional(),
});

export type ContactEngagement = typeof contactEngagements.$inferSelect;
export type InsertContactEngagement = z.infer<typeof insertContactEngagementSchema>;

// Insert schemas
export const insertBulkvsPhoneNumberSchema = createInsertSchema(bulkvsPhoneNumbers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  did: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g., +17865551234)"),
  smsEnabled: z.boolean().default(false),
  mmsEnabled: z.boolean().default(false),
  status: z.enum(["active", "suspended", "cancelled"]).default("active"),
});

export const insertBulkvsCampaignSchema = createInsertSchema(bulkvsCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1).max(200),
  status: z.enum(["pending", "active", "suspended"]).default("pending"),
});

export const insertBulkvsThreadSchema = createInsertSchema(bulkvsThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  externalPhone: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format"),
  unreadCount: z.number().int().min(0).default(0),
});

export const insertBulkvsMessageSchema = createInsertSchema(bulkvsMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  readAt: true,
  deliveredAt: true,
}).extend({
  direction: z.enum(["inbound", "outbound"]),
  status: z.enum(["queued", "sent", "delivered", "failed", "read"]).default("queued"),
  from: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format"),
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format"),
  body: z.string().max(1600).optional(), // SMS limit
});

export const insertManualContactSchema = createInsertSchema(manualContacts).omit({
  id: true,
  companyId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone number is required"),
  status: z.enum(["Regular contact", "Contacted", "Not Contacted", "Blacklist"]).default("Regular contact"),
  notes: z.string().max(500).optional(),
});

// =====================================================
// TASKS (Task Management System)
// =====================================================

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  
  title: text("title").notNull(),
  description: text("description"),
  
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  
  dueDate: text("due_date").notNull(), // yyyy-MM-dd format
  completedAt: timestamp("completed_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  companyId: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  assigneeId: z.string().uuid("Invalid user ID").optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
});

export const updateTaskSchema = insertTaskSchema.partial();

// Types
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;

// =====================================================
// BIRTHDAY AUTOMATION SYSTEM
// =====================================================

// Birthday Images - Admin uploads images for users to select
export const birthdayImages = pgTable("birthday_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Display name for the image
  imageUrl: text("image_url").notNull(), // URL to the uploaded image
  isActive: boolean("is_active").notNull().default(true), // Can be disabled without deleting
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id), // Superadmin who uploaded
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// User Birthday Settings - Each user's personalized birthday greeting configuration
export const userBirthdaySettings = pgTable("user_birthday_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  isEnabled: boolean("is_enabled").notNull().default(true), // Master on/off switch
  selectedImageId: varchar("selected_image_id").references(() => birthdayImages.id, { onDelete: "set null" }), // Selected birthday image
  customMessage: text("custom_message").default("Happy Birthday! Wishing you a wonderful day filled with joy and happiness!"), // Personalized message
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Birthday Greeting History - Track all sent birthday greetings
export const birthdayGreetingHistory = pgTable("birthday_greeting_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // User who sent (or system sent on behalf of)
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  recipientName: text("recipient_name").notNull(), // Name of birthday person
  recipientPhone: text("recipient_phone").notNull(), // Phone number sent to
  recipientDateOfBirth: text("recipient_date_of_birth").notNull(), // DOB of recipient
  
  message: text("message").notNull(), // The actual message sent
  imageUrl: text("image_url"), // Image URL that was sent (snapshot for history)
  
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
  twilioMessageSid: text("twilio_message_sid"), // Twilio message ID for tracking
  twilioImageSid: text("twilio_image_sid"), // Twilio MMS image message ID
  errorMessage: text("error_message"), // Error details if failed
  
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Birthday Pending Messages - Track MMS awaiting delivery confirmation before sending SMS
export const birthdayPendingMessages = pgTable("birthday_pending_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  greetingHistoryId: varchar("greeting_history_id").notNull().references(() => birthdayGreetingHistory.id, { onDelete: "cascade" }),
  
  mmsSid: text("mms_sid").unique(), // Twilio MMS message SID (nullable, set after MMS is sent)
  smsBody: text("sms_body").notNull(), // Text message to send after MMS delivery
  recipientPhone: text("recipient_phone").notNull(),
  recipientName: text("recipient_name").notNull(),
  imageUrl: text("image_url"),
  
  status: text("status").notNull().default("pending_mms"), // pending_mms, delivered, failed, completed
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Zod Schemas
export const insertBirthdayImageSchema = createInsertSchema(birthdayImages).omit({
  id: true,
  uploadedBy: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Image name is required").max(200),
  imageUrl: z.string().url("Invalid image URL"),
  isActive: z.boolean().default(true),
});

export const insertUserBirthdaySettingsSchema = createInsertSchema(userBirthdaySettings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  isEnabled: z.boolean().default(true),
  selectedImageId: z.string().uuid().optional().nullable(),
  customMessage: z.string().max(500).default("Happy Birthday! Wishing you a wonderful day filled with joy and happiness!"),
});

export const insertBirthdayGreetingHistorySchema = createInsertSchema(birthdayGreetingHistory).omit({
  id: true,
  userId: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
  deliveredAt: true,
}).extend({
  recipientName: z.string().min(1, "Recipient name is required"),
  recipientPhone: z.string().min(10, "Valid phone number is required"),
  recipientDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in yyyy-MM-dd format"),
  message: z.string().min(1, "Message is required"),
  status: z.enum(["pending", "sent", "delivered", "failed"]).default("pending"),
});

export const insertBirthdayPendingMessageSchema = createInsertSchema(birthdayPendingMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  attemptCount: true,
  lastAttemptAt: true,
}).extend({
  greetingHistoryId: z.string().uuid(),
  mmsSid: z.string().min(1, "MMS SID is required"),
  smsBody: z.string().min(1, "SMS body is required"),
  recipientPhone: z.string().min(10, "Valid phone number is required"),
  recipientName: z.string().min(1, "Recipient name is required"),
  status: z.enum(["pending", "delivered", "failed", "completed"]).default("pending"),
});

// Types
export type BirthdayImage = typeof birthdayImages.$inferSelect;
export type InsertBirthdayImage = z.infer<typeof insertBirthdayImageSchema>;

export type UserBirthdaySettings = typeof userBirthdaySettings.$inferSelect;
export type InsertUserBirthdaySettings = z.infer<typeof insertUserBirthdaySettingsSchema>;

export type BirthdayGreetingHistory = typeof birthdayGreetingHistory.$inferSelect;
export type InsertBirthdayGreetingHistory = z.infer<typeof insertBirthdayGreetingHistorySchema>;

export type BirthdayPendingMessage = typeof birthdayPendingMessages.$inferSelect;
export type InsertBirthdayPendingMessage = z.infer<typeof insertBirthdayPendingMessageSchema>;

export type ManualContact = typeof manualContacts.$inferSelect;
export type InsertManualContact = z.infer<typeof insertManualContactSchema>;

export type BulkvsPhoneNumber = typeof bulkvsPhoneNumbers.$inferSelect;
export type InsertBulkvsPhoneNumber = z.infer<typeof insertBulkvsPhoneNumberSchema>;

export type BulkvsCampaign = typeof bulkvsCampaigns.$inferSelect;
export type InsertBulkvsCampaign = z.infer<typeof insertBulkvsCampaignSchema>;

export type BulkvsThread = typeof bulkvsThreads.$inferSelect;
export type InsertBulkvsThread = z.infer<typeof insertBulkvsThreadSchema>;

export type BulkvsMessage = typeof bulkvsMessages.$inferSelect;
export type InsertBulkvsMessage = z.infer<typeof insertBulkvsMessageSchema>;

// =====================================================
// UNIFIED CONTACT (Aggregated contact view)
// =====================================================

export type UnifiedContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  ssn: string | null;
  dateOfBirth: string | null;
  status: string[];
  productType: (string | null)[];
  origin: ('quote' | 'policy' | 'user' | 'sms' | 'manual')[];
  companyId: string | null;
  companyName: string | null;
  sourceMetadata: {
    type: 'quote' | 'policy' | 'user' | 'sms' | 'manual';
    id: string;
    details: any;
  }[];
};

// =====================================================
// iMESSAGE SYSTEM (BlueBubbles Integration)
// =====================================================

export const imessageConversations = pgTable("imessage_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // BlueBubbles chat data
  chatGuid: text("chat_guid").notNull(), // e.g., "iMessage;-;+1234567890"
  displayName: text("display_name"),
  participants: text("participants").array(), // Phone numbers/emails of participants
  
  // Contact information
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  
  // Status
  status: text("status").notNull().default("active"), // active, archived, closed
  isPinned: boolean("is_pinned").notNull().default(false),
  isGroup: boolean("is_group").notNull().default(false),
  
  // Message type detection
  isImessage: boolean("is_imessage").default(true), // true = blue (iMessage), false = green (SMS/RCS)
  
  // User assignment
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  
  // Last message info (for display in list)
  lastMessageText: text("last_message_text"),
  lastMessageAt: timestamp("last_message_at"),
  lastMessageFromMe: boolean("last_message_from_me").default(false),
  
  // Unread tracking
  unreadCount: integer("unread_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Enforce unique chat per company
  uniqueChatPerCompany: unique().on(table.companyId, table.chatGuid),
  // Indexes for performance
  companyIdIdx: index("imessage_conversations_company_id_idx").on(table.companyId),
  chatGuidIdx: index("imessage_conversations_chat_guid_idx").on(table.chatGuid),
  assignedToIdx: index("imessage_conversations_assigned_to_idx").on(table.assignedTo),
  updatedAtIdx: index("imessage_conversations_updated_at_idx").on(table.updatedAt),
}));

export const imessageMessages = pgTable("imessage_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => imessageConversations.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // BlueBubbles message data
  messageGuid: text("message_guid").notNull(), // BlueBubbles message ID (unique per company, not globally)
  chatGuid: text("chat_guid").notNull(), // Reference to chat
  
  // Message content
  text: text("text"),
  subject: text("subject"), // iMessage subject line
  
  // Sender information
  fromMe: boolean("from_me").notNull().default(false), // true if sent by us, false if received
  senderHandle: text("sender_handle"), // Phone number/email of sender
  senderName: text("sender_name"),
  
  // Message status (for outgoing messages)
  status: text("status").notNull().default("sent"), // sending, sent, delivered, read, failed
  errorMessage: text("error_message"), // If status is 'failed'
  
  // Message type
  isImessage: boolean("is_imessage").default(true), // true = blue (iMessage), false = green (SMS/RCS)
  
  // Attachments
  hasAttachments: boolean("has_attachments").notNull().default(false),
  attachments: jsonb("attachments").default([]), // Array of attachment URLs/metadata
  
  // iMessage features (requires Private API)
  expressiveType: text("expressive_type"), // e.g., "com.apple.MobileSMS.expressivesend.impact" (slam, loud, etc.)
  reactionType: text("reaction_type"), // love, like, dislike, laugh, emphasize, question
  replyToGuid: text("reply_to_guid"), // Message this is replying to
  
  // Timestamps
  dateSent: timestamp("date_sent"), // When message was sent (from BlueBubbles)
  dateRead: timestamp("date_read"), // When message was read
  dateDelivered: timestamp("date_delivered"), // When message was delivered
  
  // Metadata
  metadata: jsonb("metadata").default({}), // Additional BlueBubbles metadata
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Enforce uniqueness scoped to company (multi-tenant safe)
  uniqueMessagePerCompany: unique().on(table.companyId, table.messageGuid),
  // Indexes for high-value access paths
  conversationIdIdx: index("imessage_messages_conversation_id_idx").on(table.conversationId),
  companyIdIdx: index("imessage_messages_company_id_idx").on(table.companyId),
  chatGuidIdx: index("imessage_messages_chat_guid_idx").on(table.chatGuid),
  companyMessageGuidIdx: index("imessage_messages_company_message_guid_idx").on(table.companyId, table.messageGuid),
  dateSentIdx: index("imessage_messages_date_sent_idx").on(table.dateSent),
  // Index for listing conversation messages ordered by date
  conversationDateIdx: index("imessage_messages_conversation_date_idx").on(table.conversationId, table.dateSent),
}));

// Zod validation schemas
export const insertImessageConversationSchema = createInsertSchema(imessageConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  chatGuid: z.string().min(1, "Chat GUID is required"),
  companyId: z.string().uuid(),
  status: z.enum(["active", "archived", "closed"]).default("active"),
  isPinned: z.boolean().default(false),
  isGroup: z.boolean().default(false),
  isImessage: z.boolean().default(true),
});

export const insertImessageMessageSchema = createInsertSchema(imessageMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  messageGuid: z.string().min(1, "Message GUID is required"),
  chatGuid: z.string().min(1, "Chat GUID is required"),
  conversationId: z.string().uuid(),
  companyId: z.string().uuid(),
  text: z.string().optional().nullable(),
  fromMe: z.boolean().default(false),
  status: z.enum(["sending", "sent", "delivered", "read", "failed"]).default("sent"),
  isImessage: z.boolean().default(true),
  hasAttachments: z.boolean().default(false),
});

// Types
export type ImessageConversation = typeof imessageConversations.$inferSelect;
export type InsertImessageConversation = z.infer<typeof insertImessageConversationSchema>;

export type ImessageMessage = typeof imessageMessages.$inferSelect;
export type InsertImessageMessage = z.infer<typeof insertImessageMessageSchema>;

// =====================================================
// IMESSAGE CAMPAIGNS (Premium Feature)
// =====================================================

export const imessageCampaigns = pgTable("imessage_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  
  // Message content
  messageBody: text("message_body").notNull(), // The predetermined message text
  
  // Target audience
  targetListId: varchar("target_list_id").references(() => contactLists.id, { onDelete: "set null" }), // null = all contacts
  
  // Status and scheduling
  status: text("status").notNull().default("draft"), // draft, scheduled, running, paused, completed, stopped, failed
  scheduleType: text("schedule_type").notNull().default("immediate"), // immediate, scheduled
  scheduledAt: timestamp("scheduled_at"), // When to start sending
  
  // Campaign Studio fields
  templateId: varchar("template_id").references(() => campaignTemplates.id, { onDelete: "set null" }),
  personalizedFields: jsonb("personalized_fields").default(sql`'[]'::jsonb`),
  complianceScore: integer("compliance_score"), // 0-100
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  companyIdx: index("imessage_campaigns_company_idx").on(table.companyId),
  statusIdx: index("imessage_campaigns_status_idx").on(table.status),
  companyStatusIdx: index("imessage_campaigns_company_status_idx").on(table.companyId, table.status),
}));

export const imessageCampaignRuns = pgTable("imessage_campaign_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => imessageCampaigns.id, { onDelete: "cascade" }),
  runNumber: integer("run_number").notNull(), // Sequential run number for this campaign
  
  // Run metadata
  initiatedBy: varchar("initiated_by").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("running"), // running, paused, completed, stopped, failed
  
  // Statistics
  totalContacts: integer("total_contacts").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0), // Blacklisted or invalid
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdx: index("imessage_campaign_runs_campaign_idx").on(table.campaignId),
  statusIdx: index("imessage_campaign_runs_status_idx").on(table.status),
  uniqueRunNumber: unique("imessage_campaign_runs_campaign_run_unique").on(table.campaignId, table.runNumber),
}));

export const imessageCampaignMessages = pgTable("imessage_campaign_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => imessageCampaignRuns.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => manualContacts.id, { onDelete: "cascade" }),
  
  // iMessage details
  chatGuid: text("chat_guid"), // iMessage chat GUID (e.g., "iMessage;-;+13105551234")
  phone: text("phone").notNull(), // Normalized phone number
  messageGuid: text("message_guid"), // BlueBubbles message GUID (returned after sending)
  
  // Delivery status
  sendStatus: text("send_status").notNull().default("pending"), // pending, queued, sent, delivered, failed, skipped
  attemptedAt: timestamp("attempted_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").notNull().default(0),
  
  // Additional metadata
  metadata: jsonb("metadata").default({}), // Any extra data (e.g., user agent, device info)
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  runIdx: index("imessage_campaign_messages_run_idx").on(table.runId),
  statusIdx: index("imessage_campaign_messages_status_idx").on(table.sendStatus),
  runStatusIdx: index("imessage_campaign_messages_run_status_idx").on(table.runId, table.sendStatus),
  contactIdx: index("imessage_campaign_messages_contact_idx").on(table.contactId),
  uniqueRecipient: unique("imessage_campaign_messages_run_contact_unique").on(table.runId, table.contactId),
}));

// Zod validation schemas
export const insertImessageCampaignSchema = createInsertSchema(imessageCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  companyId: z.string().uuid(),
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().optional().nullable(),
  messageBody: z.string().min(1, "Message body is required"),
  targetListId: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "scheduled", "running", "paused", "completed", "stopped", "failed"]).default("draft"),
  scheduleType: z.enum(["immediate", "scheduled"]).default("immediate"),
  scheduledAt: z.string().optional().nullable(), // ISO date string
  createdBy: z.string().uuid().optional().nullable(),
});

export const insertImessageCampaignRunSchema = createInsertSchema(imessageCampaignRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  campaignId: z.string().uuid(),
  runNumber: z.number().int().positive(),
  initiatedBy: z.string().uuid().optional().nullable(),
  status: z.enum(["running", "paused", "completed", "stopped", "failed"]).default("running"),
  totalContacts: z.number().int().nonnegative().default(0),
  sentCount: z.number().int().nonnegative().default(0),
  deliveredCount: z.number().int().nonnegative().default(0),
  failedCount: z.number().int().nonnegative().default(0),
  skippedCount: z.number().int().nonnegative().default(0),
});

export const insertImessageCampaignMessageSchema = createInsertSchema(imessageCampaignMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  runId: z.string().uuid(),
  contactId: z.string().uuid(),
  chatGuid: z.string().optional().nullable(),
  phone: z.string().min(1, "Phone number is required"),
  messageGuid: z.string().optional().nullable(),
  sendStatus: z.enum(["pending", "queued", "sent", "delivered", "failed", "skipped"]).default("pending"),
  retryCount: z.number().int().nonnegative().default(0),
});

// Types
export type ImessageCampaign = typeof imessageCampaigns.$inferSelect;
export type InsertImessageCampaign = z.infer<typeof insertImessageCampaignSchema>;

export type ImessageCampaignRun = typeof imessageCampaignRuns.$inferSelect;
export type InsertImessageCampaignRun = z.infer<typeof insertImessageCampaignRunSchema>;

export type ImessageCampaignMessage = typeof imessageCampaignMessages.$inferSelect;
export type InsertImessageCampaignMessage = z.infer<typeof insertImessageCampaignMessageSchema>;

// =====================================================
// CAMPAIGN STUDIO TABLES
// =====================================================

// 1. Campaign Template Categories
export const campaignTemplateCategories = pgTable("campaign_template_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }), // null = global category
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"), // Icon identifier (e.g., Lucide icon name)
  displayOrder: integer("display_order").notNull().default(0),
  isSystem: boolean("is_system").notNull().default(false), // System categories cannot be deleted
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  companyIdx: index("campaign_template_categories_company_idx").on(table.companyId),
  systemIdx: index("campaign_template_categories_system_idx").on(table.isSystem),
}));

// 2. Campaign Templates
export const campaignTemplates = pgTable("campaign_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }), // null = system template (available to all companies)
  categoryId: varchar("category_id").references(() => campaignTemplateCategories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  messageBody: text("message_body").notNull(),
  placeholders: jsonb("placeholders").default(sql`'[]'::jsonb`), // Array of placeholder names used in template
  mediaUrls: jsonb("media_urls").default(sql`'[]'::jsonb`), // Array of media URLs
  isSystem: boolean("is_system").notNull().default(false), // System templates cannot be deleted
  usageCount: integer("usage_count").notNull().default(0), // How many times this template has been used
  performanceScore: numeric("performance_score"), // Average performance score (0-100)
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  companyIdx: index("campaign_templates_company_idx").on(table.companyId),
  categoryIdx: index("campaign_templates_category_idx").on(table.categoryId),
  isSystemIdx: index("campaign_templates_system_idx").on(table.isSystem),
  companySystemIdx: index("campaign_templates_company_system_idx").on(table.companyId, table.isSystem),
}));

// 3. Campaign Variants (A/B Testing)
export const campaignVariants = pgTable("campaign_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => imessageCampaigns.id, { onDelete: "cascade" }),
  variantLetter: text("variant_letter").notNull(), // A, B, C, D, E
  messageBody: text("message_body").notNull(),
  mediaUrls: jsonb("media_urls").default(sql`'[]'::jsonb`),
  splitPercentage: integer("split_percentage").notNull(), // 0-100
  sentCount: integer("sent_count").notNull().default(0),
  responseCount: integer("response_count").notNull().default(0),
  responseRate: numeric("response_rate"), // Calculated response rate
  conversionCount: integer("conversion_count").notNull().default(0),
  isWinner: boolean("is_winner").notNull().default(false), // Winning variant in A/B test
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdx: index("campaign_variants_campaign_idx").on(table.campaignId),
  winnerIdx: index("campaign_variants_winner_idx").on(table.isWinner),
  uniqueVariant: unique("campaign_variants_campaign_variant_unique").on(table.campaignId, table.variantLetter),
}));

// 4. Campaign Schedules (1:1 with campaigns)
export const campaignSchedules = pgTable("campaign_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().unique().references(() => imessageCampaigns.id, { onDelete: "cascade" }),
  scheduleType: text("schedule_type").notNull().default("immediate"), // immediate, scheduled, recurring
  startDate: date("start_date"),
  startTime: text("start_time"), // HH:MM format (using text for time)
  timezone: text("timezone").default("UTC"),
  recurrenceRule: jsonb("recurrence_rule"), // Cron-like rules for recurring campaigns
  endDate: date("end_date"),
  quietHoursStart: text("quiet_hours_start"), // HH:MM format
  quietHoursEnd: text("quiet_hours_end"), // HH:MM format
  rateLimit: integer("rate_limit"), // Messages per hour
  throttleDelayMin: integer("throttle_delay_min"), // Minimum delay in seconds between messages
  throttleDelayMax: integer("throttle_delay_max"), // Maximum delay in seconds between messages
  respectContactTimezone: boolean("respect_contact_timezone").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdx: uniqueIndex("campaign_schedules_campaign_idx").on(table.campaignId),
  scheduleTypeIdx: index("campaign_schedules_type_idx").on(table.scheduleType),
}));

// 5. Campaign Followups
export const campaignFollowups = pgTable("campaign_followups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => imessageCampaigns.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(), // Order of followup (1, 2, 3, etc.)
  triggerType: text("trigger_type").notNull(), // no_response, response_positive, response_negative, time_delay
  waitDays: integer("wait_days").notNull().default(0),
  waitHours: integer("wait_hours").notNull().default(0),
  messageBody: text("message_body").notNull(),
  mediaUrls: jsonb("media_urls").default(sql`'[]'::jsonb`),
  targetSegment: text("target_segment").notNull().default("all"), // responded, not_responded, all
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdx: index("campaign_followups_campaign_idx").on(table.campaignId),
  triggerTypeIdx: index("campaign_followups_trigger_idx").on(table.triggerType),
  isActiveIdx: index("campaign_followups_active_idx").on(table.isActive),
}));

// 6. Campaign Analytics (Time-series snapshots)
export const campaignAnalytics = pgTable("campaign_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => imessageCampaigns.id, { onDelete: "cascade" }),
  snapshotType: text("snapshot_type").notNull(), // hourly, daily, final
  snapshotAt: timestamp("snapshot_at").notNull(),
  totalSent: integer("total_sent").notNull().default(0),
  totalDelivered: integer("total_delivered").notNull().default(0),
  totalFailed: integer("total_failed").notNull().default(0),
  totalResponded: integer("total_responded").notNull().default(0),
  responseRate: numeric("response_rate"), // Calculated percentage
  avgResponseTime: integer("avg_response_time"), // Average time to response in minutes
  conversions: integer("conversions").notNull().default(0),
  revenue: numeric("revenue"), // Revenue generated from campaign
  topPerformingVariant: varchar("top_performing_variant"), // Variant ID with best performance
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  campaignIdx: index("campaign_analytics_campaign_idx").on(table.campaignId),
  snapshotTypeIdx: index("campaign_analytics_snapshot_type_idx").on(table.snapshotType),
  campaignSnapshotIdx: index("campaign_analytics_campaign_snapshot_idx").on(table.campaignId, table.snapshotAt),
}));

// 7. Campaign Placeholders (Dynamic field mapping)
export const campaignPlaceholders = pgTable("campaign_placeholders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }), // null = system placeholder
  name: text("name").notNull(), // e.g., "firstName"
  label: text("label").notNull(), // e.g., "First Name" (display name)
  fieldPath: text("field_path").notNull(), // e.g., "contact.firstName" (JSON path to data)
  fallbackValue: text("fallback_value"), // Default value if field is empty
  dataType: text("data_type").notNull().default("string"), // string, number, date
  isSystem: boolean("is_system").notNull().default(false), // System placeholders cannot be deleted
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  companyIdx: index("campaign_placeholders_company_idx").on(table.companyId),
  isSystemIdx: index("campaign_placeholders_system_idx").on(table.isSystem),
  isActiveIdx: index("campaign_placeholders_active_idx").on(table.isActive),
  companySystemActiveIdx: index("campaign_placeholders_company_system_active_idx").on(table.companyId, table.isSystem, table.isActive),
}));

// =====================================================
// CAMPAIGN STUDIO ZOD SCHEMAS
// =====================================================

// Campaign Template Categories
export const insertCampaignTemplateCategorySchema = createInsertSchema(campaignTemplateCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  companyId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  displayOrder: z.number().int().nonnegative().default(0),
  isSystem: z.boolean().default(false),
});

// Campaign Templates
export const insertCampaignTemplateSchema = createInsertSchema(campaignTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  performanceScore: true,
}).extend({
  companyId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().optional().nullable(),
  messageBody: z.string().min(1, "Message body is required"),
  placeholders: z.array(z.string()).default([]),
  mediaUrls: z.array(z.string().url()).default([]),
  isSystem: z.boolean().default(false),
  createdBy: z.string().uuid().optional().nullable(),
});

// Campaign Variants
export const insertCampaignVariantSchema = createInsertSchema(campaignVariants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentCount: true,
  responseCount: true,
  responseRate: true,
  conversionCount: true,
}).extend({
  campaignId: z.string().uuid(),
  variantLetter: z.enum(["A", "B", "C", "D", "E"]),
  messageBody: z.string().min(1, "Message body is required"),
  mediaUrls: z.array(z.string().url()).default([]),
  splitPercentage: z.number().int().min(0).max(100),
  isWinner: z.boolean().default(false),
});

// Campaign Schedules
export const insertCampaignScheduleSchema = createInsertSchema(campaignSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  campaignId: z.string().uuid(),
  scheduleType: z.enum(["immediate", "scheduled", "recurring"]).default("immediate"),
  startDate: z.string().optional().nullable(), // ISO date string
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(), // HH:MM format
  timezone: z.string().default("UTC"),
  recurrenceRule: z.record(z.any()).optional().nullable(),
  endDate: z.string().optional().nullable(),
  quietHoursStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  quietHoursEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
  rateLimit: z.number().int().positive().optional().nullable(),
  throttleDelayMin: z.number().int().nonnegative().optional().nullable(),
  throttleDelayMax: z.number().int().nonnegative().optional().nullable(),
  respectContactTimezone: z.boolean().default(false),
});

// Campaign Followups
export const insertCampaignFollowupSchema = createInsertSchema(campaignFollowups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  campaignId: z.string().uuid(),
  sequence: z.number().int().positive(),
  triggerType: z.enum(["no_response", "response_positive", "response_negative", "time_delay"]),
  waitDays: z.number().int().nonnegative().default(0),
  waitHours: z.number().int().nonnegative().default(0),
  messageBody: z.string().min(1, "Message body is required"),
  mediaUrls: z.array(z.string().url()).default([]),
  targetSegment: z.enum(["responded", "not_responded", "all"]).default("all"),
  isActive: z.boolean().default(true),
});

// Campaign Analytics
export const insertCampaignAnalyticsSchema = createInsertSchema(campaignAnalytics).omit({
  id: true,
  createdAt: true,
  responseRate: true,
}).extend({
  campaignId: z.string().uuid(),
  snapshotType: z.enum(["hourly", "daily", "final"]),
  snapshotAt: z.string(), // ISO timestamp string
  totalSent: z.number().int().nonnegative().default(0),
  totalDelivered: z.number().int().nonnegative().default(0),
  totalFailed: z.number().int().nonnegative().default(0),
  totalResponded: z.number().int().nonnegative().default(0),
  avgResponseTime: z.number().int().nonnegative().optional().nullable(),
  conversions: z.number().int().nonnegative().default(0),
  revenue: z.number().nonnegative().optional().nullable(),
  topPerformingVariant: z.string().uuid().optional().nullable(),
});

// Campaign Placeholders
export const insertCampaignPlaceholderSchema = createInsertSchema(campaignPlaceholders).omit({
  id: true,
  createdAt: true,
}).extend({
  companyId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Placeholder name is required").max(50),
  label: z.string().min(1, "Label is required").max(100),
  fieldPath: z.string().min(1, "Field path is required"),
  fallbackValue: z.string().optional().nullable(),
  dataType: z.enum(["string", "number", "date"]).default("string"),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// =====================================================
// CAMPAIGN STUDIO TYPES
// =====================================================

// Campaign Template Categories
export type CampaignTemplateCategory = typeof campaignTemplateCategories.$inferSelect;
export type InsertCampaignTemplateCategory = z.infer<typeof insertCampaignTemplateCategorySchema>;

// Campaign Templates
export type CampaignTemplate = typeof campaignTemplates.$inferSelect;
export type InsertCampaignTemplate = z.infer<typeof insertCampaignTemplateSchema>;

// Campaign Variants
export type CampaignVariant = typeof campaignVariants.$inferSelect;
export type InsertCampaignVariant = z.infer<typeof insertCampaignVariantSchema>;

// Campaign Schedules
export type CampaignSchedule = typeof campaignSchedules.$inferSelect;
export type InsertCampaignSchedule = z.infer<typeof insertCampaignScheduleSchema>;

// Campaign Followups
export type CampaignFollowup = typeof campaignFollowups.$inferSelect;
export type InsertCampaignFollowup = z.infer<typeof insertCampaignFollowupSchema>;

// Campaign Analytics
export type CampaignAnalytics = typeof campaignAnalytics.$inferSelect;
export type InsertCampaignAnalytics = z.infer<typeof insertCampaignAnalyticsSchema>;

// Campaign Placeholders
export type CampaignPlaceholder = typeof campaignPlaceholders.$inferSelect;
export type InsertCampaignPlaceholder = z.infer<typeof insertCampaignPlaceholderSchema>;

// =====================================================
// CHANNEL CONNECTIONS (Multi-tenant Social Media Integrations)
// WhatsApp Cloud API, Instagram, Facebook, TikTok
// =====================================================

export const channelTypeEnum = pgEnum("channel_type", ["whatsapp", "instagram", "facebook", "tiktok", "telegram"]);
export const channelStatusEnum = pgEnum("channel_status", ["pending", "active", "error", "revoked"]);
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound", "system"]);
export const messageStatusEnum = pgEnum("wa_message_status", ["queued", "sent", "delivered", "read", "failed"]);

export const channelConnections = pgTable("channel_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  channel: channelTypeEnum("channel").notNull(),
  status: channelStatusEnum("status").notNull().default("pending"),
  
  // WhatsApp fields
  wabaId: text("waba_id"),
  phoneNumberId: text("phone_number_id"),
  phoneNumberE164: text("phone_number_e164"),
  displayName: text("display_name"),
  
  // Instagram fields
  igUserId: text("ig_user_id"),
  igUsername: text("ig_username"),
  pageId: text("page_id"),
  pageName: text("page_name"),
  
  // Facebook Messenger fields
  fbPageId: text("fb_page_id"),
  fbPageName: text("fb_page_name"),
  fbPageAccessToken: text("fb_page_access_token"),
  
  // TikTok Login Kit fields
  tiktokOpenId: text("tiktok_open_id"),
  tiktokUsername: text("tiktok_username"),
  tiktokDisplayName: text("tiktok_display_name"),
  tiktokAvatarUrl: text("tiktok_avatar_url"),
  tiktokRefreshTokenEnc: text("tiktok_refresh_token_enc"),
  
  accessTokenEnc: text("access_token_enc"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: jsonb("scopes").$type<string[]>(),
  
  webhookSecret: text("webhook_secret"),
  metadata: jsonb("metadata"),
  
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyChannelUnique: unique().on(table.companyId, table.channel),
  phoneNumberIdUnique: unique().on(table.phoneNumberId),
  companyIdIdx: index("channel_connections_company_id_idx").on(table.companyId),
  statusIdx: index("channel_connections_status_idx").on(table.status),
}));

export const waConversations = pgTable("wa_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  connectionId: varchar("connection_id").notNull().references(() => channelConnections.id, { onDelete: "cascade" }),
  
  externalThreadId: text("external_thread_id").notNull(),
  contactE164: text("contact_e164"),
  contactWaId: text("contact_wa_id").notNull(),
  contactName: text("contact_name"),
  contactProfilePic: text("contact_profile_pic"),
  
  unreadCount: integer("unread_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastMessagePreview: text("last_message_preview"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  connectionThreadUnique: unique().on(table.connectionId, table.externalThreadId),
  companyIdIdx: index("wa_conversations_company_id_idx").on(table.companyId),
  connectionIdIdx: index("wa_conversations_connection_id_idx").on(table.connectionId),
  lastMessageIdx: index("wa_conversations_last_message_idx").on(table.lastMessageAt),
}));

export const waMessages = pgTable("wa_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  connectionId: varchar("connection_id").notNull().references(() => channelConnections.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").notNull().references(() => waConversations.id, { onDelete: "cascade" }),
  
  providerMessageId: text("provider_message_id"),
  direction: messageDirectionEnum("direction").notNull(),
  status: messageStatusEnum("status").notNull().default("queued"),
  
  messageType: text("message_type").notNull().default("text"),
  textBody: text("text_body"),
  mediaUrl: text("media_url"),
  mediaMimeType: text("media_mime_type"),
  templateName: text("template_name"),
  
  payload: jsonb("payload"),
  errorMessage: text("error_message"),
  
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  providerMessageUnique: unique().on(table.connectionId, table.providerMessageId),
  conversationIdIdx: index("wa_messages_conversation_id_idx").on(table.conversationId),
  connectionIdIdx: index("wa_messages_connection_id_idx").on(table.connectionId),
  timestampIdx: index("wa_messages_timestamp_idx").on(table.timestamp),
}));

export const waWebhookLogs = pgTable("wa_webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id"),
  connectionId: varchar("connection_id"),
  eventType: text("event_type").notNull(),
  eventId: text("event_id"),
  phoneNumberId: text("phone_number_id"),
  payload: jsonb("payload"),
  processed: boolean("processed").notNull().default(false),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  eventIdIdx: index("wa_webhook_logs_event_id_idx").on(table.eventId),
  createdAtIdx: index("wa_webhook_logs_created_at_idx").on(table.createdAt),
}));

export const oauthProviderEnum = pgEnum("oauth_provider", ["meta_whatsapp", "meta_instagram", "meta_facebook", "tiktok", "telegram"]);

export const oauthStates = pgTable("oauth_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  provider: oauthProviderEnum("provider").notNull(),
  nonce: text("nonce").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<{ ip?: string; userAgent?: string }>(),
}, (table) => ({
  nonceIdx: index("oauth_states_nonce_idx").on(table.nonce),
  companyIdIdx: index("oauth_states_company_id_idx").on(table.companyId),
  expiresAtIdx: index("oauth_states_expires_at_idx").on(table.expiresAt),
}));

export const insertChannelConnectionSchema = createInsertSchema(channelConnections).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWaConversationSchema = createInsertSchema(waConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWaMessageSchema = createInsertSchema(waMessages).omit({ id: true, createdAt: true });
export const insertWaWebhookLogSchema = createInsertSchema(waWebhookLogs).omit({ id: true, createdAt: true });
export const insertOauthStateSchema = createInsertSchema(oauthStates).omit({ id: true, createdAt: true });

export type ChannelConnection = typeof channelConnections.$inferSelect;
export type InsertChannelConnection = z.infer<typeof insertChannelConnectionSchema>;
export type WaConversation = typeof waConversations.$inferSelect;
export type InsertWaConversation = z.infer<typeof insertWaConversationSchema>;
export type WaMessage = typeof waMessages.$inferSelect;
export type InsertWaMessage = z.infer<typeof insertWaMessageSchema>;
export type WaWebhookLog = typeof waWebhookLogs.$inferSelect;
export type InsertWaWebhookLog = z.infer<typeof insertWaWebhookLogSchema>;
export type OauthState = typeof oauthStates.$inferSelect;
export type InsertOauthState = z.infer<typeof insertOauthStateSchema>;


// =====================================================
// TELEGRAM INTEGRATION TABLES
// =====================================================

// Telegram Connect Codes - One-time codes for linking chats to tenants
export const telegramConnectCodes = pgTable("telegram_connect_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedByChatId: text("used_by_chat_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  codeIdx: index("telegram_connect_codes_code_idx").on(table.code),
  companyIdIdx: index("telegram_connect_codes_company_id_idx").on(table.companyId),
}));

export const insertTelegramConnectCodeSchema = createInsertSchema(telegramConnectCodes).omit({
  id: true,
  createdAt: true,
});
export type TelegramConnectCode = typeof telegramConnectCodes.$inferSelect;
export type InsertTelegramConnectCode = z.infer<typeof insertTelegramConnectCodeSchema>;

// Telegram Chat Type Enum
export const telegramChatTypeEnum = pgEnum("telegram_chat_type", ["private", "group", "supergroup", "channel"]);

// Telegram Chat Link Status Enum  
export const telegramChatLinkStatusEnum = pgEnum("telegram_chat_link_status", ["active", "revoked"]);

// Telegram Chat Links - Maps Telegram chat_ids to users (user-level integration)
export const telegramChatLinks = pgTable("telegram_chat_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: text("chat_id").notNull().unique(),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chatType: telegramChatTypeEnum("chat_type").notNull(),
  title: text("title"),
  status: telegramChatLinkStatusEnum("status").notNull().default("active"),
  linkedByUserId: varchar("linked_by_user_id").references(() => users.id, { onDelete: "set null" }),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  chatIdIdx: index("telegram_chat_links_chat_id_idx").on(table.chatId),
  companyIdIdx: index("telegram_chat_links_company_id_idx").on(table.companyId),
  userIdIdx: index("telegram_chat_links_user_id_idx").on(table.userId),
  statusIdx: index("telegram_chat_links_status_idx").on(table.status),
}));

export const insertTelegramChatLinkSchema = createInsertSchema(telegramChatLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TelegramChatLink = typeof telegramChatLinks.$inferSelect;
export type InsertTelegramChatLink = z.infer<typeof insertTelegramChatLinkSchema>;

// Telegram Participants - Tracks users in group chats
export const telegramParticipants = pgTable("telegram_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  telegramUserId: text("telegram_user_id").notNull(),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueParticipant: unique().on(table.companyId, table.chatId, table.telegramUserId),
  chatIdIdx: index("telegram_participants_chat_id_idx").on(table.chatId),
  telegramUserIdIdx: index("telegram_participants_telegram_user_id_idx").on(table.telegramUserId),
}));

export const insertTelegramParticipantSchema = createInsertSchema(telegramParticipants).omit({
  id: true,
  createdAt: true,
});
export type TelegramParticipant = typeof telegramParticipants.$inferSelect;
export type InsertTelegramParticipant = z.infer<typeof insertTelegramParticipantSchema>;

// Telegram Conversations - Conversations from Telegram (DM or Group) - user-level
export const telegramConversations = pgTable("telegram_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  chatType: telegramChatTypeEnum("chat_type").notNull(),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  subject: text("subject"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  unreadCount: integer("unread_count").notNull().default(0),
  status: text("status").notNull().default("open"),
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueConversation: unique().on(table.userId, table.chatId),
  companyIdIdx: index("telegram_conversations_company_id_idx").on(table.companyId),
  userIdIdx: index("telegram_conversations_user_id_idx").on(table.userId),
  chatIdIdx: index("telegram_conversations_chat_id_idx").on(table.chatId),
  statusIdx: index("telegram_conversations_status_idx").on(table.status),
}));

export const insertTelegramConversationSchema = createInsertSchema(telegramConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TelegramConversation = typeof telegramConversations.$inferSelect;
export type InsertTelegramConversation = z.infer<typeof insertTelegramConversationSchema>;

// Telegram Message Type Enum
export const telegramMessageTypeEnum = pgEnum("telegram_message_type", ["text", "photo", "video", "document", "voice", "audio", "sticker", "animation", "location", "contact"]);

// Telegram Message Status Enum
export const telegramMessageStatusEnum = pgEnum("telegram_message_status", ["pending", "sent", "delivered", "read", "failed"]);

// Telegram Messages - Individual messages
export const telegramMessages = pgTable("telegram_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => telegramConversations.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  providerMessageId: text("provider_message_id").notNull().unique(),
  authorContactId: varchar("author_contact_id").references(() => contacts.id, { onDelete: "set null" }),
  messageType: telegramMessageTypeEnum("message_type").notNull().default("text"),
  text: text("text"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  payload: jsonb("payload"),
  status: telegramMessageStatusEnum("status").notNull().default("pending"),
  sentBy: varchar("sent_by").references(() => users.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  conversationIdIdx: index("telegram_messages_conversation_id_idx").on(table.conversationId),
  providerMessageIdIdx: index("telegram_messages_provider_message_id_idx").on(table.providerMessageId),
  createdAtIdx: index("telegram_messages_created_at_idx").on(table.createdAt),
}));

export const insertTelegramMessageSchema = createInsertSchema(telegramMessages).omit({
  id: true,
  createdAt: true,
});
export type TelegramMessage = typeof telegramMessages.$inferSelect;
export type InsertTelegramMessage = z.infer<typeof insertTelegramMessageSchema>;

// User Telegram Bots - Each user can connect their own Telegram bot
export const userTelegramBots = pgTable("user_telegram_bots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  botToken: text("bot_token").notNull(),
  botUsername: text("bot_username"),
  botFirstName: text("bot_first_name"),
  webhookSecret: text("webhook_secret").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("user_telegram_bots_user_id_idx").on(table.userId),
  companyIdIdx: index("user_telegram_bots_company_id_idx").on(table.companyId),
  webhookSecretIdx: index("user_telegram_bots_webhook_secret_idx").on(table.webhookSecret),
  uniqueUserBot: unique().on(table.userId),
}));

export const insertUserTelegramBotSchema = createInsertSchema(userTelegramBots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UserTelegramBot = typeof userTelegramBots.$inferSelect;
export type InsertUserTelegramBot = z.infer<typeof insertUserTelegramBotSchema>;

// =====================================================
// TELNYX GLOBAL PRICING (Super Admin Configuration)
// =====================================================
// These prices are set by Super Admin and apply to all companies.
// Cost = What Telnyx charges us (wholesale)
// Price = What we charge clients (retail)

export const telnyxGlobalPricing = pgTable("telnyx_global_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Voice rates - COST (what Telnyx charges us, per minute)
  voiceLocalOutboundCost: numeric("voice_local_outbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0047"),
  voiceLocalInboundCost: numeric("voice_local_inbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0035"),
  voiceTollfreeOutboundCost: numeric("voice_tollfree_outbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0047"),
  voiceTollfreeInboundCost: numeric("voice_tollfree_inbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0060"),
  
  // Voice rates - PRICE (what we charge clients, per minute)
  voiceLocalOutbound: numeric("voice_local_outbound", { precision: 10, scale: 4 }).notNull().default("0.0100"),
  voiceLocalInbound: numeric("voice_local_inbound", { precision: 10, scale: 4 }).notNull().default("0.0080"),
  voiceTollfreeOutbound: numeric("voice_tollfree_outbound", { precision: 10, scale: 4 }).notNull().default("0.0180"),
  voiceTollfreeInbound: numeric("voice_tollfree_inbound", { precision: 10, scale: 4 }).notNull().default("0.0130"),
  
  // SMS rates - COST (what Telnyx charges us, per message)
  smsLongcodeOutboundCost: numeric("sms_longcode_outbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0040"),
  smsLongcodeInboundCost: numeric("sms_longcode_inbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0040"),
  smsTollfreeOutboundCost: numeric("sms_tollfree_outbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0040"),
  smsTollfreeInboundCost: numeric("sms_tollfree_inbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0040"),
  
  // SMS rates - PRICE (what we charge clients, per message)
  smsLongcodeOutbound: numeric("sms_longcode_outbound", { precision: 10, scale: 4 }).notNull().default("0.0060"),
  smsLongcodeInbound: numeric("sms_longcode_inbound", { precision: 10, scale: 4 }).notNull().default("0.0060"),
  smsTollfreeOutbound: numeric("sms_tollfree_outbound", { precision: 10, scale: 4 }).notNull().default("0.0070"),
  smsTollfreeInbound: numeric("sms_tollfree_inbound", { precision: 10, scale: 4 }).notNull().default("0.0070"),
  
  // Add-on rates - COST
  callControlInboundCost: numeric("call_control_inbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0010"),
  callControlOutboundCost: numeric("call_control_outbound_cost", { precision: 10, scale: 4 }).notNull().default("0.0010"),
  recordingPerMinuteCost: numeric("recording_per_minute_cost", { precision: 10, scale: 4 }).notNull().default("0.0010"),
  cnamLookupCost: numeric("cnam_lookup_cost", { precision: 10, scale: 4 }).notNull().default("0.0025"),
  e911AddressCost: numeric("e911_address_cost", { precision: 10, scale: 2 }).notNull().default("1.50"),
  portOutFeeCost: numeric("port_out_fee_cost", { precision: 10, scale: 2 }).notNull().default("6.00"),
  unregisteredE911Cost: numeric("unregistered_e911_cost", { precision: 10, scale: 2 }).notNull().default("100.00"),
  
  // Add-on rates - PRICE
  callControlInbound: numeric("call_control_inbound", { precision: 10, scale: 4 }).notNull().default("0.0020"),
  callControlOutbound: numeric("call_control_outbound", { precision: 10, scale: 4 }).notNull().default("0.0020"),
  recordingPerMinute: numeric("recording_per_minute", { precision: 10, scale: 4 }).notNull().default("0.0020"),
  cnamLookup: numeric("cnam_lookup", { precision: 10, scale: 4 }).notNull().default("0.0045"),
  e911Address: numeric("e911_address", { precision: 10, scale: 2 }).notNull().default("2.00"),
  portOutFee: numeric("port_out_fee", { precision: 10, scale: 2 }).notNull().default("10.00"),
  unregisteredE911: numeric("unregistered_e911", { precision: 10, scale: 2 }).notNull().default("100.00"),
  
  // DID monthly rates - COST
  didLocalCost: numeric("did_local_cost", { precision: 10, scale: 2 }).notNull().default("0.50"),
  didTollfreeCost: numeric("did_tollfree_cost", { precision: 10, scale: 2 }).notNull().default("0.75"),
  
  // DID monthly rates - PRICE
  didLocal: numeric("did_local", { precision: 10, scale: 2 }).notNull().default("1.00"),
  didTollfree: numeric("did_tollfree", { precision: 10, scale: 2 }).notNull().default("1.50"),
  
  // Billing configuration
  billingIncrement: integer("billing_increment").notNull().default(60),
  minBillableSeconds: integer("min_billable_seconds").notNull().default(60),
  
  // Metadata
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export const insertTelnyxGlobalPricingSchema = createInsertSchema(telnyxGlobalPricing).omit({
  id: true, updatedAt: true
});

export type TelnyxGlobalPricing = typeof telnyxGlobalPricing.$inferSelect;
export type InsertTelnyxGlobalPricing = z.infer<typeof insertTelnyxGlobalPricingSchema>;

// =====================================================
// WALLET SYSTEM (Transactional Billing)
// =====================================================

// Wallet transaction types
export const walletTransactionTypes = [
  "DEPOSIT",
  "CALL_COST",
  "SMS_COST",
  "NUMBER_RENTAL",
  "NUMBER_PURCHASE",
  "MONTHLY_FEE",
  "CNAM_MONTHLY",
  "E911_MONTHLY",
  "SUBSCRIPTION",
  "REFUND",
  "ADJUSTMENT",
] as const;
export type WalletTransactionType = typeof walletTransactionTypes[number];

// Wallets table - One per USER (User-scoped billing, shared Telnyx managed account per company)
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // User who owns this wallet
  telnyxAccountId: text("telnyx_account_id"), // Shared across all wallets in company
  telnyxApiToken: text("telnyx_api_token"),
  telnyxMessagingProfileId: text("telnyx_messaging_profile_id"), // Telnyx messaging profile for SMS/MMS
  balance: numeric("balance", { precision: 10, scale: 4 }).notNull().default("0.0000"),
  currency: text("currency").notNull().default("USD"),
  autoRecharge: boolean("auto_recharge").notNull().default(false),
  autoRechargeThreshold: numeric("auto_recharge_threshold", { precision: 10, scale: 4 }),
  autoRechargeAmount: numeric("auto_recharge_amount", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("wallets_company_id_idx").on(table.companyId),
  ownerUserIdIdx: index("wallets_owner_user_id_idx").on(table.ownerUserId),
  userUniqueIdx: uniqueIndex("wallets_user_unique_idx").on(table.ownerUserId), // One wallet per user
}));

// Wallet Transactions table (Ledger) - Every movement is recorded
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 4 }).notNull(),
  type: text("type").notNull().$type<WalletTransactionType>(),
  description: text("description"),
  externalReferenceId: text("external_reference_id"),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  walletIdIdx: index("wallet_transactions_wallet_id_idx").on(table.walletId),
  typeIdx: index("wallet_transactions_type_idx").on(table.type),
  createdAtIdx: index("wallet_transactions_created_at_idx").on(table.createdAt),
  externalRefIdx: index("wallet_transactions_external_ref_idx").on(table.externalReferenceId),
}));

// Wallet Insert Schemas
export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });

// Wallet Types
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;


// =====================================================
// CALL RATES (Pricing per prefix)
// =====================================================

export const callRates = pgTable("call_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }), // null = global rate
  prefix: text("prefix").notNull(), // E.g., "1" for USA, "52" for Mexico, "521" for Mexico Mobile
  ratePerMinute: numeric("rate_per_minute", { precision: 10, scale: 4 }).notNull().default("0.0200"),
  connectionFee: numeric("connection_fee", { precision: 10, scale: 4 }).notNull().default("0.0000"),
  minBillableSeconds: integer("min_billable_seconds").notNull().default(6), // Minimum 6 seconds
  billingIncrement: integer("billing_increment").notNull().default(6), // Bill in 6-second increments
  description: text("description"), // E.g., "USA Mobile", "Mexico Landline"
  country: text("country"), // ISO country code
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  prefixIdx: index("call_rates_prefix_idx").on(table.prefix),
  companyPrefixIdx: index("call_rates_company_prefix_idx").on(table.companyId, table.prefix),
  countryIdx: index("call_rates_country_idx").on(table.country),
}));

export const insertCallRateSchema = createInsertSchema(callRates).omit({ id: true, createdAt: true, updatedAt: true });
export type CallRate = typeof callRates.$inferSelect;
export type InsertCallRate = z.infer<typeof insertCallRateSchema>;
// =====================================================
// TELNYX PHONE NUMBERS (Company VoIP Lines)
// =====================================================

export const telnyxPhoneNumbers = pgTable("telnyx_phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(), // E.164 format (+1XXXXXXXXXX)
  telnyxPhoneNumberId: text("telnyx_phone_number_id").notNull(), // Telnyx resource ID
  displayName: text("display_name"), // Friendly name for UI
  status: text("status").notNull().default("active").$type<"active" | "suspended" | "pending" | "cancelled">(),
  capabilities: text("capabilities").array().default([]), // ["voice", "sms", "mms"]
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 4 }).default("2.00"),
  e911Enabled: boolean("e911_enabled").notNull().default(false),
  e911AddressId: text("e911_address_id"), // Telnyx emergency address ID
  e911MonthlyFee: numeric("e911_monthly_fee", { precision: 10, scale: 4 }).default("1.50"),
  messagingProfileId: text("messaging_profile_id"), // For SMS routing
  outboundVoiceProfileId: text("outbound_voice_profile_id"), // For voice routing
  connectionId: text("connection_id"), // TeXML App connection ID
  callerIdName: text("caller_id_name"), // CNAM for outbound calls
  
  // Call Forwarding Settings (stored locally, applied via TeXML webhook)
  callForwardingEnabled: boolean("call_forwarding_enabled").notNull().default(false),
  callForwardingDestination: text("call_forwarding_destination"), // E.164 format destination
  callForwardingKeepCallerId: boolean("call_forwarding_keep_caller_id").notNull().default(true),
  
  // Per-Number Voice Settings
  recordingEnabled: boolean("recording_enabled").notNull().default(false), // Call recording for this number
  cnamLookupEnabled: boolean("cnam_lookup_enabled").notNull().default(false), // CNAM lookup for incoming calls
  noiseSuppressionEnabled: boolean("noise_suppression_enabled").notNull().default(false), // Noise suppression
  noiseSuppressionDirection: text("noise_suppression_direction").default("outbound").$type<"inbound" | "outbound" | "both">(),
  voicemailEnabled: boolean("voicemail_enabled").notNull().default(false), // Voicemail for this number
  voicemailPin: text("voicemail_pin"), // 4-digit PIN for voicemail access (dial *98)
  
  // IVR Routing - Which IVR should handle incoming calls to this number
  ivrId: text("ivr_id"), // Links to pbxIvrs.id - null means use company default IVR
  
  // Billing Fields - For monthly recurring charges
  numberType: text("number_type").default("local").$type<"local" | "toll_free">(), // Type of number for pricing
  retailMonthlyRate: numeric("retail_monthly_rate", { precision: 10, scale: 4 }), // Client-facing monthly rate
  telnyxMonthlyCost: numeric("telnyx_monthly_cost", { precision: 10, scale: 4 }), // Wholesale cost from Telnyx
  lastBilledAt: timestamp("last_billed_at", { withTimezone: true }), // Last monthly billing date
  nextBillingAt: timestamp("next_billing_at", { withTimezone: true }), // Next billing date (purchasedAt + 1 month)
  
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("telnyx_phone_numbers_company_id_idx").on(table.companyId),
  ownerUserIdIdx: index("telnyx_phone_numbers_owner_user_id_idx").on(table.ownerUserId),
  phoneNumberIdx: index("telnyx_phone_numbers_phone_number_idx").on(table.phoneNumber),
  telnyxIdIdx: index("telnyx_phone_numbers_telnyx_id_idx").on(table.telnyxPhoneNumberId),
}));

// Telnyx E911 Addresses (Emergency Service Registration)
export const telnyxE911Addresses = pgTable("telnyx_e911_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  telnyxAddressId: text("telnyx_address_id").notNull(), // Telnyx address resource ID
  streetAddress: text("street_address").notNull(),
  extendedAddress: text("extended_address"), // Apt/Suite
  locality: text("locality").notNull(), // City
  administrativeArea: text("administrative_area").notNull(), // State (2-letter)
  postalCode: text("postal_code").notNull(),
  countryCode: text("country_code").notNull().default("US"),
  callerName: text("caller_name").notNull(), // What 911 sees
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("telnyx_e911_addresses_company_id_idx").on(table.companyId),
}));

// Telnyx Phone Number Insert Schemas
export const insertTelnyxPhoneNumberSchema = createInsertSchema(telnyxPhoneNumbers).omit({ 
  id: true, createdAt: true, updatedAt: true, purchasedAt: true 
});
export const insertTelnyxE911AddressSchema = createInsertSchema(telnyxE911Addresses).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

// Telnyx Types
export type TelnyxPhoneNumber = typeof telnyxPhoneNumbers.$inferSelect;
export type InsertTelnyxPhoneNumber = z.infer<typeof insertTelnyxPhoneNumberSchema>;
export type TelnyxE911Address = typeof telnyxE911Addresses.$inferSelect;
export type InsertTelnyxE911Address = z.infer<typeof insertTelnyxE911AddressSchema>;

// =====================================================
// TELEPHONY SETTINGS (WebRTC Infrastructure)
// =====================================================

// Provisioning status for tracking infrastructure setup
export const telephonyProvisioningStatuses = [
  "pending",
  "provisioning",
  "completed",
  "failed",
  "needs_retry",
] as const;
export type TelephonyProvisioningStatus = typeof telephonyProvisioningStatuses[number];

// Telephony Settings - One per USER (User-scoped WebRTC infrastructure)
export const telephonySettings = pgTable("telephony_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // User who owns this telephony setup
  
  // Telnyx Resource IDs
  outboundVoiceProfileId: text("outbound_voice_profile_id"),
  texmlAppId: text("texml_app_id"),
  credentialConnectionId: text("credential_connection_id"),
  messagingProfileId: text("messaging_profile_id"),
  callControlAppId: text("call_control_app_id"), // Call Control Application ID for REST API call management
  
  // SIP Domain for Credential Connection (required for SIP Forking/simultaneous ringing)
  // Example: "company-name.sip.telnyx.com" - this domain routes calls through the credential connection rules
  sipDomain: text("sip_domain"),
  
  // Provisioning Status
  provisioningStatus: text("provisioning_status").notNull().default("pending").$type<TelephonyProvisioningStatus>(),
  provisioningError: text("provisioning_error"),
  provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
  
  // Webhook Configuration
  webhookBaseUrl: text("webhook_base_url"),
  
  // Usage Limits
  monthlyUsageLimit: numeric("monthly_usage_limit", { precision: 10, scale: 2 }).default("25.00"),
  usageLimitAction: text("usage_limit_action").default("block").$type<"block" | "notify">(),
  
  // Audio Features (enabled by default for new accounts)
  noiseSuppressionEnabled: boolean("noise_suppression_enabled").notNull().default(true),
  noiseSuppressionDirection: text("noise_suppression_direction").default("outbound").$type<"inbound" | "outbound" | "both">(),
  
  // Billable Features (enabled by default for new accounts - included in plan)
  recordingEnabled: boolean("recording_enabled").notNull().default(true), // $0.005/min extra
  cnamEnabled: boolean("cnam_enabled").notNull().default(true), // $1.00/month + $0.01/call
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("telephony_settings_company_id_idx").on(table.companyId),
  ownerUserIdIdx: index("telephony_settings_owner_user_id_idx").on(table.ownerUserId),
  statusIdx: index("telephony_settings_status_idx").on(table.provisioningStatus),
  userUniqueIdx: uniqueIndex("telephony_settings_user_unique_idx").on(table.ownerUserId), // One settings per user
}));

// Telephony Credentials - Per user SIP credentials for WebRTC (User-scoped)
export const telephonyCredentials = pgTable("telephony_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Legacy - use ownerUserId
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "cascade" }), // User who owns these credentials
  
  // Telnyx Credential
  telnyxCredentialId: text("telnyx_credential_id"),
  sipUsername: text("sip_username").notNull(),
  sipPassword: text("sip_password").notNull(), // Encrypted in application layer
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("telephony_credentials_company_id_idx").on(table.companyId),
  userIdIdx: index("telephony_credentials_user_id_idx").on(table.userId),
  ownerUserIdIdx: index("telephony_credentials_owner_user_id_idx").on(table.ownerUserId),
  sipUsernameIdx: index("telephony_credentials_sip_username_idx").on(table.sipUsername),
  userUniqueIdx: uniqueIndex("telephony_credentials_user_unique_idx").on(table.ownerUserId), // One credential set per user
}));

// Telephony Insert Schemas
export const insertTelephonySettingsSchema = createInsertSchema(telephonySettings).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export const insertTelephonyCredentialsSchema = createInsertSchema(telephonyCredentials).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

// Telephony Types
export type TelephonySettings = typeof telephonySettings.$inferSelect;
export type InsertTelephonySettings = z.infer<typeof insertTelephonySettingsSchema>;
export type TelephonyCredentials = typeof telephonyCredentials.$inferSelect;
export type InsertTelephonyCredentials = z.infer<typeof insertTelephonyCredentialsSchema>;

// =====================================================
// CALL LOGS (Call History for WebPhone)
// =====================================================

export const callDirections = ["inbound", "outbound"] as const;
export type CallDirection = typeof callDirections[number];

export const callStatuses = ["ringing", "answered", "missed", "busy", "failed", "voicemail", "no_answer"] as const;
export type CallStatus = typeof callStatuses[number];

export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Call identifiers
  telnyxCallId: text("telnyx_call_id"), // Telnyx call control ID
  telnyxSessionId: text("telnyx_session_id"), // Telnyx session ID
  sipCallId: text("sip_call_id"), // SIP.js call ID for WebRTC calls
  
  // Phone numbers
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  
  // Call info
  direction: text("direction").notNull().$type<CallDirection>(),
  status: text("status").notNull().$type<CallStatus>(),
  hangupCause: text("hangup_cause"), // SIP hangup cause code (e.g., "normal_clearing", "busy", "no_answer")
  
  // Duration in seconds
  duration: integer("duration").default(0),
  
  // Contact info (if matched)
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  callerName: text("caller_name"),
  
  // Recording
  recordingUrl: text("recording_url"),
  recordingDuration: integer("recording_duration"), // Recording duration in seconds
  
  // Cost
  cost: text("cost"), // Call cost in currency
  costCurrency: text("cost_currency").default("USD"),
  billedDuration: integer("billed_duration"), // Billed duration in seconds
  
  // Timestamps
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("call_logs_company_id_idx").on(table.companyId),
  userIdIdx: index("call_logs_user_id_idx").on(table.userId),
  directionIdx: index("call_logs_direction_idx").on(table.direction),
  statusIdx: index("call_logs_status_idx").on(table.status),
  startedAtIdx: index("call_logs_started_at_idx").on(table.startedAt),
  telnyxCallIdIdx: index("call_logs_telnyx_call_id_idx").on(table.telnyxCallId),
  sipCallIdIdx: index("call_logs_sip_call_id_idx").on(table.sipCallId),
}));

// Call Logs Insert Schema
export const insertCallLogSchema = createInsertSchema(callLogs).omit({ 
  id: true, createdAt: true 
});

// Call Logs Types
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;

// =====================================================
// VOICEMAILS (Voicemail Messages)
// =====================================================

export const voicemailStatuses = ["new", "read", "archived", "deleted"] as const;
export type VoicemailStatus = typeof voicemailStatuses[number];

export const voicemails = pgTable("voicemails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Telnyx identifiers
  telnyxCallSessionId: text("telnyx_call_session_id"),
  telnyxConnectionId: text("telnyx_connection_id"),
  
  // Caller info
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  callerName: text("caller_name"),
  
  // Contact match
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  
  // Recording
  recordingUrl: text("recording_url").notNull(),
  duration: integer("duration").default(0), // Duration in seconds
  
  // Transcription (if available)
  transcription: text("transcription"),
  
  // Status
  status: text("status").notNull().default("new").$type<VoicemailStatus>(),
  
  // Timestamps
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("voicemails_company_id_idx").on(table.companyId),
  userIdIdx: index("voicemails_user_id_idx").on(table.userId),
  statusIdx: index("voicemails_status_idx").on(table.status),
  receivedAtIdx: index("voicemails_received_at_idx").on(table.receivedAt),
  fromNumberIdx: index("voicemails_from_number_idx").on(table.fromNumber),
}));

// Voicemail Insert Schema
export const insertVoicemailSchema = createInsertSchema(voicemails).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

// Voicemail Types
export type Voicemail = typeof voicemails.$inferSelect;
export type InsertVoicemail = z.infer<typeof insertVoicemailSchema>;

// =====================================================
// CAMPAIGN WIZARD COMPREHENSIVE PAYLOAD SCHEMA
// =====================================================

// Payload for creating a campaign with all advanced features
export const createCampaignWithDetailsSchema = z.object({
  // Main campaign fields
  campaign: z.object({
    name: z.string().min(1, "Campaign name is required").max(200),
    description: z.string().optional().nullable(),
    messageBody: z.string().min(1, "Message body is required").max(500),
    targetListId: z.string().uuid("Please select a valid contact list"),
    templateId: z.string().uuid().optional().nullable(),
    personalizedFields: z.array(z.string()).default([]),
    complianceScore: z.number().int().min(0).max(100).optional().nullable(),
  }),
  
  // Schedule configuration (optional - defaults to immediate if not provided)
  schedule: z.object({
    scheduleType: z.enum(["immediate", "scheduled", "recurring"]).default("immediate"),
    startDate: z.string().optional().nullable(),
    startTime: z.string().optional().nullable(),
    timezone: z.string().default("UTC"),
    recurrenceRule: z.record(z.any()).optional().nullable(),
    endDate: z.string().optional().nullable(),
    quietHoursStart: z.string().optional().nullable(),
    quietHoursEnd: z.string().optional().nullable(),
    rateLimit: z.number().int().positive().optional().nullable(),
    throttleDelayMin: z.number().int().nonnegative().optional().nullable(),
    throttleDelayMax: z.number().int().nonnegative().optional().nullable(),
    respectContactTimezone: z.boolean().default(false),
  }).optional(),
  
  // Follow-up sequences
  followups: z.array(z.object({
    sequence: z.number().int().positive(),
    triggerType: z.enum(["no_response", "response_positive", "response_negative", "time_delay"]),
    waitDays: z.number().int().nonnegative().default(0),
    waitHours: z.number().int().nonnegative().default(0),
    messageBody: z.string().min(1, "Message body is required"),
    mediaUrls: z.array(z.string().url()).default([]),
    targetSegment: z.enum(["responded", "not_responded", "all"]).default("all"),
    isActive: z.boolean().default(true),
  })).optional().default([]),
  
  // A/B Testing variants (optional - for advanced campaigns)
  variants: z.array(z.object({
    variantLetter: z.enum(["A", "B", "C", "D", "E"]),
    messageBody: z.string().min(1, "Message body is required"),
    mediaUrls: z.array(z.string().url()).default([]),
    splitPercentage: z.number().int().min(0).max(100),
  })).optional().default([]),
}).refine((data) => {
  // Validate: scheduled campaigns must have startDate and startTime
  if (data.schedule?.scheduleType === "scheduled" && (!data.schedule.startDate || !data.schedule.startTime)) {
    return false;
  }
  return true;
}, {
  message: "Scheduled campaigns must have start date and time",
  path: ["schedule"],
}).refine((data) => {
  // Validate: recurring campaigns must have recurrenceRule
  if (data.schedule?.scheduleType === "recurring" && !data.schedule.recurrenceRule) {
    return false;
  }
  return true;
}, {
  message: "Recurring campaigns must have a recurrence rule",
  path: ["schedule", "recurrenceRule"],
});

export type CreateCampaignWithDetails = z.infer<typeof createCampaignWithDetailsSchema>;

// =====================================================
// SYSTEM API CREDENTIALS (Superadmin Managed Keys)
// =====================================================

// Supported API providers
export const apiProviders = [
  "stripe",
  "telnyx", 
  "twilio",
  "bluebubbles",
  "evolution_api",
  "google_places",
  "google_oauth",
  "nodemailer",
  "openai",
  "cms_api",
  "imap_bounce",
  "cloudflare",
  "web_push",
  "meta",
  "tiktok",
  "telegram",
  "aws_ses",
] as const;
export type ApiProvider = typeof apiProviders[number];

// System API Credentials table - Encrypted storage for API keys
export const systemApiCredentials = pgTable("system_api_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().$type<ApiProvider>(),
  keyName: text("key_name").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  iv: text("iv").notNull(),
  keyVersion: integer("key_version").notNull().default(1),
  environment: text("environment").notNull().default("production"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => ({
  providerKeyIdx: index("system_api_credentials_provider_key_idx").on(table.provider, table.keyName),
  providerIdx: index("system_api_credentials_provider_idx").on(table.provider),
  uniqueProviderKey: unique("unique_provider_key_env").on(table.provider, table.keyName, table.environment),
}));

// Audit actions for credential changes
export const credentialAuditActions = [
  "created",
  "updated",
  "deleted",
  "rotated",
  "viewed",
] as const;
export type CredentialAuditAction = typeof credentialAuditActions[number];

// Audit log for credential changes
export const systemApiCredentialsAudit = pgTable("system_api_credentials_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  credentialId: varchar("credential_id"),
  provider: text("provider").notNull(),
  keyName: text("key_name").notNull(),
  action: text("action").notNull().$type<CredentialAuditAction>(),
  actorId: varchar("actor_id").notNull().references(() => users.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  previousValue: text("previous_value"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  credentialIdIdx: index("system_api_credentials_audit_credential_idx").on(table.credentialId),
  actorIdIdx: index("system_api_credentials_audit_actor_idx").on(table.actorId),
  createdAtIdx: index("system_api_credentials_audit_created_at_idx").on(table.createdAt),
}));

// Insert Schemas
export const insertSystemApiCredentialSchema = createInsertSchema(systemApiCredentials).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastRotatedAt: true,
});

export const insertSystemApiCredentialsAuditSchema = createInsertSchema(systemApiCredentialsAudit).omit({ 
  id: true, 
  createdAt: true,
});

// Types
export type SystemApiCredential = typeof systemApiCredentials.$inferSelect;
export type InsertSystemApiCredential = z.infer<typeof insertSystemApiCredentialSchema>;
export type SystemApiCredentialsAudit = typeof systemApiCredentialsAudit.$inferSelect;
export type InsertSystemApiCredentialsAudit = z.infer<typeof insertSystemApiCredentialsAuditSchema>;

// =====================================================
// SYSTEM CONFIGURATION (Non-secret global settings)
// =====================================================

export const systemConfig = pgTable("system_config", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateSystemConfigSchema = z.object({
  value: z.string().min(1, "Value is required"),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type UpdateSystemConfig = z.infer<typeof updateSystemConfigSchema>;

// Deployment Jobs table - Track automated deployments
export const deploymentJobs = pgTable("deployment_jobs", {
  id: serial("id").primaryKey(),
  triggeredBy: text("triggered_by").notNull(),
  status: text("status").notNull().default("pending"),
  logs: text("logs"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  gitCommit: text("git_commit"),
  gitBranch: text("git_branch").default("main"),
});

export type DeploymentJob = typeof deploymentJobs.$inferSelect;
export type InsertDeploymentJob = typeof deploymentJobs.$inferInsert;

export const insertDeploymentJobSchema = createInsertSchema(deploymentJobs).omit({
  id: true,
  completedAt: true,
});

// =============================================================================
// PBX SYSTEM - Voice API Call Control Based
// =============================================================================

// PBX Ring Strategy Types
export type PbxRingStrategy = "ring_all" | "round_robin" | "least_recent" | "random";
export type PbxQueueStatus = "active" | "inactive";
export type PbxAgentStatusType = "available" | "busy" | "away" | "offline";

// PBX Settings - Main configuration for company's PBX
export const pbxSettings = pgTable("pbx_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Primary inbound number for PBX
  primaryPhoneNumberId: text("primary_phone_number_id").references(() => telnyxPhoneNumbers.id, { onDelete: "set null" }),
  
  // IVR Configuration
  ivrEnabled: boolean("ivr_enabled").notNull().default(false),
  ivrExtension: text("ivr_extension").default("1000"),
  greetingAudioUrl: text("greeting_audio_url"),
  greetingMediaName: text("greeting_media_name"),
  greetingText: text("greeting_text"),
  useTextToSpeech: boolean("use_text_to_speech").notNull().default(true),
  
  // Hold Music
  holdMusicUrl: text("hold_music_url"),
  
  // Timeout Settings (seconds)
  ivrTimeout: integer("ivr_timeout").notNull().default(10),
  queueTimeout: integer("queue_timeout").notNull().default(300),
  ringTimeout: integer("ring_timeout").notNull().default(30),
  
  // Voicemail when no answer
  voicemailEnabled: boolean("voicemail_enabled").notNull().default(true),
  voicemailGreetingUrl: text("voicemail_greeting_url"),
  voicemailEmail: text("voicemail_email"),
  
  // Business Hours
  businessHoursEnabled: boolean("business_hours_enabled").notNull().default(false),
  businessHoursStart: text("business_hours_start").default("09:00"),
  businessHoursEnd: text("business_hours_end").default("17:00"),
  businessHoursTimezone: text("business_hours_timezone").default("America/New_York"),
  afterHoursAction: text("after_hours_action").default("voicemail").$type<"voicemail" | "message" | "forward">(),
  afterHoursForwardNumber: text("after_hours_forward_number"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PBX IVRs - Multiple IVRs per company (English IVR, Spanish IVR, etc.)
export const pbxIvrs = pgTable("pbx_ivrs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // IVR Identity
  name: text("name").notNull(), // e.g., "Main Menu", "English IVR", "Spanish IVR"
  description: text("description"),
  extension: text("extension").notNull(), // e.g., "1000", "1001" - unique per company
  language: text("language").default("en-US"), // Language for TTS
  
  // Greeting Configuration
  greetingAudioUrl: text("greeting_audio_url"),
  greetingMediaName: text("greeting_media_name"), // Telnyx Media Storage name
  greetingText: text("greeting_text"), // TTS greeting text
  useTextToSpeech: boolean("use_text_to_speech").notNull().default(true),
  
  // Timeout Settings
  ivrTimeout: integer("ivr_timeout").notNull().default(10), // Seconds to wait for input
  maxRetries: integer("max_retries").notNull().default(3), // Max retries before hangup
  
  // Status
  isDefault: boolean("is_default").notNull().default(false), // Default IVR for new numbers
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyExtensionUnique: uniqueIndex("pbx_ivrs_company_extension_unique").on(table.companyId, table.extension),
}));

// PBX IVR Menu Options - Press 1 for Sales, Press 2 for Support, etc.
export const pbxMenuOptions = pgTable("pbx_menu_options", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  pbxSettingsId: text("pbx_settings_id").references(() => pbxSettings.id, { onDelete: "cascade" }),
  ivrId: text("ivr_id").references(() => pbxIvrs.id, { onDelete: "cascade" }), // New: Link to specific IVR
  
  // DTMF digit (1-9, 0, *, #)
  digit: text("digit").notNull(),
  label: text("label").notNull(),
  
  // Action to take - Added "ivr" type to route to another IVR
  actionType: text("action_type").notNull().$type<"queue" | "extension" | "external" | "voicemail" | "submenu" | "hangup" | "ivr">(),
  
  // Target based on action type
  targetQueueId: text("target_queue_id").references(() => pbxQueues.id, { onDelete: "set null" }),
  targetExtensionId: text("target_extension_id").references(() => pbxExtensions.id, { onDelete: "set null" }),
  targetExternalNumber: text("target_external_number"),
  targetSubmenuId: text("target_submenu_id"),
  targetIvrId: text("target_ivr_id").references(() => pbxIvrs.id, { onDelete: "set null" }), // New: Target IVR for "ivr" action
  
  // Audio announcement before action
  announcementText: text("announcement_text"),
  announcementAudioUrl: text("announcement_audio_url"),
  
  // Order for display
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PBX Queues - Call queues (Sales, Support, etc.)
export const pbxQueues = pgTable("pbx_queues", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  description: text("description"),
  
  // Queue extension number (e.g., 2001, 2002) - reachable from any extension
  extension: text("extension"),
  
  // Ring Strategy
  ringStrategy: text("ring_strategy").notNull().default("ring_all").$type<PbxRingStrategy>(),
  
  // Timing
  ringTimeout: integer("ring_timeout").notNull().default(20),
  wrapUpTime: integer("wrap_up_time").notNull().default(5),
  maxWaitTime: integer("max_wait_time").notNull().default(300),
  
  // Audio
  holdMusicUrl: text("hold_music_url"),
  holdMusicPlaybackMode: text("hold_music_playback_mode").notNull().default("sequential").$type<"sequential" | "random">(),
  queueAnnouncementUrl: text("queue_announcement_url"),
  announcementFrequency: integer("announcement_frequency").default(60),
  
  // ADS Configuration - Intercalated advertisements during hold
  adsEnabled: boolean("ads_enabled").notNull().default(false),
  adsIntervalMin: integer("ads_interval_min").default(45), // Minimum seconds between ads
  adsIntervalMax: integer("ads_interval_max").default(60), // Maximum seconds between ads
  
  // Overflow handling
  maxCallers: integer("max_callers").default(10),
  overflowAction: text("overflow_action").default("voicemail").$type<"voicemail" | "forward" | "hangup">(),
  overflowNumber: text("overflow_number"),
  
  // Status
  status: text("status").notNull().default("active").$type<PbxQueueStatus>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PBX Queue Members - Agents assigned to queues
export const pbxQueueMembers = pgTable("pbx_queue_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  queueId: text("queue_id").notNull().references(() => pbxQueues.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Member priority (lower = higher priority for round_robin)
  priority: integer("priority").notNull().default(1),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  queueUserUnique: uniqueIndex("pbx_queue_members_queue_user_unique").on(table.queueId, table.userId),
}));

// PBX Queue Ads - Advertisement audio files for queue hold music
export const pbxQueueAds = pgTable("pbx_queue_ads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  queueId: text("queue_id").notNull().references(() => pbxQueues.id, { onDelete: "cascade" }),
  audioFileId: text("audio_file_id").notNull().references(() => pbxAudioFiles.id, { onDelete: "cascade" }),
  
  // Display order for rotating through ads
  displayOrder: integer("display_order").notNull().default(0),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// PBX Queue Hold Music - Multiple hold music files for queues (many-to-many)
export const pbxQueueHoldMusic = pgTable("pbx_queue_hold_music", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  queueId: text("queue_id").notNull().references(() => pbxQueues.id, { onDelete: "cascade" }),
  audioFileId: text("audio_file_id").notNull().references(() => pbxAudioFiles.id, { onDelete: "cascade" }),
  
  // Display order for sequential playback (or ignored if playbackMode is random)
  displayOrder: integer("display_order").notNull().default(0),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  queueAudioUnique: uniqueIndex("pbx_queue_hold_music_queue_audio_unique").on(table.queueId, table.audioFileId),
}));

// PBX Extensions - Direct dial extensions for users
export const pbxExtensions = pgTable("pbx_extensions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Extension number (e.g., 101, 102)
  extension: text("extension").notNull(),
  
  // Display name for caller ID
  displayName: text("display_name"),
  
  // Ring timeout before going to personal voicemail
  ringTimeout: integer("ring_timeout").notNull().default(20),
  
  // Personal voicemail
  voicemailEnabled: boolean("voicemail_enabled").notNull().default(true),
  voicemailGreetingUrl: text("voicemail_greeting_url"),
  voicemailEmail: text("voicemail_email"),
  
  // Forward if busy/no answer
  forwardOnBusy: boolean("forward_on_busy").notNull().default(false),
  forwardOnNoAnswer: boolean("forward_on_no_answer").notNull().default(false),
  forwardNumber: text("forward_number"),
  
  // Do Not Disturb
  dndEnabled: boolean("dnd_enabled").notNull().default(false),
  
  // Telnyx SIP Connection - Each extension has its own independent SIP connection
  telnyxCredentialConnectionId: text("telnyx_credential_connection_id"),
  sipCredentialId: text("sip_credential_id"),
  sipUsername: text("sip_username"),
  sipPassword: text("sip_password"),
  sipDomain: text("sip_domain"),
  
  // Direct phone number assigned to this extension
  directPhoneNumberId: text("direct_phone_number_id").references(() => telnyxPhoneNumbers.id, { onDelete: "set null" }),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyExtensionUnique: uniqueIndex("pbx_extensions_company_extension_unique").on(table.companyId, table.extension),
}));

// PBX Agent Status - Real-time status tracking for queue routing
export const pbxAgentStatus = pgTable("pbx_agent_status", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Current status
  status: text("status").notNull().default("offline").$type<PbxAgentStatusType>(),
  
  // Current call info
  currentCallId: text("current_call_id"),
  inCallSince: timestamp("in_call_since"),
  
  // Stats for routing decisions
  lastCallEndedAt: timestamp("last_call_ended_at"),
  callsHandledToday: integer("calls_handled_today").notNull().default(0),
  
  // WebRTC registration status
  sipRegistered: boolean("sip_registered").notNull().default(false),
  lastRegisteredAt: timestamp("last_registered_at"),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyUserUnique: uniqueIndex("pbx_agent_status_company_user_unique").on(table.companyId, table.userId),
}));

// PBX Active Calls - Track calls in queues for routing
export const pbxActiveCalls = pgTable("pbx_active_calls", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Telnyx identifiers
  callControlId: text("call_control_id").notNull(),
  callSessionId: text("call_session_id"),
  callLegId: text("call_leg_id"),
  
  // Call info
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  
  // Current state
  state: text("state").notNull().$type<"ivr" | "queue" | "ringing" | "connected" | "hold" | "transferring">(),
  
  // Queue info (if in queue)
  queueId: text("queue_id").references(() => pbxQueues.id, { onDelete: "set null" }),
  queueEnteredAt: timestamp("queue_entered_at"),
  queuePosition: integer("queue_position"),
  
  // Connected agent (if connected)
  connectedAgentId: text("connected_agent_id").references(() => users.id, { onDelete: "set null" }),
  agentCallControlId: text("agent_call_control_id"),
  
  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
  
  // Metadata
  metadata: jsonb("metadata"),
});

// PBX Audio Files - Uploaded audio files for IVR/Hold Music
export const pbxAudioFiles = pgTable("pbx_audio_files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  description: text("description"),
  notes: text("notes"), // User notes about this audio file
  
  // File info
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  duration: integer("duration"),
  mimeType: text("mime_type"),
  
  // Type
  audioType: text("audio_type").notNull().$type<"greeting" | "hold_music" | "announcement" | "voicemail_greeting">(),
  
  // Telnyx Media Storage
  telnyxMediaId: text("telnyx_media_id"),
  
  // If generated via TTS
  ttsGenerated: boolean("tts_generated").notNull().default(false),
  ttsText: text("tts_text"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas for PBX
export const insertPbxSettingsSchema = createInsertSchema(pbxSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPbxIvrSchema = createInsertSchema(pbxIvrs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPbxMenuOptionSchema = createInsertSchema(pbxMenuOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPbxQueueSchema = createInsertSchema(pbxQueues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPbxQueueMemberSchema = createInsertSchema(pbxQueueMembers).omit({
  id: true,
  createdAt: true,
});

export const insertPbxQueueAdSchema = createInsertSchema(pbxQueueAds).omit({
  id: true,
  createdAt: true,
});

export const insertPbxExtensionSchema = createInsertSchema(pbxExtensions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPbxAgentStatusSchema = createInsertSchema(pbxAgentStatus).omit({
  id: true,
  updatedAt: true,
});

export const insertPbxActiveCallSchema = createInsertSchema(pbxActiveCalls).omit({
  id: true,
});

export const insertPbxAudioFileSchema = createInsertSchema(pbxAudioFiles).omit({
  id: true,
  createdAt: true,
});

// Types for PBX
export type PbxSettings = typeof pbxSettings.$inferSelect;
export type InsertPbxSettings = z.infer<typeof insertPbxSettingsSchema>;

export type PbxIvr = typeof pbxIvrs.$inferSelect;
export type InsertPbxIvr = z.infer<typeof insertPbxIvrSchema>;

export type PbxMenuOption = typeof pbxMenuOptions.$inferSelect;
export type InsertPbxMenuOption = z.infer<typeof insertPbxMenuOptionSchema>;

export type PbxQueue = typeof pbxQueues.$inferSelect;
export type InsertPbxQueue = z.infer<typeof insertPbxQueueSchema>;

export type PbxQueueMember = typeof pbxQueueMembers.$inferSelect;
export type InsertPbxQueueMember = z.infer<typeof insertPbxQueueMemberSchema>;

export type PbxQueueAd = typeof pbxQueueAds.$inferSelect;
export type InsertPbxQueueAd = z.infer<typeof insertPbxQueueAdSchema>;

export type PbxExtension = typeof pbxExtensions.$inferSelect;
export type InsertPbxExtension = z.infer<typeof insertPbxExtensionSchema>;

export type PbxAgentStatus = typeof pbxAgentStatus.$inferSelect;
export type InsertPbxAgentStatus = z.infer<typeof insertPbxAgentStatusSchema>;

export type PbxActiveCall = typeof pbxActiveCalls.$inferSelect;
export type InsertPbxActiveCall = z.infer<typeof insertPbxActiveCallSchema>;

export type PbxAudioFile = typeof pbxAudioFiles.$inferSelect;
export type InsertPbxAudioFile = z.infer<typeof insertPbxAudioFileSchema>;

// =============================================================================
// ANDROID PUSH SUBSCRIPTIONS - Web Push for PWA Card System
// =============================================================================

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  
  // Web Push subscription data
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  
  // Device info
  userAgent: text("user_agent"),
  platform: text("platform"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyContactIdx: index("push_subscriptions_company_contact_idx").on(table.companyId, table.contactId),
}));

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// =============================================================================
// WALLET SYSTEM - Apple Wallet + Google Wallet with Analytics
// =============================================================================

// Wallet Pass Status Enums
export const walletAppleStatusEnum = pgEnum("wallet_apple_status", ["created", "installed", "revoked"]);
export const walletGoogleStatusEnum = pgEnum("wallet_google_status", ["created", "saved", "revoked", "unknown"]);

// Wallet Event Types Enum
export const walletEventTypeEnum = pgEnum("wallet_event_type", [
  "link_open",
  "ios_offer_view",
  "android_offer_view", 
  "desktop_offer_view",
  "apple_pkpass_download",
  "apple_device_registered",
  "apple_device_unregistered",
  "apple_pass_get",
  "apple_log",
  "apple_pass_updated",
  "apple_pass_error",
  "google_save_clicked",
  "google_saved_confirmed",
  "google_update",
  "google_error"
]);

// Wallet Members (linked to contacts or standalone)
export const walletMembers = pgTable("wallet_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  
  fullName: text("full_name").notNull(),
  memberId: text("member_id").notNull(),
  email: text("email"),
  phone: text("phone"),
  plan: text("plan").default("standard"),
  memberSince: timestamp("member_since").defaultNow(),
  
  // Insurance carrier info for Apple Wallet pass
  carrierName: text("carrier_name"),
  planId: text("plan_id"),
  planName: text("plan_name"),
  monthlyPremium: text("monthly_premium"),
  metalLevel: text("metal_level"),
  planType: text("plan_type"),
  effectiveDate: text("effective_date"),
  expirationDate: text("expiration_date"),
  marketplaceId: text("marketplace_id"),
  
  // Payment reminder - day of month (1-31) for automatic payment due date
  paymentDay: integer("payment_day"),
  
  // Stable link to policy plan - allows syncing even when memberId changes
  policyPlanId: text("policy_plan_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyMemberIdx: uniqueIndex("wallet_members_company_member_idx").on(table.companyId, table.memberId),
  contactIdx: index("wallet_members_contact_idx").on(table.contactId),
  paymentDayIdx: index("wallet_members_payment_day_idx").on(table.paymentDay),
  policyPlanIdx: index("wallet_members_policy_plan_idx").on(table.policyPlanId),
}));

// Wallet Passes - Stores both Apple and Google pass info
export const walletPasses = pgTable("wallet_passes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => walletMembers.id, { onDelete: "cascade" }),
  
  // Apple Wallet fields
  serialNumber: text("serial_number").notNull().unique(),
  passTypeIdentifier: text("pass_type_identifier"),
  teamIdentifier: text("team_identifier"),
  authToken: text("auth_token").notNull(),
  webServiceUrl: text("web_service_url"),
  appleStatus: walletAppleStatusEnum("apple_status").default("created"),
  
  // Google Wallet fields
  googleClassId: text("google_class_id"),
  googleObjectId: text("google_object_id"),
  googleStatus: walletGoogleStatusEnum("google_status").default("created"),
  
  // Dynamic notification field for APNs push updates
  lastNotification: text("last_notification"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("wallet_passes_company_idx").on(table.companyId),
  memberIdx: index("wallet_passes_member_idx").on(table.memberId),
  serialIdx: index("wallet_passes_serial_idx").on(table.serialNumber),
}));

// Wallet Links - Smart links for OS detection
export const walletLinks = pgTable("wallet_links", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => walletMembers.id, { onDelete: "cascade" }),
  walletPassId: text("wallet_pass_id").references(() => walletPasses.id, { onDelete: "cascade" }),
  
  slug: text("slug").notNull().unique(),
  url: text("url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("wallet_links_slug_idx").on(table.slug),
  companyIdx: index("wallet_links_company_idx").on(table.companyId),
}));

// Wallet Events - Core Analytics
export const walletEvents = pgTable("wallet_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  memberId: text("member_id").references(() => walletMembers.id, { onDelete: "set null" }),
  walletPassId: text("wallet_pass_id").references(() => walletPasses.id, { onDelete: "set null" }),
  
  type: walletEventTypeEnum("type").notNull(),
  
  // Device/Browser info
  userAgent: text("user_agent"),
  os: text("os"),
  deviceType: text("device_type"),
  browser: text("browser"),
  ip: text("ip"),
  country: text("country"),
  region: text("region"),
  referrer: text("referrer"),
  
  // Additional metadata as JSON
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("wallet_events_company_idx").on(table.companyId),
  memberIdx: index("wallet_events_member_idx").on(table.memberId),
  typeIdx: index("wallet_events_type_idx").on(table.type),
  createdAtIdx: index("wallet_events_created_at_idx").on(table.createdAt),
}));

// Wallet Devices - Apple device registrations
export const walletDevices = pgTable("wallet_devices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  walletPassId: text("wallet_pass_id").notNull().references(() => walletPasses.id, { onDelete: "cascade" }),
  
  deviceLibraryIdentifier: text("device_library_identifier").notNull(),
  pushToken: text("push_token"),
  deviceInfo: jsonb("device_info"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => ({
  passDeviceIdx: uniqueIndex("wallet_devices_pass_device_idx").on(table.walletPassId, table.deviceLibraryIdentifier),
  deviceIdx: index("wallet_devices_device_idx").on(table.deviceLibraryIdentifier),
}));

// Wallet Settings - Per-company wallet configuration
export const walletSettings = pgTable("wallet_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
  
  // Apple Wallet Configuration
  // Note: WWDR Certificate is global Apple infrastructure, not tenant-specific
  // It's included as a static file in the backend (server/certs/AppleWWDRCAG4.cer)
  appleTeamId: text("apple_team_id"),
  applePassTypeIdentifier: text("apple_pass_type_identifier"),
  appleP12Base64: text("apple_p12_base64"),
  appleP12Password: text("apple_p12_password"),
  
  // Google Wallet Configuration
  googleServiceAccountJsonBase64: text("google_service_account_json_base64"),
  googleIssuerId: text("google_issuer_id"),
  
  // Encryption key for tokens (32 bytes)
  encryptionKey: text("encryption_key"),
  
  // Auto-send wallet link message template
  walletLinkMessage: text("wallet_link_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertWalletMemberSchema = createInsertSchema(walletMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletPassSchema = createInsertSchema(walletPasses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletLinkSchema = createInsertSchema(walletLinks).omit({
  id: true,
  createdAt: true,
});

export const insertWalletEventSchema = createInsertSchema(walletEvents).omit({
  id: true,
  createdAt: true,
});

export const insertWalletDeviceSchema = createInsertSchema(walletDevices).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});

export const insertWalletSettingsSchema = createInsertSchema(walletSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type WalletMember = typeof walletMembers.$inferSelect;
export type InsertWalletMember = z.infer<typeof insertWalletMemberSchema>;

export type WalletPass = typeof walletPasses.$inferSelect;
export type InsertWalletPass = z.infer<typeof insertWalletPassSchema>;

export type WalletLink = typeof walletLinks.$inferSelect;
export type InsertWalletLink = z.infer<typeof insertWalletLinkSchema>;

export type WalletEvent = typeof walletEvents.$inferSelect;
export type InsertWalletEvent = z.infer<typeof insertWalletEventSchema>;

export type WalletDevice = typeof walletDevices.$inferSelect;
export type InsertWalletDevice = z.infer<typeof insertWalletDeviceSchema>;

export type WalletSettings = typeof walletSettings.$inferSelect;
export type InsertWalletSettings = z.infer<typeof insertWalletSettingsSchema>;

// ==================== 10DLC Brand Registration ====================

export const brandEntityTypeEnum = pgEnum("brand_entity_type", [
  "PRIVATE_PROFIT",
  "PUBLIC_PROFIT", 
  "NON_PROFIT",
  "GOVERNMENT",
  "SOLE_PROPRIETOR"
]);

export const brandVerticalEnum = pgEnum("brand_vertical", [
  "REAL_ESTATE",
  "HEALTHCARE",
  "ENERGY",
  "ENTERTAINMENT",
  "RETAIL",
  "AGRICULTURE",
  "INSURANCE",
  "EDUCATION",
  "HOSPITALITY",
  "FINANCIAL",
  "GAMBLING",
  "CONSTRUCTION",
  "NGO",
  "MANUFACTURING",
  "GOVERNMENT",
  "TECHNOLOGY",
  "COMMUNICATION"
]);

export const brandStatusEnum = pgEnum("brand_status", [
  "PENDING",
  "VERIFIED",
  "UNVERIFIED",
  "VETTED_VERIFIED",
  "SELF_DECLARED",
  "EXPIRED"
]);

export const telnyxBrands = pgTable("telnyx_brands", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id", { length: 255 }).references(() => companies.id).notNull(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  
  // Telnyx/TCR identifiers
  brandId: varchar("brand_id", { length: 255 }).unique(),
  tcrBrandId: varchar("tcr_brand_id", { length: 255 }),
  
  // Required fields
  entityType: brandEntityTypeEnum("entity_type").notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  country: varchar("country", { length: 2 }).notNull().default("US"),
  email: varchar("email", { length: 100 }).notNull(),
  vertical: brandVerticalEnum("vertical").notNull(),
  
  // Conditional fields (based on entityType)
  companyName: varchar("company_name", { length: 100 }),
  ein: varchar("ein", { length: 20 }),
  businessContactEmail: varchar("business_contact_email", { length: 100 }),
  stockSymbol: varchar("stock_symbol", { length: 10 }),
  stockExchange: varchar("stock_exchange", { length: 50 }),
  
  // Optional contact info
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  mobilePhone: varchar("mobile_phone", { length: 20 }),
  
  // Optional address
  street: varchar("street", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 20 }),
  postalCode: varchar("postal_code", { length: 10 }),
  
  // Additional
  website: varchar("website", { length: 100 }),
  isReseller: boolean("is_reseller").default(false),
  webhookUrl: text("webhook_url"),
  
  // Status
  status: varchar("status", { length: 50 }).default("PENDING"),
  identityStatus: varchar("identity_status", { length: 50 }),
  
  // Full response from Telnyx
  brandData: jsonb("brand_data"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTelnyxBrandSchema = createInsertSchema(telnyxBrands).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TelnyxBrand = typeof telnyxBrands.$inferSelect;
export type InsertTelnyxBrand = z.infer<typeof insertTelnyxBrandSchema>;

// =====================================================
// TELNYX SMS INBOX (Conversations & Messages)
// =====================================================

// Message direction for SMS inbox
export const telnyxMessageDirectionEnum = pgEnum("telnyx_message_direction", ["inbound", "outbound"]);

// Message type for internal notes vs regular messages
export const telnyxMessageTypeEnum = pgEnum("telnyx_message_type", ["incoming", "outgoing", "internal_note"]);

// Message channel
export const telnyxMessageChannelEnum = pgEnum("telnyx_message_channel", ["sms", "whatsapp", "imessage", "email", "facebook", "instagram", "live_chat", "rcs", "telegram"]);

// Conversation status
export const telnyxConversationStatusEnum = pgEnum("telnyx_conversation_status", ["open", "pending", "solved", "snoozed", "archived", "waiting"]);

// Message status
export const telnyxMessageStatusEnum = pgEnum("telnyx_message_status", [
  "pending", "sending", "sent", "delivered", "failed", "receiving", "received"
]);

// Telnyx Conversations - Thread-level grouping of messages by phone number
export const telnyxConversations = pgTable("telnyx_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(), // Customer phone number (E.164)
  displayName: text("display_name"), // Customer display name if known
  email: text("email"), // Customer email
  jobTitle: text("job_title"), // Customer job title
  organization: text("organization"), // Customer organization/company
  companyPhoneNumber: text("company_phone_number").notNull(), // The Telnyx number we're using (E.164)
  lastMessage: text("last_message"), // Preview of last message
  lastMediaUrls: text("last_media_urls").array(), // Media URLs from last message for preview
  lastMessageAt: timestamp("last_message_at"), // Timestamp of last message
  unreadCount: integer("unread_count").notNull().default(0), // Count of unread inbound messages
  status: telnyxConversationStatusEnum("status").notNull().default("open"), // Conversation status for filtering
  channel: telnyxMessageChannelEnum("channel").notNull().default("sms"), // Primary channel for this conversation
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }), // Assigned agent
  // Live chat visitor metadata
  visitorIpAddress: text("visitor_ip_address"), // Visitor IP address
  visitorCity: text("visitor_city"), // Visitor city from geolocation
  visitorState: text("visitor_state"), // Visitor state from geolocation
  visitorCountry: text("visitor_country"), // Visitor country from geolocation
  visitorCurrentUrl: text("visitor_current_url"), // Page URL where chat started
  visitorBrowser: text("visitor_browser"), // Browser name and version
  visitorOs: text("visitor_os"), // Operating system
  widgetId: varchar("widget_id"), // Widget ID for live chat
  // Satisfaction survey fields
  satisfactionRating: integer("satisfaction_rating"), // 1-5 rating from visitor
  satisfactionFeedback: text("satisfaction_feedback"), // Optional text feedback
  satisfactionSubmittedAt: timestamp("satisfaction_submitted_at"), // When survey was submitted
  
  // Intercom-style read/seen tracking
  deviceId: varchar("device_id"), // Reference to the device that owns this conversation
  visitorLastReadAt: timestamp("visitor_last_read_at"), // When visitor last read the conversation
  agentLastReadAt: timestamp("agent_last_read_at"), // When agent last read the conversation
  visitorLastSeenAt: timestamp("visitor_last_seen_at"), // When visitor saw the agent's response
  agentLastSeenAt: timestamp("agent_last_seen_at"), // When agent started typing/responded (Intercom-style "seen")
  conversationStatus: varchar("conversation_status").default("open"), // open, closed for Intercom-style lifecycle
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique conversation per phone number pair per company
  companyPhoneUnique: uniqueIndex("telnyx_conversations_company_phone_unique").on(table.companyId, table.phoneNumber, table.companyPhoneNumber),
  deviceIdIdx: index("telnyx_conversations_device_id_idx").on(table.deviceId),
}));

export const insertTelnyxConversationSchema = createInsertSchema(telnyxConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TelnyxConversation = typeof telnyxConversations.$inferSelect;
export type InsertTelnyxConversation = z.infer<typeof insertTelnyxConversationSchema>;

// Telnyx Messages - Individual messages within a conversation
export const telnyxMessages = pgTable("telnyx_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => telnyxConversations.id, { onDelete: "cascade" }),
  direction: telnyxMessageDirectionEnum("direction").notNull(), // inbound or outbound
  messageType: telnyxMessageTypeEnum("message_type").notNull().default("outgoing"), // incoming, outgoing, or internal_note
  channel: telnyxMessageChannelEnum("channel").notNull().default("sms"), // sms, whatsapp, imessage, etc.
  text: text("text").notNull(), // Message content
  contentType: text("content_type").notNull().default("text"), // text, image, file
  mediaUrls: text("media_urls").array(), // Array of media URLs for MMS attachments
  status: telnyxMessageStatusEnum("status").notNull().default("pending"), // Message delivery status
  telnyxMessageId: text("telnyx_message_id"), // Telnyx API message ID for tracking
  clientMessageId: varchar("client_message_id"), // Client-generated UUID for idempotency (Intercom-style)
  sentBy: varchar("sent_by").references(() => users.id, { onDelete: "set null" }), // User who sent outbound messages
  sentAt: timestamp("sent_at"), // When message was sent
  deliveredAt: timestamp("delivered_at"), // When message was delivered
  readAt: timestamp("read_at"), // When message was read by recipient
  errorMessage: text("error_message"), // Error details if failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index("telnyx_messages_conversation_idx").on(table.conversationId),
  telnyxMessageIdIdx: index("telnyx_messages_telnyx_id_idx").on(table.telnyxMessageId),
  clientMessageIdIdx: index("telnyx_messages_client_message_id_idx").on(table.clientMessageId),
}));

export const insertTelnyxMessageSchema = createInsertSchema(telnyxMessages).omit({
  id: true,
  createdAt: true,
});

export type TelnyxMessage = typeof telnyxMessages.$inferSelect;
export type InsertTelnyxMessage = z.infer<typeof insertTelnyxMessageSchema>;

// =====================================================
// MMS MEDIA CACHE (Persistent storage for MMS files)
// =====================================================

export const mmsMediaCache = pgTable("mms_media_cache", {
  id: varchar("id", { length: 64 }).primaryKey(),
  data: text("data").notNull(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MmsMediaCache = typeof mmsMediaCache.$inferSelect;

// =====================================================
// COMPLIANCE APPLICATIONS (10DLC/Toll-Free Registration Wizard)
// =====================================================

export const complianceApplicationStatusEnum = pgEnum("compliance_application_status", [
  "draft", "step_1_complete", "step_2_complete", "step_3_complete", "step_4_complete", "submitted", "approved", "rejected"
]);

export const complianceNumberTypeEnum = pgEnum("compliance_number_type", ["toll_free", "10dlc"]);

export const complianceApplications = pgTable("compliance_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Current progress
  currentStep: integer("current_step").notNull().default(1),
  status: complianceApplicationStatusEnum("status").notNull().default("draft"),
  
  // Step 1: Number Selection
  numberType: complianceNumberTypeEnum("number_type"),
  selectedPhoneNumber: text("selected_phone_number"),
  areaCode: text("area_code"),
  country: text("country").default("US"),
  
  // Step 2: Business Info
  businessName: text("business_name"),
  brandDisplayName: text("brand_display_name"),
  businessType: text("business_type"),
  businessVertical: text("business_vertical"),
  ein: text("ein"),
  businessAddress: text("business_address"),
  businessAddressLine2: text("business_address_line_2"),
  businessCity: text("business_city"),
  businessState: text("business_state"),
  businessZip: text("business_zip"),
  contactFirstName: text("contact_first_name"),
  contactLastName: text("contact_last_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  
  // Step 3: Brand Info (reference to telnyxBrands if created)
  brandId: integer("brand_id").references(() => telnyxBrands.id, { onDelete: "set null" }),
  
  // Step 4: Campaign Info
  campaignDescription: text("campaign_description"),
  messageFlow: text("message_flow"),
  sampleMessages: jsonb("sample_messages").default([]),
  useCase: text("use_case"),
  optInMethod: text("opt_in_method"),
  optOutKeywords: text("opt_out_keywords"),
  helpKeywords: text("help_keywords"),
  
  // Step 4: Additional Campaign Fields
  smsUseCase: text("sms_use_case"),
  messageAudience: text("message_audience"),
  messageContent: text("message_content"),
  estimatedVolume: text("estimated_volume"),
  canadianTraffic: text("canadian_traffic"),
  optInDescription: text("opt_in_description"),
  optInScreenshotUrl: text("opt_in_screenshot_url"),
  optInEvidence: text("opt_in_evidence"),
  smsTermsUrl: text("sms_terms_url"),
  privacyPolicyUrl: text("privacy_policy_url"),
  additionalInformation: text("additional_information"),
  isvReseller: text("isv_reseller"),
  optInWorkflowImageUrls: jsonb("opt_in_workflow_image_urls").default([]),
  
  // Business Registration (Required by Telnyx Jan 2026)
  businessRegistrationType: text("business_registration_type"), // EIN, SSN, DUNS, VAT
  businessRegistrationCountry: text("business_registration_country").default("US"),
  entityType: text("entity_type"), // SOLE_PROPRIETOR, CORPORATION, LLC, etc.
  doingBusinessAs: text("doing_business_as"), // DBA or brand name
  optInKeywords: text("opt_in_keywords"), // e.g., "START, YES, SUBSCRIBE"
  optInConfirmationResponse: text("opt_in_confirmation_response"), // Opt-in confirmation message
  helpMessageResponse: text("help_message_response"), // Help message response
  ageGatedContent: boolean("age_gated_content").default(false), // Whether content is age-gated
  
  // Telnyx Integration
  telnyxManagedAccountId: text("telnyx_managed_account_id"),
  telnyxPhoneNumberId: text("telnyx_phone_number_id"),
  telnyxNumberOrderId: text("telnyx_number_order_id"),
  telnyxVerificationRequestId: text("telnyx_verification_request_id"),
  phoneNumberStatus: text("phone_number_status").default("pending"),
  
  // Metadata
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertComplianceApplicationSchema = createInsertSchema(complianceApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComplianceApplication = typeof complianceApplications.$inferSelect;
export type InsertComplianceApplication = z.infer<typeof insertComplianceApplicationSchema>;

// =====================================================
// AWS SES MULTI-TENANT EMAIL SYSTEM
// =====================================================

// Email status enum for company-level email sending
export const companyEmailStatusEnum = pgEnum("company_email_status", [
  "pending_setup", "pending_verification", "active", "paused", "suspended"
]);

// DKIM status enum
export const dkimStatusEnum = pgEnum("dkim_status", [
  "pending", "success", "failed", "temporary_failure", "not_started"
]);

// Company Email Settings - Per-tenant SES configuration
export const companyEmailSettings = pgTable("company_email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }).unique(),
  
  // SES Tenant Management
  sesTenantId: text("ses_tenant_id"), // SES Tenant ID from CreateTenant API
  
  // Domain Identity
  sendingDomain: text("sending_domain"), // e.g., "mail.agency.com"
  fromEmail: text("from_email"), // Default from email
  replyToEmail: text("reply_to_email"), // Default reply-to email
  senderName: text("sender_name"), // Default sender name
  identityArn: text("identity_arn"), // SES Identity ARN
  
  // Verification Status
  domainVerificationStatus: text("domain_verification_status").default("not_started"), // pending, success, failed
  dkimStatus: dkimStatusEnum("dkim_status").default("not_started"),
  dkimTokens: jsonb("dkim_tokens").default([]), // Array of DKIM CNAME tokens
  spfRecord: text("spf_record"), // SPF TXT record value
  dmarcRecord: text("dmarc_record"), // DMARC TXT record value
  
  // Custom MAIL FROM domain
  mailFromDomain: text("mail_from_domain"), // e.g., "bounce.agency.com"
  mailFromStatus: text("mail_from_status").default("not_configured"), // not_configured, pending, success, failed
  mailFromMxRecord: text("mail_from_mx_record"), // MX record for MAIL FROM
  
  // Configuration Set
  configurationSetName: text("configuration_set_name"), // SES Configuration Set name
  eventDestinationName: text("event_destination_name"), // EventBridge/SNS destination name
  
  // Sending Status & Controls
  emailStatus: companyEmailStatusEnum("email_status").default("pending_setup"),
  
  // Rate Limits & Warm-up
  dailySendLimit: integer("daily_send_limit").default(200), // Daily send quota
  hourlySendLimit: integer("hourly_send_limit").default(50), // Hourly rate limit
  minuteSendLimit: integer("minute_send_limit").default(10), // Per-minute rate limit
  warmUpStage: integer("warm_up_stage").default(1), // Current warm-up stage (1-10)
  warmUpStartedAt: timestamp("warm_up_started_at"), // When warm-up started
  
  // Metrics (cached, updated periodically)
  totalSent: integer("total_sent").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalBounced: integer("total_bounced").default(0),
  totalComplaints: integer("total_complaints").default(0),
  bounceRate: numeric("bounce_rate", { precision: 5, scale: 4 }).default("0"), // e.g., 0.0234 = 2.34%
  complaintRate: numeric("complaint_rate", { precision: 5, scale: 4 }).default("0"),
  lastMetricsUpdateAt: timestamp("last_metrics_update_at"),
  
  // Auto-pause thresholds
  bounceRateThreshold: numeric("bounce_rate_threshold", { precision: 5, scale: 4 }).default("0.05"), // 5% default
  complaintRateThreshold: numeric("complaint_rate_threshold", { precision: 5, scale: 4 }).default("0.001"), // 0.1% default
  autoPauseEnabled: boolean("auto_pause_enabled").default(true),
  pausedAt: timestamp("paused_at"),
  pauseReason: text("pause_reason"),
  
  // Sender profiles - array of {fromEmail, fromName, replyToEmail?}
  senders: jsonb("senders").default([]),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("company_email_settings_company_id_idx").on(table.companyId),
}));

export const insertCompanyEmailSettingsSchema = createInsertSchema(companyEmailSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyEmailSettings = typeof companyEmailSettings.$inferSelect;
export type InsertCompanyEmailSettings = z.infer<typeof insertCompanyEmailSettingsSchema>;

// SES Email Message Status Enum
export const sesEmailStatusEnum = pgEnum("ses_email_status", [
  "queued", "sending", "sent", "delivered", "bounced", "complained", "rejected", "failed"
]);

// SES Email Messages - Individual emails with tracking
export const sesEmailMessages = pgTable("ses_email_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Optional campaign association
  campaignId: varchar("campaign_id").references(() => emailCampaigns.id, { onDelete: "set null" }),
  
  // Sender info
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  replyTo: text("reply_to"),
  
  // Recipient info
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  
  // Content
  subject: text("subject").notNull(),
  htmlContent: text("html_content"),
  textContent: text("text_content"),
  
  // Provider tracking
  providerMessageId: text("provider_message_id"), // SES MessageId
  configurationSetName: text("configuration_set_name"),
  
  // Status tracking
  status: sesEmailStatusEnum("status").default("queued"),
  
  // Timestamps
  queuedAt: timestamp("queued_at").defaultNow(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
  
  // Error handling
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  // Tracking
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  firstOpenedAt: timestamp("first_opened_at"),
  firstClickedAt: timestamp("first_clicked_at"),
  
  // Tags for attribution
  tags: jsonb("tags").default({}), // e.g., { tenantId, campaignId, userId, type }
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  companyIdIdx: index("ses_email_messages_company_id_idx").on(table.companyId),
  providerMessageIdIdx: index("ses_email_messages_provider_message_id_idx").on(table.providerMessageId),
  statusIdx: index("ses_email_messages_status_idx").on(table.status),
  createdAtIdx: index("ses_email_messages_created_at_idx").on(table.createdAt),
}));

export const insertSesEmailMessageSchema = createInsertSchema(sesEmailMessages).omit({
  id: true,
  createdAt: true,
});

export type SesEmailMessage = typeof sesEmailMessages.$inferSelect;
export type InsertSesEmailMessage = z.infer<typeof insertSesEmailMessageSchema>;

// SES Event Type Enum
export const sesEventTypeEnum = pgEnum("ses_event_type", [
  "send", "delivery", "bounce", "complaint", "reject", "open", "click", "rendering_failure", "delivery_delay"
]);

// SES Email Events - Webhook events from SES
export const sesEmailEvents = pgTable("ses_email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to message
  messageId: varchar("message_id").references(() => sesEmailMessages.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Provider reference
  providerMessageId: text("provider_message_id"), // SES MessageId
  
  // Event info
  eventType: sesEventTypeEnum("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp").notNull(),
  
  // Event details
  bounceType: text("bounce_type"), // Permanent, Transient
  bounceSubType: text("bounce_sub_type"), // General, NoEmail, Suppressed, etc.
  complaintFeedbackType: text("complaint_feedback_type"), // abuse, auth-failure, etc.
  diagnosticCode: text("diagnostic_code"),
  
  // Raw payload for debugging
  rawPayload: jsonb("raw_payload").default({}),
  
  // Processing status
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  messageIdIdx: index("ses_email_events_message_id_idx").on(table.messageId),
  companyIdIdx: index("ses_email_events_company_id_idx").on(table.companyId),
  providerMessageIdIdx: index("ses_email_events_provider_message_id_idx").on(table.providerMessageId),
  eventTypeIdx: index("ses_email_events_event_type_idx").on(table.eventType),
  createdAtIdx: index("ses_email_events_created_at_idx").on(table.createdAt),
  providerMessageEventUnique: unique("ses_email_events_provider_message_event_unique").on(table.providerMessageId, table.eventType),
}));

export const insertSesEmailEventSchema = createInsertSchema(sesEmailEvents).omit({
  id: true,
  createdAt: true,
});

export type SesEmailEvent = typeof sesEmailEvents.$inferSelect;
export type InsertSesEmailEvent = z.infer<typeof insertSesEmailEventSchema>;

// Suppression Reason Enum
export const suppressionReasonEnum = pgEnum("suppression_reason", [
  "hard_bounce", "complaint", "manual", "unsubscribe"
]);

// Company Email Suppression - Per-tenant suppression list
export const companyEmailSuppression = pgTable("company_email_suppression", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  email: text("email").notNull(),
  reason: suppressionReasonEnum("reason").notNull(),
  
  // Source info
  sourceMessageId: varchar("source_message_id").references(() => sesEmailMessages.id, { onDelete: "set null" }),
  sourceEventId: varchar("source_event_id").references(() => sesEmailEvents.id, { onDelete: "set null" }),
  
  // Details
  bounceType: text("bounce_type"),
  diagnosticCode: text("diagnostic_code"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  companyEmailUnique: unique("company_email_suppression_unique").on(table.companyId, table.email),
  companyIdIdx: index("company_email_suppression_company_id_idx").on(table.companyId),
  emailIdx: index("company_email_suppression_email_idx").on(table.email),
}));

export const insertCompanyEmailSuppressionSchema = createInsertSchema(companyEmailSuppression).omit({
  id: true,
  createdAt: true,
});

export type CompanyEmailSuppression = typeof companyEmailSuppression.$inferSelect;
export type InsertCompanyEmailSuppression = z.infer<typeof insertCompanyEmailSuppressionSchema>;

// Email Queue - For queue-based async sending
export const sesEmailQueue = pgTable("ses_email_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  
  // Reference to the message
  messageId: varchar("message_id").notNull().references(() => sesEmailMessages.id, { onDelete: "cascade" }),
  
  // Priority (lower = higher priority)
  priority: integer("priority").default(5),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for").defaultNow(),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextAttemptAt: timestamp("next_attempt_at"),
  
  // Processing status
  status: text("status").default("pending"), // pending, processing, completed, failed
  errorMessage: text("error_message"),
  
  // Row locking for concurrent processing prevention
  lockedAt: timestamp("locked_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  companyIdIdx: index("ses_email_queue_company_id_idx").on(table.companyId),
  statusIdx: index("ses_email_queue_status_idx").on(table.status),
  scheduledForIdx: index("ses_email_queue_scheduled_for_idx").on(table.scheduledFor),
  priorityIdx: index("ses_email_queue_priority_idx").on(table.priority),
}));

export const insertSesEmailQueueSchema = createInsertSchema(sesEmailQueue).omit({
  id: true,
  createdAt: true,
});

export type SesEmailQueue = typeof sesEmailQueue.$inferSelect;
export type InsertSesEmailQueue = z.infer<typeof insertSesEmailQueueSchema>;



