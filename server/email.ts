import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { blacklistService } from "./services/blacklist-service";
import { credentialProvider } from "./services/credential-provider";
import { storage } from "./storage";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  companyId?: string;
  skipBlacklistCheck?: boolean;
  retryAttempts?: number;
  templateSlug?: string;
  skipLogging?: boolean;
}

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
  context: string = "operation"
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      const errorCode = (error.code || '').toUpperCase();
      const errorMessage = (error.message || '').toLowerCase();
      
      const retryableCodes = [
        'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET', 
        'EAI_AGAIN', 'ETEMP', 'ENOTFOUND', 'EHOSTUNREACH'
      ];
      
      const retryablePatterns = [
        'greeting never received',
        'timeout',
        'etimedout',
        'connection',
        'socket',
        'network',
        'temporarily unavailable',
        'try again',
        'closed'
      ];
      
      const isRetryable = 
        retryableCodes.includes(errorCode) ||
        retryablePatterns.some(pattern => errorMessage.includes(pattern));
      
      if (!isRetryable || attempt === options.maxAttempts) {
        console.error(`[EMAIL RETRY] ${context} failed after ${attempt} attempt(s):`, error.message);
        throw error;
      }
      
      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt - 1),
        options.maxDelayMs
      );
      
      console.log(`[EMAIL RETRY] ${context} attempt ${attempt}/${options.maxAttempts} failed: ${error.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error(`${context} failed after ${options.maxAttempts} attempts`);
}

let emailTransporter: Transporter | null = null;
let emailInitialized = false;
let emailInitPromise: Promise<Transporter | null> | null = null;
let smtpFromEmail: string = "";
let smtpFromName: string = "Curbe.io";

async function initEmail(): Promise<Transporter | null> {
  if (emailInitialized) {
    return emailTransporter;
  }

  if (emailInitPromise) {
    return emailInitPromise;
  }

  emailInitPromise = (async () => {
    try {
      const { host, port, user, password, fromEmail } = await credentialProvider.getNodemailer();
      const portNumber = parseInt(port || "587");

      if (!host || !user || !password) {
        console.warn("⚠️  SMTP credentials not configured. Email service will not be available.");
        emailInitialized = true;
        return null;
      }

      emailTransporter = nodemailer.createTransport({
        host,
        port: portNumber,
        secure: portNumber === 465,
        auth: {
          type: 'login',
          user,
          pass: password,
        },
        tls: {
          rejectUnauthorized: false,
        },
        requireTLS: portNumber === 587,
        connectionTimeout: 10000,
        socketTimeout: 15000,
        greetingTimeout: 5000,
        debug: true,
        logger: true,
      });

      smtpFromEmail = fromEmail || user;
      smtpFromName = process.env.SMTP_FROM_NAME || "Curbe.io";
      emailInitialized = true;
      console.log("Email service initialized successfully");
      return emailTransporter;
    } catch (error) {
      console.error("Failed to initialize email service:", error);
      emailInitialized = true;
      return null;
    }
  })();

  return emailInitPromise;
}

export async function getEmailTransporter(): Promise<Transporter | null> {
  return initEmail();
}

export async function reinitializeEmailService(): Promise<void> {
  console.log("[EMAIL] Reinitializing email service with new credentials...");
  emailTransporter = null;
  emailInitialized = false;
  emailInitPromise = null;
  smtpFromEmail = "";
  await initEmail();
  console.log("[EMAIL] Email service reinitialized");
}

async function ensureEmailConfigured(): Promise<Transporter> {
  const transporter = await initEmail();
  if (!transporter) {
    throw new Error("Email service not initialized");
  }
  return transporter;
}

class EmailService {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const transporter = await initEmail();

    if (!transporter) {
      console.error("Email service not initialized. Cannot send email.");
      return false;
    }

    try {
      if (options.companyId && !options.skipBlacklistCheck) {
        const emailsToCheck = Array.isArray(options.to) ? options.to : [options.to];
        
        for (const email of emailsToCheck) {
          await blacklistService.assertNotBlacklisted({
            companyId: options.companyId,
            channel: "email",
            identifier: email
          });
        }
      }

      const fromAddress = '"Curbe.io" <no-reply@auth.curbe.io>';
      const bounceAddress = 'rebotes@auth.curbe.io';
      const recipients = Array.isArray(options.to) ? options.to.join(", ") : options.to;

      console.log('[EMAIL DEBUG] Starting email send...');
      console.log('[EMAIL DEBUG] From:', fromAddress);
      console.log('[EMAIL DEBUG] Bounce Return-Path:', bounceAddress);
      console.log('[EMAIL DEBUG] To:', options.to);
      console.log('[EMAIL DEBUG] Subject:', options.subject);

      const retryOptions: RetryOptions = {
        maxAttempts: options.retryAttempts ?? 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
      };

      const result = await withExponentialBackoff(
        async () => {
          return await transporter.sendMail({
            from: fromAddress,
            to: recipients,
            subject: options.subject,
            text: options.text || options.html.replace(/<[^>]*>/g, ""),
            html: options.html,
            envelope: {
              from: bounceAddress,
              to: Array.isArray(options.to) ? options.to : [options.to],
            },
          });
        },
        retryOptions,
        `Send email to ${recipients}`
      );

      console.log('[EMAIL DEBUG] Nodemailer result:', JSON.stringify(result, null, 2));
      console.log(`Email sent successfully to ${options.to}`);

      if (!options.skipLogging) {
        try {
          await storage.createActivityLog({
            companyId: options.companyId || null,
            userId: null,
            action: "email_sent",
            entity: "email",
            entityId: null,
            metadata: {
              recipient: recipients,
              subject: options.subject,
              htmlContent: options.html,
              templateSlug: options.templateSlug || null,
            },
            ipAddress: null,
            userAgent: null,
          });
        } catch (logError) {
          console.error("[EMAIL] Failed to log email activity:", logError);
        }
      }

      return true;
    } catch (error: any) {
      if (error.message?.includes('blacklisted')) {
        const emails = Array.isArray(options.to) ? options.to.join(', ') : options.to;
        console.log(`[BLACKLIST] Blocked outbound email to ${emails} on email`);
      } else {
        console.error("Failed to send email after all retries - ERROR DETAILS:");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error response:", error.response);
        console.error("Full error:", JSON.stringify(error, null, 2));
      }
      return false;
    }
  }

  async verifyConnection(): Promise<boolean> {
    const transporter = await initEmail();

    if (!transporter) {
      return false;
    }

    try {
      await transporter.verify();
      console.log("SMTP connection verified successfully");
      return true;
    } catch (error) {
      console.error("SMTP connection verification failed:", error);
      return false;
    }
  }

  async isInitialized(): Promise<boolean> {
    const transporter = await initEmail();
    return transporter !== null;
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

  async sendNewRegistrationNotification(data: {
    companyName: string;
    companySlug: string;
    companyPhone: string | null;
    companyEmail: string | null;
    companyWebsite: string | null;
    companyAddress: string | null;
    companyAddressLine2: string | null;
    companyCity: string | null;
    companyState: string | null;
    companyPostalCode: string | null;
    companyCountry: string | null;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminPhone: string | null;
    registrationDate: string;
    companyId: string;
    userId: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .section-title { font-size: 16px; font-weight: 600; color: #1a1a2e; margin: 0 0 15px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; }
            .info-grid { display: table; width: 100%; }
            .info-row { display: table-row; }
            .info-label { display: table-cell; padding: 8px 10px 8px 0; font-weight: 600; color: #495057; width: 120px; vertical-align: top; }
            .info-value { display: table-cell; padding: 8px 0; color: #212529; }
            .highlight { background: #e8f4f8; padding: 15px; border-radius: 6px; margin-top: 15px; border-left: 4px solid #0d6efd; }
            .highlight strong { color: #0d6efd; }
            .footer { text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nuevo Registro en Curbe</h1>
              <p>Una nueva empresa se ha registrado en la plataforma</p>
            </div>
            <div class="content">
              <div class="section">
                <div class="section-title">Datos del Registro</div>
                <div class="info-grid">
                  <div class="info-row">
                    <div class="info-label">Empresa:</div>
                    <div class="info-value"><strong>${data.companyName}</strong></div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Administrador:</div>
                    <div class="info-value"><strong>${data.adminFirstName} ${data.adminLastName}</strong></div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Email:</div>
                    <div class="info-value">${data.adminEmail}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Teléfono:</div>
                    <div class="info-value">${data.adminPhone || 'No proporcionado'}</div>
                  </div>
                </div>
              </div>

              <div class="highlight">
                <strong>IDs del Sistema:</strong><br>
                <span style="font-size: 13px;">
                  Company ID: ${data.companyId} | User ID: ${data.userId}<br>
                  Fecha: ${data.registrationDate}
                </span>
              </div>
            </div>
            <div class="footer">
              <p>Este correo fue enviado automáticamente por el sistema de registro de Curbe.</p>
              <p>&copy; 2025 Curbe. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: "hello@curbe.io",
      subject: `Nuevo Registro: ${data.companyName} - Curbe`,
      html,
      skipBlacklistCheck: true,
    });
  }
}

export const emailService = new EmailService();
