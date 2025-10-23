// Test script for CMS Marketplace API
const fetch = require('node-fetch');

async function testMarketplaceAPI() {
  console.log('Testing CMS Marketplace API for quote 8AADV5E4...\n');
  
  try {
    // Get session first
    const sessionRes = await fetch('http://localhost:5000/api/session', {
      credentials: 'include',
      headers: {
        'Cookie': 'connect.sid=s%3AgYgOhRxEoUqb3R7g-6kDVlxQdEBMJQRa.rF%2FQgC7aZMQNFjp%2BqOgp4lWwdJRj7J%2BWEaNTrh%2FWhzI' // You'll need to update this
      }
    });
    
    if (!sessionRes.ok) {
      console.log('Not authenticated. Using direct test...');
    }
    
    // Test the marketplace endpoint
    const response = await fetch('http://localhost:5000/api/cms-marketplace/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AgYgOhRxEoUqb3R7g-6kDVlxQdEBMJQRa.rF%2FQgC7aZMQNFjp%2BqOgp4lWwdJRj7J%2BWEaNTrh%2FWhzI'
      },
      body: JSON.stringify({
        quoteId: '8AADV5E4'
      })
    });

    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS! Marketplace API is working\n');
      console.log('Plans found:', data.plans?.length || 0);
      console.log('Coverage year:', data.year);
      console.log('Tax credit:', data.household_aptc ? '$' + data.household_aptc : 'Not eligible');
      
      if (data.plans && data.plans.length > 0) {
        console.log('\nFirst 3 plans:');
        data.plans.slice(0, 3).forEach(plan => {
          console.log(`- ${plan.name} (${plan.metal_level})`);
          console.log(`  Premium: $${plan.premium}/month`);
          if (plan.premium_w_credit) {
            console.log(`  After credit: $${plan.premium_w_credit}/month`);
          }
        });
      }
    } else {
      const error = await response.text();
      console.log('\n❌ Error:', error);
    }
  } catch (error) {
    console.error('\n❌ Failed to test API:', error.message);
  }
}

testMarketplaceAPI();