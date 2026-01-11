/**
 * Run Jobs Once - Demo script for testing voicemail asset retry logic
 * Usage: npx tsx server/scripts/run-jobs-once.ts --company=<cid> --limit=10
 */
import { db } from "../db";
import { orchestratorJobs, orchestratorAssets, campaignEvents } from "@shared/schema";
import { eq, and, lte, desc, sql } from "drizzle-orm";

const ASSET_NOT_READY_MAX_RETRIES = 6;
const ASSET_NOT_READY_DELAY_MS = 10 * 60 * 1000; // 10 minutes

function buildEventExternalId(jobExternalId: string, suffix: string): string {
  return `job:${jobExternalId}:${suffix}`;
}

async function processVoicemailJob(jobId: string) {
  const [job] = await db.select().from(orchestratorJobs).where(eq(orchestratorJobs.id, jobId));
  if (!job) {
    console.log(`Job not found: ${jobId}`);
    return;
  }

  console.log(`\n--- Processing Job: ${job.id} ---`);
  console.log(`Status: ${job.status}`);
  console.log(`Retry Count: ${job.retryCount}`);
  console.log(`External ID: ${job.externalId}`);
  console.log(`Payload: ${JSON.stringify(job.payload)}`);

  const payload = job.payload as Record<string, any>;
  const assetId = payload.assetId;

  if (!assetId) {
    console.log("No assetId in payload, skipping asset check");
    return;
  }

  const [asset] = await db.select().from(orchestratorAssets)
    .where(and(
      eq(orchestratorAssets.id, assetId),
      eq(orchestratorAssets.companyId, job.companyId)
    ));

  if (!asset) {
    console.log(`Asset not found: ${assetId}`);
    await db.update(orchestratorJobs)
      .set({ status: "failed", error: `Asset not found: ${assetId}`, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(orchestratorJobs.id, job.id));
    return;
  }

  console.log(`\nAsset: ${asset.id}`);
  console.log(`  Name: ${asset.name}`);
  console.log(`  Status: ${asset.status}`);

  if (asset.status === "draft" || asset.status === "generating") {
    if (job.retryCount < ASSET_NOT_READY_MAX_RETRIES) {
      const newRetryCount = job.retryCount + 1;
      const newRunAt = new Date(Date.now() + ASSET_NOT_READY_DELAY_MS);
      const error = `Asset not ready (status: ${asset.status}): ${assetId}`;

      await db.update(orchestratorJobs)
        .set({
          status: "queued",
          retryCount: newRetryCount,
          runAt: newRunAt,
          error,
          startedAt: null,
          completedAt: null,
          updatedAt: new Date()
        })
        .where(eq(orchestratorJobs.id, job.id));

      // Emit VOICEMAIL_FAILED with final: false
      await db.insert(campaignEvents).values({
        companyId: job.companyId,
        campaignId: job.campaignId,
        campaignContactId: job.campaignContactId,
        contactId: job.contactId,
        eventType: "VOICEMAIL_FAILED",
        channel: "voicemail",
        provider: "telnyx",
        externalId: buildEventExternalId(job.externalId!, `voicemail_failed_attempt_${newRetryCount}`),
        payload: {
          jobId: job.id,
          reason: "asset_not_ready",
          assetId,
          status: asset.status,
          final: false,
          attemptNumber: newRetryCount
        }
      });

      console.log(`\n✓ Job requeued (attempt ${newRetryCount}/${ASSET_NOT_READY_MAX_RETRIES})`);
      console.log(`  New run_at: ${newRunAt.toISOString()}`);
      console.log(`  Event emitted: VOICEMAIL_FAILED (final: false)`);
    } else {
      const error = `Asset still not ready after ${ASSET_NOT_READY_MAX_RETRIES} retries`;
      await db.update(orchestratorJobs)
        .set({ status: "failed", error, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(orchestratorJobs.id, job.id));

      await db.insert(campaignEvents).values({
        companyId: job.companyId,
        campaignId: job.campaignId,
        campaignContactId: job.campaignContactId,
        contactId: job.contactId,
        eventType: "VOICEMAIL_FAILED",
        channel: "voicemail",
        provider: "telnyx",
        externalId: buildEventExternalId(job.externalId!, "voicemail_failed"),
        payload: {
          jobId: job.id,
          reason: "asset_not_ready_max_retries",
          assetId,
          status: asset.status,
          final: true
        }
      });

      console.log(`\n✗ Job failed: Max retries exceeded`);
      console.log(`  Event emitted: VOICEMAIL_FAILED (final: true)`);
    }
  } else if (asset.status === "failed") {
    const error = `Asset generation failed: ${assetId}`;
    await db.update(orchestratorJobs)
      .set({ status: "failed", error, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(orchestratorJobs.id, job.id));

    await db.insert(campaignEvents).values({
      companyId: job.companyId,
      campaignId: job.campaignId,
      campaignContactId: job.campaignContactId,
      contactId: job.contactId,
      eventType: "VOICEMAIL_FAILED",
      channel: "voicemail",
      provider: "telnyx",
      externalId: buildEventExternalId(job.externalId!, "voicemail_failed"),
      payload: {
        jobId: job.id,
        reason: "asset_failed",
        assetId,
        status: "failed",
        final: true
      }
    });

    console.log(`\n✗ Job failed: Asset generation failed`);
    console.log(`  Event emitted: VOICEMAIL_FAILED (final: true)`);
  } else if (asset.status === "ready") {
    const outputJson = asset.outputJson as Record<string, any> || {};
    const assetUrl = outputJson.asset_url || outputJson.assetUrl;

    if (!assetUrl) {
      const error = `Asset has no URL: ${assetId}`;
      await db.update(orchestratorJobs)
        .set({ status: "failed", error, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(orchestratorJobs.id, job.id));

      await db.insert(campaignEvents).values({
        companyId: job.companyId,
        campaignId: job.campaignId,
        campaignContactId: job.campaignContactId,
        contactId: job.contactId,
        eventType: "VOICEMAIL_FAILED",
        channel: "voicemail",
        provider: "telnyx",
        externalId: buildEventExternalId(job.externalId!, "voicemail_failed"),
        payload: {
          jobId: job.id,
          reason: "asset_no_url",
          assetId,
          status: "ready",
          final: true
        }
      });

      console.log(`\n✗ Job failed: Asset has no URL`);
    } else {
      // Mark as done (would normally call voice adapter here)
      await db.update(orchestratorJobs)
        .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(orchestratorJobs.id, job.id));

      await db.insert(campaignEvents).values({
        companyId: job.companyId,
        campaignId: job.campaignId,
        campaignContactId: job.campaignContactId,
        contactId: job.contactId,
        eventType: "VOICEMAIL_DROPPED",
        channel: "voicemail",
        provider: "telnyx",
        externalId: buildEventExternalId(job.externalId!, "voicemail_dropped"),
        payload: {
          jobId: job.id,
          assetId,
          assetUrl
        }
      });

      console.log(`\n✓ Job completed! Asset ready with URL: ${assetUrl}`);
      console.log(`  Event emitted: VOICEMAIL_DROPPED`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  let companyId = "b5325600-9bf9-4eae-b34a-87d6ab2f5fb2";
  let limit = 10;

  for (const arg of args) {
    if (arg.startsWith("--company=")) {
      companyId = arg.split("=")[1];
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10);
    }
  }

  console.log("==========================================");
  console.log("Run Jobs Once - Voicemail Asset Retry Demo");
  console.log("==========================================");
  console.log(`Company: ${companyId}`);
  console.log(`Limit: ${limit}`);

  // Find queued voicemail jobs
  const jobs = await db.select()
    .from(orchestratorJobs)
    .where(and(
      eq(orchestratorJobs.companyId, companyId),
      eq(orchestratorJobs.channel, "voicemail"),
      eq(orchestratorJobs.status, "queued"),
      lte(orchestratorJobs.runAt, new Date())
    ))
    .orderBy(orchestratorJobs.runAt)
    .limit(limit);

  console.log(`\nFound ${jobs.length} queued voicemail job(s) ready to run`);

  for (const job of jobs) {
    await processVoicemailJob(job.id);
  }

  console.log("\n==========================================");
  console.log("Done");
  console.log("==========================================");
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
