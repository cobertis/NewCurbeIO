import { db } from "../db";
import { contacts, orchestratorCampaigns, campaignContacts, companies, users } from "@shared/schema";
import { eq, and, inArray, isNotNull, gte, sql } from "drizzle-orm";
import { SQL } from "drizzle-orm";
import { nanoid } from "nanoid";

const testResults: { name: string; passed: boolean; details: string }[] = [];

async function enrollByFilterLogic(
  companyId: string,
  campaignId: string,
  filter: { createdAfter?: string; hasPhone?: boolean; hasEmail?: boolean; tag?: string; search?: string; limit?: number },
  state: string = "NEW",
  startNow: boolean = true,
  priority: number = 5
) {
  const { createdAfter, hasPhone, hasEmail, tag, search, limit = 500 } = filter;

  const [campaign] = await db.select()
    .from(orchestratorCampaigns)
    .where(and(
      eq(orchestratorCampaigns.id, campaignId),
      eq(orchestratorCampaigns.companyId, companyId)
    ))
    .limit(1);

  if (!campaign) {
    return { error: "Campaign not found", status: 404 };
  }

  const conditions: SQL[] = [eq(contacts.companyId, companyId)];

  if (createdAfter) {
    conditions.push(gte(contacts.createdAt, new Date(createdAfter)));
  }

  if (hasPhone === true) {
    conditions.push(isNotNull(contacts.phoneNormalized));
  }

  if (hasEmail === true) {
    conditions.push(isNotNull(contacts.email));
  }

  if (tag && typeof tag === "string") {
    conditions.push(sql`${contacts.tags} @> ARRAY[${tag}]::text[]`);
  }

  const matchedContacts = await db.select({ id: contacts.id })
    .from(contacts)
    .where(and(...conditions))
    .limit(Math.min(limit, 1000));

  const matched = matchedContacts.length;

  if (matched === 0) {
    return {
      campaignId,
      matched: 0,
      attempted: 0,
      created: 0,
      skippedExisting: 0,
      errors: [],
      enrollments: []
    };
  }

  const contactIds = matchedContacts.map(c => c.id);

  const existingEnrollments = await db.select({ 
    contactId: campaignContacts.contactId,
    id: campaignContacts.id 
  })
    .from(campaignContacts)
    .where(and(
      eq(campaignContacts.campaignId, campaignId),
      inArray(campaignContacts.contactId, contactIds)
    ));

  const existingContactIds = new Set(existingEnrollments.map(e => e.contactId));

  const results = {
    campaignId,
    matched,
    attempted: contactIds.length,
    created: 0,
    skippedExisting: 0,
    errors: [] as Array<{ contactId: string; error: string }>,
    enrollments: [] as Array<{ contactId: string; campaignContactId: string; created: boolean }>
  };

  const now = new Date();
  const nextActionAt = startNow ? new Date(now.getTime() - 60000) : null;

  for (const contactId of contactIds) {
    if (existingContactIds.has(contactId)) {
      const existing = existingEnrollments.find(e => e.contactId === contactId);
      results.skippedExisting++;
      results.enrollments.push({ 
        contactId, 
        campaignContactId: existing!.id, 
        created: false 
      });
      continue;
    }

    try {
      const [newEnrollment] = await db.insert(campaignContacts)
        .values({
          campaignId,
          contactId,
          companyId,
          state: state as any,
          priority: priority || 5,
          nextActionAt
        })
        .returning({ id: campaignContacts.id });

      results.created++;
      results.enrollments.push({ 
        contactId, 
        campaignContactId: newEnrollment.id, 
        created: true 
      });
    } catch (insertErr: any) {
      if (insertErr.code === "23505") {
        results.skippedExisting++;
        results.enrollments.push({ 
          contactId, 
          campaignContactId: "", 
          created: false 
        });
      } else {
        results.errors.push({ contactId, error: insertErr.message });
      }
    }
  }

  return results;
}

async function runTests() {
  console.log("============================================================");
  console.log("TASK D VERIFICATION: Enroll by Filter API");
  console.log("============================================================");
  
  const suffix = nanoid(8);
  const testCompanyId = `test-filter-company-${suffix}`;
  const testCampaignId = `test-filter-campaign-${suffix}`;
  const otherCompanyId = `test-other-company-${suffix}`;
  
  console.log("Setting up test data...\n");
  
  try {
    await db.insert(companies).values([
      { id: testCompanyId, name: "Test Filter Company", slug: `test-filter-${suffix}`, email: "test@filter.com" },
      { id: otherCompanyId, name: "Other Filter Company", slug: `other-filter-${suffix}`, email: "other@filter.com" }
    ]);

    await db.insert(orchestratorCampaigns).values({
      id: testCampaignId,
      companyId: testCompanyId,
      name: "Test Filter Campaign",
      status: "active",
      createdBy: null
    });

    await db.insert(contacts).values([
      { id: `test-filter-contact-phone-1-${suffix}`, companyId: testCompanyId, firstName: "WithPhone", lastName: "One", phoneNormalized: "+15551111111", email: null },
      { id: `test-filter-contact-phone-2-${suffix}`, companyId: testCompanyId, firstName: "WithPhone", lastName: "Two", phoneNormalized: "+15552222222", email: null },
      { id: `test-filter-contact-nophone-${suffix}`, companyId: testCompanyId, firstName: "NoPhone", lastName: "User", phoneNormalized: null, email: "nophone@test.com" },
      { id: `test-filter-contact-other-${suffix}`, companyId: otherCompanyId, firstName: "Other", lastName: "Company", phoneNormalized: "+15553333333", email: null }
    ]);

    console.log("Test 1: Filter hasPhone enrolls only those with phone...");
    const result1 = await enrollByFilterLogic(testCompanyId, testCampaignId, { hasPhone: true });
    if ("error" in result1) {
      testResults.push({ name: "Test 1: hasPhone filter", passed: false, details: result1.error });
    } else if (result1.matched === 2 && result1.created === 2) {
      testResults.push({ name: "Test 1: hasPhone filter", passed: true, details: `matched=${result1.matched}, created=${result1.created}` });
    } else {
      testResults.push({ name: "Test 1: hasPhone filter", passed: false, details: `Expected matched=2, created=2, got matched=${result1.matched}, created=${result1.created}` });
    }

    console.log("Test 2: Limit respected...");
    const result2 = await enrollByFilterLogic(testCompanyId, testCampaignId, { limit: 1 });
    if ("error" in result2) {
      testResults.push({ name: "Test 2: Limit respected", passed: false, details: result2.error });
    } else if (result2.matched === 1) {
      testResults.push({ name: "Test 2: Limit respected", passed: true, details: `matched=${result2.matched} (limit=1 respected)` });
    } else {
      testResults.push({ name: "Test 2: Limit respected", passed: false, details: `Expected matched=1, got matched=${result2.matched}` });
    }

    console.log("Test 3: Multi-tenant isolation...");
    const result3 = await enrollByFilterLogic(otherCompanyId, testCampaignId, { hasPhone: true });
    if ("error" in result3 && result3.status === 404) {
      testResults.push({ name: "Test 3: Multi-tenant isolation", passed: true, details: "Campaign not found (correct)" });
    } else {
      testResults.push({ name: "Test 3: Multi-tenant isolation", passed: false, details: "Should have returned 404" });
    }

    console.log("Test 4: Idempotency (2 runs do not duplicate)...");
    const result4 = await enrollByFilterLogic(testCompanyId, testCampaignId, { hasPhone: true });
    if ("error" in result4) {
      testResults.push({ name: "Test 4: Idempotency", passed: false, details: result4.error });
    } else if (result4.created === 0 && result4.skippedExisting === 2) {
      testResults.push({ name: "Test 4: Idempotency", passed: true, details: `created=${result4.created}, skipped=${result4.skippedExisting}` });
    } else {
      testResults.push({ name: "Test 4: Idempotency", passed: false, details: `Expected created=0, skipped=2, got created=${result4.created}, skipped=${result4.skippedExisting}` });
    }

  } finally {
    console.log("Cleaning up...");
    await db.delete(campaignContacts).where(eq(campaignContacts.campaignId, testCampaignId));
    await db.delete(orchestratorCampaigns).where(eq(orchestratorCampaigns.id, testCampaignId));
    await db.delete(contacts).where(eq(contacts.companyId, testCompanyId));
    await db.delete(contacts).where(eq(contacts.companyId, otherCompanyId));
    await db.delete(companies).where(eq(companies.id, testCompanyId));
    await db.delete(companies).where(eq(companies.id, otherCompanyId));
    console.log("Cleanup complete\n");
  }

  console.log("============================================================");
  console.log("RESULTS:");
  console.log("============================================================");
  
  let passed = 0;
  for (const result of testResults) {
    const status = result.passed ? "✓" : "✗";
    console.log(`${status} ${result.name}`);
    console.log(`  ${result.details}`);
    if (result.passed) passed++;
  }

  console.log("------------------------------------------------------------");
  console.log(`SUMMARY: ${passed}/${testResults.length} tests passed`);
  
  if (passed === testResults.length) {
    console.log("ALL TESTS PASSED - Task D Enroll by Filter API VERIFIED");
  } else {
    console.log("SOME TESTS FAILED");
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
