/**
 * TEMPORARY TEST SCRIPT - Test CMS API with Policy 1c0fe481
 * Run with: tsx test-cms-policy.ts
 */

import { db } from './server/db';
import { policies, policyMembers } from './shared/schema';
import { eq } from 'drizzle-orm';
import { fetchMarketplacePlans } from './server/cms-marketplace';

async function testCMSWithPolicy() {
  console.log('='.repeat(80));
  console.log('🧪 TESTING CMS API WITH POLICY 1c0fe481');
  console.log('='.repeat(80));
  
  try {
    // Fetch policy data
    const policy = await db.query.policies.findFirst({
      where: eq(policies.id, '1c0fe481'),
    });
    
    if (!policy) {
      console.error('❌ Policy 1c0fe481 not found');
      process.exit(1);
    }
    
    console.log('\n📋 POLICY DATA:');
    console.log(`  - ID: ${policy.id}`);
    console.log(`  - Income: $${policy.annualHouseholdIncome || 'NOT SET'}`);
    console.log(`  - Effective Date: ${policy.effectiveDate}`);
    console.log(`  - Zip: ${(policy as any).physical_postal_code}`);
    console.log(`  - County: ${(policy as any).physical_county}`);
    console.log(`  - State: ${(policy as any).physical_state}`);
    console.log(`  - Client DOB: ${policy.clientDateOfBirth}`);
    console.log(`  - Family Size: ${policy.familyGroupSize}`);
    console.log(`  - Spouses: ${Array.isArray(policy.spouses) ? policy.spouses.length : 0}`);
    console.log(`  - Dependents: ${Array.isArray(policy.dependents) ? policy.dependents.length : 0}`);
    
    if (!policy.annualHouseholdIncome) {
      console.error('\n❌ ERROR: Annual household income is not set!');
      process.exit(1);
    }
    
    // Build quote data object
    const quoteData = {
      zipCode: (policy as any).physical_postal_code || '',
      county: (policy as any).physical_county || '',
      state: (policy as any).physical_state || '',
      householdIncome: parseFloat(policy.annualHouseholdIncome),
      effectiveDate: policy.effectiveDate,
      client: {
        dateOfBirth: policy.clientDateOfBirth || '',
        gender: policy.clientGender,
        usesTobacco: policy.clientTobaccoUser || false,
      },
      spouses: Array.isArray(policy.spouses) ? policy.spouses : [],
      dependents: Array.isArray(policy.dependents) ? policy.dependents : [],
    };
    
    console.log('\n🚀 CALLING CMS MARKETPLACE API...\n');
    
    // Call CMS API
    const result = await fetchMarketplacePlans(quoteData, 1, 10);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 CMS API RESPONSE:');
    console.log('='.repeat(80));
    console.log(`  ✅ Total Plans: ${result.total}`);
    console.log(`  💰 Household APTC: $${result.household_aptc || 0}`);
    console.log(`  🏥 Household CSR: ${result.household_csr || 'None'}`);
    console.log(`  🏛️  Is Medicaid/CHIP: ${result.is_medicaid_chip ? 'YES' : 'NO'}`);
    console.log(`  📄 Plans in page: ${result.plans.length}`);
    
    if (result.household_aptc && result.household_aptc > 0) {
      console.log('\n✅ SUCCESS: Received APTC from CMS API!');
      console.log(`   Expected: ~$1,966 (HealthSherpa reference)`);
      console.log(`   Received: $${result.household_aptc}`);
      
      if (result.household_aptc >= 1200 && result.household_aptc <= 2500) {
        console.log('   ✅ APTC is in expected range!');
      } else {
        console.log('   ⚠️  APTC is outside expected range');
      }
    } else {
      console.log('\n❌ WARNING: APTC is $0');
      if (result.is_medicaid_chip) {
        console.log('   Reason: Household is Medicaid/CHIP eligible');
      }
    }
    
    // Show sample plans
    if (result.plans.length > 0) {
      console.log('\n📋 SAMPLE PLANS (first 3):');
      result.plans.slice(0, 3).forEach((plan, idx) => {
        console.log(`\n  ${idx + 1}. ${plan.name}`);
        console.log(`     - Issuer: ${plan.issuer.name}`);
        console.log(`     - Metal Level: ${plan.metal_level}`);
        console.log(`     - Type: ${plan.type}`);
        console.log(`     - Premium: $${plan.premium}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testCMSWithPolicy();
