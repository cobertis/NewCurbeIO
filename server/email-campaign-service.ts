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
   * Send a campaign to all subscribed users or to a specific list
   */
  async sendCampaign(campaignId: string, targetListId?: string): Promise<CampaignResult> {
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

      for (const user of recipientsToSend) {
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
          });

          if (emailSent) {
            result.totalSent++;
          } else {
            result.totalFailed++;
            result.errors.push({
              email: user.email,
              error: "Failed to send email (unknown error)",
            });
          }
        } catch (error) {
          result.totalFailed++;
          result.errors.push({
            email: user.email,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      await this.storage.updateCampaign(campaignId, {
        status: "sent",
        sentAt: new Date(),
        recipientCount: result.totalSent,
      });

      result.success = result.totalSent > 0;
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
