import jwt from "jsonwebtoken";
import { db } from "../db";
import { vipPassDesigns, vipPassInstances, companies } from "@shared/schema";
import { eq } from "drizzle-orm";

interface GoogleWalletCredentials {
  client_email: string;
  private_key: string;
}

interface PassData {
  instanceId: string;
  serialNumber: string;
  recipientName: string;
  memberId: string;
  tierLevel: string;
  companyName: string;
  logoText: string;
  backgroundColor: string;
  barcodeValue: string;
}

export class GoogleWalletService {
  private credentials: GoogleWalletCredentials | null = null;
  private issuerId: string | null = null;

  constructor() {
    this.loadCredentials();
  }

  private loadCredentials() {
    const clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, '\n');
    this.issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || null;

    if (clientEmail && privateKey) {
      this.credentials = {
        client_email: clientEmail,
        private_key: privateKey,
      };
    }
  }

  isConfigured(): boolean {
    return !!(this.credentials && this.issuerId);
  }

  async generateWalletUrl(passInstanceId: string, companyId: string): Promise<string | null> {
    if (!this.isConfigured()) {
      console.log("[Google Wallet] Not configured - credentials missing");
      return null;
    }

    const [instance] = await db
      .select()
      .from(vipPassInstances)
      .where(eq(vipPassInstances.id, passInstanceId))
      .limit(1);

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
      .where(eq(companies.id, companyId))
      .limit(1);

    const passData: PassData = {
      instanceId: instance.id,
      serialNumber: instance.serialNumber,
      recipientName: instance.recipientName || "VIP Member",
      memberId: instance.memberId || instance.serialNumber,
      tierLevel: instance.tierLevel || "Gold",
      companyName: company?.name || "VIP Pass",
      logoText: design.logoText || "VIP",
      backgroundColor: design.backgroundColor || "#1a1a1a",
      barcodeValue: instance.serialNumber,
    };

    return this.createJwtLink(passData, design);
  }

  private createJwtLink(passData: PassData, design: any): string {
    if (!this.credentials || !this.issuerId) {
      throw new Error("Google Wallet not configured");
    }

    const classSuffix = `vip-pass-class-${design.id.substring(0, 8)}`;
    const objectSuffix = `vip-pass-${passData.instanceId}`;

    const hexToGoogleColor = (hex: string): string => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (result) {
        return `#${result[1]}${result[2]}${result[3]}`;
      }
      return hex;
    };

    const claims = {
      iss: this.credentials.client_email,
      aud: "google",
      typ: "savetowallet",
      payload: {
        genericClasses: [{
          id: `${this.issuerId}.${classSuffix}`,
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [{
                twoItems: {
                  startItem: {
                    firstValue: {
                      fields: [{
                        fieldPath: "object.textModulesData['tier']"
                      }]
                    }
                  },
                  endItem: {
                    firstValue: {
                      fields: [{
                        fieldPath: "object.textModulesData['member_id']"
                      }]
                    }
                  }
                }
              }]
            }
          }
        }],
        genericObjects: [{
          id: `${this.issuerId}.${objectSuffix}`,
          classId: `${this.issuerId}.${classSuffix}`,
          state: "ACTIVE",
          header: {
            defaultValue: {
              language: "en",
              value: passData.companyName
            }
          },
          subheader: {
            defaultValue: {
              language: "en",
              value: "VIP Member"
            }
          },
          logo: {
            sourceUri: {
              uri: "https://curbe.io/logo-icon.png"
            }
          },
          hexBackgroundColor: hexToGoogleColor(passData.backgroundColor),
          cardTitle: {
            defaultValue: {
              language: "en",
              value: design.logoText || "VIP PASS"
            }
          },
          textModulesData: [
            {
              id: "tier",
              header: "TIER",
              body: passData.tierLevel
            },
            {
              id: "member_id",
              header: "MEMBER ID",
              body: passData.memberId
            },
            {
              id: "name",
              header: "NAME",
              body: passData.recipientName
            }
          ],
          barcode: {
            type: "QR_CODE",
            value: passData.barcodeValue,
            alternateText: passData.memberId
          }
        }]
      }
    };

    const token = jwt.sign(claims, this.credentials.private_key, {
      algorithm: "RS256"
    });

    return `https://pay.google.com/gp/v/save/${token}`;
  }
}

export const googleWalletService = new GoogleWalletService();
