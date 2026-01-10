import { calculateAllowedActions } from "../services/policy-engine";

const COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";
const CAMPAIGN_ID = "curl-test-campaign-001";
const CONTACT_ID = "curl-test-contact-001";

async function testEndpoint() {
  console.log("=== Policy Engine Endpoint Test ===\n");
  console.log(`Testing with:`);
  console.log(`  companyId: ${COMPANY_ID}`);
  console.log(`  campaignId: ${CAMPAIGN_ID}`);
  console.log(`  contactId: ${CONTACT_ID}\n`);
  
  console.log("Calling calculateAllowedActions()...\n");
  
  const result = await calculateAllowedActions(COMPANY_ID, CAMPAIGN_ID, CONTACT_ID);
  
  console.log("=== Response JSON ===");
  console.log(JSON.stringify(result, null, 2));
  
  console.log("\n=== Curl Equivalent ===");
  console.log(`curl -X GET "http://localhost:5000/api/campaigns/${CAMPAIGN_ID}/contacts/${CONTACT_ID}/allowed-actions" \\`);
  console.log(`  -H "Cookie: connect.sid=<your-session-cookie>"`);
  
  process.exit(0);
}

testEndpoint().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
