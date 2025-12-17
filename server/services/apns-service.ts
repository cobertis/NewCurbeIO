import http2 from "http2";
import forge from "node-forge";
import { db } from "../db";
import { walletPasses, walletDevices, walletSettings } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const APNS_PRODUCTION_HOST = "api.push.apple.com";
const APNS_SANDBOX_HOST = "api.sandbox.push.apple.com";

interface APNsCredentials {
  signerCert: string;
  signerKey: string;
}

function decrypt(encryptedText: string, encryptionKey: string): string {
  const key = encryptionKey.slice(0, 32);
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "utf8"), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function extractP12Credentials(p12Buffer: Buffer, password: string): APNsCredentials {
  const p12Der = forge.util.decode64(p12Buffer.toString("base64"));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || "");
  
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag || certBag.length === 0 || !certBag[0].cert) {
    throw new Error("No certificate found in P12 file");
  }
  const cert = certBag[0].cert;
  const certPem = forge.pki.certificateToPem(cert);
  
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

interface SendPushResult {
  success: boolean;
  pushToken: string;
  error?: string;
  statusCode?: number;
}

async function sendEmptyPush(
  pushToken: string,
  passTypeIdentifier: string,
  credentials: APNsCredentials,
  useSandbox: boolean = false
): Promise<SendPushResult> {
  const host = useSandbox ? APNS_SANDBOX_HOST : APNS_PRODUCTION_HOST;
  
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}:443`, {
      cert: credentials.signerCert,
      key: credentials.signerKey,
    });

    client.on("error", (err) => {
      console.error("[APNs] Connection error:", err.message);
      resolve({ success: false, pushToken, error: err.message });
    });

    const headers = {
      ":method": "POST",
      ":path": `/3/device/${pushToken}`,
      "apns-topic": passTypeIdentifier,
      "apns-push-type": "background",
      "apns-priority": "5",
    };

    const req = client.request(headers);

    let responseStatus = 0;
    let responseData = "";

    req.on("response", (responseHeaders) => {
      responseStatus = responseHeaders[":status"] as number;
    });

    req.on("data", (chunk) => {
      responseData += chunk.toString();
    });

    req.on("end", () => {
      client.close();
      
      if (responseStatus === 200) {
        console.log(`[APNs] Push sent successfully to token: ${pushToken.substring(0, 10)}...`);
        resolve({ success: true, pushToken, statusCode: responseStatus });
      } else {
        console.error(`[APNs] Push failed with status ${responseStatus}:`, responseData);
        resolve({ 
          success: false, 
          pushToken, 
          statusCode: responseStatus,
          error: responseData || `HTTP ${responseStatus}` 
        });
      }
    });

    req.on("error", (err) => {
      client.close();
      console.error("[APNs] Request error:", err.message);
      resolve({ success: false, pushToken, error: err.message });
    });

    req.end(JSON.stringify({}));
  });
}

export interface SendPassAlertOptions {
  passSerial: string;
  message: string;
  useSandbox?: boolean;
}

export interface SendPassAlertResult {
  success: boolean;
  passUpdated: boolean;
  pushResults: SendPushResult[];
  devicesNotified: number;
  errors?: string[];
}

export const apnsService = {
  async sendPassAlert(options: SendPassAlertOptions): Promise<SendPassAlertResult> {
    const { passSerial, message, useSandbox = false } = options;
    const errors: string[] = [];
    
    const [pass] = await db.select().from(walletPasses).where(eq(walletPasses.serialNumber, passSerial));
    
    if (!pass) {
      return {
        success: false,
        passUpdated: false,
        pushResults: [],
        devicesNotified: 0,
        errors: [`Pass with serial ${passSerial} not found`],
      };
    }

    const [settings] = await db.select().from(walletSettings).where(eq(walletSettings.companyId, pass.companyId));
    
    if (!settings?.appleP12Base64 || !settings?.applePassTypeIdentifier) {
      return {
        success: false,
        passUpdated: false,
        pushResults: [],
        devicesNotified: 0,
        errors: ["Apple Wallet not configured for this company"],
      };
    }

    const encryptionKey = settings.encryptionKey;
    if (!encryptionKey || encryptionKey.length < 32) {
      return {
        success: false,
        passUpdated: false,
        pushResults: [],
        devicesNotified: 0,
        errors: ["Encryption key not configured"],
      };
    }

    await db.update(walletPasses)
      .set({ 
        lastNotification: message,
        updatedAt: new Date(),
      })
      .where(eq(walletPasses.id, pass.id));

    console.log(`[APNs] Updated pass ${passSerial} with notification: "${message}"`);

    const devices = await db.select().from(walletDevices).where(eq(walletDevices.walletPassId, pass.id));
    
    if (devices.length === 0) {
      return {
        success: true,
        passUpdated: true,
        pushResults: [],
        devicesNotified: 0,
        errors: ["Pass updated but no devices registered to receive push notifications"],
      };
    }

    let credentials: APNsCredentials;
    try {
      const p12Buffer = Buffer.from(settings.appleP12Base64, "base64");
      credentials = extractP12Credentials(p12Buffer, settings.appleP12Password || "");
    } catch (err: any) {
      return {
        success: false,
        passUpdated: true,
        pushResults: [],
        devicesNotified: 0,
        errors: [`Failed to extract credentials: ${err.message}`],
      };
    }

    const pushResults: SendPushResult[] = [];
    let successCount = 0;

    for (const device of devices) {
      if (!device.pushToken) {
        errors.push(`Device ${device.deviceLibraryIdentifier} has no push token`);
        continue;
      }

      let decryptedToken: string;
      try {
        decryptedToken = decrypt(device.pushToken, encryptionKey);
      } catch (err: any) {
        errors.push(`Failed to decrypt push token for device ${device.deviceLibraryIdentifier}`);
        continue;
      }

      const result = await sendEmptyPush(
        decryptedToken,
        settings.applePassTypeIdentifier,
        credentials,
        useSandbox
      );
      
      pushResults.push(result);
      if (result.success) {
        successCount++;
      } else if (result.error) {
        errors.push(`Device ${device.deviceLibraryIdentifier}: ${result.error}`);
      }
    }

    return {
      success: successCount > 0 || devices.length === 0,
      passUpdated: true,
      pushResults,
      devicesNotified: successCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  async sendPassAlertByPassId(passId: string, message: string, useSandbox: boolean = false): Promise<SendPassAlertResult> {
    const [pass] = await db.select().from(walletPasses).where(eq(walletPasses.id, passId));
    
    if (!pass) {
      return {
        success: false,
        passUpdated: false,
        pushResults: [],
        devicesNotified: 0,
        errors: [`Pass with ID ${passId} not found`],
      };
    }

    return this.sendPassAlert({
      passSerial: pass.serialNumber,
      message,
      useSandbox,
    });
  },

  async sendPassAlertByMemberId(memberId: string, message: string, useSandbox: boolean = false): Promise<SendPassAlertResult> {
    const [pass] = await db.select()
      .from(walletPasses)
      .where(eq(walletPasses.memberId, memberId))
      .limit(1);
    
    if (!pass) {
      return {
        success: false,
        passUpdated: false,
        pushResults: [],
        devicesNotified: 0,
        errors: [`No pass found for member ${memberId}`],
      };
    }

    return this.sendPassAlert({
      passSerial: pass.serialNumber,
      message,
      useSandbox,
    });
  },

  async sendBulkAlert(companyId: string, message: string, useSandbox: boolean = false): Promise<{
    totalPasses: number;
    successfulUpdates: number;
    devicesNotified: number;
    errors: string[];
  }> {
    const passes = await db.select().from(walletPasses).where(eq(walletPasses.companyId, companyId));
    
    let successfulUpdates = 0;
    let totalDevicesNotified = 0;
    const allErrors: string[] = [];

    for (const pass of passes) {
      const result = await this.sendPassAlert({
        passSerial: pass.serialNumber,
        message,
        useSandbox,
      });

      if (result.passUpdated) {
        successfulUpdates++;
      }
      totalDevicesNotified += result.devicesNotified;
      if (result.errors) {
        allErrors.push(...result.errors);
      }
    }

    return {
      totalPasses: passes.length,
      successfulUpdates,
      devicesNotified: totalDevicesNotified,
      errors: allErrors,
    };
  },
};

export default apnsService;
