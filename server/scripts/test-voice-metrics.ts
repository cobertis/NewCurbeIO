/**
 * TICKET 11.3 VERIFICATION: Voice Analytics v1
 * Tests: Voice metrics (callPlaced, callAnswered, callNoAnswer, callBusy, callFailed, voicemailDropped)
 * with rates (answerRate, noAnswerRate, busyRate, callFailureRate) per campaign and variant
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  orchestratorCampaigns,
  contacts,
  companies
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCampaignMetrics, verifyCampaignAccess } from "../services/orchestrator-metrics";

const TEST_COMPANY_ID = `test-voice-metrics-${Date.now()}`;
const FAKE_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

let testCampaignId: string;
let testContactId: string;
let testEnrollmentId: string;

async function setupTestData() {
  console.log("\n[SETUP] Creating test data for voice metrics...");
  
  await db.insert(companies).values({
    id: TEST_COMPANY_ID,
    name: "Voice Metrics Test Company",
    email: `test-${Date.now()}@voicemetrics.test`,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const contactValues: typeof contacts.$inferInsert = {
    id: `voice-test-contact-${Date.now()}`,
    companyId: TEST_COMPANY_ID,
    firstName: "Voice",
    lastName: "Test",
    phone: "+15551234567"
  };
  await db.insert(contacts).values(contactValues);
  
  const [contact] = await db.select()
    .from(contacts)
    .where(eq(contacts.companyId, TEST_COMPANY_ID))
    .limit(1);
  testContactId = contact.id;
  
  testCampaignId = `voice-campaign-${Date.now()}`;
  await db.insert(orchestratorCampaigns).values({
    id: testCampaignId,
    companyId: TEST_COMPANY_ID,
    name: "Voice Metrics Test Campaign",
    status: "active",
    policyJson: JSON.stringify({ channels: ["voice", "voicemail"] })
  });
  
  testEnrollmentId = `voice-enrollment-${Date.now()}`;
  await db.insert(campaignContacts).values({
    id: testEnrollmentId,
    companyId: TEST_COMPANY_ID,
    campaignId: testCampaignId,
    contactId: testContactId,
    state: "ATTEMPTING",
    variant: "control"
  });
  
  const variantContactValues: typeof contacts.$inferInsert = {
    id: `voice-test-contact-vf-${Date.now()}`,
    companyId: TEST_COMPANY_ID,
    firstName: "VoiceFirst",
    lastName: "Test",
    phone: "+15559876543"
  };
  await db.insert(contacts).values(variantContactValues);
  const variantContactId = variantContactValues.id;
  
  const variantEnrollmentId = `voice-enrollment-variant-${Date.now()}`;
  await db.insert(campaignContacts).values({
    id: variantEnrollmentId,
    companyId: TEST_COMPANY_ID,
    campaignId: testCampaignId,
    contactId: variantContactId!,
    state: "ATTEMPTING",
    variant: "voiceFirst"
  });
  
  const eventBase = {
    companyId: TEST_COMPANY_ID,
    campaignId: testCampaignId,
    campaignContactId: testEnrollmentId,
    contactId: testContactId,
    channel: "voice" as const,
    provider: "telnyx"
  };
  
  await db.insert(campaignEvents).values([
    { ...eventBase, id: `ve-placed-1-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-1-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-placed-2-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-2-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-placed-3-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-3-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-placed-4-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-4-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-placed-5-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-5-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-answered-1-${Date.now()}`, eventType: "CALL_ANSWERED", externalId: `ext-a1-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-answered-2-${Date.now()}`, eventType: "CALL_ANSWERED", externalId: `ext-a2-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-noanswer-1-${Date.now()}`, eventType: "CALL_NO_ANSWER", externalId: `ext-na1-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-busy-1-${Date.now()}`, eventType: "CALL_BUSY", externalId: `ext-b1-${Date.now()}`, payload: {} },
    { ...eventBase, id: `ve-failed-1-${Date.now()}`, eventType: "CALL_FAILED", externalId: `ext-f1-${Date.now()}`, payload: {} },
  ]);
  
  const variantEventBase = {
    companyId: TEST_COMPANY_ID,
    campaignId: testCampaignId,
    campaignContactId: variantEnrollmentId,
    contactId: variantContactId!,
    channel: "voice" as const,
    provider: "telnyx"
  };
  
  await db.insert(campaignEvents).values([
    { ...variantEventBase, id: `ve-vf-placed-1-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-vf1-${Date.now()}`, payload: {} },
    { ...variantEventBase, id: `ve-vf-placed-2-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-vf2-${Date.now()}`, payload: {} },
    { ...variantEventBase, id: `ve-vf-placed-3-${Date.now()}`, eventType: "CALL_PLACED", externalId: `ext-vf3-${Date.now()}`, payload: {} },
    { ...variantEventBase, id: `ve-vf-answered-1-${Date.now()}`, eventType: "CALL_ANSWERED", externalId: `ext-vfa1-${Date.now()}`, payload: {} },
    { ...variantEventBase, id: `ve-vf-answered-2-${Date.now()}`, eventType: "CALL_ANSWERED", externalId: `ext-vfa2-${Date.now()}`, payload: {} },
    { ...variantEventBase, id: `ve-vf-answered-3-${Date.now()}`, eventType: "CALL_ANSWERED", externalId: `ext-vfa3-${Date.now()}`, payload: {} },
  ]);
  
  const voicemailEventBase = {
    companyId: TEST_COMPANY_ID,
    campaignId: testCampaignId,
    campaignContactId: testEnrollmentId,
    contactId: testContactId,
    channel: "voicemail" as const,
    provider: "telnyx"
  };
  
  await db.insert(campaignEvents).values([
    { ...voicemailEventBase, id: `ve-vm-1-${Date.now()}`, eventType: "VOICEMAIL_DROPPED", externalId: `ext-vm1-${Date.now()}`, payload: {} },
    { ...voicemailEventBase, id: `ve-vm-2-${Date.now()}`, eventType: "VOICEMAIL_DROPPED", externalId: `ext-vm2-${Date.now()}`, payload: {} },
  ]);
  
  console.log("[SETUP] Test data created:");
  console.log(`  Campaign: ${testCampaignId}`);
  console.log(`  Enrollments: control + voiceFirst variant`);
  console.log(`  Control events: 5 placed, 2 answered, 1 no_answer, 1 busy, 1 failed`);
  console.log(`  VoiceFirst events: 3 placed, 3 answered (100% answer rate)`);
  console.log(`  Voicemail events: 2 dropped`);
}

async function cleanupTestData() {
  console.log("\n[CLEANUP] Removing test data...");
  await db.delete(campaignEvents).where(eq(campaignEvents.companyId, TEST_COMPANY_ID));
  await db.delete(campaignContacts).where(eq(campaignContacts.companyId, TEST_COMPANY_ID));
  await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID));
  await db.delete(contacts).where(eq(contacts.companyId, TEST_COMPANY_ID));
  await db.delete(companies).where(eq(companies.id, TEST_COMPANY_ID));
  console.log("[CLEANUP] Done");
}

async function testVoiceMetricsPresent() {
  console.log("\n[TEST 1] Voice metrics object is present with all fields");
  
  const metrics = await getCampaignMetrics(TEST_COMPANY_ID, testCampaignId, "all");
  
  const hasVoice = metrics.voice !== undefined;
  const hasAllFields = hasVoice && 
    typeof metrics.voice.callPlaced === "number" &&
    typeof metrics.voice.callAnswered === "number" &&
    typeof metrics.voice.callNoAnswer === "number" &&
    typeof metrics.voice.callBusy === "number" &&
    typeof metrics.voice.callFailed === "number" &&
    typeof metrics.voice.voicemailDropped === "number" &&
    typeof metrics.voice.rates.answerRate === "number" &&
    typeof metrics.voice.rates.noAnswerRate === "number" &&
    typeof metrics.voice.rates.busyRate === "number" &&
    typeof metrics.voice.rates.callFailureRate === "number";
  
  const passed = hasAllFields;
  
  results.push({
    name: "Voice metrics object present with all fields",
    passed,
    details: `hasVoice=${hasVoice}, hasAllFields=${hasAllFields}`
  });
  
  console.log(`Voice metrics present: ${hasVoice}`);
  console.log(`All fields present: ${hasAllFields}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testVoiceCounts() {
  console.log("\n[TEST 2] Voice event counts are correct");
  
  const metrics = await getCampaignMetrics(TEST_COMPANY_ID, testCampaignId, "all");
  
  const expectedPlaced = 8;
  const expectedAnswered = 5;
  const expectedNoAnswer = 1;
  const expectedBusy = 1;
  const expectedFailed = 1;
  const expectedVoicemail = 2;
  
  const placedOk = metrics.voice.callPlaced === expectedPlaced;
  const answeredOk = metrics.voice.callAnswered === expectedAnswered;
  const noAnswerOk = metrics.voice.callNoAnswer === expectedNoAnswer;
  const busyOk = metrics.voice.callBusy === expectedBusy;
  const failedOk = metrics.voice.callFailed === expectedFailed;
  const voicemailOk = metrics.voice.voicemailDropped === expectedVoicemail;
  
  const passed = placedOk && answeredOk && noAnswerOk && busyOk && failedOk && voicemailOk;
  
  results.push({
    name: "Voice event counts are correct",
    passed,
    details: `placed=${metrics.voice.callPlaced}/${expectedPlaced}, answered=${metrics.voice.callAnswered}/${expectedAnswered}, noAnswer=${metrics.voice.callNoAnswer}/${expectedNoAnswer}, busy=${metrics.voice.callBusy}/${expectedBusy}, failed=${metrics.voice.callFailed}/${expectedFailed}, voicemail=${metrics.voice.voicemailDropped}/${expectedVoicemail}`
  });
  
  console.log(`callPlaced: ${metrics.voice.callPlaced} (expected ${expectedPlaced}) - ${placedOk ? "OK" : "WRONG"}`);
  console.log(`callAnswered: ${metrics.voice.callAnswered} (expected ${expectedAnswered}) - ${answeredOk ? "OK" : "WRONG"}`);
  console.log(`callNoAnswer: ${metrics.voice.callNoAnswer} (expected ${expectedNoAnswer}) - ${noAnswerOk ? "OK" : "WRONG"}`);
  console.log(`callBusy: ${metrics.voice.callBusy} (expected ${expectedBusy}) - ${busyOk ? "OK" : "WRONG"}`);
  console.log(`callFailed: ${metrics.voice.callFailed} (expected ${expectedFailed}) - ${failedOk ? "OK" : "WRONG"}`);
  console.log(`voicemailDropped: ${metrics.voice.voicemailDropped} (expected ${expectedVoicemail}) - ${voicemailOk ? "OK" : "WRONG"}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testVoiceRates() {
  console.log("\n[TEST 3] Voice rates are calculated correctly");
  
  const metrics = await getCampaignMetrics(TEST_COMPANY_ID, testCampaignId, "all");
  
  const placed = metrics.voice.callPlaced;
  const expectedAnswerRate = placed > 0 ? Math.round((metrics.voice.callAnswered / placed) * 100) / 100 : 0;
  const expectedNoAnswerRate = placed > 0 ? Math.round((metrics.voice.callNoAnswer / placed) * 100) / 100 : 0;
  const expectedBusyRate = placed > 0 ? Math.round((metrics.voice.callBusy / placed) * 100) / 100 : 0;
  const expectedFailureRate = placed > 0 ? Math.round((metrics.voice.callFailed / placed) * 100) / 100 : 0;
  
  const answerRateOk = metrics.voice.rates.answerRate === expectedAnswerRate;
  const noAnswerRateOk = metrics.voice.rates.noAnswerRate === expectedNoAnswerRate;
  const busyRateOk = metrics.voice.rates.busyRate === expectedBusyRate;
  const failureRateOk = metrics.voice.rates.callFailureRate === expectedFailureRate;
  
  const passed = answerRateOk && noAnswerRateOk && busyRateOk && failureRateOk;
  
  results.push({
    name: "Voice rates calculated correctly",
    passed,
    details: `answerRate=${metrics.voice.rates.answerRate}/${expectedAnswerRate}, noAnswerRate=${metrics.voice.rates.noAnswerRate}/${expectedNoAnswerRate}`
  });
  
  console.log(`answerRate: ${(metrics.voice.rates.answerRate * 100).toFixed(1)}% (expected ${(expectedAnswerRate * 100).toFixed(1)}%) - ${answerRateOk ? "OK" : "WRONG"}`);
  console.log(`noAnswerRate: ${(metrics.voice.rates.noAnswerRate * 100).toFixed(1)}% (expected ${(expectedNoAnswerRate * 100).toFixed(1)}%) - ${noAnswerRateOk ? "OK" : "WRONG"}`);
  console.log(`busyRate: ${(metrics.voice.rates.busyRate * 100).toFixed(1)}% (expected ${(expectedBusyRate * 100).toFixed(1)}%) - ${busyRateOk ? "OK" : "WRONG"}`);
  console.log(`callFailureRate: ${(metrics.voice.rates.callFailureRate * 100).toFixed(1)}% (expected ${(expectedFailureRate * 100).toFixed(1)}%) - ${failureRateOk ? "OK" : "WRONG"}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testBreakdownByChannelVoice() {
  console.log("\n[TEST 4] Breakdown by channel includes voice metrics");
  
  const metrics = await getCampaignMetrics(TEST_COMPANY_ID, testCampaignId, "all");
  
  const voiceChannel = metrics.breakdownByChannel["voice"];
  const hasVoiceChannel = voiceChannel !== undefined;
  const hasVoiceFields = hasVoiceChannel && 
    typeof voiceChannel.callPlaced === "number" &&
    typeof voiceChannel.callAnswered === "number" &&
    typeof voiceChannel.answerRate === "number";
  
  const passed = hasVoiceFields;
  
  results.push({
    name: "Breakdown by channel includes voice metrics",
    passed,
    details: `hasVoiceChannel=${hasVoiceChannel}, hasVoiceFields=${hasVoiceFields}`
  });
  
  console.log(`Voice channel present: ${hasVoiceChannel}`);
  if (voiceChannel) {
    console.log(`  callPlaced: ${voiceChannel.callPlaced}`);
    console.log(`  callAnswered: ${voiceChannel.callAnswered}`);
    console.log(`  answerRate: ${(voiceChannel.answerRate || 0) * 100}%`);
  }
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testVariantVoiceMetrics() {
  console.log("\n[TEST 5] Variant metrics include voice data");
  
  const metrics = await getCampaignMetrics(TEST_COMPANY_ID, testCampaignId, "all");
  
  const controlVariant = metrics.metricsByVariant["control"];
  const voiceFirstVariant = metrics.metricsByVariant["voiceFirst"];
  
  const hasControlVoice = controlVariant?.voice !== undefined;
  const hasVoiceFirstVoice = voiceFirstVariant?.voice !== undefined;
  
  const controlAnswerRate = controlVariant?.voice?.answerRate || 0;
  const voiceFirstAnswerRate = voiceFirstVariant?.voice?.answerRate || 0;
  
  const voiceFirstBetterThanControl = voiceFirstAnswerRate >= controlAnswerRate;
  
  const passed = hasControlVoice && hasVoiceFirstVoice && voiceFirstBetterThanControl;
  
  results.push({
    name: "Variant metrics include voice data",
    passed,
    details: `control voice=${hasControlVoice} (${(controlAnswerRate * 100).toFixed(1)}%), voiceFirst voice=${hasVoiceFirstVoice} (${(voiceFirstAnswerRate * 100).toFixed(1)}%)`
  });
  
  console.log(`Control variant voice: ${hasControlVoice}`);
  if (controlVariant?.voice) {
    console.log(`  callPlaced: ${controlVariant.voice.callPlaced}, answered: ${controlVariant.voice.callAnswered}, answerRate: ${(controlVariant.voice.answerRate * 100).toFixed(1)}%`);
  }
  console.log(`VoiceFirst variant voice: ${hasVoiceFirstVoice}`);
  if (voiceFirstVariant?.voice) {
    console.log(`  callPlaced: ${voiceFirstVariant.voice.callPlaced}, answered: ${voiceFirstVariant.voice.callAnswered}, answerRate: ${(voiceFirstVariant.voice.answerRate * 100).toFixed(1)}%`);
  }
  console.log(`VoiceFirst >= Control answer rate: ${voiceFirstBetterThanControl}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testMultiTenantIsolation() {
  console.log("\n[TEST 6] Multi-tenant isolation (fake company gets 404)");
  
  const hasAccess = await verifyCampaignAccess(FAKE_COMPANY_ID, testCampaignId);
  const hasRealAccess = await verifyCampaignAccess(TEST_COMPANY_ID, testCampaignId);
  
  const passed = !hasAccess && hasRealAccess;
  
  results.push({
    name: "Multi-tenant isolation blocks fake company",
    passed,
    details: `fakeCompany=${hasAccess}, realCompany=${hasRealAccess}`
  });
  
  console.log(`Fake company access: ${hasAccess}`);
  console.log(`Real company access: ${hasRealAccess}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function testVoicemailChannel() {
  console.log("\n[TEST 7] Voicemail channel breakdown is separate");
  
  const metrics = await getCampaignMetrics(TEST_COMPANY_ID, testCampaignId, "all");
  
  const voicemailChannel = metrics.breakdownByChannel["voicemail"];
  const hasVoicemailChannel = voicemailChannel !== undefined;
  const voicemailAttempts = voicemailChannel?.attempts || 0;
  const totalVoicemailDropped = metrics.voice.voicemailDropped;
  
  const passed = hasVoicemailChannel && voicemailAttempts === 2 && totalVoicemailDropped === 2;
  
  results.push({
    name: "Voicemail channel breakdown is separate",
    passed,
    details: `voicemailChannel=${hasVoicemailChannel}, attempts=${voicemailAttempts}, totalDropped=${totalVoicemailDropped}`
  });
  
  console.log(`Voicemail channel present: ${hasVoicemailChannel}`);
  console.log(`Voicemail attempts: ${voicemailAttempts}`);
  console.log(`Total voicemail dropped: ${totalVoicemailDropped}`);
  console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}`);
  
  return passed;
}

async function printDemoJson() {
  console.log("\n" + "=".repeat(70));
  console.log("DEMO JSON OUTPUT");
  console.log("=".repeat(70));
  
  const metrics = await getCampaignMetrics(TEST_COMPANY_ID, testCampaignId, "all");
  
  console.log("\nvoice section:");
  console.log(JSON.stringify(metrics.voice, null, 2));
  
  console.log("\nbreakdownByChannel (voice only):");
  console.log(JSON.stringify({
    voice: metrics.breakdownByChannel["voice"],
    voicemail: metrics.breakdownByChannel["voicemail"]
  }, null, 2));
  
  console.log("\nmetricsByVariant (voice only):");
  const variantVoice: Record<string, any> = {};
  for (const [variant, data] of Object.entries(metrics.metricsByVariant)) {
    if (data.voice) {
      variantVoice[variant] = data.voice;
    }
  }
  console.log(JSON.stringify(variantVoice, null, 2));
}

async function runTests() {
  console.log("=".repeat(70));
  console.log("TICKET 11.3 VERIFICATION: Voice Analytics v1");
  console.log("(callPlaced, callAnswered, callNoAnswer, callBusy, callFailed, voicemailDropped)");
  console.log("=".repeat(70));
  
  try {
    await setupTestData();
    
    await testVoiceMetricsPresent();
    await testVoiceCounts();
    await testVoiceRates();
    await testBreakdownByChannelVoice();
    await testVariantVoiceMetrics();
    await testMultiTenantIsolation();
    await testVoicemailChannel();
    
    await printDemoJson();
    
  } finally {
    await cleanupTestData();
  }
  
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
