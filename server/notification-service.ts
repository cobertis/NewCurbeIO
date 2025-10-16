import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

/**
 * NotificationService - Creates system notifications for important events
 */
class NotificationService {
  /**
   * Create a notification for when a new company is created
   */
  async notifyCompanyCreated(companyName: string, adminUserId: string, superadminUserId: string) {
    const notification: InsertNotification = {
      userId: superadminUserId,
      type: "company_created",
      title: "New Company Created",
      message: `Company "${companyName}" has been successfully created.`,
      link: "/companies",
      isRead: false,
    };
    return await storage.createNotification(notification);
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
   * Get all superadmin user IDs
   */
  async getSuperadminUserIds(): Promise<string[]> {
    const users = await storage.getAllUsers();
    return users.filter(u => u.role === "superadmin").map(u => u.id);
  }
}

export const notificationService = new NotificationService();
