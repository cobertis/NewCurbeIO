import { PKPass } from "passkit-generator";
import path from "path";
import fs from "fs";
import forge from "node-forge";
import { WalletPass, WalletMember, WalletSettings } from "@shared/schema";
import { walletPassService } from "./wallet-pass-service";
import { db } from "../db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";

// Fallback environment variables for backward compatibility
const ENV_APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const ENV_APPLE_PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID;
const ENV_APPLE_P12_B64 = process.env.APPLE_P12_B64;
const ENV_APPLE_P12_PASSWORD = process.env.APPLE_P12_PASSWORD || "";
const ENV_APPLE_WWDR_B64 = process.env.APPLE_WWDR_B64;

// WWDR Certificate is global Apple infrastructure - not tenant-specific
// Priority: 1) ENV variable (backward compat) 2) Static file in server/certs/
const WWDR_CERT_PATH = path.join(process.cwd(), "server", "certs", "AppleWWDRCAG4.pem");
let WWDR_BUFFER: Buffer | null = null;

function getWwdrCertificate(): Buffer {
  if (!WWDR_BUFFER) {
    // First check environment variable for backward compatibility
    if (ENV_APPLE_WWDR_B64) {
      WWDR_BUFFER = Buffer.from(ENV_APPLE_WWDR_B64, "base64");
    } else if (fs.existsSync(WWDR_CERT_PATH)) {
      // Use static file as default
      WWDR_BUFFER = fs.readFileSync(WWDR_CERT_PATH);
    } else {
      throw new Error(`WWDR Certificate not found. Either set APPLE_WWDR_B64 env var or ensure ${WWDR_CERT_PATH} exists.`);
    }
  }
  return WWDR_BUFFER;
}

interface P12Credentials {
  signerCert: string;  // PEM certificate
  signerKey: string;   // PEM private key
}

function extractP12Credentials(p12Buffer: Buffer, password: string): P12Credentials {
  // Decode the P12/PKCS12 file
  const p12Der = forge.util.decode64(p12Buffer.toString("base64"));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || "");
  
  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag || certBag.length === 0 || !certBag[0].cert) {
    throw new Error("No certificate found in P12 file");
  }
  const cert = certBag[0].cert;
  const certPem = forge.pki.certificateToPem(cert);
  
  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag || keyBag.length === 0 || !keyBag[0].key) {
    throw new Error("No private key found in P12 file");
  }
  const key = keyBag[0].key;
  const keyPem = forge.pki.privateKeyToPem(key);
  
  return {
    signerCert: certPem,
    signerKey: keyPem,
  };
}

async function getCompanyBranding(companyId: string): Promise<{
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  phone?: string;
  website?: string;
  address?: string;
}> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  
  // Build full address from components
  let fullAddress = "";
  if (company) {
    const parts = [
      company.address,
      company.addressLine2,
      [company.city, company.state, company.postalCode].filter(Boolean).join(", "),
      company.country
    ].filter(Boolean);
    fullAddress = parts.join("\n");
  }
  
  return {
    name: company?.name || "Company",
    logoUrl: company?.logo || undefined,
    primaryColor: "#1a1a2e",
    secondaryColor: "#ffffff",
    phone: company?.phone || undefined,
    website: company?.website || undefined,
    address: fullAddress || undefined,
  };
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
  }
  return "rgb(26, 26, 46)";
}

export interface PassGenerationOptions {
  pass: WalletPass;
  member: WalletMember;
  webServiceUrl: string;
  settings?: WalletSettings;
}

export const appleWalletService = {
  isConfigured(): boolean {
    return !!(ENV_APPLE_TEAM_ID && ENV_APPLE_PASS_TYPE_ID && ENV_APPLE_P12_B64);
  },

  isConfiguredWithSettings(settings?: WalletSettings): boolean {
    if (settings) {
      return !!(settings.appleTeamId && settings.applePassTypeIdentifier && settings.appleP12Base64);
    }
    return this.isConfigured();
  },

  async generatePass(options: PassGenerationOptions): Promise<Buffer> {
    const { pass, member, webServiceUrl, settings } = options;

    const teamId = settings?.appleTeamId || ENV_APPLE_TEAM_ID;
    const passTypeId = settings?.applePassTypeIdentifier || ENV_APPLE_PASS_TYPE_ID;
    const p12B64 = settings?.appleP12Base64 || ENV_APPLE_P12_B64;
    const p12Password = settings?.appleP12Password || ENV_APPLE_P12_PASSWORD;

    if (!teamId || !passTypeId || !p12B64) {
      throw new Error("Apple Wallet is not configured. Missing required credentials.");
    }

    const encryptionKey = settings?.encryptionKey;
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error("Encryption key not configured. Please set it in Wallet Settings.");
    }

    const branding = await getCompanyBranding(pass.companyId);
    const authToken = walletPassService.getDecryptedAuthToken(pass, encryptionKey);

    const p12Buffer = Buffer.from(p12B64, "base64");
    
    // Extract certificate and private key from P12 file (convert to PEM format)
    const { signerCert, signerKey } = extractP12Credentials(p12Buffer, p12Password || "");
    
    // WWDR is a global Apple certificate, loaded from static infrastructure file
    const wwdrBuffer = getWwdrCertificate();

    const passData: Record<string, any> = {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      teamIdentifier: teamId,
      serialNumber: pass.serialNumber,
      authenticationToken: authToken,
      webServiceURL: webServiceUrl,
      organizationName: branding.name,
      description: `${branding.name} Member Card`,
      backgroundColor: hexToRgb(branding.primaryColor || "#1a1a2e"),
      foregroundColor: hexToRgb(branding.secondaryColor || "#ffffff"),
      labelColor: hexToRgb(branding.secondaryColor || "#ffffff"),
    };
    
    // PROACTIVE COLLECTION: "Cenicienta Strategy" - relevantDate at END of day (23:59)
    // This keeps the pass on lock screen ALL DAY as a pending deadline
    // If set to beginning of day, Apple considers it "old news" and hides it
    if (pass.lastNotification || member.paymentDay) {
      const now = new Date();
      const today = now.getDate();
      const paymentDay = member.paymentDay || today;
      
      let relevantDate = new Date();
      
      if (pass.lastNotification) {
        // Active alert - show for rest of TODAY (deadline: 23:59 tonight)
        relevantDate.setHours(23, 59, 0, 0);
      } else if (today === paymentDay) {
        // It's payment day - deadline at end of today
        relevantDate.setHours(23, 59, 0, 0);
      } else if (today < paymentDay) {
        // Payment day is later this month - deadline at end of that day
        relevantDate.setDate(paymentDay);
        relevantDate.setHours(23, 59, 0, 0);
      } else {
        // Payment day already passed, set for next month
        relevantDate.setMonth(relevantDate.getMonth() + 1);
        relevantDate.setDate(paymentDay);
        relevantDate.setHours(23, 59, 0, 0);
      }
      
      // Format with EST timezone offset (-05:00)
      const year = relevantDate.getFullYear();
      const month = String(relevantDate.getMonth() + 1).padStart(2, '0');
      const day = String(relevantDate.getDate()).padStart(2, '0');
      passData.relevantDate = `${year}-${month}-${day}T23:59:00-05:00`;
      
      console.log(`[Apple Wallet] Setting relevantDate DEADLINE: ${passData.relevantDate} for member ${member.memberId}`);
    }
    
    // MAXIMIZED READABILITY DESIGN
    // Short labels (≤6 chars), concise values = Apple renders LARGEST font
    // Keep front minimal, details go to back
    
    // Format premium as currency
    const fmtPremium = (p: string | null) => {
      if (!p) return "—";
      const n = parseFloat(p);
      return isNaN(n) ? p : `$${n.toFixed(0)}`;
    };
    
    // Truncate to 24 chars max for readability
    const truncate = (s: string | null, max = 24) => {
      if (!s) return "—";
      return s.length > max ? s.slice(0, max - 1) + "…" : s;
    };
    
    // Extract carrier short name (first word or acronym)
    const shortCarrier = (c: string | null) => {
      if (!c) return "—";
      // Common insurance carriers to abbreviate
      if (c.toLowerCase().includes("united")) return "UHC";
      if (c.toLowerCase().includes("blue cross")) return "BCBS";
      if (c.toLowerCase().includes("aetna")) return "Aetna";
      if (c.toLowerCase().includes("cigna")) return "Cigna";
      if (c.toLowerCase().includes("humana")) return "Humana";
      if (c.toLowerCase().includes("kaiser")) return "Kaiser";
      if (c.toLowerCase().includes("anthem")) return "Anthem";
      if (c.toLowerCase().includes("ambetter")) return "Ambetter";
      if (c.toLowerCase().includes("molina")) return "Molina";
      if (c.toLowerCase().includes("oscar")) return "Oscar";
      // Return first word if short enough
      const first = c.split(" ")[0];
      return first.length <= 12 ? first : c.slice(0, 10) + "…";
    };

    passData.storeCard = {
      // HEADER: Member ID (top right) - for quick identification
      headerFields: [
        {
          key: "mid",
          label: "MEMBER ID",
          value: member.memberId || "—",
          changeMessage: "%@",
        },
      ],
      // PRIMARY: Member name - LARGEST TEXT
      primaryFields: [
        {
          key: "name",
          label: "",
          value: member.fullName.toUpperCase(),
        },
      ],
      // SECONDARY: Carrier, Plan Name, Monthly Payment - main info line
      secondaryFields: [
        {
          key: "ins",
          label: "CARRIER",
          value: shortCarrier(member.carrierName),
        },
        {
          key: "pln",
          label: "PLAN",
          value: truncate(member.planName || member.plan, 18),
        },
        {
          key: "pmt",
          label: "MONTHLY",
          value: member.monthlyPremium ? `$${member.monthlyPremium}` : "—",
        },
      ],
      // AUXILIARY: Alert notification - only when active
      auxiliaryFields: pass.lastNotification ? [
        {
          key: "msg",
          label: "ALERT",
          value: truncate(pass.lastNotification, 50),
          changeMessage: "%@",
        },
      ] : [],
      // BACK: All complete details
      backFields: [
        {
          key: "b1",
          label: "Full Name",
          value: member.fullName,
        },
        {
          key: "b2",
          label: "Member ID",
          value: member.memberId,
        },
        {
          key: "b3",
          label: "Insurance Carrier",
          value: member.carrierName || "—",
        },
        {
          key: "b4",
          label: "Plan Name",
          value: member.planName || member.plan || "—",
        },
        {
          key: "b5",
          label: "Plan ID",
          value: member.planId || "—",
        },
        {
          key: "b6",
          label: "Monthly Premium",
          value: member.monthlyPremium ? `$${member.monthlyPremium}/mo` : "—",
        },
        {
          key: "b7",
          label: "Effective Date",
          value: member.effectiveDate ? new Date(member.effectiveDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "—",
        },
        {
          key: "b8",
          label: "Expiration Date",
          value: member.expirationDate ? new Date(member.expirationDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "—",
        },
        {
          key: "b9",
          label: "Last Notice",
          value: pass.lastNotification || "None",
        },
        {
          key: "b10",
          label: "Issued By",
          value: branding.name,
        },
        ...(branding.phone ? [{
          key: "b11",
          label: "Phone",
          value: branding.phone,
        }] : []),
        ...(branding.website ? [{
          key: "b12",
          label: "Website",
          value: branding.website,
        }] : []),
        ...(branding.address ? [{
          key: "b13",
          label: "Address",
          value: branding.address,
        }] : []),
      ],
    };
    
    // QR Code at the bottom with Member ID
    passData.barcodes = [
      {
        format: "PKBarcodeFormatQR",
        message: member.memberId,
        messageEncoding: "iso-8859-1",
        altText: `ID: ${member.memberId}`,
      },
    ];
    // Legacy barcode field for older iOS versions
    passData.barcode = {
      format: "PKBarcodeFormatQR",
      message: member.memberId,
      messageEncoding: "iso-8859-1",
      altText: `ID: ${member.memberId}`,
    };

    const certificates: any = {
      signerCert: signerCert,
      signerKey: signerKey,
      wwdr: wwdrBuffer,
    };

    // Build the template with pass.json as a buffer - this is REQUIRED for type detection
    // passkit-generator v3.5.6 reads the type from the template's pass.json, not from overrides
    const template: Record<string, Buffer> = {
      "pass.json": Buffer.from(JSON.stringify(passData)),
    };

    // Add images to the template if they exist
    const iconPath = path.join(process.cwd(), "attached_assets", "pass-icon.png");
    const icon2xPath = path.join(process.cwd(), "attached_assets", "pass-icon@2x.png");
    const stripPath = path.join(process.cwd(), "attached_assets", "strip.png");
    const strip2xPath = path.join(process.cwd(), "attached_assets", "strip@2x.png");
    
    // Dynamic carrier logo selection based on carrier name
    const carrierName = (member.carrierName || "").toLowerCase();
    let logoPath = path.join(process.cwd(), "attached_assets", "pass-logo.png");
    let logo2xPath = path.join(process.cwd(), "attached_assets", "pass-logo@2x.png");
    
    // Use carrier-specific logos when available
    if (carrierName.includes("ambetter")) {
      const ambetterLogoPath = path.join(process.cwd(), "attached_assets", "ambetter_1765960250992.png");
      if (fs.existsSync(ambetterLogoPath)) {
        logoPath = ambetterLogoPath;
        logo2xPath = ambetterLogoPath; // Use same image for @2x
      }
    }

    if (fs.existsSync(iconPath)) {
      template["icon.png"] = fs.readFileSync(iconPath);
    }
    if (fs.existsSync(icon2xPath)) {
      template["icon@2x.png"] = fs.readFileSync(icon2xPath);
    }
    if (fs.existsSync(logoPath)) {
      template["logo.png"] = fs.readFileSync(logoPath);
    }
    if (fs.existsSync(logo2xPath)) {
      template["logo@2x.png"] = fs.readFileSync(logo2xPath);
    }
    // Strip image for storeCard - appears at the top behind header/primary fields
    if (fs.existsSync(stripPath)) {
      template["strip.png"] = fs.readFileSync(stripPath);
    }
    if (fs.existsSync(strip2xPath)) {
      template["strip@2x.png"] = fs.readFileSync(strip2xPath);
    }

    // Create PKPass with template (containing pass.json) and certificates
    const pkpass = new PKPass(template, certificates);

    return pkpass.getAsBuffer();
  },

  async getUpdatedPass(serialNumber: string): Promise<{ pass: Buffer; lastModified: string } | null> {
    const passRecord = await walletPassService.getPassBySerial(serialNumber);
    if (!passRecord || passRecord.appleStatus === "revoked") {
      return null;
    }

    const member = await walletPassService.getMember(passRecord.memberId);
    if (!member) {
      return null;
    }

    // Get wallet settings for this company (contains certificates)
    const settings = await walletPassService.getWalletSettings(passRecord.companyId);
    if (!settings) {
      console.error("[PassKit] No wallet settings found for company:", passRecord.companyId);
      return null;
    }

    // passRecord.webServiceUrl already contains the full path including /api/passkit
    // Use stored webServiceUrl - it should always be set correctly when pass is created/updated
    const webServiceUrl = passRecord.webServiceUrl || "https://crm.cemscale.com/api/passkit";

    const passBuffer = await this.generatePass({
      pass: passRecord,
      member,
      webServiceUrl,
      settings,
    });

    return {
      pass: passBuffer,
      lastModified: passRecord.updatedAt.toISOString(),
    };
  },
};

export default appleWalletService;
