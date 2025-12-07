import crypto from 'crypto';
import { systemConfigService } from './services/system-config';

export class TrackingService {
  private secret: string;

  constructor() {
    this.secret = process.env.SESSION_SECRET || '';
    if (!this.secret) {
      throw new Error('SESSION_SECRET is required for tracking service');
    }
  }

  private async getAppUrl(): Promise<string> {
    return await systemConfigService.getAppUrl();
  }

  generateTrackingToken(campaignId: string, userId: string): string {
    const data = `${campaignId}:${userId}`;
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(data);
    return hmac.digest('hex');
  }

  verifyTrackingToken(campaignId: string, userId: string, token: string): boolean {
    try {
      if (!token || token.length !== 64) {
        return false;
      }
      
      const expectedToken = this.generateTrackingToken(campaignId, userId);
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
    } catch {
      return false;
    }
  }

  async getTrackingPixelUrl(campaignId: string, userId: string): Promise<string> {
    const token = this.generateTrackingToken(campaignId, userId);
    const appUrl = await this.getAppUrl();
    return `${appUrl}/api/track/open?c=${campaignId}&u=${userId}&t=${token}`;
  }

  async wrapLinkWithTracking(url: string, campaignId: string, userId: string): Promise<string> {
    const token = this.generateTrackingToken(campaignId, userId);
    const encodedUrl = encodeURIComponent(url);
    const appUrl = await this.getAppUrl();
    return `${appUrl}/api/track/click?c=${campaignId}&u=${userId}&url=${encodedUrl}&t=${token}`;
  }

  async injectTrackingIntoHtml(htmlContent: string, campaignId: string, userId: string): Promise<string> {
    let processedHtml = htmlContent;

    const pixelUrl = await this.getTrackingPixelUrl(campaignId, userId);
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
    
    if (processedHtml.includes('</body>')) {
      processedHtml = processedHtml.replace('</body>', `${trackingPixel}</body>`);
    } else {
      processedHtml += trackingPixel;
    }

    const linkRegex = /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi;
    const matches: Array<{ match: string; url: string }> = [];
    let match;
    while ((match = linkRegex.exec(processedHtml)) !== null) {
      const url = match[2];
      if (!url.startsWith('#') && !url.startsWith('mailto:') && !url.includes('/api/track/') && !url.includes('/unsubscribe')) {
        matches.push({ match: match[0], url });
      }
    }
    
    for (const { match: fullMatch, url } of matches) {
      const trackedUrl = await this.wrapLinkWithTracking(url, campaignId, userId);
      processedHtml = processedHtml.replace(url, trackedUrl);
    }

    return processedHtml;
  }
}

export const trackingService = new TrackingService();
