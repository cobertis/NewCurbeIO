import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword, verifyPassword } from "./auth";
import { 
  insertUserSchema, 
  loginSchema, 
  updateUserSchema, 
  insertCompanySchema, 
  updateCompanySchema,
  createCompanyWithAdminSchema,
  insertPlanSchema,
  updateCompanySettingsSchema
} from "@shared/schema";
import "./types";

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== AUTH ENDPOINTS ====================
  
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/session", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });
  });

  // ==================== STATS ENDPOINTS ====================

  app.get("/api/stats", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

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

  // ==================== USER ENDPOINTS ====================

  // Get all users (superadmin or admin)
  app.get("/api/users", async (req: Request, res: Response) => {
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
  app.post("/api/users", async (req: Request, res: Response) => {
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

      // Hash password before creating user
      const hashedPassword = await hashPassword(userData.password);
      const newUser = await storage.createUser({ ...userData, password: hashedPassword });
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
      const validatedData = updateUserSchema.parse(req.body);
      
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

    // admin can only delete users in their company
    if (currentUser.role === "admin") {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser || targetUser.companyId !== currentUser.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const success = await storage.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true });
  });

  // ==================== COMPANY ENDPOINTS (superadmin only) ====================

  // Get all companies
  app.get("/api/companies", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const companies = await storage.getAllCompanies();
    res.json({ companies });
  });

  // Create company with admin user
  app.post("/api/companies", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { company: companyData, admin: adminData } = createCompanyWithAdminSchema.parse(req.body);
      
      // Check if admin email already exists
      const existingUser = await storage.getUserByEmail(adminData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Admin email already exists" });
      }

      // Create company first
      const newCompany = await storage.createCompany(companyData);
      
      // Hash password before creating admin user
      const hashedPassword = await hashPassword(adminData.password);
      
      // Create admin user for the company
      const adminUser = await storage.createUser({
        email: adminData.email,
        password: hashedPassword,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: "admin",
        companyId: newCompany.id,
        isActive: true,
        emailVerified: false,
      });

      const { password, ...sanitizedAdmin } = adminUser;
      
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

    const success = await storage.deleteCompany(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ success: true });
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
      };

      // Validate email is not already taken by another user
      if (allowedFields.email && allowedFields.email !== user.email) {
        const existingUser = await storage.getUserByEmail(allowedFields.email);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const updatedUser = await storage.updateUser(req.session.userId, allowedFields);
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

  const httpServer = createServer(app);

  return httpServer;
}
