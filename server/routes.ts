import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { LoggingService } from "./logging-service";
import { emailService } from "./email";
import { twilioService } from "./twilio";
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
  updateFeatureSchema
} from "@shared/schema";
import "./types";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize logging service
  const logger = new LoggingService(storage);

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
    }

    // Store user in request for use in route handlers
    req.user = user;
    next();
  };

  // ==================== AUTH ENDPOINTS ====================
  
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(email);

      if (!user) {
        await logger.logAuth({
          req,
          action: "login_failed",
          email,
          metadata: { reason: "User not found" },
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user has activated their account (password set)
      if (!user.password) {
        await logger.logAuth({
          req,
          action: "login_failed",
          userId: user.id,
          email,
          metadata: { reason: "Account not activated" },
        });
        return res.status(401).json({ message: "Please activate your account first. Check your email for the activation link." });
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

      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        await logger.logAuth({
          req,
          action: "login_failed",
          userId: user.id,
          email,
          metadata: { reason: "Invalid password" },
        });
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
        role: user.role,
        companyId: user.companyId,
        companyName: companyName,
      },
    });
  });

  // ==================== 2FA/OTP ENDPOINTS ====================

  app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    try {
      const { method } = req.body;

      // Check if user has pending authentication
      if (!req.session.pendingUserId) {
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

      // Update user with new password and mark email as verified
      await storage.updateUser(userId, {
        password: hashedPassword,
        emailVerified: true,
      });

      await logger.logAuth({
        req,
        action: "account_activated",
        userId: user.id,
        email: user.email,
        metadata: { method: "activation_token" },
      });

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

  // Create user (superadmin or admin)
  app.post("/api/users", requireActiveCompany, async (req: Request, res: Response) => {
    const currentUser = req.user!;

    if (currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const userData = insertUserSchema.parse(req.body);
      
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

      // Hash password before creating user (if provided)
      const hashedPassword = userData.password ? await hashPassword(userData.password) : undefined;
      const newUser = await storage.createUser({ ...userData, password: hashedPassword });
      
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
      
      const { password, ...sanitizedUser } = newUser;
      res.json({ user: sanitizedUser });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Update user (superadmin or admin)
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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

      const updatedUser = await storage.updateUser(req.params.id, validatedData);
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
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Delete user (superadmin or admin)
  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
      });

      // Generate secure activation token (random 32-byte hex string)
      const crypto = await import('crypto');
      const activationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Save activation token
      await storage.createActivationToken({
        userId: adminUser.id,
        token: activationToken,
        expiresAt,
        used: false,
      });

      // Send activation email using template
      const activationLink = `${req.protocol}://${req.get('host')}/activate-account?token=${activationToken}`;
      
      try {
        // Get activation email template from database
        const template = await storage.getEmailTemplateBySlug("account-activation");
        if (!template) {
          throw new Error("Activation email template not found");
        }
        
        // Replace variables in template
        let htmlContent = template.htmlContent
          .replace(/\{\{firstName\}\}/g, adminData.firstName || 'there')
          .replace(/\{\{company_name\}\}/g, newCompany.name)
          .replace(/\{\{activation_link\}\}/g, activationLink);
        
        let textContent = template.textContent
          ?.replace(/\{\{firstName\}\}/g, adminData.firstName || 'there')
          ?.replace(/\{\{company_name\}\}/g, newCompany.name)
          ?.replace(/\{\{activation_link\}\}/g, activationLink);
        
        await emailService.sendEmail({
          to: adminData.email,
          subject: template.subject,
          html: htmlContent,
          text: textContent,
        });
        
        console.log(`Email sent successfully to ${adminData.email}`);
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError);
        // Continue anyway - user can request a new activation link later
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
      
      res.json({ 
        company: newCompany,
        admin: sanitizedAdmin 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid request" });
    }
  });

  // Update company
  app.patch("/api/companies/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.delete("/api/companies/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Get company details before deletion for logging
    const company = await storage.getCompany(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

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
      },
    });

    res.json({ success: true });
  });

  // Toggle company active status (enable/disable)
  app.patch("/api/companies/:id/toggle-status", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.get("/api/settings/company", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.patch("/api/settings/company", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.patch("/api/settings/profile", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    try {
      // Only allow updating own profile fields (not role, companyId, password, etc.)
      const allowedFields = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
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

      const updatedUser = await storage.updateUser(req.session.userId, validatedData);
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
  app.get("/api/settings/preferences", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Return user preferences (email notifications, theme, etc.)
    res.json({
      preferences: {
        emailNotifications: true, // Default or from user settings
        marketingEmails: false,
        theme: "light",
      }
    });
  });

  // Update user preferences
  app.patch("/api/settings/preferences", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    try {
      // Store preferences (you could add a preferences column to users table or separate table)
      res.json({ 
        success: true,
        preferences: req.body 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // ===================================================================
  // PLANS MANAGEMENT (Superadmin only)
  // ===================================================================

  // Get all plans
  app.get("/api/plans", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Superadmins see all plans, others see only active plans
    const plans = currentUser.role === "superadmin" 
      ? await storage.getAllPlans()
      : await storage.getActivePlans();
    
    res.json({ plans });
  });

  // Get plan by ID
  app.get("/api/plans/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const plan = await storage.getPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.json({ plan });
  });

  // Create plan (superadmin only)
  app.post("/api/plans", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.patch("/api/plans/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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

  // Delete plan (superadmin only)
  app.delete("/api/plans/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const success = await storage.deletePlan(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.json({ success: true });
  });

  // ===================================================================
  // INVOICES & PAYMENTS
  // ===================================================================

  // Get invoices (scoped by company for non-superadmins)
  app.get("/api/invoices", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Superadmins need companyId query param, others use their company
    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    const invoices = await storage.getInvoicesByCompany(companyId);
    res.json({ invoices });
  });

  // Get invoice by ID
  app.get("/api/invoices/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.get("/api/payments", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.get("/api/subscription", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const companyId = currentUser.role === "superadmin" 
      ? req.query.companyId as string
      : currentUser.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID required" });
    }

    const subscription = await storage.getSubscriptionByCompany(companyId);
    res.json({ subscription });
  });

  // Create checkout session
  app.post("/api/checkout", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.post("/api/subscription/cancel", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  // STRIPE WEBHOOKS
  // ===================================================================

  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ message: "No signature" });
    }

    try {
      const { stripe } = await import("./stripe");
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );

      const {
        handleSubscriptionCreated,
        handleSubscriptionUpdated,
        handleSubscriptionDeleted,
        syncInvoiceFromStripe,
      } = await import("./stripe");

      switch (event.type) {
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.paid':
        case 'invoice.payment_succeeded':
          await syncInvoiceFromStripe(event.data.object.id);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================================
  // EMAIL & NOTIFICATIONS ENDPOINTS
  // =====================================================

  // Test email connection
  app.get("/api/email/test", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.post("/api/email/send-test", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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

  // Get user notifications
  app.get("/api/notifications", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const notifications = await storage.getNotificationsByUser(req.session.userId, limit);
      res.json({ notifications });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Create notification (with optional email)
  app.post("/api/notifications", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.role !== "admin")) {
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
  app.patch("/api/notifications/:id/read", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

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
  app.post("/api/notifications/mark-all-read", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      await storage.markAllNotificationsAsRead(req.session.userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // ==================== EMAIL TEMPLATES ENDPOINTS ====================

  // Get all email templates (superadmin only)
  app.get("/api/email-templates", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.get("/api/email-templates/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.post("/api/email-templates", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.put("/api/email-templates/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.delete("/api/email-templates/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.get("/api/features", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.post("/api/features", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.patch("/api/features/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.delete("/api/features/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.get("/api/companies/:companyId/features", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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
  app.post("/api/companies/:companyId/features", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.delete("/api/companies/:companyId/features/:featureId", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
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
  app.get("/api/audit-logs", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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

  const httpServer = createServer(app);

  return httpServer;
}
