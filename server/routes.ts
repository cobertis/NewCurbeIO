import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema } from "@shared/schema";
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
      },
    });
  });

  // Get stats (all authenticated users)
  app.get("/api/stats", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const allUsers = await storage.getAllUsers();
    const stats = {
      totalUsers: allUsers.length,
      adminCount: allUsers.filter(u => u.role === "admin").length,
      moderatorCount: allUsers.filter(u => u.role === "moderator").length,
      viewerCount: allUsers.filter(u => u.role === "viewer").length,
    };

    res.json(stats);
  });

  // Get all users (admin only)
  app.get("/api/users", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const allUsers = await storage.getAllUsers();
    
    const sanitizedUsers = allUsers.map(({ password, ...user }) => user);
    res.json({ users: sanitizedUsers });
  });

  // Create user (admin only)
  app.post("/api/users", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);
      const { password, ...sanitizedUser } = newUser;
      res.json({ user: sanitizedUser });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Update user (admin only)
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const updateSchema = insertUserSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
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

  // Delete user (admin only)
  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const success = await storage.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true });
  });

  const httpServer = createServer(app);

  return httpServer;
}
