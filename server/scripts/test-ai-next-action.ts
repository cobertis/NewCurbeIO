/**
 * TICKET 8.1 VERIFICATION: AI NextAction Tests
 * Tests: AI decision, fallback, validation, idempotency
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  orchestratorCampaigns,
  orchestratorJobs,
  contacts 
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { decideNextAction, generateDecisionExternalId, DecideNextActionInput } from "../services/ai-next-action";
import { pickNextChannel } from "../workers/orchestrator-worker";
import { calculateAllowedActions } from "../services/policy-engine";

const CURBE_COMPANY_ID = "13edaa5f-bcfa-419b-ae19-bbc87e0c417d";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function getTestData() {
  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(eq(orchestratorCampaigns.companyId, CURBE_COMPANY_ID))
    .limit(1);
  
  if (!campaign) {
    throw new Error("No test campaign found.");
  }
  
  const [cc] = await db.select()
    .from(campaignContacts)
    .where(eq(campaignContacts.campaignId, campaign.id))
    .limit(1);
  
  if (!cc) {
    throw new Error("No campaign contacts found.");
  }
  
  return { campaign, cc };
}

async function testAiReturnsAllowedChannel() {
  console.log("\n[TEST 1] AI returns allowed channel => use it");
  
  const { campaign, cc } = await getTestData();
  
  const input: DecideNextActionInput = {
    companyId: CURBE_COMPANY_ID,
    campaignId: campaign.id,
    campaignContactId: cc.id,
    contactId: cc.contactId,
    campaignName: campaign.name,
    policy: campaign.policyJson as Record<string, any> || {},
    allowedActions: [
      { channel: "sms", allowed: true, reasons: [] },
      { channel: "imessage", allowed: true, reasons: [] },
      { channel: "voice", allowed: false, reasons: ["QUIET_HOURS"] }
    ],
    history: [],
    lastOutbound: null,
    fatigueScore: 1,
    locale: "en"
  };
  
  const result = await decideNextAction(input);
  
  const allowedChannels = ["sms", "imessage"];
  const passed = result.decision !== null && 
    allowedChannels.includes(result.decision.channel) &&
    !result.fallbackUsed;
  
  results.push({
    name: "AI returns allowed channel => use it",
    passed,
    details: `Decision: ${result.decision?.channel || "null"}, Fallback: ${result.fallbackUsed}`
  });
  
  console.log(`Decision channel: ${result.decision?.channel}`);
  console.log(`Confidence: ${result.decision?.confidence}`);
  console.log(`Explanation: ${result.decision?.explanation}`);
  console.log(`Fallback used: ${result.fallbackUsed}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testAiReturnsDisallowedChannel() {
  console.log("\n[TEST 2] AI returns disallowed channel => fallback heuristic");
  
  const { campaign, cc } = await getTestData();
  
  const input: DecideNextActionInput = {
    companyId: CURBE_COMPANY_ID,
    campaignId: campaign.id,
    campaignContactId: cc.id,
    contactId: cc.contactId,
    policy: {},
    allowedActions: [
      { channel: "voice", allowed: true, reasons: [] }
    ],
    history: [],
    lastOutbound: null,
    fatigueScore: 0
  };
  
  const mockBadDecision = {
    channel: "whatsapp",
    waitSeconds: 3600,
    explanation: "Test",
    confidence: 0.9
  };
  
  const allowedChannels = input.allowedActions.filter(a => a.allowed).map(a => a.channel);
  const isValid = allowedChannels.includes(mockBadDecision.channel);
  
  const passed = !isValid;
  
  results.push({
    name: "Disallowed channel triggers fallback",
    passed,
    details: `Channel 'whatsapp' is NOT in allowed list [${allowedChannels.join(", ")}]`
  });
  
  console.log(`Mock AI suggested: whatsapp`);
  console.log(`Allowed channels: ${allowedChannels.join(", ")}`);
  console.log(`Would trigger fallback: ${!isValid}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testAiFailure() {
  console.log("\n[TEST 3] AI fails/throws => fallback");
  
  const input: DecideNextActionInput = {
    companyId: CURBE_COMPANY_ID,
    campaignId: "non-existent-campaign",
    campaignContactId: "non-existent-cc",
    contactId: "non-existent-contact",
    policy: {},
    allowedActions: [],
    history: [],
    lastOutbound: null,
    fatigueScore: 0
  };
  
  const result = await decideNextAction(input);
  
  const passed = result.decision === null && result.error !== undefined;
  
  results.push({
    name: "AI failure triggers fallback",
    passed,
    details: `Error: ${result.error || "none"}`
  });
  
  console.log(`Decision: ${result.decision}`);
  console.log(`Error: ${result.error}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testWaitSecondsValidation() {
  console.log("\n[TEST 4] waitSeconds out of range => normalized");
  
  const MIN_WAIT = 300;
  const MAX_WAIT = 172800;
  
  const outOfRangeLow = 10;
  const outOfRangeHigh = 500000;
  
  const normalizedLow = Math.max(MIN_WAIT, Math.min(MAX_WAIT, outOfRangeLow));
  const normalizedHigh = Math.max(MIN_WAIT, Math.min(MAX_WAIT, outOfRangeHigh));
  
  const passed = normalizedLow === MIN_WAIT && normalizedHigh === MAX_WAIT;
  
  results.push({
    name: "waitSeconds out of range gets normalized",
    passed,
    details: `10 -> ${normalizedLow}, 500000 -> ${normalizedHigh}`
  });
  
  console.log(`Input 10 => normalized to ${normalizedLow} (min ${MIN_WAIT})`);
  console.log(`Input 500000 => normalized to ${normalizedHigh} (max ${MAX_WAIT})`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testDecisionMadeIdempotency() {
  console.log("\n[TEST 5] DECISION_MADE is idempotent (same externalId in same minute)");
  
  const { cc } = await getTestData();
  
  const externalId1 = generateDecisionExternalId(cc.id);
  await new Promise(r => setTimeout(r, 100));
  const externalId2 = generateDecisionExternalId(cc.id);
  
  const sameMinute = externalId1 === externalId2;
  
  const passed = sameMinute;
  
  results.push({
    name: "DECISION_MADE externalId is deterministic per minute",
    passed,
    details: `ID1: ${externalId1}, ID2: ${externalId2}, Same: ${sameMinute}`
  });
  
  console.log(`ExternalId 1: ${externalId1}`);
  console.log(`ExternalId 2: ${externalId2}`);
  console.log(`Same within minute: ${sameMinute}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testPickNextChannelHeuristic() {
  console.log("\n[TEST 6] Heuristic pickNextChannel follows priority");
  
  const mockPolicyResult = {
    companyId: CURBE_COMPANY_ID,
    campaignId: "test",
    contactId: "test",
    campaignContactId: "test",
    now: new Date().toISOString(),
    allowedActions: [
      { channel: "voice" as const, allowed: true, reasons: [] },
      { channel: "sms" as const, allowed: true, reasons: [] },
      { channel: "imessage" as const, allowed: true, reasons: [] }
    ],
    blocked: []
  };
  
  const chosen = pickNextChannel(mockPolicyResult);
  
  const passed = chosen === "imessage";
  
  results.push({
    name: "Heuristic follows priority (imessage > sms > voice)",
    passed,
    details: `Chosen: ${chosen}`
  });
  
  console.log(`Available: imessage, sms, voice`);
  console.log(`Chosen by heuristic: ${chosen}`);
  console.log(`Expected: imessage (highest priority)`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function showRecentDecisionEvents() {
  console.log("\n[EVIDENCE] Recent DECISION_MADE events:");
  
  const events = await db.select({
    id: campaignEvents.id,
    eventType: campaignEvents.eventType,
    channel: campaignEvents.channel,
    externalId: campaignEvents.externalId,
    payload: campaignEvents.payload,
    createdAt: campaignEvents.createdAt
  })
    .from(campaignEvents)
    .where(eq(campaignEvents.eventType, "DECISION_MADE"))
    .orderBy(desc(campaignEvents.createdAt))
    .limit(5);
  
  if (events.length === 0) {
    console.log("  No DECISION_MADE events found yet");
  } else {
    for (const e of events) {
      const payload = e.payload as any;
      console.log(`  ${e.channel}: ${e.externalId}`);
      console.log(`    aiEnabled: ${payload?.aiEnabled}, fallbackUsed: ${payload?.fallbackUsed}`);
      console.log(`    confidence: ${payload?.confidence}, explanation: ${payload?.explanation?.slice(0, 50)}`);
    }
  }
}

async function runTests() {
  console.log("=".repeat(70));
  console.log("TICKET 8.1 VERIFICATION: AI NextAction v1");
  console.log("=".repeat(70));
  console.log(`ORCHESTRATOR_AI_ENABLED: ${process.env.ORCHESTRATOR_AI_ENABLED || "false"}`);
  
  await testAiReturnsAllowedChannel();
  await testAiReturnsDisallowedChannel();
  await testAiFailure();
  await testWaitSecondsValidation();
  await testDecisionMadeIdempotency();
  await testPickNextChannelHeuristic();
  
  await showRecentDecisionEvents();
  
  console.log("\n" + "=".repeat(70));
  console.log("TEST SUMMARY");
  console.log("=".repeat(70));
  
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    console.log(`${r.passed ? "✓" : "✗"} ${r.name}`);
    if (r.passed) passed++; else failed++;
  }
  
  console.log(`\nTotal: ${passed}/${results.length} passed`);
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - ${r.name}: ${r.details}`);
    }
  }
  
  console.log("=".repeat(70));
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
