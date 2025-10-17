import Stripe from 'stripe';

// Load environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

console.log('='.repeat(60));
console.log('STRIPE MODE VERIFICATION');
console.log('='.repeat(60));

// Check which key is being used
if (!STRIPE_SECRET_KEY) {
  console.error('❌ ERROR: STRIPE_SECRET_KEY not found in environment');
  process.exit(1);
}

console.log('\n1. STRIPE SECRET KEY:');
console.log(`   Prefix: ${STRIPE_SECRET_KEY.substring(0, 8)}...`);
console.log(`   Full prefix: ${STRIPE_SECRET_KEY.substring(0, 16)}...`);

if (STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.log('   ✅ TEST MODE KEY DETECTED');
} else if (STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  console.log('   ⚠️  LIVE MODE KEY DETECTED');
} else {
  console.log('   ❓ UNKNOWN KEY FORMAT');
}

// Initialize Stripe
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

async function verifyMode() {
  try {
    console.log('\n2. LISTING PRODUCTS FROM STRIPE:');
    
    // List products
    const products = await stripe.products.list({ limit: 10 });
    
    console.log(`   Found ${products.data.length} products\n`);
    
    if (products.data.length === 0) {
      console.log('   ⚠️  No products found in this environment');
    } else {
      products.data.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name}`);
        console.log(`      ID: ${product.id}`);
        console.log(`      Live Mode: ${product.livemode ? '🔴 YES (PRODUCTION)' : '🟢 NO (TEST MODE)'}`);
        console.log(`      Active: ${product.active}`);
        console.log('');
      });
    }
    
    // Check if any product is in live mode
    const hasLiveProducts = products.data.some(p => p.livemode === true);
    const hasTestProducts = products.data.some(p => p.livemode === false);
    
    console.log('3. SUMMARY:');
    console.log(`   Test products: ${hasTestProducts ? '✅ Yes' : '❌ No'}`);
    console.log(`   Live products: ${hasLiveProducts ? '⚠️  Yes' : '✅ No'}`);
    
    console.log('\n4. DIAGNOSIS:');
    if (STRIPE_SECRET_KEY.startsWith('sk_test_') && hasLiveProducts) {
      console.log('   ❌ PROBLEM: You have a TEST key but products are in LIVE mode!');
      console.log('   This should be impossible. Check if:');
      console.log('   - You\'re viewing the wrong Stripe account');
      console.log('   - There\'s a key mismatch somewhere');
    } else if (STRIPE_SECRET_KEY.startsWith('sk_test_') && hasTestProducts) {
      console.log('   ✅ CORRECT: Test key with test products');
    } else if (STRIPE_SECRET_KEY.startsWith('sk_live_') && hasLiveProducts) {
      console.log('   ⚠️  WARNING: You are using LIVE mode with LIVE products');
      console.log('   Switch to test keys if you want to test!');
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR calling Stripe API:');
    console.error(error.message);
  }
}

verifyMode();
