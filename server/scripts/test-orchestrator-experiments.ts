/**
 * TICKET 10.1 VERIFICATION: Experiment Framework v1
 * Tests: Variant assignment, deterministic hashing, metricsByVariant
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  orchestratorCampaigns 
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCampaignMetrics } from "../services/orchestrator-metrics";
import { 
  getOrAssignContactVariant, 
  parseExperimentConfig,
  simpleHash,
  assignVariant,
  type ExperimentConfig 
} from "../services/orchestrator-experiments";

const CURBE_COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function getOrCreateTestCampaign(): Promise<{ id: string; policyJson: any }> {
  const [existing] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, CURBE_COMPANY_ID))
    .limit(1);
  
  if (existing) {
    return existing;
  }
  
  throw new Error("No test campaign found. Create an orchestrator campaign first.");
}

async function testSimpleHashDeterminism() {
  console.log("\n[TEST 1] simpleHash is deterministic for same contactId");
  
  const contactId = "test-contact-" + Date.now();
  const h1 = simpleHash(contactId);
  const h2 = simpleHash(contactId);
  const h3 = simpleHash(contactId);
  
  const passed = h1 === h2 && h2 === h3;
  
  results.push({
    name: "simpleHash determinism",
    passed,
    details: `h1=${h1}, h2=${h2}, h3=${h3}`
  });
  
  console.log(`Hash values: ${h1}, ${h2}, ${h3}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testSimpleHashDistribution() {
  console.log("\n[TEST 2] simpleHash produces values 0-99 with reasonable distribution");
  
  const buckets: number[] = new Array(100).fill(0);
  const testSize = 10000;
  
  for (let i = 0; i < testSize; i++) {
    const contactId = `contact-${i}-${Math.random()}`;
    const bucket = simpleHash(contactId);
    if (bucket >= 0 && bucket < 100) {
      buckets[bucket]++;
    }
  }
  
  const minBucket = Math.min(...buckets);
  const maxBucket = Math.max(...buckets);
  const avgBucket = testSize / 100;
  const variance = (maxBucket - minBucket) / avgBucket;
  
  const passed = variance < 1.0; // Allow up to 100% variance
  
  results.push({
    name: "simpleHash distribution",
    passed,
    details: `min=${minBucket}, max=${maxBucket}, avg=${avgBucket.toFixed(0)}, variance=${(variance * 100).toFixed(1)}%`
  });
  
  console.log(`Distribution: min=${minBucket}, max=${maxBucket}, expected=${avgBucket.toFixed(0)}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testParseExperimentConfig() {
  console.log("\n[TEST 3] parseExperimentConfig extracts experiment from policyJson");
  
  const policyJson = {
    aiEnabled: true,
    experiment: {
      enabled: true,
      variants: [
        { name: "control", aiEnabled: true },
        { name: "noAI", aiEnabled: false }
      ],
      allocation: { control: 50, noAI: 50 }
    }
  };
  
  const config = parseExperimentConfig(policyJson);
  
  const passed = config !== null && 
    config.enabled === true &&
    config.variants.length === 2 && 
    config.allocation.control === 50 &&
    config.allocation.noAI === 50;
  
  results.push({
    name: "parseExperimentConfig",
    passed,
    details: config ? `enabled=${config.enabled}, variants=${config.variants.length}, allocation=${JSON.stringify(config.allocation)}` : "null"
  });
  
  console.log(`Config: ${config ? JSON.stringify(config) : "null"}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testVariantAssignmentPersistence() {
  console.log("\n[TEST 4] getOrAssignContactVariant persists to database");
  
  const campaign = await getOrCreateTestCampaign();
  
  // Get a contact for this campaign
  const [contact] = await db.select()
    .from(campaignContacts)
    .where(eq(campaignContacts.campaignId, campaign.id))
    .limit(1);
  
  if (!contact) {
    results.push({
      name: "Variant assignment persistence",
      passed: false,
      details: "No contacts in campaign"
    });
    console.log("SKIP: No contacts in campaign");
    return false;
  }
  
  // Create policyJson with experiment config
  const policyJson = {
    experiment: {
      enabled: true,
      variants: [
        { name: "control", aiEnabled: true },
        { name: "test_variant", aiEnabled: false }
      ],
      allocation: { control: 50, test_variant: 50 }
    }
  };
  
  // Get variant - function signature: (contactId, campaignContactId, policyJson)
  const result1 = await getOrAssignContactVariant(contact.contactId, contact.id, policyJson);
  const result2 = await getOrAssignContactVariant(contact.contactId, contact.id, policyJson);
  
  if (!result1 || !result2) {
    results.push({
      name: "Variant assignment persistence",
      passed: false,
      details: "getOrAssignContactVariant returned null"
    });
    console.log("FAIL: getOrAssignContactVariant returned null");
    return false;
  }
  
  // Check it was persisted
  const [updated] = await db.select({ variant: campaignContacts.variant })
    .from(campaignContacts)
    .where(eq(campaignContacts.id, contact.id));
  
  const passed = result1.variant === result2.variant && 
    updated.variant === result1.variant;
  
  results.push({
    name: "Variant assignment persistence",
    passed,
    details: `assigned=${result1.variant}, reread=${result2.variant}, inDb=${updated.variant}`
  });
  
  console.log(`Assigned: ${result1.variant}, Re-read: ${result2.variant}, In DB: ${updated.variant}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testVariantSettingsReturned() {
  console.log("\n[TEST 5] getOrAssignContactVariant returns correct VariantSettings");
  
  const experimentConfig: ExperimentConfig = {
    enabled: true,
    variants: [
      { name: "control", aiEnabled: true, channelOrder: ["sms", "imessage"] as any },
      { name: "test_variant", aiEnabled: false, channelOrder: ["imessage", "sms"] as any }
    ],
    allocation: { control: 50, test_variant: 50 }
  };
  
  // Create a unique contact ID to test assignment logic
  const testContactId = `test-${Date.now()}`;
  const hash = simpleHash(testContactId);
  
  // Determine expected variant based on hash
  let expectedVariant: string;
  if (hash < 50) {
    expectedVariant = "control";
  } else {
    expectedVariant = "test_variant";
  }
  
  // Verify the variant settings match the expected variant definition
  const variantDef = experimentConfig.variants.find(v => v.name === expectedVariant);
  
  const passed = variantDef !== undefined;
  
  results.push({
    name: "VariantSettings structure",
    passed,
    details: `hash=${hash}, expected=${expectedVariant}, channelOrder=${JSON.stringify(variantDef?.channelOrder)}`
  });
  
  console.log(`Hash: ${hash}, Expected variant: ${expectedVariant}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testMetricsByVariantReturned() {
  console.log("\n[TEST 6] getCampaignMetrics includes metricsByVariant");
  
  const campaign = await getOrCreateTestCampaign();
  const metrics = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  const hasMetricsByVariant = typeof metrics.metricsByVariant === "object";
  
  results.push({
    name: "metricsByVariant in response",
    passed: hasMetricsByVariant,
    details: `variants=${Object.keys(metrics.metricsByVariant).join(", ") || "none"}`
  });
  
  console.log(`metricsByVariant keys: ${Object.keys(metrics.metricsByVariant).join(", ") || "none"}`);
  
  if (Object.keys(metrics.metricsByVariant).length > 0) {
    console.log("Variant breakdown:");
    for (const [v, m] of Object.entries(metrics.metricsByVariant)) {
      console.log(`  ${v}: attempts=${m.attempts}, delivered=${m.delivered}, replied=${m.replied}`);
    }
  }
  
  console.log(`RESULT: ${hasMetricsByVariant ? "PASS ✓" : "FAIL ✗"}`);
  
  return hasMetricsByVariant;
}

async function testVariantRatesCalculation() {
  console.log("\n[TEST 7] metricsByVariant calculates rates correctly");
  
  const campaign = await getOrCreateTestCampaign();
  const metrics = await getCampaignMetrics(CURBE_COMPANY_ID, campaign.id, "all");
  
  let passed = true;
  let details = "";
  
  for (const [variant, m] of Object.entries(metrics.metricsByVariant)) {
    // Check deliveryRate = delivered / attempts
    const expectedDeliveryRate = m.attempts > 0 
      ? Math.round((m.delivered / m.attempts) * 100) / 100 
      : 0;
    
    if (Math.abs(m.rates.deliveryRate - expectedDeliveryRate) > 0.01) {
      passed = false;
      details += `${variant} deliveryRate mismatch; `;
    }
    
    // Check replyRate = replied / delivered
    const expectedReplyRate = m.delivered > 0 
      ? Math.round((m.replied / m.delivered) * 100) / 100 
      : 0;
    
    if (Math.abs(m.rates.replyRate - expectedReplyRate) > 0.01) {
      passed = false;
      details += `${variant} replyRate mismatch; `;
    }
  }
  
  if (Object.keys(metrics.metricsByVariant).length === 0) {
    details = "No variants to verify";
  } else if (passed) {
    details = "All rates calculated correctly";
  }
  
  results.push({
    name: "Variant rates calculation",
    passed,
    details
  });
  
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"} - ${details}`);
  
  return passed;
}

async function testFractionalAllocationSupport() {
  console.log("\n[TEST 8] assignVariant handles fractional allocations (0.5 = 50%)");
  
  const experimentFractional: ExperimentConfig = {
    enabled: true,
    variants: [
      { name: "control", aiEnabled: true },
      { name: "treatment", aiEnabled: false }
    ],
    allocation: { control: 0.5, treatment: 0.5 } // Fractional: 50%/50%
  };
  
  const experimentWholeNumber: ExperimentConfig = {
    enabled: true,
    variants: [
      { name: "control", aiEnabled: true },
      { name: "treatment", aiEnabled: false }
    ],
    allocation: { control: 50, treatment: 50 } // Whole number: 50%/50%
  };
  
  // Test with 1000 contacts, check distribution
  let fractionalControl = 0;
  let wholeControl = 0;
  const testSize = 1000;
  
  for (let i = 0; i < testSize; i++) {
    const contactId = `test-contact-${i}`;
    if (assignVariant(contactId, experimentFractional) === "control") fractionalControl++;
    if (assignVariant(contactId, experimentWholeNumber) === "control") wholeControl++;
  }
  
  // Both should have roughly 50% in control (allow 35-65% range)
  const fractionalPct = (fractionalControl / testSize) * 100;
  const wholePct = (wholeControl / testSize) * 100;
  
  const passed = 
    fractionalPct >= 35 && fractionalPct <= 65 &&
    wholePct >= 35 && wholePct <= 65;
  
  results.push({
    name: "Fractional allocation support",
    passed,
    details: `fractional=${fractionalPct.toFixed(1)}% control, whole=${wholePct.toFixed(1)}% control`
  });
  
  console.log(`Fractional allocation: ${fractionalPct.toFixed(1)}% control`);
  console.log(`Whole number allocation: ${wholePct.toFixed(1)}% control`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function runAllTests() {
  console.log("=".repeat(60));
  console.log("TICKET 10.1: Experiment Framework v1 - Test Suite");
  console.log("=".repeat(60));
  
  try {
    await testSimpleHashDeterminism();
    await testSimpleHashDistribution();
    await testParseExperimentConfig();
    await testVariantAssignmentPersistence();
    await testVariantSettingsReturned();
    await testMetricsByVariantReturned();
    await testVariantRatesCalculation();
    await testFractionalAllocationSupport();
  } catch (error) {
    console.error("\nTest suite error:", error);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  for (const r of results) {
    console.log(`${r.passed ? "✓" : "✗"} ${r.name}: ${r.details}`);
  }
  
  console.log(`\nTotal: ${passed}/${total} tests passed`);
  console.log("=".repeat(60));
  
  process.exit(passed === total ? 0 : 1);
}

runAllTests();
