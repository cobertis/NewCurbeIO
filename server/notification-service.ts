import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

/**
 * NotificationService - Creates system notifications for important events
 */
class NotificationService {
  /**
   * Create a notification for when a new company is created
   * Notifies both the creator (superadmin) and the new company admin
   */
  async notifyCompanyCreated(companyName: string, adminUserId: string, superadminUserId: string) {
    const notifications: InsertNotification[] = [
      // Notify the superadmin who created the company
      {
        userId: superadminUserId,
        type: "company_created",
        title: "New Company Created",
        message: `Company "${companyName}" has been successfully created.`,
        link: "/companies",
        isRead: false,
      },
      // Notify the new company admin
      {
        userId: adminUserId,
        type: "company_created",
        title: "Welcome to Your New Company",
        message: `Your company "${companyName}" has been created. Please activate your account to get started.`,
        link: "/companies",
        isRead: false,
      },
    ];
    
    return await Promise.all(notifications.map(n => storage.createNotification(n)));
  }

  /**
   * Create a notification for when a new user is created
   */
  async notifyUserCreated(userName: string, userEmail: string, creatorUserId: string, superadminUserIds: string[]) {
    // Notify superadmins about new user
    const notifications = superadminUserIds.map(userId => ({
      userId,
      type: "user_created",
      title: "New User Created",
      message: `${userName} (${userEmail}) has been added to the system.`,
      link: "/users",
      isRead: false,
    }));

    return await Promise.all(notifications.map(n => storage.createNotification(n)));
  }

  /**
   * Create a notification for when a campaign is sent
   */
  async notifyCampaignSent(campaignSubject: string, recipientCount: number, creatorUserId: string, campaignId: string) {
    const notification: InsertNotification = {
      userId: creatorUserId,
      type: "campaign_sent",
      title: "Campaign Sent Successfully",
      message: `Your campaign "${campaignSubject}" has been sent to ${recipientCount} recipients.`,
      link: `/campaigns/${campaignId}/stats`,
      isRead: false,
    };
    return await storage.createNotification(notification);
  }

  /**
   * Create a notification for when a campaign fails
   */
  async notifyCampaignFailed(campaignSubject: string, error: string, creatorUserId: string, campaignId: string) {
    const notification: InsertNotification = {
      userId: creatorUserId,
      type: "campaign_failed",
      title: "Campaign Failed",
      message: `Your campaign "${campaignSubject}" failed to send: ${error}`,
      link: `/campaigns/${campaignId}/stats`,
      isRead: false,
    };
    return await storage.createNotification(notification);
  }

  /**
   * Create a notification for when a user subscribes to email campaigns
   */
  async notifyUserSubscribed(userName: string, userEmail: string, superadminUserIds: string[]) {
    const notifications = superadminUserIds.map(userId => ({
      userId,
      type: "user_subscribed",
      title: "New Email Subscriber",
      message: `${userName} (${userEmail}) has subscribed to email campaigns.`,
      link: "/contacts",
      isRead: false,
    }));

    return await Promise.all(notifications.map(n => storage.createNotification(n)));
  }

  /**
   * Create a notification for when a company is deactivated
   */
  async notifyCompanyDeactivated(companyName: string, superadminUserId: string) {
    const notification: InsertNotification = {
      userId: superadminUserId,
      type: "company_deactivated",
      title: "Company Deactivated",
      message: `Company "${companyName}" has been deactivated.`,
      link: "/companies",
      isRead: false,
    };
    return await storage.createNotification(notification);
  }

  /**
   * Create a notification for when a contact list is created
   */
  async notifyContactListCreated(listName: string, creatorUserId: string) {
    const notification: InsertNotification = {
      userId: creatorUserId,
      type: "contact_list_created",
      title: "Contact List Created",
      message: `Contact list "${listName}" has been successfully created.`,
      link: "/campaigns",
      isRead: false,
    };
    return await storage.createNotification(notification);
  }

  /**
   * Create a notification for when a user activates their account
   * Notifies superadmins that a user has completed activation
   */
  async notifyUserActivated(userName: string, userEmail: string, userId: string) {
    const superadminUserIds = await this.getSuperadminUserIds();
    
    const notifications = superadminUserIds.map(adminId => ({
      userId: adminId,
      type: "user_activated",
      title: "User Account Activated",
      message: `${userName} (${userEmail}) has successfully activated their account and is ready to use the system.`,
      link: `/users/${userId}`,
      isRead: false,
    }));

    return await Promise.all(notifications.map(n => storage.createNotification(n)));
  }

  /**
   * Create a notification for successful login
   * Shows IP address and device information
   */
  async notifyLogin(userId: string, userName: string, ipAddress: string | null, userAgent: string | null) {
    // Format IP display
    const ip = ipAddress || 'Unknown IP';
    
    // Extract browser info from user agent
    let deviceInfo = 'Unknown device';
    if (userAgent) {
      // Simple browser detection - check Edge before Chrome since Edge UA contains 'Chrome'
      if (userAgent.includes('Edg')) deviceInfo = 'Edge';
      else if (userAgent.includes('Chrome')) deviceInfo = 'Chrome';
      else if (userAgent.includes('Firefox')) deviceInfo = 'Firefox';
      else if (userAgent.includes('Safari')) deviceInfo = 'Safari';
      
      // Add OS info if available
      if (userAgent.includes('Windows')) deviceInfo += ' on Windows';
      else if (userAgent.includes('Mac')) deviceInfo += ' on Mac';
      else if (userAgent.includes('Linux')) deviceInfo += ' on Linux';
      else if (userAgent.includes('Android')) deviceInfo += ' on Android';
      else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) deviceInfo += ' on iOS';
    }
    
    const notification: InsertNotification = {
      userId,
      type: "user_login",
      title: "Successful Login",
      message: `Login from IP: ${ip} • ${deviceInfo}`,
      link: "/settings",
      isRead: false,
    };
    
    return await storage.createNotification(notification);
  }

  /**
   * Create a notification for failed login attempt
   * Shows IP address, device information, and attempted email
   */
  async notifyFailedLogin(email: string, ipAddress: string | null, userAgent: string | null) {
    // Format IP display
    const ip = ipAddress || 'Unknown IP';
    
    // Extract browser info from user agent
    let deviceInfo = 'Unknown device';
    if (userAgent) {
      // Simple browser detection - check Edge before Chrome since Edge UA contains 'Chrome'
      if (userAgent.includes('Edg')) deviceInfo = 'Edge';
      else if (userAgent.includes('Chrome')) deviceInfo = 'Chrome';
      else if (userAgent.includes('Firefox')) deviceInfo = 'Firefox';
      else if (userAgent.includes('Safari')) deviceInfo = 'Safari';
      
      // Add OS info if available
      if (userAgent.includes('Windows')) deviceInfo += ' on Windows';
      else if (userAgent.includes('Mac')) deviceInfo += ' on Mac';
      else if (userAgent.includes('Linux')) deviceInfo += ' on Linux';
      else if (userAgent.includes('Android')) deviceInfo += ' on Android';
      else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) deviceInfo += ' on iOS';
    }
    
    // Get superadmins to notify
    const superadminUserIds = await this.getSuperadminUserIds();
    
    const notifications = superadminUserIds.map(adminId => ({
      userId: adminId,
      type: "error",
      title: "Failed Login Attempt",
      message: `Failed login for ${email} from IP: ${ip} • ${deviceInfo}`,
      link: "/audit-logs",
      isRead: false,
    }));

    return await Promise.all(notifications.map(n => storage.createNotification(n)));
  }

  /**
   * Get all superadmin user IDs
   */
  async getSuperadminUserIds(): Promise<string[]> {
    const users = await storage.getAllUsers();
    return users.filter(u => u.role === "superadmin").map(u => u.id);
  }
}

export const notificationService = new NotificationService();
