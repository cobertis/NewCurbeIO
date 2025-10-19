import "express-session";
import type { User } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    pendingUserId?: string;
    deviceInfo?: string;
    ipAddress?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
