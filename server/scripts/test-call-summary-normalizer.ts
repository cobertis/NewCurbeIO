/**
 * TICKET 12.1 VERIFICATION: Call Summary Normalizer
 * Tests:
 * 1. interested -> state QUALIFIED + CALL_SUMMARY event
 * 2. do_not_call -> DO_NOT_CONTACT + suppression updated
 * 3. callback -> next_action_at moved + state ATTEMPTING
 * 4. Idempotency - same externalId -> no dup
 * 5. Unknown callControlId -> 404/no-op without side effects
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  orchestratorCampaigns,
  contacts,
  companies,
  contactSuppressions,
  contactConsents
} from "@shared/schema";
import { eq, and, like } from "drizzle-orm";
import { 
  processCallSummary, 
  CallSummaryWebhookSchema 
} from "../services/call-summary-normalizer";
import { nanoid } from "nanoid";

const TEST_COMPANY_ID = `test-call-summary-${Date.now()}`;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function setupTestCompany() {
  const testSlug = `testcs${nanoid(4)}`.toLowerCase();
  await db.execute(`
    INSERT INTO companies (id, name, email, slug)
    VALUES ('${TEST_COMPANY_ID}', 'Call Summary Test Company', 'test@callsummary.test', '${testSlug}')
    ON CONFLICT (id) DO NOTHING
  `);
}

async function createTestContact(suffix: string = ""): Promise<string> {
  const contactId = `cs-contact-${suffix}-${Date.now()}`;
  await db.insert(contacts).values({
    id: contactId,
    companyId: TEST_COMPANY_ID,
    firstName: "Test",
    lastName: `CallSummary${suffix}`,
    phone: `+1555${Date.now().toString().slice(-7)}`
  });
  return contactId;
}

async function createTestCampaign(suffix: string = ""): Promise<string> {
  const campaignId = `cs-campaign-${suffix}-${Date.now()}`;
  await db.insert(orchestratorCampaigns).values({
    id: campaignId,
    companyId: TEST_COMPANY_ID,
    name: `Call Summary Test Campaign ${suffix}`,
    status: "active",
    policyJson: JSON.stringify({ channels: ["voice"] })
  });
  return campaignId;
}

async function createTestEnrollment(
  campaignId: string, 
  contactId: string, 
  state: string = "ATTEMPTING"
): Promise<string> {
  const enrollmentId = `cs-enroll-${Date.now()}-${nanoid(4)}`;
  await db.insert(campaignContacts).values({
    id: enrollmentId,
    companyId: TEST_COMPANY_ID,
    campaignId,
    contactId,
    state: state as any,
    variant: "control"
  });
  return enrollmentId;
}

async function createCallPlacedEvent(
  campaignId: string,
  contactId: string,
  enrollmentId: string,
  providerCallId: string
): Promise<void> {
  await db.insert(campaignEvents).values({
    id: `cs-event-${Date.now()}-${nanoid(4)}`,
    companyId: TEST_COMPANY_ID,
    campaignId,
    contactId,
    campaignContactId: enrollmentId,
    eventType: "CALL_PLACED",
    channel: "voice",
    provider: "telnyx",
    externalId: `call_placed:${providerCallId}`,
    payload: { providerCallId, provider: "telnyx" }
  });
}

async function cleanupTestData() {
  await db.delete(campaignEvents).where(eq(campaignEvents.companyId, TEST_COMPANY_ID));
  await db.delete(contactSuppressions).where(eq(contactSuppressions.companyId, TEST_COMPANY_ID));
  await db.delete(contactConsents).where(eq(contactConsents.companyId, TEST_COMPANY_ID));
  await db.delete(campaignContacts).where(eq(campaignContacts.companyId, TEST_COMPANY_ID));
  await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID));
  await db.delete(contacts).where(eq(contacts.companyId, TEST_COMPANY_ID));
}

async function fullCleanup() {
  await cleanupTestData();
  await db.delete(companies).where(eq(companies.id, TEST_COMPANY_ID));
}

async function test1_InterestedToQualified() {
  console.log("\n[TEST 1] interested -> state QUALIFIED + CALL_SUMMARY event");
  
  try {
    await cleanupTestData();
    
    const contactId = await createTestContact("1");
    const campaignId = await createTestCampaign("1");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "ATTEMPTING");
    const providerCallId = `call_${nanoid(12)}`;
    
    await createCallPlacedEvent(campaignId, contactId, enrollmentId, providerCallId);
    
    const result = await processCallSummary({
      provider: "telnyx",
      callControlId: providerCallId,
      intent: "interested",
      summaryText: "Customer expressed interest in the product"
    });
    
    const [updatedEnrollment] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, enrollmentId))
      .limit(1);
    
    const [callSummaryEvent] = await db.select()
      .from(campaignEvents)
      .where(
        and(
          eq(campaignEvents.companyId, TEST_COMPANY_ID),
          eq(campaignEvents.eventType, "CALL_SUMMARY")
        )
      )
      .limit(1);
    
    const passed = 
      result.action === "created" && 
      updatedEnrollment?.state === "QUALIFIED" &&
      callSummaryEvent !== undefined;
    
    results.push({
      name: "interested -> state QUALIFIED + CALL_SUMMARY event",
      passed,
      details: `action=${result.action}, state=${updatedEnrollment?.state}, eventExists=${!!callSummaryEvent}`
    });
    
    console.log(`  Result action: ${result.action}`);
    console.log(`  State updated: ATTEMPTING -> ${updatedEnrollment?.state}`);
    console.log(`  CALL_SUMMARY event: ${callSummaryEvent ? "exists" : "missing"}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}\n`);
    
    return passed;
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    results.push({
      name: "interested -> state QUALIFIED + CALL_SUMMARY event",
      passed: false,
      details: `Error: ${e}`
    });
    return false;
  }
}

async function test2_DoNotCallToSuppression() {
  console.log("\n[TEST 2] do_not_call -> DO_NOT_CONTACT + dnc + voice/voicemail opt_out");
  
  try {
    await cleanupTestData();
    
    const contactId = await createTestContact("2");
    const campaignId = await createTestCampaign("2");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "ATTEMPTING");
    const providerCallId = `call_${nanoid(12)}`;
    
    await createCallPlacedEvent(campaignId, contactId, enrollmentId, providerCallId);
    
    const result = await processCallSummary({
      provider: "telnyx",
      callControlId: providerCallId,
      intent: "do_not_call",
      summaryText: "Customer requested to be placed on do not call list"
    });
    
    const [updatedEnrollment] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, enrollmentId))
      .limit(1);
    
    const [suppression] = await db.select()
      .from(contactSuppressions)
      .where(eq(contactSuppressions.contactId, contactId))
      .limit(1);
    
    // Check voice and voicemail consents
    const consents = await db.select()
      .from(contactConsents)
      .where(eq(contactConsents.contactId, contactId));
    
    const voiceConsent = consents.find(c => c.channel === "voice");
    const voicemailConsent = consents.find(c => c.channel === "voicemail");
    
    const passed = 
      result.action === "created" && 
      updatedEnrollment?.state === "DO_NOT_CONTACT" &&
      suppression?.suppressionStatus === "dnc" &&
      voiceConsent?.status === "opt_out" &&
      voicemailConsent?.status === "opt_out";
    
    results.push({
      name: "do_not_call -> DO_NOT_CONTACT + dnc + voice/voicemail opt_out",
      passed,
      details: `action=${result.action}, state=${updatedEnrollment?.state}, suppressionStatus=${suppression?.suppressionStatus}, voice=${voiceConsent?.status}, voicemail=${voicemailConsent?.status}`
    });
    
    console.log(`  Result action: ${result.action}`);
    console.log(`  State updated: ATTEMPTING -> ${updatedEnrollment?.state}`);
    console.log(`  Suppression status: ${suppression?.suppressionStatus} (expected: dnc)`);
    console.log(`  Suppression reason: ${suppression?.reason}`);
    console.log(`  Voice consent: ${voiceConsent?.status} (expected: opt_out)`);
    console.log(`  Voicemail consent: ${voicemailConsent?.status} (expected: opt_out)`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}\n`);
    
    return passed;
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    results.push({
      name: "do_not_call -> DO_NOT_CONTACT + dnc + voice/voicemail opt_out",
      passed: false,
      details: `Error: ${e}`
    });
    return false;
  }
}

async function test3_CallbackNextActionAt() {
  console.log("\n[TEST 3] callback -> next_action_at moved + state ATTEMPTING");
  
  try {
    await cleanupTestData();
    
    const contactId = await createTestContact("3");
    const campaignId = await createTestCampaign("3");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "NEW");
    const providerCallId = `call_${nanoid(12)}`;
    
    await createCallPlacedEvent(campaignId, contactId, enrollmentId, providerCallId);
    
    const beforeTime = new Date();
    
    const result = await processCallSummary({
      provider: "telnyx",
      callControlId: providerCallId,
      intent: "callback",
      summaryText: "Customer requested a callback"
    });
    
    const [updatedEnrollment] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, enrollmentId))
      .limit(1);
    
    const nextActionAt = updatedEnrollment?.nextActionAt;
    const expected24HoursLater = new Date(beforeTime.getTime() + 24 * 60 * 60 * 1000);
    const tolerance = 5 * 60 * 1000; // 5 minutes tolerance
    
    const nextActionAtValid = nextActionAt && 
      Math.abs(nextActionAt.getTime() - expected24HoursLater.getTime()) < tolerance;
    
    const passed = 
      result.action === "created" && 
      updatedEnrollment?.state === "ATTEMPTING" &&
      nextActionAtValid;
    
    results.push({
      name: "callback -> next_action_at moved + state ATTEMPTING",
      passed,
      details: `action=${result.action}, state=${updatedEnrollment?.state}, nextActionAt=${nextActionAt?.toISOString()}`
    });
    
    console.log(`  Result action: ${result.action}`);
    console.log(`  State updated: NEW -> ${updatedEnrollment?.state}`);
    console.log(`  nextActionAt: ${nextActionAt?.toISOString()}`);
    console.log(`  Expected ~24h later: ${expected24HoursLater.toISOString()}`);
    console.log(`  Within tolerance: ${nextActionAtValid}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}\n`);
    
    return passed;
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    results.push({
      name: "callback -> next_action_at moved + state ATTEMPTING",
      passed: false,
      details: `Error: ${e}`
    });
    return false;
  }
}

async function test4_Idempotency() {
  console.log("\n[TEST 4] Idempotency - same externalId -> no dup");
  
  try {
    await cleanupTestData();
    
    const contactId = await createTestContact("4");
    const campaignId = await createTestCampaign("4");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "ATTEMPTING");
    const providerCallId = `call_${nanoid(12)}`;
    
    await createCallPlacedEvent(campaignId, contactId, enrollmentId, providerCallId);
    
    const result1 = await processCallSummary({
      provider: "telnyx",
      callControlId: providerCallId,
      intent: "interested",
      summaryText: "First call"
    });
    
    const result2 = await processCallSummary({
      provider: "telnyx",
      callControlId: providerCallId,
      intent: "interested",
      summaryText: "Second call (duplicate)"
    });
    
    const callSummaryEvents = await db.select()
      .from(campaignEvents)
      .where(
        and(
          eq(campaignEvents.companyId, TEST_COMPANY_ID),
          eq(campaignEvents.eventType, "CALL_SUMMARY")
        )
      );
    
    const passed = 
      result1.action === "created" &&
      result2.action === "no_op" &&
      callSummaryEvents.length === 1;
    
    results.push({
      name: "Idempotency - same externalId -> no dup",
      passed,
      details: `first=${result1.action}, second=${result2.action}, eventCount=${callSummaryEvents.length}`
    });
    
    console.log(`  First call action: ${result1.action}`);
    console.log(`  Second call action: ${result2.action}`);
    console.log(`  CALL_SUMMARY event count: ${callSummaryEvents.length}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}\n`);
    
    return passed;
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    results.push({
      name: "Idempotency - same externalId -> no dup",
      passed: false,
      details: `Error: ${e}`
    });
    return false;
  }
}

async function test5_UnknownCallControlId() {
  console.log("\n[TEST 5] Unknown callControlId -> 404/no-op without side effects");
  
  try {
    await cleanupTestData();
    
    const contactId = await createTestContact("5");
    const campaignId = await createTestCampaign("5");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "NEW");
    
    const [enrollmentBefore] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, enrollmentId))
      .limit(1);
    
    const eventCountBefore = await db.select()
      .from(campaignEvents)
      .where(
        and(
          eq(campaignEvents.companyId, TEST_COMPANY_ID),
          eq(campaignEvents.eventType, "CALL_SUMMARY")
        )
      );
    
    const fakeCallControlId = `call_nonexistent_${nanoid(12)}`;
    
    const result = await processCallSummary({
      provider: "telnyx",
      callControlId: fakeCallControlId,
      intent: "interested",
      summaryText: "This should not create anything"
    });
    
    const [enrollmentAfter] = await db.select()
      .from(campaignContacts)
      .where(eq(campaignContacts.id, enrollmentId))
      .limit(1);
    
    const eventCountAfter = await db.select()
      .from(campaignEvents)
      .where(
        and(
          eq(campaignEvents.companyId, TEST_COMPANY_ID),
          eq(campaignEvents.eventType, "CALL_SUMMARY")
        )
      );
    
    const passed = 
      result.action === "not_found" &&
      enrollmentBefore?.state === enrollmentAfter?.state &&
      eventCountBefore.length === eventCountAfter.length;
    
    results.push({
      name: "Unknown callControlId -> 404/no-op without side effects",
      passed,
      details: `action=${result.action}, stateBefore=${enrollmentBefore?.state}, stateAfter=${enrollmentAfter?.state}, eventsBefore=${eventCountBefore.length}, eventsAfter=${eventCountAfter.length}`
    });
    
    console.log(`  Result action: ${result.action}`);
    console.log(`  State unchanged: ${enrollmentBefore?.state} -> ${enrollmentAfter?.state}`);
    console.log(`  Events unchanged: ${eventCountBefore.length} -> ${eventCountAfter.length}`);
    console.log(`RESULT: ${passed ? "PASS ✓" : "FAIL ✗"}\n`);
    
    return passed;
  } catch (e) {
    console.log(`RESULT: FAIL ✗ - Error: ${e}\n`);
    results.push({
      name: "Unknown callControlId -> 404/no-op without side effects",
      passed: false,
      details: `Error: ${e}`
    });
    return false;
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("TICKET 12.1: Call Summary Normalizer - Test Suite");
  console.log("============================================================\n");
  
  try {
    await setupTestCompany();
    
    await test1_InterestedToQualified();
    await test2_DoNotCallToSuppression();
    await test3_CallbackNextActionAt();
    await test4_Idempotency();
    await test5_UnknownCallControlId();
    
  } finally {
    await fullCleanup();
  }
  
  console.log("\n============================================================");
  console.log("TEST SUMMARY");
  console.log("============================================================");
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  for (const r of results) {
    console.log(`${r.passed ? "✓" : "✗"} ${r.name}`);
    if (!r.passed) {
      console.log(`  Details: ${r.details}`);
    }
  }
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log("\n✓ ALL TESTS PASSED - Ticket 12.1 verified");
  } else {
    console.log("\n✗ SOME TESTS FAILED - Review implementation");
  }
  
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(console.error);
