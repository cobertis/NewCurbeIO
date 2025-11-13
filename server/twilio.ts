import twilio from "twilio";
import type { Twilio } from "twilio";
import { blacklistService } from "./services/blacklist-service";

class TwilioService {
  private client: Twilio | null = null;
  private initialized: boolean = false;
  private fromNumber: string = "";

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        console.warn("Twilio credentials not configured. SMS service will not be available.");
        return;
      }

      this.client = twilio(accountSid, authToken);
      this.fromNumber = fromNumber;
      this.initialized = true;
      console.log("Twilio service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Twilio service:", error);
      this.initialized = false;
    }
  }

  async sendSMS(to: string, message: string, companyId?: string): Promise<{ sid: string; status: string } | null> {
    if (!this.initialized || !this.client) {
      console.error("Twilio service not initialized. Cannot send SMS.");
      throw new Error("Twilio service not initialized");
    }

    try {
      // Check blacklist before sending (if companyId provided)
      if (companyId) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "sms",
          identifier: to
        });
      }
      
      // Build status callback URL using APP_URL from environment
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/status`;
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
        statusCallback: statusCallbackUrl,
      });

      console.log(`SMS sent successfully to ${to}. SID: ${result.sid}, StatusCallback: ${statusCallbackUrl}`);
      return { sid: result.sid, status: result.status };
    } catch (error: any) {
      // Log blacklist rejections distinctly
      if (error.message?.includes('blacklisted')) {
        console.log(`[BLACKLIST] Blocked outbound SMS to ${to} on sms`);
      } else {
        console.error("Failed to send SMS:", error);
      }
      throw error;
    }
  }

  async sendMMS(to: string, imageUrl: string, pendingMessageId?: string, companyId?: string): Promise<{ sid: string; status: string } | null> {
    if (!this.initialized || !this.client) {
      console.error("Twilio service not initialized. Cannot send MMS.");
      throw new Error("Twilio service not initialized");
    }

    try {
      // Check blacklist before sending (if companyId provided)
      // MMS uses SMS channel for blacklist purposes
      if (companyId) {
        await blacklistService.assertNotBlacklisted({
          companyId,
          channel: "sms",
          identifier: to
        });
      }
      
      // Build status callback URL with correlation ID
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      let statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/status`;
      if (pendingMessageId) {
        statusCallbackUrl += `?pendingMessageId=${pendingMessageId}`;
      }
      
      const result = await this.client.messages.create({
        from: this.fromNumber,
        to: to,
        mediaUrl: [imageUrl],
        statusCallback: statusCallbackUrl,
      });

      console.log(`MMS sent successfully to ${to}. SID: ${result.sid}, Image: ${imageUrl}, StatusCallback: ${statusCallbackUrl}`);
      return { sid: result.sid, status: result.status };
    } catch (error: any) {
      // Log blacklist rejections distinctly
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

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const twilioService = new TwilioService();
