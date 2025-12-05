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
  type InsertCampaignFollowup,
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
  campaignFollowups,
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
}
