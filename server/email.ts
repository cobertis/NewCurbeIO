import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || "587");
      const user = process.env.SMTP_USER;
      const password = process.env.SMTP_PASSWORD;

      if (!host || !user || !password) {
        console.warn("SMTP credentials not configured. Email service will not be available.");
        return;
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass: password,
        },
        authMethod: 'LOGIN', // Explicitly use LOGIN authentication
        tls: {
          // Do not fail on invalid certs (for self-signed certificates)
          rejectUnauthorized: false,
          ciphers: 'SSLv3', // Support older SSL versions if needed
        },
        // For port 587, use STARTTLS
        requireTLS: port === 587,
        // Connection timeout (10 seconds)
        connectionTimeout: 10000,
        // Socket timeout (15 seconds)
        socketTimeout: 15000,
        // Greeting timeout (5 seconds)
        greetingTimeout: 5000,
        // Enable debug to see what's happening
        debug: true,
        logger: true,
      });

      this.initialized = true;
      console.log("Email service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize email service:", error);
      this.initialized = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.initialized || !this.transporter) {
      console.error("Email service not initialized. Cannot send email.");
      return false;
    }

    try {
      // Always use SMTP_USER as the from email (it's properly configured)
      const fromEmail = process.env.SMTP_USER;
      const fromName = process.env.SMTP_FROM_NAME || "Curbe.io";

      console.log('[EMAIL DEBUG] Starting email send...');
      console.log('[EMAIL DEBUG] From:', `"${fromName}" <${fromEmail}>`);
      console.log('[EMAIL DEBUG] To:', options.to);
      console.log('[EMAIL DEBUG] Subject:', options.subject);
      console.log('[EMAIL DEBUG] SMTP Config:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        secure: parseInt(process.env.SMTP_PORT || "587") === 465
      });

      const result = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ""),
        html: options.html,
      });

      console.log('[EMAIL DEBUG] Nodemailer result:', JSON.stringify(result, null, 2));
      console.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error: any) {
      console.error("Failed to send email - ERROR DETAILS:");
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);
      console.error("Error response:", error.response);
      console.error("Full error:", JSON.stringify(error, null, 2));
      return false;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.initialized || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log("SMTP connection verified successfully");
      return true;
    } catch (error) {
      console.error("SMTP connection verification failed:", error);
      return false;
    }
  }

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Bienvenido a Curbe Admin</h1>
            </div>
            <div class="content">
              <h2>Hola ${userName},</h2>
              <p>Tu cuenta ha sido creada exitosamente en Curbe Admin Portal.</p>
              <p>Ahora puedes acceder a la plataforma y comenzar a gestionar tu información.</p>
              <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
              <p>¡Gracias por usar Curbe!</p>
            </div>
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
              <p>&copy; 2025 Curbe. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: "Bienvenido a Curbe Admin",
      html,
    });
  }

  async sendPasswordResetEmail(userEmail: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.APP_URL || "http://localhost:5000"}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Restablecer Contraseña</h1>
            </div>
            <div class="content">
              <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
              <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
              </p>
              <div class="warning">
                <strong>Importante:</strong> Este enlace expirará en 1 hora por seguridad.
              </div>
              <p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
            </div>
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
              <p>&copy; 2025 Curbe. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: "Restablecer tu contraseña - Curbe Admin",
      html,
    });
  }

  async sendInvoiceEmail(userEmail: string, invoiceNumber: string, amount: number, dueDate: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .invoice-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .invoice-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nueva Factura Generada</h1>
            </div>
            <div class="content">
              <p>Se ha generado una nueva factura para tu cuenta.</p>
              <div class="invoice-details">
                <div class="invoice-row">
                  <strong>Número de Factura:</strong>
                  <span>${invoiceNumber}</span>
                </div>
                <div class="invoice-row">
                  <strong>Monto:</strong>
                  <span>$${amount.toFixed(2)}</span>
                </div>
                <div class="invoice-row">
                  <strong>Fecha de Vencimiento:</strong>
                  <span>${dueDate}</span>
                </div>
              </div>
              <p>Puedes ver y descargar tu factura desde el portal de administración.</p>
              <p style="text-align: center;">
                <a href="${process.env.APP_URL || "http://localhost:5000"}/invoices" class="button">Ver Facturas</a>
              </p>
            </div>
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
              <p>&copy; 2025 Curbe. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `Nueva Factura ${invoiceNumber} - Curbe Admin`,
      html,
    });
  }

  async sendNotificationEmail(userEmail: string, title: string, message: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Notificación del Sistema</h1>
            </div>
            <div class="content">
              <h2>${title}</h2>
              <div class="message-box">
                <p>${message}</p>
              </div>
            </div>
            <div class="footer">
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
              <p>&copy; 2025 Curbe. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `${title} - Curbe Admin`,
      html,
    });
  }

}

export const emailService = new EmailService();
