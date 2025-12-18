import { trackEvent } from './index';

export function trackLeadViewed(leadId: string, leadName?: string): void {
  trackEvent('lead_viewed', {
    lead_id: leadId,
    lead_name: leadName || 'Unknown',
  });
}

export function trackLeadCreated(leadId: string, leadName?: string, source?: string): void {
  trackEvent('lead_created', {
    lead_id: leadId,
    lead_name: leadName || 'Unknown',
    source: source || 'manual',
  });
}

export function trackLeadConverted(leadId: string, leadName?: string): void {
  trackEvent('lead_converted', {
    lead_id: leadId,
    lead_name: leadName || 'Unknown',
  });
}

export function trackSmsSent(recipientPhone: string, messageLength: number): void {
  trackEvent('sms_sent', {
    recipient_phone: recipientPhone,
    message_length: messageLength,
  });
}

export function trackSmsReceived(senderPhone: string): void {
  trackEvent('sms_received', {
    sender_phone: senderPhone,
  });
}

export function trackEmailSent(recipientEmail: string, subject?: string): void {
  trackEvent('email_sent', {
    recipient_email: recipientEmail,
    subject: subject || '',
  });
}

export function trackCallMade(phoneNumber: string, durationSeconds?: number): void {
  trackEvent('call_made', {
    phone_number: phoneNumber,
    duration_seconds: durationSeconds || 0,
  });
}

export function trackCallReceived(phoneNumber: string, durationSeconds?: number): void {
  trackEvent('call_received', {
    phone_number: phoneNumber,
    duration_seconds: durationSeconds || 0,
  });
}

export function trackPolicyCreated(policyId: string, policyType?: string): void {
  trackEvent('policy_created', {
    policy_id: policyId,
    policy_type: policyType || 'unknown',
  });
}

export function trackPolicyRenewed(policyId: string, policyType?: string): void {
  trackEvent('policy_renewed', {
    policy_id: policyId,
    policy_type: policyType || 'unknown',
  });
}

export function trackPolicyCancelled(policyId: string, reason?: string): void {
  trackEvent('policy_cancelled', {
    policy_id: policyId,
    reason: reason || '',
  });
}

export function trackQuoteCreated(quoteId: string, quoteType?: string): void {
  trackEvent('quote_created', {
    quote_id: quoteId,
    quote_type: quoteType || 'unknown',
  });
}

export function trackQuoteConverted(quoteId: string, policyId: string): void {
  trackEvent('quote_converted', {
    quote_id: quoteId,
    policy_id: policyId,
  });
}

export function trackAppointmentScheduled(appointmentId: string, appointmentType?: string): void {
  trackEvent('appointment_scheduled', {
    appointment_id: appointmentId,
    appointment_type: appointmentType || 'general',
  });
}

export function trackAppointmentCompleted(appointmentId: string): void {
  trackEvent('appointment_completed', {
    appointment_id: appointmentId,
  });
}

export function trackTaskCreated(taskId: string, taskTitle?: string): void {
  trackEvent('task_created', {
    task_id: taskId,
    task_title: taskTitle || '',
  });
}

export function trackTaskCompleted(taskId: string, taskTitle?: string): void {
  trackEvent('task_completed', {
    task_id: taskId,
    task_title: taskTitle || '',
  });
}

export function trackContactCreated(contactId: string, contactName?: string): void {
  trackEvent('contact_created', {
    contact_id: contactId,
    contact_name: contactName || 'Unknown',
  });
}

export function trackCampaignLaunched(campaignId: string, campaignName?: string, recipientCount?: number): void {
  trackEvent('campaign_launched', {
    campaign_id: campaignId,
    campaign_name: campaignName || '',
    recipient_count: recipientCount || 0,
  });
}

export function trackDocumentUploaded(documentId: string, documentType?: string): void {
  trackEvent('document_uploaded', {
    document_id: documentId,
    document_type: documentType || 'unknown',
  });
}

export function trackPaymentReceived(paymentId: string, amount: number, currency?: string): void {
  trackEvent('payment_received', {
    payment_id: paymentId,
    amount: amount,
    currency: currency || 'USD',
  });
}

export function trackIMessageSent(recipientPhone: string): void {
  trackEvent('imessage_sent', {
    recipient_phone: recipientPhone,
  });
}

export function trackPageViewed(pageName: string, pageUrl?: string): void {
  trackEvent('page_viewed', {
    page_name: pageName,
    page_url: pageUrl || window.location.href,
  });
}

export function trackFeatureUsed(featureName: string, metadata?: Record<string, string | number | boolean>): void {
  trackEvent('feature_used', {
    feature_name: featureName,
    ...metadata,
  });
}
