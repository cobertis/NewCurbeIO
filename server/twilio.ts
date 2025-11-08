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

  async sendSMS(to: string, message: string): Promise<{ sid: string; status: string } | null> {
    if (!this.initialized || !this.client) {
      console.error("Twilio service not initialized. Cannot send SMS.");
      throw new Error("Twilio service not initialized");
    }

    try {
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
    } catch (error) {
      console.error("Failed to send SMS:", error);
      throw error;
    }
  }

  async sendOTPSMS(phoneNumber: string, otpCode: string): Promise<boolean> {
    const message = `Your Curbe verification code is: ${otpCode}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this code, please ignore this message.`;
    
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
