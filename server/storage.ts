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
  type BillingAddress,
  type InsertBillingAddress,
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
  type EmailCampaign,
  type InsertEmailCampaign,
  type CampaignEmail,
  type InsertCampaignEmail,
  type EmailOpen,
  type InsertEmailOpen,
  type LinkClick,
  type InsertLinkClick,
  type CampaignUnsubscribe,
  type InsertCampaignUnsubscribe,
  type Feature,
  type InsertFeature,
  type CompanyFeature,
  type InsertCompanyFeature,
  type OtpCode,
  type InsertOtpCode,
  type SelectActivationToken,
  type InsertActivationToken,
  type SelectPasswordResetToken,
  type InsertPasswordResetToken,
  type SelectTrustedDevice,
  type InsertTrustedDevice,
  type ContactList,
  type InsertContactList,
  type ContactListMember,
  type InsertContactListMember,
  type SmsCampaign,
  type InsertSmsCampaign,
  type CampaignSmsMessage,
  type InsertCampaignSmsMessage,
  type BroadcastNotification,
  type InsertBroadcastNotification,
  type IncomingSmsMessage,
  type InsertIncomingSmsMessage,
  type OutgoingSmsMessage,
  type InsertOutgoingSmsMessage,
  type SmsChatNote,
  type InsertSmsChatNote,
  type QuoteNote,
  type InsertQuoteNote,
  type SubscriptionDiscount,
  type InsertSubscriptionDiscount,
  type FinancialSupportTicket,
  type InsertFinancialSupportTicket,
  type Quote,
  type InsertQuote,
  type QuoteMember,
  type InsertQuoteMember,
  type UpdateQuoteMember,
  type QuoteMemberIncome,
  type InsertQuoteMemberIncome,
  type UpdateQuoteMemberIncome,
  type QuoteMemberImmigration,
  type InsertQuoteMemberImmigration,
  type UpdateQuoteMemberImmigration,
  type QuoteMemberDocument,
  type InsertQuoteMemberDocument,
  type QuoteDocument,
  type InsertQuoteDocument,
  type QuotePaymentMethod,
  type InsertPaymentMethod,
  type UpdatePaymentMethod,
  type QuoteReminder,
  type InsertQuoteReminder,
  type UpdateQuoteReminder,
  type ConsentDocument,
  type InsertConsentDocument,
  type ConsentSignatureEvent,
  type InsertConsentEvent
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
  billingAddresses,
  activityLogs, 
  invitations, 
  apiKeys, 
  notifications,
  broadcastNotifications,
  emailTemplates,
  emailCampaigns,
  campaignEmails,
  emailOpens,
  linkClicks,
  campaignUnsubscribes,
  features,
  companyFeatures,
  otpCodes,
  activationTokens,
  passwordResetTokens,
  trustedDevices,
  contactLists,
  contactListMembers,
  smsCampaigns,
  campaignSmsMessages,
  incomingSmsMessages,
  outgoingSmsMessages,
  smsChatNotes,
  quoteNotes,
  subscriptionDiscounts,
  financialSupportTickets,
  quotes,
  quoteMembers,
  quoteMemberIncome,
  quoteMemberImmigration,
  quoteMemberDocuments,
  quoteDocuments,
  quotePaymentMethods,
  quoteReminders,
  consentDocuments,
  consentSignatureEvents
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  getCompanyByStripeCustomerId(stripeCustomerId: string): Promise<Company | undefined>;
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
  getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  upsertSubscription(subscription: InsertSubscription): Promise<Subscription>;
  cancelSubscription(id: string, cancelAtPeriodEnd: boolean): Promise<Subscription | undefined>;
  
  // Invoices
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | undefined>;
  getAllInvoices(): Promise<Invoice[]>;
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
  
  // Billing Addresses
  getBillingAddress(companyId: string): Promise<BillingAddress | undefined>;
  createBillingAddress(address: InsertBillingAddress): Promise<BillingAddress>;
  updateBillingAddress(companyId: string, data: Partial<InsertBillingAddress>): Promise<BillingAddress | undefined>;
  
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
  createBroadcastNotification(notification: Omit<InsertNotification, 'userId'>, sentBy: string): Promise<{ notifications: Notification[], broadcast: BroadcastNotification }>;
  getNotificationsByUser(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<boolean>;
  markNotificationEmailSent(id: string): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;
  
  // Broadcast Notifications History
  getBroadcastHistory(limit?: number): Promise<BroadcastNotification[]>;
  getBroadcastNotification(id: string): Promise<BroadcastNotification | undefined>;
  updateBroadcastReadCount(broadcastId: string): Promise<void>;
  
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
  invalidatePreviousOtpCodes(userId: string, method: string): Promise<void>;
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
  
  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<SelectPasswordResetToken>;
  getPasswordResetToken(token: string): Promise<SelectPasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<boolean>;
  validateAndUsePasswordResetToken(token: string): Promise<string | null>;
  deleteExpiredPasswordResetTokens(): Promise<boolean>;
  
  // Trusted Devices
  saveTrustedDevice(device: InsertTrustedDevice): Promise<SelectTrustedDevice>;
  validateTrustedDevice(deviceToken: string): Promise<string | null>;
  removeTrustedDevice(deviceToken: string): Promise<boolean>;
  removeExpiredTrustedDevices(): Promise<boolean>;
  
  // Campaigns (Email)
  getAllCampaigns(): Promise<EmailCampaign[]>;
  getCampaign(id: string): Promise<EmailCampaign | undefined>;
  createCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign>;
  updateCampaign(id: string, data: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;
  
  // Campaign Emails - Individual Email Tracking
  createCampaignEmail(email: InsertCampaignEmail): Promise<CampaignEmail>;
  getCampaignEmails(campaignId: string, filters?: { status?: string; search?: string }): Promise<CampaignEmail[]>;
  updateCampaignEmailStatus(campaignId: string, userId: string, status: string, timestamp?: Date): Promise<CampaignEmail | undefined>;
  
  // Email Subscriptions
  getSubscribedUsers(): Promise<User[]>;
  getUnsubscribedUsersCount(): Promise<number>;
  updateUserSubscription(userId: string, subscribed: boolean): Promise<User | undefined>;
  
  // Email Tracking - Opens
  recordEmailOpen(campaignId: string, userId: string, userAgent?: string, ipAddress?: string): Promise<EmailOpen>;
  getEmailOpens(campaignId: string): Promise<EmailOpen[]>;
  getUniqueOpeners(campaignId: string): Promise<string[]>; // Returns array of unique user IDs
  updateCampaignOpenStats(campaignId: string): Promise<void>;
  
  // Email Tracking - Link Clicks
  recordLinkClick(campaignId: string, userId: string, url: string, userAgent?: string, ipAddress?: string): Promise<LinkClick>;
  getLinkClicks(campaignId: string): Promise<LinkClick[]>;
  getUniqueClickers(campaignId: string): Promise<string[]>; // Returns array of unique user IDs
  getLinkClicksByUrl(campaignId: string): Promise<{url: string, clickCount: number, uniqueClickCount: number}[]>;
  updateCampaignClickStats(campaignId: string): Promise<void>;
  
  // Email Tracking - Campaign Unsubscribes
  recordCampaignUnsubscribe(campaignId: string, userId: string, userAgent?: string, ipAddress?: string): Promise<CampaignUnsubscribe>;
  getCampaignUnsubscribes(campaignId: string): Promise<CampaignUnsubscribe[]>;
  getCampaignUnsubscribeCount(campaignId: string): Promise<number>;
  
  // Campaign Statistics
  getCampaignStats(campaignId: string): Promise<{
    campaign: EmailCampaign;
    opens: EmailOpen[];
    clicks: LinkClick[];
    uniqueOpeners: string[];
    uniqueClickers: string[];
    clicksByUrl: {url: string, clickCount: number, uniqueClickCount: number}[];
    campaignUnsubscribes: number;
  }>;
  
  // Contact Lists
  getAllContactLists(createdBy?: string): Promise<ContactList[]>;
  getContactList(id: string): Promise<ContactList | undefined>;
  createContactList(list: InsertContactList): Promise<ContactList>;
  updateContactList(id: string, data: Partial<InsertContactList>): Promise<ContactList | undefined>;
  deleteContactList(id: string): Promise<boolean>;
  
  // Contact List Members
  getListMembers(listId: string): Promise<User[]>;
  addMemberToList(listId: string, userId: string): Promise<ContactListMember>;
  removeMemberFromList(listId: string, userId: string): Promise<boolean>;
  getListsForUser(userId: string): Promise<ContactList[]>;
  
  // SMS Campaigns
  getAllSmsCampaigns(): Promise<SmsCampaign[]>;
  getSmsCampaign(id: string): Promise<SmsCampaign | undefined>;
  createSmsCampaign(campaign: InsertSmsCampaign): Promise<SmsCampaign>;
  updateSmsCampaign(id: string, data: Partial<InsertSmsCampaign>): Promise<SmsCampaign | undefined>;
  deleteSmsCampaign(id: string): Promise<boolean>;
  
  // Campaign SMS Messages - Individual SMS Tracking
  createCampaignSmsMessage(sms: InsertCampaignSmsMessage): Promise<CampaignSmsMessage>;
  getCampaignSmsMessages(campaignId: string): Promise<CampaignSmsMessage[]>;
  updateCampaignSmsMessageStatus(twilioSid: string, status: string, errorCode?: string, errorMessage?: string): Promise<void>;
  
  // Incoming SMS Messages
  createIncomingSmsMessage(sms: InsertIncomingSmsMessage): Promise<IncomingSmsMessage>;
  getAllIncomingSmsMessages(): Promise<IncomingSmsMessage[]>;
  markSmsAsRead(id: string): Promise<void>;
  
  // Outgoing SMS Messages (Chat)
  createOutgoingSmsMessage(sms: InsertOutgoingSmsMessage): Promise<OutgoingSmsMessage>;
  updateOutgoingSmsMessageStatus(id: string, status: string, twilioSid?: string, errorCode?: string, errorMessage?: string): Promise<void>;
  
  // Chat Conversations
  getChatConversations(): Promise<Array<{
    phoneNumber: string;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    lastMessage: string;
    lastMessageAt: Date;
    unreadCount: number;
  }>>;
  getConversationMessages(phoneNumber: string): Promise<Array<{
    id: string;
    type: 'incoming' | 'outgoing';
    message: string;
    timestamp: Date;
    status?: string;
    sentBy?: string;
    sentByName?: string;
  }>>;
  markConversationAsRead(phoneNumber: string): Promise<void>;
  
  // SMS Chat Notes
  createChatNote(note: InsertSmsChatNote): Promise<SmsChatNote>;
  getChatNotes(phoneNumber: string, companyId: string): Promise<SmsChatNote[]>;
  updateChatNote(id: string, note: string, companyId?: string): Promise<SmsChatNote | undefined>;
  deleteChatNote(id: string, companyId?: string): Promise<void>;
  
  // Quote Notes
  createQuoteNote(note: InsertQuoteNote): Promise<QuoteNote>;
  getQuoteNotes(quoteId: string, companyId: string): Promise<QuoteNote[]>;
  deleteQuoteNote(id: string, companyId?: string): Promise<void>;
  
  // Delete conversation
  deleteConversation(phoneNumber: string, companyId: string): Promise<void>;
  deleteConversationAll(phoneNumber: string): Promise<void>;
  
  // Subscription Discounts
  createSubscriptionDiscount(discount: InsertSubscriptionDiscount): Promise<SubscriptionDiscount>;
  getActiveDiscountForSubscription(subscriptionId: string): Promise<SubscriptionDiscount | undefined>;
  getActiveDiscountForCompany(companyId: string): Promise<SubscriptionDiscount | undefined>;
  getDiscountHistoryForCompany(companyId: string): Promise<SubscriptionDiscount[]>;
  updateDiscountStatus(id: string, status: string): Promise<void>;
  expireOldDiscounts(): Promise<void>;
  
  // Financial Support Tickets
  createFinancialSupportTicket(ticket: InsertFinancialSupportTicket): Promise<FinancialSupportTicket>;
  getFinancialSupportTicketsByUser(userId: string): Promise<Array<FinancialSupportTicket & { 
    company: { id: string; name: string; };
    user: { id: string; firstName: string | null; lastName: string | null; email: string; };
    responder?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
  }>>;
  getAllFinancialSupportTickets(): Promise<Array<FinancialSupportTicket & { 
    company: { id: string; name: string; };
    user: { id: string; firstName: string | null; lastName: string | null; email: string; };
    responder?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
  }>>;
  getFinancialSupportTicket(id: string): Promise<(FinancialSupportTicket & { 
    company: { id: string; name: string; };
    user: { id: string; firstName: string | null; lastName: string | null; email: string; };
    responder?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
  }) | undefined>;
  updateFinancialSupportTicket(id: string, data: {
    status?: string;
    adminResponse?: string;
    respondedBy?: string;
    respondedAt?: Date;
  }): Promise<FinancialSupportTicket | undefined>;
  deleteFinancialSupportTicket(id: string): Promise<boolean>;
  
  // Quotes
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<(Quote & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }) | undefined>;
  getQuotesByCompany(companyId: string): Promise<Array<Quote & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>>;
  getQuotesByAgent(agentId: string): Promise<Array<Quote & {
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>>;
  updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  
  // Quote Members
  getQuoteMembersByQuoteId(quoteId: string, companyId: string): Promise<QuoteMember[]>;
  getQuoteMemberById(memberId: string, companyId: string): Promise<QuoteMember | null>;
  createQuoteMember(data: InsertQuoteMember): Promise<QuoteMember>;
  updateQuoteMember(memberId: string, data: UpdateQuoteMember, companyId: string): Promise<QuoteMember | null>;
  deleteQuoteMember(memberId: string, companyId: string): Promise<boolean>;
  ensureQuoteMember(quoteId: string, companyId: string, role: string, memberData: Partial<InsertQuoteMember>): Promise<{ member: QuoteMember; wasCreated: boolean }>;
  
  // Quote Member Income
  getQuoteMemberIncome(memberId: string, companyId: string): Promise<QuoteMemberIncome | null>;
  createOrUpdateQuoteMemberIncome(data: InsertQuoteMemberIncome): Promise<QuoteMemberIncome>;
  deleteQuoteMemberIncome(memberId: string, companyId: string): Promise<boolean>;
  
  // Quote Member Immigration
  getQuoteMemberImmigration(memberId: string, companyId: string): Promise<QuoteMemberImmigration | null>;
  createOrUpdateQuoteMemberImmigration(data: InsertQuoteMemberImmigration): Promise<QuoteMemberImmigration>;
  deleteQuoteMemberImmigration(memberId: string, companyId: string): Promise<boolean>;
  
  // Quote Member Documents
  getQuoteMemberDocuments(memberId: string, companyId: string): Promise<QuoteMemberDocument[]>;
  getQuoteMemberDocumentById(documentId: string, companyId: string): Promise<QuoteMemberDocument | null>;
  createQuoteMemberDocument(data: InsertQuoteMemberDocument): Promise<QuoteMemberDocument>;
  deleteQuoteMemberDocument(documentId: string, companyId: string): Promise<boolean>;
  
  // Quote Payment Methods
  getQuotePaymentMethods(quoteId: string, companyId: string): Promise<QuotePaymentMethod[]>;
  getQuotePaymentMethodById(paymentMethodId: string, companyId: string): Promise<QuotePaymentMethod | null>;
  createQuotePaymentMethod(data: InsertPaymentMethod): Promise<QuotePaymentMethod>;
  updateQuotePaymentMethod(paymentMethodId: string, data: UpdatePaymentMethod, companyId: string): Promise<QuotePaymentMethod | null>;
  deleteQuotePaymentMethod(paymentMethodId: string, companyId: string): Promise<boolean>;
  setDefaultPaymentMethod(paymentMethodId: string, quoteId: string, companyId: string): Promise<void>;
  
  // Quote Documents
  listQuoteDocuments(quoteId: string, companyId: string, filters?: { category?: string, search?: string }): Promise<Array<Omit<QuoteDocument, 'uploadedBy'> & { uploadedBy: { firstName: string | null; lastName: string | null } | null; belongsToMember: { firstName: string; lastName: string; role: string } | null }>>;
  createQuoteDocument(document: InsertQuoteDocument): Promise<QuoteDocument>;
  getQuoteDocument(id: string, companyId: string): Promise<QuoteDocument | null>;
  deleteQuoteDocument(id: string, companyId: string): Promise<boolean>;
  
  // Unified Quote Detail - Gets all related data in one call
  getQuoteDetail(quoteId: string, companyId: string): Promise<{
    quote: Quote & {
      agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
      creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
    };
    members: Array<{
      member: QuoteMember;
      income?: QuoteMemberIncome;
      immigration?: QuoteMemberImmigration;
      documents: QuoteMemberDocument[];
    }>;
    paymentMethods: QuotePaymentMethod[];
    totalHouseholdIncome: number;
  }>;
  
  // Quote Reminders
  listQuoteReminders(quoteId: string, companyId: string, filters?: { status?: string; priority?: string; userId?: string }): Promise<Array<QuoteReminder & { creator: { firstName: string | null; lastName: string | null } }>>;
  getQuoteReminder(id: string, companyId: string): Promise<QuoteReminder | null>;
  createQuoteReminder(data: InsertQuoteReminder): Promise<QuoteReminder>;
  updateQuoteReminder(id: string, companyId: string, data: UpdateQuoteReminder): Promise<QuoteReminder | null>;
  deleteQuoteReminder(id: string, companyId: string): Promise<boolean>;
  completeQuoteReminder(id: string, companyId: string, userId: string): Promise<QuoteReminder | null>;
  snoozeQuoteReminder(id: string, companyId: string, until: Date): Promise<QuoteReminder | null>;
  
  // Consent Documents
  createConsentDocument(quoteId: string, companyId: string, userId: string): Promise<ConsentDocument>;
  getConsentById(id: string, companyId: string): Promise<ConsentDocument | null>;
  getConsentByToken(token: string): Promise<ConsentDocument | null>;
  listQuoteConsents(quoteId: string, companyId: string): Promise<ConsentDocument[]>;
  updateConsentDocument(id: string, data: Partial<InsertConsentDocument>): Promise<ConsentDocument | null>;
  deleteConsentDocument(id: string, companyId: string): Promise<boolean>;
  signConsent(token: string, signatureData: {
    signedByName: string;
    signedByEmail?: string;
    signedByPhone?: string;
    signerIp?: string;
    signerUserAgent?: string;
    signerTimezone?: string;
    signerLocation?: string;
    signerPlatform?: string;
    signerBrowser?: string;
  }): Promise<ConsentDocument | null>;
  
  // Consent Signature Events
  createConsentEvent(consentDocumentId: string, eventType: string, payload?: Record<string, any>, actorId?: string): Promise<ConsentSignatureEvent>;
  getConsentEvents(consentDocumentId: string): Promise<ConsentSignatureEvent[]>;
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

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phone, phone));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser as any).returning();
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
    // Convert empty string to null for avatar removal
    if (data.avatar !== undefined) mappedData.avatar = data.avatar === "" ? null : data.avatar;
    // Convert empty string to null for phone removal
    if (data.phone !== undefined) mappedData.phone = data.phone === "" ? null : data.phone;
    // Convert string date to Date object for dateOfBirth (Drizzle expects Date for timestamp columns)
    if (data.dateOfBirth !== undefined) {
      if (data.dateOfBirth === "") {
        mappedData.dateOfBirth = null;
      } else {
        mappedData.dateOfBirth = new Date(data.dateOfBirth);
      }
    }
    if (data.preferredLanguage !== undefined) mappedData.preferredLanguage = data.preferredLanguage;
    // Convert empty string to null for address removal
    if (data.address !== undefined) mappedData.address = data.address === "" ? null : data.address;
    if (data.role !== undefined) mappedData.role = data.role;
    if (data.companyId !== undefined) mappedData.companyId = data.companyId;
    if (data.isActive !== undefined) mappedData.isActive = data.isActive;
    if (data.status !== undefined) mappedData.status = data.status;
    if (data.emailVerified !== undefined) mappedData.emailVerified = data.emailVerified;
    // Email preferences
    if (data.emailSubscribed !== undefined) mappedData.emailSubscribed = data.emailSubscribed;
    if (data.emailNotifications !== undefined) mappedData.emailNotifications = data.emailNotifications;
    if (data.invoiceAlerts !== undefined) mappedData.invoiceAlerts = data.invoiceAlerts;
    // 2FA preferences
    if (data.twoFactorEmailEnabled !== undefined) mappedData.twoFactorEmailEnabled = data.twoFactorEmailEnabled;
    if (data.twoFactorSmsEnabled !== undefined) mappedData.twoFactorSmsEnabled = data.twoFactorSmsEnabled;
    // Timezone preference
    if (data.timezone !== undefined) mappedData.timezone = data.timezone;
    // Insurance Profile Information
    if (data.agentInternalCode !== undefined) mappedData.agentInternalCode = data.agentInternalCode;
    if (data.instructionLevel !== undefined) mappedData.instructionLevel = data.instructionLevel;
    if (data.nationalProducerNumber !== undefined) mappedData.nationalProducerNumber = data.nationalProducerNumber;
    if (data.federallyFacilitatedMarketplace !== undefined) mappedData.federallyFacilitatedMarketplace = data.federallyFacilitatedMarketplace;
    if (data.referredBy !== undefined) mappedData.referredBy = data.referredBy;
    // Last login tracking
    if (data.lastLoginAt !== undefined) mappedData.lastLoginAt = data.lastLoginAt;
    
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

  async getCompanyByStripeCustomerId(stripeCustomerId: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.stripeCustomerId, stripeCustomerId));
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

  // Invalidate all active sessions for users of a specific company
  async invalidateCompanySessions(companyId: string): Promise<void> {
    // Get all users from the company
    const companyUsers = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.companyId, companyId));
    
    if (companyUsers.length === 0) return;

    // Delete sessions for each user
    for (const user of companyUsers) {
      await db.execute(sql`
        DELETE FROM session 
        WHERE (sess->>'userId')::text = ${user.id}
      `);
    }
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
    const result = await db.select().from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .orderBy(desc(subscriptions.updatedAt)); // Get the most recently updated subscription
    return result[0];
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return result[0];
  }

  async getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
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

  async upsertSubscription(insertSubscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(subscriptions)
      .values(insertSubscription)
      .onConflictDoUpdate({
        target: subscriptions.companyId,
        set: {
          planId: insertSubscription.planId,
          status: insertSubscription.status,
          trialStart: insertSubscription.trialStart,
          trialEnd: insertSubscription.trialEnd,
          currentPeriodStart: insertSubscription.currentPeriodStart,
          currentPeriodEnd: insertSubscription.currentPeriodEnd,
          stripeCustomerId: insertSubscription.stripeCustomerId,
          stripeSubscriptionId: insertSubscription.stripeSubscriptionId,
          stripeLatestInvoiceId: insertSubscription.stripeLatestInvoiceId,
          cancelAtPeriodEnd: insertSubscription.cancelAtPeriodEnd,
          updatedAt: new Date(),
        }
      })
      .returning();
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

  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
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

  // ==================== BILLING ADDRESSES ====================
  
  async getBillingAddress(companyId: string): Promise<BillingAddress | undefined> {
    const result = await db.select().from(billingAddresses).where(eq(billingAddresses.companyId, companyId));
    return result[0];
  }

  async createBillingAddress(insertAddress: InsertBillingAddress): Promise<BillingAddress> {
    const result = await db.insert(billingAddresses).values(insertAddress).returning();
    return result[0];
  }

  async updateBillingAddress(companyId: string, data: Partial<InsertBillingAddress>): Promise<BillingAddress | undefined> {
    const result = await db.update(billingAddresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(billingAddresses.companyId, companyId))
      .returning();
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
    // First get the notification to check if it's linked to a broadcast
    const [notification] = await db.select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    
    if (!notification) {
      return false;
    }
    
    // Mark as read
    const result = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    
    // If this notification is linked to a broadcast and wasn't already read, increment the broadcast read count
    if (notification.broadcastId && !notification.isRead) {
      await db.update(broadcastNotifications)
        .set({ totalRead: sql`total_read + 1` })
        .where(eq(broadcastNotifications.id, notification.broadcastId));
    }
    
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

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db.delete(notifications)
      .where(eq(notifications.id, id))
      .returning();
    return result.length > 0;
  }

  async createBroadcastNotification(notification: Omit<InsertNotification, 'userId'>, sentBy: string): Promise<{ notifications: Notification[], broadcast: BroadcastNotification }> {
    // Get all active users
    const allUsers = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.isActive, true));
    
    // Save broadcast history first to get the ID
    const broadcastData: InsertBroadcastNotification = {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link || null,
      sentBy,
      totalRecipients: allUsers.length,
      totalRead: 0,
    };
    
    const [broadcast] = await db.insert(broadcastNotifications).values(broadcastData).returning();
    
    // Create notification for each user with broadcastId link
    const notificationData = allUsers.map(user => ({
      ...notification,
      userId: user.id,
      broadcastId: broadcast.id, // Link to broadcast for tracking
    }));
    
    const createdNotifications = await db.insert(notifications).values(notificationData).returning();
    
    return {
      notifications: createdNotifications,
      broadcast,
    };
  }

  async getBroadcastHistory(limit: number = 50): Promise<BroadcastNotification[]> {
    return db.select()
      .from(broadcastNotifications)
      .orderBy(desc(broadcastNotifications.createdAt))
      .limit(limit);
  }

  async getBroadcastNotification(id: string): Promise<BroadcastNotification | undefined> {
    const result = await db.select()
      .from(broadcastNotifications)
      .where(eq(broadcastNotifications.id, id))
      .limit(1);
    return result[0];
  }

  async updateBroadcastReadCount(broadcastId: string): Promise<void> {
    // Count how many notifications from this broadcast have been read
    // This is a simplified version - in a real app you'd need to link notifications to broadcasts
    await db.update(broadcastNotifications)
      .set({ totalRead: sql`total_read + 1` })
      .where(eq(broadcastNotifications.id, broadcastId));
  }

  async deleteBroadcastNotification(id: string): Promise<boolean> {
    // Delete all notifications associated with this broadcast first
    await db.delete(notifications)
      .where(eq(notifications.broadcastId, id));
    
    // Then delete the broadcast from history
    const result = await db.delete(broadcastNotifications)
      .where(eq(broadcastNotifications.id, id))
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
  
  async invalidatePreviousOtpCodes(userId: string, method: string): Promise<void> {
    // Mark all previous unused codes as used to invalidate them
    await db
      .update(otpCodes)
      .set({ used: true, usedAt: new Date() })
      .where(and(
        eq(otpCodes.userId, userId),
        eq(otpCodes.method, method),
        eq(otpCodes.used, false)
      ));
  }

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
  
  // ==================== PASSWORD RESET TOKENS ====================
  
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<SelectPasswordResetToken> {
    const result = await db.insert(passwordResetTokens).values(token).returning();
    return result[0];
  }
  
  async getPasswordResetToken(token: string): Promise<SelectPasswordResetToken | undefined> {
    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false)
      ))
      .limit(1);
    return result[0];
  }
  
  async markPasswordResetTokenUsed(token: string): Promise<boolean> {
    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return false;
    }
    
    const resetToken = result[0];
    const now = new Date();
    
    if (resetToken.expiresAt < now) {
      return false;
    }
    
    await db
      .update(passwordResetTokens)
      .set({ used: true, usedAt: now })
      .where(eq(passwordResetTokens.id, resetToken.id));
    
    return true;
  }
  
  async validateAndUsePasswordResetToken(token: string): Promise<string | null> {
    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false)
      ))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    const resetToken = result[0];
    const now = new Date();
    
    if (resetToken.expiresAt < now) {
      return null;
    }
    
    await db
      .update(passwordResetTokens)
      .set({ used: true, usedAt: now })
      .where(eq(passwordResetTokens.id, resetToken.id));
    
    return resetToken.userId;
  }
  
  async deleteExpiredPasswordResetTokens(): Promise<boolean> {
    const now = new Date();
    await db.delete(passwordResetTokens).where(
      eq(passwordResetTokens.used, false)
    );
    return true;
  }
  
  // ==================== TRUSTED DEVICES ====================
  
  async saveTrustedDevice(device: InsertTrustedDevice): Promise<SelectTrustedDevice> {
    const result = await db.insert(trustedDevices).values(device).returning();
    return result[0];
  }
  
  async validateTrustedDevice(deviceToken: string): Promise<string | null> {
    const result = await db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.deviceToken, deviceToken))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    
    const device = result[0];
    const now = new Date();
    
    // Check if expired
    if (device.expiresAt < now) {
      // Delete expired device
      await db.delete(trustedDevices).where(eq(trustedDevices.id, device.id));
      return null;
    }
    
    return device.userId;
  }
  
  async removeTrustedDevice(deviceToken: string): Promise<boolean> {
    const result = await db
      .delete(trustedDevices)
      .where(eq(trustedDevices.deviceToken, deviceToken))
      .returning();
    return result.length > 0;
  }
  
  async removeExpiredTrustedDevices(): Promise<boolean> {
    const now = new Date();
    await db.delete(trustedDevices).where(
      eq(trustedDevices.expiresAt, now)
    );
    return true;
  }
  
  // ==================== EMAIL CAMPAIGNS ====================
  
  async getAllCampaigns(): Promise<EmailCampaign[]> {
    return db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt));
  }
  
  async getCampaign(id: string): Promise<EmailCampaign | undefined> {
    const result = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
    return result[0];
  }
  
  async createCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign> {
    const result = await db.insert(emailCampaigns).values(campaign).returning();
    return result[0];
  }
  
  async updateCampaign(id: string, data: Partial<InsertEmailCampaign>): Promise<EmailCampaign | undefined> {
    const result = await db.update(emailCampaigns).set(data).where(eq(emailCampaigns.id, id)).returning();
    return result[0];
  }
  
  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id)).returning();
    return result.length > 0;
  }
  
  // ==================== CAMPAIGN EMAILS - INDIVIDUAL TRACKING ====================
  
  async createCampaignEmail(email: InsertCampaignEmail): Promise<CampaignEmail> {
    const result = await db.insert(campaignEmails).values(email).returning();
    return result[0];
  }
  
  async getCampaignEmails(campaignId: string, filters?: { status?: string; search?: string }): Promise<CampaignEmail[]> {
    const conditions = [eq(campaignEmails.campaignId, campaignId)];
    
    if (filters?.status) {
      conditions.push(eq(campaignEmails.status, filters.status));
    }
    
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(sql`LOWER(${campaignEmails.email}) LIKE ${searchTerm}`);
    }
    
    return db.select()
      .from(campaignEmails)
      .where(and(...conditions))
      .orderBy(desc(campaignEmails.sentAt));
  }
  
  async updateCampaignEmailStatus(campaignId: string, userId: string, status: string, timestamp?: Date): Promise<CampaignEmail | undefined> {
    const updateData: any = { status };
    
    // Set appropriate timestamp based on status
    if (timestamp) {
      if (status === 'delivered') updateData.deliveredAt = timestamp;
      else if (status === 'opened') updateData.openedAt = timestamp;
      else if (status === 'clicked') updateData.clickedAt = timestamp;
      else if (status === 'bounced') updateData.bouncedAt = timestamp;
      else if (status === 'unsubscribed') updateData.unsubscribedAt = timestamp;
    }
    
    const result = await db.update(campaignEmails)
      .set(updateData)
      .where(and(
        eq(campaignEmails.campaignId, campaignId),
        eq(campaignEmails.userId, userId)
      ))
      .returning();
    
    return result[0];
  }
  
  // ==================== EMAIL SUBSCRIPTIONS ====================
  
  async getSubscribedUsers(): Promise<User[]> {
    return db.select().from(users).where(
      and(
        eq(users.emailSubscribed, true),
        eq(users.isActive, true),
        eq(users.emailVerified, true)
      )
    );
  }
  
  async getUnsubscribedUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.emailSubscribed, false));
    return Number(result[0]?.count || 0);
  }
  
  async updateUserSubscription(userId: string, subscribed: boolean): Promise<User | undefined> {
    const result = await db.update(users).set({ emailSubscribed: subscribed }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  
  async updateUserSmsSubscription(userId: string, subscribed: boolean): Promise<User | undefined> {
    const result = await db.update(users).set({ smsSubscribed: subscribed }).where(eq(users.id, userId)).returning();
    return result[0];
  }
  
  // ==================== EMAIL TRACKING - OPENS ====================
  
  async recordEmailOpen(campaignId: string, userId: string, userAgent?: string, ipAddress?: string): Promise<EmailOpen> {
    const result = await db.insert(emailOpens).values({
      campaignId,
      userId,
      userAgent,
      ipAddress
    }).returning();
    
    await this.updateCampaignOpenStats(campaignId);
    
    return result[0];
  }
  
  async getEmailOpens(campaignId: string): Promise<any[]> {
    const results = await db.select({
      id: emailOpens.id,
      campaignId: emailOpens.campaignId,
      userId: emailOpens.userId,
      openedAt: emailOpens.openedAt,
      userAgent: emailOpens.userAgent,
      ipAddress: emailOpens.ipAddress,
      userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
      userEmail: users.email
    })
    .from(emailOpens)
    .innerJoin(users, eq(emailOpens.userId, users.id))
    .where(eq(emailOpens.campaignId, campaignId))
    .orderBy(desc(emailOpens.openedAt));
    
    return results;
  }
  
  async getUniqueOpeners(campaignId: string): Promise<string[]> {
    const result = await db.selectDistinct({ userId: emailOpens.userId })
      .from(emailOpens)
      .where(eq(emailOpens.campaignId, campaignId));
    return result.map(r => r.userId);
  }
  
  async updateCampaignOpenStats(campaignId: string): Promise<void> {
    const opens = await this.getEmailOpens(campaignId);
    const uniqueOpeners = await this.getUniqueOpeners(campaignId);
    
    await db.update(emailCampaigns)
      .set({
        openCount: opens.length,
        uniqueOpenCount: uniqueOpeners.length
      })
      .where(eq(emailCampaigns.id, campaignId));
  }
  
  // ==================== EMAIL TRACKING - CLICKS ====================
  
  async recordLinkClick(campaignId: string, userId: string, url: string, userAgent?: string, ipAddress?: string): Promise<LinkClick> {
    const result = await db.insert(linkClicks).values({
      campaignId,
      userId,
      url,
      userAgent,
      ipAddress
    }).returning();
    
    await this.updateCampaignClickStats(campaignId);
    
    return result[0];
  }
  
  async getLinkClicks(campaignId: string): Promise<any[]> {
    const results = await db.select({
      id: linkClicks.id,
      campaignId: linkClicks.campaignId,
      userId: linkClicks.userId,
      url: linkClicks.url,
      clickedAt: linkClicks.clickedAt,
      userAgent: linkClicks.userAgent,
      ipAddress: linkClicks.ipAddress,
      userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
      userEmail: users.email
    })
    .from(linkClicks)
    .innerJoin(users, eq(linkClicks.userId, users.id))
    .where(eq(linkClicks.campaignId, campaignId))
    .orderBy(desc(linkClicks.clickedAt));
    
    return results;
  }
  
  async getUniqueClickers(campaignId: string): Promise<string[]> {
    const result = await db.selectDistinct({ userId: linkClicks.userId })
      .from(linkClicks)
      .where(eq(linkClicks.campaignId, campaignId));
    return result.map(r => r.userId);
  }
  
  async getLinkClicksByUrl(campaignId: string): Promise<{url: string, clickCount: number, uniqueClickCount: number}[]> {
    const clicks = await this.getLinkClicks(campaignId);
    
    const urlStats = clicks.reduce((acc, click) => {
      if (!acc[click.url]) {
        acc[click.url] = {
          url: click.url,
          clickCount: 0,
          uniqueUserIds: new Set<string>()
        };
      }
      acc[click.url].clickCount++;
      acc[click.url].uniqueUserIds.add(click.userId);
      return acc;
    }, {} as Record<string, {url: string, clickCount: number, uniqueUserIds: Set<string>}>);
    
    return Object.values(urlStats).map((stat: any) => ({
      url: stat.url,
      clickCount: stat.clickCount,
      uniqueClickCount: stat.uniqueUserIds.size
    }));
  }
  
  async updateCampaignClickStats(campaignId: string): Promise<void> {
    const clicks = await this.getLinkClicks(campaignId);
    const uniqueClickers = await this.getUniqueClickers(campaignId);
    
    await db.update(emailCampaigns)
      .set({
        clickCount: clicks.length,
        uniqueClickCount: uniqueClickers.length
      })
      .where(eq(emailCampaigns.id, campaignId));
  }
  
  // ==================== EMAIL TRACKING - CAMPAIGN UNSUBSCRIBES ====================
  
  async recordCampaignUnsubscribe(campaignId: string, userId: string, userAgent?: string, ipAddress?: string): Promise<CampaignUnsubscribe> {
    try {
      const result = await db.insert(campaignUnsubscribes).values({
        campaignId,
        userId,
        userAgent,
        ipAddress
      }).returning();
      return result[0];
    } catch (error: any) {
      // If duplicate, return existing record (user already unsubscribed from this campaign)
      if (error.code === '23505') { // Unique constraint violation
        const existing = await db.select().from(campaignUnsubscribes)
          .where(and(
            eq(campaignUnsubscribes.campaignId, campaignId),
            eq(campaignUnsubscribes.userId, userId)
          ))
          .limit(1);
        return existing[0];
      }
      throw error;
    }
  }
  
  async getCampaignUnsubscribes(campaignId: string): Promise<CampaignUnsubscribe[]> {
    return db.select().from(campaignUnsubscribes).where(eq(campaignUnsubscribes.campaignId, campaignId)).orderBy(desc(campaignUnsubscribes.unsubscribedAt));
  }
  
  async getCampaignUnsubscribeCount(campaignId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(campaignUnsubscribes)
      .where(eq(campaignUnsubscribes.campaignId, campaignId));
    return Number(result[0]?.count || 0);
  }
  
  // ==================== CAMPAIGN STATISTICS ====================
  
  async getCampaignStats(campaignId: string): Promise<{
    campaign: EmailCampaign;
    opens: EmailOpen[];
    clicks: LinkClick[];
    uniqueOpeners: string[];
    uniqueClickers: string[];
    clicksByUrl: {url: string, clickCount: number, uniqueClickCount: number}[];
    campaignUnsubscribes: number;
  }> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    const [opens, clicks, uniqueOpeners, uniqueClickers, clicksByUrl, campaignUnsubscribes] = await Promise.all([
      this.getEmailOpens(campaignId),
      this.getLinkClicks(campaignId),
      this.getUniqueOpeners(campaignId),
      this.getUniqueClickers(campaignId),
      this.getLinkClicksByUrl(campaignId),
      this.getCampaignUnsubscribeCount(campaignId)
    ]);
    
    return {
      campaign,
      opens,
      clicks,
      uniqueOpeners,
      uniqueClickers,
      clicksByUrl,
      campaignUnsubscribes
    };
  }
  
  // ==================== SMS CAMPAIGNS ====================
  
  async getAllSmsCampaigns(): Promise<SmsCampaign[]> {
    return db.select().from(smsCampaigns).orderBy(desc(smsCampaigns.createdAt));
  }
  
  async getSmsCampaign(id: string): Promise<SmsCampaign | undefined> {
    const result = await db.select().from(smsCampaigns).where(eq(smsCampaigns.id, id));
    return result[0];
  }
  
  async createSmsCampaign(campaign: InsertSmsCampaign): Promise<SmsCampaign> {
    const result = await db.insert(smsCampaigns).values(campaign).returning();
    return result[0];
  }
  
  async updateSmsCampaign(id: string, data: Partial<InsertSmsCampaign>): Promise<SmsCampaign | undefined> {
    const result = await db.update(smsCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(smsCampaigns.id, id))
      .returning();
    return result[0];
  }
  
  async deleteSmsCampaign(id: string): Promise<boolean> {
    const result = await db.delete(smsCampaigns).where(eq(smsCampaigns.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async createCampaignSmsMessage(sms: InsertCampaignSmsMessage): Promise<CampaignSmsMessage> {
    const result = await db.insert(campaignSmsMessages).values(sms).returning();
    return result[0];
  }
  
  async getCampaignSmsMessages(campaignId: string): Promise<CampaignSmsMessage[]> {
    return db.select().from(campaignSmsMessages)
      .where(eq(campaignSmsMessages.campaignId, campaignId))
      .orderBy(desc(campaignSmsMessages.sentAt));
  }
  
  async updateCampaignSmsMessageStatus(twilioSid: string, status: string, errorCode?: string, errorMessage?: string): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'failed') {
      updateData.failedAt = new Date();
      if (errorCode) updateData.errorCode = errorCode;
      if (errorMessage) updateData.errorMessage = errorMessage;
    }
    
    await db.update(campaignSmsMessages)
      .set(updateData)
      .where(eq(campaignSmsMessages.twilioMessageSid, twilioSid));
  }
  
  // ==================== INCOMING SMS MESSAGES ====================
  
  async createIncomingSmsMessage(sms: InsertIncomingSmsMessage): Promise<IncomingSmsMessage> {
    const result = await db.insert(incomingSmsMessages).values(sms).returning();
    return result[0];
  }
  
  async getAllIncomingSmsMessages(): Promise<IncomingSmsMessage[]> {
    return db.select().from(incomingSmsMessages)
      .orderBy(desc(incomingSmsMessages.receivedAt));
  }
  
  async markSmsAsRead(id: string): Promise<void> {
    await db.update(incomingSmsMessages)
      .set({ isRead: true })
      .where(eq(incomingSmsMessages.id, id));
  }
  
  // ==================== OUTGOING SMS MESSAGES (CHAT) ====================
  
  async createOutgoingSmsMessage(sms: InsertOutgoingSmsMessage): Promise<OutgoingSmsMessage> {
    const result = await db.insert(outgoingSmsMessages).values(sms).returning();
    return result[0];
  }
  
  async updateOutgoingSmsMessageStatus(
    id: string, 
    status: string, 
    twilioSid?: string, 
    errorCode?: string, 
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status };
    
    if (twilioSid) updateData.twilioMessageSid = twilioSid;
    if (status === 'delivered') updateData.deliveredAt = new Date();
    if (errorCode) updateData.errorCode = errorCode;
    if (errorMessage) updateData.errorMessage = errorMessage;
    
    await db.update(outgoingSmsMessages)
      .set(updateData)
      .where(eq(outgoingSmsMessages.id, id));
  }
  
  // ==================== CHAT CONVERSATIONS ====================
  
  async getChatConversations(companyId?: string): Promise<Array<{
    phoneNumber: string;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    userAvatar: string | null;
    lastMessage: string;
    lastMessageAt: Date;
    unreadCount: number;
  }>> {
    // Build a single SQL query that unions incoming and outgoing, then aggregates
    const companyFilter = companyId ? sql`company_id = ${companyId}` : sql`TRUE`;
    
    const conversations = await db.execute<{
      phone_number: string;
      user_id: string | null;
      last_message: string;
      last_message_at: Date;
      unread_count: number;
    }>(sql`
      WITH all_messages AS (
        SELECT 
          from_phone as phone_number,
          message_body,
          received_at as timestamp,
          'incoming' as type
        FROM incoming_sms_messages
        WHERE ${companyFilter}
        
        UNION ALL
        
        SELECT 
          to_phone as phone_number,
          message_body,
          sent_at as timestamp,
          'outgoing' as type
        FROM outgoing_sms_messages
        WHERE ${companyFilter}
      ),
      conversation_summary AS (
        SELECT 
          phone_number,
          (
            SELECT user_id 
            FROM incoming_sms_messages 
            WHERE from_phone = all_messages.phone_number 
              AND ${companyFilter}
            ORDER BY received_at DESC 
            LIMIT 1
          ) as user_id,
          MAX(timestamp) as last_message_at,
          (
            SELECT message_body 
            FROM all_messages a2 
            WHERE a2.phone_number = all_messages.phone_number 
            ORDER BY timestamp DESC 
            LIMIT 1
          ) as last_message,
          (
            SELECT COUNT(*) 
            FROM incoming_sms_messages 
            WHERE from_phone = all_messages.phone_number 
              AND is_read = false 
              AND ${companyFilter}
          ) as unread_count
        FROM all_messages
        GROUP BY phone_number
      )
      SELECT 
        phone_number,
        user_id,
        last_message,
        last_message_at,
        unread_count::integer
      FROM conversation_summary
      ORDER BY last_message_at DESC
    `);
    
    // Enrich with user data
    const enriched = await Promise.all(
      conversations.rows.map(async (conv) => {
        let userName: string | null = null;
        let userEmail: string | null = null;
        let userAvatar: string | null = null;
        
        if (conv.user_id) {
          const user = await this.getUser(conv.user_id);
          if (user) {
            userName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.firstName || user.lastName || null;
            userEmail = user.email;
            userAvatar = user.avatar || null;
          }
        }
        
        return {
          phoneNumber: conv.phone_number,
          userId: conv.user_id,
          userName,
          userEmail,
          userAvatar,
          lastMessage: conv.last_message || '',
          lastMessageAt: conv.last_message_at,
          unreadCount: Number(conv.unread_count || 0),
        };
      })
    );
    
    return enriched;
  }
  
  async getConversationMessages(phoneNumber: string, companyId?: string): Promise<Array<{
    id: string;
    type: 'incoming' | 'outgoing';
    message: string;
    timestamp: Date;
    status?: string;
    sentBy?: string;
    sentByName?: string;
  }>> {
    // Get incoming messages with optional companyId filter
    const incoming = companyId
      ? await db
          .select({
            id: incomingSmsMessages.id,
            message: incomingSmsMessages.messageBody,
            timestamp: incomingSmsMessages.receivedAt,
          })
          .from(incomingSmsMessages)
          .where(and(
            eq(incomingSmsMessages.fromPhone, phoneNumber),
            eq(incomingSmsMessages.companyId, companyId)
          ))
      : await db
          .select({
            id: incomingSmsMessages.id,
            message: incomingSmsMessages.messageBody,
            timestamp: incomingSmsMessages.receivedAt,
          })
          .from(incomingSmsMessages)
          .where(eq(incomingSmsMessages.fromPhone, phoneNumber));
    
    // Get outgoing messages with sender info and optional companyId filter
    const outgoing = companyId
      ? await db
          .select({
            id: outgoingSmsMessages.id,
            message: outgoingSmsMessages.messageBody,
            timestamp: outgoingSmsMessages.sentAt,
            status: outgoingSmsMessages.status,
            sentBy: outgoingSmsMessages.sentBy,
            senderFirstName: users.firstName,
            senderLastName: users.lastName,
          })
          .from(outgoingSmsMessages)
          .leftJoin(users, eq(outgoingSmsMessages.sentBy, users.id))
          .where(and(
            eq(outgoingSmsMessages.toPhone, phoneNumber),
            eq(outgoingSmsMessages.companyId, companyId)
          ))
      : await db
          .select({
            id: outgoingSmsMessages.id,
            message: outgoingSmsMessages.messageBody,
            timestamp: outgoingSmsMessages.sentAt,
            status: outgoingSmsMessages.status,
            sentBy: outgoingSmsMessages.sentBy,
            senderFirstName: users.firstName,
            senderLastName: users.lastName,
          })
          .from(outgoingSmsMessages)
          .leftJoin(users, eq(outgoingSmsMessages.sentBy, users.id))
          .where(eq(outgoingSmsMessages.toPhone, phoneNumber));
    
    // Combine and sort
    const allMessages = [
      ...incoming.map(msg => ({
        id: msg.id,
        type: 'incoming' as const,
        message: msg.message,
        timestamp: msg.timestamp,
      })),
      ...outgoing.map(msg => ({
        id: msg.id,
        type: 'outgoing' as const,
        message: msg.message,
        timestamp: msg.timestamp,
        status: msg.status || undefined,
        sentBy: msg.sentBy || undefined,
        sentByName: msg.senderFirstName && msg.senderLastName 
          ? `${msg.senderFirstName} ${msg.senderLastName}`.trim()
          : msg.senderFirstName || msg.senderLastName || undefined,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return allMessages;
  }
  
  async markConversationAsRead(phoneNumber: string, companyId?: string): Promise<void> {
    if (companyId) {
      await db.update(incomingSmsMessages)
        .set({ isRead: true })
        .where(and(
          eq(incomingSmsMessages.fromPhone, phoneNumber),
          eq(incomingSmsMessages.companyId, companyId)
        ));
    } else {
      await db.update(incomingSmsMessages)
        .set({ isRead: true })
        .where(eq(incomingSmsMessages.fromPhone, phoneNumber));
    }
  }
  
  // ==================== CONTACT LISTS ====================
  
  async getAllContactLists(createdBy?: string): Promise<ContactList[]> {
    let lists: ContactList[];
    
    if (createdBy) {
      lists = await db.select().from(contactLists)
        .where(eq(contactLists.createdBy, createdBy))
        .orderBy(desc(contactLists.createdAt));
    } else {
      lists = await db.select().from(contactLists).orderBy(desc(contactLists.createdAt));
    }
    
    // Calculate member count for each list
    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const members = await db.select({ count: sql<number>`count(*)` })
          .from(contactListMembers)
          .where(eq(contactListMembers.listId, list.id));
        
        return {
          ...list,
          memberCount: Number(members[0].count)
        };
      })
    );
    
    return listsWithCounts;
  }
  
  async getContactList(id: string): Promise<ContactList | undefined> {
    const result = await db.select().from(contactLists).where(eq(contactLists.id, id));
    return result[0];
  }
  
  async createContactList(list: InsertContactList): Promise<ContactList> {
    const result = await db.insert(contactLists).values(list).returning();
    return result[0];
  }
  
  async updateContactList(id: string, data: Partial<InsertContactList>): Promise<ContactList | undefined> {
    const result = await db.update(contactLists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contactLists.id, id))
      .returning();
    return result[0];
  }
  
  async deleteContactList(id: string): Promise<boolean> {
    const result = await db.delete(contactLists).where(eq(contactLists.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // ==================== CONTACT LIST MEMBERS ====================
  
  async getListMembers(listId: string): Promise<User[]> {
    const members = await db.select({ user: users })
      .from(contactListMembers)
      .innerJoin(users, eq(contactListMembers.userId, users.id))
      .where(eq(contactListMembers.listId, listId));
    return members.map(m => m.user);
  }
  
  async addMemberToList(listId: string, userId: string): Promise<ContactListMember> {
    const result = await db.insert(contactListMembers)
      .values({ listId, userId })
      .onConflictDoNothing()
      .returning();
    return result[0];
  }
  
  async removeMemberFromList(listId: string, userId: string): Promise<boolean> {
    const result = await db.delete(contactListMembers)
      .where(and(
        eq(contactListMembers.listId, listId),
        eq(contactListMembers.userId, userId)
      ));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async getListsForUser(userId: string): Promise<ContactList[]> {
    const lists = await db.select({ list: contactLists })
      .from(contactListMembers)
      .innerJoin(contactLists, eq(contactListMembers.listId, contactLists.id))
      .where(eq(contactListMembers.userId, userId));
    return lists.map(l => l.list);
  }
  
  // ==================== SMS CHAT NOTES ====================
  
  async createChatNote(note: InsertSmsChatNote): Promise<SmsChatNote> {
    const result = await db.insert(smsChatNotes).values(note).returning();
    return result[0];
  }
  
  async getChatNotes(phoneNumber: string, companyId: string): Promise<SmsChatNote[]> {
    return db.select().from(smsChatNotes)
      .where(and(
        eq(smsChatNotes.phoneNumber, phoneNumber),
        eq(smsChatNotes.companyId, companyId)
      ))
      .orderBy(desc(smsChatNotes.createdAt));
  }
  
  async updateChatNote(id: string, note: string, companyId?: string): Promise<SmsChatNote | undefined> {
    const conditions = [eq(smsChatNotes.id, id)];
    
    // If companyId is provided, filter by it (for regular admins)
    // If not provided, allow superadmins to update any note
    if (companyId) {
      conditions.push(eq(smsChatNotes.companyId, companyId));
    }
    
    const result = await db.update(smsChatNotes)
      .set({ 
        note,
        updatedAt: new Date()
      })
      .where(and(...conditions))
      .returning();
    return result[0];
  }
  
  async deleteChatNote(id: string, companyId?: string): Promise<void> {
    const conditions = [eq(smsChatNotes.id, id)];
    
    // If companyId is provided, filter by it (for regular admins)
    // If not provided, allow superadmins to delete any note
    if (companyId) {
      conditions.push(eq(smsChatNotes.companyId, companyId));
    }
    
    await db.delete(smsChatNotes)
      .where(and(...conditions));
  }
  
  // ==================== QUOTE NOTES ====================
  
  async createQuoteNote(note: InsertQuoteNote): Promise<QuoteNote> {
    const result = await db.insert(quoteNotes).values(note).returning();
    return result[0];
  }
  
  async getQuoteNotes(quoteId: string, companyId: string): Promise<(QuoteNote & { creatorName: string; creatorAvatar: string | null })[]> {
    const results = await db
      .select({
        id: quoteNotes.id,
        quoteId: quoteNotes.quoteId,
        note: quoteNotes.note,
        attachments: quoteNotes.attachments,
        isImportant: quoteNotes.isImportant,
        isPinned: quoteNotes.isPinned,
        isResolved: quoteNotes.isResolved,
        companyId: quoteNotes.companyId,
        createdBy: quoteNotes.createdBy,
        createdAt: quoteNotes.createdAt,
        updatedAt: quoteNotes.updatedAt,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        creatorAvatar: users.avatar,
      })
      .from(quoteNotes)
      .innerJoin(users, eq(quoteNotes.createdBy, users.id))
      .where(and(
        eq(quoteNotes.quoteId, quoteId),
        eq(quoteNotes.companyId, companyId)
      ))
      .orderBy(desc(quoteNotes.createdAt));
    
    return results.map(row => ({
      id: row.id,
      quoteId: row.quoteId,
      note: row.note,
      attachments: row.attachments,
      isImportant: row.isImportant,
      isPinned: row.isPinned,
      isResolved: row.isResolved,
      companyId: row.companyId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      creatorName: `${row.creatorFirstName || ''} ${row.creatorLastName || ''}`.trim() || 'Unknown User',
      creatorAvatar: row.creatorAvatar,
    }));
  }
  
  async deleteQuoteNote(id: string, companyId?: string): Promise<void> {
    const conditions = [eq(quoteNotes.id, id)];
    
    // If companyId is provided, filter by it (for regular admins)
    // If not provided, allow superadmins to delete any note
    if (companyId) {
      conditions.push(eq(quoteNotes.companyId, companyId));
    }
    
    await db.delete(quoteNotes)
      .where(and(...conditions));
  }
  
  // ==================== DELETE CONVERSATION ====================
  
  async deleteConversation(phoneNumber: string, companyId: string): Promise<void> {
    // Delete all incoming messages
    await db.delete(incomingSmsMessages)
      .where(and(
        eq(incomingSmsMessages.fromPhone, phoneNumber),
        eq(incomingSmsMessages.companyId, companyId)
      ));
    
    // Delete all outgoing messages
    await db.delete(outgoingSmsMessages)
      .where(and(
        eq(outgoingSmsMessages.toPhone, phoneNumber),
        eq(outgoingSmsMessages.companyId, companyId)
      ));
    
    // Delete all notes for this conversation
    await db.delete(smsChatNotes)
      .where(and(
        eq(smsChatNotes.phoneNumber, phoneNumber),
        eq(smsChatNotes.companyId, companyId)
      ));
  }
  
  async deleteConversationAll(phoneNumber: string): Promise<void> {
    // Delete all incoming messages from this phone number (all companies)
    await db.delete(incomingSmsMessages)
      .where(eq(incomingSmsMessages.fromPhone, phoneNumber));
    
    // Delete all outgoing messages to this phone number (all companies)
    await db.delete(outgoingSmsMessages)
      .where(eq(outgoingSmsMessages.toPhone, phoneNumber));
    
    // Delete all notes for this conversation (all companies)
    await db.delete(smsChatNotes)
      .where(eq(smsChatNotes.phoneNumber, phoneNumber));
  }

  // ==================== SUBSCRIPTION DISCOUNTS ====================
  
  async createSubscriptionDiscount(discount: InsertSubscriptionDiscount): Promise<SubscriptionDiscount> {
    const [created] = await db.insert(subscriptionDiscounts).values(discount).returning();
    return created;
  }

  async getActiveDiscountForSubscription(subscriptionId: string): Promise<SubscriptionDiscount | undefined> {
    const [discount] = await db
      .select()
      .from(subscriptionDiscounts)
      .where(
        and(
          eq(subscriptionDiscounts.subscriptionId, subscriptionId),
          eq(subscriptionDiscounts.status, 'active')
        )
      )
      .orderBy(desc(subscriptionDiscounts.appliedAt))
      .limit(1);
    return discount;
  }

  async getActiveDiscountForCompany(companyId: string): Promise<SubscriptionDiscount | undefined> {
    const [discount] = await db
      .select()
      .from(subscriptionDiscounts)
      .where(
        and(
          eq(subscriptionDiscounts.companyId, companyId),
          eq(subscriptionDiscounts.status, 'active')
        )
      )
      .orderBy(desc(subscriptionDiscounts.appliedAt))
      .limit(1);
    return discount;
  }

  async getDiscountHistoryForCompany(companyId: string): Promise<SubscriptionDiscount[]> {
    const discounts = await db
      .select()
      .from(subscriptionDiscounts)
      .where(eq(subscriptionDiscounts.companyId, companyId))
      .orderBy(desc(subscriptionDiscounts.appliedAt));
    return discounts;
  }

  async updateDiscountStatus(id: string, status: string): Promise<void> {
    await db
      .update(subscriptionDiscounts)
      .set({ status })
      .where(eq(subscriptionDiscounts.id, id));
  }

  async expireOldDiscounts(): Promise<void> {
    const now = new Date();
    await db
      .update(subscriptionDiscounts)
      .set({ status: 'expired' })
      .where(
        and(
          eq(subscriptionDiscounts.status, 'active'),
          sql`${subscriptionDiscounts.discountEndDate} < ${now}`
        )
      );
  }

  // ==================== FINANCIAL SUPPORT TICKETS ====================
  
  async createFinancialSupportTicket(ticket: InsertFinancialSupportTicket): Promise<FinancialSupportTicket> {
    const [created] = await db.insert(financialSupportTickets).values(ticket).returning();
    return created;
  }

  async getFinancialSupportTicketsByUser(userId: string): Promise<Array<FinancialSupportTicket & { 
    company: { id: string; name: string; };
    user: { id: string; firstName: string | null; lastName: string | null; email: string; };
    responder?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
  }>> {
    const tickets = await db
      .select({
        ticket: financialSupportTickets,
        company: {
          id: companies.id,
          name: companies.name,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(financialSupportTickets)
      .leftJoin(companies, eq(financialSupportTickets.companyId, companies.id))
      .leftJoin(users, eq(financialSupportTickets.userId, users.id))
      .where(eq(financialSupportTickets.userId, userId))
      .orderBy(desc(financialSupportTickets.createdAt));

    // Now get responders for each ticket
    const results = await Promise.all(
      tickets.map(async (item) => {
        let responder = null;
        if (item.ticket.respondedBy) {
          const responderUser = await this.getUser(item.ticket.respondedBy);
          if (responderUser) {
            responder = {
              id: responderUser.id,
              firstName: responderUser.firstName,
              lastName: responderUser.lastName,
              email: responderUser.email,
            };
          }
        }
        return {
          ...item.ticket,
          company: item.company,
          user: item.user,
          responder,
        };
      })
    );

    return results as any;
  }

  async getAllFinancialSupportTickets(): Promise<Array<FinancialSupportTicket & { 
    company: { id: string; name: string; };
    user: { id: string; firstName: string | null; lastName: string | null; email: string; };
    responder?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
  }>> {
    const tickets = await db
      .select({
        ticket: financialSupportTickets,
        company: {
          id: companies.id,
          name: companies.name,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(financialSupportTickets)
      .leftJoin(companies, eq(financialSupportTickets.companyId, companies.id))
      .leftJoin(users, eq(financialSupportTickets.userId, users.id))
      .orderBy(desc(financialSupportTickets.createdAt));

    // Now get responders for each ticket
    const results = await Promise.all(
      tickets.map(async (item) => {
        let responder = null;
        if (item.ticket.respondedBy) {
          const responderUser = await this.getUser(item.ticket.respondedBy);
          if (responderUser) {
            responder = {
              id: responderUser.id,
              firstName: responderUser.firstName,
              lastName: responderUser.lastName,
              email: responderUser.email,
            };
          }
        }
        return {
          ...item.ticket,
          company: item.company,
          user: item.user,
          responder,
        };
      })
    );

    return results as any;
  }

  async getFinancialSupportTicket(id: string): Promise<(FinancialSupportTicket & { 
    company: { id: string; name: string; };
    user: { id: string; firstName: string | null; lastName: string | null; email: string; };
    responder?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
  }) | undefined> {
    const [ticket] = await db
      .select({
        ticket: financialSupportTickets,
        company: {
          id: companies.id,
          name: companies.name,
        },
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(financialSupportTickets)
      .leftJoin(companies, eq(financialSupportTickets.companyId, companies.id))
      .leftJoin(users, eq(financialSupportTickets.userId, users.id))
      .where(eq(financialSupportTickets.id, id))
      .limit(1);

    if (!ticket) {
      return undefined;
    }

    let responder = null;
    if (ticket.ticket.respondedBy) {
      const responderUser = await this.getUser(ticket.ticket.respondedBy);
      if (responderUser) {
        responder = {
          id: responderUser.id,
          firstName: responderUser.firstName,
          lastName: responderUser.lastName,
          email: responderUser.email,
        };
      }
    }

    return {
      ...ticket.ticket,
      company: ticket.company,
      user: ticket.user,
      responder,
    } as any;
  }

  async updateFinancialSupportTicket(id: string, data: {
    status?: string;
    adminResponse?: string;
    respondedBy?: string;
    respondedAt?: Date;
  }): Promise<FinancialSupportTicket | undefined> {
    const [updated] = await db
      .update(financialSupportTickets)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(financialSupportTickets.id, id))
      .returning();
    return updated;
  }

  async deleteFinancialSupportTicket(id: string): Promise<boolean> {
    const result = await db
      .delete(financialSupportTickets)
      .where(eq(financialSupportTickets.id, id))
      .returning();
    return result.length > 0;
  }

  // ==================== QUOTES ====================

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const { generateShortId } = await import("./id-generator");
    
    // Generate unique short ID
    let shortId: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      shortId = generateShortId();
      const existing = await db.select().from(quotes).where(eq(quotes.id, shortId)).limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique quote ID");
    }
    
    const [quote] = await db
      .insert(quotes)
      .values({ ...insertQuote, id: shortId } as any)
      .returning();
    return quote;
  }

  async getQuote(id: string): Promise<(Quote & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }) | undefined> {
    const result = await db
      .select({
        quote: quotes,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.createdBy, users.id))
      .where(eq(quotes.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return undefined;
    }

    const quote = result[0];
    let agent = null;

    if (quote.quote.agentId) {
      const agentUser = await this.getUser(quote.quote.agentId);
      if (agentUser) {
        agent = {
          id: agentUser.id,
          firstName: agentUser.firstName,
          lastName: agentUser.lastName,
          email: agentUser.email,
        };
      }
    }

    return {
      ...quote.quote,
      creator: quote.creator,
      agent,
    } as any;
  }

  async getQuotesByCompany(companyId: string): Promise<Array<Quote & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>> {
    const results = await db
      .select({
        quote: quotes,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.createdBy, users.id))
      .where(eq(quotes.companyId, companyId))
      .orderBy(desc(quotes.createdAt));

    const quotesWithDetails = await Promise.all(
      results.map(async (result) => {
        let agent = null;
        if (result.quote.agentId) {
          const agentUser = await this.getUser(result.quote.agentId);
          if (agentUser) {
            agent = {
              id: agentUser.id,
              firstName: agentUser.firstName,
              lastName: agentUser.lastName,
              email: agentUser.email,
            };
          }
        }

        return {
          ...result.quote,
          creator: result.creator,
          agent,
        } as any;
      })
    );

    return quotesWithDetails;
  }

  async getQuotesByAgent(agentId: string): Promise<Array<Quote & {
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>> {
    const results = await db
      .select({
        quote: quotes,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.createdBy, users.id))
      .where(eq(quotes.agentId, agentId))
      .orderBy(desc(quotes.createdAt));

    return results.map((result) => ({
      ...result.quote,
      creator: result.creator,
    })) as any;
  }

  async updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [updated] = await db
      .update(quotes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async deleteQuote(id: string): Promise<boolean> {
    const result = await db
      .delete(quotes)
      .where(eq(quotes.id, id))
      .returning();
    return result.length > 0;
  }
  
  // ==================== QUOTE MEMBERS ====================
  
  async getQuoteMembersByQuoteId(quoteId: string, companyId: string): Promise<QuoteMember[]> {
    return db
      .select()
      .from(quoteMembers)
      .where(
        and(
          eq(quoteMembers.quoteId, quoteId),
          eq(quoteMembers.companyId, companyId)
        )
      )
      .orderBy(quoteMembers.createdAt);
  }
  
  async getQuoteMemberById(memberId: string, companyId: string): Promise<QuoteMember | null> {
    const [member] = await db
      .select()
      .from(quoteMembers)
      .where(
        and(
          eq(quoteMembers.id, memberId),
          eq(quoteMembers.companyId, companyId)
        )
      );
    return member || null;
  }
  
  async createQuoteMember(data: InsertQuoteMember): Promise<QuoteMember> {
    const [member] = await db
      .insert(quoteMembers)
      .values(data)
      .returning();
    return member;
  }
  
  async updateQuoteMember(memberId: string, data: UpdateQuoteMember, companyId: string): Promise<QuoteMember | null> {
    const [updated] = await db
      .update(quoteMembers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(quoteMembers.id, memberId),
          eq(quoteMembers.companyId, companyId)
        )
      )
      .returning();
    return updated || null;
  }
  
  async deleteQuoteMember(memberId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quoteMembers)
      .where(
        and(
          eq(quoteMembers.id, memberId),
          eq(quoteMembers.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  async ensureQuoteMember(
    quoteId: string,
    companyId: string,
    role: string,
    memberData: Partial<InsertQuoteMember>
  ): Promise<{ member: QuoteMember; wasCreated: boolean }> {
    // Try to find existing member by quoteId + role + SSN (most reliable)
    let existingMember: QuoteMember | undefined;
    
    if (memberData.ssn) {
      const members = await db
        .select()
        .from(quoteMembers)
        .where(
          and(
            eq(quoteMembers.quoteId, quoteId),
            eq(quoteMembers.companyId, companyId),
            eq(quoteMembers.role, role),
            eq(quoteMembers.ssn, memberData.ssn)
          )
        );
      existingMember = members[0];
    }
    
    // Fallback: match by name and DOB if SSN not available
    if (!existingMember && memberData.firstName && memberData.lastName && memberData.dateOfBirth) {
      const members = await db
        .select()
        .from(quoteMembers)
        .where(
          and(
            eq(quoteMembers.quoteId, quoteId),
            eq(quoteMembers.companyId, companyId),
            eq(quoteMembers.role, role),
            eq(quoteMembers.firstName, memberData.firstName),
            eq(quoteMembers.lastName, memberData.lastName),
            eq(quoteMembers.dateOfBirth, memberData.dateOfBirth)
          )
        );
      existingMember = members[0];
    }
    
    if (existingMember) {
      // Update existing member
      const [updated] = await db
        .update(quoteMembers)
        .set({
          ...memberData,
          updatedAt: new Date(),
        })
        .where(eq(quoteMembers.id, existingMember.id))
        .returning();
      return { member: updated, wasCreated: false };
    } else {
      // Create new member
      const [created] = await db
        .insert(quoteMembers)
        .values({
          quoteId,
          companyId,
          role,
          ...memberData,
        } as InsertQuoteMember)
        .returning();
      return { member: created, wasCreated: true };
    }
  }
  
  // ==================== QUOTE MEMBER INCOME ====================
  
  async getQuoteMemberIncome(memberId: string, companyId: string): Promise<QuoteMemberIncome | null> {
    const [income] = await db
      .select()
      .from(quoteMemberIncome)
      .where(
        and(
          eq(quoteMemberIncome.memberId, memberId),
          eq(quoteMemberIncome.companyId, companyId)
        )
      );
    return income || null;
  }
  
  async createOrUpdateQuoteMemberIncome(data: InsertQuoteMemberIncome): Promise<QuoteMemberIncome> {
    // Filter out null/undefined values to prevent overwriting existing data with nulls
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null && value !== undefined)
    );
    
    const [result] = await db
      .insert(quoteMemberIncome)
      .values(data)
      .onConflictDoUpdate({
        target: quoteMemberIncome.memberId,
        set: {
          ...updateData,  // Only update non-null fields
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }
  
  async deleteQuoteMemberIncome(memberId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quoteMemberIncome)
      .where(
        and(
          eq(quoteMemberIncome.memberId, memberId),
          eq(quoteMemberIncome.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== QUOTE MEMBER IMMIGRATION ====================
  
  async getQuoteMemberImmigration(memberId: string, companyId: string): Promise<QuoteMemberImmigration | null> {
    const [immigration] = await db
      .select()
      .from(quoteMemberImmigration)
      .where(
        and(
          eq(quoteMemberImmigration.memberId, memberId),
          eq(quoteMemberImmigration.companyId, companyId)
        )
      );
    return immigration || null;
  }
  
  async createOrUpdateQuoteMemberImmigration(data: InsertQuoteMemberImmigration): Promise<QuoteMemberImmigration> {
    // Filter out null/undefined values to prevent overwriting existing data with nulls
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null && value !== undefined)
    );
    
    const [result] = await db
      .insert(quoteMemberImmigration)
      .values(data)
      .onConflictDoUpdate({
        target: quoteMemberImmigration.memberId,
        set: {
          ...updateData,  // Only update non-null fields
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }
  
  async deleteQuoteMemberImmigration(memberId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quoteMemberImmigration)
      .where(
        and(
          eq(quoteMemberImmigration.memberId, memberId),
          eq(quoteMemberImmigration.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== QUOTE MEMBER DOCUMENTS ====================
  
  async getQuoteMemberDocuments(memberId: string, companyId: string): Promise<QuoteMemberDocument[]> {
    return db
      .select()
      .from(quoteMemberDocuments)
      .where(
        and(
          eq(quoteMemberDocuments.memberId, memberId),
          eq(quoteMemberDocuments.companyId, companyId)
        )
      )
      .orderBy(quoteMemberDocuments.uploadedAt);
  }
  
  async getQuoteMemberDocumentById(documentId: string, companyId: string): Promise<QuoteMemberDocument | null> {
    const [document] = await db
      .select()
      .from(quoteMemberDocuments)
      .where(
        and(
          eq(quoteMemberDocuments.id, documentId),
          eq(quoteMemberDocuments.companyId, companyId)
        )
      );
    return document || null;
  }
  
  async createQuoteMemberDocument(data: InsertQuoteMemberDocument): Promise<QuoteMemberDocument> {
    const [document] = await db
      .insert(quoteMemberDocuments)
      .values(data)
      .returning();
    return document;
  }
  
  async deleteQuoteMemberDocument(documentId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quoteMemberDocuments)
      .where(
        and(
          eq(quoteMemberDocuments.id, documentId),
          eq(quoteMemberDocuments.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== QUOTE PAYMENT METHODS ====================
  
  async getQuotePaymentMethods(quoteId: string, companyId: string): Promise<QuotePaymentMethod[]> {
    return db
      .select()
      .from(quotePaymentMethods)
      .where(
        and(
          eq(quotePaymentMethods.quoteId, quoteId),
          eq(quotePaymentMethods.companyId, companyId)
        )
      )
      .orderBy(desc(quotePaymentMethods.isDefault), quotePaymentMethods.createdAt);
  }
  
  async getQuotePaymentMethodById(paymentMethodId: string, companyId: string): Promise<QuotePaymentMethod | null> {
    const [paymentMethod] = await db
      .select()
      .from(quotePaymentMethods)
      .where(
        and(
          eq(quotePaymentMethods.id, paymentMethodId),
          eq(quotePaymentMethods.companyId, companyId)
        )
      );
    return paymentMethod || null;
  }
  
  async createQuotePaymentMethod(data: InsertPaymentMethod): Promise<QuotePaymentMethod> {
    const [paymentMethod] = await db
      .insert(quotePaymentMethods)
      .values(data)
      .returning();
    return paymentMethod;
  }
  
  async updateQuotePaymentMethod(paymentMethodId: string, data: UpdatePaymentMethod, companyId: string): Promise<QuotePaymentMethod | null> {
    const [updated] = await db
      .update(quotePaymentMethods)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(quotePaymentMethods.id, paymentMethodId),
          eq(quotePaymentMethods.companyId, companyId)
        )
      )
      .returning();
    return updated || null;
  }
  
  async deleteQuotePaymentMethod(paymentMethodId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quotePaymentMethods)
      .where(
        and(
          eq(quotePaymentMethods.id, paymentMethodId),
          eq(quotePaymentMethods.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  async setDefaultPaymentMethod(paymentMethodId: string, quoteId: string, companyId: string): Promise<void> {
    // First, unset all payment methods for this quote as non-default
    await db
      .update(quotePaymentMethods)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(quotePaymentMethods.quoteId, quoteId),
          eq(quotePaymentMethods.companyId, companyId)
        )
      );
    
    // Then set the specified payment method as default
    await db
      .update(quotePaymentMethods)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(quotePaymentMethods.id, paymentMethodId),
          eq(quotePaymentMethods.companyId, companyId)
        )
      );
  }
  
  // ==================== QUOTE DOCUMENTS ====================
  
  async listQuoteDocuments(quoteId: string, companyId: string, filters?: { category?: string, search?: string }): Promise<Array<Omit<QuoteDocument, 'uploadedBy'> & { uploadedBy: { firstName: string | null; lastName: string | null } | null; belongsToMember: { firstName: string; lastName: string; role: string } | null }>> {
    let query = db
      .select({
        document: quoteDocuments,
        uploaderFirstName: users.firstName,
        uploaderLastName: users.lastName,
        memberFirstName: quoteMembers.firstName,
        memberLastName: quoteMembers.lastName,
        memberRole: quoteMembers.role,
      })
      .from(quoteDocuments)
      .leftJoin(users, eq(quoteDocuments.uploadedBy, users.id))
      .leftJoin(quoteMembers, eq(quoteDocuments.belongsTo, quoteMembers.id))
      .where(
        and(
          eq(quoteDocuments.quoteId, quoteId),
          eq(quoteDocuments.companyId, companyId)
        )
      )
      .$dynamic();

    // Apply category filter if provided
    if (filters?.category) {
      query = query.where(
        and(
          eq(quoteDocuments.quoteId, quoteId),
          eq(quoteDocuments.companyId, companyId),
          eq(quoteDocuments.category, filters.category)
        )
      );
    }

    // Apply search filter if provided (case-insensitive search on fileName)
    if (filters?.search) {
      query = query.where(
        and(
          eq(quoteDocuments.quoteId, quoteId),
          eq(quoteDocuments.companyId, companyId),
          sql`${quoteDocuments.fileName} ILIKE ${`%${filters.search}%`}`
        )
      );
    }

    const results = await query.orderBy(desc(quoteDocuments.createdAt));

    return results.map(r => ({
      ...r.document,
      uploadedBy: r.uploaderFirstName || r.uploaderLastName
        ? { firstName: r.uploaderFirstName, lastName: r.uploaderLastName }
        : null,
      belongsToMember: r.memberFirstName && r.memberLastName && r.memberRole
        ? { firstName: r.memberFirstName, lastName: r.memberLastName, role: r.memberRole }
        : null
    }));
  }

  async createQuoteDocument(document: InsertQuoteDocument): Promise<QuoteDocument> {
    const [created] = await db
      .insert(quoteDocuments)
      .values(document)
      .returning();
    return created;
  }

  async getQuoteDocument(id: string, companyId: string): Promise<QuoteDocument | null> {
    const [document] = await db
      .select()
      .from(quoteDocuments)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.companyId, companyId)
        )
      );
    return document || null;
  }

  async deleteQuoteDocument(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quoteDocuments)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== UNIFIED QUOTE DETAIL ====================
  
  async getQuoteDetail(quoteId: string, companyId: string): Promise<{
    quote: Quote & {
      agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
      creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
    };
    members: Array<{
      member: QuoteMember;
      income?: QuoteMemberIncome;
      immigration?: QuoteMemberImmigration;
      documents: QuoteMemberDocument[];
    }>;
    paymentMethods: QuotePaymentMethod[];
    totalHouseholdIncome: number;
  }> {
    // 1. Get the quote with creator and agent details
    const quote = await this.getQuote(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }
    
    // Verify the quote belongs to the company
    if (quote.companyId !== companyId) {
      throw new Error('Quote not found');
    }
    
    // 2. Get all members
    const members = await this.getQuoteMembersByQuoteId(quoteId, companyId);
    
    // 3. Get income, immigration, and documents for each member in parallel
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const [income, immigration, documents] = await Promise.all([
          this.getQuoteMemberIncome(member.id, companyId),
          this.getQuoteMemberImmigration(member.id, companyId),
          this.getQuoteMemberDocuments(member.id, companyId)
        ]);
        
        return {
          member,
          income: income || undefined,
          immigration: immigration || undefined,
          documents
        };
      })
    );
    
    // 4. Get payment methods
    const paymentMethods = await this.getQuotePaymentMethods(quoteId, companyId);
    
    // 5. Calculate total household income
    let totalHouseholdIncome = 0;
    for (const memberDetail of membersWithDetails) {
      if (memberDetail.income) {
        const income = memberDetail.income;
        
        // Use totalAnnualIncome if available (already calculated), otherwise calculate from annualIncome
        if (income.totalAnnualIncome) {
          totalHouseholdIncome += Number(income.totalAnnualIncome) || 0;
        } else if (income.annualIncome) {
          // Calculate annual income based on frequency
          let annualAmount = 0;
          const amount = Number(income.annualIncome) || 0;
          
          switch (income.incomeFrequency) {
            case 'weekly':
              annualAmount = amount * 52;
              break;
            case 'bi-weekly':
            case 'biweekly':
              annualAmount = amount * 26;
              break;
            case 'semi-monthly':
              annualAmount = amount * 24;
              break;
            case 'monthly':
              annualAmount = amount * 12;
              break;
            case 'quarterly':
              annualAmount = amount * 4;
              break;
            case 'semi-annually':
              annualAmount = amount * 2;
              break;
            case 'annually':
            default:
              annualAmount = amount;
              break;
          }
          
          totalHouseholdIncome += annualAmount;
        }
      }
    }
    
    return {
      quote,
      members: membersWithDetails,
      paymentMethods,
      totalHouseholdIncome
    };
  }
  
  // ==================== QUOTE REMINDERS ====================
  
  async listQuoteReminders(quoteId: string, companyId: string, filters?: { status?: string; priority?: string; userId?: string }): Promise<Array<QuoteReminder & { creator: { firstName: string | null; lastName: string | null } }>> {
    let conditions = [
      eq(quoteReminders.quoteId, quoteId),
      eq(quoteReminders.companyId, companyId)
    ];
    
    // Apply filters
    if (filters?.status) {
      conditions.push(eq(quoteReminders.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(quoteReminders.priority, filters.priority));
    }
    if (filters?.userId) {
      // Show reminders created by this user OR where this user is notified
      conditions.push(eq(quoteReminders.createdBy, filters.userId));
    }
    
    const results = await db
      .select({
        reminder: quoteReminders,
        creator: {
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(quoteReminders)
      .leftJoin(users, eq(quoteReminders.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(quoteReminders.dueDate), desc(quoteReminders.dueTime));
    
    return results.map(r => ({
      ...r.reminder,
      creator: r.creator
    }));
  }
  
  async getQuoteReminder(id: string, companyId: string): Promise<QuoteReminder | null> {
    const result = await db
      .select()
      .from(quoteReminders)
      .where(and(eq(quoteReminders.id, id), eq(quoteReminders.companyId, companyId)));
    
    return result[0] || null;
  }
  
  async createQuoteReminder(data: InsertQuoteReminder): Promise<QuoteReminder> {
    const result = await db
      .insert(quoteReminders)
      .values(data as any)
      .returning();
    
    return result[0];
  }
  
  async updateQuoteReminder(id: string, companyId: string, data: UpdateQuoteReminder): Promise<QuoteReminder | null> {
    const result = await db
      .update(quoteReminders)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(quoteReminders.id, id), eq(quoteReminders.companyId, companyId)))
      .returning();
    
    return result[0] || null;
  }
  
  async deleteQuoteReminder(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quoteReminders)
      .where(and(eq(quoteReminders.id, id), eq(quoteReminders.companyId, companyId)));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async completeQuoteReminder(id: string, companyId: string, userId: string): Promise<QuoteReminder | null> {
    const result = await db
      .update(quoteReminders)
      .set({ 
        status: 'completed', 
        completedAt: new Date(),
        completedBy: userId,
        updatedAt: new Date()
      })
      .where(and(eq(quoteReminders.id, id), eq(quoteReminders.companyId, companyId)))
      .returning();
    
    return result[0] || null;
  }
  
  async snoozeQuoteReminder(id: string, companyId: string, until: Date): Promise<QuoteReminder | null> {
    const result = await db
      .update(quoteReminders)
      .set({ 
        status: 'snoozed', 
        snoozedUntil: until,
        updatedAt: new Date()
      })
      .where(and(eq(quoteReminders.id, id), eq(quoteReminders.companyId, companyId)))
      .returning();
    
    return result[0] || null;
  }
  
  // ==================== CONSENT DOCUMENTS ====================
  
  async createConsentDocument(quoteId: string, companyId: string, userId: string): Promise<ConsentDocument> {
    const { generateShortId } = await import("./id-generator");
    
    // Generate unique short token (8 characters)
    let token: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      token = generateShortId();
      const existing = await db
        .select()
        .from(consentDocuments)
        .where(eq(consentDocuments.token, token))
        .limit(1);
      
      if (existing.length === 0) break;
      
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error("Failed to generate unique consent token after maximum attempts");
      }
    } while (true);
    
    // Set expiration to 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const result = await db
      .insert(consentDocuments)
      .values({
        quoteId,
        companyId,
        token,
        expiresAt,
        createdBy: userId,
        status: 'draft'
      })
      .returning();
    
    // Create 'generated' event
    await this.createConsentEvent(result[0].id, 'generated', { quoteId }, userId);
    
    return result[0];
  }
  
  async getConsentById(id: string, companyId: string): Promise<ConsentDocument | null> {
    const result = await db
      .select()
      .from(consentDocuments)
      .where(and(eq(consentDocuments.id, id), eq(consentDocuments.companyId, companyId)));
    
    return result[0] || null;
  }
  
  async getConsentByToken(token: string): Promise<ConsentDocument | null> {
    const result = await db
      .select()
      .from(consentDocuments)
      .where(eq(consentDocuments.token, token));
    
    return result[0] || null;
  }
  
  async listQuoteConsents(quoteId: string, companyId: string): Promise<ConsentDocument[]> {
    const result = await db
      .select()
      .from(consentDocuments)
      .where(and(
        eq(consentDocuments.quoteId, quoteId),
        eq(consentDocuments.companyId, companyId)
      ))
      .orderBy(desc(consentDocuments.createdAt));
    
    return result;
  }
  
  async updateConsentDocument(id: string, data: Partial<InsertConsentDocument>): Promise<ConsentDocument | null> {
    const result = await db
      .update(consentDocuments)
      .set(data)
      .where(eq(consentDocuments.id, id))
      .returning();
    
    return result[0] || null;
  }
  
  async deleteConsentDocument(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(consentDocuments)
      .where(and(
        eq(consentDocuments.id, id),
        eq(consentDocuments.companyId, companyId)
      ))
      .returning();
    
    return result.length > 0;
  }
  
  async signConsent(token: string, signatureData: {
    signedByName: string;
    signedByEmail?: string;
    signedByPhone?: string;
    signerIp?: string;
    signerUserAgent?: string;
    signerTimezone?: string;
    signerLocation?: string;
    signerPlatform?: string;
    signerBrowser?: string;
  }): Promise<ConsentDocument | null> {
    const consent = await this.getConsentByToken(token);
    if (!consent) {
      return null;
    }
    
    // Check if already signed
    if (consent.status === 'signed') {
      return consent;
    }
    
    // Check if expired
    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
      return null;
    }
    
    const result = await db
      .update(consentDocuments)
      .set({
        status: 'signed',
        signedAt: new Date(),
        signedByName: signatureData.signedByName,
        signedByEmail: signatureData.signedByEmail,
        signedByPhone: signatureData.signedByPhone,
        signerIp: signatureData.signerIp,
        signerUserAgent: signatureData.signerUserAgent,
        signerTimezone: signatureData.signerTimezone,
        signerLocation: signatureData.signerLocation,
        signerPlatform: signatureData.signerPlatform,
        signerBrowser: signatureData.signerBrowser,
      })
      .where(eq(consentDocuments.token, token))
      .returning();
    
    // Create 'signed' event
    await this.createConsentEvent(consent.id, 'signed', signatureData);
    
    return result[0] || null;
  }
  
  // ==================== CONSENT SIGNATURE EVENTS ====================
  
  async createConsentEvent(
    consentDocumentId: string,
    eventType: string,
    payload?: Record<string, any>,
    actorId?: string
  ): Promise<ConsentSignatureEvent> {
    const result = await db
      .insert(consentSignatureEvents)
      .values({
        consentDocumentId,
        eventType,
        payload: payload || {},
        actorId,
      })
      .returning();
    
    return result[0];
  }
  
  async getConsentEvents(consentDocumentId: string): Promise<ConsentSignatureEvent[]> {
    const result = await db
      .select()
      .from(consentSignatureEvents)
      .where(eq(consentSignatureEvents.consentDocumentId, consentDocumentId))
      .orderBy(desc(consentSignatureEvents.occurredAt));
    
    return result;
  }
}

export const storage = new DbStorage();
