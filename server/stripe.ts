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
// PRICE & PRODUCT MANAGEMENT
// =====================================================

/**
 * List all prices from Stripe (for syncing with database)
 */
export async function listAllStripePrices() {
  const prices = await stripe.prices.list({
    limit: 100,
    expand: ['data.product'],
  });
  
  return prices.data.map((price) => {
    const product = price.product as Stripe.Product;
    return {
      priceId: price.id,
      productId: product.id,
      productName: product.name,
      amount: price.unit_amount,
      currency: price.currency,
      recurring: price.recurring ? {
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count,
      } : null,
      active: price.active,
    };
  });
}

/**
 * Validate that a price exists in Stripe
 */
export async function validateStripePrice(priceId: string): Promise<boolean> {
  try {
    await stripe.prices.retrieve(priceId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Sync products and prices from Stripe to database
 * This is the SOURCE OF TRUTH - Stripe products/prices are imported into DB
 * 
 * Features:
 * - Automatic pagination to retrieve ALL active products and prices
 * - Supports monthly-only, annual-only, or both billing cycles
 * - Extracts features from product metadata or description
 * - Per-product error handling to continue sync on failures
 */
export async function syncProductsFromStripe() {
  console.log('[STRIPE-SYNC] Starting product synchronization from Stripe...');
  
  const syncedPlans = [];
  const errors: Array<{product: string, error: string}> = [];

  try {
    // Get ALL active products with manual pagination
    const allProducts: Stripe.Product[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const productsPage: Stripe.ApiList<Stripe.Product> = await stripe.products.list({
        active: true,
        limit: 100,
        starting_after: startingAfter,
        expand: ['data.default_price'],
      });

      allProducts.push(...productsPage.data);
      hasMore = productsPage.has_more;
      if (hasMore && productsPage.data.length > 0) {
        startingAfter = productsPage.data[productsPage.data.length - 1].id;
      }
    }

    console.log(`[STRIPE-SYNC] Retrieved ${allProducts.length} active products from Stripe`);

    // Process each product
    for (const product of allProducts) {
      try {
        console.log(`[STRIPE-SYNC] Processing product: ${product.name}`);
        
        // Get ALL prices for this product with manual pagination
        const allPrices: Stripe.Price[] = [];
        let pricesHasMore = true;
        let pricesStartingAfter: string | undefined = undefined;

        while (pricesHasMore) {
          const pricesPage: Stripe.ApiList<Stripe.Price> = await stripe.prices.list({
            product: product.id,
            active: true,
            limit: 100,
            starting_after: pricesStartingAfter,
          });

          allPrices.push(...pricesPage.data);
          pricesHasMore = pricesPage.has_more;
          if (pricesHasMore && pricesPage.data.length > 0) {
            pricesStartingAfter = pricesPage.data[pricesPage.data.length - 1].id;
          }
        }

        // Separate monthly and annual prices
        const monthlyPrice = allPrices.find(p => 
          p.recurring?.interval === 'month' && p.recurring?.interval_count === 1
        );
        const annualPrice = allPrices.find(p => 
          p.recurring?.interval === 'year' && p.recurring?.interval_count === 1
        );

        // Require at least one billing cycle (monthly OR annual)
        if (!monthlyPrice && !annualPrice) {
          console.log(`[STRIPE-SYNC] Skipping ${product.name} - no monthly or annual price found`);
          errors.push({
            product: product.name,
            error: 'No monthly or annual recurring price found',
          });
          continue;
        }

        // Use monthly price as primary, fallback to annual if monthly not available
        const primaryPrice = monthlyPrice || annualPrice;
        const primaryBillingCycle = monthlyPrice ? 'monthly' : 'yearly';

        // Extract features from product metadata or description
        let features: string[] = [];
        if (product.metadata?.features) {
          try {
            features = JSON.parse(product.metadata.features);
          } catch (e) {
            // If not JSON, split by comma or newline
            features = product.metadata.features.split(/[,\n]/).map(f => f.trim()).filter(Boolean);
          }
        } else if (product.description) {
          // Try to extract features from description
          features = product.description.split('\n').map(f => f.trim()).filter(Boolean);
        }

        const planData = {
          name: product.name,
          description: product.description || null,
          price: monthlyPrice?.unit_amount || annualPrice!.unit_amount || 0,
          annualPrice: annualPrice?.unit_amount || null,
          billingCycle: primaryBillingCycle,
          currency: primaryPrice!.currency || 'usd',
          features: features.length > 0 ? features : ['All core features included'],
          stripePriceId: monthlyPrice?.id || annualPrice!.id, // Store primary price
          stripeAnnualPriceId: annualPrice?.id || null,
          stripeProductId: product.id,
          isActive: true,
          trialDays: 14, // Default trial period
        };

        syncedPlans.push({
          productId: product.id,
          productName: product.name,
          monthlyPriceId: monthlyPrice?.id || null,
          annualPriceId: annualPrice?.id || null,
          planData,
        });

        console.log(`[STRIPE-SYNC] ✓ Synced ${product.name} (${monthlyPrice ? 'monthly' : ''}${monthlyPrice && annualPrice ? '+' : ''}${annualPrice ? 'annual' : ''})`);

      } catch (productError: any) {
        console.error(`[STRIPE-SYNC] Error processing product ${product.name}:`, productError.message);
        errors.push({
          product: product.name,
          error: productError.message,
        });
        // Continue with next product
      }
    }

    console.log(`[STRIPE-SYNC] Completed sync. Successfully synced ${syncedPlans.length} products`);
    if (errors.length > 0) {
      console.log(`[STRIPE-SYNC] Encountered ${errors.length} errors during sync:`, errors);
    }

    return {
      success: true,
      syncedPlans,
      errors,
      stats: {
        total: syncedPlans.length,
        errors: errors.length,
      },
    };

  } catch (error: any) {
    console.error('[STRIPE-SYNC] Fatal error during sync:', error.message);
    return {
      success: false,
      syncedPlans: [],
      errors: [{ product: 'ALL', error: error.message }],
      stats: {
        total: 0,
        errors: 1,
      },
    };
  }
}

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

export async function updateStripeCustomer(customerId: string, data: {
  name?: string;
  email?: string;
  phone?: string;
  address?: Stripe.AddressParam;
  metadata?: Stripe.MetadataParam;
}) {
  console.log('[STRIPE] Updating customer:', customerId, data);
  const updated = await stripe.customers.update(customerId, data);
  console.log('[STRIPE] Customer updated successfully');
  return updated;
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
  // First, retrieve the subscription with schedule to check if there's an active schedule
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['schedule'],
  });
  
  // If subscription has an active schedule, we need to handle it differently
  if (subscription.schedule) {
    console.log('[STRIPE] Subscription has active schedule, releasing it first...');
    const scheduleId = typeof subscription.schedule === 'string' 
      ? subscription.schedule 
      : subscription.schedule.id;
    
    // Release the schedule (which returns control to the subscription)
    await stripe.subscriptionSchedules.release(scheduleId);
    console.log('[STRIPE] Schedule released:', scheduleId);
  }
  
  // Now cancel the subscription
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
    console.log('[STRIPE] Subscription found by customer ID:', subscription ? 'Yes' : 'No');
  }
  
  if (!subscription) {
    console.error("[STRIPE] Subscription not found for invoice:", stripeInvoiceId, "Customer:", stripeInvoice.customer);
    
    // For invoices without a subscription (e.g., one-time charges), try to find company by customer
    if (stripeInvoice.customer) {
      console.log('[STRIPE] Attempting to find company by customer ID:', stripeInvoice.customer);
      const company = await storage.getCompanyByStripeCustomerId(stripeInvoice.customer);
      console.log('[STRIPE] Company found by customer ID:', company ? company.id : 'NOT FOUND');
      
      if (company) {
        console.log('[STRIPE] Found company by customer ID, creating invoice without subscription:', company.name);
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
    currentPeriodStart: toDate((stripeSubscription as any).current_period_start as number) || new Date(),
    currentPeriodEnd: toDate((stripeSubscription as any).current_period_end as number) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    stripeCustomerId: stripeSubscription.customer as string,
    stripeSubscriptionId: stripeSubscription.id,
    stripeLatestInvoiceId: stripeSubscription.latest_invoice as string || undefined,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  };

  // Use UPSERT to atomically insert or update the subscription
  // This prevents race conditions when webhooks arrive in parallel
  console.log('[WEBHOOK] Upserting subscription for company:', companyId);
  await storage.upsertSubscription(subscriptionData);
  
  // Broadcast subscription update to all connected clients
  const { broadcastSubscriptionUpdate } = await import('./websocket');
  broadcastSubscriptionUpdate(companyId);
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

  // IMPORTANT: Only update the plan if there is NO active schedule
  // When a schedule is active, Stripe shows the scheduled plan in items, but the plan hasn't actually changed yet
  // The plan should only update when the schedule executes (which will trigger another webhook)
  if (!stripeSubscription.schedule) {
    // No schedule - plan change is immediate, so update the plan
    console.log('[WEBHOOK] No active schedule, checking for plan change...');
    
    // Get the current price from subscription items
    const priceId = stripeSubscription.items.data[0]?.price.id;
    if (priceId) {
      // Find plan with this Stripe price ID
      const plans = await storage.getAllPlans();
      const matchedPlan = plans.find(p => p.stripePriceId === priceId || p.stripeAnnualPriceId === priceId);
      
      if (matchedPlan && matchedPlan.id !== subscription.planId) {
        console.log('[WEBHOOK] Plan changed from', subscription.planId, 'to', matchedPlan.id);
        updateData.planId = matchedPlan.id;
        
        // Update billing cycle based on which price matched
        if (matchedPlan.stripePriceId === priceId) {
          updateData.billingCycle = 'monthly';
        } else if (matchedPlan.stripeAnnualPriceId === priceId) {
          updateData.billingCycle = 'yearly';
        }
        
        // Update current period dates
        if ((stripeSubscription as any).current_period_start) {
          updateData.currentPeriodStart = new Date((stripeSubscription as any).current_period_start * 1000);
        }
        if ((stripeSubscription as any).current_period_end) {
          updateData.currentPeriodEnd = new Date((stripeSubscription as any).current_period_end * 1000);
        }
      }
    }
  } else {
    console.log('[WEBHOOK] Active schedule detected - preserving current plan until schedule executes');
  }

  await storage.updateSubscription(subscription.id, updateData);
  
  // Broadcast subscription update to all connected clients
  const { broadcastSubscriptionUpdate } = await import('./websocket');
  broadcastSubscriptionUpdate(subscription.companyId);
}

export async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const subscription = await storage.getSubscriptionByStripeId(stripeSubscription.id);
  if (!subscription) {
    console.error("[WEBHOOK] Subscription not found:", stripeSubscription.id);
    return;
  }

  console.log('[WEBHOOK] Processing subscription deletion for company:', subscription.companyId);

  // Update subscription status to cancelled
  const updateData: any = {
    status: "cancelled",
    cancelledAt: new Date(),
  };

  await storage.updateSubscription(subscription.id, updateData);
  
  // CRITICAL: Deactivate company and all its users when subscription ends
  console.log('[WEBHOOK] Deactivating company:', subscription.companyId);
  
  try {
    // 1. Deactivate the company
    const company = await storage.getCompany(subscription.companyId);
    if (company) {
      await storage.updateCompany(subscription.companyId, {
        isActive: false
      });
      console.log('[WEBHOOK] Company deactivated successfully:', subscription.companyId);
    }
    
    // 2. Deactivate all users in the company
    const users = await storage.getUsersByCompany(subscription.companyId);
    console.log('[WEBHOOK] Found', users.length, 'users to deactivate');
    
    for (const user of users) {
      await storage.updateUser(user.id, {
        status: 'deactivated'
      });
    }
    console.log('[WEBHOOK] All users deactivated for company:', subscription.companyId);
    
  } catch (error) {
    console.error('[WEBHOOK] Error deactivating company/users:', error);
    throw error;
  }
  
  // Broadcast subscription update to all connected clients
  const { broadcastSubscriptionUpdate } = await import('./websocket');
  broadcastSubscriptionUpdate(subscription.companyId);
  
  console.log('[WEBHOOK] Subscription deletion processed successfully. Company and all users are now deactivated.');
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
    
    // CRITICAL: Get current subscription to find the trial invoice
    const currentSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
    // If there's a latest invoice from the trial, void it before ending trial
    if (currentSubscription.latest_invoice) {
      const invoiceId = typeof currentSubscription.latest_invoice === 'string' 
        ? currentSubscription.latest_invoice 
        : currentSubscription.latest_invoice.id;
      
      const invoice = await stripe.invoices.retrieve(invoiceId);
      
      // Only void if it's the $0.00 trial invoice that's still open/draft
      if (invoice.total === 0 && (invoice.status === 'open' || invoice.status === 'draft')) {
        console.log('[STRIPE] Voiding trial invoice:', invoice.id);
        await stripe.invoices.voidInvoice(invoice.id);
        console.log('[STRIPE] Trial invoice voided successfully');
      }
    }
    
    // Now end the trial - this will create a new invoice for the actual charge
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
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  newStripePriceId: string,
  billingPeriod: 'monthly' | 'yearly',
  currentTrialStart: Date | null,
  currentTrialEnd: Date | null,
  immediate: boolean = false,
  fallbackCurrentPeriodEnd?: Date | null
) {
  try {
    console.log('[STRIPE] Changing plan for subscription:', stripeSubscriptionId);
    console.log('[STRIPE] Customer ID:', stripeCustomerId);
    console.log('[STRIPE] New price ID:', newStripePriceId);
    
    // Retrieve current subscription with all items
    const currentSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['items.data', 'discounts', 'schedule'],
    });
    
    console.log('[STRIPE] Current subscription status:', currentSubscription.status);
    console.log('[STRIPE] Current items:', currentSubscription.items.data.length);
    console.log('[STRIPE] Subscription object keys:', Object.keys(currentSubscription));
    console.log('[STRIPE] Has current_period_end?', 'current_period_end' in currentSubscription);
    if ((currentSubscription as any).current_period_end) {
      console.log('[STRIPE] current_period_end value:', (currentSubscription as any).current_period_end);
    }
    
    // Get the current subscription item (should be only one)
    const currentItem = currentSubscription.items.data[0];
    if (!currentItem) {
      throw new Error('No subscription items found');
    }
    
    console.log('[STRIPE] Current item object:', JSON.stringify(currentItem, null, 2));
    console.log('[STRIPE] Current item ID:', currentItem.id);
    console.log('[STRIPE] Current price ID:', currentItem.price.id);
    console.log('[STRIPE] New price ID:', newStripePriceId);
    
    // Check if already on this price
    if (currentItem.price.id === newStripePriceId) {
      console.log('[STRIPE] Already on this plan, no changes needed');
      return currentSubscription;
    }
    
    // If immediate upgrade, use simple proration
    if (immediate) {
      console.log('[STRIPE] Performing immediate upgrade with proration...');
      
      const updateData: any = {
        items: [{
          id: currentItem.id,
          price: newStripePriceId,
        }],
        // Enable proration - Stripe will:
        // 1. Credit unused time on current plan
        // 2. Charge for new plan (prorated)
        // 3. Customer pays the difference
        proration_behavior: 'create_prorations',
      };
      
      // Preserve active discount if it exists
      if (currentSubscription.discounts && currentSubscription.discounts.length > 0) {
        const discount = currentSubscription.discounts[0];
        if (typeof discount !== 'string' && discount) {
          const activeDiscount = discount as any;
          
          // Get coupon ID - Stripe structure can vary:
          // New: discount.source.coupon (string or object)
          // Old: discount.coupon (string or object)
          let couponId: string | undefined;
          
          try {
            if (activeDiscount.source?.coupon) {
              // New structure: discount.source.coupon
              if (typeof activeDiscount.source.coupon === 'string') {
                couponId = activeDiscount.source.coupon;
              } else if (activeDiscount.source.coupon && typeof activeDiscount.source.coupon === 'object') {
                couponId = activeDiscount.source.coupon.id;
              }
            } else if (activeDiscount.coupon) {
              // Old structure: discount.coupon
              if (typeof activeDiscount.coupon === 'string') {
                couponId = activeDiscount.coupon;
              } else if (activeDiscount.coupon && typeof activeDiscount.coupon === 'object') {
                couponId = activeDiscount.coupon.id;
              }
            }
            
            if (couponId) {
              updateData.discounts = [{
                coupon: couponId
              }];
              console.log('[STRIPE] Preserving discount with coupon:', couponId);
            }
          } catch (discountError) {
            console.warn('[STRIPE] Error preserving discount, continuing without it:', discountError);
            // Continue without discount if there's an error
          }
        }
      }
      
      const updatedSubscription = await stripe.subscriptions.update(
        stripeSubscriptionId,
        updateData
      );
      
      console.log('[STRIPE] Subscription updated with proration');
      
      // CRITICAL: Create and pay invoice immediately for immediate upgrades
      // Without this, prorated items are added to the next regular invoice
      console.log('[STRIPE] Creating immediate invoice for upgrade...');
      const invoice = await stripe.invoices.create({
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        auto_advance: true, // Automatically finalize and attempt payment
      });
      
      console.log('[STRIPE] Invoice created:', invoice.id);
      
      // Finalize and pay the invoice immediately
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      console.log('[STRIPE] Invoice finalized:', finalizedInvoice.id);
      
      // Pay the invoice if it's not already paid
      if (finalizedInvoice.status === 'open') {
        console.log('[STRIPE] Paying invoice immediately...');
        const paidInvoice = await stripe.invoices.pay(invoice.id);
        console.log('[STRIPE] Invoice paid successfully:', paidInvoice.id);
      }
      
      console.log('[STRIPE] Immediate upgrade completed with immediate payment');
      return updatedSubscription;
    }
    
    // Otherwise, schedule the change for end of period
    console.log('[STRIPE] Scheduling plan change for end of billing period...');
    
    // Get current period end timestamp - try from Stripe first, then use fallback from database
    let periodEndTimestamp = (currentSubscription as any).current_period_end;
    
    if (!periodEndTimestamp || typeof periodEndTimestamp !== 'number') {
      // Stripe doesn't have current_period_end (can happen with cancelled subscriptions)
      // Use fallback from database
      if (fallbackCurrentPeriodEnd) {
        periodEndTimestamp = Math.floor(fallbackCurrentPeriodEnd.getTime() / 1000);
        console.log('[STRIPE] Using fallback current_period_end from database:', fallbackCurrentPeriodEnd.toISOString());
      } else {
        throw new Error('Unable to get current period end from subscription or database');
      }
    } else {
      console.log('[STRIPE] Using current_period_end from Stripe');
    }
    
    console.log('[STRIPE] Current period ends at:', new Date(periodEndTimestamp * 1000).toISOString());
    
    // Check if there's an existing schedule
    if (currentSubscription.schedule) {
      console.log('[STRIPE] Canceling existing schedule');
      const scheduleId = typeof currentSubscription.schedule === 'string'
        ? currentSubscription.schedule
        : currentSubscription.schedule.id;
      await stripe.subscriptionSchedules.release(scheduleId);
    }
    
    // Step 1: Create subscription schedule FROM the existing subscription
    // Note: When using from_subscription, Stripe creates the first phase automatically
    // Cannot set end_behavior when using from_subscription
    console.log('[STRIPE] Step 1: Creating subscription schedule from existing subscription...');
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: stripeSubscriptionId,
    });
    
    console.log('[STRIPE] Schedule created:', schedule.id);
    console.log('[STRIPE] Initial phases:', schedule.phases.length);
    
    // Step 2: Update the schedule to add the new phase
    // We must include the current phase + the new phase
    console.log('[STRIPE] Step 2: Updating schedule to add new plan phase...');
    
    // Get the start_date from the existing phase
    const currentPhaseStartDate = schedule.phases[0].start_date;
    console.log('[STRIPE] Current phase start date:', new Date(currentPhaseStartDate * 1000).toISOString());
    
    // Prepare phases for update
    const phases: any[] = [
      // Phase 1: Current plan until period end (from existing schedule)
      {
        items: schedule.phases[0].items.map((item: any) => ({
          price: item.price,
          quantity: item.quantity || 1,
        })),
        start_date: currentPhaseStartDate, // Required to anchor end dates
        end_date: periodEndTimestamp,
        // Preserve discount from current phase if exists
        ...(schedule.phases[0].discounts && schedule.phases[0].discounts.length > 0 && {
          discounts: schedule.phases[0].discounts.map((d: any) => ({
            coupon: typeof d.coupon === 'string' ? d.coupon : d.coupon.id
          }))
        }),
      },
      // Phase 2: New plan starting at period end
      {
        items: [{
          price: newStripePriceId,
          quantity: 1,
        }],
        // Preserve active discount if it exists
        ...(currentSubscription.discounts && currentSubscription.discounts.length > 0 && {
          discounts: currentSubscription.discounts.map((d: any) => {
            const coupon = d.coupon;
            const couponId = typeof coupon === 'string' ? coupon : coupon.id;
            console.log('[STRIPE] Preserving discount with coupon:', couponId);
            return { coupon: couponId };
          })
        }),
      },
    ];
    
    // Update the schedule with both phases
    // Set end_behavior to 'release' so after phases complete, subscription continues normally
    const updatedSchedule = await stripe.subscriptionSchedules.update(
      schedule.id,
      { 
        phases: phases,
        end_behavior: 'release'
      }
    );
    
    console.log('[STRIPE] Subscription schedule updated successfully');
    console.log('[STRIPE] Plan will change on:', new Date(periodEndTimestamp * 1000).toISOString());
    
    // Retrieve the updated subscription
    const updatedSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
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
      expand: ['data.coupon'],
    });
    
    let couponId: string;
    
    if (promotionCodes.data.length > 0) {
      // Found a promotion code, get the coupon ID
      const promoCode = promotionCodes.data[0] as any;
      const coupon = promoCode.coupon as string | Stripe.Coupon;
      couponId = typeof coupon === 'string' ? coupon : coupon.id;
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
      discounts: [{ coupon: couponId }],
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

// =====================================================
// TEMPORARY DISCOUNTS
// =====================================================

export async function createTemporaryDiscountCoupon(
  percentOff: number,
  durationInMonths: number,
  companyName: string
): Promise<Stripe.Coupon> {
  try {
    console.log('[STRIPE] Creating temporary discount coupon');
    console.log('[STRIPE] Percent off:', percentOff);
    console.log('[STRIPE] Duration:', durationInMonths, 'months');
    
    const couponId = `DISCOUNT_${percentOff}_${durationInMonths}M_${Date.now()}`;
    
    const coupon = await stripe.coupons.create({
      id: couponId,
      percent_off: percentOff,
      duration: 'repeating',
      duration_in_months: durationInMonths,
      metadata: {
        company_name: companyName,
        created_for: 'temporary_discount',
        months: durationInMonths.toString(),
      },
    });
    
    console.log('[STRIPE] Temporary discount coupon created:', coupon.id);
    return coupon;
  } catch (error) {
    console.error('[STRIPE] Error creating temporary discount coupon:', error);
    throw error;
  }
}

export async function applyTemporaryDiscount(
  stripeSubscriptionId: string,
  couponId: string
): Promise<Stripe.Subscription> {
  try {
    console.log('[STRIPE] Applying temporary discount to subscription:', stripeSubscriptionId);
    console.log('[STRIPE] Coupon ID:', couponId);
    
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      discounts: [{ coupon: couponId }],
    });
    
    console.log('[STRIPE] Temporary discount applied successfully');
    return subscription;
  } catch (error) {
    console.error('[STRIPE] Error applying temporary discount:', error);
    throw error;
  }
}

export async function removeDiscount(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  try {
    console.log('[STRIPE] Removing discount from subscription:', stripeSubscriptionId);
    
    // First, delete the discount using the proper Stripe method
    await stripe.subscriptions.deleteDiscount(stripeSubscriptionId);
    
    // Then retrieve the updated subscription
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
    console.log('[STRIPE] Discount removed successfully');
    return subscription;
  } catch (error) {
    console.error('[STRIPE] Error removing discount:', error);
    throw error;
  }
}

export async function getSubscriptionDiscount(
  stripeSubscriptionId: string
): Promise<Stripe.Discount | null> {
  try {
    console.log('[STRIPE] Getting discount for subscription:', stripeSubscriptionId);
    
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['discounts'],
    });
    
    // Check for discounts (plural array) - modern Stripe API
    if (subscription.discounts && subscription.discounts.length > 0) {
      const discount = subscription.discounts[0];
      if (typeof discount !== 'string') {
        console.log('[STRIPE] Found discount:', discount);
        // Expand the coupon information
        const expandedDiscount = discount as any;
        
        console.log('[STRIPE] Discount.coupon type:', typeof expandedDiscount.coupon);
        console.log('[STRIPE] Discount.source:', expandedDiscount.source);
        
        // Handle different coupon locations in Stripe API
        let couponId: string | null = null;
        if (typeof expandedDiscount.coupon === 'string') {
          console.log('[STRIPE] Coupon is a string ID');
          couponId = expandedDiscount.coupon;
        } else if (expandedDiscount.source && typeof expandedDiscount.source.coupon === 'string') {
          console.log('[STRIPE] Coupon is in source.coupon');
          couponId = expandedDiscount.source.coupon;
        } else if (expandedDiscount.coupon && typeof expandedDiscount.coupon === 'object') {
          console.log('[STRIPE] Coupon is already an object, returning as-is');
          return expandedDiscount as Stripe.Discount;
        }
        
        // Fetch and attach the full coupon object
        if (couponId) {
          console.log('[STRIPE] Fetching coupon details for:', couponId);
          const coupon = await stripe.coupons.retrieve(couponId);
          expandedDiscount.coupon = coupon;
          return expandedDiscount as Stripe.Discount;
        }
        
        // If no coupon found but we have a discount, return it anyway
        console.log('[STRIPE] No coupon found, returning discount as-is');
        return expandedDiscount as Stripe.Discount;
      }
    }
    
    console.log('[STRIPE] No discount found for subscription');
    return null;
  } catch (error) {
    console.error('[STRIPE] Error getting subscription discount:', error);
    throw error;
  }
}
