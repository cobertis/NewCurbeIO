import { emailService } from "./email";
import type { IStorage } from "./storage";
import type { EmailCampaign, User } from "@shared/schema";
import { generateUnsubscribeToken } from "./unsubscribe-token";
import { trackingService } from "./tracking-service";

interface CampaignResult {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  errors: Array<{ email: string; error: string }>;
}

export class EmailCampaignService {
  constructor(private storage: IStorage) {}

  /**
   * Start sending a campaign asynchronously (returns immediately)
   */
  async sendCampaignAsync(campaignId: string, targetListId?: string): Promise<void> {
    // Update campaign status to "sending" immediately
    await this.storage.updateCampaign(campaignId, { status: "sending" });

    // Start the actual sending process in the background (don't await)
    this.sendCampaign(campaignId, targetListId).catch((error) => {
      console.error(`[CAMPAIGN SEND] Background error:`, error);
      // Update campaign status to "failed" if background process fails
      this.storage.updateCampaign(campaignId, { status: "failed" }).catch(console.error);
    });
  }

  /**
   * Send a campaign to all subscribed users or to a specific list (internal method)
   */
  private async sendCampaign(campaignId: string, targetListId?: string): Promise<CampaignResult> {
    const result: CampaignResult = {
      success: false,
      totalSent: 0,
      totalFailed: 0,
      errors: [],
    };

    try {
      const campaign = await this.storage.getCampaign(campaignId);
      if (!campaign) {
        throw new Error("Campaign not found");
      }

      if (campaign.status === "sent") {
        throw new Error("Campaign has already been sent");
      }

      let recipientsToSend: User[];
      
      if (targetListId) {
        const listMembers = await this.storage.getListMembers(targetListId);
        recipientsToSend = listMembers.filter(user => user.emailSubscribed);
        
        if (recipientsToSend.length === 0) {
          throw new Error("No subscribed users in the selected contact list");
        }
      } else {
        recipientsToSend = await this.storage.getSubscribedUsers();
        
        if (recipientsToSend.length === 0) {
          throw new Error("No subscribed users to send campaign to");
        }
      }

      const appUrl = process.env.APP_URL || "http://localhost:5000";

      // Send emails with 5-second delay between each
      for (let i = 0; i < recipientsToSend.length; i++) {
        const user = recipientsToSend[i];
        
        // Add 5-second delay between emails (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        try {
          let personalizedHtml = this.personalizeContent(
            campaign.htmlContent,
            user,
            appUrl,
            campaignId
          );
          
          personalizedHtml = trackingService.injectTrackingIntoHtml(
            personalizedHtml,
            campaignId,
            user.id
          );
          
          const personalizedText = campaign.textContent
            ? this.personalizeContent(campaign.textContent, user, appUrl, campaignId)
            : undefined;

          const emailSent = await emailService.sendEmail({
            to: user.email,
            subject: campaign.subject,
            html: personalizedHtml,
            text: personalizedText,
            companyId: user.companyId || undefined,
          });

          if (emailSent) {
            // Create individual email tracking record
            await this.storage.createCampaignEmail({
              campaignId,
              userId: user.id,
              email: user.email,
              status: "sent",
            });
            result.totalSent++;
            console.log(`[CAMPAIGN] Sent ${i + 1}/${recipientsToSend.length} to ${user.email}`);
          } else {
            // Create failed email tracking record
            await this.storage.createCampaignEmail({
              campaignId,
              userId: user.id,
              email: user.email,
              status: "failed",
              errorMessage: "Failed to send email (unknown error)",
            });
            result.totalFailed++;
            result.errors.push({
              email: user.email,
              error: "Failed to send email (unknown error)",
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          // Create failed email tracking record
          await this.storage.createCampaignEmail({
            campaignId,
            userId: user.id,
            email: user.email,
            status: "failed",
            errorMessage,
          });
          result.totalFailed++;
          result.errors.push({
            email: user.email,
            error: errorMessage,
          });
        }
      }

      // Update campaign status based on delivery results
      if (result.totalSent > 0) {
        // At least one email was successfully delivered - mark as sent
        await this.storage.updateCampaign(campaignId, {
          status: "sent",
          sentAt: new Date(),
          recipientCount: result.totalSent,
        });
        result.success = true;

        // Create notification for successful campaign send
        if (campaign.sentBy) {
          const { notificationService } = await import("./notification-service");
          await notificationService.notifyCampaignSent(
            campaign.subject,
            result.totalSent,
            campaign.sentBy,
            campaignId
          );
        }
      } else {
        // All emails failed - mark as failed and record the attempt
        await this.storage.updateCampaign(campaignId, {
          status: "failed",
          sentAt: new Date(), // Record when the attempt was made
          recipientCount: 0, // No successful deliveries
        });
        result.success = false;

        // Create notification for failed campaign
        if (campaign.sentBy) {
          const { notificationService } = await import("./notification-service");
          const errorSummary = result.errors.length > 0 
            ? result.errors[0].error 
            : "Unknown error";
          await notificationService.notifyCampaignFailed(
            campaign.subject,
            errorSummary,
            campaign.sentBy,
            campaignId
          );
        }
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Personalize email content with user data and add unsubscribe link
   */
  private personalizeContent(content: string, user: User, appUrl: string, campaignId: string): string {
    const token = generateUnsubscribeToken(user.email);
    const unsubscribeUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(user.email)}&token=${token}&campaignId=${campaignId}`;
    
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const firstName = user.firstName || user.email;

    let personalizedContent = content
      .replace(/\{\{name\}\}/g, fullName)
      .replace(/\{\{email\}\}/g, user.email)
      .replace(/\{\{firstName\}\}/g, firstName);

    if (!personalizedContent.includes("{{unsubscribe}}")) {
      personalizedContent += `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
          <p>If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: underline;">unsubscribe here</a>.</p>
        </div>
      `;
    } else {
      personalizedContent = personalizedContent.replace(
        /\{\{unsubscribe\}\}/g,
        `<a href="${unsubscribeUrl}">unsubscribe</a>`
      );
    }

    return personalizedContent;
  }
}
