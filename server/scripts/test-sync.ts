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
    const syncResult = await syncProductsFromStripe();
    
    if (!syncResult.success) {
      console.error('❌ Sync failed with fatal error:', syncResult.errors);
      process.exit(1);
    }
    
    console.log(`\n📦 Found ${syncResult.syncedPlans.length} products in Stripe:\n`);
    
    for (const product of syncResult.syncedPlans) {
      console.log(`  ✅ ${product.productName}`);
      console.log(`     Monthly Price ID: ${product.monthlyPriceId || 'Not set'}`);
      console.log(`     Annual Price ID: ${product.annualPriceId || 'Not set'}`);
      console.log(`     Features: ${product.planData.features.join(', ')}`);
      console.log('');
    }
    
    if (syncResult.errors.length > 0) {
      console.log(`\n⚠️  Encountered ${syncResult.errors.length} errors during Stripe sync:\n`);
      for (const err of syncResult.errors) {
        console.log(`  ⨯ ${err.product}: ${err.error}`);
      }
      console.log('');
    }
    
    // Now sync to database
    console.log('💾 Syncing to database...\n');
    
    const results = {
      created: [] as any[],
      updated: [] as any[],
      failed: [] as any[],
    };
    
    // Fetch all existing plans ONCE and index by stripeProductId for O(1) lookups
    const existingPlans = await storage.getAllPlans();
    const plansByProductId = new Map(
      existingPlans
        .filter(p => (p as any).stripeProductId) // Only plans with stripeProductId
        .map(p => [(p as any).stripeProductId, p])
    );
    
    console.log(`   Found ${plansByProductId.size} existing plans in database\n`);
    
    for (const product of syncResult.syncedPlans) {
      try {
        const existingPlan = plansByProductId.get(product.productId);

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
      } catch (dbError: any) {
        console.error(`  ⨯ Database error for ${product.productName}:`, dbError.message);
        results.failed.push({
          product: product.productName,
          error: dbError.message,
        });
      }
    }
    
    console.log('\n✅ Sync complete!');
    console.log(`   Created: ${results.created.length}`);
    console.log(`   Updated: ${results.updated.length}`);
    console.log(`   Failed: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
      console.log('\n⚠️  Failed products:');
      for (const fail of results.failed) {
        console.log(`  ⨯ ${fail.product}: ${fail.error}`);
      }
    }
    
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
