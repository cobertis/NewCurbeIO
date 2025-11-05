import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";
import { broadcastNotificationUpdate } from "./websocket";

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
    
    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
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

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
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
    const result = await storage.createNotification(notification);
    broadcastNotificationUpdate();
    return result;
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
    const result = await storage.createNotification(notification);
    broadcastNotificationUpdate();
    return result;
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

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
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
    const result = await storage.createNotification(notification);
    broadcastNotificationUpdate();
    return result;
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
    const result = await storage.createNotification(notification);
    broadcastNotificationUpdate();
    return result;
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

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
  }

  /**
   * Create a notification for successful login
   * Notifies the user AND all superadmins
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
    
    const notifications: InsertNotification[] = [];
    
    // Notification for the user who logged in
    notifications.push({
      userId,
      type: "user_login",
      title: "Successful Login",
      message: `Login from IP: ${ip} • ${deviceInfo}`,
      link: "/settings",
      isRead: false,
    });
    
    // Notifications for all superadmins (about this user's login)
    const superadminUserIds = await this.getSuperadminUserIds();
    superadminUserIds.forEach(adminId => {
      // Don't duplicate notification if the user is a superadmin
      if (adminId !== userId) {
        notifications.push({
          userId: adminId,
          type: "user_login",
          title: "User Login",
          message: `${userName} logged in from IP: ${ip} • ${deviceInfo}`,
          link: "/audit-logs",
          isRead: false,
        });
      }
    });
    
    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
  }

  /**
   * Create a notification for when a user tries to login without activating their account
   * Notifies the user and superadmins
   */
  async notifyUnactivatedLoginAttempt(email: string, ipAddress: string | null, userAgent: string | null, userId: string) {
    const ip = ipAddress || 'Unknown IP';
    
    let deviceInfo = 'Unknown device';
    if (userAgent) {
      if (userAgent.includes('Edg')) deviceInfo = 'Edge';
      else if (userAgent.includes('Chrome')) deviceInfo = 'Chrome';
      else if (userAgent.includes('Firefox')) deviceInfo = 'Firefox';
      else if (userAgent.includes('Safari')) deviceInfo = 'Safari';
      
      if (userAgent.includes('Windows')) deviceInfo += ' on Windows';
      else if (userAgent.includes('Mac')) deviceInfo += ' on Mac';
      else if (userAgent.includes('Linux')) deviceInfo += ' on Linux';
      else if (userAgent.includes('Android')) deviceInfo += ' on Android';
      else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) deviceInfo += ' on iOS';
    }
    
    const notifications: InsertNotification[] = [];
    
    // Notify the user about the unactivated login attempt
    notifications.push({
      userId: userId,
      type: "warning",
      title: "Unactivated Login Attempt",
      message: `Someone tried to login to your account from IP: ${ip} • ${deviceInfo}. Please activate your account to login. Check your email for the activation link.`,
      link: "/activate-account",
      isRead: false,
    });
    
    // Get superadmins to notify
    const superadminUserIds = await this.getSuperadminUserIds();
    
    superadminUserIds.forEach(adminId => {
      notifications.push({
        userId: adminId,
        type: "warning",
        title: "Unactivated Login Attempt",
        message: `User ${email} tried to login without activating their account from IP: ${ip} • ${deviceInfo}`,
        link: "/users",
        isRead: false,
      });
    });

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
  }

  /**
   * Create a notification for failed login attempt
   * Notifies the user (if exists) AND all superadmins
   * Shows IP address, device information, and attempted email
   */
  async notifyFailedLogin(email: string, ipAddress: string | null, userAgent: string | null, userId?: string) {
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
    
    const notifications: InsertNotification[] = [];
    
    // If user exists, notify them about the failed login attempt
    if (userId) {
      notifications.push({
        userId: userId,
        type: "error",
        title: "Failed Login Attempt",
        message: `Failed login attempt from IP: ${ip} • ${deviceInfo}`,
        link: "/settings",
        isRead: false,
      });
    }
    
    // Get superadmins to notify
    const superadminUserIds = await this.getSuperadminUserIds();
    
    superadminUserIds.forEach(adminId => {
      // Don't duplicate notification if the user is a superadmin
      if (adminId !== userId) {
        notifications.push({
          userId: adminId,
          type: "error",
          title: "Failed Login Attempt",
          message: `Failed login for ${email} from IP: ${ip} • ${deviceInfo}`,
          link: "/audit-logs",
          isRead: false,
        });
      }
    });

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
  }

  /**
   * Create a notification for when a payment is successfully processed
   * Notifies all admins of the company AND all superadmins in the system
   */
  async notifyPaymentSucceeded(companyId: string, amount: number, currency: string, invoiceNumber?: string) {
    // Get company information for notification message
    const company = await storage.getCompany(companyId);
    const companyName = company?.name || 'Unknown Company';
    
    // Get all admin users for this company
    const users = await storage.getUsersByCompany(companyId);
    const adminUsers = users.filter(u => u.role === "admin" || u.role === "superadmin");
    
    // Get ALL superadmin users in the system (not just company superadmins)
    const allSuperadmins = await this.getSuperadminUserIds();
    
    // Format amount (amount is in cents from Stripe)
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
    
    const notifications: any[] = [];
    
    // 1. Notify company admins with simple message
    adminUsers.forEach(user => {
      notifications.push({
        userId: user.id,
        type: "success",
        title: "Payment Processed Successfully",
        message: invoiceNumber 
          ? `Payment of ${formattedAmount} for invoice ${invoiceNumber} has been processed successfully.`
          : `Payment of ${formattedAmount} has been processed successfully.`,
        link: "/billing",
        isRead: false,
      });
    });
    
    // 2. Notify ALL superadmins with company context
    allSuperadmins.forEach(superadminId => {
      // Don't duplicate notification if superadmin is already in company admins
      const alreadyNotified = adminUsers.some(u => u.id === superadminId);
      if (!alreadyNotified) {
        notifications.push({
          userId: superadminId,
          type: "success",
          title: "Payment Received",
          message: invoiceNumber 
            ? `${companyName} paid ${formattedAmount} for invoice ${invoiceNumber}.`
            : `${companyName} paid ${formattedAmount}.`,
          link: `/companies/${companyId}?tab=billing`,
          isRead: false,
        });
      }
    });

    if (notifications.length === 0) {
      console.warn('[NOTIFICATION] No users to notify for payment success');
      return [];
    }

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    console.log(`[NOTIFICATION] Payment success: Notified ${notifications.length} users (${adminUsers.length} company admins + ${allSuperadmins.length - adminUsers.filter(u => u.role === 'superadmin').length} global superadmins)`);
    return result;
  }

  /**
   * Create a notification for when a payment is declined
   * Notifies all admins of the company AND all superadmins in the system
   */
  async notifyPaymentFailed(companyId: string, amount: number, currency: string, invoiceNumber?: string) {
    // Get company information for notification message
    const company = await storage.getCompany(companyId);
    const companyName = company?.name || 'Unknown Company';
    
    // Get all admin users for this company
    const users = await storage.getUsersByCompany(companyId);
    const adminUsers = users.filter(u => u.role === "admin" || u.role === "superadmin");
    
    // Get ALL superadmin users in the system (not just company superadmins)
    const allSuperadmins = await this.getSuperadminUserIds();
    
    // Format amount (amount is in cents from Stripe)
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
    
    const notifications: any[] = [];
    
    // 1. Notify company admins with actionable message
    adminUsers.forEach(user => {
      notifications.push({
        userId: user.id,
        type: "error",
        title: "Payment Declined",
        message: invoiceNumber 
          ? `Payment of ${formattedAmount} for invoice ${invoiceNumber} was declined. Please update your payment method.`
          : `Payment of ${formattedAmount} was declined. Please update your payment method.`,
        link: "/billing",
        isRead: false,
      });
    });
    
    // 2. Notify ALL superadmins with company context
    allSuperadmins.forEach(superadminId => {
      // Don't duplicate notification if superadmin is already in company admins
      const alreadyNotified = adminUsers.some(u => u.id === superadminId);
      if (!alreadyNotified) {
        notifications.push({
          userId: superadminId,
          type: "error",
          title: "Payment Declined",
          message: invoiceNumber 
            ? `${companyName} payment of ${formattedAmount} for invoice ${invoiceNumber} was declined.`
            : `${companyName} payment of ${formattedAmount} was declined.`,
          link: `/companies/${companyId}?tab=billing`,
          isRead: false,
        });
      }
    });

    if (notifications.length === 0) {
      console.warn('[NOTIFICATION] No users to notify for payment declined');
      return [];
    }

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    console.log(`[NOTIFICATION] Payment declined: Notified ${notifications.length} users (${adminUsers.length} company admins + ${allSuperadmins.length - adminUsers.filter(u => u.role === 'superadmin').length} global superadmins)`);
    return result;
  }

  /**
   * Create a notification for when a trial starts
   * Notifies all admins and superadmins of the company
   */
  async notifyTrialStarted(companyId: string, planName: string, trialEndDate: Date | null) {
    // Get all admin and superadmin users for this company
    const users = await storage.getUsersByCompany(companyId);
    const adminUsers = users.filter(u => u.role === "admin" || u.role === "superadmin");
    
    if (adminUsers.length === 0) {
      console.warn('[NOTIFICATION] No admin users found for company:', companyId);
      return [];
    }
    
    // Format trial end date
    let trialMessage = `Your ${planName} trial has started successfully.`;
    if (trialEndDate) {
      const daysRemaining = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      trialMessage = `Your ${planName} trial has started! You have ${daysRemaining} days to explore all features.`;
    }
    
    const notifications = adminUsers.map(user => ({
      userId: user.id,
      type: "success",
      title: "Trial Started",
      message: trialMessage,
      link: "/billing",
      isRead: false,
    }));

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
  }

  /**
   * Create notifications when a user requests a password reset
   * Notifies company admins and all superadmins
   */
  async notifyPasswordResetRequested(userId: string, userEmail: string, userName: string) {
    const user = await storage.getUser(userId);
    if (!user) return [];

    const notifications: InsertNotification[] = [];

    // Notify company admins if user belongs to a company
    if (user.companyId) {
      const companyUsers = await storage.getUsersByCompany(user.companyId);
      const adminUsers = companyUsers.filter(u => 
        u.role === "admin" && 
        u.id !== userId && 
        u.status === "active"
      );

      for (const admin of adminUsers) {
        notifications.push({
          userId: admin.id,
          type: "warning",
          title: "Password Reset Request",
          message: `${userName} (${userEmail}) has requested a password reset.`,
          link: "/settings?tab=team",
          isRead: false,
        });
      }
    }

    // Notify all superadmins
    const superadminIds = await this.getSuperadminUserIds();
    for (const superadminId of superadminIds) {
      if (superadminId !== userId) {
        notifications.push({
          userId: superadminId,
          type: "warning",
          title: "Password Reset Request",
          message: `${userName} (${userEmail}) has requested a password reset.`,
          link: "/users",
          isRead: false,
        });
      }
    }

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
  }

  /**
   * Create notifications when a password reset is completed
   * Notifies the user and all superadmins
   */
  async notifyPasswordResetCompleted(userId: string, userEmail: string, userName: string) {
    const notifications: InsertNotification[] = [];

    // Notify the user who changed their password
    notifications.push({
      userId: userId,
      type: "success",
      title: "Password Changed Successfully",
      message: "Your password has been changed. All active sessions and trusted devices have been cleared for security.",
      link: "/settings?tab=security",
      isRead: false,
    });

    // Notify all superadmins
    const superadminIds = await this.getSuperadminUserIds();
    for (const superadminId of superadminIds) {
      if (superadminId !== userId) {
        notifications.push({
          userId: superadminId,
          type: "info",
          title: "Password Reset Completed",
          message: `${userName} (${userEmail}) has successfully reset their password. All sessions and trusted devices have been cleared.`,
          link: "/users",
          isRead: false,
        });
      }
    }

    const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
    broadcastNotificationUpdate();
    return result;
  }

  /**
   * Create a notification when a consent document is signed
   */
  async notifyConsentSigned(
    quoteId: string,
    clientName: string,
    signedAt: Date,
    assignedUserId: string | null
  ) {
    const notifications: InsertNotification[] = [];
    
    // Notify the assigned user if there is one
    if (assignedUserId) {
      notifications.push({
        userId: assignedUserId,
        type: "info",
        title: "Consent Signed",
        message: `${clientName} signed the consent document on ${signedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        link: `/quotes/${quoteId}`,
        isRead: false,
      });
    }
    
    if (notifications.length > 0) {
      const result = await Promise.all(notifications.map(n => storage.createNotification(n)));
      broadcastNotificationUpdate();
      return result;
    }
    
    return [];
  }

  /**
   * Create a notification for when a new appointment is booked on landing page
   */
  async notifyAppointmentBooked(
    appointmentId: string,
    clientName: string,
    clientEmail: string,
    clientPhone: string,
    appointmentDate: string,
    appointmentTime: string,
    notes: string | null,
    userId: string
  ) {
    // Build detailed message with all appointment information
    let message = `${clientName} has scheduled an appointment for ${appointmentDate} at ${appointmentTime}. `;
    message += `Contact: ${clientEmail}`;
    if (clientPhone) {
      message += `, ${clientPhone}`;
    }
    if (notes) {
      message += `. Notes: ${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}`;
    }

    const notification: InsertNotification = {
      userId,
      type: "info",
      title: "New Appointment Scheduled",
      message,
      link: `/leads`,
      isRead: false,
    };
    const result = await storage.createNotification(notification);
    broadcastNotificationUpdate();
    return result;
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
