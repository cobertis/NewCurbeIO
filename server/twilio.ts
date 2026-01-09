import twilio from "twilio";
import type { Twilio } from "twilio";
import { blacklistService } from "./services/blacklist-service";
import { credentialProvider } from "./services/credential-provider";

let twilioClient: Twilio | null = null;
let twilioInitialized = false;
let twilioInitPromise: Promise<Twilio | null> | null = null;
let twilioFromNumber: string = "";

async function initTwilio(): Promise<Twilio | null> {
  if (twilioInitialized) {
    return twilioClient;
  }

  if (twilioInitPromise) {
    return twilioInitPromise;
  }

  twilioInitPromise = (async () => {
    try {
      const { accountSid, authToken, phoneNumber } = await credentialProvider.getTwilio();

      if (!accountSid || !authToken || !phoneNumber) {
        // Silently skip - Twilio is optional, system uses Telnyx for SMS/Voice
        twilioInitialized = true;
        return null;
      }

      twilioClient = twilio(accountSid, authToken);
      twilioFromNumber = phoneNumber;
      twilioInitialized = true;
      console.log("Twilio service initialized successfully");
      return twilioClient;
    } catch (error) {
      console.error("Failed to initialize Twilio service:", error);
      twilioInitialized = true;
      return null;
    }
  })();

  return twilioInitPromise;
}

export async function getTwilioClient(): Promise<Twilio | null> {
  return initTwilio();
}

async function ensureTwilioConfigured(): Promise<Twilio> {
  const client = await initTwilio();
  if (!client) {
    throw new Error("Twilio service not initialized");
  }
  return client;
}

class TwilioService {
  async sendSMS(to: string, message: string, companyId?: string): Promise<{ sid: string; status: string } | null> {
    const client = await ensureTwilioConfigured();

    try {
      if (companyId) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "sms",
          identifier: to
        });
      }
      
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/status`;
      
      const result = await client.messages.create({
        body: message,
        from: twilioFromNumber,
        to: to,
        statusCallback: statusCallbackUrl,
      });

      console.log(`SMS sent successfully to ${to}. SID: ${result.sid}, StatusCallback: ${statusCallbackUrl}`);
      return { sid: result.sid, status: result.status };
    } catch (error: any) {
      if (error.message?.includes('blacklisted')) {
        console.log(`[BLACKLIST] Blocked outbound SMS to ${to} on sms`);
      } else {
        console.error("Failed to send SMS:", error);
      }
      throw error;
    }
  }

  async sendMMS(to: string, imageUrl: string, pendingMessageId?: string, companyId?: string): Promise<{ sid: string; status: string } | null> {
    const client = await ensureTwilioConfigured();

    try {
      if (companyId) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "sms",
          identifier: to
        });
      }
      
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      let statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/status`;
      if (pendingMessageId) {
        statusCallbackUrl += `?pendingMessageId=${pendingMessageId}`;
      }
      
      const result = await client.messages.create({
        from: twilioFromNumber,
        to: to,
        mediaUrl: [imageUrl],
        statusCallback: statusCallbackUrl,
      });

      console.log(`MMS sent successfully to ${to}. SID: ${result.sid}, Image: ${imageUrl}, StatusCallback: ${statusCallbackUrl}`);
      return { sid: result.sid, status: result.status };
    } catch (error: any) {
      if (error.message?.includes('blacklisted')) {
        console.log(`[BLACKLIST] Blocked outbound MMS to ${to} on sms`);
      } else {
        console.error("Failed to send MMS:", error);
      }
      throw error;
    }
  }

  async sendOTPSMS(phoneNumber: string, otpCode: string): Promise<boolean> {
    const message = `Your Curbe verification code is: ${otpCode}\n\nTu código de verificación Curbe es: ${otpCode}`;
    
    try {
      await this.sendSMS(phoneNumber, message);
      return true;
    } catch (error) {
      return false;
    }
  }

  async sendAppointmentConfirmationSMS(
    phoneNumber: string,
    customerName: string,
    agentName: string,
    companyName: string,
    appointmentDate: string,
    appointmentTime: string
  ): Promise<boolean> {
    const message = `Hola ${customerName}\n\nSoy ${agentName} y quiero darte las gracias por programar una llamada conmigo el ${appointmentDate} a las ${appointmentTime}.\n\nEspero con ansias nuestra llamada.\n\nQue tengas un lindo dia.\n\n${agentName} - ${companyName}`;
    
    try {
      await this.sendSMS(phoneNumber, message);
      return true;
    } catch (error) {
      console.error("Failed to send appointment confirmation SMS:", error);
      return false;
    }
  }

  async isInitialized(): Promise<boolean> {
    const client = await initTwilio();
    return client !== null;
  }
}

export const twilioService = new TwilioService();
