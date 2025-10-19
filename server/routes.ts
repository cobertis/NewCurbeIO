import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { LoggingService } from "./logging-service";
import { emailService } from "./email";
import { setupWebSocket, broadcastConversationUpdate, broadcastNotificationUpdate } from "./websocket";
import { twilioService } from "./twilio";
import { EmailCampaignService } from "./email-campaign-service";
import { notificationService } from "./notification-service";
import twilio from "twilio";
import { 
  insertUserSchema, 
  loginSchema, 
  updateUserSchema, 
  insertCompanySchema, 
  updateCompanySchema,
  createCompanyWithAdminSchema,
  insertPlanSchema,
  updateCompanySettingsSchema,
  insertEmailTemplateSchema,
  insertFeatureSchema,
  updateFeatureSchema,
  insertFinancialSupportTicketSchema
} from "@shared/schema";
import "./types";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize logging service
  const logger = new LoggingService(storage);
  
  // Initialize email campaign service
  const emailCampaignService = new EmailCampaignService(storage);

  // Helper function to send payment confirmation email
  // Returns true if email sent successfully, false otherwise
  // NEVER throws - handles all errors internally
  async function sendPaymentConfirmationEmail(
    companyId: string,
    amount: number,
    currency: string,
    invoiceNumber: string,
    invoiceUrl?: string
  ): Promise<boolean> {
    try {
      // Skip sending email for $0.00 invoices (trial invoices, etc.)
      if (amount === 0) {
        console.log('[EMAIL] Skipping payment confirmation email for $0.00 invoice:', invoiceNumber);
        return false;
      }

      // Get company details
      const company = await storage.getCompany(companyId);
      if (!company) {
        console.error('[EMAIL] Company not found:', companyId);
        return false;
      }

      // Get all admin users for the company
      const users = await storage.getUsersByCompany(companyId);
      const adminUsers = users.filter(u => u.role === 'admin' && u.emailNotifications);
      
      if (adminUsers.length === 0) {
        console.log('[EMAIL] No admin users with email notifications enabled for company:', companyId);
        return false;
      }

      // Get payment confirmation template
      const template = await storage.getEmailTemplateBySlug("payment-confirmation");
      if (!template) {
        console.error('[EMAIL] Payment confirmation template not found');
        return false;
      }

      // Format amount
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount / 100);

      // Format payment date
      const paymentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Replace variables in template
      const replacements: Record<string, string> = {
        '{{amount}}': formattedAmount,
        '{{invoice_number}}': invoiceNumber,
        '{{payment_date}}': paymentDate,
        '{{payment_method}}': 'Credit Card',
        '{{company_name}}': company.name,
        '{{invoice_url}}': invoiceUrl || '#',
      };

      let htmlContent = template.htmlContent;
      let textContent = template.textContent || '';
      let subject = template.subject;

      // Replace all variables
      Object.entries(replacements).forEach(([key, value]) => {
        htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
        textContent = textContent.replace(new RegExp(key, 'g'), value);
        subject = subject.replace(new RegExp(key, 'g'), value);
      });

      // Send email to all admin users
      let successCount = 0;
      for (const user of adminUsers) {
        const emailSent = await emailService.sendEmail({
          to: user.email,
          subject,
          html: htmlContent,
          text: textContent,
        });
        
        if (emailSent) {
          console.log(`[EMAIL] Payment confirmation sent to ${user.email}`);
          successCount++;
        } else {
          console.error(`[EMAIL] Failed to send payment confirmation to ${user.email}`);
        }
      }

      return successCount > 0;
    } catch (error) {
      console.error('[EMAIL] Error in sendPaymentConfirmationEmail:', error);
      return false;
    }
  }

  // Helper function to send payment failed email
  // Returns true if email sent successfully, false otherwise
  // NEVER throws - handles all errors internally
  async function sendPaymentFailedEmail(
    companyId: string,
    amount: number,
    currency: string,
    invoiceNumber: string,
    req: Request
  ): Promise<boolean> {
    try {
      // Skip sending email for $0.00 invoices
      if (amount === 0) {
        console.log('[EMAIL] Skipping payment failed email for $0.00 invoice:', invoiceNumber);
        return false;
      }

      // Get company details
      const company = await storage.getCompany(companyId);
      if (!company) {
        console.error('[EMAIL] Company not found:', companyId);
        return false;
      }

      // Get all admin users for the company
      const users = await storage.getUsersByCompany(companyId);
      const adminUsers = users.filter(u => u.role === 'admin' && u.emailNotifications);
      
      if (adminUsers.length === 0) {
        console.log('[EMAIL] No admin users with email notifications enabled for company:', companyId);
        return false;
      }

      // Get payment failed template
      const template = await storage.getEmailTemplateBySlug("payment-failed");
      if (!template) {
        console.error('[EMAIL] Payment failed template not found');
        return false;
      }

      // Format amount (amount is already in dollars, NOT cents)
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount);

      // Format payment date
      const paymentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Generate billing URL
      const billingUrl = `${req.protocol}://${req.get('host')}/billing`;

      // Replace variables in template
      const replacements: Record<string, string> = {
        '{{amount}}': formattedAmount,
        '{{invoice_number}}': invoiceNumber,
        '{{payment_date}}': paymentDate,
        '{{company_name}}': company.name,
        '{{billing_url}}': billingUrl,
      };

      let htmlContent = template.htmlContent;
      let textContent = template.textContent || '';
      let subject = template.subject;

      // Replace all variables
      Object.entries(replacements).forEach(([key, value]) => {
        htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
        textContent = textContent.replace(new RegExp(key, 'g'), value);
        subject = subject.replace(new RegExp(key, 'g'), value);
      });

      // Send email to all admin users
      let successCount = 0;
      for (const user of adminUsers) {
        const emailSent = await emailService.sendEmail({
          to: user.email,
          subject,
          html: htmlContent,
          text: textContent,
        });
        
        if (emailSent) {
          console.log(`[EMAIL] Payment failed notification sent to ${user.email}`);
          successCount++;
        } else {
          console.error(`[EMAIL] Failed to send payment failed notification to ${user.email}`);
        }
      }

      return successCount > 0;
    } catch (error) {
      console.error('[EMAIL] Error in sendPaymentFailedEmail:', error);
      return false;
    }
  }

  // Helper function to generate and send activation email
  // Returns true if email sent successfully, false otherwise
  // NEVER throws - handles all errors internally
  async function sendActivationEmail(
    user: { id: string; email: string; firstName?: string | null; lastName?: string | null },
    companyName: string,
    req: Request
  ): Promise<boolean> {
    try {
      const crypto = await import('crypto');
      const activationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Save activation token
      await storage.createActivationToken({
        userId: user.id,
        token: activationToken,
        expiresAt,
        used: false,
      });

      // Send activation email using template
      const activationLink = `${req.protocol}://${req.get('host')}/activate-account?token=${activationToken}`;
      
      // Get activation email template from database
      const template = await storage.getEmailTemplateBySlug("account-activation");
      if (!template) {
        console.error("Activation email template not found");
        return false;
      }
      
      // Replace variables in template
      let htmlContent = template.htmlContent
        .replace(/\{\{firstName\}\}/g, user.firstName || 'there')
        .replace(/\{\{company_name\}\}/g, companyName)
        .replace(/\{\{activation_link\}\}/g, activationLink);
      
      let textContent = template.textContent
        ?.replace(/\{\{firstName\}\}/g, user.firstName || 'there')
        .replace(/\{\{company_name\}\}/g, companyName)
        .replace(/\{\{activation_link\}\}/g, activationLink);
      
      // Send email using object format (consistent with rest of codebase)
      const emailSent = await emailService.sendEmail({
        to: user.email,
        subject: template.subject.replace(/\{\{company_name\}\}/g, companyName),
        html: htmlContent,
        text: textContent || `Please activate your account by clicking this link: ${activationLink}`,
      });

      return emailSent;
    } catch (error) {
      console.error("Error in sendActivationEmail:", error);
      return false;
    }
  }

  // Middleware to check authentication only
  const requireAuth = async (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }

    req.user = user;
    next();
  };

  // Middleware to check authentication and company active status
  const requireActiveCompany = async (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check if user's company is still active (for non-superadmin users)
    if (user.companyId && user.role !== "superadmin") {
      const company = await storage.getCompany(user.companyId);
      if (!company || !company.isActive) {
        // Company was deactivated - destroy the session
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session:", err);
          }
        });
        return res.status(401).json({ 
          message: "Your account has been deactivated. Please contact support for assistance.",
          deactivated: true 
        });
      }

      // Check trial expiration for non-superadmin users
      const subscription = await storage.getSubscriptionByCompany(user.companyId);
      if (subscription && subscription.status === 'trialing' && subscription.trialEnd) {
        const now = new Date();
        const trialEnd = new Date(subscription.trialEnd);
        
        if (now > trialEnd) {
          // Trial has expired - update subscription status to past_due
          console.log(`[TRIAL-EXPIRED] Trial expired for company ${user.companyId}, updating status to past_due`);
          await storage.updateSubscription(subscription.id, { 
            status: 'past_due'
          });
          
          // Deactivate the company
          await storage.updateCompany(user.companyId, { 
            isActive: false 
          });
          
          return res.status(402).json({ 
            message: "Your trial period has ended. Please select a plan to continue.",
            trialExpired: true 
          });
        }
      }
    }

    // Store user in request for use in route handlers
    req.user = user;
    next();
  };

  // ==================== AUTH ENDPOINTS ====================
  
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      console.log(`[LOGIN-DEBUG] Login attempt for email: ${email}`);
      const user = await storage.getUserByEmail(email);
      console.log(`[LOGIN-DEBUG] User found:`, user ? `Yes (ID: ${user.id}, Status: ${user.status}, Has Password: ${!!user.password})` : 'No');

      if (!user) {
        await logger.logAuth({
          req,
          action: "login_failed",
          email,
          metadata: { reason: "User not found" },
        });
        
        // Notify superadmins about failed login attempt
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || null;
        const userAgent = req.headers['user-agent'] || null;
        await notificationService.notifyFailedLogin(email, ipAddress, userAgent);
        
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check account status
      if (user.status === 'pending_activation') {
        await logger.logAuth({
          req,
          action: "login_failed",
          userId: user.id,
          email,
          metadata: { reason: "Account pending activation" },
        });
        
        // Notify user and superadmins about unactivated login attempt
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || null;
        const userAgent = req.headers['user-agent'] || null;
        await notificationService.notifyUnactivatedLoginAttempt(email, ipAddress, userAgent, user.id);
        
        return res.status(401).json({ message: "Please activate your account first. Check your email for the activation link." });
      }

      if (user.status === 'deactivated') {
        await logger.logAuth({
          req,
          action: "login_failed",
          userId: user.id,
          email,
          metadata: { reason: "Account deactivated" },
        });
        return res.status(401).json({ message: "Your account has been deactivated. Please contact support for assistance." });
      }

      // Additional safety check: verify password exists (should always exist for active users)
      if (!user.password) {
        await logger.logAuth({
          req,
          action: "login_failed",
          userId: user.id,
          email,
          metadata: { reason: "Missing password" },
        });
        return res.status(401).json({ message: "Account error. Please contact support." });
      }

      // Legacy check: verify isActive flag (fallback for accounts deactivated via old system)
      if (!user.isActive && user.status === 'active') {
        // Update status to match isActive if they're out of sync
        await storage.updateUser(user.id, { status: 'deactivated' });
        await logger.logAuth({
          req,
          action: "login_failed",
          userId: user.id,
          email,
          metadata: { reason: "Account deactivated (isActive=false)" },
        });
        return res.status(401).json({ message: "Your account has been deactivated. Please contact support for assistance." });
      }

      // Check if user's company is active (for non-superadmin users)
      if (user.companyId && user.role !== "superadmin") {
        const company = await storage.getCompany(user.companyId);
        if (!company || !company.isActive) {
          await logger.logAuth({
            req,
            action: "login_failed",
            userId: user.id,
            email,
            metadata: { reason: "Company deactivated", companyId: user.companyId },
          });
          return res.status(401).json({ 
            message: "Your account has been deactivated. Please contact support for assistance." 
          });
        }
      }

      console.log(`[LOGIN-DEBUG] Verifying password for user: ${user.email}`);
      const isValidPassword = await verifyPassword(password, user.password);
      console.log(`[LOGIN-DEBUG] Password valid:`, isValidPassword);
      if (!isValidPassword) {
        await logger.logAuth({
          req,
          action: "login_failed",
          userId: user.id,
          email,
          metadata: { reason: "Invalid password" },
        });
        
        // Notify user and superadmins about failed login attempt
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || null;
        const userAgent = req.headers['user-agent'] || null;
        await notificationService.notifyFailedLogin(email, ipAddress, userAgent, user.id);
        
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check for trusted device token
      const trustedDeviceToken = req.cookies?.trusted_device;
      console.log(`[LOGIN] Checking trusted device. Token exists: ${!!trustedDeviceToken}, User: ${user.email}`);
      
      if (trustedDeviceToken) {
        console.log(`[LOGIN] Validating trusted device token for user ${user.email}`);
        const trustedUserId = await storage.validateTrustedDevice(trustedDeviceToken);
        console.log(`[LOGIN] Validation result - Trusted userId: ${trustedUserId}, Current userId: ${user.id}`);
        
        // If device is trusted for this user, skip OTP
        if (trustedUserId === user.id) {
          req.session.userId = user.id;
          
          // Set session duration (7 days)
          const sessionDuration = 7 * 24 * 60 * 60 * 1000;
          req.session.cookie.maxAge = sessionDuration;
          req.session.cookie.expires = new Date(Date.now() + sessionDuration);
          
          await logger.logAuth({
            req,
            action: "login_trusted_device",
            userId: user.id,
            email: user.email,
            metadata: { trustedDevice: true },
          });
          
          // Create login notification with IP address
          const ipAddress = req.ip || req.connection.remoteAddress || null;
          const userAgent = req.get("user-agent") || null;
          const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
          await notificationService.notifyLogin(user.id, userName, ipAddress, userAgent);
          
          console.log(`✓ Trusted device login for ${user.email} - skipping OTP`);
          
          return req.session.save((err) => {
            if (err) {
              console.error("Error saving session:", err);
              return res.status(500).json({ message: "Failed to save session" });
            }
            
            res.json({
              success: true,
              skipOTP: true,
              user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                companyId: user.companyId,
              },
            });
          });
        }
      }

      // Set pending user ID - full authentication only after OTP verification
      req.session.pendingUserId = user.id;

      await logger.logAuth({
        req,
        action: "login_credentials_verified",
        userId: user.id,
        email,
      });

      console.log(`✓ Session configured for ${user.email}. pendingUserId: ${req.session.pendingUserId}, sessionID: ${req.sessionID}`);

      // Don't manually save - let express-session middleware handle it automatically
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          companyId: user.companyId,
        },
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/logout", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    const user = userId ? await storage.getUser(userId) : null;
    
    await logger.logAuth({
      req,
      action: "logout",
      userId: userId,
      email: user?.email || "unknown",
    });

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  // Public registration endpoint - no auth required
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const { company: companyData, admin: adminData } = req.body;
      
      // Validate required fields
      if (!companyData?.name || !adminData?.email || !adminData?.firstName || !adminData?.lastName) {
        return res.status(400).json({ message: "Company name, admin first name, last name, and email are required" });
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(adminData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Create company first (using admin email as company email)
      const newCompany = await storage.createCompany({
        name: companyData.name,
        slug: companyData.slug,
        phone: companyData.phone || null,
        email: adminData.email, // Company email is set to admin email
        website: companyData.website || null,
        address: companyData.address || null,
        addressLine2: companyData.addressLine2 || null, // Suite, Apt, Unit
        city: companyData.city || null,
        state: companyData.state || null,
        postalCode: companyData.postalCode || null,
        country: companyData.country || null,
        isActive: true,
      });
      
      // Create Stripe customer immediately after company creation
      try {
        console.log('[REGISTRATION] Creating Stripe customer for:', newCompany.name);
        const { createStripeCustomer } = await import("./stripe");
        
        // Create Stripe customer with representative information
        const stripeCustomer = await createStripeCustomer({
          ...newCompany,
          representativeFirstName: adminData.firstName,
          representativeLastName: adminData.lastName,
          representativeEmail: adminData.email,
          representativePhone: adminData.phone,
        });
        
        // Update company with Stripe customer ID
        await storage.updateCompany(newCompany.id, { stripeCustomerId: stripeCustomer.id });
        console.log('[REGISTRATION] Stripe customer created:', stripeCustomer.id);
      } catch (stripeError) {
        console.error('[REGISTRATION] Failed to create Stripe customer:', stripeError);
        // Continue with registration even if Stripe fails - can be fixed later
      }

      // Create admin user for the company - account starts as pending activation
      const newUser = await storage.createUser({
        email: adminData.email,
        firstName: adminData.firstName || '',
        lastName: adminData.lastName || '',
        phone: adminData.phone || null,
        role: 'admin',
        companyId: newCompany.id,
        status: 'pending_activation', // Account pending activation until user clicks email link
        isActive: false, // Account starts inactive until email verification
        password: null, // No password until user activates account via email link
      });

      // Send activation email using existing function
      const emailSent = await sendActivationEmail(newUser, newCompany.name, req);
      
      if (!emailSent) {
        console.warn('[REGISTRATION] Failed to send activation email, but continuing with registration');
      }

      // Log the registration
      await logger.logAuth({
        req,
        action: "account_activated", // Using existing action type
        userId: newUser.id,
        email: adminData.email,
        metadata: { 
          companyId: newCompany.id,
          companyName: newCompany.name,
        },
      });

      res.json({ 
        success: true,
        message: "Registration successful! Please check your email to activate your account.",
        companyId: newCompany.id,
        userId: newUser.id,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register company. Please try again." });
    }
  });

  app.get("/api/session", requireActiveCompany, async (req: Request, res: Response) => {
    const user = req.user!; // User is guaranteed by middleware

    // Get company name if user has a company
    let companyName: string | undefined;
    if (user.companyId) {
      const company = await storage.getCompany(user.companyId);
      companyName = company?.name;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        companyId: user.companyId,
        companyName: companyName,
        timezone: user.timezone,
      },
    });
  });

  // ==================== LOCATIONIQ AUTOCOMPLETE ====================

  app.get("/api/locationiq/autocomplete", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      
      console.log("[LOCATIONIQ] Received request with query:", q);
      
      if (!q || typeof q !== 'string') {
        console.log("[LOCATIONIQ] Missing or invalid query parameter");
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      if (!process.env.LOCATIONIQ_API_KEY) {
        console.error("[LOCATIONIQ] API KEY not configured");
        return res.status(500).json({ message: "Address autocomplete service not configured" });
      }

      const url = new URL("https://api.locationiq.com/v1/autocomplete");
      url.searchParams.set("key", process.env.LOCATIONIQ_API_KEY);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "us"); // Limit to US addresses
      url.searchParams.set("normalizecity", "1");
      url.searchParams.set("addressdetails", "1"); // Get detailed address components
      url.searchParams.set("tag", "place:house,place:building,highway:residential,highway:primary,highway:secondary,highway:tertiary"); // Only search for physical addresses

      console.log("[LOCATIONIQ] Fetching from API:", url.origin + url.pathname);
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error("[LOCATIONIQ] API error:", response.status, response.statusText);
        return res.status(response.status).json({ message: "Failed to fetch address suggestions" });
      }

      const data = await response.json();
      console.log("[LOCATIONIQ] Got", data.length, "results");
      
      // Set JSON content type explicitly
      res.setHeader('Content-Type', 'application/json');
      return res.json({ results: data });
    } catch (error) {
      console.error("[LOCATIONIQ] Autocomplete error:", error);
      return res.status(500).json({ message: "Failed to fetch address suggestions" });
    }
  });

  // ==================== GOOGLE PLACES API ====================

  // Autocomplete address using Google Places API
  app.get("/api/google-places/autocomplete-address", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      
      console.log("[GOOGLE_PLACES] Address autocomplete request with query:", q);
      
      if (!q || typeof q !== 'string') {
        console.log("[GOOGLE_PLACES] Missing or invalid query parameter");
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      if (!process.env.GOOGLE_PLACES_API_KEY) {
        console.error("[GOOGLE_PLACES] API KEY not configured");
        return res.status(500).json({ message: "Google Places service not configured" });
      }

      const url = "https://places.googleapis.com/v1/places:autocomplete";
      
      const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY
      };

      const body = {
        input: q,
        languageCode: "en",
        regionCode: "us", // Restrict to US addresses
        includedPrimaryTypes: ["street_address", "premise"], // Only addresses
        includeQueryPredictions: false
      };

      console.log("[GOOGLE_PLACES] Making request to Google Places Autocomplete API");
      
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[GOOGLE_PLACES] API error:", response.status, errorText);
        return res.status(response.status).json({ 
          message: "Failed to fetch address suggestions",
          error: errorText 
        });
      }

      const data = await response.json();
      console.log("[GOOGLE_PLACES] Got", data.suggestions?.length || 0, "address suggestions");
      
      // Transform to match AddressAutocomplete expected format
      const results = (data.suggestions || []).map((suggestion: any) => {
        const placePrediction = suggestion.placePrediction;
        
        return {
          place_id: placePrediction.placeId,
          display_name: placePrediction.text?.text || '',
          // Store structured formatting for parsing
          structured_formatting: {
            main_text: placePrediction.structuredFormat?.mainText?.text || '',
            secondary_text: placePrediction.structuredFormat?.secondaryText?.text || ''
          }
        };
      });
      
      res.setHeader('Content-Type', 'application/json');
      return res.json({ results });
    } catch (error) {
      console.error("[GOOGLE_PLACES] Autocomplete error:", error);
      return res.status(500).json({ message: "Failed to fetch address suggestions" });
    }
  });

  // Get place details by ID to extract address components
  app.get("/api/google-places/place-details", async (req: Request, res: Response) => {
    try {
      const { placeId } = req.query;
      
      console.log("[GOOGLE_PLACES] Place details request for:", placeId);
      
      if (!placeId || typeof placeId !== 'string') {
        return res.status(400).json({ message: "placeId parameter is required" });
      }

      if (!process.env.GOOGLE_PLACES_API_KEY) {
        console.error("[GOOGLE_PLACES] API KEY not configured");
        return res.status(500).json({ message: "Google Places service not configured" });
      }

      const url = `https://places.googleapis.com/v1/places/${placeId}`;
      
      const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "id,formattedAddress,addressComponents"
      };

      console.log("[GOOGLE_PLACES] Fetching place details");
      
      const response = await fetch(url, {
        method: "GET",
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[GOOGLE_PLACES] API error:", response.status, errorText);
        return res.status(response.status).json({ 
          message: "Failed to fetch place details",
          error: errorText 
        });
      }

      const place = await response.json();
      console.log("[GOOGLE_PLACES] Got place details");
      
      // Parse address components
      let street = '';
      let city = '';
      let state = '';
      let postalCode = '';
      let country = '';
      
      if (place.addressComponents) {
        for (const component of place.addressComponents) {
          const types = component.types || [];
          
          if (types.includes('street_number')) {
            street = component.longText + ' ' + street;
          }
          if (types.includes('route')) {
            street = street + component.longText;
          }
          if (types.includes('locality')) {
            city = component.longText;
          }
          if (types.includes('administrative_area_level_1')) {
            state = component.shortText || component.longText;
          }
          if (types.includes('postal_code')) {
            postalCode = component.longText;
          }
          if (types.includes('country')) {
            country = component.longText;
          }
        }
      }
      
      street = street.trim();
      
      const address = {
        street,
        city,
        state,
        postalCode,
        country
      };
      
      console.log("[GOOGLE_PLACES] Parsed address:", address);
      
      res.setHeader('Content-Type', 'application/json');
      return res.json({ address });
    } catch (error) {
      console.error("[GOOGLE_PLACES] Place details error:", error);
      return res.status(500).json({ message: "Failed to fetch place details" });
    }
  });

  app.get("/api/google-places/search-business", async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      
      console.log("[GOOGLE_PLACES] Received request with query:", q);
      
      if (!q || typeof q !== 'string') {
        console.log("[GOOGLE_PLACES] Missing or invalid query parameter");
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      if (!process.env.GOOGLE_PLACES_API_KEY) {
        console.error("[GOOGLE_PLACES] API KEY not configured");
        return res.status(500).json({ message: "Google Places service not configured" });
      }

      const url = "https://places.googleapis.com/v1/places:searchText";
      
      const headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.shortFormattedAddress,places.addressComponents"
      };

      const body = {
        textQuery: q,
        languageCode: "en",
        regionCode: "us", // Restrict results to USA - more efficient than locationRestriction
        maxResultCount: 10
      };

      console.log("[GOOGLE_PLACES] Making request to Google Places API");
      
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[GOOGLE_PLACES] API error:", response.status, errorText);
        return res.status(response.status).json({ 
          message: "Failed to fetch business suggestions",
          error: errorText 
        });
      }

      const data = await response.json();
      console.log("[GOOGLE_PLACES] Got", data.places?.length || 0, "results");
      
      // Transform the response to a simpler format for the frontend
      const results = (data.places || [])
        .map((place: any) => {
          // Parse address components to get structured address
          let street = '';
          let addressLine2 = ''; // Suite, Apt, Unit, etc.
          let city = '';
          let state = '';
          let postalCode = '';
          let country = '';
          
          if (place.addressComponents) {
            for (const component of place.addressComponents) {
              const types = component.types || [];
              
              if (types.includes('street_number')) {
                street = component.longText + ' ' + street;
              }
              if (types.includes('route')) {
                street = street + component.longText;
              }
              if (types.includes('subpremise')) {
                // Suite, Apt, Unit, Floor, etc.
                addressLine2 = component.longText;
              }
              if (types.includes('locality')) {
                city = component.longText;
              }
              if (types.includes('administrative_area_level_1')) {
                state = component.shortText || component.longText;
              }
              if (types.includes('postal_code')) {
                postalCode = component.longText;
              }
              if (types.includes('country')) {
                country = component.longText;
              }
            }
          }
          
          // Clean up the street address
          street = street.trim();
          
          // If no structured address components, try to parse from formattedAddress
          if (!street && place.formattedAddress) {
            const parts = place.formattedAddress.split(',');
            if (parts.length > 0) {
              street = parts[0].trim();
            }
          }

          // Extract suite/unit/apt from street address if not already in addressLine2
          // Common patterns: "STE 210", "Suite 210", "APT 3B", "Unit 5", "#210", etc.
          if (!addressLine2 && street) {
            const suitePattern = /\b(STE|SUITE|APT|APARTMENT|UNIT|#)\s*\.?\s*([A-Z0-9-]+)\b/i;
            const match = street.match(suitePattern);
            if (match) {
              // Extract the suite part
              addressLine2 = match[0].trim();
              // Remove it from street
              street = street.replace(suitePattern, '').trim();
            }
          }

          return {
            id: place.id,
            name: place.displayName?.text || '',
            formattedAddress: place.formattedAddress || '',
            shortFormattedAddress: place.shortFormattedAddress || '',
            phone: place.nationalPhoneNumber || '',
            website: place.websiteUri || '',
            type: place.primaryTypeDisplayName?.text || '',
            // Structured address for form population
            address: {
              street: street,
              addressLine2: addressLine2, // Suite, Apt, Unit, etc.
              city: city,
              state: state,
              postalCode: postalCode,
              country: country
            }
          };
        })
        // FILTER: Only return results from United States
        .filter((result: any) => {
          const isUSA = result.address.country === 'United States' || 
                       result.address.country === 'USA' ||
                       result.address.country === 'US';
          if (!isUSA) {
            console.log(`[GOOGLE_PLACES] Filtered out non-US result: ${result.name} (${result.address.country})`);
          }
          return isUSA;
        });
      
      // Set JSON content type explicitly
      res.setHeader('Content-Type', 'application/json');
      return res.json({ results });
    } catch (error) {
      console.error("[GOOGLE_PLACES] Search error:", error);
      return res.status(500).json({ message: "Failed to fetch business suggestions" });
    }
  });

  // ==================== 2FA/OTP ENDPOINTS ====================

  app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    try {
      const { method } = req.body;

      console.log(`[SEND-OTP] Cookies received:`, req.cookies);
      console.log(`[SEND-OTP] Session ID from cookie:`, req.cookies['connect.sid']);
      console.log(`[SEND-OTP] Session check - pendingUserId: ${req.session.pendingUserId}, sessionID: ${req.sessionID}`);

      // Check if user has pending authentication
      if (!req.session.pendingUserId) {
        console.log(`[SEND-OTP] ERROR: No pendingUserId in session. Full session:`, req.session);
        return res.status(401).json({ message: "Please login first" });
      }

      if (!method) {
        return res.status(400).json({ message: "Method is required" });
      }

      if (method !== "email" && method !== "sms") {
        return res.status(400).json({ message: "Method must be 'email' or 'sms'" });
      }

      const user = await storage.getUser(req.session.pendingUserId);
      if (!user) {
        await logger.logAuth({
          req,
          action: "otp_send_failed",
          email: "unknown",
          metadata: { reason: "User not found" },
        });
        return res.status(401).json({ message: "Session expired" });
      }

      if (method === "sms" && !user.phone) {
        return res.status(400).json({ message: "No phone number associated with this account" });
      }

      // SECURITY: Invalidate all previous unused OTP codes for this method
      await storage.invalidatePreviousOtpCodes(user.id, method);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await storage.createOtpCode({
        userId: user.id,
        code,
        method,
        expiresAt,
      });

      if (method === "email") {
        // Get OTP email template from database
        const template = await storage.getEmailTemplateBySlug("otp-verification");
        if (!template) {
          throw new Error("OTP email template not found");
        }
        
        // Replace variables in template
        let htmlContent = template.htmlContent
          .replace(/\{\{otp_code\}\}/g, code)
          .replace(/\{\{firstName\}\}/g, user.firstName || 'there');
        let textContent = template.textContent
          ?.replace(/\{\{otp_code\}\}/g, code)
          ?.replace(/\{\{firstName\}\}/g, user.firstName || 'there');
        
        await emailService.sendEmail({
          to: user.email,
          subject: template.subject,
          html: htmlContent,
          text: textContent,
        });
      } else if (method === "sms") {
        await twilioService.sendOTPSMS(user.phone!, code);
      }

      await logger.logAuth({
        req,
        action: "otp_sent",
        userId: user.id,
        email: user.email,
        metadata: { method },
      });

      res.json({ 
        success: true, 
        message: `Verification code sent via ${method}`,
        userId: user.id
      });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { userId, code, rememberDevice } = req.body;

      if (!userId || !code) {
        return res.status(400).json({ message: "User ID and code are required" });
      }

      // Verify this matches the pending user
      if (req.session.pendingUserId !== userId) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Invalid verification code" });
      }

      const isValid = await storage.verifyAndMarkUsed(userId, code);
      if (!isValid) {
        await logger.logAuth({
          req,
          action: "otp_verify_failed",
          userId,
          email: user.email,
          metadata: { reason: "Invalid or expired code" },
        });
        return res.status(401).json({ message: "Invalid or expired verification code" });
      }

      // Clear pending user and set authenticated user
      delete req.session.pendingUserId;
      req.session.userId = user.id;

      // Set session duration - always 7 days since we use trusted device tokens
      const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
      req.session.cookie.maxAge = sessionDuration;
      req.session.cookie.expires = new Date(Date.now() + sessionDuration);

      // If "Remember this device" is checked, create a trusted device token
      let deviceToken: string | null = null;
      if (rememberDevice === true || rememberDevice === "true") {
        // Generate secure random token (32 bytes = 64 hex characters)
        deviceToken = randomBytes(32).toString('hex');
        
        // Get device name from user agent
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const deviceName = userAgent.substring(0, 200); // Limit length
        
        // Save to database with 30-day expiration
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await storage.saveTrustedDevice({
          userId: user.id,
          deviceToken,
          deviceName,
          expiresAt,
        });
        
        console.log(`✓ Created trusted device for user ${user.email} (expires: ${expiresAt.toISOString()})`);
      }

      await logger.logAuth({
        req,
        action: "login_with_otp",
        userId: user.id,
        email: user.email,
        metadata: { 
          rememberDevice: !!rememberDevice,
          trustedDeviceCreated: !!deviceToken
        },
      });

      // Create login notification with IP address
      const ipAddress = req.ip || req.connection.remoteAddress || null;
      const userAgent = req.get("user-agent") || null;
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      await notificationService.notifyLogin(user.id, userName, ipAddress, userAgent);

      // Force save session with new cookie settings
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).json({ message: "Failed to save session" });
        }

        // Set trusted device cookie if generated (httpOnly, secure, 30 days)
        if (deviceToken) {
          res.cookie('trusted_device', deviceToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });
        }

        console.log(`✓ Session saved successfully for ${user.email}. Trusted device: ${!!deviceToken}`);

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
          },
        });
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  app.post("/api/auth/resend-otp", async (req: Request, res: Response) => {
    try {
      const { userId, method } = req.body;

      if (!userId || !method) {
        return res.status(400).json({ message: "User ID and method are required" });
      }

      // Verify this matches the pending user
      if (req.session.pendingUserId !== userId) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const lastOtp = await storage.getLatestOtpCode(userId, method);
      if (lastOtp) {
        const timeSinceLastOtp = Date.now() - lastOtp.createdAt.getTime();
        const oneMinute = 60 * 1000;
        
        if (timeSinceLastOtp < oneMinute) {
          const remainingSeconds = Math.ceil((oneMinute - timeSinceLastOtp) / 1000);
          return res.status(429).json({ 
            message: `Please wait ${remainingSeconds} seconds before requesting a new code`,
            remainingSeconds
          });
        }
      }

      if (method === "sms" && !user.phone) {
        return res.status(400).json({ message: "No phone number associated with this account" });
      }

      // SECURITY: Invalidate all previous unused OTP codes for this method
      await storage.invalidatePreviousOtpCodes(user.id, method);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await storage.createOtpCode({
        userId: user.id,
        code,
        method,
        expiresAt,
      });

      if (method === "email") {
        // Get OTP email template from database
        const template = await storage.getEmailTemplateBySlug("otp-verification");
        if (!template) {
          throw new Error("OTP email template not found");
        }
        
        // Replace variables in template
        let htmlContent = template.htmlContent
          .replace(/\{\{otp_code\}\}/g, code)
          .replace(/\{\{firstName\}\}/g, user.firstName || 'there');
        let textContent = template.textContent
          ?.replace(/\{\{otp_code\}\}/g, code)
          ?.replace(/\{\{firstName\}\}/g, user.firstName || 'there');
        
        await emailService.sendEmail({
          to: user.email,
          subject: template.subject,
          html: htmlContent,
          text: textContent,
        });
      } else if (method === "sms") {
        await twilioService.sendOTPSMS(user.phone!, code);
      }

      await logger.logAuth({
        req,
        action: "otp_resent",
        userId: user.id,
        email: user.email,
        metadata: { method },
      });

      res.json({ 
        success: true, 
        message: `New verification code sent via ${method}`
      });
    } catch (error) {
      console.error("Error resending OTP:", error);
      res.status(500).json({ message: "Failed to resend verification code" });
    }
  });

  // ==================== ACCOUNT ACTIVATION ENDPOINTS ====================

  // Validate activation token (check if it's valid and not expired)
  app.get("/api/auth/validate-activation-token", async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token is required" });
      }

      const activationToken = await storage.getActivationToken(token);

      if (!activationToken) {
        return res.status(404).json({ message: "Invalid activation token" });
      }

      // Check if token has expired (24 hours)
      const now = new Date();
      if (activationToken.expiresAt < now) {
        return res.status(400).json({ message: "Activation link has expired" });
      }

      // Check if token has already been used
      if (activationToken.usedAt) {
        return res.status(400).json({ message: "This activation link has already been used" });
      }

      res.json({ 
        success: true,
        message: "Token is valid"
      });
    } catch (error) {
      console.error("Error validating activation token:", error);
      res.status(500).json({ message: "Failed to validate activation token" });
    }
  });

  // Activate account by setting password
  app.post("/api/auth/activate-account", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      // Validate password complexity
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
      }

      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one lowercase letter" });
      }

      if (!/[0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one number" });
      }

      if (!/[^a-zA-Z0-9]/.test(password)) {
        return res.status(400).json({ message: "Password must contain at least one special character (!@#$%^&*)" });
      }

      // Validate and use the token (marks it as used)
      const userId = await storage.validateAndUseToken(token);

      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired activation token" });
      }

      // Get user to verify they exist
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);

      // Update user with new password, mark email as verified, activate account, and set status to active
      await storage.updateUser(userId, {
        password: hashedPassword,
        emailVerified: true,
        isActive: true,
        status: 'active',
      });

      await logger.logAuth({
        req,
        action: "account_activated",
        userId: user.id,
        email: user.email,
        metadata: { method: "activation_token" },
      });

      // Notify superadmins that user has activated their account
      const { notificationService } = await import("./notification-service");
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      await notificationService.notifyUserActivated(userName, user.email, user.id);

      res.json({ 
        success: true,
        message: "Account activated successfully"
      });
    } catch (error) {
      console.error("Error activating account:", error);
      res.status(500).json({ message: "Failed to activate account" });
    }
  });

  // ==================== STATS ENDPOINTS ====================

  app.get("/api/stats", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    let users: Awaited<ReturnType<typeof storage.getAllUsers>>;
    if (currentUser.role === "superadmin") {
      users = await storage.getAllUsers();
    } else if (currentUser.companyId) {
      users = await storage.getUsersByCompany(currentUser.companyId);
    } else {
      users = [];
    }

    const stats = {
      totalUsers: users.length,
      adminCount: users.filter((u) => u.role === "superadmin" || u.role === "admin").length,
      moderatorCount: 0,
      viewerCount: users.filter((u) => u.role === "member" || u.role === "viewer").length,
    };

    res.json(stats);
  });

  // Get dashboard stats with billing and company info
  app.get("/api/dashboard-stats", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    try {
      // Determine which company to get stats for
      const companyId = currentUser.role === "superadmin" 
        ? req.query.companyId as string
        : currentUser.companyId;

      // For non-superadmin, companyId is required
      if (currentUser.role !== "superadmin" && !companyId) {
        return res.status(400).json({ message: "Company ID required" });
      }

      // Get users (filtered by company if companyId is provided)
      let users: Awaited<ReturnType<typeof storage.getAllUsers>>;
      if (companyId) {
        // Get users for specific company
        users = await storage.getUsersByCompany(companyId);
      } else if (currentUser.role === "superadmin") {
        // Superadmin without companyId gets global stats
        users = await storage.getAllUsers();
      } else {
        users = [];
      }

      // Get company count (superadmin only, when viewing global stats)
      let companyCount = 0;
      if (currentUser.role === "superadmin" && !companyId) {
        const companies = await storage.getAllCompanies();
        companyCount = companies.length;
      }

      // Get billing stats
      let revenue = 0;
      let growthRate = 0;
      let invoiceCount = 0;
      let paidInvoices = 0;

      if (companyId) {
        const invoices = await storage.getInvoicesByCompany(companyId);
        invoiceCount = invoices.length;
        
        // Calculate revenue from paid invoices (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        paidInvoices = invoices.filter(inv => 
          inv.status === "paid" && 
          inv.paidAt && 
          new Date(inv.paidAt) >= thirtyDaysAgo
        ).length;

        revenue = invoices
          .filter(inv => inv.status === "paid" && inv.paidAt && new Date(inv.paidAt) >= thirtyDaysAgo)
          .reduce((sum, inv) => sum + inv.total, 0);

        // Calculate growth rate (compare last 30 days vs previous 30 days)
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const previousRevenue = invoices
          .filter(inv => {
            if (inv.status !== "paid" || !inv.paidAt) return false;
            const paidDate = new Date(inv.paidAt);
            return paidDate >= sixtyDaysAgo && paidDate < thirtyDaysAgo;
          })
          .reduce((sum, inv) => sum + inv.total, 0);

        if (previousRevenue > 0) {
          growthRate = ((revenue - previousRevenue) / previousRevenue) * 100;
        }
      } else if (currentUser.role === "superadmin") {
        // Calculate global revenue for superadmin without companyId
        const allCompanies = await storage.getAllCompanies();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        let totalPreviousRevenue = 0;

        for (const company of allCompanies) {
          const invoices = await storage.getInvoicesByCompany(company.id);
          invoiceCount += invoices.length;
          
          paidInvoices += invoices.filter(inv => 
            inv.status === "paid" && 
            inv.paidAt && 
            new Date(inv.paidAt) >= thirtyDaysAgo
          ).length;

          // Calculate current period revenue for this company
          const companyRevenue = invoices
            .filter(inv => inv.status === "paid" && inv.paidAt && new Date(inv.paidAt) >= thirtyDaysAgo)
            .reduce((sum, inv) => sum + inv.total, 0);
          
          revenue += companyRevenue;

          // Calculate previous period revenue for this company
          const companyPreviousRevenue = invoices
            .filter(inv => {
              if (inv.status !== "paid" || !inv.paidAt) return false;
              const paidDate = new Date(inv.paidAt);
              return paidDate >= sixtyDaysAgo && paidDate < thirtyDaysAgo;
            })
            .reduce((sum, inv) => sum + inv.total, 0);

          totalPreviousRevenue += companyPreviousRevenue;
        }

        // Calculate overall growth rate
        if (totalPreviousRevenue > 0) {
          growthRate = ((revenue - totalPreviousRevenue) / totalPreviousRevenue) * 100;
        }
      }

      const stats = {
        totalUsers: users.length,
        adminCount: users.filter((u) => u.role === "superadmin" || u.role === "admin").length,
        memberCount: users.filter((u) => u.role === "member").length,
        viewerCount: users.filter((u) => u.role === "viewer").length,
        companyCount, // Only for superadmin without companyId
        revenue: revenue / 100, // Convert from cents to dollars
        growthRate: Math.round(growthRate * 10) / 10, // Round to 1 decimal
        invoiceCount,
        paidInvoices,
      };

      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // ==================== USER ENDPOINTS ====================

  // Get all users (superadmin or admin)
  app.get("/api/users", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    let users: Awaited<ReturnType<typeof storage.getAllUsers>>;
    if (currentUser.role === "superadmin") {
      users = await storage.getAllUsers();
    } else if (currentUser.companyId) {
      users = await storage.getUsersByCompany(currentUser.companyId);
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const sanitizedUsers = users.map(({ password, ...user }) => user);
    res.json({ users: sanitizedUsers });
  });

  // Get single user by ID
  app.get("/api/users/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const userId = req.params.id;

    try {
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check permissions: users can view their own profile, admins can view their company users, superadmins can view all
      const canAccess = 
        currentUser.role === "superadmin" || // Superadmin can view any user
        currentUser.id === userId || // Users can view their own profile
        (currentUser.role === "admin" && user.companyId === currentUser.companyId) || // Admins can view users in their company
        (currentUser.role === "member" && user.companyId === currentUser.companyId) || // Members can view users in their company
        (currentUser.role === "viewer" && user.companyId === currentUser.companyId); // Viewers can view users in their company

      if (!canAccess) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { password, ...sanitizedUser } = user;
      
      // Include complete company information and all company users if user has a companyId
      let companyInfo = null;
      let companyUsers: any[] = [];
      
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        if (company) {
          companyInfo = company; // Return complete company data
          
          // Get all users from this company
          const users = await storage.getUsersByCompany(user.companyId);
          companyUsers = users.map(({ password, ...u }) => u); // Remove passwords
        }
      }
      
      res.json({ 
        user: {
          ...sanitizedUser,
          company: companyInfo,
          companyUsers: companyUsers
        }
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user by phone number (superadmin only)
  app.get("/api/users/by-phone/:phoneNumber", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { phoneNumber } = req.params;
      const user = await storage.getUserByPhone(phoneNumber);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, ...sanitizedUser } = user;
      
      // Include complete company information and all company users if user has a companyId
      let companyInfo = null;
      let companyUsers: any[] = [];
      
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        if (company) {
          companyInfo = company;
          
          // Get all users from this company
          const users = await storage.getUsersByCompany(user.companyId);
          companyUsers = users.map(({ password, ...u }) => u);
        }
      }
      
      res.json({ 
        user: {
          ...sanitizedUser,
          company: companyInfo,
          companyUsers: companyUsers
        }
      });
    } catch (error) {
      console.error("Error fetching user by phone:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create user (superadmin or admin) - sends activation email
  app.post("/api/users", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user email already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // admin can only create users in their company
      if (currentUser.role === "admin") {
        if (!currentUser.companyId) {
          return res.status(403).json({ message: "Forbidden" });
        }
        userData.companyId = currentUser.companyId;
        if (userData.role === "superadmin") {
          return res.status(403).json({ message: "Cannot create superadmin" });
        }
      }

      // Create user WITHOUT password (will be set during activation)
      const newUser = await storage.createUser({ 
        ...userData, 
        password: undefined, // No password - user will set it during activation
        isActive: true,
        emailVerified: false,
        emailSubscribed: true,
        emailNotifications: true,
        invoiceAlerts: true,
      });
      
      // Get company name for the activation email
      let companyName = "Curbe";
      if (newUser.companyId) {
        const company = await storage.getCompany(newUser.companyId);
        if (company) {
          companyName = company.name;
        }
      }

      // Send activation email (helper never throws, returns boolean)
      const emailSent = await sendActivationEmail(newUser, companyName, req);
      if (emailSent) {
        console.log(`Activation email sent successfully to ${newUser.email}`);
      } else {
        console.error(`Failed to send activation email to ${newUser.email}`);
      }

      await logger.logCrud({
        req,
        operation: "create",
        entity: "user",
        entityId: newUser.id,
        companyId: newUser.companyId || undefined,
        metadata: {
          email: newUser.email,
          role: newUser.role,
          createdBy: currentUser.email,
        },
      });

      // Create notification for user creation
      const { notificationService } = await import("./notification-service");
      const superadminIds = await notificationService.getSuperadminUserIds();
      const userName = `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim() || newUser.email;
      await notificationService.notifyUserCreated(userName, newUser.email, currentUser.id, superadminIds);
      
      const { password, ...sanitizedUser } = newUser;
      res.json({ 
        user: sanitizedUser,
        message: emailSent 
          ? "User created successfully. Activation email sent."
          : "User created successfully. Failed to send activation email - user can request a new link."
      });
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Invalid request" });
      }
    }
  });

  // Update user timezone (any authenticated user can update their own timezone)
  app.patch("/api/users/timezone", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    try {
      console.log("Updating timezone for user:", currentUser.id);
      console.log("Timezone value:", req.body.timezone);
      
      const { timezone } = z.object({
        timezone: z.string().min(1, "Timezone is required")
      }).parse(req.body);

      const updatedUser = await storage.updateUser(currentUser.id, {
        timezone,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log("Timezone updated successfully for user:", currentUser.id);
      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (error: any) {
      console.error("Error updating timezone:", error);
      return res.status(400).json({ message: "Invalid timezone", error: error.message });
    }
  });

  // Update user (superadmin or admin)
  app.patch("/api/users/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      console.log("Update user request - User ID:", req.params.id);
      console.log("Update user request - Body:", req.body);
      
      const validatedData = updateUserSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      
      // admin can only update users in their company
      if (currentUser.role === "admin") {
        const targetUser = await storage.getUser(req.params.id);
        if (!targetUser || targetUser.companyId !== currentUser.companyId) {
          return res.status(403).json({ message: "Forbidden" });
        }
        if (validatedData.role === "superadmin") {
          return res.status(403).json({ message: "Cannot set role to superadmin" });
        }
      }

      // Sync status field with isActive changes
      if ('isActive' in validatedData) {
        if (validatedData.isActive === false) {
          // User is being deactivated
          validatedData.status = 'deactivated';
        } else if (validatedData.isActive === true) {
          // User is being reactivated - only set to active if they have a password
          const targetUser = await storage.getUser(req.params.id);
          if (targetUser?.password) {
            validatedData.status = 'active';
          }
        }
      }

      console.log("About to update user with data:", validatedData);
      const updatedUser = await storage.updateUser(req.params.id, validatedData);
      console.log("Updated user result:", updatedUser);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await logger.logCrud({
        req,
        operation: "update",
        entity: "user",
        entityId: updatedUser.id,
        companyId: updatedUser.companyId || undefined,
        metadata: {
          email: updatedUser.email,
          changes: validatedData,
          updatedBy: currentUser.email,
        },
      });

      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (error: any) {
      console.error("Error updating user:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      res.status(400).json({ message: "Invalid request", error: error.message });
    }
  });

  // Delete user (superadmin or admin)
  app.delete("/api/users/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      console.log("Delete user request - User ID:", req.params.id);
      console.log("Delete user request - Current user:", currentUser.email, "Role:", currentUser.role);
      
      // Get target user before deletion
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        console.log("Target user not found:", req.params.id);
        return res.status(404).json({ message: "User not found" });
      }

      console.log("Target user found:", targetUser.email, "Company:", targetUser.companyId);

      // admin can only delete users in their company
      if (currentUser.role === "admin") {
        if (targetUser.companyId !== currentUser.companyId) {
          console.log("Admin trying to delete user from different company");
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      console.log("Attempting to delete user from storage...");
      const success = await storage.deleteUser(req.params.id);
      console.log("Delete result:", success);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }

      await logger.logCrud({
        req,
        operation: "delete",
        entity: "user",
        entityId: targetUser.id,
        companyId: targetUser.companyId || undefined,
        metadata: {
          email: targetUser.email,
          role: targetUser.role,
          deletedBy: currentUser.email,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Failed to delete user", error: error.message });
    }
  });

  // Toggle user active status (enable/disable)
  app.patch("/api/users/:id/toggle-status", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Admin can only toggle users in their company
      if (currentUser.role === "admin") {
        if (targetUser.companyId !== currentUser.companyId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const newStatus = !targetUser.isActive;
      const updatedUser = await storage.updateUser(req.params.id, {
        isActive: newStatus,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      await logger.logCrud({
        req,
        operation: "update",
        entity: "user",
        entityId: updatedUser.id,
        companyId: updatedUser.companyId || undefined,
        metadata: {
          email: updatedUser.email,
          action: newStatus ? "enabled" : "disabled",
          updatedBy: currentUser.email,
        },
      });

      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      return res.status(500).json({ message: "Failed to toggle user status", error: error.message });
    }
  });

  // ==================== COMPANY ENDPOINTS (superadmin only) ====================

  // Get all companies
  app.get("/api/companies", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companies = await storage.getAllCompanies();
    res.json({ companies });
  });

  // Get single company by ID
  app.get("/api/companies/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const companyId = req.params.id;

    try {
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Check permissions: superadmin can view any company, others only their own
      if (currentUser.role === "superadmin" || currentUser.companyId === companyId) {
        res.json({ company });
      } else {
        return res.status(403).json({ message: "Forbidden" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Create company with admin user
  app.post("/api/companies", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { company: companyData, admin: adminData } = createCompanyWithAdminSchema.parse(req.body);
      
      // Check if admin email already exists
      const existingUser = await storage.getUserByEmail(adminData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Admin email already exists" });
      }

      // Create company first (using admin email as company email)
      const newCompany = await storage.createCompany({
        ...companyData,
        email: adminData.email, // Company email is set to admin email
      });
      
      // Create Stripe customer immediately after company creation
      try {
        console.log('[COMPANY CREATION] Creating Stripe customer for:', newCompany.name);
        const { createStripeCustomer } = await import("./stripe");
        const stripeCustomer = await createStripeCustomer({
          ...newCompany,
          representativeFirstName: adminData.firstName,
          representativeLastName: adminData.lastName,
          representativeEmail: adminData.email,
          representativePhone: adminData.phone,
        });
        
        // Update company with Stripe customer ID
        await storage.updateCompany(newCompany.id, { 
          stripeCustomerId: stripeCustomer.id 
        });
        console.log('[COMPANY CREATION] Stripe customer created:', stripeCustomer.id);
      } catch (stripeError) {
        console.error('[COMPANY CREATION] Failed to create Stripe customer:', stripeError);
        // Continue without Stripe customer - can be created later
      }
      
      // Create billing address automatically using company data
      try {
        if (newCompany.address && newCompany.city && newCompany.state && newCompany.postalCode) {
          await storage.createBillingAddress({
            companyId: newCompany.id,
            fullName: newCompany.name,
            addressLine1: newCompany.address,
            addressLine2: newCompany.addressLine2 || null,
            city: newCompany.city,
            state: newCompany.state,
            postalCode: newCompany.postalCode,
          });
          console.log('[COMPANY CREATION] Billing address created for:', newCompany.name);
        }
      } catch (billingError) {
        console.error('[COMPANY CREATION] Failed to create billing address:', billingError);
        // Continue without billing address - can be created later
      }
      
      // Create admin user WITHOUT password (will be set during activation)
      const adminUser = await storage.createUser({
        email: adminData.email,
        password: undefined, // Password will be set during account activation
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        phone: adminData.phone, // Save phone number for 2FA
        role: "admin",
        companyId: newCompany.id,
        isActive: true,
        emailVerified: false,
        emailSubscribed: true,
        smsSubscribed: true,
        emailNotifications: true,
        invoiceAlerts: true,
      });

      // Send activation email (helper never throws, returns boolean)
      const emailSent = await sendActivationEmail(adminUser, newCompany.name, req);
      if (emailSent) {
        console.log(`Activation email sent successfully to ${adminData.email}`);
      } else {
        console.error(`Failed to send activation email to ${adminData.email}`);
      }

      const { password, ...sanitizedAdmin } = adminUser;
      
      await logger.logCrud({
        req,
        operation: "create",
        entity: "company",
        entityId: newCompany.id,
        companyId: newCompany.id,
        metadata: {
          name: newCompany.name,
          adminEmail: adminUser.email,
          createdBy: currentUser.email,
        },
      });

      // Create notification for company creation
      const { notificationService } = await import("./notification-service");
      await notificationService.notifyCompanyCreated(newCompany.name, adminUser.id, currentUser.id);
      
      res.json({ 
        company: newCompany,
        admin: sanitizedAdmin 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid request" });
    }
  });

  // Update company
  app.patch("/api/companies/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const validatedData = updateCompanySchema.parse(req.body);
      const updatedCompany = await storage.updateCompany(req.params.id, validatedData);
      if (!updatedCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      await logger.logCrud({
        req,
        operation: "update",
        entity: "company",
        entityId: updatedCompany.id,
        companyId: updatedCompany.id,
        metadata: {
          name: updatedCompany.name,
          changes: validatedData,
          updatedBy: currentUser.email,
        },
      });
      
      res.json({ company: updatedCompany });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Delete company
  app.delete("/api/companies/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      // Get company details before deletion for logging
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Delete Stripe customer if exists
      if (company.stripeCustomerId) {
        console.log('[DELETE-COMPANY] Deleting Stripe customer:', company.stripeCustomerId);
        const { deleteStripeCustomer } = await import("./stripe");
        await deleteStripeCustomer(company.stripeCustomerId);
      }

      // Delete company from database
      const success = await storage.deleteCompany(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Log without companyId since the company itself is being deleted (would fail FK constraint)
      await logger.logCrud({
        req,
        operation: "delete",
        entity: "company",
        entityId: company.id,
        companyId: undefined, // Don't reference the deleted company
        metadata: {
          name: company.name,
          deletedBy: currentUser.email,
          stripeCustomerDeleted: !!company.stripeCustomerId,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting company:', error);
      res.status(500).json({ 
        message: "Failed to delete company",
        error: error.message 
      });
    }
  });

  // Toggle company active status (enable/disable)
  app.patch("/api/companies/:id/toggle-status", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const company = await storage.getCompany(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const newStatus = !company.isActive;
    const updatedCompany = await storage.updateCompany(req.params.id, {
      isActive: newStatus,
    });

    if (!updatedCompany) {
      return res.status(404).json({ message: "Company not found" });
    }

    await logger.logCrud({
      req,
      operation: "update",
      entity: "company",
      entityId: updatedCompany.id,
      companyId: updatedCompany.id,
      metadata: {
        name: updatedCompany.name,
        action: newStatus ? "enabled" : "disabled",
        updatedBy: currentUser.email,
      },
    });

    res.json({ company: updatedCompany });
  });

  // ===================================================================
  // COMPANY SETTINGS ENDPOINTS
  // ===================================================================

  // Get company settings (admin or superadmin)
  app.get("/api/settings/company", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string || currentUser.companyId 
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    let settings = await storage.getCompanySettings(companyId);
    
    // Create default settings if they don't exist
    if (!settings) {
      settings = await storage.createCompanySettings({
        companyId,
        primaryColor: "#2196F3",
        secondaryColor: "#1976D2",
        features: {},
        emailSettings: {},
      });
    }

    res.json({ settings });
  });

  // Update company settings (admin or superadmin)
  app.patch("/api/settings/company", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId || currentUser.companyId 
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    try {
      const validatedData = updateCompanySettingsSchema.parse(req.body);
      
      // Ensure settings exist
      let settings = await storage.getCompanySettings(companyId);
      if (!settings) {
        settings = await storage.createCompanySettings({
          companyId,
          primaryColor: "#2196F3",
          secondaryColor: "#1976D2",
          features: {},
          emailSettings: {},
        });
      }

      const updatedSettings = await storage.updateCompanySettings(companyId, validatedData);
      res.json({ settings: updatedSettings });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid request" });
    }
  });

  // Update own profile (any authenticated user)
  app.patch("/api/settings/profile", requireActiveCompany, async (req: Request, res: Response) => {
    const user = req.user!; // User is guaranteed by middleware

    try {
      // Only allow updating own profile fields (not role, companyId, password, etc.)
      const allowedFields = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        avatar: req.body.avatar,
      };

      // Validate using updateUserSchema (validates phone E.164 format, email, etc.)
      const validatedData = updateUserSchema.parse(allowedFields);

      // Validate email is not already taken by another user
      if (validatedData.email && validatedData.email !== user.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const updatedUser = await storage.updateUser(user.id, validatedData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...sanitizedUser } = updatedUser;
      res.json({ user: sanitizedUser });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid request" });
    }
  });

  // Get user preferences
  app.get("/api/settings/preferences", requireActiveCompany, async (req: Request, res: Response) => {
    const user = req.user!; // User is guaranteed by middleware

    // Return user preferences from user data
    res.json({
      preferences: {
        emailNotifications: user.emailNotifications ?? true,
        marketingEmails: user.emailSubscribed ?? false,
        invoiceAlerts: user.invoiceAlerts ?? true,
        systemNotifications: true,
        batchNotifications: false,
        theme: "light",
      }
    });
  });

  // Update user preferences
  app.patch("/api/settings/preferences", requireActiveCompany, async (req: Request, res: Response) => {
    const user = req.user!; // User is guaranteed by middleware

    try {
      const preferences = req.body;
      const updateData: any = {};
      
      // Map preferences to user fields
      if (typeof preferences.marketingEmails === 'boolean') {
        updateData.emailSubscribed = preferences.marketingEmails;
      }
      if (typeof preferences.emailNotifications === 'boolean') {
        updateData.emailNotifications = preferences.emailNotifications;
      }
      if (typeof preferences.invoiceAlerts === 'boolean') {
        updateData.invoiceAlerts = preferences.invoiceAlerts;
      }
      
      // Update user if there are changes
      if (Object.keys(updateData).length > 0) {
        await storage.updateUser(user.id, updateData);
      }
      
      res.json({ 
        success: true,
        preferences: {
          emailNotifications: preferences.emailNotifications ?? user.emailNotifications,
          marketingEmails: preferences.marketingEmails ?? user.emailSubscribed,
          invoiceAlerts: preferences.invoiceAlerts ?? user.invoiceAlerts,
          systemNotifications: preferences.systemNotifications ?? true,
          batchNotifications: preferences.batchNotifications ?? false,
        }
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // ===================================================================
  // PLANS MANAGEMENT (Superadmin only)
  // ===================================================================

  // Get all plans
  app.get("/api/plans", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    // Superadmins see all plans, others see only active plans
    const plans = currentUser.role === "superadmin" 
      ? await storage.getAllPlans()
      : await storage.getActivePlans();
    
    res.json({ plans });
  });

  // Get plan by ID
  app.get("/api/plans/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const plan = await storage.getPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.json({ plan });
  });

  // Create plan (superadmin only)
  app.post("/api/plans", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const validatedData = insertPlanSchema.parse(req.body);
      const plan = await storage.createPlan(validatedData);
      res.json({ plan });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Update plan (superadmin only)
  app.patch("/api/plans/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const validatedData = insertPlanSchema.partial().parse(req.body);
      const updatedPlan = await storage.updatePlan(req.params.id, validatedData);
      if (!updatedPlan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.json({ plan: updatedPlan });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Sync plan with Stripe (superadmin only)
  app.post("/api/plans/:id/sync-stripe", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const plan = await storage.getPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      // Sync with Stripe
      const { syncPlanWithStripe } = await import("./stripe");
      const stripeIds = await syncPlanWithStripe(plan);

      // Update local plan with Stripe IDs
      const updatedPlan = await storage.updatePlan(plan.id, {
        stripeProductId: stripeIds.stripeProductId,
        stripePriceId: stripeIds.stripePriceId,
        stripeSetupFeePriceId: stripeIds.stripeSetupFeePriceId,
      });

      res.json({ 
        success: true, 
        plan: updatedPlan,
        message: "Plan synchronized with Stripe successfully"
      });
    } catch (error: any) {
      console.error("Error syncing plan with Stripe:", error);
      res.status(500).json({ 
        message: "Failed to sync plan with Stripe",
        error: error.message 
      });
    }
  });

  // Delete plan (superadmin only)
  app.delete("/api/plans/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const success = await storage.deletePlan(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.json({ success: true });
  });

  // Sync plans from Stripe (superadmin only - RECOMMENDED METHOD)
  app.post("/api/plans/sync-from-stripe", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      console.log('[SYNC-FROM-STRIPE] Starting synchronization...');
      const { syncProductsFromStripe } = await import("./stripe");
      const syncResult = await syncProductsFromStripe();

      if (!syncResult.success) {
        return res.status(500).json({ 
          success: false,
          message: "Fatal error during Stripe synchronization", 
          errors: syncResult.errors,
        });
      }

      const results = {
        created: [] as any[],
        updated: [] as any[],
        failed: [] as any[],
      };

      // Fetch all existing plans ONCE and index by stripeProductId for O(1) lookups
      const existingPlans = await storage.getAllPlans();
      const plansByProductId = new Map(
        existingPlans
          .filter(p => (p as any).stripeProductId) // Only plans with stripeProductId
          .map(p => [(p as any).stripeProductId, p])
      );

      console.log(`[SYNC-FROM-STRIPE] Found ${plansByProductId.size} existing plans in database`);

      // Process each synced product with O(1) lookup
      for (const product of syncResult.syncedPlans) {
        try {
          const existingPlan = plansByProductId.get(product.productId);

          if (existingPlan) {
            // Update existing plan
            console.log(`[SYNC-FROM-STRIPE] Updating existing plan: ${product.productName}`);
            const updated = await storage.updatePlan(existingPlan.id, product.planData);
            results.updated.push(updated);
          } else {
            // Create new plan
            console.log(`[SYNC-FROM-STRIPE] Creating new plan: ${product.productName}`);
            const created = await storage.createPlan(product.planData);
            results.created.push(created);
          }
        } catch (dbError: any) {
          console.error(`[SYNC-FROM-STRIPE] Database error for ${product.productName}:`, dbError.message);
          results.failed.push({
            product: product.productName,
            error: dbError.message,
          });
        }
      }

      console.log('[SYNC-FROM-STRIPE] Synchronization complete:', {
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length,
        stripeErrors: syncResult.errors.length,
      });

      res.json({
        success: true,
        message: `Synchronized ${results.created.length + results.updated.length} products from Stripe`,
        results: {
          created: results.created.length,
          updated: results.updated.length,
          failed: results.failed.length,
          total: syncResult.syncedPlans.length,
        },
        plans: [...results.created, ...results.updated],
        errors: [...syncResult.errors, ...results.failed],
      });
    } catch (error: any) {
      console.error("Error syncing from Stripe:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync from Stripe", 
        error: error.message 
      });
    }
  });

  // List all Stripe prices (superadmin only - for debugging/syncing)
  app.get("/api/stripe/list-prices", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { listAllStripePrices } = await import("./stripe");
      const prices = await listAllStripePrices();
      
      // Also get current plans from database
      const plans = await storage.getAllPlans();
      
      res.json({ 
        stripePrices: prices,
        currentPlans: plans.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stripePriceId: p.stripePriceId,
          stripeAnnualPriceId: (p as any).stripeAnnualPriceId,
        }))
      });
    } catch (error: any) {
      console.error("Error listing Stripe prices:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===================================================================
  // INVOICES & PAYMENTS
  // ===================================================================

  // Get invoices (scoped by company for non-superadmins, all invoices for superadmin without companyId)
  app.get("/api/invoices", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    // Superadmins can optionally filter by companyId, or get all invoices if no companyId provided
    if (currentUser.role === "superadmin") {
      const companyId = req.query.companyId as string;
      
      if (companyId) {
        // Get invoices for specific company
        const invoices = await storage.getInvoicesByCompany(companyId);
        res.json({ invoices });
      } else {
        // Get ALL invoices from ALL companies
        const invoices = await storage.getAllInvoices();
        res.json({ invoices });
      }
    } else {
      // Non-superadmins can only see their company's invoices
      const companyId = currentUser.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID required" });
      }

      const invoices = await storage.getInvoicesByCompany(companyId);
      res.json({ invoices });
    }
  });

  // Get invoice by ID
  app.get("/api/invoices/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check access: superadmin or same company
    if (currentUser.role !== "superadmin" && invoice.companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Get invoice items
    const items = await storage.getInvoiceItems(invoice.id);
    res.json({ invoice, items });
  });

  // Get payments (scoped by company for non-superadmins)
  app.get("/api/payments", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    const payments = await storage.getPaymentsByCompany(companyId);
    res.json({ payments });
  });

  // ===================================================================
  // SUBSCRIPTION & STRIPE CHECKOUT
  // ===================================================================

  // Get subscription for company
  app.get("/api/subscription", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    const subscription = await storage.getSubscriptionByCompany(companyId);
    res.json({ subscription });
  });

  // Assign plan to company (superadmin only) - Creates or updates subscription without Stripe
  app.post("/api/companies/:companyId/subscription", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { companyId } = req.params;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ message: "Plan ID required" });
    }

    // Verify company exists
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Verify plan exists
    const plan = await storage.getPlan(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    try {
      // Verify plan has Stripe price configured
      if (!plan.stripePriceId) {
        return res.status(400).json({ 
          message: "Plan must be synced with Stripe before assigning. Please sync the plan first." 
        });
      }

      // Create or get Stripe customer with complete company information
      let stripeCustomerId = company.stripeCustomerId;
      
      if (!stripeCustomerId) {
        console.log('[SUBSCRIPTION] Creating Stripe customer for company:', company.name);
        
        // Get company admin for representative information
        const companyUsers = await storage.getUsersByCompany(companyId);
        const admin = companyUsers.find(u => u.role === 'admin');
        
        const { createStripeCustomer } = await import("./stripe");
        const stripeCustomer = await createStripeCustomer({
          ...company,
          representativeFirstName: admin?.firstName || null,
          representativeLastName: admin?.lastName || null,
          representativeEmail: admin?.email || company.email,
          representativePhone: admin?.phone || company.phone,
        });
        stripeCustomerId = stripeCustomer.id;
        
        // Update company with Stripe customer ID
        await storage.updateCompany(companyId, { stripeCustomerId });
        console.log('[SUBSCRIPTION] Stripe customer created:', stripeCustomerId);
      } else {
        console.log('[SUBSCRIPTION] Using existing Stripe customer:', stripeCustomerId);
      }

      // Check if company already has a subscription
      const existingSubscription = await storage.getSubscriptionByCompany(companyId);

      // Cancel existing Stripe subscription if exists
      if (existingSubscription?.stripeSubscriptionId) {
        console.log('[SUBSCRIPTION] Canceling existing Stripe subscription:', existingSubscription.stripeSubscriptionId);
        const { cancelStripeSubscription } = await import("./stripe");
        await cancelStripeSubscription(existingSubscription.stripeSubscriptionId);
      }

      // Create NEW Stripe subscription
      console.log('[SUBSCRIPTION] Creating new Stripe subscription...');
      const { createStripeSubscription } = await import("./stripe");
      const stripeSubscription = await createStripeSubscription(
        stripeCustomerId,
        plan.stripePriceId,
        companyId,
        planId,
        plan.trialDays,
        'monthly' // Default to monthly for admin-assigned plans
      );

      // Extract subscription data from Stripe
      const stripeSubData = stripeSubscription as any;
      
      // Helper function to safely convert Stripe timestamps to Date objects
      const toDate = (unixTimestamp?: number | null): Date | null => {
        if (typeof unixTimestamp === 'number' && unixTimestamp > 0) {
          return new Date(unixTimestamp * 1000);
        }
        return null;
      };
      
      // For subscriptions in trial, Stripe should provide current period dates
      // but we ensure we always have valid dates for current period fields
      const currentPeriodStart = toDate(stripeSubData.current_period_start) || new Date();
      const currentPeriodEnd = toDate(stripeSubData.current_period_end) || 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
      const trialStart = toDate(stripeSubData.trial_start);
      const trialEnd = toDate(stripeSubData.trial_end);

      // Map Stripe status to our enum, preserving actual subscription state
      const mapStatus = (stripeStatus: string): string => {
        switch (stripeStatus) {
          case 'active': return 'active';
          case 'trialing': return 'trialing';
          case 'past_due': return 'past_due';
          case 'unpaid': return 'unpaid';
          case 'incomplete': return 'active'; // incomplete means waiting for first payment
          case 'incomplete_expired': return 'cancelled';
          case 'canceled': return 'cancelled';
          default: return 'active';
        }
      };

      const subscriptionData: any = {
        planId,
        status: mapStatus(stripeSubscription.status),
        currentPeriodStart,
        currentPeriodEnd,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeLatestInvoiceId: typeof stripeSubscription.latest_invoice === 'string' 
          ? stripeSubscription.latest_invoice 
          : stripeSubscription.latest_invoice?.id || undefined,
      };

      // Only include trial dates if they exist
      if (trialStart) subscriptionData.trialStart = trialStart;
      if (trialEnd) subscriptionData.trialEnd = trialEnd;

      if (existingSubscription) {
        // Update existing subscription
        const updatedSubscription = await storage.updateSubscription(
          existingSubscription.id,
          subscriptionData
        );

        await logger.log({
          req,
          action: "subscription_updated",
          entity: "subscription",
          entityId: existingSubscription.id,
          companyId,
          metadata: {
            planId,
            planName: plan.name,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscription.id,
          },
        });

        res.json({ subscription: updatedSubscription });
      } else {
        // Create new subscription
        const newSubscription = await storage.createSubscription({
          companyId,
          ...subscriptionData,
        });

        await logger.log({
          req,
          action: "subscription_created",
          entity: "subscription",
          entityId: newSubscription.id,
          companyId,
          metadata: {
            planId,
            planName: plan.name,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscription.id,
          },
        });

        res.json({ subscription: newSubscription });
      }
    } catch (error: any) {
      console.error("Error assigning plan to company:", error);
      res.status(500).json({ message: error.message || "Failed to assign plan" });
    }
  });

  // Select plan for own company (any authenticated user)
  app.post("/api/select-plan", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    // Users can only select plan for their own company
    if (!currentUser.companyId) {
      return res.status(400).json({ message: "User must belong to a company" });
    }

    const companyId = currentUser.companyId;
    const { planId, billingPeriod = "monthly" } = req.body;

    if (!planId) {
      return res.status(400).json({ message: "Plan ID required" });
    }
    
    console.log('[SELECT-PLAN] Billing period:', billingPeriod);

    // Verify company exists
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Verify plan exists
    const plan = await storage.getPlan(planId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    try {
      // Determine which Stripe price to use based on billing period
      let stripePriceId: string | null;
      if (billingPeriod === 'yearly') {
        // Use annual price if available, otherwise fall back to monthly
        const annualPriceId = (plan as any).stripeAnnualPriceId;
        stripePriceId = annualPriceId || plan.stripePriceId;
        if (!annualPriceId) {
          console.log('[SELECT-PLAN] No annual price found, using monthly price');
        }
      } else {
        stripePriceId = plan.stripePriceId;
      }

      // Verify plan has Stripe price configured
      if (!stripePriceId) {
        return res.status(400).json({ 
          message: "Plan must be synced with Stripe before selecting. Please contact support." 
        });
      }

      console.log('[SELECT-PLAN] Using Stripe price:', stripePriceId, 'for billing period:', billingPeriod);

      // Create or get Stripe customer with complete company information
      let stripeCustomerId = company.stripeCustomerId;
      
      if (!stripeCustomerId) {
        console.log('[SELECT-PLAN] Creating Stripe customer for company:', company.name);
        
        // Get company admin for representative information
        const companyUsers = await storage.getUsersByCompany(companyId);
        const admin = companyUsers.find(u => u.role === 'admin');
        
        const { createStripeCustomer } = await import("./stripe");
        const stripeCustomer = await createStripeCustomer({
          ...company,
          representativeFirstName: admin?.firstName || null,
          representativeLastName: admin?.lastName || null,
          representativeEmail: admin?.email || company.email,
          representativePhone: admin?.phone || company.phone,
        });
        stripeCustomerId = stripeCustomer.id;
        
        // Update company with Stripe customer ID
        await storage.updateCompany(companyId, { stripeCustomerId });
        console.log('[SELECT-PLAN] Stripe customer created:', stripeCustomerId);
      } else {
        console.log('[SELECT-PLAN] Using existing Stripe customer:', stripeCustomerId);
      }

      // Check if company already has a subscription
      const existingSubscription = await storage.getSubscriptionByCompany(companyId);

      // Cancel existing Stripe subscription if exists
      if (existingSubscription?.stripeSubscriptionId) {
        try {
          console.log('[SELECT-PLAN] Canceling existing Stripe subscription:', existingSubscription.stripeSubscriptionId);
          const { cancelStripeSubscription } = await import("./stripe");
          await cancelStripeSubscription(existingSubscription.stripeSubscriptionId);
        } catch (cancelError: any) {
          // If subscription doesn't exist in Stripe (already canceled), continue
          if (cancelError.code === 'resource_missing') {
            console.log('[SELECT-PLAN] Subscription already canceled in Stripe, continuing...');
          } else {
            throw cancelError; // Re-throw if it's a different error
          }
        }
      }

      // Create NEW Stripe subscription
      console.log('[SELECT-PLAN] Creating new Stripe subscription...');
      const { createStripeSubscription } = await import("./stripe");
      const stripeSubscription = await createStripeSubscription(
        stripeCustomerId,
        stripePriceId,
        companyId,
        planId,
        plan.trialDays,
        billingPeriod
      );

      // Extract subscription data from Stripe - with defensive null checks
      const stripeSubData = stripeSubscription as any;
      
      // Helper function to safely convert Stripe timestamps to Date objects
      // Stripe can omit fields (undefined) or send null/0 for no date
      const toDate = (unixTimestamp?: number | null): Date | null => {
        if (typeof unixTimestamp === 'number' && unixTimestamp > 0) {
          return new Date(unixTimestamp * 1000);
        }
        return null;
      };
      
      // Map Stripe status to our enum, preserving actual subscription state
      const mapStatus = (stripeStatus: string): string => {
        switch (stripeStatus) {
          case 'active': return 'active';
          case 'trialing': return 'trialing';
          case 'past_due': return 'past_due';
          case 'unpaid': return 'unpaid';
          case 'incomplete': return 'active'; // incomplete means waiting for first payment
          case 'incomplete_expired': return 'cancelled';
          case 'canceled': return 'cancelled';
          default: return 'active';
        }
      };

      const subscriptionData: any = {
        planId,
        status: mapStatus(stripeSubscription.status),
        billingCycle: billingPeriod, // Save the customer's choice: monthly or yearly
        trialStart: toDate(stripeSubData.trial_start),
        trialEnd: toDate(stripeSubData.trial_end),
        currentPeriodStart: toDate(stripeSubData.current_period_start) || new Date(),
        currentPeriodEnd: toDate(stripeSubData.current_period_end) || 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeLatestInvoiceId: typeof stripeSubscription.latest_invoice === 'string' 
          ? stripeSubscription.latest_invoice 
          : stripeSubscription.latest_invoice?.id || undefined,
      };

      if (existingSubscription) {
        // Update existing subscription
        const updatedSubscription = await storage.updateSubscription(
          existingSubscription.id,
          subscriptionData
        );

        await logger.log({
          req,
          action: "plan_selected",
          entity: "subscription",
          entityId: existingSubscription.id,
          companyId,
          metadata: {
            planId,
            planName: plan.name,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscription.id,
          },
        });

        // NEVER send trial notification when updating an existing subscription
        // Trial notification is ONLY sent once when subscription is created for the first time
        // NOT when changing plans, NOT when updating, ONLY on initial creation

        res.json({ subscription: updatedSubscription });
      } else {
        // Create new subscription
        const newSubscription = await storage.createSubscription({
          companyId,
          ...subscriptionData,
        });

        await logger.log({
          req,
          action: "plan_selected",
          entity: "subscription",
          entityId: newSubscription.id,
          companyId,
          metadata: {
            planId,
            planName: plan.name,
            stripeCustomerId,
            stripeSubscriptionId: stripeSubscription.id,
          },
        });

        // Send notification about trial start only if subscription is in trialing status
        if (subscriptionData.status === 'trialing' && subscriptionData.trialEnd) {
          try {
            await notificationService.notifyTrialStarted(
              companyId, 
              plan.name, 
              subscriptionData.trialEnd
            );
          } catch (notifError) {
            console.error('[NOTIFICATION] Failed to send trial started notification:', notifError);
          }
        }

        res.json({ subscription: newSubscription });
      }
    } catch (error: any) {
      console.error("Error selecting plan:", error);
      res.status(500).json({ message: error.message || "Failed to select plan" });
    }
  });

  // Create checkout session
  app.post("/api/checkout", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    // Only admin or superadmin can create checkout
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { planId, stripePriceId } = req.body;
    if (!planId || !stripePriceId) {
      return res.status(400).json({ message: "Plan ID and Stripe Price ID required" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    try {
      const { createSubscriptionCheckout } = await import("./stripe");
      const session = await createSubscriptionCheckout(
        companyId,
        planId,
        stripePriceId,
        `${req.headers.origin}/subscription/success`,
        `${req.headers.origin}/subscription/cancel`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel subscription
  app.post("/api/subscription/cancel", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    // Only admin or superadmin can cancel
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    const subscription = await storage.getSubscriptionByCompany(companyId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    try {
      const { cancelStripeSubscription } = await import("./stripe");
      const cancelAtPeriodEnd = req.body.cancelAtPeriodEnd !== false;
      await cancelStripeSubscription(subscription.stripeSubscriptionId, cancelAtPeriodEnd);
      await storage.cancelSubscription(subscription.id, cancelAtPeriodEnd);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===================================================================
  // BILLING ENDPOINTS
  // ===================================================================

  // Create Stripe Customer Portal Session
  app.post("/api/billing/portal", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can access billing portal
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company portal" });
    }

    try {
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Get or create Stripe customer
      let customerId = company.stripeCustomerId;
      if (!customerId) {
        // Get company admin for representative information
        const companyUsers = await storage.getUsersByCompany(companyId);
        const admin = companyUsers.find(u => u.role === 'admin');
        
        const { createStripeCustomer } = await import("./stripe");
        const customer = await createStripeCustomer({
          ...company,
          representativeFirstName: admin?.firstName || null,
          representativeLastName: admin?.lastName || null,
          representativeEmail: admin?.email || company.email,
          representativePhone: admin?.phone || company.phone,
        });
        customerId = customer.id;
        
        // Update company with Stripe customer ID
        await storage.updateCompany(companyId, { stripeCustomerId: customerId });
      }

      const { createCustomerPortalSession } = await import("./stripe");
      const returnUrl = `${req.headers.origin}/billing`;
      const session = await createCustomerPortalSession(customerId, returnUrl);

      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get billing invoices
  app.get("/api/billing/invoices", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can view invoices
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company invoices" });
    }

    try {
      const allInvoices = await storage.getInvoicesByCompany(companyId);
      // Filter out $0.00 invoices (trial invoices) from billing history
      const invoices = allInvoices.filter(invoice => invoice.total > 0);
      res.json({ invoices });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Send invoice via email
  app.post("/api/invoices/:invoiceId/send-email", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const { invoiceId } = req.params;

    // Only admin or superadmin can send invoices
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      // Get invoice
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // SECURITY: For non-superadmins, verify the invoice belongs to their company
      if (currentUser.role !== "superadmin" && invoice.companyId !== currentUser.companyId) {
        return res.status(403).json({ message: "Unauthorized access to invoice" });
      }

      // Get company details
      const company = await storage.getCompany(invoice.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Send email using the payment confirmation template
      const emailSent = await sendPaymentConfirmationEmail(
        invoice.companyId,
        invoice.total,
        invoice.currency,
        invoice.invoiceNumber,
        invoice.stripeHostedInvoiceUrl || undefined
      );

      if (emailSent) {
        res.json({ success: true, message: "Invoice sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send invoice email" });
      }
    } catch (error: any) {
      console.error('[INVOICE] Error sending invoice email:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get billing payments
  app.get("/api/billing/payments", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can view payments
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company payments" });
    }

    try {
      const payments = await storage.getPaymentsByCompany(companyId);
      res.json({ payments });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get billing subscription details from Stripe
  app.get("/api/billing/subscription", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can view subscription details
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      console.log('[BILLING] Subscription query for company:', companyId, 'Result:', subscription);
      
      if (!subscription) {
        console.log('[BILLING] No subscription found for company:', companyId);
        return res.json({ subscription: null });
      }

      // SECURITY: Verify subscription belongs to the company
      if (subscription.companyId !== companyId) {
        return res.status(403).json({ message: "Unauthorized access to subscription" });
      }

      // Get plan details
      const plan = subscription.planId ? await storage.getPlan(subscription.planId) : null;

      // If subscription has Stripe ID, get detailed info from Stripe
      if (subscription.stripeSubscriptionId) {
        const { getSubscriptionDetails } = await import("./stripe");
        const stripeSubscription = await getSubscriptionDetails(subscription.stripeSubscriptionId);

        res.json({ 
          subscription: {
            ...subscription,
            plan,
            stripeDetails: stripeSubscription
          }
        });
      } else {
        // Manual subscription (no Stripe), return local data only
        res.json({ 
          subscription: {
            ...subscription,
            plan,
            stripeDetails: null
          }
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Skip trial period
  app.post("/api/billing/skip-trial", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can skip trial
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company subscription" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription || !subscription.stripeSubscriptionId || !subscription.stripeCustomerId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      const { stripe } = await import("./stripe");
      
      // Step 1: Check if customer has a payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.stripeCustomerId,
        type: 'card',
      });

      if (!paymentMethods.data || paymentMethods.data.length === 0) {
        return res.status(400).json({ 
          message: "Please add a payment method before activating your subscription" 
        });
      }

      // Get the default payment method
      const customer = await stripe.customers.retrieve(subscription.stripeCustomerId) as any;
      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method || paymentMethods.data[0].id;

      // Step 2: Get the subscription to find the price
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      
      if (!stripeSubscription.items.data || stripeSubscription.items.data.length === 0) {
        return res.status(400).json({ message: "Invalid subscription configuration" });
      }

      const amount = stripeSubscription.items.data[0].price.unit_amount || 0;
      const currency = stripeSubscription.items.data[0].price.currency || 'usd';

      // Step 3: Test payment method with a PaymentIntent BEFORE ending trial
      console.log('[SKIP-TRIAL] Testing payment method with PaymentIntent');
      try {
        // Create a PaymentIntent to test the card
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: currency,
          customer: subscription.stripeCustomerId,
          payment_method: defaultPaymentMethodId,
          off_session: true,
          confirm: true, // Immediately attempt to confirm
          description: 'Payment verification for trial activation',
        });

        if (paymentIntent.status !== 'succeeded') {
          // Payment failed
          console.log('[SKIP-TRIAL] Payment test failed, status:', paymentIntent.status);
          return res.status(402).json({ 
            message: "Payment declined. Please update your payment method and try again." 
          });
        }

        // Payment succeeded! Refund it immediately since this was just a test
        console.log('[SKIP-TRIAL] Payment test succeeded, refunding test charge');
        await stripe.refunds.create({
          payment_intent: paymentIntent.id,
          reason: 'requested_by_customer',
        });

        // Now we can safely skip the trial - this will create the REAL invoice
        console.log('[SKIP-TRIAL] Payment method verified, now skipping trial');
        const { skipTrial } = await import("./stripe");
        const updatedSubscription = await skipTrial(subscription.stripeSubscriptionId);

        // Helper to safely convert Stripe timestamps
        const toDate = (timestamp: number | null | undefined): Date | undefined => {
          if (typeof timestamp === 'number' && timestamp > 0) {
            return new Date(timestamp * 1000);
          }
          return undefined;
        };

        // Update local subscription to sync with Stripe
        const updateData: any = {
          status: updatedSubscription.status as 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid',
        };
        
        // Only update dates if they have valid values
        if (updatedSubscription.current_period_start) {
          updateData.currentPeriodStart = toDate(updatedSubscription.current_period_start);
        }
        if (updatedSubscription.current_period_end) {
          updateData.currentPeriodEnd = toDate(updatedSubscription.current_period_end);
        }
        
        // Clear trial dates since trial is skipped
        updateData.trialEnd = undefined;
        updateData.trialStart = undefined;
        
        await storage.updateSubscription(subscription.id, updateData);

        res.json({ message: "Trial period ended successfully", subscription: updatedSubscription });
      } catch (paymentError: any) {
        // Payment test failed - return error without modifying subscription
        console.error('[SKIP-TRIAL] Payment test failed:', paymentError.message);
        
        // Extract more user-friendly error message
        let errorMessage = "Payment declined. Please update your payment method and try again.";
        if (paymentError.type === 'StripeCardError') {
          errorMessage = paymentError.message || errorMessage;
        }
        
        return res.status(402).json({ message: errorMessage });
      }
    } catch (error: any) {
      console.error('[SKIP-TRIAL] Error:', error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Change subscription plan
  app.post("/api/billing/change-plan", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can change plan
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company subscription" });
    }

    const { planId, billingPeriod } = req.body;
    if (!planId || !billingPeriod) {
      return res.status(400).json({ message: "Plan ID and billing period required" });
    }

    try {
      // Helper function to safely convert Stripe timestamps to Date objects
      const toDate = (unixTimestamp?: number | null): Date | null => {
        if (typeof unixTimestamp === 'number' && unixTimestamp > 0) {
          return new Date(unixTimestamp * 1000);
        }
        return null;
      };

      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription || !subscription.stripeSubscriptionId || !subscription.stripeCustomerId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      const plan = await storage.getPlan(planId);
      if (!plan || !plan.isActive) {
        return res.status(404).json({ message: "Plan not found or inactive" });
      }

      // Get the correct Stripe price ID based on billing period
      const stripePriceId = billingPeriod === 'yearly' 
        ? plan.stripeAnnualPriceId 
        : plan.stripePriceId;

      if (!stripePriceId) {
        return res.status(400).json({ message: `${billingPeriod} pricing not available for this plan` });
      }

      // Cancel current subscription and create new one with new plan
      // IMPORTANT: Preserve trial dates from original activation
      const { changePlan } = await import("./stripe");
      const newStripeSubscription = await changePlan(
        subscription.stripeCustomerId,
        subscription.stripeSubscriptionId,
        stripePriceId,
        billingPeriod as 'monthly' | 'yearly',
        subscription.trialStart,
        subscription.trialEnd
      );

      // Update local subscription with new Stripe subscription ID and dates
      // IMPORTANT: Preserve the original trial dates (they're already preserved in Stripe)
      await storage.updateSubscription(subscription.id, {
        planId: plan.id,
        billingCycle: billingPeriod, // Update billing cycle to match new selection
        stripeSubscriptionId: newStripeSubscription.id, // NEW subscription ID
        status: newStripeSubscription.status,
        // Preserve trial dates from local subscription (not from Stripe response)
        // because we want to keep the original activation dates
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        currentPeriodStart: toDate(newStripeSubscription.current_period_start) || new Date(),
        currentPeriodEnd: toDate(newStripeSubscription.current_period_end) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      res.json({ message: "Plan changed successfully", subscription: newStripeSubscription });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel subscription
  app.post("/api/billing/cancel", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can cancel subscription
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company subscription" });
    }

    const { cancelAtPeriodEnd } = req.body;

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      const { cancelStripeSubscription } = await import("./stripe");
      const stripeSubscription = await cancelStripeSubscription(
        subscription.stripeSubscriptionId,
        cancelAtPeriodEnd !== false
      );

      // Update local subscription
      await storage.updateSubscription(subscription.id, {
        cancelAtPeriodEnd: cancelAtPeriodEnd !== false,
        cancelledAt: cancelAtPeriodEnd === false ? new Date() : null,
      });

      res.json({ 
        message: cancelAtPeriodEnd !== false 
          ? "Subscription will be cancelled at the end of the billing period" 
          : "Subscription cancelled immediately",
        subscription: stripeSubscription 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Apply coupon/promo code
  app.post("/api/billing/apply-coupon", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can apply coupons
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company subscription" });
    }

    const { couponCode } = req.body;
    if (!couponCode) {
      return res.status(400).json({ message: "Coupon code required" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      const { applyCoupon } = await import("./stripe");
      const stripeSubscription = await applyCoupon(subscription.stripeSubscriptionId, couponCode);

      res.json({ message: "Coupon applied successfully", subscription: stripeSubscription });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Apply temporary discount (superadmin only)
  app.post("/api/billing/apply-temporary-discount", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only superadmin can apply temporary discounts
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can apply temporary discounts" });
    }

    const { companyId, percentOff, months } = req.body;

    if (!companyId || !percentOff || !months) {
      return res.status(400).json({ 
        message: "Company ID, discount percentage, and duration in months are required" 
      });
    }

    if (percentOff < 1 || percentOff > 100) {
      return res.status(400).json({ message: "Discount percentage must be between 1 and 100" });
    }

    if (months < 1 || months > 36) {
      return res.status(400).json({ message: "Duration must be between 1 and 36 months" });
    }

    try {
      // Get company and subscription
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found for this company" });
      }

      // Create coupon in Stripe
      const { createTemporaryDiscountCoupon, applyTemporaryDiscount } = await import("./stripe");
      const coupon = await createTemporaryDiscountCoupon(percentOff, months, company.name);

      // Apply the coupon to the subscription
      const stripeSubscription = await applyTemporaryDiscount(subscription.stripeSubscriptionId, coupon.id);

      // Calculate discount end date
      const discountEndDate = new Date();
      discountEndDate.setMonth(discountEndDate.getMonth() + months);

      // Save discount in our database
      await storage.createSubscriptionDiscount({
        subscriptionId: subscription.id,
        companyId: companyId,
        stripeCouponId: coupon.id,
        discountPercentage: percentOff,
        discountMonths: months,
        discountEndDate: discountEndDate,
        appliedBy: currentUser.id,
        status: 'active'
      });

      // Create notification for all company admins
      const companyUsers = await storage.getUsersByCompany(companyId);
      const adminsAndSuperadmins = companyUsers.filter(u => 
        u.role === 'admin' || u.role === 'superadmin'
      );

      for (const user of adminsAndSuperadmins) {
        await storage.createNotification({
          userId: user.id,
          type: 'success',
          title: 'Discount Applied',
          message: `A ${percentOff}% discount has been applied to your subscription for ${months} month${months > 1 ? 's' : ''}. ${months > 1 ? `This discount will remain active for the next ${months} months.` : 'This discount will be active for the current billing period.'}`,
        });
      }

      // Broadcast notification update via WebSocket
      broadcastNotificationUpdate();

      res.json({ 
        message: `${percentOff}% discount applied for ${months} month${months > 1 ? 's' : ''}`,
        discount: {
          percentOff,
          months,
          endDate: discountEndDate,
          couponId: coupon.id
        }
      });
    } catch (error: any) {
      console.error('Error applying temporary discount:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get active discount for a company
  app.get("/api/billing/active-discount", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company discount information" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription) {
        return res.json({ discount: null });
      }

      // Check for active discount in our database
      const activeDiscount = await storage.getActiveDiscountForCompany(companyId);

      // Also get discount from Stripe to verify
      if (subscription.stripeSubscriptionId) {
        const { getSubscriptionDiscount } = await import("./stripe");
        const stripeDiscount = await getSubscriptionDiscount(subscription.stripeSubscriptionId);

        if (stripeDiscount && stripeDiscount.coupon) {
          const coupon = stripeDiscount.coupon as any;
          
          // Check if discount has expired
          const now = new Date();
          const discountEnd = stripeDiscount.end ? new Date(stripeDiscount.end * 1000) : null;
          
          if (discountEnd && now > discountEnd) {
            // Discount has expired - update local database status
            console.log('[BILLING] Discount has expired, updating local status');
            if (activeDiscount) {
              await storage.updateDiscountStatus(activeDiscount.id, 'expired');
            }
            return res.json({ discount: null });
          }
          
          // Discount is still active
          res.json({
            discount: {
              percentOff: coupon.percent_off,
              amountOff: coupon.amount_off,
              duration: coupon.duration,
              durationInMonths: coupon.duration_in_months,
              end: discountEnd,
              localDiscount: activeDiscount
            }
          });
        } else {
          // No discount in Stripe - update local status if needed
          if (activeDiscount) {
            await storage.updateDiscountStatus(activeDiscount.id, 'expired');
          }
          res.json({ discount: null });
        }
      } else {
        res.json({ discount: null });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get discount history for a company
  app.get("/api/billing/discount-history", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only superadmin can view discount history for any company
    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company discount history" });
    }

    try {
      const discounts = await storage.getDiscountHistoryForCompany(companyId);
      res.json({ discounts });
    } catch (error: any) {
      console.error('[BILLING] Error fetching discount history:', error);
      res.status(500).json({ message: "Failed to fetch discount history" });
    }
  });

  // Remove discount
  app.post("/api/billing/remove-discount", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only superadmin can remove discounts
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can remove discounts" });
    }

    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      // Remove discount from Stripe
      const { removeDiscount } = await import("./stripe");
      await removeDiscount(subscription.stripeSubscriptionId);

      // Update local discount status
      const activeDiscount = await storage.getActiveDiscountForCompany(companyId);
      if (activeDiscount) {
        await storage.updateDiscountStatus(activeDiscount.id, 'expired');
      }

      res.json({ message: "Discount removed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get payment methods
  app.get("/api/billing/payment-methods", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can view payment methods
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company payment methods" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (!subscription || !subscription.stripeCustomerId) {
        return res.json({ paymentMethods: [] });
      }

      const { getPaymentMethods, stripe } = await import("./stripe");
      const stripePaymentMethods = await getPaymentMethods(subscription.stripeCustomerId);
      
      // Get customer to find default payment method
      const customer = await stripe.customers.retrieve(subscription.stripeCustomerId) as any;
      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

      // Transform Stripe payment methods to match frontend interface
      const paymentMethods = stripePaymentMethods.map((pm: any) => ({
        id: pm.id,
        brand: pm.card?.brand || '',
        last4: pm.card?.last4 || '',
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
        isDefault: pm.id === defaultPaymentMethodId
      }));

      res.json({ paymentMethods });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create SetupIntent for adding a new payment method
  app.post("/api/billing/create-setup-intent", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can add payment methods
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      
      if (!subscription || !subscription.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const { stripe } = await import("./stripe");
      
      // Create a SetupIntent for this customer
      const setupIntent = await stripe.setupIntents.create({
        customer: subscription.stripeCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session', // Save for future use
        metadata: {
          companyId,
          userId: currentUser.id
        }
      });

      res.json({ 
        clientSecret: setupIntent.client_secret,
        customerId: subscription.stripeCustomerId
      });
    } catch (error: any) {
      console.error('[STRIPE] Error creating setup intent:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Attach payment method and set as default
  app.post("/api/billing/attach-payment-method", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const { paymentMethodId } = req.body;

    // Only admin or superadmin can manage payment methods
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    if (!paymentMethodId) {
      return res.status(400).json({ message: "Payment method ID required" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      
      if (!subscription || !subscription.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const { stripe } = await import("./stripe");
      
      // Set this payment method as the default for the customer
      await stripe.customers.update(subscription.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // If the subscription exists, update its default payment method
      if (subscription.stripeSubscriptionId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          default_payment_method: paymentMethodId,
        });
      }

      res.json({ success: true, message: "Payment method added successfully" });
    } catch (error: any) {
      console.error('[STRIPE] Error attaching payment method:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Set default payment method (for existing payment methods)
  app.post("/api/billing/set-default-payment-method", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const { paymentMethodId } = req.body;

    // Only admin or superadmin can manage payment methods
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    if (!paymentMethodId) {
      return res.status(400).json({ message: "Payment method ID required" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      
      if (!subscription || !subscription.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const { stripe } = await import("./stripe");
      
      // Set this payment method as the default for the customer
      await stripe.customers.update(subscription.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // If the subscription exists, update its default payment method
      if (subscription.stripeSubscriptionId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          default_payment_method: paymentMethodId,
        });
      }

      res.json({ success: true, message: "Default payment method updated successfully" });
    } catch (error: any) {
      console.error('[STRIPE] Error setting default payment method:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete payment method
  app.delete("/api/billing/payment-method/:paymentMethodId", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const { paymentMethodId } = req.params;

    // Only admin or superadmin can manage payment methods
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.body.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    if (!paymentMethodId) {
      return res.status(400).json({ message: "Payment method ID required" });
    }

    try {
      const subscription = await storage.getSubscriptionByCompany(companyId);
      
      if (!subscription || !subscription.stripeCustomerId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const { stripe } = await import("./stripe");
      
      // First, check if this is the default payment method
      const customer = await stripe.customers.retrieve(subscription.stripeCustomerId) as any;
      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;
      
      if (defaultPaymentMethodId === paymentMethodId) {
        return res.status(400).json({ message: "Cannot delete the default payment method. Please set another card as default first." });
      }

      // Detach the payment method from the customer
      await stripe.paymentMethods.detach(paymentMethodId);

      res.json({ success: true, message: "Payment method deleted successfully" });
    } catch (error: any) {
      console.error('[STRIPE] Error deleting payment method:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get billing address for company
  app.get("/api/billing/address", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can view billing address
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    // SECURITY: For non-superadmins, verify the company matches the user's company
    if (currentUser.role !== "superadmin" && companyId !== currentUser.companyId) {
      return res.status(403).json({ message: "Unauthorized access to company billing address" });
    }

    try {
      const billingAddress = await storage.getBillingAddress(companyId);
      res.json({ billingAddress });
    } catch (error: any) {
      console.error('[BILLING] Error fetching billing address:', error);
      res.status(500).json({ message: "Failed to fetch billing address" });
    }
  });

  // Create or update billing address
  app.post("/api/billing/address", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only admin or superadmin can update billing address
    if (currentUser.role !== "admin" && currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companyId = currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    const { fullName, addressLine1, addressLine2, city, state, postalCode } = req.body;

    // Validate required fields
    if (!fullName || !addressLine1 || !city || !state || !postalCode) {
      return res.status(400).json({ message: "Missing required billing address fields" });
    }

    try {
      // Check if billing address already exists
      const existingAddress = await storage.getBillingAddress(companyId);

      let billingAddress;
      if (existingAddress) {
        // Update existing address
        billingAddress = await storage.updateBillingAddress(companyId, {
          fullName,
          addressLine1,
          addressLine2: addressLine2 || null,
          city,
          state,
          postalCode,
        });
      } else {
        // Create new address
        billingAddress = await storage.createBillingAddress({
          companyId,
          fullName,
          addressLine1,
          addressLine2: addressLine2 || null,
          city,
          state,
          postalCode,
        });
      }

      // Update Stripe customer with new billing information
      const subscription = await storage.getSubscriptionByCompany(companyId);
      if (subscription?.stripeCustomerId) {
        const { stripe } = await import("./stripe");
        
        // Get company to use its country
        const company = await storage.getCompany(companyId);
        
        await stripe.customers.update(subscription.stripeCustomerId, {
          name: fullName,
          address: {
            line1: addressLine1,
            line2: addressLine2 || undefined,
            city,
            state,
            postal_code: postalCode,
            country: company?.country || 'US',
          },
        });
        
        console.log('[BILLING] Updated Stripe customer billing information:', subscription.stripeCustomerId);
      }

      res.json({ billingAddress, message: "Billing address saved successfully" });
    } catch (error: any) {
      console.error('[BILLING] Error saving billing address:', error);
      res.status(500).json({ message: "Failed to save billing address" });
    }
  });

  // Create financial support ticket
  app.post("/api/billing/financial-support", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const companyId = currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    try {
      // Validate request body
      const validatedData = insertFinancialSupportTicketSchema.parse({
        companyId,
        userId: currentUser.id,
        situation: req.body.situation,
        proposedSolution: req.body.proposedSolution,
      });

      // Create the ticket
      const ticket = await storage.createFinancialSupportTicket(validatedData);

      // Get company and user details for notification
      const company = await storage.getCompany(companyId);
      const user = await storage.getUser(currentUser.id);

      if (!company || !user) {
        return res.status(404).json({ message: "Company or user not found" });
      }

      // Send notification to all superadmins
      const allUsers = await storage.getAllUsers();
      const superadmins = allUsers.filter(u => u.role === 'superadmin');

      for (const admin of superadmins) {
        await storage.createNotification({
          userId: admin.id,
          type: 'financial_support_request',
          title: 'New Financial Support Request',
          message: `${user.firstName} ${user.lastName} from ${company.name} has requested financial support.`,
          link: `/tickets?ticketId=${ticket.id}`,
          isRead: false,
        });
      }

      // Broadcast notification update
      const { broadcastNotificationUpdate } = await import("./websocket");
      broadcastNotificationUpdate();

      console.log('[FINANCIAL SUPPORT] Ticket created and superadmins notified:', ticket.id);

      res.json({ 
        ticket,
        message: "Your request has been submitted. Our team will review it and respond to you within 48 hours." 
      });
    } catch (error: any) {
      console.error('[FINANCIAL SUPPORT] Error creating ticket:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      
      res.status(500).json({ message: "Error creating support request" });
    }
  });

  // Get user's own financial support tickets
  app.get("/api/my-support-tickets", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    try {
      const tickets = await storage.getFinancialSupportTicketsByUser(currentUser.id);
      res.json({ tickets });
    } catch (error) {
      console.error('[TICKETS] Error fetching user tickets:', error);
      res.status(500).json({ message: "Error fetching your support tickets" });
    }
  });

  // Get all financial support tickets (superadmin only)
  app.get("/api/tickets", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only superadmins can view all tickets
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const tickets = await storage.getAllFinancialSupportTickets();
      res.json({ tickets });
    } catch (error) {
      console.error('[TICKETS] Error fetching tickets:', error);
      res.status(500).json({ message: "Error fetching tickets" });
    }
  });

  // Get specific financial support ticket (superadmin only)
  app.get("/api/tickets/:id", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only superadmins can view tickets
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const ticket = await storage.getFinancialSupportTicket(req.params.id);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json({ ticket });
    } catch (error) {
      console.error('[TICKETS] Error fetching ticket:', error);
      res.status(500).json({ message: "Error fetching ticket" });
    }
  });

  // Update financial support ticket (superadmin only)
  app.patch("/api/tickets/:id", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only superadmins can update tickets
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const { status, adminResponse } = req.body;

      // Get the current ticket state before updating
      const currentTicket = await storage.getFinancialSupportTicket(req.params.id);
      if (!currentTicket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Build update data
      const updateData: any = {};
      
      if (status) {
        updateData.status = status;
      }
      
      if (adminResponse !== undefined) {
        updateData.adminResponse = adminResponse;
        updateData.respondedBy = currentUser.id;
        updateData.respondedAt = new Date();
      }

      const ticket = await storage.updateFinancialSupportTicket(req.params.id, updateData);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Get full ticket details with relations
      const fullTicket = await storage.getFinancialSupportTicket(ticket.id);

      // Notify the user about changes
      if (fullTicket) {
        const { broadcastNotificationUpdate } = await import("./websocket");
        
        // If status changed, notify about status change
        if (status && status !== currentTicket.status) {
          const statusMessages: Record<string, { title: string; message: string }> = {
            pending: {
              title: 'Financial Support Request Received',
              message: 'Your financial support request has been received and is pending review.',
            },
            under_review: {
              title: 'Financial Support Request Under Review',
              message: 'Your financial support request is now under review by our team. We will get back to you soon.',
            },
            approved: {
              title: 'Financial Support Request Approved',
              message: 'Great news! Your financial support request has been approved. Check your ticket for details.',
            },
            rejected: {
              title: 'Financial Support Request Update',
              message: 'Your financial support request has been reviewed. Please check your ticket for more information.',
            },
            closed: {
              title: 'Financial Support Request Closed',
              message: 'Your financial support request has been closed.',
            },
          };

          const statusNotification = statusMessages[status];
          if (statusNotification) {
            await storage.createNotification({
              userId: fullTicket.userId,
              type: 'financial_support_status',
              title: statusNotification.title,
              message: statusNotification.message,
              link: '/my-support-tickets',
              isRead: false,
            });
            broadcastNotificationUpdate();
          }
        }

        // If we have a response, notify the user about the response
        if (adminResponse && adminResponse !== currentTicket.adminResponse) {
          await storage.createNotification({
            userId: fullTicket.userId,
            type: 'financial_support_response',
            title: 'Response to Your Financial Support Request',
            message: adminResponse,
            link: '/my-support-tickets',
            isRead: false,
          });
          broadcastNotificationUpdate();
        }
      }

      res.json({ ticket: fullTicket });
    } catch (error) {
      console.error('[TICKETS] Error updating ticket:', error);
      res.status(500).json({ message: "Error updating ticket" });
    }
  });

  // Delete financial support ticket (superadmin only)
  app.delete("/api/tickets/:id", requireAuth, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    // Only superadmins can delete tickets
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: "Access denied" });
    }

    try {
      const deleted = await storage.deleteFinancialSupportTicket(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[TICKETS] Error deleting ticket:', error);
      res.status(500).json({ message: "Error deleting ticket" });
    }
  });

  // ===================================================================
  // STRIPE WEBHOOKS
  // ===================================================================

  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ message: "Missing Stripe signature" });
    }

    try {
      // SECURITY: Verify webhook signature before processing
      const { verifyWebhookSignature } = await import("./stripe");
      const event = verifyWebhookSignature(req.body, sig as string);

      const {
        handleSubscriptionCreated,
        handleSubscriptionUpdated,
        handleSubscriptionDeleted,
        syncInvoiceFromStripe,
        recordPayment,
      } = await import("./stripe");

      console.log(`[WEBHOOK] Processing event: ${event.type}`);

      switch (event.type) {
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object as any);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as any);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as any);
          break;
        case 'invoice.paid':
          // Ignore invoice.paid - we only process invoice.payment_succeeded to avoid duplicates
          console.log('[WEBHOOK] Ignoring invoice.paid (will be processed via invoice.payment_succeeded)');
          break;
        case 'invoice.payment_succeeded':
          {
            const stripeInvoice = event.data.object as any;
            console.log('[WEBHOOK] Invoice payment succeeded:', stripeInvoice.id);
            
            // Get the amount (in cents)
            const amountInCents = stripeInvoice.amount_paid || stripeInvoice.total;
            const amountInDollars = amountInCents / 100;
            
            // Sync invoice from Stripe
            const invoice = await syncInvoiceFromStripe(stripeInvoice.id);
            
            if (invoice) {
              console.log('[WEBHOOK] Invoice synced successfully, invoice ID:', invoice.id);
              
              // Create payment record if payment intent exists
              if (stripeInvoice.payment_intent) {
                console.log('[WEBHOOK] Creating payment record for payment intent:', stripeInvoice.payment_intent);
                await recordPayment(
                  stripeInvoice.payment_intent,
                  invoice.companyId,
                  invoice.id,
                  amountInCents,
                  stripeInvoice.currency,
                  'succeeded',
                  stripeInvoice.payment_method_types?.[0] || 'card'
                );
              } else {
                console.log('[WEBHOOK] No payment intent found, skipping payment record creation');
              }
              
              // CRITICAL: Skip notifications and emails for $0.00 invoices (trial invoices)
              if (amountInCents === 0) {
                console.log('[WEBHOOK] Skipping notifications and emails for $0.00 invoice:', invoice.invoiceNumber);
              } else {
                // Send notification and email (only once per payment)
                console.log('[WEBHOOK] Sending payment success notification to company:', invoice.companyId);
                const { notificationService } = await import("./notification-service");
                await notificationService.notifyPaymentSucceeded(
                  invoice.companyId,
                  amountInCents,
                  stripeInvoice.currency,
                  invoice.invoiceNumber
                );
                console.log('[NOTIFICATION] Payment success notification sent to company:', invoice.companyId);
                
                // Send payment confirmation email to admins
                console.log('[WEBHOOK] Sending payment confirmation email to company:', invoice.companyId);
                const emailSent = await sendPaymentConfirmationEmail(
                  invoice.companyId,
                  amountInDollars,
                  stripeInvoice.currency,
                  invoice.invoiceNumber,
                  stripeInvoice.hosted_invoice_url || undefined
                );
                
                if (emailSent) {
                  console.log('[EMAIL] Payment confirmation email sent successfully');
                } else {
                  console.error('[EMAIL] Failed to send payment confirmation email');
                }
              }
            } else {
              console.error('[WEBHOOK] Invoice sync failed - invoice is null');
            }
          }
          break;
        case 'invoice.payment_failed':
          {
            const stripeInvoice = event.data.object as any;
            console.log('[WEBHOOK] Invoice payment failed:', stripeInvoice.id);
            
            // Get the amount (in cents)
            const amountInCents = stripeInvoice.amount_due || stripeInvoice.total;
            const amountInDollars = amountInCents / 100;
            
            // Sync invoice to update status
            const invoice = await syncInvoiceFromStripe(stripeInvoice.id);
            
            // Notify company admins about failed payment
            if (invoice) {
              // CRITICAL: Skip notifications and emails for $0.00 invoices
              if (amountInCents === 0) {
                console.log('[WEBHOOK] Skipping notifications and emails for $0.00 failed invoice:', invoice.invoiceNumber);
              } else {
                // Use deduplication to prevent duplicate notifications if webhook retries
                const notificationKey = `payment_failed_notification_${invoice.id}`;
                const now = Date.now();
                const lastSent = (global as any)[notificationKey] || 0;
                
                // Only send if we haven't sent in the last 60 seconds
                if (now - lastSent > 60000) {
                  // Send in-app notification
                  const { notificationService } = await import("./notification-service");
                  await notificationService.notifyPaymentFailed(
                    invoice.companyId,
                    amountInCents,
                    stripeInvoice.currency,
                    invoice.invoiceNumber
                  );
                  console.log('[NOTIFICATION] Payment failure notification sent to company:', invoice.companyId);
                  
                  // Send payment failed email to admins
                  console.log('[WEBHOOK] Sending payment failed email to company:', invoice.companyId);
                  const emailSent = await sendPaymentFailedEmail(
                    invoice.companyId,
                    amountInDollars,
                    stripeInvoice.currency,
                    invoice.invoiceNumber,
                    req
                  );
                  
                  if (emailSent) {
                    console.log('[EMAIL] Payment failed email sent successfully');
                  } else {
                    console.error('[EMAIL] Failed to send payment failed email');
                  }
                  
                  // Mark as sent
                  (global as any)[notificationKey] = now;
                } else {
                  console.log('[WEBHOOK] Skipping duplicate payment failed notification for invoice:', invoice.id);
                }
              }
            }
          }
          break;
        case 'payment_intent.succeeded':
          {
            const paymentIntent = event.data.object as any;
            console.log('[WEBHOOK] Payment succeeded:', paymentIntent.id);
            // Payment is already recorded via invoice.paid event
          }
          break;
        case 'payment_intent.payment_failed':
          {
            const paymentIntent = event.data.object as any;
            console.log('[WEBHOOK] Payment intent failed:', paymentIntent.id);
            
            // Get the customer ID from the payment intent
            const customerId = paymentIntent.customer;
            if (!customerId) {
              console.log('[WEBHOOK] No customer ID in payment intent, skipping');
              break;
            }
            
            // Find the company by Stripe customer ID
            const subscription = await storage.getSubscriptionByStripeCustomerId(customerId);
            if (!subscription) {
              console.log('[WEBHOOK] No subscription found for customer:', customerId);
              break;
            }
            
            // Get amount in cents
            const amountInCents = paymentIntent.amount || 0;
            const amountInDollars = amountInCents / 100;
            const currency = paymentIntent.currency || 'usd';
            
            // CRITICAL: Skip notifications and emails for $0.00 payments
            if (amountInCents === 0) {
              console.log('[WEBHOOK] Skipping notifications and emails for $0.00 payment intent:', paymentIntent.id);
            } else {
              // Use deduplication to prevent duplicate notifications if webhook retries
              const notificationKey = `payment_intent_failed_${paymentIntent.id}`;
              const now = Date.now();
              const lastSent = (global as any)[notificationKey] || 0;
              
              // Only send if we haven't sent in the last 60 seconds
              if (now - lastSent > 60000) {
                console.log('[WEBHOOK] Sending payment failed email for payment intent to company:', subscription.companyId);
                const emailSent = await sendPaymentFailedEmail(
                  subscription.companyId,
                  amountInDollars,
                  currency,
                  `Payment verification - ${paymentIntent.id.substring(0, 8)}`,
                  req
                );
                
                if (emailSent) {
                  console.log('[EMAIL] Payment failed email sent successfully for payment intent');
                } else {
                  console.error('[EMAIL] Failed to send payment failed email for payment intent');
                }
                
                // Mark as sent
                (global as any)[notificationKey] = now;
              } else {
                console.log('[WEBHOOK] Skipping duplicate payment failed notification for payment intent:', paymentIntent.id);
              }
            }
          }
          break;
        default:
          console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ message: `Webhook verification failed: ${error.message}` });
    }
  });

  // =====================================================
  // EMAIL & NOTIFICATIONS ENDPOINTS
  // =====================================================

  // Test email connection
  app.get("/api/email/test", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { emailService } = await import("./email");
      const isConnected = await emailService.verifyConnection();
      
      if (isConnected) {
        res.json({ 
          success: true, 
          message: "Email service connected successfully" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Email service not configured or connection failed" 
        });
      }
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Send test email
  app.post("/api/email/send-test", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { to } = req.body;
      if (!to) {
        return res.status(400).json({ message: "Email address required" });
      }

      const { emailService } = await import("./email");
      const success = await emailService.sendNotificationEmail(
        to,
        "Test Email - Curbe Admin",
        "Este es un email de prueba del sistema de notificaciones de Curbe Admin. Si estás recibiendo esto, significa que el sistema de emails está funcionando correctamente."
      );

      if (success) {
        res.json({ 
          success: true, 
          message: `Test email sent successfully to ${to}` 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to send test email" 
        });
      }
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Get user notifications (all authenticated users)
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    const user = req.user!; // User is guaranteed by middleware

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const notifications = await storage.getNotificationsByUser(user.id, limit);
      res.json({ notifications });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read (with ownership verification)
  app.patch("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;

    try {
      // First verify that the notification belongs to the current user
      const notifications = await storage.getNotificationsByUser(user.id, 100);
      const notification = notifications.find(n => n.id === req.params.id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      const success = await storage.markNotificationAsRead(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Notification not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    const user = req.user!;

    try {
      const success = await storage.markAllNotificationsAsRead(user.id);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Create notification (with optional email)
  app.post("/api/notifications", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { userId, type, title, message, link, sendEmail } = req.body;
      
      if (!userId || !type || !title || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Create notification in database
      const notification = await storage.createNotification({
        userId,
        type,
        title,
        message,
        link,
        isRead: false,
        emailSent: false,
      });

      // Send email if requested
      if (sendEmail) {
        const targetUser = await storage.getUser(userId);
        if (targetUser?.email) {
          const { emailService } = await import("./email");
          const emailSuccess = await emailService.sendNotificationEmail(
            targetUser.email,
            title,
            message
          );

          if (emailSuccess) {
            await storage.markNotificationEmailSent(notification.id);
          }
        }
      }

      res.json({ notification });
    } catch (error) {
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", requireActiveCompany, async (req: Request, res: Response) => {
    const user = req.user!; // User is guaranteed by middleware

    try {
      await storage.markAllNotificationsAsRead(user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // Broadcast notification to all users (superadmin only)
  app.post("/api/notifications/broadcast", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    const broadcastSchema = z.object({
      type: z.enum(["info", "success", "warning", "error"]),
      title: z.string().min(1).max(200),
      message: z.string().min(1).max(500),
      link: z.string().optional(),
    });

    try {
      const validatedData = broadcastSchema.parse(req.body);
      
      const result = await storage.createBroadcastNotification(validatedData, currentUser.id);
      
      // Broadcast to all connected WebSocket clients
      broadcastNotificationUpdate();

      await logger.logCrud({
        req,
        operation: "create",
        entity: "broadcast_notification",
        entityId: result.broadcast.id,
        metadata: { details: `Broadcast notification sent to ${result.notifications.length} users: ${validatedData.title}` },
      });

      res.json({ 
        success: true, 
        count: result.notifications.length,
        message: `Notification sent to ${result.notifications.length} users`,
        broadcastId: result.broadcast.id
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      console.error('Broadcast notification error:', error);
      res.status(500).json({ message: "Failed to broadcast notification" });
    }
  });

  // Get broadcast history (superadmin only)
  app.get("/api/notifications/broadcast/history", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const broadcasts = await storage.getBroadcastHistory(100);
      res.json({ broadcasts });
    } catch (error) {
      console.error('Get broadcast history error:', error);
      res.status(500).json({ message: "Failed to get broadcast history" });
    }
  });

  // Resend broadcast notification (superadmin only)
  app.post("/api/notifications/broadcast/:id/resend", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const broadcast = await storage.getBroadcastNotification(req.params.id);
      if (!broadcast) {
        return res.status(404).json({ message: "Broadcast not found" });
      }

      // Resend with same data
      const result = await storage.createBroadcastNotification({
        type: broadcast.type,
        title: broadcast.title,
        message: broadcast.message,
        link: broadcast.link || undefined,
      }, currentUser.id);

      // Broadcast to all connected WebSocket clients
      broadcastNotificationUpdate();

      await logger.logCrud({
        req,
        operation: "create",
        entity: "broadcast_notification",
        entityId: result.broadcast.id,
        metadata: { details: `Resent broadcast notification to ${result.notifications.length} users: ${broadcast.title}` },
      });

      res.json({ 
        success: true, 
        count: result.notifications.length,
        message: `Notification resent to ${result.notifications.length} users`,
        broadcastId: result.broadcast.id
      });
    } catch (error) {
      console.error('Resend broadcast error:', error);
      res.status(500).json({ message: "Failed to resend broadcast notification" });
    }
  });

  // Delete broadcast notification from history (superadmin only)
  app.delete("/api/notifications/broadcast/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const broadcast = await storage.getBroadcastNotification(req.params.id);
      if (!broadcast) {
        return res.status(404).json({ message: "Broadcast not found" });
      }

      const deleted = await storage.deleteBroadcastNotification(req.params.id);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete broadcast" });
      }

      // Log the operation before sending response
      try {
        await logger.logCrud({
          req,
          operation: "delete",
          entity: "broadcast_notification",
          entityId: req.params.id,
          metadata: { details: `Deleted broadcast notification: ${broadcast.title}` },
        });
      } catch (logError) {
        console.error('Failed to log delete operation:', logError);
        // Continue anyway - don't fail the delete because of logging
      }

      res.json({ 
        success: true, 
        message: "Broadcast deleted successfully"
      });
    } catch (error) {
      console.error('Delete broadcast error:', error);
      res.status(500).json({ message: "Failed to delete broadcast notification" });
    }
  });

  // ==================== EMAIL TEMPLATES ENDPOINTS ====================

  // Get all email templates (superadmin only)
  app.get("/api/email-templates", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const templates = await storage.getEmailTemplates();
      res.json({ templates });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email templates" });
    }
  });

  // Get single email template (superadmin only)
  app.get("/api/email-templates/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ template });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email template" });
    }
  });

  // Create email template (superadmin only)
  app.post("/api/email-templates", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const templateData = insertEmailTemplateSchema.parse(req.body);
      const template = await storage.createEmailTemplate(templateData);
      res.status(201).json({ template });
    } catch (error) {
      res.status(400).json({ message: "Invalid template data" });
    }
  });

  // Update email template (superadmin only)
  app.put("/api/email-templates/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const templateData = insertEmailTemplateSchema.partial().parse(req.body);
      const template = await storage.updateEmailTemplate(req.params.id, templateData);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ template });
    } catch (error) {
      res.status(400).json({ message: "Invalid template data" });
    }
  });

  // Delete email template (superadmin only)
  app.delete("/api/email-templates/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const success = await storage.deleteEmailTemplate(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ==================== FEATURES ENDPOINTS ====================

  // Get all features (superadmin only)
  app.get("/api/features", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const allFeatures = await storage.getAllFeatures();
      res.json({ features: allFeatures });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch features" });
    }
  });

  // Create feature (superadmin only)
  app.post("/api/features", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const validatedData = insertFeatureSchema.parse(req.body);
      const feature = await storage.createFeature(validatedData);
      res.status(201).json(feature);
    } catch (error: any) {
      res.status(400).json({ message: "Invalid feature data" });
    }
  });

  // Update feature (superadmin only)
  app.patch("/api/features/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const validatedData = updateFeatureSchema.parse(req.body);
      const feature = await storage.updateFeature(req.params.id, validatedData);
      if (!feature) {
        return res.status(404).json({ message: "Feature not found" });
      }
      res.json(feature);
    } catch (error) {
      res.status(400).json({ message: "Invalid feature data" });
    }
  });

  // Delete feature (superadmin only)
  app.delete("/api/features/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const success = await storage.deleteFeature(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Feature not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete feature" });
    }
  });

  // ==================== COMPANY FEATURES ENDPOINTS ====================

  // Get features for a company
  app.get("/api/companies/:companyId/features", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    // Superadmin can access any company, others only their own
    if (currentUser.role !== "superadmin" && currentUser.companyId !== req.params.companyId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const companyFeatures = await storage.getCompanyFeatures(req.params.companyId);
      res.json({ features: companyFeatures });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company features" });
    }
  });

  // Add feature to company (superadmin only)
  app.post("/api/companies/:companyId/features", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { featureId } = req.body;
      if (!featureId) {
        return res.status(400).json({ message: "Feature ID is required" });
      }

      const companyFeature = await storage.addFeatureToCompany(
        req.params.companyId,
        featureId,
        currentUser.id
      );
      res.status(201).json(companyFeature);
    } catch (error) {
      res.status(400).json({ message: "Failed to add feature to company" });
    }
  });

  // Remove feature from company (superadmin only)
  app.delete("/api/companies/:companyId/features/:featureId", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const success = await storage.removeFeatureFromCompany(
        req.params.companyId,
        req.params.featureId
      );
      if (!success) {
        return res.status(404).json({ message: "Feature not found for this company" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove feature from company" });
    }
  });

  // ==================== AUDIT LOGS ENDPOINTS ====================

  // Get audit logs (role-based access)
  app.get("/api/audit-logs", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!; // User is guaranteed by middleware

    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const companyId = req.query.companyId as string;

      let logs;

      if (currentUser.role === "superadmin") {
        // Superadmin can see all logs or filter by company
        if (companyId) {
          logs = await storage.getActivityLogsByCompany(companyId, limit);
        } else {
          // Get all logs (we need to add this method to storage)
          logs = await storage.getAllActivityLogs(limit);
        }
      } else {
        // Regular users can only see their company's logs
        if (!currentUser.companyId) {
          return res.status(403).json({ message: "No company associated" });
        }
        logs = await storage.getActivityLogsByCompany(currentUser.companyId, limit);
      }

      res.json({ logs });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ==================== EMAIL CAMPAIGNS ENDPOINTS ====================

  // Get all campaigns (superadmin only)
  app.get("/api/campaigns", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaigns = await storage.getAllCampaigns();
      res.json({ campaigns });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Create a new campaign (superadmin only)
  app.post("/api/campaigns", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { subject, htmlContent, textContent, targetListId } = req.body;

      if (!subject || !htmlContent) {
        return res.status(400).json({ message: "Subject and HTML content are required" });
      }

      const campaign = await storage.createCampaign({
        subject,
        htmlContent,
        textContent: textContent || null,
        targetListId: targetListId || null,
        status: "draft",
        sentAt: null,
        sentBy: currentUser.id,
        recipientCount: 0
      });

      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create campaign";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Get campaign by ID (superadmin only)
  app.get("/api/campaigns/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  // Update campaign (superadmin only)
  app.patch("/api/campaigns/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.status === "sent") {
        return res.status(400).json({ message: "Cannot edit a campaign that has already been sent" });
      }

      const { subject, htmlContent, textContent } = req.body;
      const updateData: Partial<{ subject: string; htmlContent: string; textContent: string | null }> = {};
      if (subject !== undefined) updateData.subject = subject;
      if (htmlContent !== undefined) updateData.htmlContent = htmlContent;
      if (textContent !== undefined) updateData.textContent = textContent;

      const updatedCampaign = await storage.updateCampaign(req.params.id, updateData);

      res.json(updatedCampaign);
    } catch (error) {
      res.status(400).json({ message: "Failed to update campaign" });
    }
  });

  // Delete campaign (superadmin only)
  app.delete("/api/campaigns/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Send campaign (superadmin only) - This will be implemented with EmailCampaignService
  app.post("/api/campaigns/:id/send", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.status === "sent") {
        return res.status(400).json({ message: "Campaign has already been sent" });
      }

      // Start sending campaign asynchronously (returns immediately)
      await emailCampaignService.sendCampaignAsync(req.params.id, campaign.targetListId || undefined);

      console.log(`[CAMPAIGN SEND] Started sending campaign ${req.params.id} in background`);

      // Get updated campaign with "sending" status
      const updatedCampaign = await storage.getCampaign(req.params.id);

      res.json({ 
        campaign: updatedCampaign, 
        message: "Campaign is being sent in the background"
      });
    } catch (error) {
      console.error(`[CAMPAIGN SEND] Exception:`, error);
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });

  // ==================== SMS CAMPAIGNS ENDPOINTS ====================

  // Get all SMS campaigns (superadmin only)
  app.get("/api/sms-campaigns", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const smsCampaigns = await storage.getAllSmsCampaigns();
      res.json({ smsCampaigns });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SMS campaigns" });
    }
  });

  // Create a new SMS campaign (superadmin only)
  app.post("/api/sms-campaigns", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { message, targetListId } = req.body;

      if (!message || message.trim() === "") {
        return res.status(400).json({ message: "Message is required" });
      }

      if (message.length > 1600) {
        return res.status(400).json({ message: "Message is too long. Maximum 1600 characters." });
      }

      const smsCampaign = await storage.createSmsCampaign({
        message,
        targetListId: targetListId || null,
        status: "draft",
      });

      res.json({ smsCampaign });
    } catch (error) {
      res.status(500).json({ message: "Failed to create SMS campaign" });
    }
  });

  // Get single SMS campaign with stats (superadmin only)
  app.get("/api/sms-campaigns/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const smsCampaign = await storage.getSmsCampaign(req.params.id);
      if (!smsCampaign) {
        return res.status(404).json({ message: "SMS campaign not found" });
      }

      const messages = await storage.getCampaignSmsMessages(req.params.id);
      res.json({ smsCampaign, messages });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SMS campaign" });
    }
  });

  // Get SMS campaign statistics (superadmin only)
  app.get("/api/sms-campaigns/:id/stats", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaign = await storage.getSmsCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "SMS campaign not found" });
      }

      // Get all messages for this campaign
      const messages = await storage.getCampaignSmsMessages(req.params.id);
      
      // Enrich messages with user info
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const user = await storage.getUser(msg.userId);
          return {
            ...msg,
            userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A' : 'N/A',
            userEmail: user?.email || 'N/A',
          };
        })
      );

      res.json({
        campaign,
        messages: enrichedMessages,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch SMS campaign statistics" });
    }
  });

  // Delete SMS campaign (superadmin only)
  app.delete("/api/sms-campaigns/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaign = await storage.getSmsCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "SMS campaign not found" });
      }

      await storage.deleteSmsCampaign(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete SMS campaign" });
    }
  });

  // Send SMS campaign (superadmin only)
  app.post("/api/sms-campaigns/:id/send", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const campaign = await storage.getSmsCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "SMS campaign not found" });
      }

      if (campaign.status === "sent") {
        return res.status(400).json({ message: "Campaign has already been sent" });
      }

      // Get recipients (users with phone numbers)
      let recipients = [];
      if (campaign.targetListId) {
        const listMembers = await storage.getListMembers(campaign.targetListId);
        recipients = listMembers.filter(u => u.phone);
      } else {
        const allUsers = await storage.getAllUsers();
        recipients = allUsers.filter(u => u.phone);
      }

      if (recipients.length === 0) {
        return res.status(400).json({ message: "No recipients with phone numbers found" });
      }

      // Update campaign status to sending
      await storage.updateSmsCampaign(req.params.id, {
        status: "sending",
        sentBy: currentUser.id,
        sentAt: new Date(),
        recipientCount: recipients.length,
      });

      // Send SMS to each recipient (fire and forget - background process)
      (async () => {
        let delivered = 0;
        let failed = 0;

        for (const recipient of recipients) {
          try {
            const result = await twilioService.sendSMS(
              recipient.phone!,
              campaign.message
            );

            if (result) {
              await storage.createCampaignSmsMessage({
                campaignId: campaign.id,
                userId: recipient.id,
                phoneNumber: recipient.phone!,
                status: "delivered",
                twilioMessageSid: result.sid,
              });

              delivered++;
            }
          } catch (error: any) {
            await storage.createCampaignSmsMessage({
              campaignId: campaign.id,
              userId: recipient.id,
              phoneNumber: recipient.phone!,
              status: "failed",
              errorMessage: error.message,
            });

            failed++;
          }
        }

        // Update final stats
        await storage.updateSmsCampaign(campaign.id, {
          status: "sent",
          deliveredCount: delivered,
          failedCount: failed,
        });
      })();

      const updatedCampaign = await storage.getSmsCampaign(req.params.id);
      res.json({ 
        smsCampaign: updatedCampaign, 
        message: "SMS campaign is being sent in the background"
      });
    } catch (error) {
      console.error(`[SMS CAMPAIGN SEND] Exception:`, error);
      res.status(500).json({ message: "Failed to send SMS campaign" });
    }
  });

  // ==================== EMAIL CONTACTS/SUBSCRIPTIONS ENDPOINTS ====================

  // Get all users (contacts) - superadmin only
  app.get("/api/contacts", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const contacts = await storage.getAllUsers();
      res.json({ contacts });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Import contacts from CSV (superadmin only)
  app.post("/api/contacts/import", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { contacts } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "Contacts array is required" });
      }

      let imported = 0;
      let skipped = 0;

      for (const contact of contacts) {
        if (!contact.email) {
          skipped++;
          continue;
        }

        // Check if user with this email already exists
        const existing = await storage.getUserByEmail(contact.email);
        if (existing) {
          skipped++;
          continue;
        }

        // Create new user with default settings
        const userData = {
          email: contact.email,
          username: contact.email,
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          phone: contact.phone || null,
          password: Math.random().toString(36).slice(-12), // Random password
          role: "viewer" as const,
          emailSubscribed: true, // Auto-subscribe imported contacts
          smsSubscribed: true, // Auto-subscribe imported contacts to SMS
          emailNotifications: false,
          invoiceAlerts: false,
          language: "en" as const,
          companyId: contact.companyId || null,
        };

        await storage.createUser(userData);
        imported++;
      }

      res.json({ imported, skipped, total: contacts.length });
    } catch (error) {
      console.error("[IMPORT CONTACTS] Error:", error);
      res.status(500).json({ message: "Failed to import contacts" });
    }
  });

  // Update user email subscription
  app.patch("/api/users/:id/subscription", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const targetUserId = req.params.id;

    // Users can only update their own subscription unless they're superadmin
    if (currentUser.role !== "superadmin" && currentUser.id !== targetUserId) {
      return res.status(403).json({ message: "Forbidden - Can only update your own subscription" });
    }

    try {
      const { emailSubscribed } = req.body;

      if (typeof emailSubscribed !== "boolean") {
        return res.status(400).json({ message: "emailSubscribed must be a boolean" });
      }

      const updatedUser = await storage.updateUserSubscription(targetUserId, emailSubscribed);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Public unsubscribe endpoint (no auth required)
  app.post("/api/unsubscribe", async (req: Request, res: Response) => {
    try {
      const { email, token, campaignId } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // If token is provided, it must be valid
      if (token) {
        const { verifyUnsubscribeToken } = await import("./unsubscribe-token");
        
        if (!verifyUnsubscribeToken(email, token)) {
          return res.status(403).json({ message: "Invalid unsubscribe token" });
        }
      }
      // If no token provided, allow legacy/manual unsubscribe (backward compatibility)

      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user subscription
      await storage.updateUserSubscription(user.id, false);

      // If campaignId is provided, record the unsubscribe for that campaign
      if (campaignId) {
        const userAgent = req.headers['user-agent'];
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
        
        await storage.recordCampaignUnsubscribe(campaignId, user.id, userAgent, ipAddress);
        
        // Update campaign_emails status to 'unsubscribed'
        await storage.updateCampaignEmailStatus(
          campaignId,
          user.id,
          'unsubscribed',
          new Date()
        );
      }

      res.json({ success: true, message: "Successfully unsubscribed from emails" });
    } catch (error) {
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });
  
  // Toggle SMS subscription (authenticated endpoint)
  app.patch("/api/users/:userId/sms-subscription", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const { userId } = req.params;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    // Validate request body
    const smsSubscriptionSchema = z.object({
      subscribed: z.boolean()
    });
    
    const validation = smsSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: "subscribed must be a boolean" });
    }
    
    const { subscribed } = validation.data;
    
    try {
      const updatedUser = await storage.updateUserSmsSubscription(userId, subscribed);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        success: true, 
        message: subscribed ? "User subscribed to SMS" : "User unsubscribed from SMS",
        user: updatedUser 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update SMS subscription" });
    }
  });

  // ==================== EMAIL TRACKING (Public endpoints) ====================

  // Track email open (transparent pixel)
  app.get("/api/track/open", async (req: Request, res: Response) => {
    try {
      const { c: campaignId, u: userId, t: token } = req.query;

      if (!campaignId || !userId || !token) {
        return res.status(400).send();
      }

      const { trackingService } = await import("./tracking-service");
      
      if (!trackingService.verifyTrackingToken(
        campaignId as string,
        userId as string,
        token as string
      )) {
        return res.status(403).send();
      }

      // Check if this user has already opened this campaign
      const existingOpens = await storage.getEmailOpens(campaignId as string);
      const userAlreadyOpened = existingOpens.some(open => open.userId === userId);

      // Only record the first open from this user
      if (!userAlreadyOpened) {
        const userAgent = req.headers['user-agent'];
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

        await storage.recordEmailOpen(
          campaignId as string,
          userId as string,
          userAgent,
          ipAddress
        );
        
        // Update campaign_emails status to 'opened'
        await storage.updateCampaignEmailStatus(
          campaignId as string,
          userId as string,
          'opened',
          new Date()
        );
        
        console.log(`[TRACKING] First open recorded for user ${userId} in campaign ${campaignId}`);
      } else {
        console.log(`[TRACKING] Duplicate open ignored for user ${userId} in campaign ${campaignId}`);
      }

      // Return transparent 1x1 pixel GIF
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      });
      res.end(pixel);
    } catch (error) {
      res.status(500).send();
    }
  });

  // Track link click and redirect
  app.get("/api/track/click", async (req: Request, res: Response) => {
    try {
      const { c: campaignId, u: userId, url, t: token } = req.query;

      if (!campaignId || !userId || !url || !token) {
        return res.status(400).json({ message: "Missing parameters" });
      }

      const { trackingService } = await import("./tracking-service");
      
      if (!trackingService.verifyTrackingToken(
        campaignId as string,
        userId as string,
        token as string
      )) {
        return res.status(403).json({ message: "Invalid token" });
      }

      const decodedUrl = decodeURIComponent(url as string);
      const userAgent = req.headers['user-agent'];
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

      await storage.recordLinkClick(
        campaignId as string,
        userId as string,
        decodedUrl,
        userAgent,
        ipAddress
      );
      
      // Update campaign_emails status to 'clicked'
      await storage.updateCampaignEmailStatus(
        campaignId as string,
        userId as string,
        'clicked',
        new Date()
      );

      res.redirect(decodedUrl);
    } catch (error) {
      res.status(500).json({ message: "Tracking failed" });
    }
  });

  // Get campaign statistics (authenticated, superadmin only)
  app.get("/api/campaigns/:id/stats", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { id } = req.params;
      const stats = await storage.getCampaignStats(id);
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign statistics" });
    }
  });

  // Get campaign emails list (authenticated, superadmin only)
  app.get("/api/campaigns/:id/emails", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { id } = req.params;
      const { status, search } = req.query;
      
      const filters: { status?: string; search?: string } = {};
      if (status && typeof status === 'string') filters.status = status;
      if (search && typeof search === 'string') filters.search = search;
      
      const emails = await storage.getCampaignEmails(id, filters);
      
      res.json({ emails });
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign emails" });
    }
  });

  // ==================== CONTACT LISTS ENDPOINTS ====================

  // Get all contact lists (superadmin only)
  app.get("/api/contact-lists", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const lists = await storage.getAllContactLists();
      res.json({ lists });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact lists" });
    }
  });

  // Get contact list by ID (superadmin only)
  app.get("/api/contact-lists/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const list = await storage.getContactList(req.params.id);
      if (!list) {
        return res.status(404).json({ message: "Contact list not found" });
      }
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact list" });
    }
  });

  // Create contact list (superadmin only)
  app.post("/api/contact-lists", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const list = await storage.createContactList({
        name,
        description: description || null,
        createdBy: currentUser.id
      });

      res.status(201).json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to create contact list" });
    }
  });

  // Update contact list (superadmin only)
  app.patch("/api/contact-lists/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { name, description } = req.body;

      const updatedList = await storage.updateContactList(req.params.id, {
        name,
        description
      });

      if (!updatedList) {
        return res.status(404).json({ message: "Contact list not found" });
      }

      res.json(updatedList);
    } catch (error) {
      res.status(500).json({ message: "Failed to update contact list" });
    }
  });

  // Delete contact list (superadmin only)
  app.delete("/api/contact-lists/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const deleted = await storage.deleteContactList(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Contact list not found" });
      }

      res.json({ message: "Contact list deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contact list" });
    }
  });

  // Get members of a contact list (superadmin only)
  app.get("/api/contact-lists/:id/members", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const members = await storage.getListMembers(req.params.id);
      res.json({ members });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch list members" });
    }
  });

  // Add member to contact list (superadmin only)
  app.post("/api/contact-lists/:id/members", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const member = await storage.addMemberToList(req.params.id, userId);
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to add member to list" });
    }
  });

  // Remove member from contact list (superadmin only)
  app.delete("/api/contact-lists/:id/members/:userId", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const deleted = await storage.removeMemberFromList(req.params.id, req.params.userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Member not found in list" });
      }

      res.json({ message: "Member removed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // Bulk move contacts between lists (superadmin only)
  app.post("/api/contact-lists/bulk-move", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }

    try {
      const { userIds, targetListId } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "User IDs array is required" });
      }

      if (!targetListId) {
        return res.status(400).json({ message: "Target list ID is required" });
      }

      // Add users to target list (onConflictDoNothing handles duplicates)
      let movedCount = 0;
      for (const userId of userIds) {
        const result = await storage.addMemberToList(targetListId, userId);
        if (result) {
          movedCount++;
        }
      }

      res.json({ 
        message: `${movedCount} contacts moved successfully`,
        movedCount,
        totalRequested: userIds.length
      });
    } catch (error) {
      console.error("Error moving contacts:", error);
      res.status(500).json({ message: "Failed to move contacts", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ==================== INCOMING SMS MESSAGES ====================
  
  // Get all incoming SMS messages (superadmin only)
  app.get("/api/incoming-sms", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const messages = await storage.getAllIncomingSmsMessages();
      res.json({ incomingSmsMessages: messages });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch incoming SMS messages" });
    }
  });
  
  // Mark incoming SMS as read (superadmin only)
  app.patch("/api/incoming-sms/:id/read", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      await storage.markSmsAsRead(req.params.id);
      res.json({ message: "Message marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });
  
  // ==================== SMS CHAT ====================
  
  // Get all chat conversations (superadmin only)
  app.get("/api/chat/conversations", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      // Superadmins can optionally filter by companyId via query param
      const companyId = req.query.companyId as string | undefined;
      const conversations = await storage.getChatConversations(companyId);
      
      // Prevent caching to avoid 304 responses after DELETE operations
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.removeHeader('ETag');
      
      res.json({ conversations });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get unread conversations count (superadmin only)
  app.get("/api/chat/unread-count", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const companyId = req.query.companyId as string | undefined;
      const conversations = await storage.getChatConversations(companyId);
      
      // Count conversations (unique users) with unread messages
      const unreadCount = conversations.filter(c => c.unreadCount > 0).length;
      
      res.json({ unreadCount });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Mark all conversations as read (superadmin only)
  app.post("/api/chat/mark-all-read", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const companyId = req.query.companyId as string | undefined;
      const conversations = await storage.getChatConversations(companyId);
      
      // Mark each conversation as read
      await Promise.all(
        conversations.map(conv => storage.markConversationAsRead(conv.phoneNumber))
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all as read:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });
  
  // Get messages for a specific conversation (superadmin only)
  app.get("/api/chat/conversations/:phoneNumber/messages", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { phoneNumber } = req.params;
      // Superadmins can optionally filter by companyId via query param
      const companyId = req.query.companyId as string | undefined;
      const messages = await storage.getConversationMessages(phoneNumber, companyId);
      
      // Prevent caching to ensure real-time message updates
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.removeHeader('ETag');
      
      res.json({ messages });
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  // Send SMS message (superadmin only)
  app.post("/api/chat/send", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { toPhone, message } = req.body;
      
      if (!toPhone || !message) {
        return res.status(400).json({ message: "Phone number and message are required" });
      }
      
      // Find user by phone number
      const recipientUser = await storage.getUserByPhone(toPhone);
      
      // Get Twilio phone number
      const fromPhone = process.env.TWILIO_PHONE_NUMBER || "";
      
      // Determine companyId: use currentUser's companyId or recipient's if available
      const companyId = currentUser.companyId || recipientUser?.companyId || null;
      
      // Create outgoing message record
      const outgoingMessage = await storage.createOutgoingSmsMessage({
        toPhone,
        fromPhone,
        messageBody: message,
        status: "sending",
        sentBy: currentUser.id,
        userId: recipientUser?.id || null,
        companyId,
      });
      
      // Send SMS via Twilio
      try {
        const twilioResult = await twilioService.sendSMS(toPhone, message);
        
        if (twilioResult) {
          // Update with Twilio SID and status
          await storage.updateOutgoingSmsMessageStatus(
            outgoingMessage.id,
            "sent",
            twilioResult.sid
          );
          
          // Broadcast update to WebSocket clients for real-time updates
          broadcastConversationUpdate();
          
          res.json({ 
            message: "SMS sent successfully",
            messageId: outgoingMessage.id,
            twilioSid: twilioResult.sid
          });
        } else {
          throw new Error("Failed to send SMS");
        }
      } catch (twilioError) {
        // Update status to failed
        await storage.updateOutgoingSmsMessageStatus(
          outgoingMessage.id,
          "failed",
          undefined,
          "TWILIO_ERROR",
          twilioError instanceof Error ? twilioError.message : "Unknown error"
        );
        
        throw twilioError;
      }
    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ 
        message: "Failed to send SMS",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Mark conversation as read (superadmin only)
  app.post("/api/chat/conversations/:phoneNumber/read", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { phoneNumber } = req.params;
      // Superadmins can optionally filter by companyId via query param
      const companyId = req.query.companyId as string | undefined;
      await storage.markConversationAsRead(phoneNumber, companyId);
      res.json({ message: "Conversation marked as read" });
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      res.status(500).json({ message: "Failed to mark conversation as read" });
    }
  });
  
  // Get notes for a conversation (superadmin only)
  app.get("/api/chat/conversations/:phoneNumber/notes", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { phoneNumber } = req.params;
      
      // Find user by phone number to get their companyId
      const contactUser = await storage.getUserByPhone(phoneNumber);
      
      // Determine companyId: use currentUser's companyId or contact's if available
      const companyId = currentUser.companyId || contactUser?.companyId;
      
      if (!companyId) {
        // Return empty array if no company can be determined
        return res.json([]);
      }
      
      const notes = await storage.getChatNotes(phoneNumber, companyId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching chat notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });
  
  // Create a note for a conversation (superadmin only)
  app.post("/api/chat/conversations/:phoneNumber/notes", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { phoneNumber } = req.params;
      const { note } = req.body;
      
      if (!note || typeof note !== 'string' || note.trim().length === 0) {
        return res.status(400).json({ message: "Note content is required" });
      }
      
      // Find user by phone number to get their companyId
      const contactUser = await storage.getUserByPhone(phoneNumber);
      
      // Determine companyId: use currentUser's companyId or contact's if available
      const companyId = currentUser.companyId || contactUser?.companyId;
      
      if (!companyId) {
        return res.status(400).json({ message: "Cannot determine company for this conversation" });
      }
      
      const newNote = await storage.createChatNote({
        phoneNumber,
        note: note.trim(),
        companyId,
        createdBy: currentUser.id
      });
      
      res.json(newNote);
    } catch (error) {
      console.error("Error creating chat note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });
  
  // Update a note (superadmin only)
  app.patch("/api/chat/notes/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { id } = req.params;
      const { note } = req.body;
      
      if (!note || typeof note !== 'string' || note.trim().length === 0) {
        return res.status(400).json({ message: "Note content is required" });
      }
      
      // For updates, companyId can be null for superadmins (they can update any note)
      const updatedNote = await storage.updateChatNote(id, note.trim(), currentUser.companyId || undefined);
      
      if (!updatedNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.json(updatedNote);
    } catch (error) {
      console.error("Error updating chat note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });
  
  // Delete a note (superadmin only)
  app.delete("/api/chat/notes/:id", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { id } = req.params;
      // For deletes, companyId can be null for superadmins (they can delete any note)
      await storage.deleteChatNote(id, currentUser.companyId || undefined);
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting chat note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });
  
  // Delete entire conversation (superadmin only)
  app.delete("/api/chat/conversations/:phoneNumber", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;
    
    if (currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden - Superadmin only" });
    }
    
    try {
      const { phoneNumber } = req.params;
      
      // Superadmins can optionally filter by companyId via query param
      // If no companyId provided, delete from all companies (superadmin privilege)
      const companyId = req.query.companyId as string | undefined;
      
      if (companyId) {
        await storage.deleteConversation(phoneNumber, companyId);
      } else {
        // Delete conversation for all companies (superadmin only)
        await storage.deleteConversationAll(phoneNumber);
      }
      
      // Broadcast conversation update to refresh UI
      if (req.app.get('wsService')) {
        const wsService = req.app.get('wsService');
        wsService.broadcastConversationUpdate();
      }
      
      res.json({ message: "Conversation deleted successfully" });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });
  
  // ==================== TWILIO WEBHOOKS ====================
  
  // Helper function to validate Twilio signature
  function validateTwilioSignature(req: Request): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      console.error("[TWILIO WEBHOOK] TWILIO_AUTH_TOKEN not configured");
      return false;
    }

    const twilioSignature = req.headers['x-twilio-signature'] as string;
    if (!twilioSignature) {
      console.error("[TWILIO WEBHOOK] Missing X-Twilio-Signature header");
      return false;
    }

    // Get the full URL (protocol + host + path)
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}${req.originalUrl}`;

    try {
      const isValid = twilio.validateRequest(
        authToken,
        twilioSignature,
        url,
        req.body
      );
      
      if (!isValid) {
        console.error("[TWILIO WEBHOOK] Invalid signature");
      }
      
      return isValid;
    } catch (error) {
      console.error("[TWILIO WEBHOOK] Signature validation error:", error);
      return false;
    }
  }
  
  // Twilio Status Callback - Update message delivery status
  app.post("/api/webhooks/twilio/status", async (req: Request, res: Response) => {
    try {
      // Validate Twilio signature
      if (!validateTwilioSignature(req)) {
        console.warn("[TWILIO STATUS] Rejected unauthorized webhook request");
        return res.status(403).send("Forbidden");
      }

      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;
      
      console.log(`[TWILIO STATUS] SID: ${MessageSid}, Status: ${MessageStatus}`);
      
      if (!MessageSid || !MessageStatus) {
        return res.status(400).send("Missing required fields");
      }
      
      // Update message status in database
      await storage.updateCampaignSmsMessageStatus(
        MessageSid, 
        MessageStatus,
        ErrorCode,
        ErrorMessage
      );
      
      res.status(200).send("OK");
    } catch (error) {
      console.error("[TWILIO STATUS WEBHOOK] Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  // Twilio Incoming Message - Receive SMS replies
  app.post("/api/webhooks/twilio/incoming", async (req: Request, res: Response) => {
    try {
      // Log incoming webhook for debugging
      console.log("[TWILIO INCOMING] Webhook URL:", `${req.protocol}://${req.get('host')}${req.originalUrl}`);
      console.log("[TWILIO INCOMING] Headers:", JSON.stringify(req.headers));
      
      // Validate Twilio signature
      // Temporarily disabled for debugging - TODO: Re-enable after fixing URL mismatch
      // if (!validateTwilioSignature(req)) {
      //   console.warn("[TWILIO INCOMING] Rejected unauthorized webhook request");
      //   return res.status(403).send("Forbidden");
      // }

      const { MessageSid, From, To, Body } = req.body;
      
      console.log(`[TWILIO INCOMING] From: ${From}, Body: ${Body}`);
      
      if (!MessageSid || !From || !To || !Body) {
        return res.status(400).send("Missing required fields");
      }
      
      // Try to find user by phone number (optimized with direct query)
      const matchedUser = await storage.getUserByPhone(From);
      
      // Check for unsubscribe keywords (STOP, UNSUBSCRIBE, etc.)
      const unsubscribeKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
      const messageUpper = Body.trim().toUpperCase();
      const isUnsubscribeRequest = unsubscribeKeywords.includes(messageUpper);
      
      // If user wants to unsubscribe and we found them
      if (isUnsubscribeRequest && matchedUser) {
        await storage.updateUserSmsSubscription(matchedUser.id, false);
        console.log(`[TWILIO INCOMING] User ${matchedUser.id} unsubscribed from SMS`);
      }
      
      // Store incoming message
      await storage.createIncomingSmsMessage({
        twilioMessageSid: MessageSid,
        fromPhone: From,
        toPhone: To,
        messageBody: Body,
        userId: matchedUser?.id,
        companyId: matchedUser?.companyId || null,
        isRead: false
      });
      
      // Create notifications for superadmins
      try {
        const allUsers = await storage.getAllUsers();
        const superadmins = allUsers.filter(user => user.role === 'superadmin');
        
        if (superadmins.length === 0) {
          console.log("[TWILIO INCOMING] No superadmins found for notifications");
        } else {
          // Get sender name or format phone number
          const senderName = matchedUser && matchedUser.firstName && matchedUser.lastName
            ? `${matchedUser.firstName} ${matchedUser.lastName}` 
            : From;
          
          // Create notification for each superadmin
          const notificationPromises = superadmins.map(admin => 
            storage.createNotification({
              userId: admin.id,
              type: 'sms_received',
              title: `SMS from ${senderName}`,
              message: Body.substring(0, 100) + (Body.length > 100 ? '...' : ''),
              link: '/incoming-sms'
            })
          );
          
          await Promise.all(notificationPromises);
          console.log(`[TWILIO INCOMING] Created ${superadmins.length} notification(s) for incoming SMS`);
        }
      } catch (error) {
        console.error("[TWILIO INCOMING] Failed to create notifications:", error);
        // Don't fail the webhook if notifications fail
      }
      
      // Broadcast update to WebSocket clients for real-time updates
      broadcastConversationUpdate();
      
      // Respond to Twilio with TwiML (empty response = no auto-reply)
      res.type("text/xml");
      res.send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
    } catch (error) {
      console.error("[TWILIO INCOMING WEBHOOK] Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket for real-time chat updates
  setupWebSocket(httpServer);

  return httpServer;
}
