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
  if (req.originalUrl === '/api/webhooks/stripe' || req.originalUrl === '/webhooks/telnyx') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Raw body for webhook signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use('/webhooks/telnyx', express.raw({ type: 'application/json' }));

app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser()); // Required to read cookies like 'trusted_device'

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Widget embed script - served with correct content-type
// This is loaded by external websites via: <script src="https://app.curbe.io/widget-script.js" data-code="WIDGET_ID" defer></script>
app.get('/widget-script.js', (req, res) => {
  const scriptContent = `
(function() {
  'use strict';
  
  // Find the script tag to get the widget code
  var scripts = document.getElementsByTagName('script');
  var currentScript = null;
  
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.indexOf('widget-script.js') !== -1) {
      currentScript = scripts[i];
      break;
    }
  }
  
  if (!currentScript) {
    console.error('[CurbeWidget] Could not find widget script tag');
    return;
  }
  
  var widgetCode = currentScript.getAttribute('data-code');
  if (!widgetCode) {
    console.error('[CurbeWidget] Missing data-code attribute');
    return;
  }
  
  // Prevent double initialization
  if (window.__curbeWidgetInitialized) {
    return;
  }
  window.__curbeWidgetInitialized = true;
  
  // Size constants
  var BUTTON_SIZE = 80; // 56px button + padding
  var PANEL_WIDTH = 420;
  var PANEL_HEIGHT = 650;
  
  // Create iframe that contains everything (button + chat panel)
  var iframe = document.createElement('iframe');
  iframe.id = 'curbe-widget-iframe';
  iframe.src = 'https://app.curbe.io/widget/' + widgetCode;
  // Start with button-only size
  iframe.style.cssText = 'position: fixed; bottom: 0; right: 0; width: ' + BUTTON_SIZE + 'px; height: ' + BUTTON_SIZE + 'px; border: none; z-index: 2147483647; background: transparent;';
  iframe.allow = 'microphone; camera; geolocation';
  iframe.setAttribute('allowtransparency', 'true');
  document.body.appendChild(iframe);
  
  // Listen for messages from widget to resize iframe
  window.addEventListener('message', function(event) {
    // Verify origin in production
    if (event.data && event.data.type === 'curbe-widget-resize') {
      if (event.data.open) {
        // Expand for panel + button
        var isMobile = window.innerWidth < 480;
        if (isMobile) {
          iframe.style.width = '100vw';
          iframe.style.height = '100vh';
          iframe.style.bottom = '0';
          iframe.style.right = '0';
        } else {
          iframe.style.width = PANEL_WIDTH + 'px';
          iframe.style.height = PANEL_HEIGHT + 'px';
          iframe.style.maxWidth = '100vw';
          iframe.style.maxHeight = '100vh';
        }
      } else {
        // Shrink to button only
        iframe.style.width = BUTTON_SIZE + 'px';
        iframe.style.height = BUTTON_SIZE + 'px';
      }
    }
  });
  
  console.log('[CurbeWidget] Initialized with code:', widgetCode);
})();
`.trim();

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(scriptContent);
});

// Widget embed page - serves dedicated HTML that only renders the widget
// This is what gets loaded inside the iframe on external sites
app.get('/widget/:widgetId', (req, res, next) => {
  const { widgetId } = req.params;
  
  // Skip if this looks like an API call or asset request
  if (widgetId.includes('.')) {
    return next();
  }
  
  // Base styles for both dev and production
  const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: transparent !important; overflow: hidden; }
    #curbe-widget-root { position: fixed; inset: auto 24px 24px auto; z-index: 2147483647; background: transparent; width: auto; height: auto; }
  `;
  
  // In development, serve with Vite dev server scripts
  if (process.env.NODE_ENV !== 'production') {
    const embedHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Curbe Chat Widget</title>
    <style>${baseStyles}</style>
    <script type="module" src="/@vite/client"></script>
    <script type="module">
      import RefreshRuntime from "/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>
  </head>
  <body>
    <div id="curbe-widget-root"></div>
    <script>window.__CURBE_WIDGET_ID = "${widgetId}";</script>
    <script type="module" src="/src/embed/main.tsx"></script>
  </body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(embedHtml);
    return;
  }
  
  // In production, serve static embed HTML with injected widget ID
  const productionHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Curbe Chat Widget</title>
    <style>${baseStyles}</style>
    <script type="module" crossorigin src="/assets/embed.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/embed.css">
  </head>
  <body>
    <div id="curbe-widget-root"></div>
    <script>window.__CURBE_WIDGET_ID = "${widgetId}";</script>
  </body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(productionHtml);
});

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
    
    // Start the bounce email processor for handling bounced emails
    startBounceProcessor();
    
    // Start the monthly billing scheduler for telephony fees
    startMonthlyBillingScheduler();
    
    // Start the payment reminder scheduler for proactive collection alerts
    startPaymentReminderScheduler();
    // Start the SES email queue scheduler
    startSesQueueScheduler();
    
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
    
    // CRITICAL: Auto-repair SRTP settings and migrate to Call Control on startup
    // This fixes 488 "Not Acceptable Here" errors and USER_BUSY hangup issues
    import("./services/telephony-provisioning-service").then(({ telephonyProvisioningService }) => {
      import("./db").then(async ({ db }) => {
        const { telephonySettings } = await import("@shared/schema");
        const settings = await db.select().from(telephonySettings);
        for (const setting of settings) {
          // Skip settings without ownerUserId (user-scoping not configured yet)
          if (!setting.ownerUserId) {
            console.log(`[Startup Repair] Skipping company ${setting.companyId} - no ownerUserId set`);
            continue;
          }
          const userId = setting.ownerUserId; // Store in const for TypeScript narrowing
          if (setting.credentialConnectionId) {
            // SRTP Repair
            console.log(`[SRTP Repair] Checking SRTP for company ${setting.companyId}...`);
            telephonyProvisioningService.repairSrtpSettings(setting.companyId, userId).then((result) => {
              if (result.success) {
                console.log(`[SRTP Repair] Successfully disabled SRTP for company ${setting.companyId}`);
              } else {
                console.log(`[SRTP Repair] Could not repair SRTP for ${setting.companyId}: ${result.error}`);
              }
            }).catch((err) => console.error(`[SRTP Repair] Error:`, err));
            
            // SIP Forking Repair - enables ring-all for webphone + physical phones
            console.log(`[SIP Forking Repair] Enabling SIP Forking for company ${setting.companyId}...`);
            telephonyProvisioningService.repairSipForking(setting.companyId, userId).then((result) => {
              if (result.success) {
                console.log(`[SIP Forking Repair] Successfully enabled SIP Forking for company ${setting.companyId}`);
              } else {
                console.log(`[SIP Forking Repair] Could not enable for ${setting.companyId}: ${result.error}`);
              }
            }).catch((err) => console.error(`[SIP Forking Repair] Error:`, err));
            
            // CRITICAL: Auto-migrate to Call Control Application if not already done
            // This fixes USER_BUSY hangup issue by enabling Call Control API for proper call termination
            if (!setting.callControlAppId) {
              console.log(`[Call Control Migration] Company ${setting.companyId} needs migration to Call Control...`);
              telephonyProvisioningService.migrateToCallControl(setting.companyId, userId).then((result) => {
                if (result.success) {
                  console.log(`[Call Control Migration] Successfully migrated company ${setting.companyId} to Call Control App: ${result.callControlAppId}`);
                } else {
                  console.log(`[Call Control Migration] Could not migrate ${setting.companyId}: ${result.errors?.join(', ')}`);
                  // Fall back to Credential Connection routing repair
                  console.log(`[Routing Repair] Falling back to Credential Connection for ${setting.companyId}...`);
                  telephonyProvisioningService.repairPhoneNumberRouting(setting.companyId, userId).catch((err) => 
                    console.error(`[Routing Repair] Error:`, err)
                  );
                }
              }).catch((err) => {
                console.error(`[Call Control Migration] Error:`, err);
                // Fall back to Credential Connection routing repair
                telephonyProvisioningService.repairPhoneNumberRouting(setting.companyId, userId).catch((e) => 
                  console.error(`[Routing Repair] Error:`, e)
                );
              });
            } else {
              // Already has Call Control App - repair routing AND update webhook URL
              console.log(`[Routing Repair] Company ${setting.companyId} already has Call Control App, repairing...`);
              
              // First update the webhook URL to point to this server (critical for dev environments)
              const webhookBaseUrl = process.env.REPLIT_DEV_DOMAIN 
                ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                : 'https://app.curbe.io';
              
              import("./services/telnyx-managed-accounts").then(({ getCompanyManagedAccountId }) => {
                getCompanyManagedAccountId(setting.companyId).then((managedAccountId) => {
                  if (managedAccountId && setting.callControlAppId) {
                    console.log(`[Webhook URL Update] Updating Call Control App ${setting.callControlAppId} webhook to: ${webhookBaseUrl}`);
                    telephonyProvisioningService.updateCallControlAppWebhook(
                      managedAccountId,
                      setting.callControlAppId,
                      webhookBaseUrl,
                      setting.companyId
                    ).then((webhookResult) => {
                      if (webhookResult.success) {
                        console.log(`[Webhook URL Update] Successfully updated for company ${setting.companyId}`);
                      } else {
                        console.log(`[Webhook URL Update] Failed for ${setting.companyId}: ${webhookResult.error}`);
                      }
                    }).catch((err) => console.error(`[Webhook URL Update] Error:`, err));
                  }
                }).catch((err) => console.error(`[Webhook URL Update] Failed to get managed account:`, err));
              }).catch((err) => console.error(`[Webhook URL Update] Import error:`, err));
              
              // Then repair phone number routing
              telephonyProvisioningService.repairPhoneNumberRouting(setting.companyId, userId).then((result) => {
                if (result.success && result.repairedCount > 0) {
                  console.log(`[Routing Repair] Fixed ${result.repairedCount} phone number(s) for company ${setting.companyId}`);
                } else if (result.success) {
                  console.log(`[Routing Repair] Phone routing OK for company ${setting.companyId}`);
                } else {
                  console.log(`[Routing Repair] Could not repair for ${setting.companyId}: ${result.errors?.join(', ')}`);
                }
              }).catch((err) => console.error(`[Routing Repair] Error:`, err));
            }
          }
        }
      }).catch((err) => console.error(`[SRTP Repair] Error loading db:`, err));
    }).catch((err) => console.error(`[SRTP Repair] Error loading service:`, err));
  });
  
  // Repair Messaging Profile webhooks on startup (SMS/MMS inbound delivery)
  import("./services/telnyx-manager-service").then(({ repairMessagingProfileWebhooks }) => {
    repairMessagingProfileWebhooks().catch(err => 
      console.error("[Messaging Profile Repair] Error:", err)
    );
  }).catch(err => console.error("[Messaging Profile Repair] Import error:", err));
})();
