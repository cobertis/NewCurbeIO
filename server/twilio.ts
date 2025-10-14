import twilio from "twilio";
import type { Twilio } from "twilio";

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

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.initialized || !this.client) {
      console.error("Twilio service not initialized. Cannot send SMS.");
      return false;
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
      });

      console.log(`SMS sent successfully to ${to}. SID: ${result.sid}`);
      return true;
    } catch (error) {
      console.error("Failed to send SMS:", error);
      return false;
    }
  }

  async sendOTPSMS(phoneNumber: string, otpCode: string): Promise<boolean> {
    const message = `Your Curbe verification code is: ${otpCode}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this code, please ignore this message.`;
    
    return this.sendSMS(phoneNumber, message);
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const twilioService = new TwilioService();
