import { PKPass } from "passkit-generator";
import { db } from "../db";
import { vipPassDesigns, vipPassInstances, companies, contacts, pushSubscriptions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
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

    await db.insert(vipPassInstances).values({
      id,
      companyId,
      designId: design.id,
      serialNumber,
      authenticationToken,
      contactId: data.contactId || null,
      recipientName: recipientName || null,
      recipientEmail: recipientEmail || null,
      recipientPhone: recipientPhone || null,
      memberId: data.memberId || serialNumber,
      tierLevel: data.tierLevel || "Gold",
      status: "active",
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      serialNumber,
      authenticationToken,
      designId: design.id,
    };
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
      .orderBy(vipPassInstances.createdAt);
    
    // Get push subscription counts for each instance
    const instancesWithPushCount = await Promise.all(
      instances.map(async (instance) => {
        const subs = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.passInstanceId, instance.id));
        
        return {
          ...instance,
          pushSubscriptionCount: subs[0]?.count || 0,
        };
      })
    );
    
    return instancesWithPushCount;
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

    const certPath = path.join(process.cwd(), "certificates", `company_${instance.companyId}`);
    const signerCertPath = path.join(certPath, "pass-cert.pem");
    const signerKeyPath = path.join(certPath, "pass-key.pem");
    
    const demoCertPath = path.join(process.cwd(), "certificates", "demo");
    const demoSignerCertPath = path.join(demoCertPath, "pass-cert.pem");
    const demoSignerKeyPath = path.join(demoCertPath, "pass-key.pem");
    
    const wwdrCert = getWWDRCertificate();
    if (!wwdrCert) {
      throw new Error(
        "Apple WWDR certificate not found. Please add wwdr.pem to the certificates folder. " +
        "Download it from https://www.apple.com/certificateauthority/"
      );
    }

    let certificates: { signerCert: string; signerKey: string; wwdr: string };
    
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
        "Apple Wallet certificates not configured. Please add your pass certificates to enable .pkpass generation. " +
        "Required files: pass-cert.pem, pass-key.pem, and wwdr.pem in the certificates folder."
      );
    }

    const pass = new PKPass({}, certificates, passJson);
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
