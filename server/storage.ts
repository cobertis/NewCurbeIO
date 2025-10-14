import { 
  type User, 
  type InsertUser, 
  type Company, 
  type InsertCompany,
  type CompanySettings,
  type InsertCompanySettings,
  type Plan,
  type InsertPlan,
  type Subscription,
  type InsertSubscription,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type Payment,
  type InsertPayment,
  type ActivityLog,
  type InsertActivityLog,
  type Invitation,
  type InsertInvitation,
  type ApiKey,
  type InsertApiKey,
  type Notification,
  type InsertNotification,
  type EmailTemplate,
  type InsertEmailTemplate,
  type Feature,
  type InsertFeature,
  type CompanyFeature,
  type InsertCompanyFeature,
  type OtpCode,
  type InsertOtpCode,
  type SelectActivationToken,
  type InsertActivationToken
} from "@shared/schema";
import { db } from "./db";
import { 
  users, 
  companies, 
  companySettings,
  plans,
  subscriptions,
  invoices,
  invoiceItems,
  payments,
  activityLogs, 
  invitations, 
  apiKeys, 
  notifications,
  emailTemplates,
  features,
  companyFeatures,
  otpCodes,
  activationTokens
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  
  // Company Settings
  getCompanySettings(companyId: string): Promise<CompanySettings | undefined>;
  createCompanySettings(settings: InsertCompanySettings): Promise<CompanySettings>;
  updateCompanySettings(companyId: string, data: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined>;
  
  // Plans
  getPlan(id: string): Promise<Plan | undefined>;
  getAllPlans(): Promise<Plan[]>;
  getActivePlans(): Promise<Plan[]>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, data: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: string): Promise<boolean>;
  
  // Subscriptions
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionByCompany(companyId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  cancelSubscription(id: string, cancelAtPeriodEnd: boolean): Promise<Subscription | undefined>;
  
  // Invoices
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  getInvoicesByCompany(companyId: string): Promise<Invoice[]>;
  getInvoiceByStripeId(stripeInvoiceId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  
  // Invoice Items
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByCompany(companyId: string): Promise<Payment[]>;
  getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByCompany(companyId: string, limit?: number): Promise<ActivityLog[]>;
  getAllActivityLogs(limit?: number): Promise<ActivityLog[]>;
  
  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  acceptInvitation(token: string): Promise<boolean>;
  
  // API Keys
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeysByCompany(companyId: string): Promise<ApiKey[]>;
  deleteApiKey(id: string): Promise<boolean>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  markNotificationEmailSent(id: string): Promise<boolean>;
  
  // Email Templates
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateBySlug(slug: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<boolean>;
  
  // Features
  getAllFeatures(): Promise<Feature[]>;
  getFeature(id: string): Promise<Feature | undefined>;
  createFeature(feature: InsertFeature): Promise<Feature>;
  updateFeature(id: string, data: Partial<InsertFeature>): Promise<Feature | undefined>;
  deleteFeature(id: string): Promise<boolean>;
  
  // Company Features
  getCompanyFeatures(companyId: string): Promise<Feature[]>;
  addFeatureToCompany(companyId: string, featureId: string, enabledBy?: string): Promise<CompanyFeature>;
  removeFeatureFromCompany(companyId: string, featureId: string): Promise<boolean>;
  hasFeature(companyId: string, featureKey: string): Promise<boolean>;
  
  // OTP Codes
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getLatestOtpCode(userId: string, method: string): Promise<OtpCode | undefined>;
  verifyAndMarkUsed(userId: string, code: string): Promise<boolean>;
  deleteExpiredOtpCodes(): Promise<boolean>;
  
  // Activation Tokens
  createActivationToken(token: InsertActivationToken): Promise<SelectActivationToken>;
  getActivationToken(token: string): Promise<SelectActivationToken | undefined>;
  markActivationTokenUsed(token: string): Promise<boolean>;
  validateAndUseToken(token: string): Promise<string | null>;
  deleteExpiredActivationTokens(): Promise<boolean>;
}

export class DbStorage implements IStorage {
  // ==================== USERS ====================
  
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUsersByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.companyId, companyId));
  }

  async updateUser(id: string, data: any): Promise<User | undefined> {
    // Map camelCase to the Drizzle schema format
    const mappedData: any = {};
    if (data.email !== undefined) mappedData.email = data.email;
    if (data.password !== undefined) mappedData.password = data.password;
    if (data.firstName !== undefined) mappedData.firstName = data.firstName;
    if (data.lastName !== undefined) mappedData.lastName = data.lastName;
    if (data.avatar !== undefined) mappedData.avatar = data.avatar;
    if (data.phone !== undefined) mappedData.phone = data.phone;
    if (data.role !== undefined) mappedData.role = data.role;
    if (data.companyId !== undefined) mappedData.companyId = data.companyId;
    if (data.isActive !== undefined) mappedData.isActive = data.isActive;
    if (data.emailVerified !== undefined) mappedData.emailVerified = data.emailVerified;
    
    const result = await db.update(users).set(mappedData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // ==================== COMPANIES ====================
  
  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.slug, slug));
    return result[0];
  }

  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(insertCompany).returning();
    return result[0];
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const result = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return result[0];
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  // ==================== COMPANY SETTINGS ====================
  
  async getCompanySettings(companyId: string): Promise<CompanySettings | undefined> {
    const result = await db.select().from(companySettings).where(eq(companySettings.companyId, companyId));
    return result[0];
  }

  async createCompanySettings(insertSettings: InsertCompanySettings): Promise<CompanySettings> {
    const result = await db.insert(companySettings).values(insertSettings).returning();
    return result[0];
  }

  async updateCompanySettings(companyId: string, data: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined> {
    const result = await db.update(companySettings).set(data).where(eq(companySettings.companyId, companyId)).returning();
    return result[0];
  }

  // ==================== PLANS ====================
  
  async getPlan(id: string): Promise<Plan | undefined> {
    const result = await db.select().from(plans).where(eq(plans.id, id));
    return result[0];
  }

  async getAllPlans(): Promise<Plan[]> {
    return db.select().from(plans).orderBy(desc(plans.createdAt));
  }

  async getActivePlans(): Promise<Plan[]> {
    return db.select().from(plans).where(eq(plans.isActive, true)).orderBy(desc(plans.createdAt));
  }

  async createPlan(insertPlan: InsertPlan): Promise<Plan> {
    const result = await db.insert(plans).values(insertPlan).returning();
    return result[0];
  }

  async updatePlan(id: string, data: Partial<InsertPlan>): Promise<Plan | undefined> {
    const result = await db.update(plans).set(data).where(eq(plans.id, id)).returning();
    return result[0];
  }

  async deletePlan(id: string): Promise<boolean> {
    const result = await db.delete(plans).where(eq(plans.id, id)).returning();
    return result.length > 0;
  }

  // ==================== SUBSCRIPTIONS ====================
  
  async getSubscription(id: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return result[0];
  }

  async getSubscriptionByCompany(companyId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId));
    return result[0];
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return result[0];
  }

  async createSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions).values(insertSubscription).returning();
    return result[0];
  }

  async updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const result = await db.update(subscriptions).set(data).where(eq(subscriptions.id, id)).returning();
    return result[0];
  }

  async cancelSubscription(id: string, cancelAtPeriodEnd: boolean): Promise<Subscription | undefined> {
    const data: Partial<InsertSubscription> = {
      cancelAtPeriodEnd,
      ...(cancelAtPeriodEnd ? {} : { status: "cancelled", cancelledAt: new Date() })
    };
    const result = await db.update(subscriptions).set(data).where(eq(subscriptions.id, id)).returning();
    return result[0];
  }

  // ==================== INVOICES ====================
  
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.id, id));
    return result[0];
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber));
    return result[0];
  }

  async getInvoicesByCompany(companyId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.companyId, companyId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoiceByStripeId(stripeInvoiceId: string): Promise<Invoice | undefined> {
    const result = await db.select().from(invoices).where(eq(invoices.stripeInvoiceId, stripeInvoiceId));
    return result[0];
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const result = await db.insert(invoices).values(insertInvoice).returning();
    return result[0];
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const result = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return result[0];
  }

  // ==================== INVOICE ITEMS ====================
  
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async createInvoiceItem(insertItem: InsertInvoiceItem): Promise<InvoiceItem> {
    const result = await db.insert(invoiceItems).values(insertItem).returning();
    return result[0];
  }

  // ==================== PAYMENTS ====================
  
  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id));
    return result[0];
  }

  async getPaymentsByCompany(companyId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.companyId, companyId)).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(insertPayment).returning();
    return result[0];
  }

  async updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined> {
    const result = await db.update(payments).set(data).where(eq(payments.id, id)).returning();
    return result[0];
  }

  // ==================== ACTIVITY LOGS ====================
  
  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(insertLog).returning();
    return result[0];
  }

  async getActivityLogsByCompany(companyId: string, limit: number = 50): Promise<ActivityLog[]> {
    return db.select()
      .from(activityLogs)
      .where(eq(activityLogs.companyId, companyId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getAllActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
    return db.select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  // ==================== INVITATIONS ====================
  
  async createInvitation(insertInvitation: InsertInvitation): Promise<Invitation> {
    const result = await db.insert(invitations).values(insertInvitation).returning();
    return result[0];
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const result = await db.select().from(invitations).where(eq(invitations.token, token));
    return result[0];
  }

  async acceptInvitation(token: string): Promise<boolean> {
    const result = await db.update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.token, token))
      .returning();
    return result.length > 0;
  }

  // ==================== API KEYS ====================
  
  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const result = await db.insert(apiKeys).values(insertApiKey).returning();
    return result[0];
  }

  async getApiKeysByCompany(companyId: string): Promise<ApiKey[]> {
    return db.select().from(apiKeys).where(eq(apiKeys.companyId, companyId));
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return result.length > 0;
  }

  // ==================== NOTIFICATIONS ====================
  
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(insertNotification).returning();
    return result[0];
  }

  async getNotificationsByUser(userId: string, limit: number = 20): Promise<Notification[]> {
    return db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return result.length > 0;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.userId, userId))
      .returning();
    return result.length > 0;
  }

  async markNotificationEmailSent(id: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ emailSent: true, emailSentAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return result.length > 0;
  }

  // ==================== EMAIL TEMPLATES ====================
  
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return db.select()
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.createdAt));
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const result = await db.select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);
    return result[0];
  }

  async getEmailTemplateBySlug(slug: string): Promise<EmailTemplate | undefined> {
    const result = await db.select()
      .from(emailTemplates)
      .where(eq(emailTemplates.slug, slug))
      .limit(1);
    return result[0];
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const result = await db.insert(emailTemplates)
      .values({ ...template, updatedAt: new Date() })
      .returning();
    return result[0];
  }

  async updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const result = await db.update(emailTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteEmailTemplate(id: string): Promise<boolean> {
    const result = await db.delete(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .returning();
    return result.length > 0;
  }

  // ==================== FEATURES ====================
  
  async getAllFeatures(): Promise<Feature[]> {
    return db.select().from(features).orderBy(desc(features.createdAt));
  }

  async getFeature(id: string): Promise<Feature | undefined> {
    const result = await db.select().from(features).where(eq(features.id, id));
    return result[0];
  }

  async createFeature(feature: InsertFeature): Promise<Feature> {
    const result = await db.insert(features).values(feature).returning();
    return result[0];
  }

  async updateFeature(id: string, data: Partial<InsertFeature>): Promise<Feature | undefined> {
    const result = await db.update(features)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(features.id, id))
      .returning();
    return result[0];
  }

  async deleteFeature(id: string): Promise<boolean> {
    const result = await db.delete(features).where(eq(features.id, id)).returning();
    return result.length > 0;
  }

  // ==================== COMPANY FEATURES ====================
  
  async getCompanyFeatures(companyId: string): Promise<Feature[]> {
    const result = await db
      .select({
        id: features.id,
        name: features.name,
        key: features.key,
        description: features.description,
        category: features.category,
        icon: features.icon,
        isActive: features.isActive,
        createdAt: features.createdAt,
        updatedAt: features.updatedAt,
      })
      .from(companyFeatures)
      .innerJoin(features, eq(companyFeatures.featureId, features.id))
      .where(eq(companyFeatures.companyId, companyId));
    return result;
  }

  async addFeatureToCompany(companyId: string, featureId: string, enabledBy?: string): Promise<CompanyFeature> {
    const result = await db.insert(companyFeatures)
      .values({ companyId, featureId, enabledBy })
      .returning();
    return result[0];
  }

  async removeFeatureFromCompany(companyId: string, featureId: string): Promise<boolean> {
    const result = await db.delete(companyFeatures)
      .where(and(
        eq(companyFeatures.companyId, companyId),
        eq(companyFeatures.featureId, featureId)
      ))
      .returning();
    return result.length > 0;
  }

  async hasFeature(companyId: string, featureKey: string): Promise<boolean> {
    const result = await db
      .select()
      .from(companyFeatures)
      .innerJoin(features, eq(companyFeatures.featureId, features.id))
      .where(and(
        eq(companyFeatures.companyId, companyId),
        eq(features.key, featureKey),
        eq(features.isActive, true)
      ))
      .limit(1);
    return result.length > 0;
  }

  // ==================== OTP CODES ====================
  
  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const result = await db.insert(otpCodes).values(otp).returning();
    return result[0];
  }

  async getLatestOtpCode(userId: string, method: string): Promise<OtpCode | undefined> {
    const result = await db
      .select()
      .from(otpCodes)
      .where(and(
        eq(otpCodes.userId, userId),
        eq(otpCodes.method, method),
        eq(otpCodes.used, false)
      ))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    return result[0];
  }

  async verifyAndMarkUsed(userId: string, code: string): Promise<boolean> {
    const result = await db
      .select()
      .from(otpCodes)
      .where(and(
        eq(otpCodes.userId, userId),
        eq(otpCodes.code, code),
        eq(otpCodes.used, false)
      ))
      .limit(1);

    if (result.length === 0) {
      return false;
    }

    const otpCode = result[0];
    const now = new Date();

    if (otpCode.expiresAt < now) {
      return false;
    }

    await db
      .update(otpCodes)
      .set({ used: true, usedAt: now })
      .where(eq(otpCodes.id, otpCode.id));

    return true;
  }

  async deleteExpiredOtpCodes(): Promise<boolean> {
    const now = new Date();
    await db.delete(otpCodes).where(and(
      eq(otpCodes.used, false)
    ));
    return true;
  }
  
  // ==================== ACTIVATION TOKENS ====================
  
  async createActivationToken(token: InsertActivationToken): Promise<SelectActivationToken> {
    const result = await db.insert(activationTokens).values(token).returning();
    return result[0];
  }
  
  async getActivationToken(token: string): Promise<SelectActivationToken | undefined> {
    const result = await db
      .select()
      .from(activationTokens)
      .where(and(
        eq(activationTokens.token, token),
        eq(activationTokens.used, false)
      ))
      .limit(1);
    return result[0];
  }
  
  async markActivationTokenUsed(token: string): Promise<boolean> {
    const result = await db
      .select()
      .from(activationTokens)
      .where(and(
        eq(activationTokens.token, token),
        eq(activationTokens.used, false)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return false;
    }
    
    const activationToken = result[0];
    const now = new Date();
    
    if (activationToken.expiresAt < now) {
      return false;
    }
    
    await db
      .update(activationTokens)
      .set({ used: true, usedAt: now })
      .where(eq(activationTokens.id, activationToken.id));
    
    return true;
  }
  
  async validateAndUseToken(token: string): Promise<string | null> {
    const result = await db
      .select()
      .from(activationTokens)
      .where(and(
        eq(activationTokens.token, token),
        eq(activationTokens.used, false)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    const activationToken = result[0];
    const now = new Date();
    
    if (activationToken.expiresAt < now) {
      return null;
    }
    
    await db
      .update(activationTokens)
      .set({ used: true, usedAt: now })
      .where(eq(activationTokens.id, activationToken.id));
    
    return activationToken.userId;
  }
  
  async deleteExpiredActivationTokens(): Promise<boolean> {
    const now = new Date();
    await db.delete(activationTokens).where(and(
      eq(activationTokens.used, false)
    ));
    return true;
  }
}

export const storage = new DbStorage();
