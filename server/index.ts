import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import connectPgSimple from "connect-pg-simple";
import crypto from "crypto";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import "./stripe"; // Force Stripe initialization to show which mode we're using
import { startReminderScheduler } from "./reminder-scheduler";
import { startBirthdayScheduler } from "./birthday-scheduler";
import { startImessageCampaignProcessor } from "./imessage-campaign-processor";
import { startBounceProcessor } from "./bounce-processor";
import { startMonthlyBillingScheduler } from "./monthly-billing-scheduler";
import { startPaymentReminderScheduler } from "./payment-reminder-scheduler";
import { seedCampaignStudioData } from "./scripts/seedCampaignStudio";
import { startSesQueueScheduler } from "./ses-queue-scheduler";
import { startAllWorkers as startWhatsAppWorkers } from "./services/whatsapp-workers";

// Handle unhandled promise rejections to prevent server crashes
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[Server] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Server] Uncaught exception:', error);
  // Exit for critical errors
  if (!error.message?.includes('ECONNRESET') && 
      !error.message?.includes('ETIMEDOUT') &&
      !error.message?.includes('socket hang up')) {
    process.exit(1);
  }
});

// Derive SESSION_SECRET from SECRETS_MASTER_KEY to reduce required env vars
// This way only DATABASE_URL and SECRETS_MASTER_KEY are needed
function getSessionSecret(): string {
  // First check if SESSION_SECRET is explicitly set (for backward compatibility)
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  
  // Derive from SECRETS_MASTER_KEY using HMAC
  const masterKey = process.env.SECRETS_MASTER_KEY;
  if (!masterKey) {
    throw new Error('CRITICAL: SECRETS_MASTER_KEY environment variable must be set. This is required for encryption and session security.');
  }
  
  // Use HMAC-SHA256 to derive a session secret from the master key
  const derivedSecret = crypto.createHmac('sha256', masterKey)
    .update('session-secret-derivation')
    .digest('hex');
  
  console.log('SESSION_SECRET derived from SECRETS_MASTER_KEY');
  return derivedSecret;
}

const SESSION_SECRET = getSessionSecret();

const app = express();

// Trust proxy to get real client IP (required when behind Replit proxy)
app.set('trust proxy', true);

// Webhooks need raw body for signature verification
// We parse all other routes as JSON
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe' || req.originalUrl === '/webhooks/telnyx' || req.originalUrl === '/api/webhooks/meta/whatsapp') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Raw body for webhook signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use('/webhooks/telnyx', express.raw({ type: 'application/json' }));
app.use('/api/webhooks/meta/whatsapp', express.raw({ type: 'application/json' }));

app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser()); // Required to read cookies like 'trusted_device'

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Serve public static files (recording announcements, etc.)
app.use('/public', express.static('public'));

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
    secret: SESSION_SECRET,
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
  const server = await registerRoutes(app, pgStore);

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
    
    // Seed Campaign Studio system data on first run
    seedCampaignStudioData().catch((error) => {
      console.error("Error seeding Campaign Studio data:", error);
    });
    
    // Auto-backfill contacts from existing policies/quotes on first run
    import("./services/contact-registry").then(({ contactRegistry }) => {
      contactRegistry.autoBackfillOnStartup().catch((error) => {
        console.error("Error during contact auto-backfill:", error);
      });
    }).catch((error) => {
      console.error("Error importing contact registry:", error);
    });
    
    // Start the reminder scheduler for snoozed reminders
    startReminderScheduler();
    
    // Start the birthday scheduler for automated birthday greetings
    startBirthdayScheduler();
    
    // Start the iMessage campaign processor for automated campaign message delivery
    startImessageCampaignProcessor();
    
    // Bounce email processor disabled - using AWS SES webhooks for bounce handling instead
    // startBounceProcessor();
    
    // Start the monthly billing scheduler for telephony fees
    startMonthlyBillingScheduler();
    
    // Start the payment reminder scheduler for proactive collection alerts
    startPaymentReminderScheduler();
    // Start the SES email queue scheduler
    startSesQueueScheduler();
    
    
    // Start WhatsApp webhook and send workers for async processing
    startWhatsAppWorkers();
    
    // Test email service on startup
    import("./email").then(({ emailService }) => {
      emailService.verifyConnection().then((connected) => {
        if (connected) {
          console.log("[EMAIL] Email service connected successfully on startup");
        } else {
          console.warn("[EMAIL] Email service NOT configured or connection failed - emails will not be sent");
        }
      }).catch((error) => {
        console.error("[EMAIL] Error testing email connection:", error);
      });
    }).catch((error) => {
      console.error("[EMAIL] Error importing email service:", error);
    });
    
  });
})();
