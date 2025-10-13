import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, updateUserSchema, insertOrganizationSchema, updateOrganizationSchema } from "@shared/schema";
import "./types";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(email);

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
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
        organizationId: user.organizationId,
      },
    });
  });

  // Get stats (all authenticated users)
  app.get("/api/stats", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    let users;
    if (currentUser.role === "superadmin") {
      users = await storage.getAllUsers();
    } else if (currentUser.organizationId) {
      users = await storage.getUsersByOrganization(currentUser.organizationId);
    } else {
      users = [];
    }

    const stats = {
      totalUsers: users.length,
      adminCount: users.filter(u => u.role === "superadmin" || u.role === "org_admin").length,
      moderatorCount: 0,
      viewerCount: users.filter(u => u.role === "org_user").length,
    };

    res.json(stats);
  });

  // Get all users (superadmin or org_admin)
  app.get("/api/users", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    if (currentUser.role !== "superadmin" && currentUser.role !== "org_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    let users;
    if (currentUser.role === "superadmin") {
      users = await storage.getAllUsers();
    } else if (currentUser.organizationId) {
      users = await storage.getUsersByOrganization(currentUser.organizationId);
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const sanitizedUsers = users.map(({ password, ...user }) => user);
    res.json({ users: sanitizedUsers });
  });

  // Create user (superadmin or org_admin)
  app.post("/api/users", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    if (currentUser.role !== "superadmin" && currentUser.role !== "org_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const userData = insertUserSchema.parse(req.body);
      
      // org_admin can only create users in their organization
      if (currentUser.role === "org_admin") {
        if (!currentUser.organizationId) {
          return res.status(403).json({ message: "Forbidden" });
        }
        userData.organizationId = currentUser.organizationId;
        if (userData.role === "superadmin") {
          return res.status(403).json({ message: "Cannot create superadmin" });
        }
      }

      const newUser = await storage.createUser(userData);
      const { password, ...sanitizedUser } = newUser;
      res.json({ user: sanitizedUser });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Update user (superadmin or org_admin)
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    if (currentUser.role !== "superadmin" && currentUser.role !== "org_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const validatedData = updateUserSchema.parse(req.body);
      
      // org_admin can only update users in their organization
      if (currentUser.role === "org_admin") {
        const targetUser = await storage.getUser(req.params.id);
        if (!targetUser || targetUser.organizationId !== currentUser.organizationId) {
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

  // Delete user (superadmin or org_admin)
  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    if (currentUser.role !== "superadmin" && currentUser.role !== "org_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // org_admin can only delete users in their organization
    if (currentUser.role === "org_admin") {
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser || targetUser.organizationId !== currentUser.organizationId) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const success = await storage.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true });
  });

  // ====== Organization Endpoints (superadmin only) ======

  // Get all organizations
  app.get("/api/organizations", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const organizations = await storage.getAllOrganizations();
    res.json({ organizations });
  });

  // Create organization
  app.post("/api/organizations", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const orgData = insertOrganizationSchema.parse(req.body);
      const newOrg = await storage.createOrganization(orgData);
      res.json({ organization: newOrg });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Update organization
  app.patch("/api/organizations/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const validatedData = updateOrganizationSchema.parse(req.body);
      const updatedOrg = await storage.updateOrganization(req.params.id, validatedData);
      if (!updatedOrg) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json({ organization: updatedOrg });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Delete organization
  app.delete("/api/organizations/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const success = await storage.deleteOrganization(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Organization not found" });
    }

    res.json({ success: true });
  });

  const httpServer = createServer(app);

  return httpServer;
}
