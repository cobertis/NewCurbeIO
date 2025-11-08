import crypto from 'crypto';

const APP_URL = process.env.APP_URL || 'http://localhost:5000';

export class TrackingService {
  private secret: string;

  constructor() {
    this.secret = process.env.SESSION_SECRET || '';
    if (!this.secret) {
      throw new Error('SESSION_SECRET is required for tracking service');
    }
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

  getTrackingPixelUrl(campaignId: string, userId: string): string {
    const token = this.generateTrackingToken(campaignId, userId);
    return `${APP_URL}/api/track/open?c=${campaignId}&u=${userId}&t=${token}`;
  }

  wrapLinkWithTracking(url: string, campaignId: string, userId: string): string {
    const token = this.generateTrackingToken(campaignId, userId);
    const encodedUrl = encodeURIComponent(url);
    return `${APP_URL}/api/track/click?c=${campaignId}&u=${userId}&url=${encodedUrl}&t=${token}`;
  }

  injectTrackingIntoHtml(htmlContent: string, campaignId: string, userId: string): string {
    let processedHtml = htmlContent;

    const pixelUrl = this.getTrackingPixelUrl(campaignId, userId);
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
    
    if (processedHtml.includes('</body>')) {
      processedHtml = processedHtml.replace('</body>', `${trackingPixel}</body>`);
    } else {
      processedHtml += trackingPixel;
    }

    const linkRegex = /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi;
    processedHtml = processedHtml.replace(linkRegex, (match, attributes, url) => {
      if (url.startsWith('#') || url.startsWith('mailto:') || url.includes('/api/track/') || url.includes('/unsubscribe')) {
        return match;
      }
      
      const trackedUrl = this.wrapLinkWithTracking(url, campaignId, userId);
      return match.replace(url, trackedUrl);
    });

    return processedHtml;
  }
}

export const trackingService = new TrackingService();
