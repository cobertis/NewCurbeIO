import { GoogleAuth } from "google-auth-library";
import { WalletPass, WalletMember } from "@shared/schema";
import { db } from "../db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";

const GOOGLE_SERVICE_ACCOUNT_JSON_B64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
const GOOGLE_ISSUER_ID = process.env.GOOGLE_ISSUER_ID;

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let credentials: ServiceAccountCredentials | null = null;
let auth: GoogleAuth | null = null;

function initializeAuth(): void {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON_B64 || !GOOGLE_ISSUER_ID) {
    return;
  }

  try {
    const decoded = Buffer.from(GOOGLE_SERVICE_ACCOUNT_JSON_B64, "base64").toString("utf8");
    credentials = JSON.parse(decoded);
    
    auth = new GoogleAuth({
      credentials: credentials!,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
  } catch (error) {
    console.error("[Google Wallet] Failed to initialize:", error);
  }
}

initializeAuth();

async function getCompanyBranding(companyId: string): Promise<{
  name: string;
  logoUrl?: string;
  primaryColor: string;
}> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  return {
    name: company?.name || "Company",
    logoUrl: company?.logo || undefined,
    primaryColor: "#1a1a2e",
  };
}

async function makeApiRequest(method: string, endpoint: string, body?: any): Promise<any> {
  if (!auth) {
    throw new Error("Google Wallet not configured");
  }

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const response = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Wallet API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export interface GooglePassGenerationOptions {
  pass: WalletPass;
  member: WalletMember;
}

export const googleWalletService = {
  isConfigured(): boolean {
    return !!(GOOGLE_SERVICE_ACCOUNT_JSON_B64 && GOOGLE_ISSUER_ID && auth);
  },

  async ensureClassExists(companyId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Google Wallet is not configured");
    }

    const classId = `${GOOGLE_ISSUER_ID}.${companyId.replace(/-/g, "_")}`;
    const branding = await getCompanyBranding(companyId);

    const classObject = {
      id: classId,
      classTemplateInfo: {
        cardTemplateOverride: {
          cardRowTemplateInfos: [
            {
              twoItems: {
                startItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['member_id']" }],
                  },
                },
                endItem: {
                  firstValue: {
                    fields: [{ fieldPath: "object.textModulesData['plan']" }],
                  },
                },
              },
            },
          ],
        },
      },
      issuerName: branding.name,
      reviewStatus: "UNDER_REVIEW",
      hexBackgroundColor: branding.primaryColor || "#1a1a2e",
    };

    try {
      await makeApiRequest("GET", `genericClass/${classId}`);
      await makeApiRequest("PUT", `genericClass/${classId}`, classObject);
    } catch {
      await makeApiRequest("POST", "genericClass", classObject);
    }

    return classId;
  },

  async createObject(options: GooglePassGenerationOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Google Wallet is not configured");
    }

    const { pass, member } = options;
    const classId = await this.ensureClassExists(pass.companyId);
    const branding = await getCompanyBranding(pass.companyId);
    const objectId = `${GOOGLE_ISSUER_ID}.${pass.serialNumber}`;

    const genericObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      heroImage: branding.logoUrl ? {
        sourceUri: { uri: branding.logoUrl },
        contentDescription: { defaultValue: { language: "en-US", value: branding.name } },
      } : undefined,
      textModulesData: [
        { id: "member_id", header: "MEMBER ID", body: member.memberId },
        { id: "plan", header: "PLAN", body: member.plan || "Standard" },
        { id: "member_since", header: "MEMBER SINCE", body: member.memberSince 
          ? new Date(member.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" }) 
          : "N/A" },
      ],
      barcode: {
        type: "QR_CODE",
        value: member.memberId,
      },
      cardTitle: { defaultValue: { language: "en-US", value: branding.name } },
      header: { defaultValue: { language: "en-US", value: member.fullName } },
      hexBackgroundColor: branding.primaryColor || "#1a1a2e",
    };

    try {
      await makeApiRequest("GET", `genericObject/${objectId}`);
      await makeApiRequest("PUT", `genericObject/${objectId}`, genericObject);
    } catch {
      await makeApiRequest("POST", "genericObject", genericObject);
    }

    return objectId;
  },

  async generateSaveLink(options: GooglePassGenerationOptions): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Google Wallet is not configured");
    }

    const { pass, member } = options;
    const objectId = await this.createObject(options);
    const branding = await getCompanyBranding(pass.companyId);

    const genericObject = {
      id: objectId,
      classId: `${GOOGLE_ISSUER_ID}.${pass.companyId.replace(/-/g, "_")}`,
      state: "ACTIVE",
      textModulesData: [
        { id: "member_id", header: "MEMBER ID", body: member.memberId },
        { id: "plan", header: "PLAN", body: member.plan || "Standard" },
      ],
      barcode: {
        type: "QR_CODE",
        value: member.memberId,
      },
      cardTitle: { defaultValue: { language: "en-US", value: branding.name } },
      header: { defaultValue: { language: "en-US", value: member.fullName } },
    };

    const jwt = await this.createJwt(genericObject);
    return `https://pay.google.com/gp/v/save/${jwt}`;
  },

  async createJwt(genericObject: any): Promise<string> {
    if (!credentials) {
      throw new Error("Google Wallet credentials not initialized");
    }

    const crypto = await import("crypto");
    const now = Math.floor(Date.now() / 1000);

    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const payload = {
      iss: credentials.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: now,
      origins: [],
      payload: {
        genericObjects: [genericObject],
      },
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signatureInput = `${headerB64}.${payloadB64}`;

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(signatureInput);
    const signature = sign.sign(credentials.private_key, "base64url");

    return `${signatureInput}.${signature}`;
  },

  async revokeObject(objectId: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    try {
      await makeApiRequest("PATCH", `genericObject/${objectId}`, { state: "EXPIRED" });
    } catch (error) {
      console.error("[Google Wallet] Failed to revoke object:", error);
    }
  },

  async updateObject(options: GooglePassGenerationOptions): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    await this.createObject(options);
  },
};

export default googleWalletService;
