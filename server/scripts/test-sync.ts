#!/usr/bin/env tsx
/**
 * Test script to sync products from Stripe to database
 */
import { syncProductsFromStripe } from '../stripe';
import { storage } from '../storage';

async function testSync() {
  console.log('🔄 Starting Stripe product sync test...\n');
  
  try {
    // Run the sync
    const syncedProducts = await syncProductsFromStripe();
    
    console.log(`\n📦 Found ${syncedProducts.length} products in Stripe:\n`);
    
    for (const product of syncedProducts) {
      console.log(`  ✅ ${product.productName}`);
      console.log(`     Monthly Price ID: ${product.monthlyPriceId}`);
      console.log(`     Annual Price ID: ${product.annualPriceId || 'Not set'}`);
      console.log(`     Features: ${product.planData.features.join(', ')}`);
      console.log('');
    }
    
    // Now sync to database
    console.log('💾 Syncing to database...\n');
    
    const results = {
      created: [] as any[],
      updated: [] as any[],
    };
    
    for (const product of syncedProducts) {
      // Check if plan already exists by stripeProductId
      const existingPlans = await storage.getAllPlans();
      const existingPlan = existingPlans.find(p => 
        (p as any).stripeProductId === product.productId
      );

      if (existingPlan) {
        // Update existing plan
        console.log(`  🔄 Updating: ${product.productName}`);
        const updated = await storage.updatePlan(existingPlan.id, product.planData);
        results.updated.push(updated);
      } else {
        // Create new plan
        console.log(`  ➕ Creating: ${product.productName}`);
        const created = await storage.createPlan(product.planData);
        results.created.push(created);
      }
    }
    
    console.log('\n✅ Sync complete!');
    console.log(`   Created: ${results.created.length}`);
    console.log(`   Updated: ${results.updated.length}`);
    
    // Show current plans in database
    console.log('\n📋 Current plans in database:\n');
    const allPlans = await storage.getAllPlans();
    for (const plan of allPlans) {
      console.log(`  - ${plan.name} ($${(plan.price / 100).toFixed(2)}/mo)`);
      console.log(`    Monthly: ${plan.stripePriceId}`);
      console.log(`    Annual: ${(plan as any).stripeAnnualPriceId || 'Not set'}`);
      console.log('');
    }
    
  } catch (error: any) {
    console.error('❌ Error during sync:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

testSync();
