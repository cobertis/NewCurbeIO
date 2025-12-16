import { 
  type User, 
  type InsertUser, 
  type Company, 
  type InsertCompany,
  type CompanySettings,
  type InsertCompanySettings,
  type Plan,
  type InsertPlan,
  type PlanFeature,
  type InsertPlanFeature,
  type PlanFeatureAssignment,
  type InsertPlanFeatureAssignment,
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
  type UserPaymentMethod,
  type InsertUserPaymentMethod,
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
  type QuoteFolder,
  type InsertQuoteFolder,
  type QuoteFolderAssignment,
  type InsertQuoteFolderAssignment,
  type ConsentDocument,
  type InsertConsentDocument,
  type ConsentSignatureEvent,
  type InsertConsentEvent,
  type Policy,
  type InsertPolicy,
  type PolicyMember,
  type InsertPolicyMember,
  type UpdatePolicyMember,
  type PolicyMemberIncome,
  type InsertPolicyMemberIncome,
  type UpdatePolicyMemberIncome,
  type PolicyMemberImmigration,
  type InsertPolicyMemberImmigration,
  type UpdatePolicyMemberImmigration,
  type PolicyMemberDocument,
  type InsertPolicyMemberDocument,
  type PolicyDocument,
  type InsertPolicyDocument,
  type PolicyPaymentMethod,
  type InsertPolicyPaymentMethod,
  type UpdatePolicyPaymentMethod,
  type PolicyReminder,
  type InsertPolicyReminder,
  type UpdatePolicyReminder,
  type PolicyNote,
  type InsertPolicyNote,
  type PolicyConsentDocument,
  type InsertPolicyConsentDocument,
  type PolicyConsentSignatureEvent,
  type InsertPolicyConsentEvent,
  type PolicyPlan,
  type InsertPolicyPlan,
  type PolicyFolder,
  type InsertPolicyFolder,
  type LandingPage,
  type InsertLandingPage,
  type LandingBlock,
  type InsertLandingBlock,
  type LandingAnalytics,
  type InsertLandingAnalytics,
  type LandingLead,
  type InsertLandingLead,
  type LandingAppointment,
  type InsertLandingAppointment,
  type AppointmentAvailability,
  type InsertAppointmentAvailability,
  type ManualBirthday,
  type InsertManualBirthday,
  type StandaloneReminder,
  type InsertStandaloneReminder,
  type Appointment,
  type InsertAppointment,
  type BirthdayImage,
  type InsertBirthdayImage,
  type UserBirthdaySettings,
  type InsertUserBirthdaySettings,
  type BirthdayGreetingHistory,
  type InsertBirthdayGreetingHistory,
  type BirthdayPendingMessage,
  type InsertBirthdayPendingMessage,
  type BulkvsPhoneNumber,
  type InsertBulkvsPhoneNumber,
  type BulkvsThread,
  type InsertBulkvsThread,
  type BulkvsMessage,
  type InsertBulkvsMessage,
  type ManualContact,
  type InsertManualContact,
  type Contact,
  type InsertContact,
  type ContactSource,
  type InsertContactSource,
  type BlacklistEntry,
  type InsertBlacklistEntry,
  type ContactEngagement,
  type InsertContactEngagement,
  type UnifiedContact,
  type Task,
  type InsertTask,
  type UpdateTask,
  type ImessageConversation,
  type InsertImessageConversation,
  type ImessageMessage,
  type InsertImessageMessage,
  type ImessageCampaign,
  type InsertImessageCampaign,
  type ImessageCampaignRun,
  type InsertImessageCampaignRun,
  type ImessageCampaignMessage,
  type InsertImessageCampaignMessage,
  type CampaignTemplateCategory,
  type InsertCampaignTemplateCategory,
  type CampaignTemplate,
  type InsertCampaignTemplate,
  type CampaignPlaceholder,
  type InsertCampaignPlaceholder,
  type CreateCampaignWithDetails,
  type CampaignVariant,
  type InsertCampaignVariant,
  type CampaignSchedule,
  type InsertCampaignSchedule,
  type CampaignFollowup,
  type InsertCampaignFollowup
} from "@shared/schema";
import { db } from "./db";
import { 
  users, 
  companies, 
  companySettings,
  plans,
  planFeatures,
  planFeatureAssignments,
  subscriptions,
  invoices,
  invoiceItems,
  payments,
  billingAddresses,
  userPaymentMethods,
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
  quoteFolders,
  quoteFolderAssignments,
  consentDocuments,
  consentSignatureEvents,
  policies,
  policyPlans,
  policyMembers,
  policyMemberIncome,
  policyMemberImmigration,
  policyMemberDocuments,
  policyDocuments,
  policyPaymentMethods,
  policyReminders,
  policyNotes,
  policyConsentDocuments,
  policyConsentSignatureEvents,
  policyFolders,
  policyFolderAssignments,
  landingPages,
  landingBlocks,
  landingAnalytics,
  landingLeads,
  landingAppointments,
  appointmentAvailability,
  manualBirthdays,
  standaloneReminders,
  appointments,
  birthdayImages,
  userBirthdaySettings,
  birthdayGreetingHistory,
  birthdayPendingMessages,
  bulkvsPhoneNumbers,
  bulkvsThreads,
  bulkvsMessages,
  manualContacts,
  contacts,
  contactSources,
  blacklistEntries,
  contactEngagements,
  tasks,
  imessageConversations,
  imessageMessages,
  imessageCampaigns,
  imessageCampaignRuns,
  imessageCampaignMessages,
  campaignTemplateCategories,
  campaignTemplates,
  campaignPlaceholders,
  campaignVariants,
  campaignSchedules,
  campaignFollowups
} from "@shared/schema";
import { eq, and, or, desc, sql, inArray, like, gte, lt, not, isNull, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { formatForStorage } from "@shared/phone";

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
  
  // Plan Features (for public display on pricing page)
  getAllPlanFeatures(): Promise<PlanFeature[]>;
  getPlanFeature(id: string): Promise<PlanFeature | undefined>;
  createPlanFeature(data: InsertPlanFeature): Promise<PlanFeature>;
  updatePlanFeature(id: string, data: Partial<InsertPlanFeature>): Promise<PlanFeature | undefined>;
  deletePlanFeature(id: string): Promise<boolean>;
  
  // Plan Feature Assignments (linking features to plans)
  getPlanFeatureAssignments(planId: string): Promise<PlanFeatureAssignment[]>;
  setPlanFeatureAssignments(planId: string, assignments: InsertPlanFeatureAssignment[]): Promise<PlanFeatureAssignment[]>;
  updatePlanFeatureAssignment(planId: string, featureId: string, included: boolean): Promise<PlanFeatureAssignment | undefined>;
  deletePlanFeatureAssignment(planId: string, featureId: string): Promise<boolean>;
  
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
  getInvoicesByCompany(companyId: string, userId?: string): Promise<Invoice[]>;
  getInvoiceByStripeId(stripeInvoiceId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  
  // Invoice Items
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByCompany(companyId: string, userId?: string): Promise<Payment[]>;
  getPaymentsByInvoice(invoiceId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  // Billing Addresses (User-scoped)
  getBillingAddress(companyId: string, userId?: string): Promise<BillingAddress | undefined>;
  createBillingAddress(address: InsertBillingAddress): Promise<BillingAddress>;
  updateBillingAddress(companyId: string, data: Partial<InsertBillingAddress>, userId?: string): Promise<BillingAddress | undefined>;
  
  // User Payment Methods (User-scoped)
  getUserPaymentMethods(companyId: string, userId: string): Promise<UserPaymentMethod[]>;
  getUserPaymentMethod(id: string): Promise<UserPaymentMethod | undefined>;
  createUserPaymentMethod(paymentMethod: InsertUserPaymentMethod): Promise<UserPaymentMethod>;
  updateUserPaymentMethod(id: string, data: Partial<InsertUserPaymentMethod>): Promise<UserPaymentMethod | undefined>;
  deleteUserPaymentMethod(id: string): Promise<boolean>;
  setDefaultUserPaymentMethod(userId: string, paymentMethodId: string): Promise<void>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogsByCompany(companyId: string, limit?: number): Promise<ActivityLog[]>;
  getAllActivityLogs(limit?: number): Promise<ActivityLog[]>;
  
  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationsByCompany(companyId: string): Promise<Invitation[]>;
  acceptInvitation(token: string): Promise<boolean>;
  deleteInvitation(token: string): Promise<boolean>;
  
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
  getListMembers(listId: string): Promise<ManualContact[]>;
  addMemberToList(listId: string, contactId: string): Promise<ContactListMember>;
  removeMemberFromList(listId: string, contactId: string): Promise<boolean>;
  getListsForContact(contactId: string): Promise<ContactList[]>;
  
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
  getQuotesList(companyId: string, options?: {
    limit?: number;
    cursor?: string;
    agentId?: string;
    productType?: string;
    status?: string;
    effectiveDateFrom?: string;
    effectiveDateTo?: string;
    skipAgentFilter?: boolean;
    searchTerm?: string;
    includeFamilyMembers?: boolean;
    folderId?: string | null;
  }): Promise<{
    items: Array<{
      id: string;
      companyId: string;
      effectiveDate: string;
      productType: string;
      status: string;
      clientFirstName: string;
      clientMiddleName: string | null;
      clientLastName: string;
      clientSecondLastName: string | null;
      clientEmail: string;
      clientPhone: string;
      agentId: string | null;
      agentName: string | null;
      isArchived: boolean | null;
      createdAt: Date;
    }>;
    nextCursor: string | null;
  }>;
  updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  getQuotesByApplicant(companyId: string, ssn?: string | null, email?: string | null, firstName?: string | null, lastName?: string | null, dob?: string | null, effectiveYear?: number): Promise<Array<Quote & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>>;
  
  // Quote Plans (Multi-plan support)
  listQuotePlans(quoteId: string, companyId: string): Promise<QuotePlan[]>;
  addQuotePlan(data: InsertQuotePlan): Promise<QuotePlan>;
  updateQuotePlan(planId: string, companyId: string, data: Partial<InsertQuotePlan>): Promise<QuotePlan | null>;
  removeQuotePlan(planId: string, companyId: string): Promise<boolean>;
  setPrimaryQuotePlan(planId: string, quoteId: string, companyId: string): Promise<void>;
  
  // Quote Members
  listQuoteMembers(quoteId: string): Promise<QuoteMember[]>;
  listAllQuoteMembers(companyId: string): Promise<QuoteMember[]>;
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
      agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
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
  
  // Quote Folders
  listQuoteFolders(companyId: string, userId: string): Promise<{ agency: QuoteFolder[]; personal: QuoteFolder[] }>;
  getQuoteFolder(id: string): Promise<QuoteFolder | undefined>;
  createQuoteFolder(data: InsertQuoteFolder): Promise<QuoteFolder>;
  updateQuoteFolder(id: string, companyId: string, data: Partial<InsertQuoteFolder>): Promise<QuoteFolder | null>;
  deleteQuoteFolder(id: string, companyId: string): Promise<boolean>;
  assignQuotesToFolder(quoteIds: string[], folderId: string | null, userId: string, companyId: string): Promise<number>;
  
  // Consent Documents
  createConsentDocument(quoteId: string, companyId: string, userId: string): Promise<ConsentDocument>;
  getConsentById(id: string, companyId: string): Promise<ConsentDocument | null>;
  getConsentByToken(token: string): Promise<ConsentDocument | null>;
  listQuoteConsents(quoteId: string, companyId: string): Promise<ConsentDocument[]>;
  updateConsentDocument(id: string, data: Partial<InsertConsentDocument>): Promise<ConsentDocument | null>;
  deleteConsentDocument(id: string, companyId: string): Promise<boolean>;
  signConsent(token: string, signatureData: {
    signatureImage: string;
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
  
  // Policies
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  getPolicy(id: string): Promise<(Policy & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }) | undefined>;
  getPoliciesByCompany(companyId: string, filters?: { agentId?: string; oepFilter?: "aca" | "medicare" }): Promise<Array<Policy & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>>;
  getPoliciesList(companyId: string, options?: {
    limit?: number;
    cursor?: string;
    agentId?: string;
    productType?: string;
    status?: string;
    effectiveDateFrom?: string;
    effectiveDateTo?: string;
    skipAgentFilter?: boolean;
  }): Promise<{
    items: Array<{
      id: string;
      companyId: string;
      effectiveDate: string;
      productType: string;
      status: string;
      documentsStatus: string | null;
      paymentStatus: string | null;
      clientFirstName: string;
      clientMiddleName: string | null;
      clientLastName: string;
      clientSecondLastName: string | null;
      clientEmail: string;
      clientPhone: string;
      clientDateOfBirth: string | null;
      clientGender: string | null;
      clientSsn: string | null;
      clientIsApplicant: boolean | null;
      physical_city: string | null;
      physical_state: string | null;
      physical_postal_code: string | null;
      selectedPlan: any;
      agentId: string | null;
      agentName: string | null;
      createdAt: Date;
    }>;
    nextCursor: string | null;
  }>;
  getPoliciesByAgent(agentId: string): Promise<Array<Policy & {
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>>;
  getPoliciesByApplicant(companyId: string, ssn?: string | null, email?: string | null, firstName?: string | null, lastName?: string | null, dob?: string | null, effectiveYear?: number): Promise<Array<Policy & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>>;
  updatePolicy(id: string, data: Partial<InsertPolicy>): Promise<Policy | undefined>;
  updatePolicySelectedPlan(id: string, selectedPlan: any, aptcData?: { aptcAmount?: string; aptcSource?: string; aptcCapturedAt?: string }): Promise<Policy | undefined>;
  deletePolicy(id: string): Promise<boolean>;
  getUniquePolicyHolders(companyId: string, filters?: { agentId?: string; effectiveYear?: number; carrier?: string; status?: string; state?: string }): Promise<{ count: number; uniqueIdentifiers: Map<string, { policyIds: string[]; identifier: string; identifierType: 'ssn' | 'email' | 'name-dob' }> }>;
  submitQuoteAsPolicy(quoteId: string): Promise<Policy>;
  
  // Policy Members
  getPolicyMembersByPolicyId(policyId: string, companyId: string): Promise<PolicyMember[]>;
  getPolicyMemberById(memberId: string, companyId: string): Promise<PolicyMember | null>;
  createPolicyMember(data: InsertPolicyMember): Promise<PolicyMember>;
  updatePolicyMember(memberId: string, data: UpdatePolicyMember, companyId: string): Promise<PolicyMember | null>;
  deletePolicyMember(memberId: string, companyId: string): Promise<boolean>;
  ensurePolicyMember(policyId: string, companyId: string, role: string, memberData: Partial<InsertPolicyMember>): Promise<{ member: PolicyMember; wasCreated: boolean }>;
  
  // Policy Member Income
  getPolicyMemberIncome(memberId: string, companyId: string): Promise<PolicyMemberIncome | null>;
  createOrUpdatePolicyMemberIncome(data: InsertPolicyMemberIncome): Promise<PolicyMemberIncome>;
  deletePolicyMemberIncome(memberId: string, companyId: string): Promise<boolean>;
  
  // Policy Member Immigration
  getPolicyMemberImmigration(memberId: string, companyId: string): Promise<PolicyMemberImmigration | null>;
  createOrUpdatePolicyMemberImmigration(data: InsertPolicyMemberImmigration): Promise<PolicyMemberImmigration>;
  deletePolicyMemberImmigration(memberId: string, companyId: string): Promise<boolean>;
  
  // Policy Member Documents
  getPolicyMemberDocuments(memberId: string, companyId: string): Promise<PolicyMemberDocument[]>;
  getPolicyMemberDocumentById(documentId: string, companyId: string): Promise<PolicyMemberDocument | null>;
  createPolicyMemberDocument(data: InsertPolicyMemberDocument): Promise<PolicyMemberDocument>;
  deletePolicyMemberDocument(documentId: string, companyId: string): Promise<boolean>;
  
  // Policy Client Identity Helper
  getCanonicalPolicyIds(policyId: string, limit?: number): Promise<string[]>;
  
  // Policy Payment Methods
  getPolicyPaymentMethods(policyIds: string | string[], companyId: string): Promise<PolicyPaymentMethod[]>;
  getPolicyPaymentMethodById(paymentMethodId: string, companyId: string): Promise<PolicyPaymentMethod | null>;
  createPolicyPaymentMethod(data: InsertPolicyPaymentMethod): Promise<PolicyPaymentMethod>;
  updatePolicyPaymentMethod(paymentMethodId: string, data: UpdatePolicyPaymentMethod, companyId: string): Promise<PolicyPaymentMethod | null>;
  deletePolicyPaymentMethod(paymentMethodId: string, companyId: string): Promise<boolean>;
  setDefaultPolicyPaymentMethod(paymentMethodId: string, policyId: string, companyId: string): Promise<void>;
  
  // Policy Documents
  listPolicyDocuments(policyIds: string | string[], companyId: string, filters?: { category?: string, search?: string }): Promise<Array<Omit<PolicyDocument, 'uploadedBy'> & { uploadedBy: { firstName: string | null; lastName: string | null } | null; belongsToMember: { firstName: string; lastName: string; role: string } | null }>>;
  createPolicyDocument(document: InsertPolicyDocument): Promise<PolicyDocument>;
  getPolicyDocument(id: string, companyId: string): Promise<PolicyDocument | null>;
  deletePolicyDocument(id: string, companyId: string): Promise<boolean>;
  
  // Unified Policy Detail - Gets all related data in one call
  getPolicyDetail(policyId: string, companyId: string): Promise<{
    policy: Policy & {
      agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
      creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
    };
    members: Array<{
      member: PolicyMember;
      income?: PolicyMemberIncome;
      immigration?: PolicyMemberImmigration;
      documents: PolicyMemberDocument[];
    }>;
    paymentMethods: PolicyPaymentMethod[];
    totalHouseholdIncome: number;
  }>;
  
  // Policy Reminders
  listPolicyReminders(policyIds: string | string[], companyId: string, filters?: { status?: string; priority?: string; userId?: string }): Promise<Array<PolicyReminder & { creator: { firstName: string | null; lastName: string | null } }>>;
  getPolicyReminder(id: string, companyId: string): Promise<PolicyReminder | null>;
  getPolicyRemindersByCompany(companyId: string): Promise<PolicyReminder[]>;
  createPolicyReminder(data: InsertPolicyReminder): Promise<PolicyReminder>;
  updatePolicyReminder(id: string, companyId: string, data: UpdatePolicyReminder): Promise<PolicyReminder | null>;
  deletePolicyReminder(id: string, companyId: string): Promise<boolean>;
  completePolicyReminder(id: string, companyId: string, userId: string): Promise<PolicyReminder | null>;
  snoozePolicyReminder(id: string, companyId: string, until: Date): Promise<PolicyReminder | null>;
  
  // Policy Notes
  createPolicyNote(note: InsertPolicyNote): Promise<PolicyNote>;
  getPolicyNotes(policyIds: string | string[], companyId: string): Promise<PolicyNote[]>;
  deletePolicyNote(id: string, companyId?: string): Promise<void>;
  
  // Policy Consent Documents
  createPolicyConsentDocument(policyId: string, companyId: string, userId: string): Promise<PolicyConsentDocument>;
  getPolicyConsentById(id: string, companyId: string): Promise<PolicyConsentDocument | null>;
  getPolicyConsentByToken(token: string): Promise<PolicyConsentDocument | null>;
  listPolicyConsents(policyIds: string | string[], companyId: string): Promise<PolicyConsentDocument[]>;
  updatePolicyConsentDocument(id: string, data: Partial<InsertPolicyConsentDocument>): Promise<PolicyConsentDocument | null>;
  deletePolicyConsentDocument(id: string, companyId: string): Promise<boolean>;
  signPolicyConsent(token: string, signatureData: {
    signatureImage: string;
    signerIp?: string;
    signerUserAgent?: string;
    signerTimezone?: string;
    signerLocation?: string;
    signerPlatform?: string;
    signerBrowser?: string;
  }): Promise<PolicyConsentDocument | null>;
  
  // Policy Consent Signature Events
  createPolicyConsentEvent(consentDocumentId: string, eventType: string, payload?: Record<string, any>, actorId?: string): Promise<PolicyConsentSignatureEvent>;
  getPolicyConsentEvents(consentDocumentId: string): Promise<PolicyConsentSignatureEvent[]>;
  
  // Policy Plans (Multi-plan support)
  listPolicyPlans(policyId: string, companyId: string): Promise<PolicyPlan[]>;
  addPolicyPlan(data: InsertPolicyPlan): Promise<PolicyPlan>;
  updatePolicyPlan(planId: string, companyId: string, data: Partial<InsertPolicyPlan>): Promise<PolicyPlan | null>;
  removePolicyPlan(planId: string, companyId: string): Promise<boolean>;
  setPrimaryPolicyPlan(planId: string, policyId: string, companyId: string): Promise<void>;
  
  // Policy Folders
  listPolicyFolders(companyId: string, userId: string): Promise<{ agency: PolicyFolder[]; personal: PolicyFolder[] }>;
  getPolicyFolder(id: string): Promise<PolicyFolder | undefined>;
  createPolicyFolder(data: InsertPolicyFolder): Promise<PolicyFolder>;
  updatePolicyFolder(id: string, companyId: string, data: Partial<InsertPolicyFolder>): Promise<PolicyFolder | null>;
  deletePolicyFolder(id: string, companyId: string): Promise<boolean>;
  assignPoliciesToFolder(policyIds: string[], folderId: string | null, userId: string, companyId: string): Promise<number>;
  
  // Landing Pages
  getLandingPagesByUser(userId: string, companyId: string): Promise<LandingPage[]>;
  checkSlugAvailability(slug: string, userId?: string): Promise<boolean>;
  getLandingPageBySlug(slug: string): Promise<LandingPage | undefined>;
  getLandingPageById(id: string): Promise<LandingPage | undefined>;
  createLandingPage(data: InsertLandingPage): Promise<LandingPage>;
  updateLandingPage(id: string, data: Partial<InsertLandingPage>): Promise<LandingPage | undefined>;
  deleteLandingPage(id: string): Promise<boolean>;
  incrementLandingPageView(id: string): Promise<void>;
  
  // Landing Blocks
  getBlocksByLandingPage(landingPageId: string): Promise<LandingBlock[]>;
  getLandingBlockById(id: string): Promise<LandingBlock | undefined>;
  createLandingBlock(data: InsertLandingBlock): Promise<LandingBlock>;
  updateLandingBlock(id: string, data: Partial<InsertLandingBlock>): Promise<LandingBlock | undefined>;
  deleteLandingBlock(id: string): Promise<boolean>;
  updateBlockPosition(id: string, position: number): Promise<LandingBlock | undefined>;
  incrementBlockClick(id: string): Promise<void>;
  reorderBlocks(landingPageId: string, blockIds: string[]): Promise<void>;
  syncLandingBlocks(landingPageId: string, blocks: Array<Omit<LandingBlock, 'createdAt' | 'updatedAt'>>): Promise<LandingBlock[]>;
  
  // Landing Analytics
  createLandingAnalytics(data: InsertLandingAnalytics): Promise<LandingAnalytics>;
  getLandingAnalytics(landingPageId: string, options?: { eventType?: string; limit?: number }): Promise<LandingAnalytics[]>;
  
  // Landing Leads
  createLandingLead(data: InsertLandingLead): Promise<LandingLead>;
  getLandingLeads(landingPageId: string, options?: { limit?: number; offset?: number }): Promise<LandingLead[]>;
  getLandingLeadsByUser(userId: string, options?: { limit?: number; offset?: number; search?: string }): Promise<LandingLead[]>;
  getLandingLeadsByCompany(companyId: string, options?: { limit?: number; offset?: number; search?: string }): Promise<LandingLead[]>;
  
  // Landing Appointments
  createLandingAppointment(data: InsertLandingAppointment): Promise<LandingAppointment>;
  getLandingAppointments(landingPageId: string, options?: { limit?: number; offset?: number; status?: string }): Promise<LandingAppointment[]>;
  updateAppointmentStatus(id: string, status: string): Promise<LandingAppointment | undefined>;
  getAvailableSlots(blockId: string, date: string): Promise<string[]>;
  getAppointmentById(id: string): Promise<LandingAppointment | undefined>;
  getLandingAppointmentById(id: string): Promise<LandingAppointment | undefined>;
  getLandingAppointmentsByUser(userId: string, options?: { limit?: number; offset?: number; status?: string }): Promise<LandingAppointment[]>;
  getLandingAppointmentsByCompany(companyId: string, options?: { limit?: number; offset?: number; status?: string; search?: string }): Promise<LandingAppointment[]>;
  updateLandingAppointment(id: string, data: Partial<InsertLandingAppointment>): Promise<LandingAppointment | undefined>;
  deleteLandingAppointment(id: string): Promise<boolean>;
  
  // Appointment Availability Configuration
  getAppointmentAvailability(userId: string): Promise<AppointmentAvailability | undefined>;
  createAppointmentAvailability(data: InsertAppointmentAvailability): Promise<AppointmentAvailability>;
  updateAppointmentAvailability(userId: string, data: Partial<InsertAppointmentAvailability>): Promise<AppointmentAvailability | undefined>;
  
  // Manual Calendar Events
  createManualBirthday(data: InsertManualBirthday): Promise<ManualBirthday>;
  getManualBirthdaysByCompany(companyId: string): Promise<ManualBirthday[]>;
  deleteManualBirthday(id: string, companyId: string): Promise<boolean>;
  
  createStandaloneReminder(data: InsertStandaloneReminder): Promise<StandaloneReminder>;
  getStandaloneRemindersByCompany(companyId: string): Promise<StandaloneReminder[]>;
  deleteStandaloneReminder(id: string, companyId: string): Promise<boolean>;
  
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  getAppointmentsByCompany(companyId: string): Promise<Appointment[]>;
  deleteAppointment(id: string, companyId: string): Promise<boolean>;
  
  // Birthday Automation - Images
  getAllBirthdayImages(): Promise<BirthdayImage[]>;
  getActiveBirthdayImages(): Promise<BirthdayImage[]>;
  getBirthdayImage(id: string): Promise<BirthdayImage | undefined>;
  createBirthdayImage(data: InsertBirthdayImage, uploadedBy: string): Promise<BirthdayImage>;
  updateBirthdayImage(id: string, data: Partial<InsertBirthdayImage>): Promise<BirthdayImage | undefined>;
  deleteBirthdayImage(id: string): Promise<boolean>;
  
  // Birthday Automation - User Settings
  getUserBirthdaySettings(userId: string): Promise<UserBirthdaySettings | undefined>;
  createUserBirthdaySettings(data: InsertUserBirthdaySettings & { userId: string }): Promise<UserBirthdaySettings>;
  updateUserBirthdaySettings(userId: string, data: Partial<InsertUserBirthdaySettings>): Promise<UserBirthdaySettings | undefined>;
  
  // Birthday Automation - Greeting History
  createBirthdayGreetingHistory(data: InsertBirthdayGreetingHistory & { userId: string; companyId: string }): Promise<BirthdayGreetingHistory>;
  getBirthdayGreetingHistory(companyId: string, userId?: string): Promise<BirthdayGreetingHistory[]>;
  updateBirthdayGreetingStatus(id: string, status: string, errorMessage?: string): Promise<void>;
  updateBirthdayGreetingImageSid(id: string, twilioImageSid: string): Promise<void>;
  checkIfBirthdayGreetingSentToday(recipientPhone: string, recipientDateOfBirth: string): Promise<boolean>;
  
  // Birthday Automation - Pending Messages
  createBirthdayPendingMessage(data: InsertBirthdayPendingMessage): Promise<BirthdayPendingMessage>;
  getBirthdayPendingMessageByMmsSid(mmsSid: string): Promise<BirthdayPendingMessage | undefined>;
  updateBirthdayPendingMessageMmsSid(id: string, mmsSid: string): Promise<void>;
  updateBirthdayPendingMessageStatus(id: string, status: string): Promise<void>;
  deleteBirthdayPendingMessage(id: string): Promise<void>;
  
  // BulkVS Phone Numbers
  getBulkvsPhoneNumber(id: string): Promise<BulkvsPhoneNumber | undefined>;
  getBulkvsPhoneNumberByDid(did: string): Promise<BulkvsPhoneNumber | undefined>;
  getBulkvsPhoneNumbersByUser(userId: string): Promise<BulkvsPhoneNumber[]>;
  getBulkvsPhoneNumbersByCompany(companyId: string): Promise<BulkvsPhoneNumber[]>;
  createBulkvsPhoneNumber(data: InsertBulkvsPhoneNumber): Promise<BulkvsPhoneNumber>;
  updateBulkvsPhoneNumber(id: string, data: Partial<InsertBulkvsPhoneNumber>): Promise<BulkvsPhoneNumber | undefined>;
  
  // BulkVS Threads
  getBulkvsThread(id: string): Promise<BulkvsThread | undefined>;
  getBulkvsThreadsByUser(userId: string, options?: { archived?: boolean; search?: string }): Promise<BulkvsThread[]>;
  getBulkvsThreadByPhoneAndExternal(phoneNumberId: string, externalPhone: string): Promise<BulkvsThread | undefined>;
  createBulkvsThread(data: InsertBulkvsThread): Promise<BulkvsThread>;
  updateBulkvsThread(id: string, data: Partial<InsertBulkvsThread>): Promise<BulkvsThread | undefined>;
  deleteBulkvsThread(id: string, userId: string): Promise<boolean>;
  incrementThreadUnread(threadId: string): Promise<void>;
  markThreadAsRead(threadId: string): Promise<void>;
  
  // BulkVS Messages
  getBulkvsMessage(id: string): Promise<BulkvsMessage | undefined>;
  getBulkvsMessagesByThread(threadId: string, options?: { limit?: number; offset?: number }): Promise<BulkvsMessage[]>;
  createBulkvsMessage(data: InsertBulkvsMessage): Promise<BulkvsMessage>;
  updateBulkvsMessageStatus(id: string, status: string, deliveredAt?: Date, readAt?: Date): Promise<void>;
  searchBulkvsMessages(userId: string, query: string): Promise<BulkvsMessage[]>;
  
  // iMessage Conversations
  getImessageConversation(id: string): Promise<ImessageConversation | undefined>;
  getImessageConversationsByCompany(companyId: string, options?: { archived?: boolean; search?: string }): Promise<ImessageConversation[]>;
  getImessageConversationByHandle(companyId: string, handle: string): Promise<ImessageConversation | undefined>;
  getImessageConversationByChatGuid(companyId: string, chatGuid: string): Promise<ImessageConversation | undefined>;
  findImessageConversationByChatGuid(companyId: string, chatGuid: string): Promise<ImessageConversation | undefined>;
  createImessageConversation(data: InsertImessageConversation): Promise<ImessageConversation>;
  updateImessageConversation(id: string, data: Partial<InsertImessageConversation>): Promise<ImessageConversation | undefined>;
  deleteImessageConversation(id: string): Promise<boolean>;
  incrementConversationUnread(conversationId: string): Promise<void>;
  markConversationAsRead(conversationId: string): Promise<void>;
  
  // iMessage Messages
  getImessageMessage(id: string): Promise<ImessageMessage | undefined>;
  getImessageMessagesByConversation(conversationId: string, options?: { limit?: number; offset?: number }): Promise<ImessageMessage[]>;
  createImessageMessage(data: InsertImessageMessage): Promise<ImessageMessage>;
  updateImessageMessageStatus(id: string, status: string, deliveredAt?: Date, readAt?: Date): Promise<void>;
  updateImessageMessageReadStatus(messageGuid: string, readAt: Date): Promise<void>;
  getImessageUnreadCount(conversationId: string): Promise<number>;
  recalculateImessageUnreadCount(conversationId: string): Promise<number>;
  searchImessageMessages(companyId: string, query: string): Promise<ImessageMessage[]>;
  addMessageReaction(messageId: string, userId: string, reaction: string): Promise<void>;
  removeMessageReaction(messageId: string, userId: string, reaction: string): Promise<void>;
  
  // Manual Contacts
  createManualContact(data: InsertManualContact): Promise<ManualContact>;
  getManualContacts(companyId: string): Promise<ManualContact[]>;
  getManualContact(id: string): Promise<ManualContact | undefined>;
  updateManualContact(id: string, data: Partial<InsertManualContact>): Promise<ManualContact | undefined>;
  deleteManualContact(id: string): Promise<void>;
  
  // Unified Contacts (Canonical contact registry)
  upsertContact(data: InsertContact): Promise<Contact>;
  upsertContactSource(data: InsertContactSource): Promise<ContactSource>;
  getContactByPhone(companyId: string, phoneNormalized: string): Promise<Contact | undefined>;
  getContactByEmail(companyId: string, email: string): Promise<Contact | undefined>;
  getContactWithSources(contactId: string): Promise<Contact & { sources: ContactSource[] } | undefined>;
  getContacts(companyId: string, filters?: {
    search?: string;
    limit?: number;
    offset?: number;
    listId?: string;
    includeUnassignedOnly?: boolean;
    includeBlacklistOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ contacts: Array<Contact & { sourceCount: number }>; total: number }>;
  getLandingLead(id: string): Promise<any>;
  
  // Blacklist Management
  addToBlacklist(data: {
    companyId: string;
    channel: "sms" | "imessage" | "email" | "all";
    identifier: string;
    reason: "stop" | "manual" | "bounced" | "complaint";
    addedBy?: string;
    sourceMessageId?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }): Promise<BlacklistEntry>;
  removeFromBlacklist(params: {
    companyId: string;
    channel: string;
    identifier: string;
    removedBy?: string;
  }): Promise<boolean>;
  isBlacklisted(params: {
    companyId: string;
    channel: string;
    identifier: string;
  }): Promise<boolean>;
  getBlacklistEntries(companyId: string, filters?: {
    channel?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ entries: BlacklistEntry[]; total: number }>;
  getBlacklistEntry(id: string): Promise<BlacklistEntry | undefined>;
  getBlacklistEntryByIdentifier(params: {
    companyId: string;
    channel: string;
    identifier: string;
  }): Promise<BlacklistEntry | undefined>;
  
  // Enhanced Contact Management
  listContacts(params: {
    companyId: string;
    page: number;
    limit: number;
    search?: string;
    listId?: string;
    includeUnassignedOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ contacts: ManualContact[]; total: number; page: number; limit: number }>;
  
  filterContacts(params: {
    companyId: string;
    searchTerm?: string;
    listIds?: string[];
    dateRange?: { from: Date; to: Date };
  }): Promise<ManualContact[]>;
  
  bulkDeleteContacts(companyId: string, contactIds: string[]): Promise<{ deleted: number }>;
  bulkAddToList(companyId: string, contactIds: string[], listId: string): Promise<{ added: number }>;
  bulkAddContactsToList(companyId: string, listId: string, contactIds: string[]): Promise<{ addedIds: string[]; skippedIds: string[] }>;
  bulkRemoveFromList(companyId: string, contactIds: string[], listId: string): Promise<{ removed: number }>;
  moveContactsBetweenLists(companyId: string, contactIds: string[], fromListId: string, toListId: string): Promise<{ moved: number }>;
  exportContactsCSV(companyId: string, contactIds?: string[]): Promise<string>;
  importContactsCSV(companyId: string, csvData: string, userId: string): Promise<{
    imported: number;
    duplicates: number;
    errors: string[];
    preview?: ManualContact[];
    importedContactIds?: string[];
  }>;
  
  // Contact Engagements
  createContactEngagement(data: InsertContactEngagement): Promise<ContactEngagement>;
  getContactEngagements(contactId: string): Promise<ContactEngagement[]>;
  
  // Unified Contacts
  getUnifiedContacts(params?: { companyId?: string; userId?: string; origin?: string; status?: string; productType?: string }): Promise<UnifiedContact[]>;
  
  // Tasks
  createTask(task: InsertTask & { companyId: string; creatorId: string }): Promise<Task>;
  getTaskById(id: string, companyId?: string): Promise<Task | undefined>;
  updateTask(id: string, updates: UpdateTask, companyId?: string): Promise<Task | undefined>;
  deleteTask(id: string, companyId?: string): Promise<boolean>;
  listTasks(filters: {
    companyId?: string;
    assigneeId?: string;
    status?: string;
    hideCompleted?: boolean;
    search?: string;
  }): Promise<Task[]>;
  
  // iMessage Campaigns
  createImessageCampaign(data: InsertImessageCampaign): Promise<ImessageCampaign>;
  createImessageCampaignWithDetails(companyId: string, userId: string, data: CreateCampaignWithDetails): Promise<ImessageCampaign>;
  getImessageCampaign(id: string): Promise<ImessageCampaign | undefined>;
  getImessageCampaignsByCompany(companyId: string): Promise<ImessageCampaign[]>;
  updateImessageCampaign(id: string, data: Partial<InsertImessageCampaign>): Promise<ImessageCampaign | undefined>;
  updateImessageCampaignWithDetails(campaignId: string, companyId: string, data: CreateCampaignWithDetails): Promise<ImessageCampaign>;
  deleteImessageCampaign(id: string): Promise<boolean>;
  
  // iMessage Campaign Runs
  createImessageCampaignRun(data: InsertImessageCampaignRun): Promise<ImessageCampaignRun>;
  getImessageCampaignRun(id: string): Promise<ImessageCampaignRun | undefined>;
  getImessageCampaignRunsByCampaign(campaignId: string): Promise<ImessageCampaignRun[]>;
  getNextRunNumber(campaignId: string): Promise<number>;
  updateImessageCampaignRun(id: string, data: Partial<InsertImessageCampaignRun>): Promise<ImessageCampaignRun | undefined>;
  
  // iMessage Campaign Messages
  createImessageCampaignMessage(data: InsertImessageCampaignMessage): Promise<ImessageCampaignMessage>;
  getImessageCampaignMessage(id: string): Promise<ImessageCampaignMessage | undefined>;
  getImessageCampaignMessagesByRun(runId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<ImessageCampaignMessage[]>;
  getPendingCampaignMessages(runId: string, limit?: number): Promise<ImessageCampaignMessage[]>;
  getAbandonedCampaignMessages(): Promise<ImessageCampaignMessage[]>;
  updateImessageCampaignMessage(id: string, data: Partial<InsertImessageCampaignMessage>): Promise<ImessageCampaignMessage | undefined>;
  bulkCreateCampaignMessages(messages: InsertImessageCampaignMessage[]): Promise<ImessageCampaignMessage[]>;
  
  // iMessage Campaign Processing
  getActiveImessageCampaignRuns(): Promise<ImessageCampaignRun[]>;
  getContactById(id: string): Promise<ManualContact | undefined>;
  getCampaignSchedule(campaignId: string): Promise<CampaignSchedule | undefined>;
  incrementRunSentCount(runId: string): Promise<void>;
  incrementRunDeliveredCount(runId: string): Promise<void>;
  incrementRunFailedCount(runId: string): Promise<void>;
  
  // Campaign Template Categories
  getCampaignTemplateCategories(companyId: string): Promise<CampaignTemplateCategory[]>;
  createCampaignTemplateCategory(data: InsertCampaignTemplateCategory): Promise<CampaignTemplateCategory>;
  updateCampaignTemplateCategory(id: string, data: Partial<InsertCampaignTemplateCategory>): Promise<CampaignTemplateCategory>;
  deleteCampaignTemplateCategory(id: string): Promise<void>;
  
  // Campaign Templates
  getCampaignTemplates(companyId: string, categoryId?: string): Promise<CampaignTemplate[]>;
  getCampaignTemplateById(id: string, companyId: string): Promise<CampaignTemplate | undefined>;
  createCampaignTemplate(data: InsertCampaignTemplate): Promise<CampaignTemplate>;
  updateCampaignTemplate(id: string, companyId: string, data: Partial<InsertCampaignTemplate>, isSuperadmin?: boolean): Promise<CampaignTemplate>;
  deleteCampaignTemplate(id: string, companyId: string, isSuperadmin?: boolean): Promise<void>;
  incrementTemplateUsage(id: string): Promise<void>;
  
  // Campaign Placeholders
  getCampaignPlaceholders(companyId: string): Promise<CampaignPlaceholder[]>;
  createCampaignPlaceholder(data: InsertCampaignPlaceholder): Promise<CampaignPlaceholder>;
  updateCampaignPlaceholder(id: string, companyId: string, data: Partial<InsertCampaignPlaceholder>): Promise<CampaignPlaceholder>;
  deleteCampaignPlaceholder(id: string, companyId: string): Promise<void>;
  
  // User Limits - Plan Enforcement
  getActiveUserCountByCompany(companyId: string): Promise<number>;
  getPendingInvitationCountByCompany(companyId: string): Promise<number>;
  getPlanLimitForCompany(companyId: string): Promise<number | null>;
  canCompanyAddUsers(companyId: string, countToAdd?: number): Promise<{ allowed: boolean; currentCount: number; limit: number | null; message?: string }>;
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
    // Normalize phone number to 10-digit format before storage
    const normalizedUser = {
      ...insertUser,
      phone: insertUser.phone ? formatForStorage(insertUser.phone) : insertUser.phone,
    };
    const result = await db.insert(users).values(normalizedUser as any).returning();
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
    // Convert empty string to null for phone removal, normalize to 10-digit format before storage
    if (data.phone !== undefined) {
      mappedData.phone = data.phone === "" ? null : formatForStorage(data.phone);
    }
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
    // Data visibility permission
    if (data.viewAllCompanyData !== undefined) mappedData.viewAllCompanyData = data.viewAllCompanyData;
    // Last login tracking
    if (data.lastLoginAt !== undefined) mappedData.lastLoginAt = data.lastLoginAt;
    // WebPhone SIP credentials
    if (data.sipExtension !== undefined) mappedData.sipExtension = data.sipExtension;
    if (data.sipPassword !== undefined) mappedData.sipPassword = data.sipPassword;
    if (data.sipServer !== undefined) mappedData.sipServer = data.sipServer;
    if (data.sipEnabled !== undefined) mappedData.sipEnabled = data.sipEnabled;
    // Stripe customer ID for user billing
    if (data.stripeCustomerId !== undefined) mappedData.stripeCustomerId = data.stripeCustomerId;
    
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
    // Normalize phone numbers to 10-digit format before storage
    const normalizedCompany = {
      ...insertCompany,
      phone: insertCompany.phone ? formatForStorage(insertCompany.phone) : insertCompany.phone,
      representativePhone: insertCompany.representativePhone ? formatForStorage(insertCompany.representativePhone) : insertCompany.representativePhone,
    };
    const result = await db.insert(companies).values(normalizedCompany).returning();
    return result[0];
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    // Normalize phone numbers to 10-digit format before storage
    const normalizedData = {
      ...data,
      phone: data.phone !== undefined ? (data.phone ? formatForStorage(data.phone) : data.phone) : undefined,
      representativePhone: data.representativePhone !== undefined ? (data.representativePhone ? formatForStorage(data.representativePhone) : data.representativePhone) : undefined,
    };
    const result = await db.update(companies).set(normalizedData).where(eq(companies.id, id)).returning();
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

  // ==================== PLAN FEATURES ====================

  async getAllPlanFeatures(): Promise<PlanFeature[]> {
    return db.select().from(planFeatures).orderBy(planFeatures.sortOrder);
  }

  async getPlanFeature(id: string): Promise<PlanFeature | undefined> {
    const result = await db.select().from(planFeatures).where(eq(planFeatures.id, id));
    return result[0];
  }

  async createPlanFeature(data: InsertPlanFeature): Promise<PlanFeature> {
    const result = await db.insert(planFeatures).values(data).returning();
    return result[0];
  }

  async updatePlanFeature(id: string, data: Partial<InsertPlanFeature>): Promise<PlanFeature | undefined> {
    const result = await db.update(planFeatures).set({ ...data, updatedAt: new Date() }).where(eq(planFeatures.id, id)).returning();
    return result[0];
  }

  async deletePlanFeature(id: string): Promise<boolean> {
    const result = await db.delete(planFeatures).where(eq(planFeatures.id, id)).returning();
    return result.length > 0;
  }

  // ==================== PLAN FEATURE ASSIGNMENTS ====================
  
  async getPlanFeatureAssignments(planId: string): Promise<PlanFeatureAssignment[]> {
    return db.select()
      .from(planFeatureAssignments)
      .where(eq(planFeatureAssignments.planId, planId))
      .orderBy(planFeatureAssignments.sortOrder);
  }
  
  async setPlanFeatureAssignments(planId: string, assignments: InsertPlanFeatureAssignment[]): Promise<PlanFeatureAssignment[]> {
    await db.delete(planFeatureAssignments).where(eq(planFeatureAssignments.planId, planId));
    if (assignments.length === 0) {
      return [];
    }
    const assignmentsWithPlanId = assignments.map(a => ({
      ...a,
      planId,
    }));
    const result = await db.insert(planFeatureAssignments).values(assignmentsWithPlanId).returning();
    return result;
  }
  
  async updatePlanFeatureAssignment(planId: string, featureId: string, included: boolean): Promise<PlanFeatureAssignment | undefined> {
    const result = await db.update(planFeatureAssignments)
      .set({ included, updatedAt: new Date() })
      .where(
        and(
          eq(planFeatureAssignments.planId, planId),
          eq(planFeatureAssignments.featureId, featureId)
        )
      )
      .returning();
    return result[0];
  }
  
  async deletePlanFeatureAssignment(planId: string, featureId: string): Promise<boolean> {
    const result = await db.delete(planFeatureAssignments)
      .where(
        and(
          eq(planFeatureAssignments.planId, planId),
          eq(planFeatureAssignments.featureId, featureId)
        )
      )
      .returning();
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

  async getInvoicesByCompany(companyId: string, userId?: string): Promise<Invoice[]> {
    // If userId provided, filter by owner for user-scoped billing
    const conditions = [eq(invoices.companyId, companyId)];
    if (userId) {
      conditions.push(eq(invoices.ownerUserId, userId));
    }
    return db.select().from(invoices).where(and(...conditions)).orderBy(desc(invoices.createdAt));
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

  async getPaymentsByCompany(companyId: string, userId?: string): Promise<Payment[]> {
    // If userId provided, filter by owner for user-scoped billing
    const conditions = [eq(payments.companyId, companyId)];
    if (userId) {
      conditions.push(eq(payments.ownerUserId, userId));
    }
    return db.select().from(payments).where(and(...conditions)).orderBy(desc(payments.createdAt));
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

  // ==================== BILLING ADDRESSES (User-scoped) ====================
  
  async getBillingAddress(companyId: string, userId?: string): Promise<BillingAddress | undefined> {
    // If userId provided, filter by owner; otherwise get first for company (legacy behavior)
    const conditions = [eq(billingAddresses.companyId, companyId)];
    if (userId) {
      conditions.push(eq(billingAddresses.ownerUserId, userId));
    }
    const result = await db.select().from(billingAddresses).where(and(...conditions));
    return result[0];
  }

  async createBillingAddress(insertAddress: InsertBillingAddress): Promise<BillingAddress> {
    const result = await db.insert(billingAddresses).values(insertAddress).returning();
    return result[0];
  }

  async updateBillingAddress(companyId: string, data: Partial<InsertBillingAddress>, userId?: string): Promise<BillingAddress | undefined> {
    // If userId provided, only update owner's billing address
    const conditions = [eq(billingAddresses.companyId, companyId)];
    if (userId) {
      conditions.push(eq(billingAddresses.ownerUserId, userId));
    }
    const result = await db.update(billingAddresses)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return result[0];
  }

  // ==================== USER PAYMENT METHODS (User-scoped) ====================
  
  async getUserPaymentMethods(companyId: string, userId: string): Promise<UserPaymentMethod[]> {
    return db.select().from(userPaymentMethods)
      .where(and(
        eq(userPaymentMethods.companyId, companyId),
        eq(userPaymentMethods.ownerUserId, userId),
        eq(userPaymentMethods.status, 'active')
      ))
      .orderBy(desc(userPaymentMethods.isDefault), desc(userPaymentMethods.createdAt));
  }

  async getUserPaymentMethod(id: string): Promise<UserPaymentMethod | undefined> {
    const result = await db.select().from(userPaymentMethods).where(eq(userPaymentMethods.id, id));
    return result[0];
  }

  async createUserPaymentMethod(insertPaymentMethod: InsertUserPaymentMethod): Promise<UserPaymentMethod> {
    const result = await db.insert(userPaymentMethods).values(insertPaymentMethod).returning();
    return result[0];
  }

  async updateUserPaymentMethod(id: string, data: Partial<InsertUserPaymentMethod>): Promise<UserPaymentMethod | undefined> {
    const result = await db.update(userPaymentMethods)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPaymentMethods.id, id))
      .returning();
    return result[0];
  }

  async deleteUserPaymentMethod(id: string): Promise<boolean> {
    // Soft delete - just mark as removed
    const result = await db.update(userPaymentMethods)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(eq(userPaymentMethods.id, id))
      .returning();
    return result.length > 0;
  }

  async setDefaultUserPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    // First, unset all default flags for this user
    await db.update(userPaymentMethods)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(userPaymentMethods.ownerUserId, userId));
    // Then set the specified one as default
    await db.update(userPaymentMethods)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(userPaymentMethods.id, paymentMethodId));
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

  async getInvitationsByCompany(companyId: string): Promise<Invitation[]> {
    const result = await db.select()
      .from(invitations)
      .where(eq(invitations.companyId, companyId))
      .orderBy(desc(invitations.createdAt));
    return result;
  }

  async deleteInvitation(token: string): Promise<boolean> {
    const result = await db.delete(invitations)
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
    // Use upsert pattern to prevent duplicate feature assignments
    const result = await db.insert(companyFeatures)
      .values({ companyId, featureId, enabledBy })
      .onConflictDoNothing({ target: [companyFeatures.companyId, companyFeatures.featureId] })
      .returning();
    
    // If conflict occurred (feature already exists), fetch and return existing record
    if (result.length === 0) {
      const existing = await db
        .select()
        .from(companyFeatures)
        .where(and(
          eq(companyFeatures.companyId, companyId),
          eq(companyFeatures.featureId, featureId)
        ))
        .limit(1);
      
      // Defensive check: if record doesn't exist after conflict, something is wrong
      if (!existing[0]) {
        throw new Error(`Feature assignment not found after conflict for company ${companyId} and feature ${featureId}`);
      }
      
      return existing[0];
    }
    
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
  
  async getAllContactLists(companyId?: string, createdBy?: string): Promise<ContactList[]> {
    let lists: ContactList[];
    
    if (companyId) {
      // Filter by company - join with users table to get lists created by users in this company
      lists = await db.select({
        id: contactLists.id,
        name: contactLists.name,
        description: contactLists.description,
        createdBy: contactLists.createdBy,
        createdAt: contactLists.createdAt,
        updatedAt: contactLists.updatedAt,
      })
        .from(contactLists)
        .innerJoin(users, eq(contactLists.createdBy, users.id))
        .where(createdBy 
          ? and(eq(users.companyId, companyId), eq(contactLists.createdBy, createdBy))
          : eq(users.companyId, companyId)
        )
        .orderBy(desc(contactLists.createdAt)) as any;
    } else if (createdBy) {
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
  
  async getListMembers(listId: string): Promise<ManualContact[]> {
    const members = await db.select({ contact: manualContacts })
      .from(contactListMembers)
      .innerJoin(manualContacts, eq(contactListMembers.contactId, manualContacts.id))
      .where(eq(contactListMembers.listId, listId));
    return members.map(m => m.contact);
  }
  
  async addMemberToList(listId: string, contactId: string): Promise<ContactListMember> {
    const result = await db.insert(contactListMembers)
      .values({ listId, contactId })
      .onConflictDoNothing()
      .returning();
    return result[0];
  }
  
  async removeMemberFromList(listId: string, contactId: string): Promise<boolean> {
    const result = await db.delete(contactListMembers)
      .where(and(
        eq(contactListMembers.listId, listId),
        eq(contactListMembers.contactId, contactId)
      ));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async getListsForContact(contactId: string): Promise<ContactList[]> {
    const lists = await db.select({ list: contactLists })
      .from(contactListMembers)
      .innerJoin(contactLists, eq(contactListMembers.listId, contactLists.id))
      .where(eq(contactListMembers.contactId, contactId));
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
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
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
          avatar: agentUser.avatar,
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
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
    spouses?: Array<{ firstName: string; middleName?: string; lastName: string; secondLastName?: string; email?: string; phone?: string; }>;
    dependents?: Array<{ firstName: string; middleName?: string; lastName: string; secondLastName?: string; email?: string; phone?: string; }>;
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
              avatar: agentUser.avatar,
            };
          }
        }

        // Get all quote members for this quote
        const allMembers = await db
          .select()
          .from(quoteMembers)
          .where(
            and(
              eq(quoteMembers.quoteId, result.quote.id),
              eq(quoteMembers.companyId, companyId)
            )
          );

        // Separate spouses and dependents
        const spouses = allMembers
          .filter(m => m.role === 'spouse')
          .map(m => ({
            firstName: m.firstName,
            middleName: m.middleName || undefined,
            lastName: m.lastName,
            secondLastName: m.secondLastName || undefined,
            email: m.email || undefined,
            phone: m.phone || undefined,
          }));

        const dependents = allMembers
          .filter(m => m.role === 'dependent')
          .map(m => ({
            firstName: m.firstName,
            middleName: m.middleName || undefined,
            lastName: m.lastName,
            secondLastName: m.secondLastName || undefined,
            email: m.email || undefined,
            phone: m.phone || undefined,
          }));

        return {
          ...result.quote,
          creator: result.creator,
          agent,
          spouses,
          dependents,
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

  async getQuotesList(companyId: string, options?: {
    limit?: number;
    cursor?: string;
    agentId?: string;
    productType?: string;
    status?: string;
    effectiveDateFrom?: string;
    effectiveDateTo?: string;
    skipAgentFilter?: boolean;
    searchTerm?: string;
    includeFamilyMembers?: boolean;
    folderId?: string | null;
  }): Promise<{
    items: Array<{
      id: string;
      companyId: string;
      effectiveDate: string;
      productType: string;
      status: string;
      clientFirstName: string;
      clientMiddleName: string | null;
      clientLastName: string;
      clientSecondLastName: string | null;
      clientEmail: string;
      clientPhone: string;
      agentId: string | null;
      agentName: string | null;
      isArchived: boolean | null;
      createdAt: Date;
    }>;
    nextCursor: string | null;
  }> {
    const limit = options?.limit || 999999;
    
    let cursorUpdatedAt: string | null = null;
    let cursorDate: string | null = null;
    let cursorId: string | null = null;
    if (options?.cursor) {
      const parts = options.cursor.split(',');
      if (parts.length === 3) {
        cursorUpdatedAt = parts[0];
        cursorDate = parts[1];
        cursorId = parts[2];
      }
    }
    
    const conditions: any[] = [eq(quotes.companyId, companyId)];
    
    if (options?.agentId && !options?.skipAgentFilter) {
      conditions.push(eq(quotes.agentId, options.agentId));
    }
    if (options?.productType) {
      conditions.push(eq(quotes.productType, options.productType));
    }
    if (options?.status) {
      conditions.push(eq(quotes.status, options.status));
    }
    if (options?.effectiveDateFrom) {
      conditions.push(gte(quotes.effectiveDate, options.effectiveDateFrom));
    }
    if (options?.effectiveDateTo) {
      conditions.push(lt(quotes.effectiveDate, options.effectiveDateTo));
    }
    
    if (options?.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      const searchPattern = `%${searchLower}%`;
      
      if (!options.includeFamilyMembers) {
        conditions.push(
          or(
            sql`LOWER(CONCAT(${quotes.clientFirstName}, ' ', COALESCE(${quotes.clientMiddleName}, ''), ' ', ${quotes.clientLastName}, ' ', COALESCE(${quotes.clientSecondLastName}, ''))) LIKE ${searchPattern}`,
            sql`LOWER(${quotes.clientEmail}) LIKE ${searchPattern}`,
            sql`${quotes.clientPhone} LIKE ${searchPattern}`
          ) as any
        );
      }
    }
    
    if (options?.folderId !== undefined) {
      if (options.folderId === null) {
        conditions.push(isNull(quoteFolderAssignments.folderId));
      } else {
        conditions.push(eq(quoteFolderAssignments.folderId, options.folderId));
      }
    }
    
    if (cursorUpdatedAt && cursorDate && cursorId) {
      conditions.push(
        or(
          sql`COALESCE(${quotes.updatedAt}, ${quotes.createdAt}) < ${cursorUpdatedAt}`,
          and(
            sql`COALESCE(${quotes.updatedAt}, ${quotes.createdAt}) = ${cursorUpdatedAt}`,
            or(
              sql`${quotes.effectiveDate}::date < ${cursorDate}::date`,
              and(
                sql`${quotes.effectiveDate}::date = ${cursorDate}::date`,
                lt(quotes.id, cursorId)
              )
            ) as any
          ) as any
        ) as any
      );
    }
    
    let query = db
      .select({
        id: quotes.id,
        companyId: quotes.companyId,
        effectiveDate: quotes.effectiveDate,
        productType: quotes.productType,
        status: quotes.status,
        clientFirstName: quotes.clientFirstName,
        clientMiddleName: quotes.clientMiddleName,
        clientLastName: quotes.clientLastName,
        clientSecondLastName: quotes.clientSecondLastName,
        clientEmail: quotes.clientEmail,
        clientPhone: quotes.clientPhone,
        agentId: quotes.agentId,
        agentName: sql<string | null>`CONCAT(${users.firstName}, ' ', ${users.lastName})`.as('agent_name'),
        isArchived: quotes.isArchived,
        createdAt: quotes.createdAt,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.agentId, users.id))
      .leftJoin(quoteFolderAssignments, eq(quotes.id, quoteFolderAssignments.quoteId))
      .where(and(...conditions))
      .orderBy(
        desc(sql`COALESCE(${quotes.updatedAt}, ${quotes.createdAt})`),
        desc(quotes.effectiveDate),
        desc(quotes.id)
      )
      .limit(limit + 1);
    
    if (options?.searchTerm && options?.includeFamilyMembers) {
      const searchLower = options.searchTerm.toLowerCase();
      const searchPattern = `%${searchLower}%`;
      
      const quoteIdsWithMemberMatch = await db
        .selectDistinct({ quoteId: quoteMembers.quoteId })
        .from(quoteMembers)
        .where(
          and(
            eq(quoteMembers.companyId, companyId),
            or(
              sql`LOWER(CONCAT(${quoteMembers.firstName}, ' ', COALESCE(${quoteMembers.middleName}, ''), ' ', ${quoteMembers.lastName}, ' ', COALESCE(${quoteMembers.secondLastName}, ''))) LIKE ${searchPattern}`,
              sql`LOWER(COALESCE(${quoteMembers.email}, '')) LIKE ${searchPattern}`,
              sql`COALESCE(${quoteMembers.phone}, '') LIKE ${searchPattern}`
            ) as any
          )
        );
      
      const quoteIds = quoteIdsWithMemberMatch.map(row => row.quoteId);
      
      const existingConditions = conditions.filter(c => {
        const str = String(c);
        return !str.includes('clientFirstName') && !str.includes('clientEmail') && !str.includes('clientPhone');
      });
      
      if (quoteIds.length > 0) {
        existingConditions.push(
          or(
            sql`LOWER(CONCAT(${quotes.clientFirstName}, ' ', COALESCE(${quotes.clientMiddleName}, ''), ' ', ${quotes.clientLastName}, ' ', COALESCE(${quotes.clientSecondLastName}, ''))) LIKE ${searchPattern}`,
            sql`LOWER(${quotes.clientEmail}) LIKE ${searchPattern}`,
            sql`${quotes.clientPhone} LIKE ${searchPattern}`,
            inArray(quotes.id, quoteIds)
          ) as any
        );
      } else {
        existingConditions.push(
          or(
            sql`LOWER(CONCAT(${quotes.clientFirstName}, ' ', COALESCE(${quotes.clientMiddleName}, ''), ' ', ${quotes.clientLastName}, ' ', COALESCE(${quotes.clientSecondLastName}, ''))) LIKE ${searchPattern}`,
            sql`LOWER(${quotes.clientEmail}) LIKE ${searchPattern}`,
            sql`${quotes.clientPhone} LIKE ${searchPattern}`
          ) as any
        );
      }
      
      query = db
        .select({
          id: quotes.id,
          companyId: quotes.companyId,
          effectiveDate: quotes.effectiveDate,
          productType: quotes.productType,
          status: quotes.status,
          clientFirstName: quotes.clientFirstName,
          clientMiddleName: quotes.clientMiddleName,
          clientLastName: quotes.clientLastName,
          clientSecondLastName: quotes.clientSecondLastName,
          clientEmail: quotes.clientEmail,
          clientPhone: quotes.clientPhone,
          agentId: quotes.agentId,
          agentName: sql<string | null>`CONCAT(${users.firstName}, ' ', ${users.lastName})`.as('agent_name'),
          isArchived: quotes.isArchived,
          createdAt: quotes.createdAt,
          updatedAt: quotes.updatedAt,
        })
        .from(quotes)
        .leftJoin(users, eq(quotes.agentId, users.id))
        .leftJoin(quoteFolderAssignments, eq(quotes.id, quoteFolderAssignments.quoteId))
        .where(and(...existingConditions))
        .orderBy(
          desc(sql`COALESCE(${quotes.updatedAt}, ${quotes.createdAt})`),
          desc(quotes.effectiveDate),
          desc(quotes.id)
        )
        .limit(limit + 1);
    }
    
    const results = await query;
    
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const lastUpdatedAt = lastItem.updatedAt?.toISOString() || lastItem.createdAt.toISOString();
      nextCursor = `${lastUpdatedAt},${lastItem.effectiveDate},${lastItem.id}`;
    }
    
    return {
      items: items.map(item => ({
        id: item.id,
        companyId: item.companyId,
        effectiveDate: item.effectiveDate,
        productType: item.productType,
        status: item.status,
        clientFirstName: item.clientFirstName,
        clientMiddleName: item.clientMiddleName,
        clientLastName: item.clientLastName,
        clientSecondLastName: item.clientSecondLastName,
        clientEmail: item.clientEmail,
        clientPhone: item.clientPhone,
        agentId: item.agentId,
        agentName: item.agentName,
        isArchived: item.isArchived,
        createdAt: item.createdAt,
      })),
      nextCursor
    };
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
  
  async getQuotesByApplicant(companyId: string, ssn?: string | null, email?: string | null, firstName?: string | null, lastName?: string | null, dob?: string | null, effectiveYear?: number): Promise<Array<Quote & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>> {
    // Build identity key using same logic as resolveApplicantIdentity
    const normalizedSsn = ssn?.replace(/\D/g, '') || '';
    const normalizedEmail = email?.toLowerCase() || '';
    
    let identityConditions: any[] = [];
    
    // SSN matching - REQUIRE EXACTLY 9 DIGITS (full SSN only)
    if (normalizedSsn.length === 9) {
      identityConditions.push(
        sql`REPLACE(REPLACE(REPLACE(${quotes.clientSsn}, '-', ''), ' ', ''), '.', '') = ${normalizedSsn}`
      );
    } else if (normalizedEmail) {
      // Email fallback if SSN is not complete
      identityConditions.push(
        sql`LOWER(${quotes.clientEmail}) = ${normalizedEmail}`
      );
    }
    
    // If no valid identifier, return empty
    if (identityConditions.length === 0) {
      return [];
    }
    
    const conditions: any[] = [
      eq(quotes.companyId, companyId),
      or(...identityConditions)
    ];
    
    // Filter by primary applicant name and DOB to ensure only quotes 
    // where this person is the primary applicant (not a dependent)
    if (firstName) {
      conditions.push(eq(quotes.clientFirstName, firstName));
    }
    if (lastName) {
      conditions.push(eq(quotes.clientLastName, lastName));
    }
    if (dob) {
      conditions.push(eq(quotes.clientDateOfBirth, dob));
    }
    
    if (effectiveYear) {
      conditions.push(sql`EXTRACT(YEAR FROM ${quotes.effectiveDate}) = ${effectiveYear}`);
    }
    
    // Create aliases for the users table to join it twice
    const creatorUser = alias(users, 'creatorUser');
    const agentUser = alias(users, 'agentUser');
    
    const results = await db
      .select({
        quote: quotes,
        primaryPlanData: quotePlans.planData,
        creator: {
          id: creatorUser.id,
          firstName: creatorUser.firstName,
          lastName: creatorUser.lastName,
          email: creatorUser.email,
        },
        agent: {
          id: agentUser.id,
          firstName: agentUser.firstName,
          lastName: agentUser.lastName,
          email: agentUser.email,
        },
      })
      .from(quotes)
      .leftJoin(creatorUser, eq(quotes.createdBy, creatorUser.id))
      .leftJoin(agentUser, eq(quotes.agentId, agentUser.id))
      .leftJoin(quotePlans, and(
        eq(quotePlans.quoteId, quotes.id),
        eq(quotePlans.isPrimary, true)
      ))
      .where(and(...conditions))
      .orderBy(desc(quotes.effectiveDate), desc(quotes.createdAt));

    return results.map((result) => ({
      ...result.quote,
      // Use primaryPlanData from quote_plans if selectedPlan is null (legacy field)
      selectedPlan: result.quote.selectedPlan || result.primaryPlanData || null,
      creator: result.creator,
      agent: result.agent.id ? result.agent : null,
    })) as any;
  }
  
  // ==================== QUOTE PLANS (Multi-plan support) ====================
  
  async listQuotePlans(quoteId: string, companyId: string): Promise<QuotePlan[]> {
    const result = await db
      .select()
      .from(quotePlans)
      .where(and(
        eq(quotePlans.quoteId, quoteId),
        eq(quotePlans.companyId, companyId)
      ))
      .orderBy(desc(quotePlans.isPrimary), quotePlans.displayOrder, quotePlans.createdAt);
    
    return result;
  }
  
  async addQuotePlan(data: InsertQuotePlan): Promise<QuotePlan> {
    // Get the max displayOrder for this quote to calculate next order
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${quotePlans.displayOrder}), -1)` })
      .from(quotePlans)
      .where(eq(quotePlans.quoteId, data.quoteId));
    
    const nextDisplayOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;
    
    const result = await db
      .insert(quotePlans)
      .values({
        ...data,
        displayOrder: data.displayOrder ?? nextDisplayOrder,
        updatedAt: new Date(),
      })
      .returning();
    
    return result[0];
  }
  
  async updateQuotePlan(planId: string, companyId: string, data: Partial<InsertQuotePlan>): Promise<QuotePlan | null> {
    const result = await db
      .update(quotePlans)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(quotePlans.id, planId),
        eq(quotePlans.companyId, companyId)
      ))
      .returning();
    
    return result[0] || null;
  }
  
  async removeQuotePlan(planId: string, companyId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // First, get the plan to know which quote it belongs to and if it's primary
      const planToDelete = await tx
        .select()
        .from(quotePlans)
        .where(and(
          eq(quotePlans.id, planId),
          eq(quotePlans.companyId, companyId)
        ))
        .limit(1);
      
      if (planToDelete.length === 0) {
        return false;
      }
      
      const quoteId = planToDelete[0].quoteId;
      const wasPrimary = planToDelete[0].isPrimary;
      
      // Delete the plan
      const result = await tx
        .delete(quotePlans)
        .where(and(
          eq(quotePlans.id, planId),
          eq(quotePlans.companyId, companyId)
        ))
        .returning();
      
      if (result.length === 0) {
        return false;
      }
      
      // Only clear memberId if the deleted plan was primary
      if (wasPrimary && quoteId) {
        // Check if any remaining plans exist for this quote
        const remainingPlans = await tx
          .select()
          .from(quotePlans)
          .where(and(
            eq(quotePlans.quoteId, quoteId),
            eq(quotePlans.companyId, companyId)
          ))
          .limit(1);
        
        // Clear memberId only if no plans remain OR no primary plan remains
        const remainingPrimary = await tx
          .select()
          .from(quotePlans)
          .where(and(
            eq(quotePlans.quoteId, quoteId),
            eq(quotePlans.companyId, companyId),
            eq(quotePlans.isPrimary, true)
          ))
          .limit(1);
        
        if (remainingPlans.length === 0 || remainingPrimary.length === 0) {
          // Clear memberId AND selectedPlan (legacy) when primary plan is deleted and no replacement primary exists
          await tx
            .update(quotes)
            .set({ 
              memberId: null,
              selectedPlan: null,
              updatedAt: new Date()
            })
            .where(and(
              eq(quotes.id, quoteId),
              eq(quotes.companyId, companyId)
            ));
        }
      }
      
      return true;
    });
  }
  
  async setPrimaryQuotePlan(planId: string, quoteId: string, companyId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(quotePlans)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(quotePlans.quoteId, quoteId),
          eq(quotePlans.companyId, companyId)
        ));
      
      await tx
        .update(quotePlans)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(and(
          eq(quotePlans.id, planId),
          eq(quotePlans.companyId, companyId)
        ));
    });
  }
  
  // ==================== QUOTE MEMBERS ====================
  
  async listQuoteMembers(quoteId: string): Promise<QuoteMember[]> {
    return db
      .select()
      .from(quoteMembers)
      .where(eq(quoteMembers.quoteId, quoteId))
      .orderBy(quoteMembers.createdAt);
  }
  
  async listAllQuoteMembers(companyId: string): Promise<QuoteMember[]> {
    return db
      .select()
      .from(quoteMembers)
      .where(eq(quoteMembers.companyId, companyId))
      .orderBy(quoteMembers.createdAt);
  }
  
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
  
  async getQuoteRemindersByCompany(companyId: string): Promise<QuoteReminder[]> {
    const results = await db
      .select()
      .from(quoteReminders)
      .where(eq(quoteReminders.companyId, companyId))
      .orderBy(quoteReminders.dueDate);
    
    return results;
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
  
  // ==================== QUOTE FOLDERS ====================
  
  async listQuoteFolders(companyId: string, userId: string): Promise<{ agency: QuoteFolder[], personal: QuoteFolder[] }> {
    const agencyFolders = await db
      .select()
      .from(quoteFolders)
      .where(and(
        eq(quoteFolders.companyId, companyId),
        eq(quoteFolders.type, 'agency')
      ))
      .orderBy(quoteFolders.name);
    
    const personalFolders = await db
      .select()
      .from(quoteFolders)
      .where(and(
        eq(quoteFolders.companyId, companyId),
        eq(quoteFolders.type, 'personal'),
        eq(quoteFolders.createdBy, userId)
      ))
      .orderBy(quoteFolders.name);
    
    return {
      agency: agencyFolders,
      personal: personalFolders
    };
  }
  
  async getQuoteFolder(id: string): Promise<QuoteFolder | undefined> {
    const result = await db
      .select()
      .from(quoteFolders)
      .where(eq(quoteFolders.id, id))
      .limit(1);
    
    return result[0];
  }
  
  async createQuoteFolder(data: InsertQuoteFolder): Promise<QuoteFolder> {
    const result = await db
      .insert(quoteFolders)
      .values(data)
      .returning();
    
    return result[0];
  }
  
  async updateQuoteFolder(id: string, companyId: string, data: Partial<InsertQuoteFolder>): Promise<QuoteFolder | undefined> {
    const result = await db
      .update(quoteFolders)
      .set({
        name: data.name,
        updatedAt: new Date()
      })
      .where(and(
        eq(quoteFolders.id, id),
        eq(quoteFolders.companyId, companyId)
      ))
      .returning();
    
    return result[0];
  }
  
  async deleteQuoteFolder(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(quoteFolders)
      .where(and(
        eq(quoteFolders.id, id),
        eq(quoteFolders.companyId, companyId)
      ))
      .returning();
    
    return result.length > 0;
  }
  
  async assignQuotesToFolder(quoteIds: string[], folderId: string | null, userId: string, companyId: string): Promise<number> {
    await db.transaction(async (tx) => {
      if (folderId === null) {
        await tx
          .delete(quoteFolderAssignments)
          .where(inArray(quoteFolderAssignments.quoteId, quoteIds));
      } else {
        await tx
          .delete(quoteFolderAssignments)
          .where(inArray(quoteFolderAssignments.quoteId, quoteIds));
        
        const assignmentsToInsert = quoteIds.map(quoteId => ({
          quoteId,
          folderId,
          assignedBy: userId
        }));
        
        if (assignmentsToInsert.length > 0) {
          await tx
            .insert(quoteFolderAssignments)
            .values(assignmentsToInsert);
        }
      }
    });
    
    return quoteIds.length;
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
    // First try to find in quote consents
    const quoteResult = await db
      .select()
      .from(consentDocuments)
      .where(eq(consentDocuments.token, token));
    
    if (quoteResult[0]) {
      return quoteResult[0];
    }
    
    // If not found, try policy consents
    const policyResult = await db
      .select()
      .from(policyConsentDocuments)
      .where(eq(policyConsentDocuments.token, token));
    
    return policyResult[0] || null;
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
    signatureImage: string;
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
        signatureImage: signatureData.signatureImage,
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
  
  // ==================== POLICIES ====================

  async createPolicy(insertPolicy: InsertPolicy): Promise<Policy> {
    const { generateShortId } = await import("./id-generator");
    
    // Generate unique short ID
    let shortId: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      shortId = generateShortId();
      const existing = await db.select().from(policies).where(eq(policies.id, shortId)).limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique policy ID");
    }
    
    const [policy] = await db
      .insert(policies)
      .values({ ...insertPolicy, id: shortId } as any)
      .returning();
    return policy;
  }

  async getPolicy(id: string): Promise<(Policy & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }) | undefined> {
    const result = await db
      .select({
        policy: policies,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(policies)
      .leftJoin(users, eq(policies.createdBy, users.id))
      .where(eq(policies.id, id))
      .limit(1);

    if (!result || result.length === 0) {
      return undefined;
    }

    const policy = result[0];
    let agent = null;

    if (policy.policy.agentId) {
      const agentUser = await this.getUser(policy.policy.agentId);
      if (agentUser) {
        agent = {
          id: agentUser.id,
          firstName: agentUser.firstName,
          lastName: agentUser.lastName,
          email: agentUser.email,
          avatar: agentUser.avatar,
        };
      }
    }

    return {
      ...policy.policy,
      creator: policy.creator,
      agent,
    } as any;
  }

  async getPoliciesByCompany(companyId: string, filters?: { agentId?: string; oepFilter?: "aca" | "medicare" }): Promise<Array<Policy & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
    spouses?: Array<{ firstName: string; middleName?: string; lastName: string; secondLastName?: string; email?: string; phone?: string; }>;
    dependents?: Array<{ firstName: string; middleName?: string; lastName: string; secondLastName?: string; email?: string; phone?: string; }>;
  }>> {
    // Build WHERE conditions
    const conditions = [eq(policies.companyId, companyId)];
    
    // Add agentId filter if provided
    if (filters?.agentId) {
      conditions.push(eq(policies.agentId, filters.agentId));
    }
    
    // Add OEP filter if provided
    if (filters?.oepFilter) {
      // Filter by product type
      if (filters.oepFilter === "aca") {
        conditions.push(
          or(
            eq(policies.productType, "Health Insurance ACA"),
            eq(policies.productType, "aca")
          ) as any
        );
      } else if (filters.oepFilter === "medicare") {
        conditions.push(
          or(
            eq(policies.productType, "Medicare"),
            eq(policies.productType, "medicare")
          ) as any
        );
      }
      
      // Filter by effective date (2025 policies only for OEP)
      conditions.push(
        and(
          gte(policies.effectiveDate, "2025-01-01"),
          lt(policies.effectiveDate, "2026-01-01")
        ) as any
      );
      
      // Exclude completed renewals and cancelled policies
      conditions.push(
        and(
          not(eq(policies.renewalStatus, "completed")),
          not(eq(policies.status, "cancelled")),
          not(eq(policies.status, "canceled"))
        ) as any
      );
    }
    
    const results = await db
      .select({
        policy: policies,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(policies)
      .leftJoin(users, eq(policies.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(policies.createdAt))
      .limit(100); // Temporary limit to prevent timeout

    const policiesWithDetails = await Promise.all(
      results.map(async (result) => {
        let agent = null;
        if (result.policy.agentId) {
          const agentUser = await this.getUser(result.policy.agentId);
          if (agentUser) {
            agent = {
              id: agentUser.id,
              firstName: agentUser.firstName,
              lastName: agentUser.lastName,
              email: agentUser.email,
              avatar: agentUser.avatar,
            };
          }
        }

        // Get all policy members for this policy
        const allMembers = await db
          .select()
          .from(policyMembers)
          .where(
            and(
              eq(policyMembers.policyId, result.policy.id),
              eq(policyMembers.companyId, companyId)
            )
          );

        // Separate spouses and dependents
        const spouses = allMembers
          .filter(m => m.role === 'spouse')
          .map(m => ({
            firstName: m.firstName,
            middleName: m.middleName || undefined,
            lastName: m.lastName,
            secondLastName: m.secondLastName || undefined,
            email: m.email || undefined,
            phone: m.phone || undefined,
          }));

        const dependents = allMembers
          .filter(m => m.role === 'dependent')
          .map(m => ({
            firstName: m.firstName,
            middleName: m.middleName || undefined,
            lastName: m.lastName,
            secondLastName: m.secondLastName || undefined,
            email: m.email || undefined,
            phone: m.phone || undefined,
          }));

        // HYBRID PLAN SUPPORT: Combine legacy selectedPlan (JSONB) with new policyPlans table
        // If policy has selectedPlan, use it (legacy system)
        // If not, fetch primary plan from policyPlans table (new system)
        let finalSelectedPlan = result.policy.selectedPlan;
        
        if (!finalSelectedPlan) {
          // No legacy plan, check policyPlans table
          const primaryPlan = await db
            .select()
            .from(policyPlans)
            .where(
              and(
                eq(policyPlans.policyId, result.policy.id),
                eq(policyPlans.companyId, companyId),
                eq(policyPlans.isPrimary, true)
              )
            )
            .limit(1);

          if (primaryPlan.length > 0) {
            // The full plan is stored in planData as JSONB
            finalSelectedPlan = primaryPlan[0].planData as any;
          }
        }

        return {
          ...result.policy,
          selectedPlan: finalSelectedPlan,
          creator: result.creator,
          agent,
          spouses,
          dependents,
        } as any;
      })
    );

    return policiesWithDetails;
  }

  async getPoliciesList(companyId: string, options?: {
    limit?: number;
    cursor?: string;
    agentId?: string;
    productType?: string;
    status?: string;
    effectiveDateFrom?: string;
    effectiveDateTo?: string;
    skipAgentFilter?: boolean;
    searchTerm?: string;
    includeFamilyMembers?: boolean;
    folderId?: string | null;
  }): Promise<{
    items: Array<{
      id: string;
      companyId: string;
      effectiveDate: string;
      productType: string;
      status: string;
      clientFirstName: string;
      clientMiddleName: string | null;
      clientLastName: string;
      clientSecondLastName: string | null;
      clientEmail: string;
      clientPhone: string;
      agentId: string | null;
      agentName: string | null;
      isArchived: boolean | null;
      createdAt: Date;
    }>;
    nextCursor: string | null;
  }> {
    // No limit by default - load ALL policies for client-side filtering
    const limit = options?.limit || 999999;
    
    // Parse cursor (format: "updatedAt,effectiveDate,id")
    let cursorUpdatedAt: string | null = null;
    let cursorDate: string | null = null;
    let cursorId: string | null = null;
    if (options?.cursor) {
      const parts = options.cursor.split(',');
      if (parts.length === 3) {
        cursorUpdatedAt = parts[0];
        cursorDate = parts[1];
        cursorId = parts[2];
      }
    }
    
    // Build WHERE conditions
    const conditions: any[] = [eq(policies.companyId, companyId)];
    
    // Apply filters (skip agentId filter if skipAgentFilter is true)
    if (options?.agentId && !options?.skipAgentFilter) {
      conditions.push(eq(policies.agentId, options.agentId));
    }
    if (options?.productType) {
      conditions.push(eq(policies.productType, options.productType));
    }
    if (options?.status) {
      conditions.push(eq(policies.status, options.status));
    }
    if (options?.effectiveDateFrom) {
      conditions.push(gte(policies.effectiveDate, options.effectiveDateFrom));
    }
    if (options?.effectiveDateTo) {
      conditions.push(lt(policies.effectiveDate, options.effectiveDateTo));
    }
    
    // Search filter (applied BEFORE limit to ensure results aren't truncated)
    if (options?.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      const searchPattern = `%${searchLower}%`;
      
      // If includeFamilyMembers is true, we'll add the family member search in the query
      // Otherwise, just search in client fields
      if (!options.includeFamilyMembers) {
        conditions.push(
          or(
            sql`LOWER(CONCAT(${policies.clientFirstName}, ' ', COALESCE(${policies.clientMiddleName}, ''), ' ', ${policies.clientLastName}, ' ', COALESCE(${policies.clientSecondLastName}, ''))) LIKE ${searchPattern}`,
            sql`LOWER(${policies.clientEmail}) LIKE ${searchPattern}`,
            sql`${policies.clientPhone} LIKE ${searchPattern}`
          ) as any
        );
      }
    }
    
    // Folder filter
    if (options?.folderId !== undefined) {
      if (options.folderId === null) {
        // Show only policies WITHOUT folder assignment
        conditions.push(isNull(policyFolderAssignments.folderId));
      } else {
        // Show policies IN that folder
        conditions.push(eq(policyFolderAssignments.folderId, options.folderId));
      }
    }
    
    // Cursor pagination
    // ORDER BY: COALESCE(updatedAt, createdAt) DESC, effectiveDate DESC, id DESC
    if (cursorUpdatedAt && cursorDate && cursorId) {
      conditions.push(
        or(
          // updatedAt is less than cursor (DESC order)
          sql`COALESCE(${policies.updatedAt}, ${policies.createdAt}) < ${cursorUpdatedAt}`,
          // updatedAt equals cursor, check effectiveDate
          and(
            sql`COALESCE(${policies.updatedAt}, ${policies.createdAt}) = ${cursorUpdatedAt}`,
            or(
              // effectiveDate is less than cursor (DESC order)
              sql`${policies.effectiveDate}::date < ${cursorDate}::date`,
              // effectiveDate equals cursor, check id
              and(
                sql`${policies.effectiveDate}::date = ${cursorDate}::date`,
                lt(policies.id, cursorId)
              )
            ) as any
          ) as any
        ) as any
      );
    }
    
    // Create agent alias for join
    const agent = alias(users, 'agent');
    
    // Define the computed field for ordering (needed for DISTINCT with ORDER BY)
    const updatedOrCreatedExpr = sql<Date>`COALESCE(${policies.updatedAt}, ${policies.createdAt})`;
    
    // Build base query
    let query = db
      .selectDistinct({
        id: policies.id,
        companyId: policies.companyId,
        effectiveDate: policies.effectiveDate,
        productType: policies.productType,
        status: policies.status,
        documentsStatus: policies.documentsStatus,
        paymentStatus: policies.paymentStatus,
        clientFirstName: policies.clientFirstName,
        clientMiddleName: policies.clientMiddleName,
        clientLastName: policies.clientLastName,
        clientSecondLastName: policies.clientSecondLastName,
        clientEmail: policies.clientEmail,
        clientPhone: policies.clientPhone,
        clientDateOfBirth: policies.clientDateOfBirth,
        clientGender: policies.clientGender,
        clientSsn: policies.clientSsn,
        clientIsApplicant: policies.clientIsApplicant,
        physical_city: policies.physical_city,
        physical_state: policies.physical_state,
        physical_postal_code: policies.physical_postal_code,
        selectedPlan: policies.selectedPlan,
        primaryPlanData: policyPlans.planData,
        agentId: policies.agentId,
        agentFirstName: agent.firstName,
        agentLastName: agent.lastName,
        isArchived: policies.isArchived,
        createdAt: policies.createdAt,
        updatedAt: policies.updatedAt,
        updatedOrCreated: updatedOrCreatedExpr,
      })
      .from(policies)
      .leftJoin(agent, eq(policies.agentId, agent.id))
      .leftJoin(policyPlans, and(
        eq(policyPlans.policyId, policies.id),
        eq(policyPlans.isPrimary, true)
      ))
      .leftJoin(policyFolderAssignments, eq(policyFolderAssignments.policyId, policies.id));
    
    // Add LEFT JOIN with policy_members if searching family members
    if (options?.includeFamilyMembers && options?.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      const searchPattern = `%${searchLower}%`;
      
      query = query
        .leftJoin(policyMembers, eq(policyMembers.policyId, policies.id))
        .where(and(
          ...conditions,
          or(
            // Client fields
            sql`LOWER(CONCAT(${policies.clientFirstName}, ' ', COALESCE(${policies.clientMiddleName}, ''), ' ', ${policies.clientLastName}, ' ', COALESCE(${policies.clientSecondLastName}, ''))) LIKE ${searchPattern}`,
            sql`LOWER(${policies.clientEmail}) LIKE ${searchPattern}`,
            sql`${policies.clientPhone} LIKE ${searchPattern}`,
            // Family member fields
            sql`LOWER(CONCAT(${policyMembers.firstName}, ' ', COALESCE(${policyMembers.middleName}, ''), ' ', ${policyMembers.lastName}, ' ', COALESCE(${policyMembers.secondLastName}, ''))) LIKE ${searchPattern}`,
            sql`LOWER(${policyMembers.email}) LIKE ${searchPattern}`,
            sql`${policyMembers.phone} LIKE ${searchPattern}`
          ) as any
        )) as any;
    } else {
      query = query.where(and(...conditions)) as any;
    }
    
    // Execute query with ordering and limit
    // Order by most recently edited policies first (updatedAt DESC)
    // Fallback to effectiveDate for policies with same updatedAt or NULL updatedAt
    const results = await query
      .orderBy(
        desc(updatedOrCreatedExpr),
        sql`${policies.effectiveDate}::date DESC`,
        desc(policies.id)
      )
      .limit(limit + 1); // Fetch one extra to determine if there's a next page
    
    // Determine if there are more results
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    
    // Generate next cursor (format: "updatedAt,effectiveDate,id")
    let nextCursor: string | null = null;
    if (hasMore) {
      const lastItem = items[items.length - 1];
      const updatedAtTimestamp = lastItem.updatedAt || lastItem.createdAt;
      nextCursor = `${updatedAtTimestamp.toISOString()},${lastItem.effectiveDate},${lastItem.id}`;
    }
    
    // Format results
    const formattedItems = items.map(item => ({
      id: item.id,
      companyId: item.companyId,
      effectiveDate: item.effectiveDate,
      productType: item.productType,
      status: item.status,
      documentsStatus: item.documentsStatus,
      paymentStatus: item.paymentStatus,
      clientFirstName: item.clientFirstName,
      clientMiddleName: item.clientMiddleName,
      clientLastName: item.clientLastName,
      clientSecondLastName: item.clientSecondLastName,
      clientEmail: item.clientEmail,
      clientPhone: item.clientPhone,
      clientDateOfBirth: item.clientDateOfBirth,
      clientGender: item.clientGender,
      clientSsn: item.clientSsn,
      clientIsApplicant: item.clientIsApplicant,
      physical_city: item.physical_city,
      physical_state: item.physical_state,
      physical_postal_code: item.physical_postal_code,
      // Use primaryPlanData from policy_plans if selectedPlan is null (legacy field)
      selectedPlan: item.selectedPlan || item.primaryPlanData || null,
      agentId: item.agentId,
      agentName: item.agentFirstName && item.agentLastName 
        ? `${item.agentFirstName} ${item.agentLastName}`.trim()
        : null,
      isArchived: item.isArchived,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    
    return {
      items: formattedItems,
      nextCursor,
    };
  }

  async getPoliciesByAgent(agentId: string): Promise<Array<Policy & {
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>> {
    const results = await db
      .select({
        policy: policies,
        creator: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(policies)
      .leftJoin(users, eq(policies.createdBy, users.id))
      .where(eq(policies.agentId, agentId))
      .orderBy(desc(policies.createdAt));

    return results.map((result) => ({
      ...result.policy,
      creator: result.creator,
    })) as any;
  }

  async getPoliciesByApplicant(companyId: string, ssn?: string | null, email?: string | null, firstName?: string | null, lastName?: string | null, dob?: string | null, effectiveYear?: number): Promise<Array<Policy & {
    agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
    creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
  }>> {
    // Build identity key using same logic as resolveApplicantIdentity
    const normalizedSsn = ssn?.replace(/\D/g, '') || '';
    const normalizedEmail = email?.toLowerCase() || '';
    
    let identityConditions: any[] = [];
    
    // SSN matching - REQUIRE EXACTLY 9 DIGITS (full SSN only)
    if (normalizedSsn.length === 9) {
      identityConditions.push(
        sql`REPLACE(REPLACE(REPLACE(${policies.clientSsn}, '-', ''), ' ', ''), '.', '') = ${normalizedSsn}`
      );
    } else if (normalizedEmail) {
      // Email fallback if SSN is not complete
      identityConditions.push(
        sql`LOWER(${policies.clientEmail}) = ${normalizedEmail}`
      );
    }
    
    // If no valid identifier, return empty
    if (identityConditions.length === 0) {
      return [];
    }
    
    const conditions: any[] = [
      eq(policies.companyId, companyId),
      or(...identityConditions)
    ];
    
    // Filter by primary applicant name and DOB to ensure only policies 
    // where this person is the primary applicant (not a dependent)
    if (firstName) {
      conditions.push(eq(policies.clientFirstName, firstName));
    }
    if (lastName) {
      conditions.push(eq(policies.clientLastName, lastName));
    }
    if (dob) {
      conditions.push(eq(policies.clientDateOfBirth, dob));
    }
    
    if (effectiveYear) {
      conditions.push(sql`EXTRACT(YEAR FROM ${policies.effectiveDate}) = ${effectiveYear}`);
    }
    
    // Create aliases for the users table to join it twice
    const creatorUser = alias(users, 'creatorUser');
    const agentUser = alias(users, 'agentUser');
    
    const results = await db
      .select({
        policy: policies,
        primaryPlanData: policyPlans.planData,
        creator: {
          id: creatorUser.id,
          firstName: creatorUser.firstName,
          lastName: creatorUser.lastName,
          email: creatorUser.email,
        },
        agent: {
          id: agentUser.id,
          firstName: agentUser.firstName,
          lastName: agentUser.lastName,
          email: agentUser.email,
        },
      })
      .from(policies)
      .leftJoin(creatorUser, eq(policies.createdBy, creatorUser.id))
      .leftJoin(agentUser, eq(policies.agentId, agentUser.id))
      .leftJoin(policyPlans, and(
        eq(policyPlans.policyId, policies.id),
        eq(policyPlans.isPrimary, true)
      ))
      .where(and(...conditions))
      .orderBy(desc(policies.effectiveDate), desc(policies.createdAt));

    return results.map((result) => ({
      ...result.policy,
      // Use primaryPlanData from policy_plans if selectedPlan is null (legacy field)
      selectedPlan: result.policy.selectedPlan || result.primaryPlanData || null,
      creator: result.creator,
      agent: result.agent.id ? result.agent : null,
    })) as any;
  }

  async updatePolicy(id: string, data: Partial<InsertPolicy>): Promise<Policy | undefined> {
    const [updated] = await db
      .update(policies)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, id))
      .returning();
    return updated;
  }

  async updatePolicySelectedPlan(id: string, selectedPlan: any, aptcData?: { aptcAmount?: string; aptcSource?: string; aptcCapturedAt?: string }): Promise<Policy | undefined> {
    const updateData: any = {
      selectedPlan,
      updatedAt: new Date(),
    };
    
    // Add APTC data if provided
    if (aptcData) {
      if (aptcData.aptcAmount !== undefined) updateData.aptcAmount = aptcData.aptcAmount;
      if (aptcData.aptcSource !== undefined) updateData.aptcSource = aptcData.aptcSource;
      if (aptcData.aptcCapturedAt !== undefined) updateData.aptcCapturedAt = aptcData.aptcCapturedAt;
    }
    
    const [updated] = await db
      .update(policies)
      .set(updateData)
      .where(eq(policies.id, id))
      .returning();
    return updated;
  }

  async deletePolicy(id: string): Promise<boolean> {
    const result = await db
      .delete(policies)
      .where(eq(policies.id, id))
      .returning();
    return result.length > 0;
  }
  
  async getUniquePolicyHolders(companyId: string, filters?: { agentId?: string; effectiveYear?: number; carrier?: string; status?: string; state?: string }): Promise<{ count: number; uniqueIdentifiers: Map<string, { policyIds: string[]; identifier: string; identifierType: 'ssn' | 'email' | 'name-dob' }> }> {
    // Build query conditions for policies
    const conditions = [eq(policies.companyId, companyId)];
    
    if (filters?.agentId) {
      conditions.push(eq(policies.agentId, filters.agentId));
    }
    if (filters?.effectiveYear) {
      const startDate = `${filters.effectiveYear}-01-01`;
      const endDate = `${filters.effectiveYear + 1}-01-01`;
      conditions.push(
        and(
          gte(policies.effectiveDate, startDate),
          sql`${policies.effectiveDate} < ${endDate}`
        )!
      );
    }
    if (filters?.status) {
      conditions.push(eq(policies.status, filters.status));
    }
    if (filters?.state) {
      conditions.push(eq(policies.physical_state, filters.state));
    }
    
    // Fetch all policies with their members for the company (with filters applied)
    const allPolicies = await db
      .select()
      .from(policies)
      .where(and(...conditions));
    
    // If carrier filter is provided, filter by selected plan carrier
    let filteredPolicies = allPolicies;
    if (filters?.carrier) {
      filteredPolicies = allPolicies.filter(p => {
        if (p.selectedPlan && typeof p.selectedPlan === 'object') {
          const plan: any = p.selectedPlan;
          const planCarrier = (plan.issuer?.name || plan.carrier || '').toLowerCase();
          return planCarrier.includes(filters.carrier!.toLowerCase());
        }
        return false;
      });
    }
    
    // Fetch all policy members for these policies in one query
    const policyIds = filteredPolicies.map(p => p.id);
    let allMembers: any[] = [];
    
    if (policyIds.length > 0) {
      allMembers = await db
        .select()
        .from(policyMembers)
        .where(
          and(
            eq(policyMembers.companyId, companyId),
            inArray(policyMembers.policyId, policyIds)
          )
        );
    }
    
    // Helper function to normalize name (remove accents, trim, uppercase)
    function normalizeName(name: string | null): string {
      if (!name) return '';
      return name
        .normalize('NFD') // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .trim()
        .toUpperCase();
    }
    
    // Helper function to normalize SSN (trim, uppercase, remove dashes/spaces)
    function normalizeSSN(ssn: string | null): string {
      if (!ssn) return '';
      return ssn.replace(/[-\s]/g, '').trim().toUpperCase();
    }
    
    // Helper function to normalize email (lowercase, trim)
    function normalizeEmail(email: string | null): string {
      if (!email) return '';
      return email.trim().toLowerCase();
    }
    
    // Deduplication map: uniqueIdentifier -> policy IDs
    const uniqueIdentifiers = new Map<string, { policyIds: string[]; identifier: string; identifierType: 'ssn' | 'email' | 'name-dob' }>();
    
    // Process each policy
    for (const policy of filteredPolicies) {
      let uniqueKey: string | null = null;
      let identifierType: 'ssn' | 'email' | 'name-dob' = 'name-dob';
      let identifier = '';
      
      // Check policy members for this policy (applicant = primary identifier)
      const policyMembersList = allMembers.filter(m => m.policyId === policy.id);
      
      // Find applicant member or use first member
      let primaryMember = policyMembersList.find(m => m.isApplicant) || policyMembersList[0];
      
      // If no members, use client data from policy
      if (!primaryMember) {
        // Priority 1: SSN
        if (policy.clientSsn) {
          const normalizedSSN = normalizeSSN(policy.clientSsn);
          if (normalizedSSN) {
            uniqueKey = `ssn:${normalizedSSN}`;
            identifierType = 'ssn';
            identifier = normalizedSSN;
          }
        }
        
        // Priority 2: Email (if no SSN)
        if (!uniqueKey && policy.clientEmail) {
          const normalizedEmail = normalizeEmail(policy.clientEmail);
          if (normalizedEmail) {
            uniqueKey = `email:${normalizedEmail}`;
            identifierType = 'email';
            identifier = normalizedEmail;
          }
        }
        
        // Priority 3: Full name + DOB (if no SSN or email)
        if (!uniqueKey) {
          const firstName = normalizeName(policy.clientFirstName);
          const lastName = normalizeName(policy.clientLastName);
          const dob = policy.clientDateOfBirth || '';
          if (firstName && lastName) {
            uniqueKey = `name-dob:${firstName}:${lastName}:${dob}`;
            identifierType = 'name-dob';
            identifier = `${firstName} ${lastName} (${dob || 'no DOB'})`;
          }
        }
      } else {
        // Use primary member data
        // Priority 1: SSN
        if (primaryMember.ssn) {
          const normalizedSSN = normalizeSSN(primaryMember.ssn);
          if (normalizedSSN) {
            uniqueKey = `ssn:${normalizedSSN}`;
            identifierType = 'ssn';
            identifier = normalizedSSN;
          }
        }
        
        // Priority 2: Email (if no SSN)
        if (!uniqueKey && primaryMember.email) {
          const normalizedEmail = normalizeEmail(primaryMember.email);
          if (normalizedEmail) {
            uniqueKey = `email:${normalizedEmail}`;
            identifierType = 'email';
            identifier = normalizedEmail;
          }
        }
        
        // Priority 3: Full name + DOB (if no SSN or email)
        if (!uniqueKey) {
          const firstName = normalizeName(primaryMember.firstName);
          const lastName = normalizeName(primaryMember.lastName);
          const dob = primaryMember.dateOfBirth || '';
          if (firstName && lastName) {
            uniqueKey = `name-dob:${firstName}:${lastName}:${dob}`;
            identifierType = 'name-dob';
            identifier = `${firstName} ${lastName} (${dob || 'no DOB'})`;
          }
        }
      }
      
      // If we found a unique key, add it to the map
      if (uniqueKey) {
        if (uniqueIdentifiers.has(uniqueKey)) {
          // Add this policy ID to existing entry
          uniqueIdentifiers.get(uniqueKey)!.policyIds.push(policy.id);
        } else {
          // Create new entry
          uniqueIdentifiers.set(uniqueKey, {
            policyIds: [policy.id],
            identifier,
            identifierType
          });
        }
      }
    }
    
    return {
      count: uniqueIdentifiers.size,
      uniqueIdentifiers
    };
  }
  
  async submitQuoteAsPolicy(quoteId: string): Promise<Policy> {
    // NOTE: Neon HTTP driver does not support transactions
    // We do this sequentially without transaction for compatibility
    
    // 1. Get quote and all child records
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!quote) {
      throw new Error("Quote not found");
    }
    
    const members = await db.select().from(quoteMembers).where(eq(quoteMembers.quoteId, quoteId));
    const notes = await db.select().from(quoteNotes).where(eq(quoteNotes.quoteId, quoteId));
    const documents = await db.select().from(quoteDocuments).where(eq(quoteDocuments.quoteId, quoteId));
    const paymentMethods = await db.select().from(quotePaymentMethods).where(eq(quotePaymentMethods.quoteId, quoteId));
    const reminders = await db.select().from(quoteReminders).where(eq(quoteReminders.quoteId, quoteId));
    const consents = await db.select().from(consentDocuments).where(eq(consentDocuments.quoteId, quoteId));
    
    // 2. Generate policy ID
    const { generateShortId } = await import("./id-generator");
    let policyId: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      policyId = generateShortId();
      const existing = await db.select().from(policies).where(eq(policies.id, policyId)).limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique policy ID");
    }
    
    // 3. Insert into policy table
    const [newPolicy] = await db
        .insert(policies)
        .values({
          id: policyId,
          companyId: quote.companyId,
          createdBy: quote.createdBy,
          effectiveDate: quote.effectiveDate,
          agentId: quote.agentId,
          productType: quote.productType,
          clientFirstName: quote.clientFirstName,
          clientMiddleName: quote.clientMiddleName,
          clientLastName: quote.clientLastName,
          clientSecondLastName: quote.clientSecondLastName,
          clientEmail: quote.clientEmail,
          clientPhone: quote.clientPhone,
          clientDateOfBirth: quote.clientDateOfBirth,
          clientGender: quote.clientGender,
          clientIsApplicant: quote.clientIsApplicant,
          clientTobaccoUser: quote.clientTobaccoUser,
          clientPregnant: quote.clientPregnant,
          clientSsn: quote.clientSsn,
          clientPreferredLanguage: quote.clientPreferredLanguage,
          clientCountryOfBirth: quote.clientCountryOfBirth,
          clientMaritalStatus: quote.clientMaritalStatus,
          clientWeight: quote.clientWeight,
          clientHeight: quote.clientHeight,
          annualHouseholdIncome: quote.annualHouseholdIncome,
          familyGroupSize: quote.familyGroupSize,
          spouses: quote.spouses,
          dependents: quote.dependents,
          physical_street: quote.physical_street,
          physical_address_line_2: quote.physical_address_line_2,
          physical_city: quote.physical_city,
          physical_state: quote.physical_state,
          physical_postal_code: quote.physical_postal_code,
          physical_county: quote.physical_county,
          mailing_street: quote.mailing_street,
          mailing_address_line_2: quote.mailing_address_line_2,
          mailing_city: quote.mailing_city,
          mailing_state: quote.mailing_state,
          mailing_postal_code: quote.mailing_postal_code,
          mailing_county: quote.mailing_county,
          billing_street: quote.billing_street,
          billing_address_line_2: quote.billing_address_line_2,
          billing_city: quote.billing_city,
          billing_state: quote.billing_state,
          billing_postal_code: quote.billing_postal_code,
          billing_county: quote.billing_county,
          selectedCarrier: quote.selectedCarrier,
          selectedPlan: quote.selectedPlan,
          planDetails: quote.planDetails,
          cmsApplicationId: quote.cmsApplicationId,
          cmsEligibilityResults: quote.cmsEligibilityResults,
          status: quote.status,
        } as any)
        .returning();
      
      // 4. Create member ID mapping and insert members
      const memberIdMap = new Map<string, string>();
      
      for (const member of members) {
        const [newMember] = await db
          .insert(policyMembers)
          .values({
            companyId: member.companyId,
            policyId: policyId,
            role: member.role,
            firstName: member.firstName,
            middleName: member.middleName,
            lastName: member.lastName,
            secondLastName: member.secondLastName,
            dateOfBirth: member.dateOfBirth,
            ssn: member.ssn,
            gender: member.gender,
            phone: member.phone,
            email: member.email,
            isApplicant: member.isApplicant,
            isPrimaryDependent: member.isPrimaryDependent,
            tobaccoUser: member.tobaccoUser,
            pregnant: member.pregnant,
            preferredLanguage: member.preferredLanguage,
            countryOfBirth: member.countryOfBirth,
            maritalStatus: member.maritalStatus,
            weight: member.weight,
            height: member.height,
            relation: member.relation,
          } as any)
          .returning();
        
        // Store mapping: old quote member ID -> new policy member ID
        memberIdMap.set(member.id, newMember.id);
        
        // Copy member income
        const [income] = await db.select().from(quoteMemberIncome).where(eq(quoteMemberIncome.memberId, member.id));
        if (income) {
          await db.insert(policyMemberIncome).values({
            companyId: income.companyId,
            memberId: newMember.id,
            employmentStatus: income.employmentStatus,
            employerName: income.employerName,
            jobTitle: income.jobTitle,
            annualIncome: income.annualIncome,
            incomeFrequency: income.incomeFrequency,
            totalAnnualIncome: income.totalAnnualIncome,
            payFrequency: income.payFrequency,
            hoursPerWeek: income.hoursPerWeek,
            selfEmployed: income.selfEmployed,
            businessName: income.businessName,
            businessType: income.businessType,
            otherIncomeType: income.otherIncomeType,
            otherIncomeAmount: income.otherIncomeAmount,
            otherIncomeFrequency: income.otherIncomeFrequency,
          } as any);
        }
        
        // Copy member immigration
        const [immigration] = await db.select().from(quoteMemberImmigration).where(eq(quoteMemberImmigration.memberId, member.id));
        if (immigration) {
          await db.insert(policyMemberImmigration).values({
            companyId: immigration.companyId,
            memberId: newMember.id,
            citizenshipStatus: immigration.citizenshipStatus,
            immigrationStatus: immigration.immigrationStatus,
            alienNumber: immigration.alienNumber,
            i94Number: immigration.i94Number,
            visaNumber: immigration.visaNumber,
            passportNumber: immigration.passportNumber,
            passportCountry: immigration.passportCountry,
            sevisId: immigration.sevisId,
            categoryCode: immigration.categoryCode,
            countryOfIssuance: immigration.countryOfIssuance,
            cardNumber: immigration.cardNumber,
            expirationDate: immigration.expirationDate,
            naturalizationNumber: immigration.naturalizationNumber,
            citizenshipNumber: immigration.citizenshipNumber,
            documentDescription: immigration.documentDescription,
          } as any);
        }
        
        // Copy member documents
        const memberDocs = await db.select().from(quoteMemberDocuments).where(eq(quoteMemberDocuments.memberId, member.id));
        for (const doc of memberDocs) {
          await db.insert(policyMemberDocuments).values({
            companyId: doc.companyId,
            memberId: newMember.id,
            documentType: doc.documentType,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            fileUrl: doc.fileUrl,
          } as any);
        }
      }
      
      // 5. Insert notes
      for (const note of notes) {
        await db.insert(policyNotes).values({
          policyId: policyId,
          companyId: note.companyId,
          createdBy: note.createdBy,
          note: note.note,
          attachments: note.attachments,
          isImportant: note.isImportant,
          isPinned: note.isPinned,
          isResolved: note.isResolved,
        } as any);
      }
      
      // 6. Insert documents (using member ID mapping)
      for (const doc of documents) {
        await db.insert(policyDocuments).values({
          policyId: policyId,
          companyId: doc.companyId,
          uploadedBy: doc.uploadedBy,
          category: doc.category,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          fileType: doc.fileType,
          fileUrl: doc.fileUrl,
          belongsTo: doc.belongsTo ? (memberIdMap.get(doc.belongsTo) || null) : null,
          description: doc.description,
        } as any);
      }
      
      // 7. Insert payment methods
      for (const payment of paymentMethods) {
        await db.insert(policyPaymentMethods).values({
          policyId: policyId,
          companyId: payment.companyId,
          paymentType: payment.paymentType,
          accountHolderName: payment.accountHolderName,
          routingNumber: payment.routingNumber,
          accountNumber: payment.accountNumber,
          accountType: payment.accountType,
          bankName: payment.bankName,
          cardNumber: payment.cardNumber,
          cardType: payment.cardType,
          expiryMonth: payment.expiryMonth,
          expiryYear: payment.expiryYear,
          cvv: payment.cvv,
          billingZipCode: payment.billingZipCode,
          isDefault: payment.isDefault,
        } as any);
      }
      
      // 8. Insert reminders
      for (const reminder of reminders) {
        await db.insert(policyReminders).values({
          policyId: policyId,
          companyId: reminder.companyId,
          createdBy: reminder.createdBy,
          dueDate: reminder.dueDate,
          dueTime: reminder.dueTime,
          timezone: reminder.timezone,
          reminderBefore: reminder.reminderBefore,
          reminderType: reminder.reminderType,
          notifyUsers: reminder.notifyUsers,
          title: reminder.title,
          description: reminder.description,
          isPrivate: reminder.isPrivate,
          status: reminder.status,
          priority: reminder.priority,
          completedAt: reminder.completedAt,
          completedBy: reminder.completedBy,
          snoozedUntil: reminder.snoozedUntil,
        } as any);
      }
      
      // 9. Insert consents
      for (const consent of consents) {
        await db.insert(policyConsentDocuments).values({
          policyId: policyId,
          companyId: consent.companyId,
          token: consent.token,
          status: consent.status,
          deliveryChannel: consent.deliveryChannel,
          deliveryTarget: consent.deliveryTarget,
          signedByName: consent.signedByName,
          signedByEmail: consent.signedByEmail,
          signedByPhone: consent.signedByPhone,
          signatureImage: consent.signatureImage,
          signerIp: consent.signerIp,
          signerUserAgent: consent.signerUserAgent,
          signerTimezone: consent.signerTimezone,
          signerLocation: consent.signerLocation,
          signerPlatform: consent.signerPlatform,
          signerBrowser: consent.signerBrowser,
          sentAt: consent.sentAt,
          viewedAt: consent.viewedAt,
          signedAt: consent.signedAt,
          expiresAt: consent.expiresAt,
          createdBy: consent.createdBy,
        } as any);
      }
      
      // 10. Delete quote and all related records (cascade will handle child records)
      await db.delete(quotes).where(eq(quotes.id, quoteId));
      
      return newPolicy;
  }
  
  // ==================== POLICY MEMBERS ====================
  
  async getPolicyMembersByPolicyId(policyId: string, companyId: string): Promise<PolicyMember[]> {
    return db
      .select()
      .from(policyMembers)
      .where(
        and(
          eq(policyMembers.policyId, policyId),
          eq(policyMembers.companyId, companyId)
        )
      )
      .orderBy(policyMembers.createdAt);
  }
  
  async getPolicyMemberById(memberId: string, companyId: string): Promise<PolicyMember | null> {
    const [member] = await db
      .select()
      .from(policyMembers)
      .where(
        and(
          eq(policyMembers.id, memberId),
          eq(policyMembers.companyId, companyId)
        )
      );
    return member || null;
  }
  
  async createPolicyMember(data: InsertPolicyMember): Promise<PolicyMember> {
    const [member] = await db
      .insert(policyMembers)
      .values(data)
      .returning();
    return member;
  }
  
  async updatePolicyMember(memberId: string, data: UpdatePolicyMember, companyId: string): Promise<PolicyMember | null> {
    const [updated] = await db
      .update(policyMembers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(policyMembers.id, memberId),
          eq(policyMembers.companyId, companyId)
        )
      )
      .returning();
    return updated || null;
  }
  
  async deletePolicyMember(memberId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyMembers)
      .where(
        and(
          eq(policyMembers.id, memberId),
          eq(policyMembers.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  async ensurePolicyMember(
    policyId: string,
    companyId: string,
    role: string,
    memberData: Partial<InsertPolicyMember>
  ): Promise<{ member: PolicyMember; wasCreated: boolean }> {
    // Only update if we can definitively identify the same person
    // Require either REAL SSN OR complete name+DOB match to prevent overwriting different people
    let existingMember: PolicyMember | undefined;
    
    // Match by SSN (most reliable identifier) - but only if it's a real SSN, not a placeholder
    // Exclude common placeholder values like "000-00-0000", "999-99-9999", etc.
    const isRealSSN = memberData.ssn && 
                      memberData.ssn !== '000-00-0000' && 
                      memberData.ssn !== '999-99-9999' &&
                      !memberData.ssn.startsWith('000-') &&
                      !memberData.ssn.startsWith('999-');
    
    if (isRealSSN) {
      const members = await db
        .select()
        .from(policyMembers)
        .where(
          and(
            eq(policyMembers.policyId, policyId),
            eq(policyMembers.companyId, companyId),
            eq(policyMembers.role, role),
            eq(policyMembers.ssn, memberData.ssn)
          )
        );
      existingMember = members[0];
    }
    
    // Match by complete name AND date of birth (all three must be present and match)
    // Use case-insensitive comparison to avoid duplicates like "ALFREDO" vs "Alfredo"
    // If any field is missing, we can't be sure it's the same person, so create new member
    if (!existingMember && memberData.firstName && memberData.lastName && memberData.dateOfBirth) {
      const members = await db
        .select()
        .from(policyMembers)
        .where(
          and(
            eq(policyMembers.policyId, policyId),
            eq(policyMembers.companyId, companyId),
            eq(policyMembers.role, role),
            sql`LOWER(${policyMembers.firstName}) = LOWER(${memberData.firstName})`,
            sql`LOWER(${policyMembers.lastName}) = LOWER(${memberData.lastName})`,
            eq(policyMembers.dateOfBirth, memberData.dateOfBirth)
          )
        );
      existingMember = members[0];
    }
    
    // If no clear match found, always create new member to prevent data loss
    
    if (existingMember) {
      // Update existing member
      const [updated] = await db
        .update(policyMembers)
        .set({
          ...memberData,
          updatedAt: new Date(),
        })
        .where(eq(policyMembers.id, existingMember.id))
        .returning();
      return { member: updated, wasCreated: false };
    } else {
      // Create new member
      const [created] = await db
        .insert(policyMembers)
        .values({
          policyId,
          companyId,
          role,
          ...memberData,
        } as InsertPolicyMember)
        .returning();
      return { member: created, wasCreated: true };
    }
  }
  
  // ==================== POLICY MEMBER INCOME ====================
  
  async getPolicyMemberIncome(memberId: string, companyId: string): Promise<PolicyMemberIncome | null> {
    const [income] = await db
      .select()
      .from(policyMemberIncome)
      .where(
        and(
          eq(policyMemberIncome.memberId, memberId),
          eq(policyMemberIncome.companyId, companyId)
        )
      );
    return income || null;
  }
  
  async createOrUpdatePolicyMemberIncome(data: InsertPolicyMemberIncome): Promise<PolicyMemberIncome> {
    // Filter out null/undefined values to prevent overwriting existing data with nulls
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null && value !== undefined)
    );
    
    const [result] = await db
      .insert(policyMemberIncome)
      .values(data)
      .onConflictDoUpdate({
        target: policyMemberIncome.memberId,
        set: {
          ...updateData,  // Only update non-null fields
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return result;
  }
  
  async deletePolicyMemberIncome(memberId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyMemberIncome)
      .where(
        and(
          eq(policyMemberIncome.memberId, memberId),
          eq(policyMemberIncome.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== POLICY MEMBER IMMIGRATION ====================
  
  async getPolicyMemberImmigration(memberId: string, companyId: string): Promise<PolicyMemberImmigration | null> {
    const [immigration] = await db
      .select()
      .from(policyMemberImmigration)
      .where(
        and(
          eq(policyMemberImmigration.memberId, memberId),
          eq(policyMemberImmigration.companyId, companyId)
        )
      );
    return immigration || null;
  }
  
  async createOrUpdatePolicyMemberImmigration(data: InsertPolicyMemberImmigration): Promise<PolicyMemberImmigration> {
    // Filter out null/undefined values
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== null && value !== undefined)
    );
    
    const [result] = await db
      .insert(policyMemberImmigration)
      .values(data)
      .onConflictDoUpdate({
        target: policyMemberImmigration.memberId,
        set: {
          ...updateData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return result;
  }
  
  async deletePolicyMemberImmigration(memberId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyMemberImmigration)
      .where(
        and(
          eq(policyMemberImmigration.memberId, memberId),
          eq(policyMemberImmigration.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== POLICY MEMBER DOCUMENTS ====================
  
  async getPolicyMemberDocuments(memberId: string, companyId: string): Promise<PolicyMemberDocument[]> {
    return db
      .select()
      .from(policyMemberDocuments)
      .where(
        and(
          eq(policyMemberDocuments.memberId, memberId),
          eq(policyMemberDocuments.companyId, companyId)
        )
      )
      .orderBy(desc(policyMemberDocuments.uploadedAt));
  }
  
  async getPolicyMemberDocumentById(documentId: string, companyId: string): Promise<PolicyMemberDocument | null> {
    const [document] = await db
      .select()
      .from(policyMemberDocuments)
      .where(
        and(
          eq(policyMemberDocuments.id, documentId),
          eq(policyMemberDocuments.companyId, companyId)
        )
      );
    return document || null;
  }
  
  async createPolicyMemberDocument(data: InsertPolicyMemberDocument): Promise<PolicyMemberDocument> {
    const [document] = await db
      .insert(policyMemberDocuments)
      .values(data)
      .returning();
    return document;
  }
  
  async deletePolicyMemberDocument(documentId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyMemberDocuments)
      .where(
        and(
          eq(policyMemberDocuments.id, documentId),
          eq(policyMemberDocuments.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== CANONICAL CLIENT IDENTITY ====================
  
  private resolveApplicantIdentity(policy: { clientSsn: string | null; clientEmail: string | null }): string | null {
    // Normalize SSN: remove all non-digits
    const normalizedSsn = policy.clientSsn?.replace(/\D/g, '') || '';
    
    // SSN is primary identifier - REQUIRE EXACTLY 9 DIGITS (full SSN only)
    if (normalizedSsn.length === 9) {
      return `ssn:${normalizedSsn}`;
    }
    
    // Email is fallback (normalize to lowercase)
    if (policy.clientEmail) {
      return `email:${policy.clientEmail.toLowerCase()}`;
    }
    
    // No valid identifier - policy remains isolated
    return null;
  }
  
  async getCanonicalPolicyIds(policyId: string, limit: number = 20): Promise<string[]> {
    // Get the current policy
    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, policyId));
    
    if (!policy) {
      return [policyId];
    }
    
    // Use same logic as getPoliciesByApplicant to find all policies of the same client
    const normalizedSsn = policy.clientSsn?.replace(/\D/g, '') || '';
    const normalizedEmail = policy.clientEmail?.toLowerCase() || '';
    
    let identityConditions: any[] = [];
    
    // SSN matching - REQUIRE EXACTLY 9 DIGITS (full SSN only)
    if (normalizedSsn.length === 9) {
      identityConditions.push(
        sql`REPLACE(REPLACE(REPLACE(${policies.clientSsn}, '-', ''), ' ', ''), '.', '') = ${normalizedSsn}`
      );
    } else if (normalizedEmail) {
      // Email fallback if SSN is not complete
      identityConditions.push(
        sql`LOWER(${policies.clientEmail}) = ${normalizedEmail}`
      );
    }
    
    // If no valid identifier, return only current policy
    if (identityConditions.length === 0) {
      return [policyId];
    }
    
    const conditions: any[] = [
      eq(policies.companyId, policy.companyId),
      or(...identityConditions)
    ];
    
    // Filter by primary applicant name and DOB to ensure only policies 
    // where this person is the primary applicant (not a dependent)
    if (policy.clientFirstName) {
      conditions.push(eq(policies.clientFirstName, policy.clientFirstName));
    }
    if (policy.clientLastName) {
      conditions.push(eq(policies.clientLastName, policy.clientLastName));
    }
    if (policy.clientDateOfBirth) {
      conditions.push(eq(policies.clientDateOfBirth, policy.clientDateOfBirth));
    }
    
    // Get all policies ordered by effectiveDate DESC, with soft limit
    const clientPolicies = await db
      .select({ id: policies.id })
      .from(policies)
      .where(and(...conditions))
      .orderBy(desc(policies.effectiveDate), desc(policies.createdAt))
      .limit(limit);
    
    return clientPolicies.map(p => p.id);
  }
  
  // ==================== POLICY PAYMENT METHODS ====================
  
  async getPolicyPaymentMethods(policyIds: string | string[], companyId: string): Promise<PolicyPaymentMethod[]> {
    // Support both single policyId and array of policyIds for cross-policy sharing
    const idsArray = Array.isArray(policyIds) ? policyIds : [policyIds];
    
    if (idsArray.length === 0) {
      return [];
    }
    
    return db
      .select()
      .from(policyPaymentMethods)
      .where(
        and(
          inArray(policyPaymentMethods.policyId, idsArray),
          eq(policyPaymentMethods.companyId, companyId)
        )
      )
      .orderBy(desc(policyPaymentMethods.isDefault), desc(policyPaymentMethods.createdAt));
  }
  
  async getPolicyPaymentMethodById(paymentMethodId: string, companyId: string): Promise<PolicyPaymentMethod | null> {
    const [method] = await db
      .select()
      .from(policyPaymentMethods)
      .where(
        and(
          eq(policyPaymentMethods.id, paymentMethodId),
          eq(policyPaymentMethods.companyId, companyId)
        )
      );
    return method || null;
  }
  
  async createPolicyPaymentMethod(data: InsertPolicyPaymentMethod): Promise<PolicyPaymentMethod> {
    const [method] = await db
      .insert(policyPaymentMethods)
      .values(data)
      .returning();
    return method;
  }
  
  async updatePolicyPaymentMethod(paymentMethodId: string, data: UpdatePolicyPaymentMethod, companyId: string): Promise<PolicyPaymentMethod | null> {
    const [updated] = await db
      .update(policyPaymentMethods)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(policyPaymentMethods.id, paymentMethodId),
          eq(policyPaymentMethods.companyId, companyId)
        )
      )
      .returning();
    return updated || null;
  }
  
  async deletePolicyPaymentMethod(paymentMethodId: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyPaymentMethods)
      .where(
        and(
          eq(policyPaymentMethods.id, paymentMethodId),
          eq(policyPaymentMethods.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  async setDefaultPolicyPaymentMethod(paymentMethodId: string, policyId: string, companyId: string): Promise<void> {
    // Get the current policy to identify the client
    const [policy] = await db
      .select({ clientSsn: policies.clientSsn, clientEmail: policies.clientEmail })
      .from(policies)
      .where(
        and(
          eq(policies.id, policyId),
          eq(policies.companyId, companyId)
        )
      );
    
    if (!policy) {
      return;
    }
    
    // Resolve canonical identity
    const identityKey = this.resolveApplicantIdentity(policy);
    
    // If no identity, only update payment methods for the current policy (isolated)
    if (!identityKey) {
      // Set all payment methods for this policy to non-default
      await db
        .update(policyPaymentMethods)
        .set({ isDefault: false })
        .where(
          and(
            eq(policyPaymentMethods.policyId, policyId),
            eq(policyPaymentMethods.companyId, companyId)
          )
        );
      
      // Then set the specified payment method as default
      await db
        .update(policyPaymentMethods)
        .set({ isDefault: true })
        .where(
          and(
            eq(policyPaymentMethods.id, paymentMethodId),
            eq(policyPaymentMethods.companyId, companyId)
          )
        );
      return;
    }
    
    // Find all policies with the same identity (same client)
    let clientPolicies: any[];
    
    if (identityKey.startsWith('ssn:')) {
      const ssnValue = identityKey.substring(4);
      // Match by normalized SSN
      clientPolicies = await db
        .select({ id: policies.id })
        .from(policies)
        .where(
          and(
            eq(policies.companyId, companyId),
            sql`REPLACE(REPLACE(REPLACE(${policies.clientSsn}, '-', ''), ' ', ''), '.', '') = ${ssnValue}`
          )
        );
    } else {
      // identityKey starts with 'email:'
      const emailValue = identityKey.substring(6);
      // Match by normalized email
      clientPolicies = await db
        .select({ id: policies.id })
        .from(policies)
        .where(
          and(
            eq(policies.companyId, companyId),
            sql`LOWER(${policies.clientEmail}) = ${emailValue}`
          )
        );
    }
    
    const policyIds = clientPolicies.map(p => p.id);
    
    if (policyIds.length === 0) {
      return;
    }
    
    // Verify the payment method belongs to one of the client's policies
    const [paymentMethod] = await db
      .select({ policyId: policyPaymentMethods.policyId })
      .from(policyPaymentMethods)
      .where(
        and(
          eq(policyPaymentMethods.id, paymentMethodId),
          eq(policyPaymentMethods.companyId, companyId)
        )
      );
    
    if (!paymentMethod || !policyIds.includes(paymentMethod.policyId)) {
      // Payment method doesn't belong to this client, abort
      return;
    }
    
    // First, set all payment methods for all client's policies to non-default
    await db
      .update(policyPaymentMethods)
      .set({ isDefault: false })
      .where(
        and(
          inArray(policyPaymentMethods.policyId, policyIds),
          eq(policyPaymentMethods.companyId, companyId)
        )
      );
    
    // Then, set the specified payment method as default
    await db
      .update(policyPaymentMethods)
      .set({ isDefault: true })
      .where(
        and(
          eq(policyPaymentMethods.id, paymentMethodId),
          eq(policyPaymentMethods.companyId, companyId)
        )
      );
  }
  
  // ==================== POLICY DOCUMENTS ====================
  
  async listPolicyDocuments(
    policyIds: string | string[],
    companyId: string,
    filters?: { category?: string; search?: string }
  ): Promise<Array<Omit<PolicyDocument, 'uploadedBy'> & { uploadedBy: { firstName: string | null; lastName: string | null } | null; belongsToMember: { firstName: string; lastName: string; role: string } | null }>> {
    // Support both single policyId and array of policyIds for cross-policy sharing
    const idsArray = Array.isArray(policyIds) ? policyIds : [policyIds];
    
    if (idsArray.length === 0) {
      return [];
    }
    
    let query = db
      .select({
        document: policyDocuments,
        uploader: {
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(policyDocuments)
      .leftJoin(users, eq(policyDocuments.uploadedBy, users.id))
      .where(
        and(
          inArray(policyDocuments.policyId, idsArray),
          eq(policyDocuments.companyId, companyId)
        )
      )
      .$dynamic();
    
    const results = await query.orderBy(desc(policyDocuments.createdAt));
    
    // Fetch member details for documents that belong to members
    const documentsWithDetails = await Promise.all(
      results.map(async (result) => {
        let belongsToMember = null;
        if (result.document.belongsTo) {
          const member = await this.getPolicyMemberById(result.document.belongsTo, companyId);
          if (member) {
            belongsToMember = {
              firstName: member.firstName,
              lastName: member.lastName,
              role: member.role,
            };
          }
        }
        
        return {
          ...result.document,
          uploadedBy: result.uploader,
          belongsToMember,
        };
      })
    );
    
    return documentsWithDetails;
  }
  
  async createPolicyDocument(document: InsertPolicyDocument): Promise<PolicyDocument> {
    const [created] = await db
      .insert(policyDocuments)
      .values(document)
      .returning();
    return created;
  }
  
  async getPolicyDocument(id: string, companyId: string): Promise<PolicyDocument | null> {
    const [document] = await db
      .select()
      .from(policyDocuments)
      .where(
        and(
          eq(policyDocuments.id, id),
          eq(policyDocuments.companyId, companyId)
        )
      );
    return document || null;
  }
  
  async deletePolicyDocument(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyDocuments)
      .where(
        and(
          eq(policyDocuments.id, id),
          eq(policyDocuments.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  // ==================== UNIFIED POLICY DETAIL ====================
  
  async getPolicyDetail(policyId: string, companyId: string): Promise<{
    policy: Policy & {
      agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
      creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
    };
    members: Array<{
      member: PolicyMember;
      income?: PolicyMemberIncome;
      immigration?: PolicyMemberImmigration;
      documents: PolicyMemberDocument[];
    }>;
    paymentMethods: PolicyPaymentMethod[];
    plans: PolicyPlan[];
    totalHouseholdIncome: number;
  }> {
    // Get policy with creator and agent info
    const policy = await this.getPolicy(policyId);
    if (!policy) {
      throw new Error("Policy not found");
    }
    
    // Get all members
    const members = await this.getPolicyMembersByPolicyId(policyId, companyId);
    
    // Get related data for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const [income, immigration, documents] = await Promise.all([
          this.getPolicyMemberIncome(member.id, companyId),
          this.getPolicyMemberImmigration(member.id, companyId),
          this.getPolicyMemberDocuments(member.id, companyId),
        ]);
        
        return {
          member,
          income: income || undefined,
          immigration: immigration || undefined,
          documents,
        };
      })
    );
    
    // Get payment methods - shared across all policies for the same client
    const canonicalPolicyIds = await this.getCanonicalPolicyIds(policyId);
    const paymentMethods = await this.getPolicyPaymentMethods(canonicalPolicyIds, companyId);
    
    // Get policy plans
    const plans = await this.listPolicyPlans(policyId, companyId);
    
    // Calculate total household income (IDENTICAL to getQuoteDetail)
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
      policy,
      members: membersWithDetails,
      paymentMethods,
      plans,
      totalHouseholdIncome,
    };
  }
  
  // ==================== POLICY REMINDERS ====================
  
  async listPolicyReminders(
    policyIds: string | string[],
    companyId: string,
    filters?: { status?: string; priority?: string; userId?: string }
  ): Promise<Array<PolicyReminder & { creator: { firstName: string | null; lastName: string | null } }>> {
    // Support both single policyId and array of policyIds for cross-policy sharing
    const idsArray = Array.isArray(policyIds) ? policyIds : [policyIds];
    
    if (idsArray.length === 0) {
      return [];
    }
    
    let conditions = [
      inArray(policyReminders.policyId, idsArray),
      eq(policyReminders.companyId, companyId),
    ];
    
    if (filters?.status) {
      conditions.push(eq(policyReminders.status, filters.status));
    }
    
    if (filters?.priority) {
      conditions.push(eq(policyReminders.priority, filters.priority));
    }
    
    if (filters?.userId) {
      conditions.push(eq(policyReminders.assignedTo, filters.userId));
    }
    
    const results = await db
      .select({
        reminder: policyReminders,
        creator: {
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(policyReminders)
      .leftJoin(users, eq(policyReminders.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(policyReminders.dueDate);
    
    return results.map(r => ({ ...r.reminder, creator: r.creator }));
  }
  
  async getPolicyReminder(id: string, companyId: string): Promise<PolicyReminder | null> {
    const [reminder] = await db
      .select()
      .from(policyReminders)
      .where(
        and(
          eq(policyReminders.id, id),
          eq(policyReminders.companyId, companyId)
        )
      );
    return reminder || null;
  }
  
  async getPolicyRemindersByCompany(companyId: string): Promise<PolicyReminder[]> {
    const results = await db
      .select()
      .from(policyReminders)
      .where(eq(policyReminders.companyId, companyId))
      .orderBy(policyReminders.dueDate);
    
    return results;
  }
  
  async createPolicyReminder(data: InsertPolicyReminder): Promise<PolicyReminder> {
    const [reminder] = await db
      .insert(policyReminders)
      .values(data)
      .returning();
    return reminder;
  }
  
  async updatePolicyReminder(id: string, companyId: string, data: UpdatePolicyReminder): Promise<PolicyReminder | null> {
    const [updated] = await db
      .update(policyReminders)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(policyReminders.id, id),
          eq(policyReminders.companyId, companyId)
        )
      )
      .returning();
    return updated || null;
  }
  
  async deletePolicyReminder(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyReminders)
      .where(
        and(
          eq(policyReminders.id, id),
          eq(policyReminders.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  async completePolicyReminder(id: string, companyId: string, userId: string): Promise<PolicyReminder | null> {
    const [updated] = await db
      .update(policyReminders)
      .set({
        status: 'completed',
        completedBy: userId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(policyReminders.id, id),
          eq(policyReminders.companyId, companyId)
        )
      )
      .returning();
    return updated || null;
  }
  
  async snoozePolicyReminder(id: string, companyId: string, until: Date): Promise<PolicyReminder | null> {
    const [updated] = await db
      .update(policyReminders)
      .set({
        snoozedUntil: until,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(policyReminders.id, id),
          eq(policyReminders.companyId, companyId)
        )
      )
      .returning();
    return updated || null;
  }
  
  // ==================== POLICY NOTES ====================
  
  async createPolicyNote(note: InsertPolicyNote): Promise<PolicyNote> {
    const [created] = await db
      .insert(policyNotes)
      .values(note)
      .returning();
    return created;
  }
  
  async getPolicyNotes(policyIds: string | string[], companyId: string): Promise<PolicyNote[]> {
    // Support both single policyId and array of policyIds for cross-policy sharing
    const idsArray = Array.isArray(policyIds) ? policyIds : [policyIds];
    
    if (idsArray.length === 0) {
      return [];
    }
    
    const notes = await db
      .select()
      .from(policyNotes)
      .where(
        and(
          inArray(policyNotes.policyId, idsArray),
          eq(policyNotes.companyId, companyId)
        )
      )
      .orderBy(desc(policyNotes.createdAt));

    // Get unique user IDs
    const userIds = [...new Set(notes.map(n => n.createdBy))];
    
    // Fetch user details
    const usersMap = new Map();
    if (userIds.length > 0) {
      const usersData = await db
        .select()
        .from(users)
        .where(inArray(users.id, userIds));
      
      usersData.forEach(user => {
        usersMap.set(user.id, user);
      });
    }

    // Combine notes with user data
    return notes.map(note => {
      const user = usersMap.get(note.createdBy);
      return {
        ...note,
        creatorName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null,
        creatorAvatar: user?.avatar || null,
      };
    }) as any;
  }
  
  async deletePolicyNote(id: string, companyId?: string): Promise<void> {
    if (companyId) {
      await db
        .delete(policyNotes)
        .where(
          and(
            eq(policyNotes.id, id),
            eq(policyNotes.companyId, companyId)
          )
        );
    } else {
      await db
        .delete(policyNotes)
        .where(eq(policyNotes.id, id));
    }
  }
  
  // ==================== POLICY CONSENT DOCUMENTS ====================
  
  async createPolicyConsentDocument(policyId: string, companyId: string, userId: string): Promise<PolicyConsentDocument> {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration
    
    const [consent] = await db
      .insert(policyConsentDocuments)
      .values({
        policyId,
        companyId,
        token,
        status: 'pending',
        createdBy: userId,
        expiresAt,
      } as any)
      .returning();
    
    // Create 'created' event
    await this.createPolicyConsentEvent(consent.id, 'created', { policyId, createdBy: userId }, userId);
    
    return consent;
  }
  
  async getPolicyConsentById(id: string, companyId: string): Promise<PolicyConsentDocument | null> {
    const [consent] = await db
      .select()
      .from(policyConsentDocuments)
      .where(
        and(
          eq(policyConsentDocuments.id, id),
          eq(policyConsentDocuments.companyId, companyId)
        )
      );
    return consent || null;
  }
  
  async getPolicyConsentByToken(token: string): Promise<PolicyConsentDocument | null> {
    const [consent] = await db
      .select()
      .from(policyConsentDocuments)
      .where(eq(policyConsentDocuments.token, token));
    return consent || null;
  }
  
  async listPolicyConsents(policyIds: string | string[], companyId: string): Promise<PolicyConsentDocument[]> {
    // Support both single policyId and array of policyIds for cross-policy sharing
    const idsArray = Array.isArray(policyIds) ? policyIds : [policyIds];
    
    if (idsArray.length === 0) {
      return [];
    }
    
    return db
      .select()
      .from(policyConsentDocuments)
      .where(
        and(
          inArray(policyConsentDocuments.policyId, idsArray),
          eq(policyConsentDocuments.companyId, companyId)
        )
      )
      .orderBy(desc(policyConsentDocuments.createdAt));
  }
  
  async updatePolicyConsentDocument(id: string, data: Partial<InsertPolicyConsentDocument>): Promise<PolicyConsentDocument | null> {
    const [updated] = await db
      .update(policyConsentDocuments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(policyConsentDocuments.id, id))
      .returning();
    return updated || null;
  }
  
  async deletePolicyConsentDocument(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyConsentDocuments)
      .where(
        and(
          eq(policyConsentDocuments.id, id),
          eq(policyConsentDocuments.companyId, companyId)
        )
      )
      .returning();
    return result.length > 0;
  }
  
  async signPolicyConsent(token: string, signatureData: {
    signatureImage: string;
    signerIp?: string;
    signerUserAgent?: string;
    signerTimezone?: string;
    signerLocation?: string;
    signerPlatform?: string;
    signerBrowser?: string;
  }): Promise<PolicyConsentDocument | null> {
    const consent = await this.getPolicyConsentByToken(token);
    if (!consent) {
      return null;
    }
    
    if (consent.status === 'signed') {
      return consent;
    }
    
    if (consent.expiresAt && new Date() > consent.expiresAt) {
      return null;
    }
    
    const result = await db
      .update(policyConsentDocuments)
      .set({
        status: 'signed',
        signatureImage: signatureData.signatureImage,
        signedAt: new Date(),
        signerIp: signatureData.signerIp,
        signerUserAgent: signatureData.signerUserAgent,
        signerTimezone: signatureData.signerTimezone,
        signerLocation: signatureData.signerLocation,
        signerPlatform: signatureData.signerPlatform,
        signerBrowser: signatureData.signerBrowser,
      })
      .where(eq(policyConsentDocuments.token, token))
      .returning();
    
    // Create 'signed' event
    await this.createPolicyConsentEvent(consent.id, 'signed', signatureData);
    
    return result[0] || null;
  }
  
  // ==================== POLICY CONSENT SIGNATURE EVENTS ====================
  
  async createPolicyConsentEvent(
    consentDocumentId: string,
    eventType: string,
    payload?: Record<string, any>,
    actorId?: string
  ): Promise<PolicyConsentSignatureEvent> {
    const result = await db
      .insert(policyConsentSignatureEvents)
      .values({
        consentDocumentId,
        eventType,
        payload: payload || {},
        actorId,
      })
      .returning();
    
    return result[0];
  }
  
  async getPolicyConsentEvents(consentDocumentId: string): Promise<PolicyConsentSignatureEvent[]> {
    const result = await db
      .select()
      .from(policyConsentSignatureEvents)
      .where(eq(policyConsentSignatureEvents.consentDocumentId, consentDocumentId))
      .orderBy(desc(policyConsentSignatureEvents.occurredAt));
    
    return result;
  }
  
  // ==================== POLICY PLANS (Multi-plan support) ====================
  
  async listPolicyPlans(policyId: string, companyId: string): Promise<PolicyPlan[]> {
    const result = await db
      .select()
      .from(policyPlans)
      .where(and(
        eq(policyPlans.policyId, policyId),
        eq(policyPlans.companyId, companyId)
      ))
      .orderBy(desc(policyPlans.isPrimary), policyPlans.displayOrder, policyPlans.createdAt);
    
    return result;
  }
  
  async addPolicyPlan(data: InsertPolicyPlan): Promise<PolicyPlan> {
    const result = await db
      .insert(policyPlans)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();
    
    return result[0];
  }
  
  async updatePolicyPlan(planId: string, companyId: string, data: Partial<InsertPolicyPlan>): Promise<PolicyPlan | null> {
    const result = await db
      .update(policyPlans)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(policyPlans.id, planId),
        eq(policyPlans.companyId, companyId)
      ))
      .returning();
    
    return result[0] || null;
  }
  
  async removePolicyPlan(planId: string, companyId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // First, get the plan to know which policy it belongs to and if it's primary
      const planToDelete = await tx
        .select()
        .from(policyPlans)
        .where(and(
          eq(policyPlans.id, planId),
          eq(policyPlans.companyId, companyId)
        ))
        .limit(1);
      
      if (planToDelete.length === 0) {
        return false;
      }
      
      const policyId = planToDelete[0].policyId;
      const wasPrimary = planToDelete[0].isPrimary;
      
      // Delete the plan
      const result = await tx
        .delete(policyPlans)
        .where(and(
          eq(policyPlans.id, planId),
          eq(policyPlans.companyId, companyId)
        ))
        .returning();
      
      if (result.length === 0) {
        return false;
      }
      
      // Only clear memberId if the deleted plan was primary
      if (wasPrimary && policyId) {
        // Check if any remaining plans exist for this policy
        const remainingPlans = await tx
          .select()
          .from(policyPlans)
          .where(and(
            eq(policyPlans.policyId, policyId),
            eq(policyPlans.companyId, companyId)
          ))
          .limit(1);
        
        // Clear memberId only if no plans remain OR no primary plan remains
        const remainingPrimary = await tx
          .select()
          .from(policyPlans)
          .where(and(
            eq(policyPlans.policyId, policyId),
            eq(policyPlans.companyId, companyId),
            eq(policyPlans.isPrimary, true)
          ))
          .limit(1);
        
        if (remainingPlans.length === 0 || remainingPrimary.length === 0) {
          // Clear memberId AND selectedPlan (legacy) when primary plan is deleted and no replacement primary exists
          await tx
            .update(policies)
            .set({ 
              memberId: null,
              selectedPlan: null,
              updatedAt: new Date()
            })
            .where(and(
              eq(policies.id, policyId),
              eq(policies.companyId, companyId)
            ));
        }
      }
      
      return true;
    });
  }
  
  async setPrimaryPolicyPlan(planId: string, policyId: string, companyId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(policyPlans)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(policyPlans.policyId, policyId),
          eq(policyPlans.companyId, companyId)
        ));
      
      await tx
        .update(policyPlans)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(and(
          eq(policyPlans.id, planId),
          eq(policyPlans.companyId, companyId)
        ));
    });
  }
  
  // ==================== POLICY FOLDERS ====================
  
  async listPolicyFolders(companyId: string, userId: string): Promise<{ agency: PolicyFolder[], personal: PolicyFolder[] }> {
    const agencyFolders = await db
      .select()
      .from(policyFolders)
      .where(and(
        eq(policyFolders.companyId, companyId),
        eq(policyFolders.type, 'agency')
      ))
      .orderBy(policyFolders.name);
    
    const personalFolders = await db
      .select()
      .from(policyFolders)
      .where(and(
        eq(policyFolders.companyId, companyId),
        eq(policyFolders.type, 'personal'),
        eq(policyFolders.createdBy, userId)
      ))
      .orderBy(policyFolders.name);
    
    return {
      agency: agencyFolders,
      personal: personalFolders
    };
  }
  
  async getPolicyFolder(id: string): Promise<PolicyFolder | undefined> {
    const result = await db
      .select()
      .from(policyFolders)
      .where(eq(policyFolders.id, id))
      .limit(1);
    
    return result[0];
  }
  
  async createPolicyFolder(data: InsertPolicyFolder): Promise<PolicyFolder> {
    const result = await db
      .insert(policyFolders)
      .values(data)
      .returning();
    
    return result[0];
  }
  
  async updatePolicyFolder(id: string, companyId: string, data: Partial<InsertPolicyFolder>): Promise<PolicyFolder | undefined> {
    const result = await db
      .update(policyFolders)
      .set({
        name: data.name,
        updatedAt: new Date()
      })
      .where(and(
        eq(policyFolders.id, id),
        eq(policyFolders.companyId, companyId)
      ))
      .returning();
    
    return result[0];
  }
  
  async deletePolicyFolder(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(policyFolders)
      .where(and(
        eq(policyFolders.id, id),
        eq(policyFolders.companyId, companyId)
      ))
      .returning();
    
    return result.length > 0;
  }
  
  async assignPoliciesToFolder(policyIds: string[], folderId: string | null, userId: string, companyId: string): Promise<number> {
    await db.transaction(async (tx) => {
      if (folderId === null) {
        await tx
          .delete(policyFolderAssignments)
          .where(inArray(policyFolderAssignments.policyId, policyIds));
      } else {
        await tx
          .delete(policyFolderAssignments)
          .where(inArray(policyFolderAssignments.policyId, policyIds));
        
        const assignmentsToInsert = policyIds.map(policyId => ({
          policyId,
          folderId,
          assignedBy: userId
        }));
        
        if (assignmentsToInsert.length > 0) {
          await tx
            .insert(policyFolderAssignments)
            .values(assignmentsToInsert);
        }
      }
    });
    
    return policyIds.length;
  }
  
  // ==================== LANDING PAGES ====================
  
  async getLandingPagesByUser(userId: string, companyId: string): Promise<LandingPage[]> {
    const result = await db
      .select()
      .from(landingPages)
      .where(and(
        eq(landingPages.userId, userId),
        eq(landingPages.companyId, companyId)
      ))
      .orderBy(desc(landingPages.createdAt));
    
    return result;
  }
  
  async checkSlugAvailability(slug: string, userId?: string): Promise<boolean> {
    const result = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.slug, slug));
    
    // Si encontramos un registro con ese slug
    if (result.length === 0) return true; // Está disponible
    
    // Si hay userId, verificar que no sea del mismo usuario
    if (userId && result[0].userId === userId) return true; // Es su propio slug
    
    return false; // Ya está ocupado por otro usuario
  }
  
  async getLandingPageBySlug(slug: string): Promise<LandingPage | undefined> {
    const result = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.slug, slug));
    
    return result[0];
  }
  
  async getLandingPageById(id: string): Promise<LandingPage | undefined> {
    const result = await db
      .select()
      .from(landingPages)
      .where(eq(landingPages.id, id));
    
    return result[0];
  }
  
  async createLandingPage(data: InsertLandingPage): Promise<LandingPage> {
    const result = await db
      .insert(landingPages)
      .values(data)
      .returning();
    
    return result[0];
  }
  
  async updateLandingPage(id: string, data: Partial<InsertLandingPage>): Promise<LandingPage | undefined> {
    const result = await db
      .update(landingPages)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(landingPages.id, id))
      .returning();
    
    return result[0];
  }
  
  async deleteLandingPage(id: string): Promise<boolean> {
    const result = await db
      .delete(landingPages)
      .where(eq(landingPages.id, id))
      .returning();
    
    return result.length > 0;
  }
  
  async incrementLandingPageView(id: string): Promise<void> {
    await db
      .update(landingPages)
      .set({
        viewCount: sql`${landingPages.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(landingPages.id, id));
  }
  
  // ==================== LANDING BLOCKS ====================
  
  async getBlocksByLandingPage(landingPageId: string): Promise<LandingBlock[]> {
    const result = await db
      .select()
      .from(landingBlocks)
      .where(eq(landingBlocks.landingPageId, landingPageId))
      .orderBy(landingBlocks.position);
    
    return result;
  }
  
  async getLandingBlockById(id: string): Promise<LandingBlock | undefined> {
    const result = await db
      .select()
      .from(landingBlocks)
      .where(eq(landingBlocks.id, id));
    
    return result[0];
  }
  
  async createLandingBlock(data: InsertLandingBlock): Promise<LandingBlock> {
    const result = await db
      .insert(landingBlocks)
      .values({
        ...data,
        clickCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return result[0];
  }
  
  async updateLandingBlock(id: string, data: Partial<InsertLandingBlock>): Promise<LandingBlock | undefined> {
    const result = await db
      .update(landingBlocks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(landingBlocks.id, id))
      .returning();
    
    return result[0];
  }
  
  async deleteLandingBlock(id: string): Promise<boolean> {
    const result = await db
      .delete(landingBlocks)
      .where(eq(landingBlocks.id, id))
      .returning();
    
    return result.length > 0;
  }
  
  async updateBlockPosition(id: string, position: number): Promise<LandingBlock | undefined> {
    const result = await db
      .update(landingBlocks)
      .set({
        position,
        updatedAt: new Date(),
      })
      .where(eq(landingBlocks.id, id))
      .returning();
    
    return result[0];
  }
  
  async incrementBlockClick(id: string): Promise<void> {
    await db
      .update(landingBlocks)
      .set({
        clickCount: sql`${landingBlocks.clickCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(landingBlocks.id, id));
  }
  
  async reorderBlocks(landingPageId: string, blockIds: string[]): Promise<void> {
    for (let i = 0; i < blockIds.length; i++) {
      await db
        .update(landingBlocks)
        .set({
          position: i,
          updatedAt: new Date(),
        })
        .where(and(
          eq(landingBlocks.id, blockIds[i]),
          eq(landingBlocks.landingPageId, landingPageId)
        ));
    }
  }

  async syncLandingBlocks(
    landingPageId: string, 
    blocks: Array<Omit<LandingBlock, 'createdAt' | 'updatedAt'>>
  ): Promise<LandingBlock[]> {
    // Use a transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Step 1: Delete all existing blocks for this landing page
      await tx
        .delete(landingBlocks)
        .where(eq(landingBlocks.landingPageId, landingPageId));
      
      // Step 2: Insert all new blocks
      if (blocks.length === 0) {
        return [];
      }
      
      const result = await tx
        .insert(landingBlocks)
        .values(
          blocks.map((block) => ({
            id: block.id,
            landingPageId: block.landingPageId,
            type: block.type,
            content: block.content,
            position: block.position,
            isVisible: block.isVisible,
            clickCount: block.clickCount || 0,
          }))
        )
        .returning();
      
      return result;
    });
  }
  
  // ==================== LANDING ANALYTICS ====================
  
  async createLandingAnalytics(data: InsertLandingAnalytics): Promise<LandingAnalytics> {
    const result = await db
      .insert(landingAnalytics)
      .values({
        ...data,
        occurredAt: new Date(),
      })
      .returning();
    
    return result[0];
  }
  
  async getLandingAnalytics(
    landingPageId: string,
    options?: { eventType?: string; limit?: number }
  ): Promise<LandingAnalytics[]> {
    const whereConditions = options?.eventType
      ? and(
          eq(landingAnalytics.landingPageId, landingPageId),
          eq(landingAnalytics.eventType, options.eventType)
        )
      : eq(landingAnalytics.landingPageId, landingPageId);
    
    let query = db
      .select()
      .from(landingAnalytics)
      .where(whereConditions)
      .orderBy(desc(landingAnalytics.occurredAt));
    
    if (options?.limit) {
      const result = await query.limit(options.limit);
      return result;
    }
    
    return await query;
  }
  
  // ==================== LANDING LEADS ====================
  
  async createLandingLead(data: InsertLandingLead): Promise<LandingLead> {
    const result = await db
      .insert(landingLeads)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .returning();
    
    return result[0];
  }
  
  async getLandingLeads(
    landingPageId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<LandingLead[]> {
    let query = db
      .select()
      .from(landingLeads)
      .where(eq(landingLeads.landingPageId, landingPageId))
      .orderBy(desc(landingLeads.createdAt));
    
    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }
    
    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    
    return await query;
  }
  
  async getLandingLeadsByUser(
    userId: string,
    options?: { limit?: number; offset?: number; search?: string }
  ): Promise<LandingLead[]> {
    const conditions = [eq(landingPages.userId, userId)];

    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          like(landingLeads.fullName, searchPattern),
          like(landingLeads.email, searchPattern),
          like(landingLeads.phone, searchPattern)
        )!
      );
    }

    const query = db
      .select({
        id: landingLeads.id,
        landingPageId: landingLeads.landingPageId,
        blockId: landingLeads.blockId,
        fullName: landingLeads.fullName,
        email: landingLeads.email,
        phone: landingLeads.phone,
        message: landingLeads.message,
        formData: landingLeads.formData,
        source: landingLeads.source,
        ipAddress: landingLeads.ipAddress,
        userAgent: landingLeads.userAgent,
        createdAt: landingLeads.createdAt,
        landingPage: {
          title: landingPages.title,
        },
      })
      .from(landingLeads)
      .innerJoin(landingPages, eq(landingLeads.landingPageId, landingPages.id))
      .where(and(...conditions))
      .orderBy(desc(landingLeads.createdAt));

    if (options?.offset) {
      query.offset(options.offset);
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return await query as any;
  }
  
  async getLandingLeadsByCompany(
    companyId: string,
    options?: { limit?: number; offset?: number; search?: string }
  ): Promise<LandingLead[]> {
    const conditions = [eq(landingPages.companyId, companyId)];

    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          like(landingLeads.fullName, searchPattern),
          like(landingLeads.email, searchPattern),
          like(landingLeads.phone, searchPattern)
        )!
      );
    }

    const query = db
      .select({
        id: landingLeads.id,
        landingPageId: landingLeads.landingPageId,
        blockId: landingLeads.blockId,
        fullName: landingLeads.fullName,
        email: landingLeads.email,
        phone: landingLeads.phone,
        message: landingLeads.message,
        formData: landingLeads.formData,
        source: landingLeads.source,
        ipAddress: landingLeads.ipAddress,
        userAgent: landingLeads.userAgent,
        createdAt: landingLeads.createdAt,
        landingPage: {
          title: landingPages.title,
        },
      })
      .from(landingLeads)
      .innerJoin(landingPages, eq(landingLeads.landingPageId, landingPages.id))
      .where(and(...conditions))
      .orderBy(desc(landingLeads.createdAt));

    if (options?.offset) {
      query.offset(options.offset);
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return await query as any;
  }
  
  // ==================== LANDING APPOINTMENTS ====================
  
  async createLandingAppointment(data: InsertLandingAppointment): Promise<LandingAppointment> {
    const result = await db
      .insert(landingAppointments)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return result[0];
  }
  
  async getLandingAppointments(
    landingPageId: string,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<LandingAppointment[]> {
    const whereConditions = options?.status
      ? and(
          eq(landingAppointments.landingPageId, landingPageId),
          eq(landingAppointments.status, options.status)
        )
      : eq(landingAppointments.landingPageId, landingPageId);
    
    let query = db
      .select()
      .from(landingAppointments)
      .where(whereConditions)
      .orderBy(desc(landingAppointments.createdAt));
    
    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }
    
    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    
    return await query;
  }
  
  async updateAppointmentStatus(id: string, status: string): Promise<LandingAppointment | undefined> {
    const result = await db
      .update(landingAppointments)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(landingAppointments.id, id))
      .returning();
    
    return result[0];
  }
  
  async getAvailableSlots(blockId: string, date: string): Promise<string[]> {
    // Get the block configuration
    const block = await db
      .select()
      .from(landingBlocks)
      .where(eq(landingBlocks.id, blockId))
      .limit(1);
    
    if (!block.length || block[0].type !== 'calendar') {
      return [];
    }
    
    const config = block[0].content as any;
    const { availableHours, duration = 30 } = config;
    
    if (!availableHours?.start || !availableHours?.end) {
      return [];
    }
    
    // Get existing appointments for this date
    const existingAppointments = await db
      .select()
      .from(landingAppointments)
      .where(
        and(
          eq(landingAppointments.blockId, blockId),
          eq(landingAppointments.appointmentDate, date),
          sql`${landingAppointments.status} != 'cancelled'`
        )
      );
    
    // Generate all possible time slots
    const slots: string[] = [];
    const [startHour, startMinute] = availableHours.start.split(':').map(Number);
    const [endHour, endMinute] = availableHours.end.split(':').map(Number);
    
    let currentTime = startHour * 60 + startMinute; // Convert to minutes
    const endTime = endHour * 60 + endMinute;
    
    while (currentTime + duration <= endTime) {
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      const timeSlot = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      // Check if this slot is already booked
      const isBooked = existingAppointments.some(apt => {
        const aptTime = apt.appointmentTime;
        const aptDuration = apt.duration || 30;
        const [aptHour, aptMinute] = aptTime.split(':').map(Number);
        const aptStartTime = aptHour * 60 + aptMinute;
        const aptEndTime = aptStartTime + aptDuration;
        
        // Check for overlap
        return currentTime < aptEndTime && (currentTime + duration) > aptStartTime;
      });
      
      if (!isBooked) {
        slots.push(timeSlot);
      }
      
      currentTime += duration;
    }
    
    return slots;
  }

  async getAppointmentById(id: string): Promise<LandingAppointment | undefined> {
    const result = await db
      .select()
      .from(landingAppointments)
      .where(eq(landingAppointments.id, id));
    return result[0];
  }

  async getLandingAppointmentsByUser(
    userId: string,
    options?: { limit?: number; offset?: number; status?: string }
  ): Promise<LandingAppointment[]> {
    const whereConditions = options?.status
      ? and(
          eq(landingPages.userId, userId),
          eq(landingAppointments.status, options.status)
        )
      : eq(landingPages.userId, userId);

    const query = db
      .select({
        id: landingAppointments.id,
        landingPageId: landingAppointments.landingPageId,
        blockId: landingAppointments.blockId,
        fullName: landingAppointments.fullName,
        email: landingAppointments.email,
        phone: landingAppointments.phone,
        appointmentDate: landingAppointments.appointmentDate,
        appointmentTime: landingAppointments.appointmentTime,
        duration: landingAppointments.duration,
        notes: landingAppointments.notes,
        status: landingAppointments.status,
        ipAddress: landingAppointments.ipAddress,
        userAgent: landingAppointments.userAgent,
        createdAt: landingAppointments.createdAt,
        updatedAt: landingAppointments.updatedAt,
      })
      .from(landingAppointments)
      .innerJoin(landingPages, eq(landingAppointments.landingPageId, landingPages.id))
      .where(whereConditions)
      .orderBy(desc(landingAppointments.createdAt));

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query;
  }

  async getLandingAppointmentsByCompany(
    companyId: string,
    options?: { limit?: number; offset?: number; status?: string; search?: string }
  ): Promise<LandingAppointment[]> {
    const conditions = [eq(landingPages.companyId, companyId)];

    if (options?.status) {
      conditions.push(eq(landingAppointments.status, options.status));
    }

    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          like(landingAppointments.fullName, searchPattern),
          like(landingAppointments.email, searchPattern),
          like(landingAppointments.phone, searchPattern)
        )!
      );
    }

    const query = db
      .select({
        id: landingAppointments.id,
        landingPageId: landingAppointments.landingPageId,
        blockId: landingAppointments.blockId,
        fullName: landingAppointments.fullName,
        email: landingAppointments.email,
        phone: landingAppointments.phone,
        appointmentDate: landingAppointments.appointmentDate,
        appointmentTime: landingAppointments.appointmentTime,
        duration: landingAppointments.duration,
        notes: landingAppointments.notes,
        status: landingAppointments.status,
        ipAddress: landingAppointments.ipAddress,
        userAgent: landingAppointments.userAgent,
        createdAt: landingAppointments.createdAt,
        updatedAt: landingAppointments.updatedAt,
      })
      .from(landingAppointments)
      .innerJoin(landingPages, eq(landingAppointments.landingPageId, landingPages.id))
      .where(and(...conditions))
      .orderBy(desc(landingAppointments.createdAt));

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query;
  }

  async updateLandingAppointment(
    id: string,
    data: Partial<InsertLandingAppointment>
  ): Promise<LandingAppointment | undefined> {
    const result = await db
      .update(landingAppointments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(landingAppointments.id, id))
      .returning();
    return result[0];
  }

  async getLandingAppointmentById(id: string): Promise<LandingAppointment | undefined> {
    const result = await db
      .select()
      .from(landingAppointments)
      .where(eq(landingAppointments.id, id));
    return result[0];
  }

  async deleteLandingAppointment(id: string): Promise<boolean> {
    const result = await db
      .delete(landingAppointments)
      .where(eq(landingAppointments.id, id));
    return true;
  }
  
  // ==================== APPOINTMENT AVAILABILITY ====================
  
  async getAppointmentAvailability(userId: string): Promise<AppointmentAvailability | undefined> {
    const result = await db
      .select()
      .from(appointmentAvailability)
      .where(eq(appointmentAvailability.userId, userId))
      .limit(1);
    return result[0];
  }
  
  async createAppointmentAvailability(data: InsertAppointmentAvailability): Promise<AppointmentAvailability> {
    const result = await db
      .insert(appointmentAvailability)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async updateAppointmentAvailability(
    userId: string,
    data: Partial<InsertAppointmentAvailability>
  ): Promise<AppointmentAvailability | undefined> {
    const result = await db
      .update(appointmentAvailability)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(appointmentAvailability.userId, userId))
      .returning();
    return result[0];
  }
  
  // ==================== MANUAL CALENDAR EVENTS ====================
  
  async createManualBirthday(data: InsertManualBirthday): Promise<ManualBirthday> {
    const result = await db
      .insert(manualBirthdays)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async getManualBirthdaysByCompany(companyId: string): Promise<ManualBirthday[]> {
    return db
      .select()
      .from(manualBirthdays)
      .where(eq(manualBirthdays.companyId, companyId))
      .orderBy(manualBirthdays.dateOfBirth);
  }
  
  async deleteManualBirthday(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(manualBirthdays)
      .where(and(eq(manualBirthdays.id, id), eq(manualBirthdays.companyId, companyId)))
      .returning();
    return result.length > 0;
  }
  
  async createStandaloneReminder(data: InsertStandaloneReminder): Promise<StandaloneReminder> {
    const result = await db
      .insert(standaloneReminders)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async getStandaloneRemindersByCompany(companyId: string): Promise<StandaloneReminder[]> {
    return db
      .select()
      .from(standaloneReminders)
      .where(eq(standaloneReminders.companyId, companyId))
      .orderBy(standaloneReminders.dueDate);
  }
  
  async deleteStandaloneReminder(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(standaloneReminders)
      .where(and(eq(standaloneReminders.id, id), eq(standaloneReminders.companyId, companyId)))
      .returning();
    return result.length > 0;
  }
  
  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const result = await db
      .insert(appointments)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async getAppointmentsByCompany(companyId: string): Promise<Appointment[]> {
    return db
      .select()
      .from(appointments)
      .where(eq(appointments.companyId, companyId))
      .orderBy(appointments.appointmentDate);
  }
  
  async deleteAppointment(id: string, companyId: string): Promise<boolean> {
    const result = await db
      .delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)))
      .returning();
    return result.length > 0;
  }
  
  // ==================== BIRTHDAY AUTOMATION ====================
  
  async getAllBirthdayImages(): Promise<BirthdayImage[]> {
    return db
      .select()
      .from(birthdayImages)
      .orderBy(desc(birthdayImages.createdAt));
  }
  
  async getActiveBirthdayImages(): Promise<BirthdayImage[]> {
    return db
      .select()
      .from(birthdayImages)
      .where(eq(birthdayImages.isActive, true))
      .orderBy(desc(birthdayImages.createdAt));
  }
  
  async getBirthdayImage(id: string): Promise<BirthdayImage | undefined> {
    const result = await db
      .select()
      .from(birthdayImages)
      .where(eq(birthdayImages.id, id));
    return result[0];
  }
  
  async createBirthdayImage(data: InsertBirthdayImage, uploadedBy: string): Promise<BirthdayImage> {
    const result = await db
      .insert(birthdayImages)
      .values({
        ...data,
        uploadedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async updateBirthdayImage(id: string, data: Partial<InsertBirthdayImage>): Promise<BirthdayImage | undefined> {
    const result = await db
      .update(birthdayImages)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(birthdayImages.id, id))
      .returning();
    return result[0];
  }
  
  async deleteBirthdayImage(id: string): Promise<boolean> {
    const result = await db
      .delete(birthdayImages)
      .where(eq(birthdayImages.id, id))
      .returning();
    return result.length > 0;
  }
  
  async getUserBirthdaySettings(userId: string): Promise<UserBirthdaySettings | undefined> {
    const result = await db
      .select()
      .from(userBirthdaySettings)
      .where(eq(userBirthdaySettings.userId, userId));
    return result[0];
  }
  
  async createUserBirthdaySettings(data: InsertUserBirthdaySettings & { userId: string }): Promise<UserBirthdaySettings> {
    const result = await db
      .insert(userBirthdaySettings)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async updateUserBirthdaySettings(userId: string, data: Partial<InsertUserBirthdaySettings>): Promise<UserBirthdaySettings | undefined> {
    const result = await db
      .update(userBirthdaySettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userBirthdaySettings.userId, userId))
      .returning();
    return result[0];
  }
  
  async createBirthdayGreetingHistory(data: InsertBirthdayGreetingHistory & { userId: string; companyId: string }): Promise<BirthdayGreetingHistory> {
    const result = await db
      .insert(birthdayGreetingHistory)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async getBirthdayGreetingHistory(companyId: string, userId?: string): Promise<BirthdayGreetingHistory[]> {
    const conditions = [eq(birthdayGreetingHistory.companyId, companyId)];
    if (userId) {
      conditions.push(eq(birthdayGreetingHistory.userId, userId));
    }
    return db
      .select()
      .from(birthdayGreetingHistory)
      .where(and(...conditions))
      .orderBy(desc(birthdayGreetingHistory.sentAt));
  }
  
  async updateBirthdayGreetingStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }
    await db
      .update(birthdayGreetingHistory)
      .set(updateData)
      .where(eq(birthdayGreetingHistory.id, id));
  }
  
  async updateBirthdayGreetingImageSid(id: string, twilioImageSid: string): Promise<void> {
    await db
      .update(birthdayGreetingHistory)
      .set({
        twilioImageSid,
        updatedAt: new Date(),
      })
      .where(eq(birthdayGreetingHistory.id, id));
  }
  
  async checkIfBirthdayGreetingSentToday(recipientPhone: string, recipientDateOfBirth: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db
      .select()
      .from(birthdayGreetingHistory)
      .where(
        and(
          eq(birthdayGreetingHistory.recipientPhone, recipientPhone),
          eq(birthdayGreetingHistory.recipientDateOfBirth, recipientDateOfBirth),
          sql`DATE(${birthdayGreetingHistory.sentAt}) = ${today}`
        )
      );
    return result.length > 0;
  }
  
  // ==================== BIRTHDAY PENDING MESSAGES ====================
  
  async createBirthdayPendingMessage(data: InsertBirthdayPendingMessage): Promise<BirthdayPendingMessage> {
    const result = await db
      .insert(birthdayPendingMessages)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async getBirthdayPendingMessageByMmsSid(mmsSid: string): Promise<BirthdayPendingMessage | undefined> {
    const result = await db
      .select()
      .from(birthdayPendingMessages)
      .where(eq(birthdayPendingMessages.mmsSid, mmsSid));
    return result[0];
  }
  
  async updateBirthdayPendingMessageMmsSid(id: string, mmsSid: string): Promise<void> {
    await db
      .update(birthdayPendingMessages)
      .set({
        mmsSid,
        updatedAt: new Date(),
      })
      .where(eq(birthdayPendingMessages.id, id));
  }
  
  async updateBirthdayPendingMessageStatus(id: string, status: string): Promise<void> {
    await db
      .update(birthdayPendingMessages)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(birthdayPendingMessages.id, id));
  }
  
  async deleteBirthdayPendingMessage(id: string): Promise<void> {
    await db
      .delete(birthdayPendingMessages)
      .where(eq(birthdayPendingMessages.id, id));
  }
  
  // ==================== BULKVS PHONE NUMBERS ====================
  
  async getBulkvsPhoneNumber(id: string): Promise<BulkvsPhoneNumber | undefined> {
    const result = await db
      .select()
      .from(bulkvsPhoneNumbers)
      .where(eq(bulkvsPhoneNumbers.id, id));
    return result[0];
  }
  
  async getBulkvsPhoneNumberByDid(did: string): Promise<BulkvsPhoneNumber | undefined> {
    const result = await db
      .select()
      .from(bulkvsPhoneNumbers)
      .where(eq(bulkvsPhoneNumbers.did, did));
    return result[0];
  }
  
  async getBulkvsPhoneNumbersByUser(userId: string): Promise<BulkvsPhoneNumber[]> {
    return db
      .select()
      .from(bulkvsPhoneNumbers)
      .where(eq(bulkvsPhoneNumbers.userId, userId))
      .orderBy(desc(bulkvsPhoneNumbers.createdAt));
  }
  
  async getBulkvsPhoneNumbersByCompany(companyId: string): Promise<BulkvsPhoneNumber[]> {
    return db
      .select()
      .from(bulkvsPhoneNumbers)
      .where(eq(bulkvsPhoneNumbers.companyId, companyId))
      .orderBy(desc(bulkvsPhoneNumbers.createdAt));
  }
  
  async createBulkvsPhoneNumber(data: InsertBulkvsPhoneNumber): Promise<BulkvsPhoneNumber> {
    // Normalize DID to 10-digit format before storage
    const normalizedData = {
      ...data,
      did: formatForStorage(data.did),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db
      .insert(bulkvsPhoneNumbers)
      .values(normalizedData)
      .returning();
    return result[0];
  }
  
  async updateBulkvsPhoneNumber(id: string, data: Partial<InsertBulkvsPhoneNumber>): Promise<BulkvsPhoneNumber | undefined> {
    // Normalize DID to 10-digit format before storage if provided
    const normalizedData = {
      ...data,
      did: data.did ? formatForStorage(data.did) : undefined,
      updatedAt: new Date(),
    };
    const result = await db
      .update(bulkvsPhoneNumbers)
      .set(normalizedData)
      .where(eq(bulkvsPhoneNumbers.id, id))
      .returning();
    return result[0];
  }
  
  // ==================== BULKVS THREADS ====================
  
  async getBulkvsThread(id: string): Promise<BulkvsThread | undefined> {
    const result = await db
      .select()
      .from(bulkvsThreads)
      .where(eq(bulkvsThreads.id, id));
    return result[0];
  }
  
  async getBulkvsThreadsByUser(userId: string, options?: { archived?: boolean; search?: string }): Promise<BulkvsThread[]> {
    let query = db
      .select()
      .from(bulkvsThreads)
      .where(eq(bulkvsThreads.userId, userId));
    
    if (options?.archived !== undefined) {
      query = query.where(eq(bulkvsThreads.isArchived, options.archived)) as any;
    }
    
    if (options?.search) {
      query = query.where(
        or(
          like(bulkvsThreads.displayName, `%${options.search}%`),
          like(bulkvsThreads.externalPhone, `%${options.search}%`),
          like(bulkvsThreads.lastMessagePreview, `%${options.search}%`)
        )
      ) as any;
    }
    
    return query.orderBy(desc(bulkvsThreads.lastMessageAt));
  }
  
  async getBulkvsThreadByPhoneAndExternal(phoneNumberId: string, externalPhone: string): Promise<BulkvsThread | undefined> {
    const result = await db
      .select()
      .from(bulkvsThreads)
      .where(
        and(
          eq(bulkvsThreads.phoneNumberId, phoneNumberId),
          eq(bulkvsThreads.externalPhone, externalPhone)
        )
      );
    return result[0];
  }
  
  async createBulkvsThread(data: InsertBulkvsThread): Promise<BulkvsThread> {
    const result = await db
      .insert(bulkvsThreads)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async updateBulkvsThread(id: string, data: Partial<InsertBulkvsThread>): Promise<BulkvsThread | undefined> {
    const result = await db
      .update(bulkvsThreads)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bulkvsThreads.id, id))
      .returning();
    return result[0];
  }
  
  async incrementThreadUnread(threadId: string): Promise<void> {
    await db
      .update(bulkvsThreads)
      .set({
        unreadCount: sql`${bulkvsThreads.unreadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(bulkvsThreads.id, threadId));
  }
  
  async markThreadAsRead(threadId: string): Promise<void> {
    await db
      .update(bulkvsThreads)
      .set({
        unreadCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(bulkvsThreads.id, threadId));
  }
  
  async deleteBulkvsThread(id: string, userId: string): Promise<boolean> {
    // First verify the thread belongs to this user
    const thread = await this.getBulkvsThread(id);
    if (!thread || thread.userId !== userId) {
      return false;
    }
    
    // Delete all messages in the thread first (if CASCADE is not set up)
    await db.delete(bulkvsMessages).where(eq(bulkvsMessages.threadId, id));
    
    // Delete the thread
    const result = await db
      .delete(bulkvsThreads)
      .where(and(
        eq(bulkvsThreads.id, id),
        eq(bulkvsThreads.userId, userId)
      ))
      .returning();
    
    return result.length > 0;
  }
  
  // ==================== BULKVS MESSAGES ====================
  
  async getBulkvsMessage(id: string): Promise<BulkvsMessage | undefined> {
    const result = await db
      .select()
      .from(bulkvsMessages)
      .where(eq(bulkvsMessages.id, id));
    return result[0];
  }
  
  async getBulkvsMessagesByThread(threadId: string, options?: { limit?: number; offset?: number }): Promise<BulkvsMessage[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    // Order by createdAt ASC (oldest first) for chronological display
    return db
      .select()
      .from(bulkvsMessages)
      .where(eq(bulkvsMessages.threadId, threadId))
      .orderBy(bulkvsMessages.createdAt)
      .limit(limit)
      .offset(offset);
  }
  
  async createBulkvsMessage(data: InsertBulkvsMessage): Promise<BulkvsMessage> {
    const result = await db
      .insert(bulkvsMessages)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }
  
  async updateBulkvsMessageStatus(id: string, status: string, deliveredAt?: Date, readAt?: Date): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (deliveredAt) {
      updateData.deliveredAt = deliveredAt;
    }
    
    if (readAt) {
      updateData.readAt = readAt;
    }
    
    await db
      .update(bulkvsMessages)
      .set(updateData)
      .where(eq(bulkvsMessages.id, id));
  }
  
  async searchBulkvsMessages(userId: string, query: string): Promise<BulkvsMessage[]> {
    return db
      .select({
        message: bulkvsMessages,
      })
      .from(bulkvsMessages)
      .innerJoin(bulkvsThreads, eq(bulkvsMessages.threadId, bulkvsThreads.id))
      .where(
        and(
          eq(bulkvsThreads.userId, userId),
          like(bulkvsMessages.body, `%${query}%`)
        )
      )
      .orderBy(desc(bulkvsMessages.createdAt))
      .then(results => results.map(r => r.message));
  }
  
  // ==================== MANUAL CONTACTS ====================
  
  async createManualContact(data: InsertManualContact): Promise<ManualContact> {
    // Normalize phone number to 11-digit format before storage
    const normalizedData = {
      ...data,
      phone: formatForStorage(data.phone),
    };
    
    const result = await db
      .insert(manualContacts)
      .values(normalizedData as any)
      .returning();
    return result[0];
  }
  
  async getManualContacts(companyId: string): Promise<ManualContact[]> {
    return db
      .select()
      .from(manualContacts)
      .where(eq(manualContacts.companyId, companyId))
      .orderBy(desc(manualContacts.createdAt));
  }
  
  async getManualContact(id: string): Promise<ManualContact | undefined> {
    const result = await db
      .select()
      .from(manualContacts)
      .where(eq(manualContacts.id, id));
    return result[0];
  }
  
  async deleteManualContact(id: string): Promise<void> {
    await db
      .delete(manualContacts)
      .where(eq(manualContacts.id, id));
  }

  async updateManualContact(id: string, data: Partial<InsertManualContact>): Promise<ManualContact | undefined> {
    // Normalize phone if provided
    const updateData = {
      ...data,
      phone: data.phone ? formatForStorage(data.phone) : undefined,
      updatedAt: new Date(),
    };
    
    const result = await db
      .update(manualContacts)
      .set(updateData)
      .where(eq(manualContacts.id, id))
      .returning();
    return result[0];
  }

  // ==================== UNIFIED CONTACTS ====================
  
  async upsertContact(data: InsertContact): Promise<Contact> {
    // Find existing contact by phone or email
    let existing: Contact | undefined;
    
    if (data.phoneNormalized) {
      existing = await this.getContactByPhone(data.companyId, data.phoneNormalized);
    }
    
    if (!existing && data.email) {
      existing = await this.getContactByEmail(data.companyId, data.email);
    }
    
    if (existing) {
      // MERGE existing contact - only update fields that are provided (non-null/non-undefined)
      // This prevents later sources from erasing data from earlier sources
      const updateData: Partial<InsertContact> = {
        // Only update if new value is provided (not null/undefined)
        firstName: data.firstName !== null && data.firstName !== undefined ? data.firstName : existing.firstName,
        lastName: data.lastName !== null && data.lastName !== undefined ? data.lastName : existing.lastName,
        displayName: data.displayName !== null && data.displayName !== undefined ? data.displayName : existing.displayName,
        email: data.email !== null && data.email !== undefined ? data.email : existing.email,
        phoneNormalized: data.phoneNormalized !== null && data.phoneNormalized !== undefined ? data.phoneNormalized : existing.phoneNormalized,
        phoneDisplay: data.phoneDisplay !== null && data.phoneDisplay !== undefined ? data.phoneDisplay : existing.phoneDisplay,
        companyName: data.companyName !== null && data.companyName !== undefined ? data.companyName : existing.companyName,
        notes: data.notes !== null && data.notes !== undefined ? data.notes : existing.notes,
        tags: data.tags !== null && data.tags !== undefined ? data.tags : existing.tags,
        lastContactedAt: data.lastContactedAt !== null && data.lastContactedAt !== undefined ? data.lastContactedAt : existing.lastContactedAt,
        updatedAt: new Date(),
      };
      
      const result = await db
        .update(contacts)
        .set(updateData)
        .where(eq(contacts.id, existing.id))
        .returning();
      return result[0];
    } else {
      // Insert new contact
      const result = await db
        .insert(contacts)
        .values(data as any)
        .returning();
      return result[0];
    }
  }
  
  async upsertContactSource(data: InsertContactSource): Promise<ContactSource> {
    // Try to find existing source by contactId + sourceType + sourceId
    const existing = await db
      .select()
      .from(contactSources)
      .where(
        and(
          eq(contactSources.contactId, data.contactId),
          eq(contactSources.sourceType, data.sourceType),
          eq(contactSources.sourceId, data.sourceId)
        )
      )
      .then(results => results[0]);
    
    if (existing) {
      // Update existing source
      const result = await db
        .update(contactSources)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(contactSources.id, existing.id))
        .returning();
      return result[0];
    } else {
      // Insert new source
      const result = await db
        .insert(contactSources)
        .values(data as any)
        .returning();
      return result[0];
    }
  }
  
  async getContactByPhone(companyId: string, phoneNormalized: string): Promise<Contact | undefined> {
    const result = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.companyId, companyId),
          eq(contacts.phoneNormalized, phoneNormalized)
        )
      );
    return result[0];
  }
  
  async getContactByEmail(companyId: string, email: string): Promise<Contact | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.companyId, companyId),
          eq(contacts.email, normalizedEmail)
        )
      );
    return result[0];
  }
  
  async getContactWithSources(contactId: string): Promise<Contact & { sources: ContactSource[] } | undefined> {
    const contact = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .then(results => results[0]);
    
    if (!contact) {
      return undefined;
    }
    
    const sources = await db
      .select()
      .from(contactSources)
      .where(eq(contactSources.contactId, contactId))
      .orderBy(desc(contactSources.createdAt));
    
    return {
      ...contact,
      sources,
    };
  }
  
  async getContacts(companyId: string, filters?: {
    search?: string;
    limit?: number;
    offset?: number;
    listId?: string;
    includeUnassignedOnly?: boolean;
    includeBlacklistOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ contacts: Array<Contact & { sourceCount: number }>; total: number }> {
    const { 
      search, 
      limit = 50, 
      offset = 0, 
      listId, 
      includeUnassignedOnly, 
      includeBlacklistOnly,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo
    } = filters || {};
    
    // ==================== QUERY UNIFIED CONTACTS TABLE ====================
    
    // Build where conditions for unified contacts
    const contactConditions = [
      eq(contacts.companyId, companyId),
      isNotNull(contacts.phoneNormalized) // Only show contacts with phone numbers
    ];
    
    if (search) {
      contactConditions.push(
        or(
          like(contacts.firstName, `%${search}%`),
          like(contacts.lastName, `%${search}%`),
          like(contacts.displayName, `%${search}%`),
          like(contacts.email, `%${search}%`),
          like(contacts.phoneDisplay, `%${search}%`)
        ) as any
      );
    }
    
    if (dateFrom) {
      contactConditions.push(gte(contacts.createdAt, dateFrom));
    }
    
    if (dateTo) {
      contactConditions.push(lt(contacts.createdAt, dateTo));
    }
    
    // Build base query for unified contacts
    let contactQuery = db
      .select({
        contact: contacts,
        sourceCount: sql<number>`COUNT(DISTINCT ${contactSources.id})::int`,
      })
      .from(contacts)
      .leftJoin(contactSources, eq(contactSources.contactId, contacts.id));
    
    // Apply list filtering for unified contacts
    if (includeUnassignedOnly) {
      const notExistsCondition = sql`NOT EXISTS (
        SELECT 1 FROM ${contactListMembers} 
        WHERE ${contactListMembers.contactId} = ${contacts.id}
      )`;
      contactConditions.push(notExistsCondition as any);
    } else if (includeBlacklistOnly) {
      const existsBlacklistCondition = sql`EXISTS (
        SELECT 1 FROM ${blacklistEntries} 
        WHERE ${blacklistEntries.companyId} = ${companyId}
        AND ${blacklistEntries.isActive} = true
        AND (
          ${blacklistEntries.identifier} = ${contacts.phoneNormalized}
          OR (${contacts.email} IS NOT NULL AND ${blacklistEntries.identifier} = ${contacts.email})
        )
      )`;
      contactConditions.push(existsBlacklistCondition as any);
    } else if (listId) {
      contactQuery = contactQuery.innerJoin(
        contactListMembers, 
        and(
          eq(contactListMembers.contactId, contacts.id),
          eq(contactListMembers.listId, listId)
        )
      );
    }
    
    contactQuery = contactQuery
      .where(and(...contactConditions) as any)
      .groupBy(contacts.id);
    
    // ==================== QUERY MANUAL CONTACTS TABLE (BACKWARDS COMPATIBILITY) ====================
    
    // Build where conditions for manual contacts
    const manualConditions = [
      eq(manualContacts.companyId, companyId),
      isNotNull(manualContacts.phone) // Only show contacts with phone numbers
    ];
    
    if (search) {
      manualConditions.push(
        or(
          like(manualContacts.firstName, `%${search}%`),
          like(manualContacts.lastName, `%${search}%`),
          like(manualContacts.email, `%${search}%`),
          like(manualContacts.phone, `%${search}%`)
        ) as any
      );
    }
    
    if (dateFrom) {
      manualConditions.push(gte(manualContacts.createdAt, dateFrom));
    }
    
    if (dateTo) {
      manualConditions.push(lt(manualContacts.createdAt, dateTo));
    }
    
    // Build base query for manual contacts
    let manualQuery = db
      .select({
        contact: manualContacts,
      })
      .from(manualContacts);
    
    // Apply list filtering for manual contacts
    if (includeUnassignedOnly) {
      const notExistsCondition = sql`NOT EXISTS (
        SELECT 1 FROM ${contactListMembers} 
        WHERE ${contactListMembers.contactId} = ${manualContacts.id}
      )`;
      manualConditions.push(notExistsCondition as any);
    } else if (includeBlacklistOnly) {
      const existsBlacklistCondition = sql`EXISTS (
        SELECT 1 FROM ${blacklistEntries} 
        WHERE ${blacklistEntries.companyId} = ${companyId}
        AND ${blacklistEntries.isActive} = true
        AND (
          ${blacklistEntries.identifier} = ${manualContacts.phone}
          OR (${manualContacts.email} IS NOT NULL AND ${blacklistEntries.identifier} = ${manualContacts.email})
        )
      )`;
      manualConditions.push(existsBlacklistCondition as any);
    } else if (listId) {
      manualQuery = manualQuery.innerJoin(
        contactListMembers, 
        and(
          eq(contactListMembers.contactId, manualContacts.id),
          eq(contactListMembers.listId, listId)
        )
      );
    }
    
    manualQuery = manualQuery.where(and(...manualConditions) as any);
    
    // ==================== EXECUTE QUERIES AND MERGE RESULTS ====================
    
    // Execute both queries
    const [unifiedResults, manualResults] = await Promise.all([
      contactQuery,
      manualQuery,
    ]);
    
    // Format unified contacts
    const unifiedContacts = unifiedResults.map(row => ({
      ...row.contact,
      sourceCount: row.sourceCount,
    }));
    
    // Project manual contacts as Contact type with synthetic sourceCount
    const manualContactsProjected = manualResults.map((row: any) => {
      const mc = row.contact || row;
      return {
        id: mc.id,
        companyId: mc.companyId,
        firstName: mc.firstName,
        lastName: mc.lastName,
        displayName: `${mc.firstName || ''} ${mc.lastName || ''}`.trim() || null,
        email: mc.email,
        phoneNormalized: mc.phone, // Manual contacts use 'phone' field
        phoneDisplay: mc.phone,
        companyName: mc.companyName,
        notes: mc.notes,
        tags: null,
        lastContactedAt: null,
        createdAt: mc.createdAt,
        updatedAt: mc.updatedAt,
        sourceCount: 1, // Manual contacts have synthetic sourceCount of 1
      } as Contact & { sourceCount: number };
    });
    
    // Merge results: deduplicating by phone/email (prefer contacts table over manualContacts)
    const mergedMap = new Map<string, Contact & { sourceCount: number }>();
    
    // Add unified contacts first (they take priority)
    unifiedContacts.forEach(contact => {
      const key = contact.phoneNormalized || contact.email || contact.id;
      mergedMap.set(key, contact);
    });
    
    // Add manual contacts only if not already present
    manualContactsProjected.forEach(contact => {
      const key = contact.phoneNormalized || contact.email || contact.id;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, contact);
      }
    });
    
    // Convert map to array
    let allContacts = Array.from(mergedMap.values());
    
    // ==================== APPLY SORTING ====================
    
    const sortColumn = sortBy === 'name' 
      ? 'firstName' 
      : sortBy === 'email' 
      ? 'email' 
      : sortBy === 'phone' 
      ? 'phoneDisplay'
      : sortBy === 'createdAt'
      ? 'createdAt'
      : 'updatedAt';
    
    allContacts.sort((a, b) => {
      const aVal = a[sortColumn as keyof typeof a] || '';
      const bVal = b[sortColumn as keyof typeof b] || '';
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    // ==================== APPLY PAGINATION ====================
    
    const total = allContacts.length;
    const paginatedContacts = allContacts.slice(offset, offset + limit);
    
    return {
      contacts: paginatedContacts,
      total,
    };
  }
  
  async getLandingLead(id: string): Promise<any> {
    const result = await db
      .select()
      .from(landingLeads)
      .where(eq(landingLeads.id, id));
    return result[0];
  }

  async listContacts(params: {
    companyId: string;
    page: number;
    limit: number;
    search?: string;
    listId?: string;
    includeUnassignedOnly?: boolean;
    includeBlacklistOnly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ contacts: ManualContact[]; total: number; page: number; limit: number }> {
    const { companyId, page, limit, search, listId, includeUnassignedOnly, includeBlacklistOnly, sortBy = 'createdAt', sortOrder = 'desc', dateFrom, dateTo } = params;
    const offset = (page - 1) * limit;
    
    // Build where conditions
    const conditions = [eq(manualContacts.companyId, companyId)];
    
    if (search) {
      conditions.push(
        or(
          like(manualContacts.firstName, `%${search}%`),
          like(manualContacts.lastName, `%${search}%`),
          like(manualContacts.email, `%${search}%`),
          like(manualContacts.phone, `%${search}%`)
        ) as any
      );
    }
    
    if (dateFrom) {
      conditions.push(gte(manualContacts.createdAt, dateFrom));
    }
    
    if (dateTo) {
      conditions.push(lt(manualContacts.createdAt, dateTo));
    }
    
    // Build base query
    let query = db.select({ contact: manualContacts }).from(manualContacts);
    
    // Handle different filtering scenarios
    if (includeUnassignedOnly) {
      // Show only contacts NOT in any list using NOT EXISTS subquery
      // Note: notExists is not available in Drizzle, so we use raw SQL with parameterized value
      const notExistsCondition = sql`NOT EXISTS (
        SELECT 1 FROM ${contactListMembers} 
        WHERE ${contactListMembers.contactId} = ${manualContacts.id}
      )`;
      conditions.push(notExistsCondition as any);
      query = query.where(and(...conditions) as any) as any;
    } else if (includeBlacklistOnly) {
      // Show only contacts that are in blacklist using EXISTS subquery
      const existsBlacklistCondition = sql`EXISTS (
        SELECT 1 FROM ${blacklistEntries} 
        WHERE ${blacklistEntries.companyId} = ${companyId}
        AND ${blacklistEntries.isActive} = true
        AND (
          ${blacklistEntries.identifier} = ${manualContacts.phone}
          OR (${manualContacts.email} IS NOT NULL AND ${blacklistEntries.identifier} = ${manualContacts.email})
        )
      )`;
      conditions.push(existsBlacklistCondition as any);
      query = query.where(and(...conditions) as any) as any;
    } else if (listId) {
      // Show contacts in a specific list using INNER JOIN
      query = query
        .innerJoin(contactListMembers, eq(contactListMembers.contactId, manualContacts.id))
        .where(and(
          ...conditions,
          eq(contactListMembers.listId, listId)
        ) as any) as any;
    } else {
      // Show all contacts
      query = query.where(and(...conditions) as any) as any;
    }
    
    // Get total count with same filtering logic
    let countQuery;
    if (includeUnassignedOnly) {
      const notExistsCondition = sql`NOT EXISTS (
        SELECT 1 FROM ${contactListMembers} 
        WHERE ${contactListMembers.contactId} = ${manualContacts.id}
      )`;
      countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(manualContacts)
        .where(and(
          ...conditions,
          notExistsCondition
        ) as any);
    } else if (includeBlacklistOnly) {
      const existsBlacklistCondition = sql`EXISTS (
        SELECT 1 FROM ${blacklistEntries} 
        WHERE ${blacklistEntries.companyId} = ${companyId}
        AND ${blacklistEntries.isActive} = true
        AND (
          ${blacklistEntries.identifier} = ${manualContacts.phone}
          OR (${manualContacts.email} IS NOT NULL AND ${blacklistEntries.identifier} = ${manualContacts.email})
        )
      )`;
      countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(manualContacts)
        .where(and(
          ...conditions,
          existsBlacklistCondition
        ) as any);
    } else if (listId) {
      countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(manualContacts)
        .innerJoin(contactListMembers, eq(contactListMembers.contactId, manualContacts.id))
        .where(and(
          ...conditions,
          eq(contactListMembers.listId, listId)
        ) as any);
    } else {
      countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(manualContacts)
        .where(and(...conditions) as any);
    }
    
    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;
    
    // Apply sorting
    const sortColumn = sortBy === 'name' 
      ? manualContacts.firstName 
      : sortBy === 'email' 
      ? manualContacts.email 
      : sortBy === 'phone' 
      ? manualContacts.phone 
      : manualContacts.createdAt;
    
    const sortedQuery = sortOrder === 'asc' 
      ? query.orderBy(sortColumn)
      : query.orderBy(desc(sortColumn));
    
    // Apply pagination
    const paginatedResults = await sortedQuery.limit(limit).offset(offset);
    const contactsData = paginatedResults.map(r => (r as any).contact || r);
    
    // Get contact IDs for fetching their lists
    const contactIds = contactsData.map(c => c.id);
    
    // Fetch lists for each contact in a single query
    const contactListsData = contactIds.length > 0 ? await db
      .select({
        contactId: contactListMembers.contactId,
        listId: contactLists.id,
        listName: contactLists.name,
      })
      .from(contactListMembers)
      .innerJoin(contactLists, eq(contactLists.id, contactListMembers.listId))
      .where(inArray(contactListMembers.contactId, contactIds)) : [];
    
    // Group lists by contact ID
    const listsByContact = contactListsData.reduce((acc, item) => {
      if (!acc[item.contactId]) {
        acc[item.contactId] = [];
      }
      acc[item.contactId].push({
        id: item.listId,
        name: item.listName,
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; name: string }>>);
    
    // Attach lists to contacts
    const contacts = contactsData.map(contact => ({
      ...contact,
      lists: listsByContact[contact.id] || [],
    }));
    
    return { contacts, total, page, limit };
  }

  async filterContacts(params: {
    companyId: string;
    searchTerm?: string;
    listIds?: string[];
    dateRange?: { from: Date; to: Date };
  }): Promise<ManualContact[]> {
    const { companyId, searchTerm, listIds, dateRange } = params;
    
    const conditions = [eq(manualContacts.companyId, companyId)];
    
    if (searchTerm) {
      conditions.push(
        or(
          like(manualContacts.firstName, `%${searchTerm}%`),
          like(manualContacts.lastName, `%${searchTerm}%`),
          like(manualContacts.email, `%${searchTerm}%`),
          like(manualContacts.phone, `%${searchTerm}%`)
        ) as any
      );
    }
    
    if (dateRange) {
      conditions.push(
        and(
          gte(manualContacts.createdAt, dateRange.from),
          lt(manualContacts.createdAt, dateRange.to)
        ) as any
      );
    }
    
    let query = db.select().from(manualContacts);
    
    if (listIds && listIds.length > 0) {
      query = query
        .innerJoin(contactListMembers, eq(contactListMembers.contactId, manualContacts.id))
        .where(and(
          ...conditions,
          inArray(contactListMembers.listId, listIds)
        ) as any) as any;
    } else {
      query = query.where(and(...conditions) as any) as any;
    }
    
    const results = await query;
    return results.map(r => (r as any).manualContacts || r);
  }

  async bulkDeleteContacts(companyId: string, contactIds: string[]): Promise<{ deleted: number }> {
    if (!contactIds.length) return { deleted: 0 };
    
    const result = await db
      .delete(manualContacts)
      .where(and(
        eq(manualContacts.companyId, companyId),
        inArray(manualContacts.id, contactIds)
      ));
    
    // Return the number of deleted contacts
    return { deleted: contactIds.length };
  }

  async bulkAddToList(companyId: string, contactIds: string[], listId: string): Promise<{ added: number }> {
    if (!contactIds.length) return { added: 0 };
    
    // Verify all contacts belong to this company
    const contacts = await db
      .select({ id: manualContacts.id })
      .from(manualContacts)
      .where(and(
        eq(manualContacts.companyId, companyId),
        inArray(manualContacts.id, contactIds)
      ));
    
    const validContactIds = contacts.map(c => c.id);
    
    // Get existing members to avoid duplicates
    const existing = await db
      .select({ contactId: contactListMembers.contactId })
      .from(contactListMembers)
      .where(eq(contactListMembers.listId, listId));
    
    const existingContactIds = new Set(existing.map(e => e.contactId));
    const toAdd = validContactIds
      .filter(id => !existingContactIds.has(id))
      .map(contactId => ({
        listId,
        contactId,
      }));
    
    if (toAdd.length > 0) {
      await db.insert(contactListMembers).values(toAdd);
    }
    
    return { added: toAdd.length };
  }

  async bulkAddContactsToList(companyId: string, listId: string, contactIds: string[]): Promise<{ addedIds: string[]; skippedIds: string[] }> {
    if (!contactIds.length) return { addedIds: [], skippedIds: [] };
    
    // Verify all contacts belong to this company
    const contacts = await db
      .select({ id: manualContacts.id })
      .from(manualContacts)
      .where(and(
        eq(manualContacts.companyId, companyId),
        inArray(manualContacts.id, contactIds)
      ));
    
    const validContactIds = contacts.map(c => c.id);
    
    // Get existing members to avoid duplicates
    const existing = await db
      .select({ contactId: contactListMembers.contactId })
      .from(contactListMembers)
      .where(eq(contactListMembers.listId, listId));
    
    const existingContactIds = new Set(existing.map(e => e.contactId));
    
    // Separate contacts into those to add and those to skip (duplicates)
    const addedIds: string[] = [];
    const skippedIds: string[] = [];
    
    const toAdd: { id: string; listId: string; contactId: string }[] = [];
    
    for (const contactId of validContactIds) {
      if (existingContactIds.has(contactId)) {
        skippedIds.push(contactId);
      } else {
        addedIds.push(contactId);
        toAdd.push({
          id: crypto.randomUUID(),
          listId,
          contactId,
        });
      }
    }
    
    // Insert new memberships
    if (toAdd.length > 0) {
      await db.insert(contactListMembers).values(toAdd);
    }
    
    return { addedIds, skippedIds };
  }

  async bulkRemoveFromList(companyId: string, contactIds: string[], listId: string): Promise<{ removed: number }> {
    if (!contactIds.length) return { removed: 0 };
    
    // Verify all contacts belong to this company
    const contacts = await db
      .select({ id: manualContacts.id })
      .from(manualContacts)
      .where(and(
        eq(manualContacts.companyId, companyId),
        inArray(manualContacts.id, contactIds)
      ));
    
    const validContactIds = contacts.map(c => c.id);
    
    if (validContactIds.length > 0) {
      await db
        .delete(contactListMembers)
        .where(and(
          eq(contactListMembers.listId, listId),
          inArray(contactListMembers.contactId, validContactIds)
        ));
    }
    
    return { removed: validContactIds.length };
  }

  async moveContactsBetweenLists(
    companyId: string, 
    contactIds: string[], 
    fromListId: string, 
    toListId: string
  ): Promise<{ moved: number }> {
    const removed = await this.bulkRemoveFromList(companyId, contactIds, fromListId);
    const added = await this.bulkAddToList(companyId, contactIds, toListId);
    return { moved: added.added };
  }

  async exportContactsCSV(companyId: string, contactIds?: string[]): Promise<string> {
    let query = db
      .select()
      .from(manualContacts)
      .where(eq(manualContacts.companyId, companyId));
    
    if (contactIds && contactIds.length > 0) {
      query = query.where(and(
        eq(manualContacts.companyId, companyId),
        inArray(manualContacts.id, contactIds)
      )) as any;
    }
    
    const contacts = await query;
    
    // Build CSV
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Notes', 'Created At'];
    const rows = contacts.map(contact => [
      contact.firstName,
      contact.lastName,
      contact.email || '',
      formatForDisplay(contact.phone),
      contact.notes || '',
      contact.createdAt.toISOString(),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }

  async importContactsCSV(
    companyId: string, 
    csvData: string, 
    userId: string
  ): Promise<{
    imported: number;
    duplicates: number;
    errors: string[];
    preview?: ManualContact[];
    importedContactIds?: string[];
  }> {
    const errors: string[] = [];
    const preview: ManualContact[] = [];
    const importedContactIds: string[] = [];
    let imported = 0;
    let duplicates = 0;
    
    try {
      // Parse CSV (simple implementation - can be enhanced with csv-parse library)
      const lines = csvData.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      
      // Map headers to fields
      const fieldMap: Record<string, string> = {
        'first name': 'firstName',
        'firstname': 'firstName',
        'last name': 'lastName',
        'lastname': 'lastName',
        'email': 'email',
        'phone': 'phone',
        'notes': 'notes',
      };
      
      const columnIndexes: Record<string, number> = {};
      headers.forEach((header, index) => {
        const field = fieldMap[header];
        if (field) {
          columnIndexes[field] = index;
        }
      });
      
      // Process data rows
      for (let i = 1; i < lines.length && i <= 5; i++) { // Preview first 5 rows
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        const contact: any = {
          companyId,
          userId,
          firstName: values[columnIndexes['firstName']] || '',
          lastName: values[columnIndexes['lastName']] || '',
          email: values[columnIndexes['email']] || null,
          phone: values[columnIndexes['phone']] || '',
          notes: values[columnIndexes['notes']] || null,
        };
        
        // Validate required fields
        if (!contact.firstName || !contact.lastName || !contact.phone) {
          errors.push(`Row ${i}: Missing required fields`);
          continue;
        }
        
        // Normalize phone
        contact.phone = formatForStorage(contact.phone);
        
        // Check for duplicates
        const existing = await db
          .select()
          .from(manualContacts)
          .where(and(
            eq(manualContacts.companyId, companyId),
            or(
              and(
                eq(manualContacts.email, contact.email),
                sql`${contact.email} IS NOT NULL`
              ),
              eq(manualContacts.phone, contact.phone)
            )
          ))
          .limit(1);
        
        if (existing.length > 0) {
          duplicates++;
          continue;
        }
        
        preview.push(contact as ManualContact);
      }
      
      // Actually import all valid rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        const contact: any = {
          companyId,
          userId,
          firstName: values[columnIndexes['firstName']] || '',
          lastName: values[columnIndexes['lastName']] || '',
          email: values[columnIndexes['email']] || null,
          phone: values[columnIndexes['phone']] || '',
          notes: values[columnIndexes['notes']] || null,
        };
        
        // Validate and import
        if (!contact.firstName || !contact.lastName || !contact.phone) {
          continue;
        }
        
        contact.phone = formatForStorage(contact.phone);
        
        try {
          const result = await db.insert(manualContacts).values(contact).returning({ id: manualContacts.id });
          if (result.length > 0) {
            imported++;
            importedContactIds.push(result[0].id);
          }
        } catch (error) {
          // Duplicate or other error
          duplicates++;
        }
      }
      
    } catch (error: any) {
      errors.push(`CSV parsing error: ${error.message}`);
    }
    
    return {
      imported,
      duplicates,
      errors,
      preview: preview.slice(0, 5), // Return first 5 for preview
      importedContactIds,
    };
  }

  // Contact Engagements
  async createContactEngagement(data: InsertContactEngagement): Promise<ContactEngagement> {
    const result = await db
      .insert(contactEngagements)
      .values(data as any)
      .returning();
    return result[0];
  }

  async getContactEngagements(contactId: string): Promise<ContactEngagement[]> {
    return db
      .select()
      .from(contactEngagements)
      .where(eq(contactEngagements.contactId, contactId))
      .orderBy(desc(contactEngagements.engagementDate));
  }
  
  // ==================== UNIFIED CONTACTS ====================
  
  async getUnifiedContacts(params?: { companyId?: string; userId?: string; origin?: string; status?: string; productType?: string }): Promise<UnifiedContact[]> {
    // Build where conditions for quotes
    const quoteConditions = [];
    if (params?.companyId) quoteConditions.push(eq(quoteMembers.companyId, params.companyId));
    if (params?.userId) quoteConditions.push(eq(quotes.agentId, params.userId));
    const quoteWhere = quoteConditions.length > 0 ? and(...quoteConditions) : sql`1=1`;

    // Build where conditions for policies
    const policyConditions = [];
    if (params?.companyId) policyConditions.push(eq(policyMembers.companyId, params.companyId));
    if (params?.userId) policyConditions.push(eq(policies.agentId, params.userId));
    const policyWhere = policyConditions.length > 0 ? and(...policyConditions) : sql`1=1`;

    // Build where conditions for manual contacts
    const manualContactConditions = [];
    if (params?.companyId) manualContactConditions.push(eq(manualContacts.companyId, params.companyId));
    if (params?.userId) manualContactConditions.push(eq(manualContacts.userId, params.userId));
    const manualContactWhere = manualContactConditions.length > 0 ? and(...manualContactConditions) : sql`1=1`;

    // Load data in parallel from all sources (EXCLUDING users/employees and SMS threads)
    const [quoteMembersData, policyMembersData, manualContactsData, companiesData] = await Promise.all([
      // Quote members with quote info
      db.select({
        member: quoteMembers,
        quote: quotes,
      })
        .from(quoteMembers)
        .innerJoin(quotes, eq(quoteMembers.quoteId, quotes.id))
        .where(quoteWhere),
      
      // Policy members with policy info
      db.select({
        member: policyMembers,
        policy: policies,
      })
        .from(policyMembers)
        .innerJoin(policies, eq(policyMembers.policyId, policies.id))
        .where(policyWhere),
      
      // Manual contacts
      db.select()
        .from(manualContacts)
        .where(manualContactWhere),
      
      // Load all companies for mapping
      db.select().from(companies)
    ]);
    
    // Create a company map for quick lookups
    const companyMap = new Map<string, Company>();
    companiesData.forEach(company => companyMap.set(company.id, company));
    
    // Helper function to normalize phone numbers
    const normalizePhone = (phone: string | null | undefined): string | null => {
      if (!phone) return null;
      return formatForStorage(phone);
    };
    
    // Helper function to generate consistent displayName
    // PRIORITY: firstName+lastName > companyName > null
    // Always treat empty strings as absent
    const generateDisplayName = (
      firstName: string | null | undefined,
      lastName: string | null | undefined,
      companyName: string | null | undefined
    ): string | null => {
      // Treat empty strings as null
      const cleanFirst = firstName?.trim() || null;
      const cleanLast = lastName?.trim() || null;
      const cleanCompany = companyName?.trim() || null;
      
      // Build name from first+last
      const parts = [cleanFirst, cleanLast].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(" ");
      }
      
      // Fallback to company name
      if (cleanCompany) {
        return cleanCompany;
      }
      
      // No meaningful name available
      return null;
    };
    
    // Helper function to map sources to UnifiedContact
    const rawContacts: UnifiedContact[] = [];
    
    // Map quote members
    quoteMembersData.forEach(({ member, quote }) => {
      const companyName = companyMap.get(member.companyId)?.name || null;
      
      rawContacts.push({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        displayName: generateDisplayName(member.firstName, member.lastName, companyName),
        email: member.email || null,
        phone: normalizePhone(member.phone),
        ssn: member.ssn || null,
        dateOfBirth: member.dateOfBirth || null,
        status: [quote.status],
        productType: [quote.productType],
        origin: ['quote'],
        companyId: member.companyId,
        companyName,
        sourceMetadata: [{
          type: 'quote',
          id: quote.id,
          details: {
            quoteId: quote.id,
            memberId: member.id,
            role: member.role,
            effectiveDate: quote.effectiveDate,
          }
        }]
      });
    });
    
    // Map policy members
    policyMembersData.forEach(({ member, policy }) => {
      const companyName = companyMap.get(member.companyId)?.name || null;
      
      rawContacts.push({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        displayName: generateDisplayName(member.firstName, member.lastName, companyName),
        email: member.email || null,
        phone: normalizePhone(member.phone),
        ssn: member.ssn || null,
        dateOfBirth: member.dateOfBirth || null,
        status: [policy.status],
        productType: [policy.productType],
        origin: ['policy'],
        companyId: member.companyId,
        companyName,
        sourceMetadata: [{
          type: 'policy',
          id: policy.id,
          details: {
            policyId: policy.id,
            memberId: member.id,
            role: member.role,
            effectiveDate: policy.effectiveDate,
          }
        }]
      });
    });
    
    // Map manual contacts
    manualContactsData.forEach(contact => {
      const companyName = companyMap.get(contact.companyId)?.name || null;
      
      rawContacts.push({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        displayName: generateDisplayName(contact.firstName, contact.lastName, companyName),
        email: contact.email || null,
        phone: normalizePhone(contact.phone),
        ssn: null,
        dateOfBirth: null,
        status: [],
        productType: [],
        origin: ['manual'],
        companyId: contact.companyId,
        companyName,
        sourceMetadata: [{
          type: 'manual',
          id: contact.id,
          details: {
            contactId: contact.id,
            userId: contact.userId,
            notes: contact.notes,
            createdAt: contact.createdAt,
          }
        }]
      });
    });
    
    // NOTE: BulkVS threads (SMS contacts) are NOT included in unified contacts
    // They are managed separately in the Chat interface only
    
    // Deduplicate contacts by priority: ssn → phone+dob → email → name+company
    // IMPORTANT: All deduplication keys MUST include companyId to prevent mixing contacts between companies
    const deduplicationMap = new Map<string, UnifiedContact>();
    
    rawContacts.forEach(contact => {
      let key: string | null = null;
      
      // Priority 1: SSN + Company (if exists)
      if (contact.ssn && contact.companyId) {
        key = `ssn:${contact.ssn}:${contact.companyId}`;
      }
      // Priority 2: Phone + DOB + Company (if all exist)
      else if (contact.phone && contact.dateOfBirth && contact.companyId) {
        key = `phone_dob:${contact.phone}:${contact.dateOfBirth}:${contact.companyId}`;
      }
      // Priority 3: Email + Company (if both exist)
      else if (contact.email && contact.companyId) {
        key = `email:${contact.email.toLowerCase()}:${contact.companyId}`;
      }
      // Priority 4: Name + Company (if all exist)
      else if (contact.firstName && contact.lastName && contact.companyId) {
        key = `name_company:${contact.firstName.toLowerCase()}:${contact.lastName.toLowerCase()}:${contact.companyId}`;
      }
      // Fallback: Use ID + Company if no other key can be generated
      else {
        key = `id:${contact.id}:${contact.companyId || 'no-company'}`;
      }
      
      // Merge if key exists, otherwise add new
      if (deduplicationMap.has(key)) {
        const existing = deduplicationMap.get(key)!;
        
        // Merge status arrays (unique values only)
        existing.status = [...new Set([...existing.status, ...contact.status])];
        
        // Merge productType arrays (unique values only)
        existing.productType = [...new Set([...existing.productType, ...contact.productType])];
        
        // Merge origin arrays (unique values only)
        existing.origin = [...new Set([...existing.origin, ...contact.origin])];
        
        // Merge sourceMetadata
        existing.sourceMetadata = [...existing.sourceMetadata, ...contact.sourceMetadata];
        
        // Fill in missing fields from new contact if existing has nulls
        // Treat empty strings as null when merging
        if (!existing.firstName?.trim() && contact.firstName?.trim()) existing.firstName = contact.firstName.trim();
        if (!existing.lastName?.trim() && contact.lastName?.trim()) existing.lastName = contact.lastName.trim();
        if (!existing.email?.trim() && contact.email?.trim()) existing.email = contact.email.trim();
        if (!existing.phone && contact.phone) existing.phone = contact.phone;
        if (!existing.ssn && contact.ssn) existing.ssn = contact.ssn;
        if (!existing.dateOfBirth && contact.dateOfBirth) existing.dateOfBirth = contact.dateOfBirth;
        if (!existing.companyId && contact.companyId) existing.companyId = contact.companyId;
        if (!existing.companyName?.trim() && contact.companyName?.trim()) existing.companyName = contact.companyName.trim();
        
        // CRITICAL: Recalculate displayName AFTER merging all fields
        // This ensures we always have the best displayName based on the merged data
        existing.displayName = generateDisplayName(
          existing.firstName,
          existing.lastName,
          existing.companyName
        );
      } else {
        deduplicationMap.set(key, contact);
      }
    });
    
    // Convert map to array
    let unifiedContacts = Array.from(deduplicationMap.values());
    
    // CRITICAL: Recalculate displayName for ALL contacts after deduplication
    // This ensures person names always take priority over company names
    unifiedContacts = unifiedContacts.map(contact => ({
      ...contact,
      displayName: generateDisplayName(
        contact.firstName,
        contact.lastName,
        contact.companyName
      )
    }));
    
    // Apply filters if provided
    if (params?.origin) {
      unifiedContacts = unifiedContacts.filter(contact => 
        contact.origin.includes(params.origin as any)
      );
    }
    
    if (params?.status) {
      unifiedContacts = unifiedContacts.filter(contact => 
        contact.status.includes(params.status!)
      );
    }
    
    if (params?.productType) {
      unifiedContacts = unifiedContacts.filter(contact => 
        contact.productType.includes(params.productType!)
      );
    }
    
    return unifiedContacts;
  }

  // ==================== BLACKLIST ====================

  async addToBlacklist(data: {
    companyId: string;
    channel: "sms" | "imessage" | "email" | "all";
    identifier: string;
    reason: string;
    addedBy?: string;
    notes?: string;
    metadata?: any;
  }): Promise<BlacklistEntry> {
    // Normalize identifier based on channel
    let normalizedIdentifier = data.identifier;
    
    if (data.channel === "sms" || data.channel === "imessage") {
      // For phone channels, use E.164 format
      normalizedIdentifier = formatForStorage(data.identifier);
    } else if (data.channel === "email") {
      // For email, use lowercase trimmed format
      normalizedIdentifier = data.identifier.toLowerCase().trim();
    } else if (data.channel === "all") {
      // For "all" channel, trim the identifier
      normalizedIdentifier = data.identifier.trim();
    }
    
    try {
      // Check if an entry already exists (active or inactive)
      const existingEntry = await db.select()
        .from(blacklistEntries)
        .where(and(
          eq(blacklistEntries.companyId, data.companyId),
          eq(blacklistEntries.channel, data.channel),
          eq(blacklistEntries.identifier, normalizedIdentifier)
        ))
        .limit(1);
      
      if (existingEntry.length > 0) {
        const entry = existingEntry[0];
        
        if (entry.isActive) {
          // Entry is already active - throw meaningful error
          throw new Error("Already blacklisted on this channel");
        }
        
        // Entry exists but is inactive - reactivate it
        const reactivated = await db.update(blacklistEntries)
          .set({
            isActive: true,
            removedAt: null,
            removedBy: null,
            reason: data.reason,
            addedBy: data.addedBy,
            notes: data.notes,
            metadata: data.metadata,
            updatedAt: new Date(),
          })
          .where(eq(blacklistEntries.id, entry.id))
          .returning();
        
        return reactivated[0];
      }
      
      // No existing entry - create new one
      const result = await db.insert(blacklistEntries).values({
        companyId: data.companyId,
        channel: data.channel,
        identifier: normalizedIdentifier,
        reason: data.reason,
        addedBy: data.addedBy,
        notes: data.notes,
        metadata: data.metadata,
        isActive: true,
      }).returning();
      
      return result[0];
    } catch (error: any) {
      // Handle unique constraint violations gracefully
      if (error.message === "Already blacklisted on this channel") {
        throw error; // Re-throw our meaningful error
      }
      
      // Check for database unique constraint errors
      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        throw new Error("Already blacklisted on this channel");
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  async removeFromBlacklist(params: {
    companyId: string;
    channel: string;
    identifier: string;
    removedBy?: string;
  }): Promise<boolean> {
    // Normalize identifier based on channel
    let normalizedIdentifier = params.identifier;
    
    if (params.channel === "sms" || params.channel === "imessage") {
      normalizedIdentifier = formatForStorage(params.identifier);
    } else if (params.channel === "email") {
      normalizedIdentifier = params.identifier.toLowerCase().trim();
    } else if (params.channel === "all") {
      // For "all" channel, trim the identifier
      normalizedIdentifier = params.identifier.trim();
    }
    
    // Find and soft-delete the active entry
    const result = await db.update(blacklistEntries)
      .set({
        isActive: false,
        removedAt: new Date(),
        removedBy: params.removedBy,
      })
      .where(and(
        eq(blacklistEntries.companyId, params.companyId),
        eq(blacklistEntries.channel, params.channel),
        eq(blacklistEntries.identifier, normalizedIdentifier),
        eq(blacklistEntries.isActive, true)
      ))
      .returning();
    
    return result.length > 0;
  }

  async isBlacklisted(params: {
    companyId: string;
    channel: string;
    identifier: string;
  }): Promise<boolean> {
    // Normalize identifier based on channel
    let normalizedIdentifier = params.identifier;
    
    if (params.channel === "sms" || params.channel === "imessage") {
      normalizedIdentifier = formatForStorage(params.identifier);
    } else if (params.channel === "email") {
      normalizedIdentifier = params.identifier.toLowerCase().trim();
    } else if (params.channel === "all") {
      // For "all" channel, trim the identifier
      normalizedIdentifier = params.identifier.trim();
    }
    
    // Check for active entry matching companyId + channel + identifier
    // Also check for channel="all" entries as fallback
    const result = await db.select()
      .from(blacklistEntries)
      .where(and(
        eq(blacklistEntries.companyId, params.companyId),
        eq(blacklistEntries.isActive, true),
        or(
          and(
            eq(blacklistEntries.channel, params.channel),
            eq(blacklistEntries.identifier, normalizedIdentifier)
          ),
          and(
            eq(blacklistEntries.channel, "all"),
            eq(blacklistEntries.identifier, normalizedIdentifier)
          )
        )
      ))
      .limit(1);
    
    return result.length > 0;
  }

  async getBlacklistEntries(companyId: string, filters?: {
    channel?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ entries: BlacklistEntry[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;
    
    // Build where conditions
    const conditions = [eq(blacklistEntries.companyId, companyId)];
    
    if (filters?.channel) {
      conditions.push(eq(blacklistEntries.channel, filters.channel));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(blacklistEntries.isActive, filters.isActive));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          like(blacklistEntries.identifier, `%${filters.search}%`),
          like(blacklistEntries.notes, `%${filters.search}%`)
        )!
      );
    }
    
    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(blacklistEntries)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);
    
    // Get entries with pagination
    const entries = await db.select()
      .from(blacklistEntries)
      .where(and(...conditions))
      .orderBy(desc(blacklistEntries.createdAt))
      .limit(limit)
      .offset(offset);
    
    return { entries, total };
  }

  async getBlacklistEntry(id: string): Promise<BlacklistEntry | undefined> {
    const result = await db.select()
      .from(blacklistEntries)
      .where(eq(blacklistEntries.id, id));
    
    return result[0];
  }

  async getBlacklistEntryByIdentifier(params: {
    companyId: string;
    channel: string;
    identifier: string;
  }): Promise<BlacklistEntry | undefined> {
    // Normalize identifier based on channel
    let normalizedIdentifier = params.identifier;
    
    if (params.channel === "sms" || params.channel === "imessage") {
      normalizedIdentifier = formatForStorage(params.identifier);
    } else if (params.channel === "email") {
      normalizedIdentifier = params.identifier.toLowerCase().trim();
    } else if (params.channel === "all") {
      // For "all" channel, trim the identifier
      normalizedIdentifier = params.identifier.trim();
    }
    
    // Only return active entries to avoid leaking soft-deleted rows
    const result = await db.select()
      .from(blacklistEntries)
      .where(and(
        eq(blacklistEntries.companyId, params.companyId),
        eq(blacklistEntries.channel, params.channel),
        eq(blacklistEntries.identifier, normalizedIdentifier),
        eq(blacklistEntries.isActive, true)
      ));
    
    return result[0];
  }

  // ==================== TASKS ====================
  
  async createTask(taskData: InsertTask & { companyId: string; creatorId: string }): Promise<Task> {
    const result = await db.insert(tasks).values({
      ...taskData,
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getTaskById(id: string, companyId?: string): Promise<Task | undefined> {
    const conditions = [eq(tasks.id, id)];
    if (companyId) {
      conditions.push(eq(tasks.companyId, companyId));
    }
    const result = await db
      .select()
      .from(tasks)
      .where(and(...conditions));
    return result[0];
  }

  async updateTask(id: string, updates: UpdateTask, companyId?: string): Promise<Task | undefined> {
    // Handle completedAt timestamp based on status changes
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // If status is being set to "completed", set completedAt
    if (updates.status === "completed") {
      updateData.completedAt = new Date();
    }
    
    // If status is being changed from "completed" to something else, clear completedAt
    if (updates.status && updates.status !== "completed") {
      updateData.completedAt = null;
    }

    const conditions = [eq(tasks.id, id)];
    if (companyId) {
      conditions.push(eq(tasks.companyId, companyId));
    }

    const result = await db
      .update(tasks)
      .set(updateData)
      .where(and(...conditions))
      .returning();
    
    return result[0];
  }

  async deleteTask(id: string, companyId?: string): Promise<boolean> {
    const conditions = [eq(tasks.id, id)];
    if (companyId) {
      conditions.push(eq(tasks.companyId, companyId));
    }
    const result = await db
      .delete(tasks)
      .where(and(...conditions))
      .returning();
    
    return result.length > 0;
  }

  async listTasks(filters: {
    companyId?: string;
    assigneeId?: string;
    status?: string;
    hideCompleted?: boolean;
    search?: string;
  }): Promise<Task[]> {
    const conditions = [];

    // Only filter by company if provided (superadmins don't filter)
    if (filters.companyId) {
      conditions.push(eq(tasks.companyId, filters.companyId));
    }

    // Filter by assigneeId
    if (filters.assigneeId) {
      conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    }

    // Filter by status
    if (filters.status) {
      conditions.push(eq(tasks.status, filters.status));
    }

    // Hide completed tasks
    if (filters.hideCompleted) {
      conditions.push(sql`${tasks.status} != 'completed'`);
    }

    // Search by title or description
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          sql`${tasks.title} ILIKE ${searchTerm}`,
          sql`${tasks.description} ILIKE ${searchTerm}`
        )!
      );
    }

    let query = db.select().from(tasks).orderBy(desc(tasks.createdAt));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query;
    return result;
  }

  // ==================== iMESSAGE CONVERSATIONS ====================

  async getImessageConversations(companyId: string): Promise<ImessageConversation[]> {
    return db
      .select()
      .from(imessageConversations)
      .where(eq(imessageConversations.companyId, companyId))
      .orderBy(desc(imessageConversations.updatedAt));
  }

  async getImessageConversation(id: string): Promise<ImessageConversation | undefined> {
    const result = await db
      .select()
      .from(imessageConversations)
      .where(eq(imessageConversations.id, id));
    return result[0];
  }
  
  async getImessageConversationsByCompany(companyId: string, options?: { archived?: boolean; search?: string }): Promise<ImessageConversation[]> {
    // Fetch conversations
    const conversations = await db
      .select()
      .from(imessageConversations)
      .where(eq(imessageConversations.companyId, companyId))
      .orderBy(desc(imessageConversations.updatedAt));
    
    // Extract all unique phone numbers from participants for contact lookup
    const allPhones = new Set<string>();
    conversations.forEach(conv => {
      if (conv.participants && Array.isArray(conv.participants)) {
        conv.participants.forEach(p => {
          try {
            // Normalize phone number for lookup (skip invalid numbers)
            const normalized = formatForStorage(p);
            if (normalized) allPhones.add(normalized);
          } catch (error) {
            // Ignore invalid phone numbers silently
            console.warn(`[iMessage] Skipping invalid phone number: ${p}`);
          }
        });
      }
    });
    
    // Fetch matching contacts in bulk
    const contactsMap = new Map<string, ManualContact>();
    if (allPhones.size > 0) {
      const phonesArray = Array.from(allPhones);
      const contacts = await db
        .select()
        .from(manualContacts)
        .where(
          and(
            eq(manualContacts.companyId, companyId),
            inArray(manualContacts.phone, phonesArray)
          )
        );
      
      contacts.forEach(contact => {
        if (contact.phone) {
          contactsMap.set(contact.phone, contact);
        }
      });
    }
    
    // Enrich conversations with contact names
    const enrichedConversations = conversations.map(conv => {
      // For 1-on-1 conversations, try to find matching contact
      if (!conv.isGroup && conv.participants && conv.participants.length > 0) {
        for (const participant of conv.participants) {
          try {
            const normalizedPhone = formatForStorage(participant);
            if (normalizedPhone) {
              const contact = contactsMap.get(normalizedPhone);
              if (contact) {
                // Found a contact - use their name
                const contactName = [contact.firstName, contact.lastName]
                  .filter(Boolean)
                  .join(' ')
                  .trim();
                
                if (contactName) {
                  return {
                    ...conv,
                    displayName: contactName,
                    contactName: contactName,
                    contactPhone: contact.phone
                  };
                }
              }
            }
          } catch (error) {
            // Ignore invalid phone numbers silently
            console.warn(`[iMessage] Skipping invalid participant phone: ${participant}`);
          }
        }
      }
      
      return conv;
    });
    
    // Apply search filter on enriched conversations
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      return enrichedConversations.filter(conv => {
        const displayNameMatch = conv.displayName?.toLowerCase().includes(searchLower);
        const participantsMatch = conv.participants?.some(p => p.toLowerCase().includes(searchLower));
        const contactNameMatch = conv.contactName?.toLowerCase().includes(searchLower);
        return displayNameMatch || participantsMatch || contactNameMatch;
      });
    }
    
    return enrichedConversations;
  }
  
  async getImessageConversationByHandle(companyId: string, handle: string): Promise<ImessageConversation | undefined> {
    const result = await db
      .select()
      .from(imessageConversations)
      .where(
        and(
          eq(imessageConversations.companyId, companyId),
          sql`${handle} = ANY(${imessageConversations.participants})`
        )
      );
    return result[0];
  }

  async findImessageConversationByChatGuid(companyId: string, chatGuid: string): Promise<ImessageConversation | undefined> {
    const result = await db
      .select()
      .from(imessageConversations)
      .where(
        and(
          eq(imessageConversations.companyId, companyId),
          eq(imessageConversations.chatGuid, chatGuid)
        )
      );
    return result[0];
  }

  // Alias for findImessageConversationByChatGuid (for backward compatibility)
  async getImessageConversationByChatGuid(companyId: string, chatGuid: string): Promise<ImessageConversation | undefined> {
    return this.findImessageConversationByChatGuid(companyId, chatGuid);
  }

  async createImessageConversation(data: InsertImessageConversation): Promise<ImessageConversation> {
    const result = await db
      .insert(imessageConversations)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateImessageConversation(id: string, data: Partial<InsertImessageConversation>): Promise<ImessageConversation | undefined> {
    const result = await db
      .update(imessageConversations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(imessageConversations.id, id))
      .returning();
    return result[0];
  }
  
  async deleteImessageConversation(id: string): Promise<boolean> {
    const result = await db
      .delete(imessageConversations)
      .where(eq(imessageConversations.id, id))
      .returning();
    return result.length > 0;
  }
  
  async incrementConversationUnread(conversationId: string): Promise<void> {
    await db
      .update(imessageConversations)
      .set({
        unreadCount: sql`${imessageConversations.unreadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(imessageConversations.id, conversationId));
  }
  
  async markConversationAsRead(conversationId: string): Promise<void> {
    await db
      .update(imessageConversations)
      .set({
        unreadCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(imessageConversations.id, conversationId));
  }

  // ==================== iMESSAGE MESSAGES ====================

  async getImessageMessage(id: string): Promise<ImessageMessage | undefined> {
    const result = await db
      .select()
      .from(imessageMessages)
      .where(eq(imessageMessages.id, id));
    return result[0] ? this.mapImessageMessage(result[0]) : undefined;
  }

  async getImessageMessageByGuid(companyId: string, messageGuid: string): Promise<ImessageMessage | undefined> {
    const result = await db
      .select()
      .from(imessageMessages)
      .where(
        and(
          eq(imessageMessages.companyId, companyId),
          eq(imessageMessages.messageGuid, messageGuid)
        )
      );
    return result[0] ? this.mapImessageMessage(result[0]) : undefined;
  }

  async getImessageMessages(conversationId: string, companyId: string, limit = 50, offset = 0): Promise<ImessageMessage[]> {
    const rows = await db
      .select()
      .from(imessageMessages)
      .where(
        and(
          eq(imessageMessages.conversationId, conversationId),
          eq(imessageMessages.companyId, companyId)
        )
      )
      .orderBy(imessageMessages.dateSent)
      .limit(limit)
      .offset(offset);
    return rows.map(row => this.mapImessageMessage(row));
  }
  
  // Shared mapper function to transform DB rows to frontend-compatible format
  private mapImessageMessage(row: any): ImessageMessage {
    return {
      id: row.id,
      conversationId: row.conversationId,
      companyId: row.companyId,
      guid: row.messageGuid,          // DB: messageGuid → Frontend: guid
      chatGuid: row.chatGuid,
      text: row.text || '',
      subject: row.subject,
      isFromMe: row.fromMe,            // DB: fromMe → Frontend: isFromMe
      senderName: row.senderName,
      senderAddress: row.senderHandle, // DB: senderHandle → Frontend: senderAddress
      dateCreated: row.dateSent ? row.dateSent.toISOString() : new Date().toISOString(), // DB: dateSent → Frontend: dateCreated
      dateRead: row.dateRead ? row.dateRead.toISOString() : undefined,
      dateDelivered: row.dateDelivered ? row.dateDelivered.toISOString() : undefined,
      dateSent: row.dateSent ? row.dateSent.toISOString() : undefined,
      hasAttachments: row.hasAttachments,
      attachments: row.attachments as any || [],
      effectId: row.expressiveType,     // DB: expressiveType → Frontend: effectId
      replyToMessageId: row.replyToGuid, // DB: replyToGuid → Frontend: replyToMessageId
      reactions: row.reactions as any || {},
      isDeleted: false,
      isEdited: false,
      editedAt: undefined,
      metadata: row.metadata,
      status: row.status
    } as ImessageMessage;
  }

  async getImessageMessagesByConversation(conversationId: string, options?: { limit?: number; offset?: number }): Promise<ImessageMessage[]> {
    let query = db
      .select()
      .from(imessageMessages)
      .where(eq(imessageMessages.conversationId, conversationId))
      .orderBy(imessageMessages.dateSent); // ASC order - oldest first, newest last
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }
    
    const rows = await query;
    return rows.map(row => this.mapImessageMessage(row));
  }

  async createImessageMessage(data: InsertImessageMessage): Promise<ImessageMessage> {
    const result = await db
      .insert(imessageMessages)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return this.mapImessageMessage(result[0]); // Apply mapper
  }

  async updateImessageMessageByGuid(companyId: string, messageGuid: string, data: Partial<InsertImessageMessage>): Promise<ImessageMessage | undefined> {
    const result = await db
      .update(imessageMessages)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(imessageMessages.companyId, companyId),
          eq(imessageMessages.messageGuid, messageGuid)
        )
      )
      .returning();
    return result[0] ? this.mapImessageMessage(result[0]) : undefined; // Apply mapper
  }
  
  async updateImessageMessageStatus(id: string, status: string, deliveredAt?: Date, readAt?: Date): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    // Handle different status updates
    if (status === "delivered" && deliveredAt) {
      updateData.dateDelivered = deliveredAt;
    }
    if (status === "read" && readAt) {
      updateData.dateRead = readAt;
      updateData.isRead = true;
    }
    if (status === "deleted") {
      updateData.isDeleted = true;
    }
    
    await db
      .update(imessageMessages)
      .set(updateData)
      .where(eq(imessageMessages.id, id));
  }
  
  async updateImessageMessageReadStatus(messageGuid: string, readAt: Date): Promise<void> {
    await db
      .update(imessageMessages)
      .set({
        dateRead: readAt,
        isRead: true,
        updatedAt: new Date(),
      })
      .where(eq(imessageMessages.messageGuid, messageGuid));
  }
  
  async getImessageUnreadCount(conversationId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(imessageMessages)
      .where(
        and(
          eq(imessageMessages.conversationId, conversationId),
          eq(imessageMessages.isRead, false),
          eq(imessageMessages.fromMe, false)
        )
      );
    return result[0]?.count || 0;
  }
  
  async recalculateImessageUnreadCount(conversationId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(imessageMessages)
      .where(
        and(
          eq(imessageMessages.conversationId, conversationId),
          eq(imessageMessages.fromMe, false),
          isNull(imessageMessages.dateRead)
        )
      );
    return result[0]?.count || 0;
  }
  
  async searchImessageMessages(companyId: string, query: string): Promise<ImessageMessage[]> {
    const rows = await db
      .select()
      .from(imessageMessages)
      .where(
        and(
          eq(imessageMessages.companyId, companyId),
          sql`${imessageMessages.text} ILIKE ${'%' + query + '%'}`
        )
      )
      .orderBy(desc(imessageMessages.dateSent))
      .limit(100);
    return rows.map(row => this.mapImessageMessage(row));
  }
  
  async addMessageReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    // Get the current message
    const message = await this.getImessageMessage(messageId);
    if (!message) return;
    
    // Update reactions object
    const reactions = message.reactions || {};
    if (!reactions[reaction]) {
      reactions[reaction] = [];
    }
    if (!reactions[reaction].includes(userId)) {
      reactions[reaction].push(userId);
    }
    
    // Update the message
    await db
      .update(imessageMessages)
      .set({
        reactions,
        updatedAt: new Date(),
      })
      .where(eq(imessageMessages.id, messageId));
  }
  
  async removeMessageReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    // Get the current message
    const message = await this.getImessageMessage(messageId);
    if (!message) return;
    
    // Update reactions object
    const reactions = message.reactions || {};
    if (reactions[reaction]) {
      reactions[reaction] = reactions[reaction].filter((id: string) => id !== userId);
      if (reactions[reaction].length === 0) {
        delete reactions[reaction];
      }
    }
    
    // Update the message
    await db
      .update(imessageMessages)
      .set({
        reactions,
        updatedAt: new Date(),
      })
      .where(eq(imessageMessages.id, messageId));
  }

  // Helper for webhook - get all company settings
  async getAllCompanySettings(): Promise<CompanySettings[]> {
    return db.select().from(companySettings);
  }

  // ==================== iMessage CAMPAIGNS ====================

  async createImessageCampaign(data: InsertImessageCampaign): Promise<ImessageCampaign> {
    const result = await db.insert(imessageCampaigns).values(data).returning();
    return result[0];
  }

  async getImessageCampaign(id: string): Promise<ImessageCampaign | undefined> {
    const result = await db.select().from(imessageCampaigns).where(eq(imessageCampaigns.id, id));
    return result[0];
  }

  async getImessageCampaignsByCompany(companyId: string): Promise<ImessageCampaign[]> {
    return db.select().from(imessageCampaigns).where(eq(imessageCampaigns.companyId, companyId)).orderBy(desc(imessageCampaigns.createdAt));
  }

  async updateImessageCampaign(id: string, data: Partial<InsertImessageCampaign>): Promise<ImessageCampaign | undefined> {
    const result = await db.update(imessageCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(imessageCampaigns.id, id))
      .returning();
    return result[0];
  }

  async deleteImessageCampaign(id: string): Promise<boolean> {
    const result = await db.delete(imessageCampaigns).where(eq(imessageCampaigns.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async createImessageCampaignWithDetails(
    companyId: string,
    userId: string,
    data: CreateCampaignWithDetails
  ): Promise<ImessageCampaign> {
    return await db.transaction(async (tx) => {
      const campaignData = {
        companyId,
        createdBy: userId,
        name: data.campaign.name,
        description: data.campaign.description || null,
        messageBody: data.campaign.messageBody,
        targetListId: data.campaign.targetListId || null,
        status: "draft" as const,
        scheduleType: data.schedule?.scheduleType || "immediate" as const,
        templateId: data.campaign.templateId || null,
        personalizedFields: data.campaign.personalizedFields || [],
        complianceScore: data.campaign.complianceScore || null,
      };

      const [campaign] = await tx.insert(imessageCampaigns).values(campaignData).returning();

      const scheduleData = {
        campaignId: campaign.id,
        scheduleType: data.schedule?.scheduleType || "immediate" as const,
        startDate: data.schedule?.startDate || null,
        startTime: data.schedule?.startTime || null,
        timezone: data.schedule?.timezone || "UTC",
        recurrenceRule: data.schedule?.recurrenceRule || null,
        endDate: data.schedule?.endDate || null,
        quietHoursStart: data.schedule?.quietHoursStart || null,
        quietHoursEnd: data.schedule?.quietHoursEnd || null,
        rateLimit: data.schedule?.rateLimit || null,
        throttleDelayMin: data.schedule?.throttleDelayMin || null,
        throttleDelayMax: data.schedule?.throttleDelayMax || null,
        respectContactTimezone: data.schedule?.respectContactTimezone || false,
      };
      await tx.insert(campaignSchedules).values(scheduleData);

      if (data.variants && data.variants.length > 0) {
        const variantsData = data.variants.map(variant => ({
          campaignId: campaign.id,
          variantLetter: variant.variantLetter,
          messageBody: variant.messageBody,
          mediaUrls: variant.mediaUrls || [],
          splitPercentage: variant.splitPercentage,
        }));
        await tx.insert(campaignVariants).values(variantsData);
      }

      if (data.followups && data.followups.length > 0) {
        const followupsData = data.followups.map(followup => ({
          campaignId: campaign.id,
          sequence: followup.sequence,
          triggerType: followup.triggerType,
          waitDays: followup.waitDays || 0,
          waitHours: followup.waitHours || 0,
          messageBody: followup.messageBody,
          mediaUrls: followup.mediaUrls || [],
          targetSegment: followup.targetSegment || "all" as const,
          isActive: followup.isActive !== undefined ? followup.isActive : true,
        }));
        await tx.insert(campaignFollowups).values(followupsData);
      }

      return campaign;
    });
  }

  async updateImessageCampaignWithDetails(
    campaignId: string,
    companyId: string,
    data: CreateCampaignWithDetails
  ): Promise<ImessageCampaign> {
    return await db.transaction(async (tx) => {
      const campaignData = {
        name: data.campaign.name,
        description: data.campaign.description || null,
        messageBody: data.campaign.messageBody,
        targetListId: data.campaign.targetListId || null,
        templateId: data.campaign.templateId || null,
        personalizedFields: data.campaign.personalizedFields || [],
        complianceScore: data.campaign.complianceScore || null,
        updatedAt: new Date(),
      };

      const [campaign] = await tx
        .update(imessageCampaigns)
        .set(campaignData)
        .where(and(eq(imessageCampaigns.id, campaignId), eq(imessageCampaigns.companyId, companyId)))
        .returning();

      if (!campaign) {
        throw new Error("Campaign not found or access denied");
      }

      const existingSchedule = await tx
        .select()
        .from(campaignSchedules)
        .where(eq(campaignSchedules.campaignId, campaignId))
        .limit(1);

      const scheduleData = {
        campaignId: campaign.id,
        scheduleType: data.schedule?.scheduleType || "immediate" as const,
        startDate: data.schedule?.startDate || null,
        startTime: data.schedule?.startTime || null,
        timezone: data.schedule?.timezone || "UTC",
        recurrenceRule: data.schedule?.recurrenceRule || null,
        endDate: data.schedule?.endDate || null,
        quietHoursStart: data.schedule?.quietHoursStart || null,
        quietHoursEnd: data.schedule?.quietHoursEnd || null,
        rateLimit: data.schedule?.rateLimit || null,
        throttleDelayMin: data.schedule?.throttleDelayMin || null,
        throttleDelayMax: data.schedule?.throttleDelayMax || null,
        respectContactTimezone: data.schedule?.respectContactTimezone || false,
        updatedAt: new Date(),
      };

      if (existingSchedule.length > 0) {
        await tx
          .update(campaignSchedules)
          .set(scheduleData)
          .where(eq(campaignSchedules.campaignId, campaignId));
      } else {
        await tx.insert(campaignSchedules).values(scheduleData);
      }

      await tx.delete(campaignVariants).where(eq(campaignVariants.campaignId, campaignId));
      if (data.variants && data.variants.length > 0) {
        const variantsData = data.variants.map(variant => ({
          campaignId: campaign.id,
          variantLetter: variant.variantLetter,
          messageBody: variant.messageBody,
          mediaUrls: variant.mediaUrls || [],
          splitPercentage: variant.splitPercentage,
        }));
        await tx.insert(campaignVariants).values(variantsData);
      }

      await tx.delete(campaignFollowups).where(eq(campaignFollowups.campaignId, campaignId));
      if (data.followups && data.followups.length > 0) {
        const followupsData = data.followups.map(followup => ({
          campaignId: campaign.id,
          sequence: followup.sequence,
          triggerType: followup.triggerType,
          waitDays: followup.waitDays || 0,
          waitHours: followup.waitHours || 0,
          messageBody: followup.messageBody,
          mediaUrls: followup.mediaUrls || [],
          targetSegment: followup.targetSegment || "all" as const,
          isActive: followup.isActive !== undefined ? followup.isActive : true,
        }));
        await tx.insert(campaignFollowups).values(followupsData);
      }

      return campaign;
    });
  }

  // ==================== iMessage CAMPAIGN RUNS ====================

  async createImessageCampaignRun(data: InsertImessageCampaignRun): Promise<ImessageCampaignRun> {
    const result = await db.insert(imessageCampaignRuns).values(data).returning();
    return result[0];
  }

  async getImessageCampaignRun(id: string): Promise<ImessageCampaignRun | undefined> {
    const result = await db.select().from(imessageCampaignRuns).where(eq(imessageCampaignRuns.id, id));
    return result[0];
  }

  async getImessageCampaignRunsByCampaign(campaignId: string): Promise<ImessageCampaignRun[]> {
    return db.select().from(imessageCampaignRuns).where(eq(imessageCampaignRuns.campaignId, campaignId)).orderBy(desc(imessageCampaignRuns.createdAt));
  }

  async getNextRunNumber(campaignId: string): Promise<number> {
    const result = await db
      .select({ maxRunNumber: sql<number>`COALESCE(MAX(${imessageCampaignRuns.runNumber}), 0)` })
      .from(imessageCampaignRuns)
      .where(eq(imessageCampaignRuns.campaignId, campaignId));
    return (result[0]?.maxRunNumber || 0) + 1;
  }

  async updateImessageCampaignRun(id: string, data: Partial<InsertImessageCampaignRun>): Promise<ImessageCampaignRun | undefined> {
    const result = await db.update(imessageCampaignRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(imessageCampaignRuns.id, id))
      .returning();
    return result[0];
  }

  // ==================== iMessage CAMPAIGN MESSAGES ====================

  async createImessageCampaignMessage(data: InsertImessageCampaignMessage): Promise<ImessageCampaignMessage> {
    const result = await db.insert(imessageCampaignMessages).values(data).returning();
    return result[0];
  }

  async getImessageCampaignMessage(id: string): Promise<ImessageCampaignMessage | undefined> {
    const result = await db.select().from(imessageCampaignMessages).where(eq(imessageCampaignMessages.id, id));
    return result[0];
  }

  async getImessageCampaignMessagesByRun(runId: string, filters?: { status?: string; limit?: number; offset?: number }): Promise<ImessageCampaignMessage[]> {
    let query = db.select().from(imessageCampaignMessages).where(eq(imessageCampaignMessages.runId, runId));

    if (filters?.status) {
      query = query.where(
        and(
          eq(imessageCampaignMessages.runId, runId),
          eq(imessageCampaignMessages.sendStatus, filters.status)
        )
      ) as any;
    }

    query = query.orderBy(desc(imessageCampaignMessages.createdAt)) as any;

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return query;
  }

  async getPendingCampaignMessages(runId: string, limit?: number): Promise<ImessageCampaignMessage[]> {
    let query = db.select().from(imessageCampaignMessages)
      .where(
        and(
          eq(imessageCampaignMessages.runId, runId),
          eq(imessageCampaignMessages.sendStatus, 'pending')
        )
      )
      .orderBy(imessageCampaignMessages.createdAt);

    if (limit) {
      query = query.limit(limit) as any;
    }

    return query;
  }

  async getAbandonedCampaignMessages(): Promise<ImessageCampaignMessage[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const result = await db.select().from(imessageCampaignMessages)
      .where(
        and(
          eq(imessageCampaignMessages.sendStatus, 'sending'),
          or(
            isNull(imessageCampaignMessages.attemptedAt),
            lt(imessageCampaignMessages.attemptedAt, fiveMinutesAgo)
          )
        )
      );
    
    return result;
  }

  async updateImessageCampaignMessage(id: string, data: Partial<InsertImessageCampaignMessage>): Promise<ImessageCampaignMessage | undefined> {
    const result = await db.update(imessageCampaignMessages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(imessageCampaignMessages.id, id))
      .returning();
    return result[0];
  }

  async bulkCreateCampaignMessages(messages: InsertImessageCampaignMessage[]): Promise<ImessageCampaignMessage[]> {
    if (messages.length === 0) {
      return [];
    }
    const result = await db.insert(imessageCampaignMessages).values(messages).returning();
    return result;
  }

  // ==================== IMESSAGE CAMPAIGN PROCESSING ====================

  async getActiveImessageCampaignRuns(): Promise<ImessageCampaignRun[]> {
    const result = await db
      .select()
      .from(imessageCampaignRuns)
      .where(eq(imessageCampaignRuns.status, 'running'));
    return result;
  }

  async getContactById(id: string): Promise<ManualContact | undefined> {
    const result = await db
      .select()
      .from(manualContacts)
      .where(eq(manualContacts.id, id));
    return result[0];
  }

  async getCampaignSchedule(campaignId: string): Promise<CampaignSchedule | undefined> {
    const result = await db
      .select()
      .from(campaignSchedules)
      .where(eq(campaignSchedules.campaignId, campaignId));
    return result[0];
  }

  async incrementRunSentCount(runId: string): Promise<void> {
    await db
      .update(imessageCampaignRuns)
      .set({
        sentCount: sql`${imessageCampaignRuns.sentCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(imessageCampaignRuns.id, runId));
  }

  async incrementRunDeliveredCount(runId: string): Promise<void> {
    await db
      .update(imessageCampaignRuns)
      .set({
        deliveredCount: sql`${imessageCampaignRuns.deliveredCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(imessageCampaignRuns.id, runId));
  }

  async incrementRunFailedCount(runId: string): Promise<void> {
    await db
      .update(imessageCampaignRuns)
      .set({
        failedCount: sql`${imessageCampaignRuns.failedCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(imessageCampaignRuns.id, runId));
  }

  // ==================== CAMPAIGN TEMPLATE CATEGORIES ====================

  async getCampaignTemplateCategories(companyId: string): Promise<CampaignTemplateCategory[]> {
    const result = await db
      .select()
      .from(campaignTemplateCategories)
      .where(
        or(
          eq(campaignTemplateCategories.isSystem, true),
          eq(campaignTemplateCategories.companyId, companyId)
        )
      )
      .orderBy(campaignTemplateCategories.displayOrder, campaignTemplateCategories.name);
    return result;
  }

  async createCampaignTemplateCategory(data: InsertCampaignTemplateCategory): Promise<CampaignTemplateCategory> {
    // Force isSystem = false for tenant-scoped categories
    const insertData = {
      ...data,
      isSystem: data.companyId === null ? data.isSystem : false,
    };
    
    const result = await db.insert(campaignTemplateCategories).values(insertData).returning();
    return result[0];
  }

  async updateCampaignTemplateCategory(id: string, data: Partial<InsertCampaignTemplateCategory>): Promise<CampaignTemplateCategory> {
    const result = await db
      .update(campaignTemplateCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaignTemplateCategories.id, id))
      .returning();
    return result[0];
  }

  async deleteCampaignTemplateCategory(id: string): Promise<void> {
    await db.delete(campaignTemplateCategories).where(eq(campaignTemplateCategories.id, id));
  }

  // ==================== CAMPAIGN TEMPLATES ====================

  async getCampaignTemplates(companyId: string, categoryId?: string): Promise<CampaignTemplate[]> {
    let companyCondition = or(
      eq(campaignTemplates.companyId, companyId),
      and(isNull(campaignTemplates.companyId), eq(campaignTemplates.isSystem, true))
    );
    
    let conditions = categoryId 
      ? and(companyCondition, eq(campaignTemplates.categoryId, categoryId))
      : companyCondition;

    const result = await db
      .select()
      .from(campaignTemplates)
      .where(conditions)
      .orderBy(desc(campaignTemplates.usageCount), campaignTemplates.name);
    return result;
  }

  async getCampaignTemplateById(id: string, companyId: string): Promise<CampaignTemplate | undefined> {
    const result = await db
      .select()
      .from(campaignTemplates)
      .where(
        and(
          eq(campaignTemplates.id, id),
          or(
            eq(campaignTemplates.companyId, companyId),
            and(isNull(campaignTemplates.companyId), eq(campaignTemplates.isSystem, true))
          )
        )
      );
    return result[0];
  }

  async createCampaignTemplate(data: InsertCampaignTemplate): Promise<CampaignTemplate> {
    // Force isSystem = false for tenant-scoped templates
    const insertData = {
      ...data,
      isSystem: data.companyId === null ? data.isSystem : false,
    };
    
    const result = await db.insert(campaignTemplates).values(insertData).returning();
    return result[0];
  }

  async updateCampaignTemplate(id: string, companyId: string, data: Partial<InsertCampaignTemplate>, isSuperadmin: boolean = false): Promise<CampaignTemplate> {
    // For superadmins, fetch template by ID only (allows access to system templates)
    // For regular users, fetch with company scoping for security
    let template: CampaignTemplate | undefined;
    
    if (isSuperadmin) {
      const result = await db.select().from(campaignTemplates).where(eq(campaignTemplates.id, id));
      template = result[0];
    } else {
      template = await this.getCampaignTemplateById(id, companyId);
    }
    
    if (!template) {
      throw new Error("Template not found");
    }
    
    // Only superadmins can modify system templates
    if (template.isSystem && !isSuperadmin) {
      throw new Error("Only superadmins can modify system templates");
    }
    
    const result = await db
      .update(campaignTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(
        template.isSystem
          ? eq(campaignTemplates.id, id) // System templates: ID only
          : and(
              eq(campaignTemplates.id, id),
              eq(campaignTemplates.companyId, companyId) // Company templates: ID + companyId for security
            )
      )
      .returning();
    return result[0];
  }

  async deleteCampaignTemplate(id: string, companyId: string, isSuperadmin: boolean = false): Promise<void> {
    // For superadmins, fetch template by ID only (allows access to system templates)
    // For regular users, fetch with company scoping for security
    let template: CampaignTemplate | undefined;
    
    if (isSuperadmin) {
      const result = await db.select().from(campaignTemplates).where(eq(campaignTemplates.id, id));
      template = result[0];
    } else {
      template = await this.getCampaignTemplateById(id, companyId);
    }
    
    if (!template) {
      throw new Error("Template not found");
    }
    
    // Only superadmins can delete system templates
    if (template.isSystem && !isSuperadmin) {
      throw new Error("Only superadmins can delete system templates");
    }
    
    await db
      .delete(campaignTemplates)
      .where(
        template.isSystem
          ? eq(campaignTemplates.id, id) // System templates: ID only
          : and(
              eq(campaignTemplates.id, id),
              eq(campaignTemplates.companyId, companyId) // Company templates: ID + companyId for security
            )
      );
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db
      .update(campaignTemplates)
      .set({ usageCount: sql`${campaignTemplates.usageCount} + 1` })
      .where(eq(campaignTemplates.id, id));
  }

  // ==================== CAMPAIGN PLACEHOLDERS ====================

  async getCampaignPlaceholders(companyId: string): Promise<CampaignPlaceholder[]> {
    const result = await db
      .select()
      .from(campaignPlaceholders)
      .where(
        and(
          or(
            eq(campaignPlaceholders.isSystem, true),
            eq(campaignPlaceholders.companyId, companyId)
          ),
          eq(campaignPlaceholders.isActive, true)
        )
      )
      .orderBy(campaignPlaceholders.name);
    return result;
  }

  async createCampaignPlaceholder(data: InsertCampaignPlaceholder): Promise<CampaignPlaceholder> {
    // Force isSystem = false for tenant-scoped placeholders
    const insertData = {
      ...data,
      isSystem: data.companyId === null ? data.isSystem : false,
    };
    
    const result = await db.insert(campaignPlaceholders).values(insertData).returning();
    return result[0];
  }

  async updateCampaignPlaceholder(id: string, companyId: string, data: Partial<InsertCampaignPlaceholder>): Promise<CampaignPlaceholder> {
    const result = await db
      .update(campaignPlaceholders)
      .set(data)
      .where(
        and(
          eq(campaignPlaceholders.id, id),
          eq(campaignPlaceholders.companyId, companyId)
        )
      )
      .returning();
    return result[0];
  }

  async deleteCampaignPlaceholder(id: string, companyId: string): Promise<void> {
    await db
      .delete(campaignPlaceholders)
      .where(
        and(
          eq(campaignPlaceholders.id, id),
          eq(campaignPlaceholders.companyId, companyId)
        )
      );
  }

  // ==================== USER LIMITS - PLAN ENFORCEMENT ====================
  
  async getActiveUserCountByCompany(companyId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.companyId, companyId),
          eq(users.isActive, true)
        )
      );
    return result[0]?.count ?? 0;
  }

  async getPendingInvitationCountByCompany(companyId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitations)
      .where(
        and(
          eq(invitations.companyId, companyId),
          isNull(invitations.acceptedAt),
          gte(invitations.expiresAt, new Date())
        )
      );
    return result[0]?.count ?? 0;
  }

  async getPlanLimitForCompany(companyId: string): Promise<number | null> {
    const subscription = await this.getSubscriptionByCompany(companyId);
    if (!subscription || !subscription.planId) {
      return null;
    }
    const plan = await this.getPlan(subscription.planId);
    if (!plan) {
      return null;
    }
    return plan.maxUsers;
  }

  async canCompanyAddUsers(companyId: string, countToAdd: number = 1): Promise<{ allowed: boolean; currentCount: number; limit: number | null; message?: string }> {
    const limit = await this.getPlanLimitForCompany(companyId);
    
    // Always calculate the actual user count
    const activeUserCount = await this.getActiveUserCountByCompany(companyId);
    const pendingInvitationCount = await this.getPendingInvitationCountByCompany(companyId);
    const currentCount = activeUserCount + pendingInvitationCount;
    
    if (limit === null) {
      return { allowed: true, currentCount, limit: null };
    }
    
    if (currentCount + countToAdd > limit) {
      return {
        allowed: false,
        currentCount,
        limit,
        message: `Your plan allows a maximum of ${limit} user${limit === 1 ? '' : 's'}. Please upgrade to add more users.`
      };
    }
    
    return { allowed: true, currentCount, limit };
  }
}

export const storage = new DbStorage();
