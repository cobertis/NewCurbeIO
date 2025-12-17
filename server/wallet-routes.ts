import { Express, Request, Response } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { walletPassService } from "./services/wallet-pass-service";
import { appleWalletService } from "./services/apple-wallet-service";
import { googleWalletService } from "./services/google-wallet-service";
import { insertWalletMemberSchema } from "@shared/schema";

const passkitRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const smartLinkRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerWalletRoutes(app: Express, requireAuth: any, requireActiveCompany: any) {
  
  const getBaseUrl = (): string => {
    return process.env.BASE_URL || 
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");
  };

  const getDeviceInfo = (req: Request) => ({
    userAgent: req.headers["user-agent"],
    ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress,
    referrer: req.headers.referer,
  });

  app.get("/api/wallet/members", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const members = await walletPassService.listMembers(companyId);
      res.json(members);
    } catch (error) {
      console.error("[Wallet] Error listing members:", error);
      res.status(500).json({ message: "Failed to list members" });
    }
  });

  app.post("/api/wallet/members", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const data = insertWalletMemberSchema.parse({ ...req.body, companyId });
      const member = await walletPassService.createMember(data);
      res.status(201).json(member);
    } catch (error) {
      console.error("[Wallet] Error creating member:", error);
      res.status(500).json({ message: "Failed to create member" });
    }
  });

  const updateWalletMemberSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    tier: z.string().optional(),
    expiresAt: z.string().optional(),
  });

  app.get("/api/wallet/members/:id", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const member = await walletPassService.getMember(req.params.id);
      if (!member || member.companyId !== companyId) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error("[Wallet] Error getting member:", error);
      res.status(500).json({ message: "Failed to get member" });
    }
  });

  app.patch("/api/wallet/members/:id", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const existingMember = await walletPassService.getMember(req.params.id);
      if (!existingMember || existingMember.companyId !== companyId) {
        return res.status(404).json({ message: "Member not found" });
      }
      const validatedData = updateWalletMemberSchema.parse(req.body);
      const member = await walletPassService.updateMember(req.params.id, validatedData);
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("[Wallet] Error updating member:", error);
      res.status(500).json({ message: "Failed to update member" });
    }
  });

  app.delete("/api/wallet/members/:id", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const member = await walletPassService.getMember(req.params.id);
      if (!member || member.companyId !== companyId) {
        return res.status(404).json({ message: "Member not found" });
      }
      await walletPassService.deleteMember(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("[Wallet] Error deleting member:", error);
      res.status(500).json({ message: "Failed to delete member" });
    }
  });

  app.post("/api/wallet/members/:memberId/pass", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const member = await walletPassService.getMember(req.params.memberId);
      if (!member || member.companyId !== companyId) {
        return res.status(404).json({ message: "Member not found" });
      }

      let pass = await walletPassService.getPassByMember(member.id);
      if (!pass) {
        pass = await walletPassService.createPass({
          companyId,
          memberId: member.id,
          passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
          teamIdentifier: process.env.APPLE_TEAM_ID,
          webServiceUrl: `${getBaseUrl()}/api/passkit/v1`,
        });
      }

      let link = await walletPassService.getLinkByMember(member.id);
      if (!link) {
        link = await walletPassService.createLink({
          companyId,
          memberId: member.id,
          walletPassId: pass.id,
        });
      }

      res.json({ pass, link });
    } catch (error) {
      console.error("[Wallet] Error creating pass:", error);
      res.status(500).json({ message: "Failed to create pass" });
    }
  });

  app.post("/api/wallet/passes/:id/revoke", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const pass = await walletPassService.getPass(req.params.id);
      if (!pass || pass.companyId !== companyId) {
        return res.status(404).json({ message: "Pass not found" });
      }
      await walletPassService.revokePass(pass.id);
      if (pass.googleObjectId) {
        await googleWalletService.revokeObject(pass.googleObjectId);
      }
      res.json({ message: "Pass revoked" });
    } catch (error) {
      console.error("[Wallet] Error revoking pass:", error);
      res.status(500).json({ message: "Failed to revoke pass" });
    }
  });

  app.post("/api/wallet/passes/:id/regenerate", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const pass = await walletPassService.getPass(req.params.id);
      if (!pass || pass.companyId !== companyId) {
        return res.status(404).json({ message: "Pass not found" });
      }
      const newPass = await walletPassService.regeneratePass(pass.id);
      res.json(newPass);
    } catch (error) {
      console.error("[Wallet] Error regenerating pass:", error);
      res.status(500).json({ message: "Failed to regenerate pass" });
    }
  });

  app.get("/api/wallet/analytics", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;
      
      const summary = await walletPassService.getAnalyticsSummary(companyId, from, to);
      res.json(summary);
    } catch (error) {
      console.error("[Wallet] Error getting analytics:", error);
      res.status(500).json({ message: "Failed to get analytics" });
    }
  });

  app.get("/api/wallet/analytics/chart", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const days = parseInt(req.query.days as string) || 30;
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - days);
      
      const data = await walletPassService.getEventsByDay(companyId, from, to);
      res.json(data);
    } catch (error) {
      console.error("[Wallet] Error getting chart data:", error);
      res.status(500).json({ message: "Failed to get chart data" });
    }
  });

  app.get("/api/wallet/events", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const { memberId, type, from, to, limit, offset } = req.query;
      
      const events = await walletPassService.getEvents(companyId, {
        memberId: memberId as string,
        type: type as string,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json(events);
    } catch (error) {
      console.error("[Wallet] Error getting events:", error);
      res.status(500).json({ message: "Failed to get events" });
    }
  });

  app.get("/api/wallet/config", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const settings = await walletPassService.getWalletSettings(companyId);
      
      const appleConfigured = settings 
        ? !!(settings.appleTeamId && settings.applePassTypeIdentifier && settings.appleP12Base64)
        : appleWalletService.isConfigured();
      
      const googleConfigured = settings
        ? !!(settings.googleServiceAccountJsonBase64 && settings.googleIssuerId)
        : googleWalletService.isConfigured();
        
      res.json({ appleConfigured, googleConfigured });
    } catch (error) {
      console.error("[Wallet] Error getting config:", error);
      res.json({
        appleConfigured: appleWalletService.isConfigured(),
        googleConfigured: googleWalletService.isConfigured(),
      });
    }
  });

  app.get("/api/wallet/settings", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      const settings = await walletPassService.getWalletSettings(companyId);
      
      if (!settings) {
        return res.json({
          appleTeamId: "",
          applePassTypeIdentifier: "",
          appleP12Configured: false,
          appleP12PasswordConfigured: false,
          appleWwdrConfigured: false,
          googleServiceAccountConfigured: false,
          googleIssuerId: "",
          encryptionKeyConfigured: false,
        });
      }
      
      res.json({
        appleTeamId: settings.appleTeamId || "",
        applePassTypeIdentifier: settings.applePassTypeIdentifier || "",
        appleP12Configured: !!settings.appleP12Base64,
        appleP12PasswordConfigured: !!settings.appleP12Password,
        appleWwdrConfigured: !!settings.appleWwdrBase64,
        googleServiceAccountConfigured: !!settings.googleServiceAccountJsonBase64,
        googleIssuerId: settings.googleIssuerId || "",
        encryptionKeyConfigured: !!settings.encryptionKey,
      });
    } catch (error) {
      console.error("[Wallet] Error getting settings:", error);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.put("/api/wallet/settings", requireAuth, requireActiveCompany, async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).user.companyId;
      await walletPassService.saveWalletSettings(companyId, req.body);
      res.json({ message: "Settings saved", configured: true });
    } catch (error) {
      console.error("[Wallet] Error saving settings:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  app.get("/w/:slug", smartLinkRateLimiter, async (req: Request, res: Response) => {
    try {
      const link = await walletPassService.getLinkBySlug(req.params.slug);
      if (!link) {
        return res.status(404).send("Link not found");
      }

      const deviceInfo = getDeviceInfo(req);
      const os = walletPassService.detectOS(deviceInfo.userAgent);
      
      await walletPassService.logEvent(
        link.companyId,
        "link_open",
        deviceInfo,
        link.memberId,
        link.walletPassId || undefined
      );

      const member = await walletPassService.getMember(link.memberId);
      const pass = link.walletPassId ? await walletPassService.getPass(link.walletPassId) : null;
      
      if (!member) {
        return res.status(404).send("Member not found");
      }

      let googleSaveUrl = "";
      if (pass && googleWalletService.isConfigured()) {
        try {
          googleSaveUrl = await googleWalletService.generateSaveLink({ pass, member });
        } catch (e) {
          console.error("[Wallet] Google save link error:", e);
        }
      }

      const eventType = os === "ios" ? "ios_offer_view" : os === "android" ? "android_offer_view" : "desktop_offer_view";
      await walletPassService.logEvent(link.companyId, eventType, deviceInfo, link.memberId, link.walletPassId || undefined);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add to Wallet - ${member.fullName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .card h1 { font-size: 24px; margin-bottom: 8px; }
    .card .member-id { font-size: 14px; opacity: 0.7; margin-bottom: 24px; }
    .card .plan { 
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 32px;
    }
    .wallet-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .wallet-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .apple-btn { background: #000; color: #fff; }
    .google-btn { background: #fff; color: #000; }
    .wallet-btn svg { width: 24px; height: 24px; }
    .hidden { display: none; }
    .info { font-size: 12px; opacity: 0.6; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${member.fullName}</h1>
    <p class="member-id">Member ID: ${member.memberId}</p>
    <div class="plan">${member.plan || 'Standard'}</div>
    
    <a href="${getBaseUrl()}/w/${link.slug}/apple" class="wallet-btn apple-btn ${os === 'android' ? 'hidden' : ''}" id="apple-btn" data-testid="btn-apple-wallet">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      Add to Apple Wallet
    </a>
    
    ${googleSaveUrl ? `
    <a href="${getBaseUrl()}/w/${link.slug}/google" class="wallet-btn google-btn ${os === 'ios' ? 'hidden' : ''}" id="google-btn" data-testid="btn-google-wallet">
      <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Add to Google Wallet
    </a>` : ''}
    
    <p class="info">Add your member card to your phone's wallet for easy access.</p>
  </div>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("[Wallet] Smart link error:", error);
      res.status(500).send("An error occurred");
    }
  });

  app.get("/w/:slug/apple", smartLinkRateLimiter, async (req: Request, res: Response) => {
    try {
      const link = await walletPassService.getLinkBySlug(req.params.slug);
      if (!link || !link.walletPassId) {
        return res.status(404).send("Pass not found");
      }

      const pass = await walletPassService.getPass(link.walletPassId);
      const member = await walletPassService.getMember(link.memberId);
      
      if (!pass || !member || pass.appleStatus === "revoked") {
        return res.status(404).send("Pass not found or revoked");
      }

      if (!appleWalletService.isConfigured()) {
        return res.status(503).send("Apple Wallet not configured");
      }

      const deviceInfo = getDeviceInfo(req);
      await walletPassService.logEvent(link.companyId, "apple_pkpass_download", deviceInfo, link.memberId, pass.id);

      const pkpassBuffer = await appleWalletService.generatePass({
        pass,
        member,
        webServiceUrl: `${getBaseUrl()}/api/passkit/v1`,
      });

      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-Disposition", `attachment; filename="${member.memberId}.pkpass"`);
      res.send(pkpassBuffer);
    } catch (error) {
      console.error("[Wallet] Apple download error:", error);
      res.status(500).send("Failed to generate pass");
    }
  });

  app.get("/w/:slug/google", smartLinkRateLimiter, async (req: Request, res: Response) => {
    try {
      const link = await walletPassService.getLinkBySlug(req.params.slug);
      if (!link || !link.walletPassId) {
        return res.status(404).send("Pass not found");
      }

      const pass = await walletPassService.getPass(link.walletPassId);
      const member = await walletPassService.getMember(link.memberId);
      
      if (!pass || !member || pass.googleStatus === "revoked") {
        return res.status(404).send("Pass not found or revoked");
      }

      if (!googleWalletService.isConfigured()) {
        return res.status(503).send("Google Wallet not configured");
      }

      const deviceInfo = getDeviceInfo(req);
      await walletPassService.logEvent(link.companyId, "google_save_clicked", deviceInfo, link.memberId, pass.id);

      const googleSaveUrl = await googleWalletService.generateSaveLink({ pass, member });
      
      res.redirect(googleSaveUrl);
    } catch (error) {
      console.error("[Wallet] Google redirect error:", error);
      res.status(500).send("Failed to redirect to Google Wallet");
    }
  });

  app.get("/w/:slug/google/return", smartLinkRateLimiter, async (req: Request, res: Response) => {
    try {
      const link = await walletPassService.getLinkBySlug(req.params.slug);
      if (!link) {
        return res.status(404).send("Link not found");
      }

      const member = await walletPassService.getMember(link.memberId);
      const pass = link.walletPassId ? await walletPassService.getPass(link.walletPassId) : null;

      const deviceInfo = getDeviceInfo(req);
      await walletPassService.logEvent(link.companyId, "google_saved_confirmed", deviceInfo, link.memberId, link.walletPassId || undefined);

      if (pass) {
        await walletPassService.updatePassStatus(pass.id, undefined, "saved");
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Added to Google Wallet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: #34A853;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .success-icon svg {
      width: 40px;
      height: 40px;
      fill: white;
    }
    .card h1 { font-size: 24px; margin-bottom: 12px; }
    .card p { font-size: 16px; opacity: 0.8; margin-bottom: 24px; line-height: 1.5; }
    .member-name { 
      font-size: 18px;
      font-weight: 600;
      background: rgba(255,255,255,0.2);
      padding: 12px 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      display: inline-block;
    }
    .close-btn {
      display: inline-block;
      padding: 14px 32px;
      background: #fff;
      color: #1a1a2e;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .close-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div class="card" data-testid="google-return-card">
    <div class="success-icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <h1 data-testid="text-success-title">Added to Google Wallet!</h1>
    <p>Your member card has been saved to your Google Wallet and is ready to use.</p>
    <div class="member-name" data-testid="text-member-name">${member?.fullName || 'Member'}</div>
    <br><br>
    <a href="javascript:window.close()" class="close-btn" data-testid="btn-close">Close This Page</a>
  </div>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("[Wallet] Google return error:", error);
      res.status(500).send("An error occurred");
    }
  });

  app.get("/api/wallet/download/:slug", async (req: Request, res: Response) => {
    try {
      const link = await walletPassService.getLinkBySlug(req.params.slug);
      if (!link || !link.walletPassId) {
        return res.status(404).send("Pass not found");
      }

      const pass = await walletPassService.getPass(link.walletPassId);
      const member = await walletPassService.getMember(link.memberId);
      
      if (!pass || !member || pass.appleStatus === "revoked") {
        return res.status(404).send("Pass not found or revoked");
      }

      if (!appleWalletService.isConfigured()) {
        return res.status(503).send("Apple Wallet not configured");
      }

      const deviceInfo = getDeviceInfo(req);
      await walletPassService.logEvent(link.companyId, "apple_pkpass_download", deviceInfo, link.memberId, pass.id);

      const pkpassBuffer = await appleWalletService.generatePass({
        pass,
        member,
        webServiceUrl: `${getBaseUrl()}/api/passkit/v1`,
      });

      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-Disposition", `attachment; filename="${member.memberId}.pkpass"`);
      res.send(pkpassBuffer);
    } catch (error) {
      console.error("[Wallet] Download error:", error);
      res.status(500).send("Failed to generate pass");
    }
  });

  app.post("/api/wallet/track/google-click/:slug", async (req: Request, res: Response) => {
    try {
      const link = await walletPassService.getLinkBySlug(req.params.slug);
      if (link) {
        const deviceInfo = getDeviceInfo(req);
        await walletPassService.logEvent(link.companyId, "google_save_clicked", deviceInfo, link.memberId, link.walletPassId || undefined);
      }
      res.status(204).send();
    } catch (error) {
      res.status(204).send();
    }
  });

  app.post("/api/passkit/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber", passkitRateLimiter, async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;
      const authHeader = req.headers.authorization;
      
      if (!authHeader?.startsWith("ApplePass ")) {
        return res.status(401).send("Unauthorized");
      }
      
      const token = authHeader.slice(10);
      const pass = await walletPassService.getPassBySerial(serialNumber);
      
      if (!pass || !walletPassService.validateAuthToken(pass, token)) {
        return res.status(401).send("Unauthorized");
      }

      if (pass.appleStatus === "revoked") {
        return res.status(401).send("Pass revoked");
      }

      const pushToken = req.body?.pushToken;
      await walletPassService.registerDevice(pass.id, deviceLibraryIdentifier, pushToken);
      await walletPassService.updatePassStatus(pass.id, "installed");

      const deviceInfo = getDeviceInfo(req);
      await walletPassService.logEvent(pass.companyId, "apple_device_registered", deviceInfo, pass.memberId, pass.id, { deviceLibraryIdentifier });

      res.status(201).send();
    } catch (error) {
      console.error("[PassKit] Register error:", error);
      res.status(500).send("Registration failed");
    }
  });

  app.delete("/api/passkit/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber", passkitRateLimiter, async (req: Request, res: Response) => {
    try {
      const { deviceLibraryIdentifier, serialNumber } = req.params;
      const authHeader = req.headers.authorization;
      
      if (!authHeader?.startsWith("ApplePass ")) {
        return res.status(401).send("Unauthorized");
      }
      
      const token = authHeader.slice(10);
      const pass = await walletPassService.getPassBySerial(serialNumber);
      
      if (!pass || !walletPassService.validateAuthToken(pass, token)) {
        return res.status(401).send("Unauthorized");
      }

      await walletPassService.unregisterDevice(pass.id, deviceLibraryIdentifier);
      
      const deviceInfo = getDeviceInfo(req);
      await walletPassService.logEvent(pass.companyId, "apple_device_unregistered", deviceInfo, pass.memberId, pass.id, { deviceLibraryIdentifier });

      res.status(200).send();
    } catch (error) {
      console.error("[PassKit] Unregister error:", error);
      res.status(500).send("Unregistration failed");
    }
  });

  app.get("/api/passkit/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier", passkitRateLimiter, async (req: Request, res: Response) => {
    try {
      const { passesUpdatedSince } = req.query;
      res.json({ serialNumbers: [], lastUpdated: new Date().toISOString() });
    } catch (error) {
      console.error("[PassKit] List passes error:", error);
      res.status(500).send("Failed");
    }
  });

  app.get("/api/passkit/v1/passes/:passTypeIdentifier/:serialNumber", passkitRateLimiter, async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const authHeader = req.headers.authorization;
      
      if (!authHeader?.startsWith("ApplePass ")) {
        return res.status(401).send("Unauthorized");
      }
      
      const token = authHeader.slice(10);
      const result = await appleWalletService.getUpdatedPass(serialNumber);
      
      if (!result) {
        return res.status(404).send("Pass not found");
      }

      const pass = await walletPassService.getPassBySerial(serialNumber);
      if (pass) {
        const deviceInfo = getDeviceInfo(req);
        await walletPassService.logEvent(pass.companyId, "apple_pass_get", deviceInfo, pass.memberId, pass.id);
      }

      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Last-Modified", result.lastModified);
      res.send(result.pass);
    } catch (error) {
      console.error("[PassKit] Get pass error:", error);
      res.status(500).send("Failed to get pass");
    }
  });

  app.post("/api/passkit/v1/log", passkitRateLimiter, async (req: Request, res: Response) => {
    try {
      console.log("[PassKit] Log:", JSON.stringify(req.body));
      res.status(200).send();
    } catch (error) {
      res.status(200).send();
    }
  });
}
