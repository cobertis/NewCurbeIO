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
  addressLine2?: string | null; // Suite, Apt, Unit
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
  // Individual name uses representative's full name
  let individualName = `${company.representativeFirstName || ''} ${company.representativeLastName || ''}`.trim();
  
  // If no representative name provided, find company admin
  if (!individualName) {
    const companyUsers = await storage.getUsersByCompany(company.id);
    const admin = companyUsers.find(u => u.role === 'admin');
    if (admin && (admin.firstName || admin.lastName)) {
      individualName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim();
    }
  }
  
  // Generate UNIQUE invoice prefix from company name initials + timestamp
  // Stripe requires 1-12 uppercase letters or numbers only (no special characters)
  // Invoice prefixes cannot be reused even after customer deletion (Stripe restriction)
  const basePrefix = company.name
    .replace(/[^a-zA-Z\s]/g, '') // Remove special characters
    .split(' ')[0] // Get first word
    .substring(0, 3) // Take first 3 letters
    .toUpperCase(); // Convert to uppercase (e.g., "COB" for Cobertis)
  
  // Add timestamp suffix to ensure uniqueness (last 4 digits of epoch time)
  const uniqueSuffix = Date.now().toString().slice(-4);
  const invoicePrefix = `${basePrefix}${uniqueSuffix}`; // e.g., "COB1234"
  
  const customerData: Stripe.CustomerCreateParams = {
    email: company.representativeEmail || company.email,
    name: individualName || company.name, // Individual's name first, fallback to company name
    phone: company.representativePhone || company.phone,
    invoice_prefix: invoicePrefix, // e.g., "COB-" for "Cobertis Insurance"
    metadata: {
      companyId: company.id,
      companyName: company.name,
      business_name: company.name, // This shows as "Business name" in Stripe UI
      legalName: company.legalName || company.name,
      representativePosition: company.representativePosition || '',
    },
  };

  // Add billing address if available
  if (company.address || company.city || company.state || company.country || company.postalCode) {
    customerData.address = {
      line1: company.address,
      line2: company.addressLine2 || undefined, // Suite, Apt, Unit
      city: company.city || undefined,
      state: company.state || undefined,
      country: company.country || undefined,
      postal_code: company.postalCode || undefined,
    };
  }

  console.log('[STRIPE] Creating customer with complete information:', {
    email: customerData.email,
    name: customerData.name,
    invoicePrefix: customerData.invoice_prefix,
    hasAddress: !!customerData.address,
  });

  const customer = await stripe.customers.create(customerData);
  
  console.log('[STRIPE] Customer created successfully:', customer.id);
  
  return customer;
}

export async function deleteStripeCustomer(customerId: string) {
  try {
    console.log('[STRIPE] Deleting customer:', customerId);
    const deleted = await stripe.customers.del(customerId);
    console.log('[STRIPE] Customer deleted successfully:', deleted.id);
    return deleted;
  } catch (error: any) {
    // If customer doesn't exist in Stripe, log but don't throw
    if (error.code === 'resource_missing') {
      console.log('[STRIPE] Customer already deleted or does not exist:', customerId);
      return null;
    }
    // For other errors, throw to prevent company deletion
    throw error;
  }
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
  trialDays?: number,
  billingPeriod: string = 'monthly'
) {
  console.log('[STRIPE] Creating subscription:', {
    customerId,
    stripePriceId,
    companyId,
    planId,
    trialDays,
    billingPeriod,
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
      billingPeriod,
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
    expand: ['lines', 'subscription']
  }) as any;
  
  console.log('[STRIPE] Syncing invoice:', stripeInvoiceId);
  console.log('[STRIPE] Invoice subscription ID:', stripeInvoice.subscription);
  console.log('[STRIPE] Invoice customer:', stripeInvoice.customer);
  
  // Find company by subscription
  let subscription: any = null;
  if (stripeInvoice.subscription && typeof stripeInvoice.subscription === 'string') {
    subscription = await storage.getSubscriptionByStripeId(stripeInvoice.subscription);
  }
  
  // If subscription not found by subscription ID, try to find by customer ID
  if (!subscription && stripeInvoice.customer) {
    console.log('[STRIPE] Subscription not found by ID, trying by customer:', stripeInvoice.customer);
    subscription = await storage.getSubscriptionByStripeCustomerId(stripeInvoice.customer);
  }
  
  if (!subscription) {
    console.error("[STRIPE] Subscription not found for invoice:", stripeInvoiceId, "Customer:", stripeInvoice.customer);
    
    // For invoices without a subscription (e.g., one-time charges), try to find company by customer
    if (stripeInvoice.customer) {
      const company = await storage.getCompanyByStripeCustomerId(stripeInvoice.customer);
      if (company) {
        console.log('[STRIPE] Found company by customer ID, creating invoice without subscription');
        // Create invoice without subscription ID
        const invoiceData: InsertInvoice = {
          companyId: company.id,
          subscriptionId: undefined, // No subscription for one-time charges
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
        
        let invoice = await storage.getInvoiceByStripeId(stripeInvoiceId);
        if (invoice) {
          invoice = await storage.updateInvoice(invoice.id, invoiceData);
        } else {
          invoice = await storage.createInvoice(invoiceData);
        }
        return invoice;
      }
    }
    
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

  // Helper function to safely convert Stripe timestamps to Date objects
  const toDate = (unixTimestamp?: number | null): Date | undefined => {
    if (typeof unixTimestamp === 'number' && unixTimestamp > 0) {
      return new Date(unixTimestamp * 1000);
    }
    return undefined;
  };

  const subscriptionData: InsertSubscription = {
    companyId,
    planId,
    status: mapStripeSubscriptionStatus(stripeSubscription.status),
    trialStart: toDate(stripeSubscription.trial_start),
    trialEnd: toDate(stripeSubscription.trial_end),
    currentPeriodStart: toDate(stripeSubscription.current_period_start) || new Date(),
    currentPeriodEnd: toDate(stripeSubscription.current_period_end) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

// =====================================================
// SUBSCRIPTION MODIFICATIONS
// =====================================================

export async function skipTrial(stripeSubscriptionId: string) {
  try {
    console.log('[STRIPE] Skipping trial for subscription:', stripeSubscriptionId);
    
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      trial_end: 'now',
    });
    
    console.log('[STRIPE] Trial skipped successfully');
    return subscription;
  } catch (error) {
    console.error('[STRIPE] Error skipping trial:', error);
    throw error;
  }
}

export async function changePlan(
  stripeSubscriptionId: string,
  newStripePriceId: string,
  billingPeriod: 'monthly' | 'yearly'
) {
  try {
    console.log('[STRIPE] Changing plan for subscription:', stripeSubscriptionId);
    console.log('[STRIPE] New price ID:', newStripePriceId);
    
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
    const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newStripePriceId,
      }],
      proration_behavior: 'create_prorations',
    });
    
    console.log('[STRIPE] Plan changed successfully');
    return updatedSubscription;
  } catch (error) {
    console.error('[STRIPE] Error changing plan:', error);
    throw error;
  }
}

export async function applyCoupon(stripeSubscriptionId: string, promoCode: string) {
  try {
    console.log('[STRIPE] Applying promo code to subscription:', stripeSubscriptionId);
    console.log('[STRIPE] Promo code:', promoCode);
    
    // First, try to find the promotion code in Stripe
    const promotionCodes = await stripe.promotionCodes.list({
      code: promoCode,
      limit: 1,
    });
    
    let couponId: string;
    
    if (promotionCodes.data.length > 0) {
      // Found a promotion code, get the coupon ID
      couponId = promotionCodes.data[0].coupon.id;
      console.log('[STRIPE] Found promotion code, using coupon:', couponId);
    } else {
      // No promotion code found, assume it's a direct coupon ID
      // Verify the coupon exists
      try {
        const coupon = await stripe.coupons.retrieve(promoCode);
        couponId = coupon.id;
        console.log('[STRIPE] Using direct coupon ID:', couponId);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          throw new Error(`Invalid promo code or coupon: ${promoCode}`);
        }
        throw error;
      }
    }
    
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      coupon: couponId,
    });
    
    console.log('[STRIPE] Coupon applied successfully');
    return subscription;
  } catch (error) {
    console.error('[STRIPE] Error applying coupon:', error);
    throw error;
  }
}

export async function getPaymentMethods(customerId: string) {
  try {
    console.log('[STRIPE] Retrieving payment methods for customer:', customerId);
    
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    
    console.log('[STRIPE] Found', paymentMethods.data.length, 'payment methods');
    return paymentMethods.data;
  } catch (error) {
    console.error('[STRIPE] Error retrieving payment methods:', error);
    throw error;
  }
}
