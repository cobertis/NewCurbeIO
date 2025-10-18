#!/usr/bin/env tsx

/**
 * Script to list all Stripe prices and help sync with database
 * Run with: npm run tsx server/scripts/list-stripe-prices.ts
 */

import { listAllStripePrices } from "../stripe";
import { storage } from "../storage";

async function main() {
  console.log("\n🔍 Fetching Stripe prices...\n");
  
  try {
    const stripePrices = await listAllStripePrices();
    
    console.log("📊 STRIPE PRICES:");
    console.log("=".repeat(80));
    stripePrices.forEach((price, index) => {
      console.log(`\n${index + 1}. ${price.productName}`);
      console.log(`   Price ID: ${price.priceId}`);
      console.log(`   Amount: $${price.amount ? (price.amount / 100).toFixed(2) : '0.00'} ${price.currency.toUpperCase()}`);
      if (price.recurring) {
        console.log(`   Recurring: Every ${price.recurring.intervalCount} ${price.recurring.interval}(s)`);
      }
      console.log(`   Active: ${price.active ? 'Yes' : 'No'}`);
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("\n📋 CURRENT DATABASE PLANS:");
    console.log("=".repeat(80));
    
    const plans = await storage.getAllPlans();
    plans.forEach((plan, index) => {
      console.log(`\n${index + 1}. ${plan.name}`);
      console.log(`   Plan ID: ${plan.id}`);
      console.log(`   Price: $${(plan.price / 100).toFixed(2)}`);
      console.log(`   Monthly Price ID: ${plan.stripePriceId || 'NOT SET'}`);
      console.log(`   Annual Price ID: ${(plan as any).stripeAnnualPriceId || 'NOT SET'}`);
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("\n💡 To update a plan's price IDs, run:");
    console.log("   UPDATE plans SET stripe_price_id = 'price_xxx' WHERE id = 'plan-id';");
    console.log("\n");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
