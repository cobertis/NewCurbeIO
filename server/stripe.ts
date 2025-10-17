// Reference: blueprint:javascript_stripe integration
import Stripe from "stripe";
import { storage } from "./storage";
import type { InsertInvoice, InsertInvoiceItem, InsertPayment, InsertSubscription } from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// Log which Stripe mode we're using
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripeMode = stripeKey.startsWith('sk_test_') ? 'TEST MODE' : 
                   stripeKey.startsWith('sk_live_') ? 'LIVE/PRODUCTION MODE' : 'UNKNOWN';
console.log('==========================================');
console.log(`🔑 STRIPE INITIALIZED: ${stripeMode}`);
console.log(`🔑 Key prefix: ${stripeKey.substring(0, 12)}...`);
console.log('==========================================');

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

// =====================================================
// SUBSCRIPTION MANAGEMENT
// =====================================================

export async function createStripeCustomer(company: {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  representativeFirstName?: string | null;
  representativeLastName?: string | null;
  representativeEmail?: string | null;
  representativePhone?: string | null;
  representativePosition?: string | null;
  legalName?: string | null;
}) {
  // Build customer data with complete information
  const customerData: Stripe.CustomerCreateParams = {
    email: company.representativeEmail || company.email,
    name: company.legalName || company.name,
    phone: company.representativePhone || company.phone,
    metadata: {
      companyId: company.id,
      companyName: company.name,
      representativePosition: company.representativePosition || '',
    },
  };

  // Add address if available
  if (company.address || company.city || company.state || company.country || company.postalCode) {
    customerData.address = {
      line1: company.address,
      city: company.city || undefined,
      state: company.state || undefined,
      country: company.country || undefined,
      postal_code: company.postalCode || undefined,
    };
  }

  // Add shipping address (same as billing for now)
  if (customerData.address) {
    customerData.shipping = {
      name: `${company.representativeFirstName || ''} ${company.representativeLastName || ''}`.trim() || company.name,
      phone: company.representativePhone || company.phone,
      address: customerData.address,
    };
  }

  console.log('[STRIPE] Creating customer with complete information:', {
    email: customerData.email,
    name: customerData.name,
    hasAddress: !!customerData.address,
    hasShipping: !!customerData.shipping,
  });

  const customer = await stripe.customers.create(customerData);
  
  console.log('[STRIPE] Customer created successfully:', customer.id);
  
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
    
    const customer = await createStripeCustomer(company);
    customerId = customer.id;
    
    // Update company with Stripe customer ID
    await storage.updateCompany(companyId, { stripeCustomerId: customerId });
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

/**
 * Create a real Stripe subscription for manual plan assignment
 * This creates a subscription that will auto-bill the customer
 */
export async function createStripeSubscription(
  customerId: string,
  stripePriceId: string,
  companyId: string,
  planId: string,
  trialDays?: number
) {
  console.log('[STRIPE] Creating subscription:', {
    customerId,
    stripePriceId,
    companyId,
    planId,
    trialDays,
  });

  const subscriptionData: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [
      {
        price: stripePriceId,
      },
    ],
    metadata: {
      companyId,
      planId,
    },
    // Automatically collect payment
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    // Expand to get full invoice and payment intent details
    expand: ['latest_invoice.payment_intent'],
  };

  // Add trial if specified
  if (trialDays && trialDays > 0) {
    subscriptionData.trial_period_days = trialDays;
  }

  const subscription = await stripe.subscriptions.create(subscriptionData);
  
  console.log('[STRIPE] Subscription created:', subscription.id);
  console.log('[STRIPE] Status:', subscription.status);
  
  return subscription;
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
  }) as any;
  
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
    tax: stripeInvoice.total_tax_amounts?.reduce((sum: number, t: any) => sum + t.amount, 0) || 0,
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
  const paymentData: any = {
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

  const updateData: any = {
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

  const updateData: any = {
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

// =====================================================
// PLAN SYNCHRONIZATION WITH STRIPE
// =====================================================

/**
 * Sync a local plan with Stripe
 * Creates a Product and recurring Price in Stripe
 * Optionally creates a one-time setup fee Price
 * Returns the Stripe Product ID, Price ID, and Setup Fee Price ID
 */
export async function syncPlanWithStripe(plan: {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  billingCycle: string;
  setupFee: number;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  stripeSetupFeePriceId?: string | null;
}) {
  try {
    const currentKey = process.env.STRIPE_SECRET_KEY || '';
    const keyMode = currentKey.startsWith('sk_test_') ? '🟢 TEST' : 
                    currentKey.startsWith('sk_live_') ? '🔴 LIVE' : '❓ UNKNOWN';
    console.log('='.repeat(70));
    console.log('[STRIPE SYNC] Starting sync for plan:', plan.name, 'ID:', plan.id);
    console.log(`[STRIPE SYNC] Using Stripe key mode: ${keyMode} (${currentKey.substring(0, 15)}...)`);
    console.log('[STRIPE SYNC] Existing Stripe Product ID:', plan.stripeProductId);
    console.log('[STRIPE SYNC] Existing Stripe Price ID:', plan.stripePriceId);
    console.log('='.repeat(70));
    
    // Convert billingCycle to Stripe interval format
    const stripeInterval = plan.billingCycle === 'monthly' ? 'month' 
                          : plan.billingCycle === 'yearly' ? 'year'
                          : plan.billingCycle as 'month' | 'year';

    // Step 1: Create or update Stripe Product
    let product: Stripe.Product;
    
    if (plan.stripeProductId) {
      console.log('[STRIPE SYNC] Updating existing product:', plan.stripeProductId);
      try {
        // Verify product exists before updating
        product = await stripe.products.retrieve(plan.stripeProductId);
        
        // Update existing product
        product = await stripe.products.update(plan.stripeProductId, {
          name: plan.name,
          description: plan.description || undefined,
          active: true,
          metadata: {
            localPlanId: plan.id,
          },
        });
        console.log('[STRIPE SYNC] Successfully updated product:', product.id);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          console.log('[STRIPE SYNC] Product not found in Stripe, creating new one');
          // Product doesn't exist, create new one
          product = await stripe.products.create({
            name: plan.name,
            description: plan.description || undefined,
            metadata: {
              localPlanId: plan.id,
            },
          });
          console.log('[STRIPE SYNC] Created new product:', product.id);
        } else {
          throw error;
        }
      }
    } else {
      console.log('[STRIPE SYNC] Creating new product for:', plan.name);
      // Create new product
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          localPlanId: plan.id,
        },
      });
      console.log('[STRIPE SYNC] Created new product:', product.id);
    }

    // Step 2: Create or update recurring Price
    let recurringPrice: Stripe.Price;
    
    if (plan.stripePriceId) {
      console.log('[STRIPE SYNC] Checking existing price:', plan.stripePriceId);
      try {
        // Note: Stripe prices are immutable, so we need to create a new one if amount changed
        // First, get the existing price to check if it needs to be replaced
        const existingPrice = await stripe.prices.retrieve(plan.stripePriceId);
        
        if (existingPrice.unit_amount !== plan.price) {
          console.log('[STRIPE SYNC] Price amount changed, creating new price');
          // Deactivate old price and create new one
          await stripe.prices.update(plan.stripePriceId, { active: false });
          
          recurringPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.price,
            currency: plan.currency,
            recurring: {
              interval: stripeInterval,
            },
            metadata: {
              localPlanId: plan.id,
            },
          });
          console.log('[STRIPE SYNC] Created new price:', recurringPrice.id);
        } else {
          console.log('[STRIPE SYNC] Price unchanged, using existing:', existingPrice.id);
          recurringPrice = existingPrice;
        }
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          console.log('[STRIPE SYNC] Price not found in Stripe, creating new one');
          // Price doesn't exist, create new one
          recurringPrice = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.price,
            currency: plan.currency,
            recurring: {
              interval: stripeInterval,
            },
            metadata: {
              localPlanId: plan.id,
            },
          });
          console.log('[STRIPE SYNC] Created new price:', recurringPrice.id);
        } else {
          throw error;
        }
      }
    } else {
      console.log('[STRIPE SYNC] Creating new recurring price');
      // Create new recurring price
      recurringPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: plan.currency,
        recurring: {
          interval: stripeInterval,
        },
        metadata: {
          localPlanId: plan.id,
        },
      });
      console.log('[STRIPE SYNC] Created new price:', recurringPrice.id);
    }

    // Step 3: Create or update setup fee Price (one-time) if needed
    let setupFeePrice: Stripe.Price | null = null;
    
    if (plan.setupFee > 0) {
      if (plan.stripeSetupFeePriceId) {
        console.log('[STRIPE SYNC] Checking existing setup fee price:', plan.stripeSetupFeePriceId);
        try {
          // Check if amount changed
          const existingSetupPrice = await stripe.prices.retrieve(plan.stripeSetupFeePriceId);
          
          if (existingSetupPrice.unit_amount !== plan.setupFee) {
            console.log('[STRIPE SYNC] Setup fee changed, creating new price');
            // Deactivate old price and create new one
            await stripe.prices.update(plan.stripeSetupFeePriceId, { active: false });
            
            setupFeePrice = await stripe.prices.create({
              product: product.id,
              unit_amount: plan.setupFee,
              currency: plan.currency,
              metadata: {
                localPlanId: plan.id,
                type: 'setup_fee',
              },
            });
            console.log('[STRIPE SYNC] Created new setup fee price:', setupFeePrice.id);
          } else {
            console.log('[STRIPE SYNC] Setup fee unchanged, using existing:', existingSetupPrice.id);
            setupFeePrice = existingSetupPrice;
          }
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            console.log('[STRIPE SYNC] Setup fee price not found, creating new one');
            // Price doesn't exist, create new one
            setupFeePrice = await stripe.prices.create({
              product: product.id,
              unit_amount: plan.setupFee,
              currency: plan.currency,
              metadata: {
                localPlanId: plan.id,
                type: 'setup_fee',
              },
            });
            console.log('[STRIPE SYNC] Created new setup fee price:', setupFeePrice.id);
          } else {
            throw error;
          }
        }
      } else {
        console.log('[STRIPE SYNC] Creating new setup fee price');
        // Create new setup fee price
        setupFeePrice = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.setupFee,
          currency: plan.currency,
          metadata: {
            localPlanId: plan.id,
            type: 'setup_fee',
          },
        });
        console.log('[STRIPE SYNC] Created new setup fee price:', setupFeePrice.id);
      }
    }

    return {
      stripeProductId: product.id,
      stripePriceId: recurringPrice.id,
      stripeSetupFeePriceId: setupFeePrice?.id || null,
    };
  } catch (error) {
    console.error("Error syncing plan with Stripe:", error);
    throw error;
  }
}
