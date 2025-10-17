// Reference: blueprint:javascript_stripe integration
import Stripe from "stripe";
import { storage } from "./storage";
import type { InsertInvoice, InsertInvoiceItem, InsertPayment, InsertSubscription } from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

// =====================================================
// SUBSCRIPTION MANAGEMENT
// =====================================================

export async function createStripeCustomer(companyId: string, email: string, name: string) {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      companyId,
    },
  });
  return customer;
}

export async function createSubscriptionCheckout(
  companyId: string,
  planId: string,
  stripePriceId: string,
  successUrl: string,
  cancelUrl: string
) {
  // Get or create Stripe customer
  const subscription = await storage.getSubscriptionByCompany(companyId);
  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const company = await storage.getCompany(companyId);
    if (!company) throw new Error("Company not found");
    
    const customer = await createStripeCustomer(companyId, company.email, company.name);
    customerId = customer.id;
  }

  // Get plan to check for setup fee
  const plan = await storage.getPlan(planId);
  if (!plan) throw new Error("Plan not found");

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price: stripePriceId,
      quantity: 1,
    },
  ];

  // Add setup fee if exists (only if plan has a setup fee price ID configured)
  // NOTE: Setup fee prices should be pre-created in Stripe and stored in the plan
  // This avoids creating unlimited Price objects and misaligned accounting
  if (plan.setupFee > 0 && plan.stripeSetupFeePriceId) {
    lineItems.push({
      price: plan.stripeSetupFeePriceId,
      quantity: 1,
    });
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      companyId,
      planId,
    },
  };

  // Add trial period if configured
  if (plan.trialDays > 0) {
    sessionParams.subscription_data = {
      trial_period_days: plan.trialDays,
      metadata: {
        companyId,
        planId,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

export async function cancelStripeSubscription(stripeSubscriptionId: string, cancelAtPeriodEnd: boolean = false) {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  }
}

// =====================================================
// INVOICE MANAGEMENT
// =====================================================

export async function syncInvoiceFromStripe(stripeInvoiceId: string) {
  const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId, {
    expand: ['lines']
  });
  
  // Find company by subscription
  let subscription: any = null;
  if (stripeInvoice.subscription && typeof stripeInvoice.subscription === 'string') {
    subscription = await storage.getSubscriptionByStripeId(stripeInvoice.subscription);
  }
  
  if (!subscription) {
    console.error("Subscription not found for invoice:", stripeInvoiceId);
    return null;
  }

  // Check if invoice already exists
  let invoice = await storage.getInvoiceByStripeId(stripeInvoiceId);
  
  const invoiceData: InsertInvoice = {
    companyId: subscription.companyId,
    subscriptionId: subscription.id,
    invoiceNumber: stripeInvoice.number || `INV-${Date.now()}`,
    status: mapStripeInvoiceStatus(stripeInvoice.status),
    subtotal: stripeInvoice.subtotal_excluding_tax || stripeInvoice.subtotal || 0,
    tax: stripeInvoice.total_tax_amounts?.reduce((sum, t) => sum + t.amount, 0) || 0,
    total: stripeInvoice.total || 0,
    amountPaid: stripeInvoice.amount_paid || 0,
    amountDue: stripeInvoice.amount_due || 0,
    currency: stripeInvoice.currency,
    invoiceDate: new Date(stripeInvoice.created * 1000),
    dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : undefined,
    paidAt: stripeInvoice.status_transitions?.paid_at ? new Date(stripeInvoice.status_transitions.paid_at * 1000) : undefined,
    stripeInvoiceId: stripeInvoiceId,
    stripeHostedInvoiceUrl: stripeInvoice.hosted_invoice_url || undefined,
    stripeInvoicePdf: stripeInvoice.invoice_pdf || undefined,
  };

  if (invoice) {
    invoice = await storage.updateInvoice(invoice.id, invoiceData);
  } else {
    invoice = await storage.createInvoice(invoiceData);
    
    // Create invoice items
    if (stripeInvoice.lines?.data) {
      for (const line of stripeInvoice.lines.data) {
        const itemData: InsertInvoiceItem = {
          invoiceId: invoice!.id,
          description: line.description || "Subscription",
          quantity: line.quantity || 1,
          unitPrice: line.price?.unit_amount || 0,
          amount: line.amount,
          type: line.description?.includes("Setup") ? "setup_fee" : "subscription",
        };
        await storage.createInvoiceItem(itemData);
      }
    }
  }

  return invoice;
}

function mapStripeInvoiceStatus(stripeStatus: string | null): string {
  switch (stripeStatus) {
    case "draft": return "draft";
    case "open": return "open";
    case "paid": return "paid";
    case "void": return "void";
    case "uncollectible": return "uncollectible";
    default: return "draft";
  }
}

// =====================================================
// PAYMENT MANAGEMENT
// =====================================================

export async function recordPayment(
  stripePaymentIntentId: string,
  companyId: string,
  invoiceId: string | null,
  amount: number,
  currency: string,
  status: string,
  paymentMethod: string | null
) {
  const paymentData: InsertPayment = {
    companyId,
    invoiceId: invoiceId || undefined,
    amount,
    currency,
    status,
    paymentMethod: paymentMethod || undefined,
    stripePaymentIntentId,
    processedAt: status === "succeeded" ? new Date() : undefined,
    failedAt: status === "failed" ? new Date() : undefined,
  };

  return await storage.createPayment(paymentData);
}

// =====================================================
// WEBHOOK VERIFICATION
// =====================================================

export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// =====================================================
// WEBHOOK HELPERS
// =====================================================

export async function handleSubscriptionCreated(stripeSubscription: Stripe.Subscription) {
  const companyId = stripeSubscription.metadata.companyId;
  const planId = stripeSubscription.metadata.planId;
  
  if (!companyId || !planId) {
    console.error("Missing metadata in subscription:", stripeSubscription.id);
    return;
  }

  const subscriptionData: InsertSubscription = {
    companyId,
    planId,
    status: mapStripeSubscriptionStatus(stripeSubscription.status),
    trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
    trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    stripeCustomerId: stripeSubscription.customer as string,
    stripeSubscriptionId: stripeSubscription.id,
    stripeLatestInvoiceId: stripeSubscription.latest_invoice as string || undefined,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  };

  await storage.createSubscription(subscriptionData);
}

export async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const subscription = await storage.getSubscriptionByStripeId(stripeSubscription.id);
  if (!subscription) {
    console.error("Subscription not found:", stripeSubscription.id);
    return;
  }

  const updateData: Partial<InsertSubscription> = {
    status: mapStripeSubscriptionStatus(stripeSubscription.status),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  };

  if (stripeSubscription.canceled_at) {
    updateData.cancelledAt = new Date(stripeSubscription.canceled_at * 1000);
  }

  await storage.updateSubscription(subscription.id, updateData);
}

export async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const subscription = await storage.getSubscriptionByStripeId(stripeSubscription.id);
  if (!subscription) {
    console.error("Subscription not found:", stripeSubscription.id);
    return;
  }

  const updateData: Partial<InsertSubscription> = {
    status: "cancelled",
    cancelledAt: new Date(),
  };

  await storage.updateSubscription(subscription.id, updateData);
}

function mapStripeSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled": return "cancelled";
    case "unpaid": return "unpaid";
    default: return "active";
  }
}

// =====================================================
// CUSTOMER PORTAL
// =====================================================

export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

// =====================================================
// INVOICE RETRIEVAL
// =====================================================

export async function getInvoicesForCustomer(customerId: string, limit: number = 10) {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data;
}

export async function getSubscriptionDetails(stripeSubscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['default_payment_method', 'latest_invoice']
  });
  return subscription;
}
