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
}> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  return {
    name: company?.name || "Company",
    logoUrl: company?.logo || undefined,
    primaryColor: "#1a1a2e",
    secondaryColor: "#ffffff",
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
    
    // Add generic pass fields
    passData.generic = {
      primaryFields: [
        {
          key: "memberName",
          label: "MEMBER",
          value: member.fullName,
        },
      ],
      secondaryFields: [
        {
          key: "memberId",
          label: "MEMBER ID",
          value: member.memberId,
        },
        {
          key: "plan",
          label: "PLAN",
          value: member.plan || "Standard",
        },
      ],
      auxiliaryFields: [
        {
          key: "memberSince",
          label: "MEMBER SINCE",
          value: member.memberSince ? new Date(member.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A",
        },
      ],
      backFields: [
        {
          key: "terms",
          label: "Terms & Conditions",
          value: `This pass is issued by ${branding.name}. For support, contact us through the app.`,
        },
      ],
    };
    
    passData.barcodes = [
      {
        format: "PKBarcodeFormatQR",
        message: member.memberId,
        messageEncoding: "iso-8859-1",
      },
    ];

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
    const logoPath = path.join(process.cwd(), "attached_assets", "pass-logo.png");
    const logo2xPath = path.join(process.cwd(), "attached_assets", "pass-logo@2x.png");

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

    const webServiceUrl = passRecord.webServiceUrl || process.env.BASE_URL || 
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000");

    const passBuffer = await this.generatePass({
      pass: passRecord,
      member,
      webServiceUrl: `${webServiceUrl}/api/passkit/v1`,
    });

    return {
      pass: passBuffer,
      lastModified: passRecord.updatedAt.toISOString(),
    };
  },
};

export default appleWalletService;
