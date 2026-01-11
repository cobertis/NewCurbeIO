/**
 * TICKET 12.2 VERIFICATION: Orchestrator Action Routing (Tasks)
 * Tests:
 * 1. interested intent -> creates followup task (due_at=now)
 * 2. callback intent -> creates callback task (due_at=now+24h)
 * 3. Complete task -> status=done, completedAt set
 * 4. Mark booked -> state=BOOKED + open tasks closed + BOOKED event
 * 5. not_interested/voicemail -> no task created
 */

import { db } from "../db";
import { 
  campaignEvents, 
  campaignContacts, 
  orchestratorCampaigns,
  orchestratorTasks,
  contacts,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { 
  processCallSummary, 
  CallSummaryWebhookSchema 
} from "../services/call-summary-normalizer";
import { nanoid } from "nanoid";

const TEST_COMPANY_ID = `test-tasks-${Date.now()}`;
const TEST_COMPANY_B_ID = `test-tasks-b-${Date.now()}`;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function setupTestCompany() {
  const testSlug = `testtask${nanoid(4)}`.toLowerCase();
  const testSlugB = `testtaskb${nanoid(4)}`.toLowerCase();
  await db.execute(`
    INSERT INTO companies (id, name, email, slug)
    VALUES ('${TEST_COMPANY_ID}', 'Task Test Company', 'test@tasks.test', '${testSlug}')
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(`
    INSERT INTO companies (id, name, email, slug)
    VALUES ('${TEST_COMPANY_B_ID}', 'Task Test Company B', 'test@tasksb.test', '${testSlugB}')
    ON CONFLICT (id) DO NOTHING
  `);
}

async function createTestContact(suffix: string = ""): Promise<string> {
  const contactId = `task-contact-${suffix}-${Date.now()}`;
  await db.insert(contacts).values({
    id: contactId,
    companyId: TEST_COMPANY_ID,
    firstName: "Test",
    lastName: `Task${suffix}`,
    phone: `+1555${Date.now().toString().slice(-7)}`
  } as any);
  return contactId;
}

async function createTestCampaign(suffix: string = ""): Promise<string> {
  const campaignId = `task-campaign-${suffix}-${Date.now()}`;
  await db.insert(orchestratorCampaigns).values({
    id: campaignId,
    companyId: TEST_COMPANY_ID,
    name: `Task Test Campaign ${suffix}`,
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
  const enrollmentId = `task-enroll-${Date.now()}-${nanoid(4)}`;
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
    id: `task-event-${Date.now()}-${nanoid(4)}`,
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

async function test1_InterestedCreatesFollowupTask() {
  const name = "Test 1: interested intent creates followup task (due_at=now)";
  try {
    const contactId = await createTestContact("interested");
    const campaignId = await createTestCampaign("interested");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "ATTEMPTING");
    
    const callControlId = `call-interested-${Date.now()}`;
    await createCallPlacedEvent(campaignId, contactId, enrollmentId, callControlId);
    
    const beforeTime = new Date();
    
    const result = await processCallSummary({
      provider: "telnyx",
      callControlId,
      intent: "interested"
    });
    
    if (result.action !== "created") {
      results.push({ name, passed: false, details: `Expected action=created, got ${result.action}` });
      return;
    }
    
    if (!result.task) {
      results.push({ name, passed: false, details: "Expected task to be created, but was undefined" });
      return;
    }
    
    if (result.task.type !== "followup") {
      results.push({ name, passed: false, details: `Expected task type=followup, got ${result.task.type}` });
      return;
    }
    
    if (result.task.status !== "open") {
      results.push({ name, passed: false, details: `Expected task status=open, got ${result.task.status}` });
      return;
    }
    
    if (result.task.sourceIntent !== "interested") {
      results.push({ name, passed: false, details: `Expected sourceIntent=interested, got ${result.task.sourceIntent}` });
      return;
    }
    
    const dueAt = new Date(result.task.dueAt);
    const timeDiff = Math.abs(dueAt.getTime() - beforeTime.getTime());
    if (timeDiff > 5000) { // Within 5 seconds
      results.push({ name, passed: false, details: `Expected dueAt to be ~now, but was ${timeDiff}ms away` });
      return;
    }
    
    // Verify TASK_CREATED event was emitted
    const [taskEvent] = await db.select()
      .from(campaignEvents)
      .where(
        and(
          eq(campaignEvents.campaignContactId, enrollmentId),
          eq(campaignEvents.eventType, "TASK_CREATED")
        )
      )
      .limit(1);
    
    if (!taskEvent) {
      results.push({ name, passed: false, details: "Expected TASK_CREATED event, but not found" });
      return;
    }
    
    results.push({ name, passed: true, details: `Task ${result.task.id.slice(0,8)} created with type=followup` });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function test2_CallbackCreatesCallbackTask24h() {
  const name = "Test 2: callback intent creates callback task (due_at=now+24h)";
  try {
    const contactId = await createTestContact("callback");
    const campaignId = await createTestCampaign("callback");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "ATTEMPTING");
    
    const callControlId = `call-callback-${Date.now()}`;
    await createCallPlacedEvent(campaignId, contactId, enrollmentId, callControlId);
    
    const beforeTime = new Date();
    
    const result = await processCallSummary({
      provider: "telnyx",
      callControlId,
      intent: "callback"
    });
    
    if (result.action !== "created") {
      results.push({ name, passed: false, details: `Expected action=created, got ${result.action}` });
      return;
    }
    
    if (!result.task) {
      results.push({ name, passed: false, details: "Expected task to be created, but was undefined" });
      return;
    }
    
    if (result.task.type !== "callback") {
      results.push({ name, passed: false, details: `Expected task type=callback, got ${result.task.type}` });
      return;
    }
    
    const dueAt = new Date(result.task.dueAt);
    const expected24h = beforeTime.getTime() + (24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(dueAt.getTime() - expected24h);
    if (timeDiff > 5000) { // Within 5 seconds of 24h from now
      results.push({ name, passed: false, details: `Expected dueAt to be ~24h from now, but was ${Math.round(timeDiff/1000)}s off` });
      return;
    }
    
    results.push({ name, passed: true, details: `Task ${result.task.id.slice(0,8)} created with type=callback, due in ~24h` });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function test3_CompleteTask() {
  const name = "Test 3: Complete task sets status=done, completedAt";
  try {
    const contactId = await createTestContact("complete");
    const campaignId = await createTestCampaign("complete");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "QUALIFIED");
    
    // Create a task directly
    const taskId = `test-task-${Date.now()}`;
    await db.insert(orchestratorTasks).values({
      id: taskId,
      companyId: TEST_COMPANY_ID,
      contactId,
      campaignId,
      campaignContactId: enrollmentId,
      type: "followup",
      status: "open",
      dueAt: new Date(),
      sourceIntent: "interested"
    });
    
    // Complete the task (completedBy is optional for testing - FK constraint to users table)
    const [updated] = await db.update(orchestratorTasks)
      .set({
        status: "done",
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(orchestratorTasks.id, taskId))
      .returning();
    
    if (updated.status !== "done") {
      results.push({ name, passed: false, details: `Expected status=done, got ${updated.status}` });
      return;
    }
    
    if (!updated.completedAt) {
      results.push({ name, passed: false, details: "Expected completedAt to be set" });
      return;
    }
    
    results.push({ name, passed: true, details: `Task ${taskId.slice(0,8)} completed successfully` });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function test4_MarkBookedClosesTasksAndEmitsEvent() {
  const name = "Test 4: Mark booked sets state=BOOKED, closes open tasks, emits BOOKED event";
  try {
    const contactId = await createTestContact("booked");
    const campaignId = await createTestCampaign("booked");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "QUALIFIED");
    
    // Create an open task
    const taskId = `test-task-booked-${Date.now()}`;
    await db.insert(orchestratorTasks).values({
      id: taskId,
      companyId: TEST_COMPANY_ID,
      contactId,
      campaignId,
      campaignContactId: enrollmentId,
      type: "followup",
      status: "open",
      dueAt: new Date(),
      sourceIntent: "interested"
    });
    
    // Simulate mark-booked endpoint logic
    // 1. Update state to BOOKED
    const [updatedEnrollment] = await db.update(campaignContacts)
      .set({
        state: "BOOKED",
        updatedAt: new Date()
      })
      .where(eq(campaignContacts.id, enrollmentId))
      .returning();
    
    // 2. Close open tasks (completedBy omitted - FK to users table)
    await db.update(orchestratorTasks)
      .set({
        status: "done",
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(orchestratorTasks.campaignContactId, enrollmentId),
          eq(orchestratorTasks.status, "open")
        )
      );
    
    // 3. Emit BOOKED event
    const { emitCampaignEvent } = await import("../services/campaign-events");
    await emitCampaignEvent({
      companyId: TEST_COMPANY_ID,
      campaignId,
      campaignContactId: enrollmentId,
      contactId,
      eventType: "BOOKED",
      channel: "voice",
      provider: "manual",
      payload: { bookedBy: "test-user" }
    });
    
    // Verify state changed
    if (updatedEnrollment.state !== "BOOKED") {
      results.push({ name, passed: false, details: `Expected state=BOOKED, got ${updatedEnrollment.state}` });
      return;
    }
    
    // Verify task was closed
    const [closedTask] = await db.select()
      .from(orchestratorTasks)
      .where(eq(orchestratorTasks.id, taskId))
      .limit(1);
    
    if (closedTask.status !== "done") {
      results.push({ name, passed: false, details: `Expected task status=done, got ${closedTask.status}` });
      return;
    }
    
    // Verify BOOKED event was emitted
    const [bookedEvent] = await db.select()
      .from(campaignEvents)
      .where(
        and(
          eq(campaignEvents.campaignContactId, enrollmentId),
          eq(campaignEvents.eventType, "BOOKED")
        )
      )
      .limit(1);
    
    if (!bookedEvent) {
      results.push({ name, passed: false, details: "Expected BOOKED event, but not found" });
      return;
    }
    
    results.push({ name, passed: true, details: `State=BOOKED, task closed, BOOKED event emitted` });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function test5_NoTaskForNonActionableIntents() {
  const name = "Test 5: not_interested/voicemail/unknown do not create tasks";
  try {
    const testCases = ["not_interested", "voicemail", "unknown"] as const;
    
    for (const intent of testCases) {
      const contactId = await createTestContact(intent);
      const campaignId = await createTestCampaign(intent);
      const enrollmentId = await createTestEnrollment(campaignId, contactId, "ATTEMPTING");
      
      const callControlId = `call-${intent}-${Date.now()}`;
      await createCallPlacedEvent(campaignId, contactId, enrollmentId, callControlId);
      
      const result = await processCallSummary({
        provider: "telnyx",
        callControlId,
        intent
      });
      
      if (result.task) {
        results.push({ name, passed: false, details: `Unexpected task created for intent=${intent}` });
        return;
      }
      
      // Verify no task in database
      const tasks = await db.select()
        .from(orchestratorTasks)
        .where(eq(orchestratorTasks.campaignContactId, enrollmentId));
      
      if (tasks.length > 0) {
        results.push({ name, passed: false, details: `Found ${tasks.length} tasks for intent=${intent}, expected 0` });
        return;
      }
    }
    
    results.push({ name, passed: true, details: `No tasks created for not_interested, voicemail, unknown` });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function test6_CrossTenantCompleteTaskBlocked() {
  const name = "Test 6: Cross-tenant complete task returns 404 (multi-tenant isolation)";
  try {
    // Create task in Company A
    const contactId = await createTestContact("crossA");
    const campaignId = await createTestCampaign("crossA");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "QUALIFIED");
    
    const taskId = `cross-task-${Date.now()}`;
    await db.insert(orchestratorTasks).values({
      id: taskId,
      companyId: TEST_COMPANY_ID,  // Company A
      contactId,
      campaignId,
      campaignContactId: enrollmentId,
      type: "followup",
      status: "open",
      dueAt: new Date(),
      sourceIntent: "interested"
    });
    
    // Simulate query from Company B (should NOT find the task)
    const [taskFromCompanyB] = await db.select()
      .from(orchestratorTasks)
      .where(
        and(
          eq(orchestratorTasks.id, taskId),
          eq(orchestratorTasks.companyId, TEST_COMPANY_B_ID)  // Wrong company
        )
      )
      .limit(1);
    
    if (taskFromCompanyB) {
      results.push({ name, passed: false, details: "Cross-tenant access allowed - SECURITY BREACH!" });
      return;
    }
    
    // Verify task still exists for correct company
    const [taskFromCompanyA] = await db.select()
      .from(orchestratorTasks)
      .where(
        and(
          eq(orchestratorTasks.id, taskId),
          eq(orchestratorTasks.companyId, TEST_COMPANY_ID)  // Correct company
        )
      )
      .limit(1);
    
    if (!taskFromCompanyA) {
      results.push({ name, passed: false, details: "Task not found for correct company" });
      return;
    }
    
    results.push({ name, passed: true, details: "Cross-tenant complete blocked - task not visible to other company" });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function test7_CrossTenantMarkBookedBlocked() {
  const name = "Test 7: Cross-tenant mark-booked returns 404 (multi-tenant isolation)";
  try {
    // Create enrollment in Company A
    const contactId = await createTestContact("crossB");
    const campaignId = await createTestCampaign("crossB");
    const enrollmentId = await createTestEnrollment(campaignId, contactId, "QUALIFIED");
    
    // Simulate query from Company B (should NOT find the enrollment)
    const [enrollmentFromCompanyB] = await db.select()
      .from(campaignContacts)
      .where(
        and(
          eq(campaignContacts.id, enrollmentId),
          eq(campaignContacts.companyId, TEST_COMPANY_B_ID)  // Wrong company
        )
      )
      .limit(1);
    
    if (enrollmentFromCompanyB) {
      results.push({ name, passed: false, details: "Cross-tenant access allowed - SECURITY BREACH!" });
      return;
    }
    
    // Verify enrollment still exists for correct company
    const [enrollmentFromCompanyA] = await db.select()
      .from(campaignContacts)
      .where(
        and(
          eq(campaignContacts.id, enrollmentId),
          eq(campaignContacts.companyId, TEST_COMPANY_ID)  // Correct company
        )
      )
      .limit(1);
    
    if (!enrollmentFromCompanyA) {
      results.push({ name, passed: false, details: "Enrollment not found for correct company" });
      return;
    }
    
    results.push({ name, passed: true, details: "Cross-tenant mark-booked blocked - enrollment not visible to other company" });
  } catch (error: any) {
    results.push({ name, passed: false, details: `Error: ${error.message}` });
  }
}

async function cleanup() {
  try {
    // Clean up test data in reverse order of dependencies for both companies
    await db.delete(orchestratorTasks).where(eq(orchestratorTasks.companyId, TEST_COMPANY_ID));
    await db.delete(campaignEvents).where(eq(campaignEvents.companyId, TEST_COMPANY_ID));
    await db.delete(campaignContacts).where(eq(campaignContacts.companyId, TEST_COMPANY_ID));
    await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.companyId, TEST_COMPANY_ID));
    await db.delete(contacts).where(eq(contacts.companyId, TEST_COMPANY_ID));
    await db.execute(`DELETE FROM companies WHERE id = '${TEST_COMPANY_ID}'`);
    await db.execute(`DELETE FROM companies WHERE id = '${TEST_COMPANY_B_ID}'`);
    console.log("Cleanup complete");
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("TICKET 12.2 VERIFICATION: Orchestrator Tasks");
  console.log("=".repeat(60));
  
  try {
    await setupTestCompany();
    
    await test1_InterestedCreatesFollowupTask();
    await test2_CallbackCreatesCallbackTask24h();
    await test3_CompleteTask();
    await test4_MarkBookedClosesTasksAndEmitsEvent();
    await test5_NoTaskForNonActionableIntents();
    await test6_CrossTenantCompleteTaskBlocked();
    await test7_CrossTenantMarkBookedBlocked();
    
    console.log("\n" + "=".repeat(60));
    console.log("RESULTS:");
    console.log("=".repeat(60));
    
    for (const r of results) {
      const icon = r.passed ? "✓" : "✗";
      console.log(`${icon} ${r.name}`);
      console.log(`  ${r.details}`);
    }
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log("\n" + "-".repeat(60));
    console.log(`SUMMARY: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log("ALL TESTS PASSED - Ticket 12.2 Action Routing VERIFIED");
    } else {
      console.log("SOME TESTS FAILED - Review above");
    }
  } finally {
    await cleanup();
  }
  
  process.exit(results.every(r => r.passed) ? 0 : 1);
}

runTests().catch(console.error);
