import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import "./stripe"; // Force Stripe initialization to show which mode we're using

const app = express();

// Stripe webhook needs raw body for signature verification
// We parse all other routes as JSON
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Raw body for Stripe webhook only
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser()); // Required to read cookies like 'trusted_device'

// Configure PostgreSQL session store for persistent sessions
const PgStore = connectPgSimple(session);

// Create PgStore with error handling
const pgStore = new PgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 60, // 1 hour in seconds
  errorLog: (error: Error) => {
    // Only log actual errors with messages
    if (error && error.message) {
      console.error('Session store error:', error.message);
    }
  },
});

app.use(
  session({
    store: pgStore,
    secret: process.env.SESSION_SECRET || "curbe-admin-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      // maxAge is set dynamically in /api/auth/verify-otp based on "remember device" preference
      // Default: 7 days, Extended: 30 days when user selects "Remember this device"
      sameSite: "strict", // Changed to "strict" for Safari compatibility
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
