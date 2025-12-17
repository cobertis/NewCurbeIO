import { PKPass } from "passkit-generator";
import { db } from "../db";
import { vipPassDesigns, vipPassInstances, companies, contacts, pushSubscriptions, vipPassNotifications } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import path from "path";
import fs from "fs";

interface PassField {
  key: string;
  label: string;
  value: string;
}

const getWWDRCertificate = (): string | undefined => {
  const wwdrPath = path.join(process.cwd(), "certificates", "wwdr.pem");
  if (fs.existsSync(wwdrPath)) {
    return fs.readFileSync(wwdrPath, "utf-8");
  }
  return undefined;
};

// Generate a simple default icon PNG (29x29 black square with white border)
const generateDefaultIcon = (): Buffer => {
  // Minimal valid PNG - 29x29 solid color (black with slight gradient effect)
  // This is a pre-generated minimal PNG for fallback
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABWSURBVEiJ7c4xDQAwDMOweNqfZ1s4BlQWCRKCi/8eCFdVr8fRTgQAAAAA4J9reyoAAAAAAB/b9lQAAAAAwIfW9lQAAAAA8K21PRUAAAAA8K21PRUAAADgEweBLgHx7xlqzgAAAABJRU5ErkJggg==";
  return Buffer.from(pngBase64, "base64");
};

const generateDefaultLogo = (): Buffer => {
  // Minimal valid PNG - 160x50 size for logo
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAKAAAAAwCAYAAABJX6iWAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABDSURBVHic7cEBAQAAAIIg/69uSEABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANwMHV0AAT5ZxhgAAAAASUVORK5CYII=";
  return Buffer.from(pngBase64, "base64");
};

export class VipPassService {
  async getPassDesign(companyId: string) {
    const [design] = await db
      .select()
      .from(vipPassDesigns)
      .where(
        and(
          eq(vipPassDesigns.companyId, companyId),
          eq(vipPassDesigns.isActive, true)
        )
      )
      .limit(1);
    
    return design;
  }

  async upsertPassDesign(companyId: string, designData: {
    passName?: string;
    passDescription?: string;
    logoText?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    labelColor?: string;
    primaryFields?: PassField[];
    secondaryFields?: PassField[];
    auxiliaryFields?: PassField[];
    backFields?: PassField[];
    iconUrl?: string;
    logoUrl?: string;
    stripUrl?: string;
    backgroundUrl?: string;
    passTypeIdentifier?: string;
    teamIdentifier?: string;
    passStyle?: string;
    barcodeFormat?: string;
    barcodeMessage?: string;
  }) {
    const existingDesign = await this.getPassDesign(companyId);
    
    const now = new Date();
    const data = {
      companyId,
      passName: designData.passName || "VIP Gold Pass",
      passDescription: designData.passDescription || "VIP Member Pass",
      logoText: designData.logoText || "VIP GOLD",
      backgroundColor: designData.backgroundColor || "rgb(0,0,0)",
      foregroundColor: designData.foregroundColor || "rgb(255,255,255)",
      labelColor: designData.labelColor || "rgb(200,200,200)",
      primaryFields: designData.primaryFields ? JSON.stringify(designData.primaryFields) : null,
      secondaryFields: designData.secondaryFields ? JSON.stringify(designData.secondaryFields) : null,
      auxiliaryFields: designData.auxiliaryFields ? JSON.stringify(designData.auxiliaryFields) : null,
      backFields: designData.backFields ? JSON.stringify(designData.backFields) : null,
      iconUrl: designData.iconUrl,
      logoUrl: designData.logoUrl,
      stripUrl: designData.stripUrl,
      backgroundUrl: designData.backgroundUrl,
      passTypeIdentifier: designData.passTypeIdentifier,
      teamIdentifier: designData.teamIdentifier,
      passStyle: designData.passStyle || "generic",
      barcodeFormat: designData.barcodeFormat || "PKBarcodeFormatQR",
      barcodeMessage: designData.barcodeMessage || "{{serialNumber}}",
      isActive: true,
      updatedAt: now,
    };

    if (existingDesign) {
      await db
        .update(vipPassDesigns)
        .set(data)
        .where(eq(vipPassDesigns.id, existingDesign.id));
      return { ...existingDesign, ...data };
    } else {
      const id = crypto.randomUUID();
      await db.insert(vipPassDesigns).values({
        id,
        ...data,
        createdAt: now,
      });
      return { id, ...data, createdAt: now };
    }
  }

  generateSerialNumber(companyId: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `VIP-${companyId.substring(0, 8).toUpperCase()}-${timestamp}-${random}`;
  }

  generateAuthToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  generateUniversalToken(): string {
    return crypto.randomBytes(16).toString("base64url");
  }

  async createPassInstance(companyId: string, data: {
    contactId?: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    memberId?: string;
    tierLevel?: string;
  }) {
    const design = await this.getPassDesign(companyId);
    if (!design) {
      throw new Error("No active VIP Pass design configured for this company");
    }

    const serialNumber = this.generateSerialNumber(companyId);
    const authenticationToken = this.generateAuthToken();
    const id = crypto.randomUUID();
    const now = new Date();

    let recipientName = data.recipientName;
    let recipientEmail = data.recipientEmail;
    let recipientPhone = data.recipientPhone;

    if (data.contactId && (!recipientName || !recipientEmail)) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, data.contactId))
        .limit(1);
      
      if (contact) {
        recipientName = recipientName || `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
        recipientEmail = recipientEmail || contact.email || undefined;
        recipientPhone = recipientPhone || contact.phoneNormalized || undefined;
      }
    }

    const universalToken = this.generateUniversalToken();
    
    await db.insert(vipPassInstances).values({
      id,
      companyId,
      designId: design.id,
      serialNumber,
      authenticationToken,
      universalToken,
      contactId: data.contactId || null,
      recipientName: recipientName || null,
      recipientEmail: recipientEmail || null,
      recipientPhone: recipientPhone || null,
      memberId: data.memberId || serialNumber,
      tierLevel: data.tierLevel || "Gold",
      status: "active",
      downloadCount: 0,
      appleDownloads: 0,
      googleDownloads: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Generate Google Wallet URL asynchronously (don't block pass creation)
    this.generateGoogleWalletUrl(id, companyId).catch(err => {
      console.error("[VIP Pass] Error generating Google Wallet URL:", err);
    });

    return {
      id,
      serialNumber,
      authenticationToken,
      universalToken,
      designId: design.id,
    };
  }
  
  async generateGoogleWalletUrl(passInstanceId: string, companyId: string): Promise<string | null> {
    try {
      const { googleWalletService } = await import("./google-wallet-service");
      
      if (!googleWalletService.isConfigured()) {
        return null;
      }
      
      const googleWalletUrl = await googleWalletService.generateWalletUrl(passInstanceId, companyId);
      
      if (googleWalletUrl) {
        await db
          .update(vipPassInstances)
          .set({ googleWalletUrl })
          .where(eq(vipPassInstances.id, passInstanceId));
      }
      
      return googleWalletUrl;
    } catch (error) {
      console.error("[VIP Pass] Error generating Google Wallet URL:", error);
      return null;
    }
  }

  async getPassByUniversalToken(token: string) {
    const [instance] = await db
      .select()
      .from(vipPassInstances)
      .where(eq(vipPassInstances.universalToken, token))
      .limit(1);
    
    return instance;
  }

  async incrementAppleDownloads(passInstanceId: string) {
    await db
      .update(vipPassInstances)
      .set({ 
        appleDownloads: sql`${vipPassInstances.appleDownloads} + 1`,
        lastDownloadAt: new Date(),
        downloadCount: sql`${vipPassInstances.downloadCount} + 1`
      })
      .where(eq(vipPassInstances.id, passInstanceId));
  }

  async incrementGoogleDownloads(passInstanceId: string) {
    await db
      .update(vipPassInstances)
      .set({ 
        googleDownloads: sql`${vipPassInstances.googleDownloads} + 1`,
        lastDownloadAt: new Date(),
        downloadCount: sql`${vipPassInstances.downloadCount} + 1`
      })
      .where(eq(vipPassInstances.id, passInstanceId));
  }

  async getPassInstanceBySerialNumber(serialNumber: string) {
    const [instance] = await db
      .select()
      .from(vipPassInstances)
      .where(eq(vipPassInstances.serialNumber, serialNumber))
      .limit(1);
    
    return instance;
  }

  async getPassInstanceById(passInstanceId: string, companyId?: string) {
    const conditions = [eq(vipPassInstances.id, passInstanceId)];
    if (companyId) {
      conditions.push(eq(vipPassInstances.companyId, companyId));
    }
    const [instance] = await db
      .select()
      .from(vipPassInstances)
      .where(and(...conditions))
      .limit(1);
    
    return instance;
  }

  async getPassInstances(companyId: string) {
    const instances = await db
      .select()
      .from(vipPassInstances)
      .where(eq(vipPassInstances.companyId, companyId))
      .orderBy(desc(vipPassInstances.createdAt));
    
    // Get push subscription info and notification counts for each instance
    const instancesWithDetails = await Promise.all(
      instances.map(async (instance) => {
        // Get push subscription count and earliest subscription date
        const subs = await db
          .select({ 
            count: sql<number>`count(*)::int`,
            earliestDate: sql<string>`min(created_at)::text`
          })
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.passInstanceId, instance.id));
        
        // Get notification count for this pass
        const notifications = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(vipPassNotifications)
          .where(eq(vipPassNotifications.passInstanceId, instance.id));
        
        return {
          ...instance,
          pushSubscriptionCount: subs[0]?.count || 0,
          pushEnabledAt: subs[0]?.earliestDate || null,
          notificationCount: notifications[0]?.count || 0,
        };
      })
    );
    
    return instancesWithDetails;
  }

  async incrementDownloadCount(passInstanceId: string) {
    const [instance] = await db
      .select()
      .from(vipPassInstances)
      .where(eq(vipPassInstances.id, passInstanceId))
      .limit(1);
    
    if (instance) {
      await db
        .update(vipPassInstances)
        .set({
          downloadCount: instance.downloadCount + 1,
          lastDownloadAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(vipPassInstances.id, passInstanceId));
    }
  }

  async generatePkpassFile(passInstanceId: string, companyId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const instance = await this.getPassInstanceById(passInstanceId, companyId);
    
    if (!instance) {
      throw new Error("Pass instance not found");
    }

    const [design] = await db
      .select()
      .from(vipPassDesigns)
      .where(eq(vipPassDesigns.id, instance.designId))
      .limit(1);
    
    if (!design) {
      throw new Error("Pass design not found");
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, instance.companyId))
      .limit(1);

    const primaryFields = design.primaryFields ? JSON.parse(design.primaryFields) : [];
    const secondaryFields = design.secondaryFields ? JSON.parse(design.secondaryFields) : [];
    const auxiliaryFields = design.auxiliaryFields ? JSON.parse(design.auxiliaryFields) : [];
    const backFields = design.backFields ? JSON.parse(design.backFields) : [];

    const replaceVariables = (value: string): string => {
      return value
        .replace(/\{\{serialNumber\}\}/g, instance.serialNumber)
        .replace(/\{\{memberId\}\}/g, instance.memberId || instance.serialNumber)
        .replace(/\{\{recipientName\}\}/g, instance.recipientName || "VIP Member")
        .replace(/\{\{tierLevel\}\}/g, instance.tierLevel || "Gold")
        .replace(/\{\{companyName\}\}/g, company?.name || "");
    };

    const processFields = (fields: PassField[]): PassField[] => {
      return fields.map(field => ({
        ...field,
        value: replaceVariables(field.value),
      }));
    };

    const passJson: Record<string, unknown> = {
      formatVersion: 1,
      passTypeIdentifier: design.passTypeIdentifier || "pass.com.example.vip",
      teamIdentifier: design.teamIdentifier || "TEAM_ID",
      serialNumber: instance.serialNumber,
      authenticationToken: instance.authenticationToken,
      organizationName: company?.name || "VIP Pass",
      description: design.passDescription,
      logoText: design.logoText,
      foregroundColor: design.foregroundColor,
      backgroundColor: design.backgroundColor,
      labelColor: design.labelColor,
    };

    if (design.barcodeFormat) {
      const barcodeMessage = replaceVariables(design.barcodeMessage || instance.serialNumber);
      passJson.barcodes = [{
        format: design.barcodeFormat,
        message: barcodeMessage,
        messageEncoding: "iso-8859-1",
      }];
      passJson.barcode = {
        format: design.barcodeFormat,
        message: barcodeMessage,
        messageEncoding: "iso-8859-1",
      };
    }

    const styleKey = design.passStyle || "generic";
    const styleData: Record<string, unknown> = {};

    const defaultPrimaryFields = primaryFields.length > 0 ? processFields(primaryFields) : [
      { key: "member", label: "Member ID", value: instance.memberId || instance.serialNumber }
    ];
    const defaultAuxiliaryFields = auxiliaryFields.length > 0 ? processFields(auxiliaryFields) : [
      { key: "tier", label: "Tier", value: instance.tierLevel || "Gold" },
      { key: "name", label: "Name", value: instance.recipientName || "VIP Member" }
    ];

    styleData.primaryFields = defaultPrimaryFields;
    
    if (secondaryFields.length > 0) {
      styleData.secondaryFields = processFields(secondaryFields);
    }
    
    styleData.auxiliaryFields = defaultAuxiliaryFields;
    
    if (backFields.length > 0) {
      styleData.backFields = processFields(backFields);
    } else {
      styleData.backFields = [
        { key: "info", label: "VIP Benefits", value: "Priority customer service\nExclusive updates\nFast-lane handling" }
      ];
    }

    passJson[styleKey] = styleData;
    
    // Explicitly set pass type for passkit-generator
    passJson.type = styleKey;

    // Load certificates from database (in-memory only, never stored on filesystem)
    const wwdrCert = getWWDRCertificate();
    if (!wwdrCert) {
      throw new Error(
        "Apple WWDR certificate not found. Please add wwdr.pem to the certificates folder. " +
        "Download it from https://www.apple.com/certificateauthority/"
      );
    }

    let certificates: { signerCert: string; signerKey: string; wwdr: string };
    
    // First try to load from database (preferred - secure storage)
    if (design.signerCertBase64 && design.signerKeyBase64) {
      // Decode Base64 certificates from database
      const signerCert = Buffer.from(design.signerCertBase64, "base64").toString("utf-8");
      const signerKey = Buffer.from(design.signerKeyBase64, "base64").toString("utf-8");
      
      certificates = {
        signerCert,
        signerKey,
        wwdr: wwdrCert,
      };
    } else {
      // Fallback to filesystem (legacy support or demo mode)
      const certPath = path.join(process.cwd(), "certificates", `company_${instance.companyId}`);
      const signerCertPath = path.join(certPath, "pass-cert.pem");
      const signerKeyPath = path.join(certPath, "pass-key.pem");
      
      const demoCertPath = path.join(process.cwd(), "certificates", "demo");
      const demoSignerCertPath = path.join(demoCertPath, "pass-cert.pem");
      const demoSignerKeyPath = path.join(demoCertPath, "pass-key.pem");
      
      if (fs.existsSync(signerCertPath) && fs.existsSync(signerKeyPath)) {
        certificates = {
          signerCert: fs.readFileSync(signerCertPath, "utf-8"),
          signerKey: fs.readFileSync(signerKeyPath, "utf-8"),
          wwdr: wwdrCert,
        };
      } else if (fs.existsSync(demoSignerCertPath) && fs.existsSync(demoSignerKeyPath)) {
        certificates = {
          signerCert: fs.readFileSync(demoSignerCertPath, "utf-8"),
          signerKey: fs.readFileSync(demoSignerKeyPath, "utf-8"),
          wwdr: wwdrCert,
        };
      } else {
        throw new Error(
          "Apple Wallet certificates not configured. Please upload your .p12 certificate in the Certificates tab " +
          "or add pass-cert.pem and pass-key.pem files to the certificates folder."
        );
      }
    }

    // Create pass bundle with image files
    const passBuffers: Record<string, Buffer> = {};
    
    // Use custom images from design if available, otherwise use defaults
    if (design.iconBase64) {
      const iconData = design.iconBase64.replace(/^data:image\/\w+;base64,/, "");
      const iconBuffer = Buffer.from(iconData, "base64");
      passBuffers["icon.png"] = iconBuffer;
      passBuffers["icon@2x.png"] = iconBuffer;
      passBuffers["icon@3x.png"] = iconBuffer;
    } else {
      const defaultIcon = generateDefaultIcon();
      passBuffers["icon.png"] = defaultIcon;
      passBuffers["icon@2x.png"] = defaultIcon;
      passBuffers["icon@3x.png"] = defaultIcon;
    }
    
    if (design.logoBase64) {
      const logoData = design.logoBase64.replace(/^data:image\/\w+;base64,/, "");
      const logoBuffer = Buffer.from(logoData, "base64");
      passBuffers["logo.png"] = logoBuffer;
      passBuffers["logo@2x.png"] = logoBuffer;
    } else {
      const defaultLogo = generateDefaultLogo();
      passBuffers["logo.png"] = defaultLogo;
      passBuffers["logo@2x.png"] = defaultLogo;
    }
    
    if (design.stripBase64) {
      const stripData = design.stripBase64.replace(/^data:image\/\w+;base64,/, "");
      const stripBuffer = Buffer.from(stripData, "base64");
      passBuffers["strip.png"] = stripBuffer;
      passBuffers["strip@2x.png"] = stripBuffer;
    }

    const pass = new PKPass(passBuffers, certificates, passJson);
    pass.type = styleKey as "boardingPass" | "coupon" | "eventTicket" | "generic" | "storeCard";
    const buffer = pass.getAsBuffer();
    
    await this.incrementDownloadCount(passInstanceId);

    return {
      buffer,
      filename: `vip_pass_${instance.serialNumber}.pkpass`,
    };
  }

  async revokePassInstance(passInstanceId: string, companyId?: string) {
    const instance = await this.getPassInstanceById(passInstanceId, companyId);
    if (!instance) {
      throw new Error("Pass instance not found");
    }
    
    await db
      .update(vipPassInstances)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(vipPassInstances.id, passInstanceId));
  }

  async deletePassInstance(passInstanceId: string, companyId?: string) {
    const instance = await this.getPassInstanceById(passInstanceId, companyId);
    if (!instance) {
      throw new Error("Pass instance not found");
    }
    
    await db
      .delete(vipPassInstances)
      .where(eq(vipPassInstances.id, passInstanceId));
  }
}

export const vipPassService = new VipPassService();
