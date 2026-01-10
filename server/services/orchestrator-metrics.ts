import { db } from "../db";
import { campaignEvents, campaignContacts, orchestratorJobs, orchestratorCampaigns } from "@shared/schema";
import { eq, and, sql, gte, count } from "drizzle-orm";
import { ATTEMPT_EVENT_TYPES } from "../constants/orchestrator";

/**
 * Campaign Metrics v1.1
 * 
 * DENOMINATORS:
 * - deliveryRate = delivered / attempts
 * - replyRate = replied / delivered
 * - optOutRate = optOut / delivered
 * - failureRateFinal = failedFinal / attempts
 * 
 * FAILURES:
 * - failed = all MESSAGE_FAILED events (attempts that didn't deliver)
 * - failedFinal = MESSAGE_FAILED where payload.isFinal = true (permanently failed, no more retries)
 * 
 * REPLY LATENCY:
 * - avgTimeToReplySeconds = average of (first MESSAGE_REPLIED - first MESSAGE_SENT) per campaign_contact_id
 */

export interface VariantMetrics {
  attempts: number;
  delivered: number;
  replied: number;
  optOut: number;
  failedFinal: number;
  rates: {
    deliveryRate: number;
    replyRate: number;
    optOutRate: number;
    failureRateFinal: number;
  };
  avgTimeToReplySeconds: number | null;
}

export interface CampaignMetrics {
  campaignId: string;
  window: string;
  totals: {
    contactsEnrolled: number;
    activeContacts: number;
    stoppedContacts: number;
    engagedContacts: number;
    unreachableContacts: number;
  };
  attempts: number;
  delivered: number;
  read: number;
  failed: number;
  failedFinal: number;
  replied: number;
  optOut: number;
  rates: {
    deliveryRate: number;
    replyRate: number;
    optOutRate: number;
    failureRate: number;
    failureRateFinal: number;
  };
  avgTimeToReplySeconds: number | null;
  breakdownByChannel: Record<string, {
    attempts: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    failedFinal: number;
    optOut: number;
  }>;
  metricsByVariant: Record<string, VariantMetrics>;
}

export interface JobMetrics {
  campaignId: string;
  queuedCount: number;
  processingCount: number;
  failedCount: number;
  doneCount: number;
  avgRetryCount: number;
  oldestQueuedAgeSec: number | null;
}

function getWindowStartDate(window: string): Date | null {
  const now = new Date();
  if (window === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (window === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}

export async function getCampaignMetrics(
  companyId: string,
  campaignId: string,
  window: string = "all"
): Promise<CampaignMetrics> {
  const windowStart = getWindowStartDate(window);
  
  const baseEventConditions = [
    eq(campaignEvents.companyId, companyId),
    eq(campaignEvents.campaignId, campaignId)
  ];
  
  if (windowStart) {
    baseEventConditions.push(gte(campaignEvents.createdAt, windowStart));
  }

  // Contact totals
  const [contactStates] = await db.select({
    total: count(),
    active: sql<number>`COUNT(*) FILTER (WHERE ${campaignContacts.state} IN ('NEW', 'ATTEMPTING'))`,
    stopped: sql<number>`COUNT(*) FILTER (WHERE ${campaignContacts.state} = 'STOPPED')`,
    engaged: sql<number>`COUNT(*) FILTER (WHERE ${campaignContacts.state} = 'ENGAGED')`,
    unreachable: sql<number>`COUNT(*) FILTER (WHERE ${campaignContacts.state} = 'UNREACHABLE')`
  })
    .from(campaignContacts)
    .where(and(
      eq(campaignContacts.companyId, companyId),
      eq(campaignContacts.campaignId, campaignId)
    ));

  // Event counts by type + channel (basic events)
  const eventCounts = await db.select({
    eventType: campaignEvents.eventType,
    channel: campaignEvents.channel,
    cnt: count()
  })
    .from(campaignEvents)
    .where(and(...baseEventConditions))
    .groupBy(campaignEvents.eventType, campaignEvents.channel);

  // Separate query for failedFinal (where payload.isFinal = true)
  const failedFinalResult = await db.execute(sql`
    SELECT channel, COUNT(*) as cnt
    FROM campaign_events
    WHERE company_id = ${companyId}
      AND campaign_id = ${campaignId}
      AND event_type = 'MESSAGE_FAILED'
      AND (payload->>'isFinal')::boolean = true
      ${windowStart ? sql`AND created_at >= ${windowStart}` : sql``}
    GROUP BY channel
  `);

  const failedFinalByChannel: Record<string, number> = {};
  let failedFinalTotal = 0;
  for (const row of (failedFinalResult.rows || []) as any[]) {
    const channel = row.channel || "unknown";
    const cnt = Number(row.cnt);
    failedFinalByChannel[channel] = (failedFinalByChannel[channel] || 0) + cnt;
    failedFinalTotal += cnt;
  }

  let attempts = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;
  let replied = 0;
  let optOut = 0;

  const breakdownByChannel: Record<string, {
    attempts: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    failedFinal: number;
    optOut: number;
  }> = {};

  for (const row of eventCounts) {
    const channel = row.channel || "unknown";
    if (!breakdownByChannel[channel]) {
      breakdownByChannel[channel] = { 
        attempts: 0, 
        delivered: 0, 
        read: 0,
        replied: 0, 
        failed: 0, 
        failedFinal: 0,
        optOut: 0 
      };
    }

    const cnt = Number(row.cnt);

    if (ATTEMPT_EVENT_TYPES.includes(row.eventType as any)) {
      attempts += cnt;
      breakdownByChannel[channel].attempts += cnt;
    }

    const eventType = row.eventType as string;
    
    switch (eventType) {
      case "MESSAGE_DELIVERED":
        delivered += cnt;
        breakdownByChannel[channel].delivered += cnt;
        break;
      case "MESSAGE_READ":
        read += cnt;
        breakdownByChannel[channel].read += cnt;
        break;
      case "MESSAGE_FAILED":
        failed += cnt;
        breakdownByChannel[channel].failed += cnt;
        break;
      case "MESSAGE_REPLIED":
        replied += cnt;
        breakdownByChannel[channel].replied += cnt;
        break;
      case "OPT_OUT":
        optOut += cnt;
        breakdownByChannel[channel].optOut += cnt;
        break;
    }
  }

  // Add failedFinal to breakdown
  for (const channel of Object.keys(breakdownByChannel)) {
    breakdownByChannel[channel].failedFinal = failedFinalByChannel[channel] || 0;
  }
  // Ensure channels with only failedFinal are included
  for (const channel of Object.keys(failedFinalByChannel)) {
    if (!breakdownByChannel[channel]) {
      breakdownByChannel[channel] = { 
        attempts: 0, delivered: 0, read: 0, replied: 0, failed: 0, failedFinal: failedFinalByChannel[channel], optOut: 0 
      };
    }
  }

  // RATES with documented denominators:
  // deliveryRate = delivered / attempts
  const deliveryRate = attempts > 0 ? Math.round((delivered / attempts) * 100) / 100 : 0;
  // replyRate = replied / delivered
  const replyRate = delivered > 0 ? Math.round((replied / delivered) * 100) / 100 : 0;
  // optOutRate = optOut / delivered
  const optOutRate = delivered > 0 ? Math.round((optOut / delivered) * 100) / 100 : 0;
  // failureRate = failed / attempts (all failures)
  const failureRate = attempts > 0 ? Math.round((failed / attempts) * 100) / 100 : 0;
  // failureRateFinal = failedFinal / attempts (only permanent failures)
  const failureRateFinal = attempts > 0 ? Math.round((failedFinalTotal / attempts) * 100) / 100 : 0;

  // avgTimeToReplySeconds: first MESSAGE_SENT to first MESSAGE_REPLIED per campaign_contact_id
  let avgTimeToReplySeconds: number | null = null;
  try {
    const avgReplyResult = await db.execute(sql`
      WITH first_sent AS (
        SELECT campaign_contact_id, MIN(created_at) as first_sent_at
        FROM campaign_events
        WHERE company_id = ${companyId}
          AND campaign_id = ${campaignId}
          AND event_type = 'MESSAGE_SENT'
          ${windowStart ? sql`AND created_at >= ${windowStart}` : sql``}
        GROUP BY campaign_contact_id
      ),
      first_reply AS (
        SELECT campaign_contact_id, MIN(created_at) as first_reply_at
        FROM campaign_events
        WHERE company_id = ${companyId}
          AND campaign_id = ${campaignId}
          AND event_type = 'MESSAGE_REPLIED'
          ${windowStart ? sql`AND created_at >= ${windowStart}` : sql``}
        GROUP BY campaign_contact_id
      )
      SELECT AVG(EXTRACT(EPOCH FROM (fr.first_reply_at - fs.first_sent_at))) as avg_seconds
      FROM first_sent fs
      JOIN first_reply fr ON fs.campaign_contact_id = fr.campaign_contact_id
      WHERE fr.first_reply_at > fs.first_sent_at
    `);
    
    const avgReply = avgReplyResult.rows?.[0] as any;
    if (avgReply && avgReply.avg_seconds) {
      avgTimeToReplySeconds = Math.round(Number(avgReply.avg_seconds));
    }
  } catch (e) {
    // Ignore errors in reply latency calculation
  }

  // Metrics by variant: aggregate events grouped by campaign_contacts.variant
  const metricsByVariant: Record<string, VariantMetrics> = {};
  
  try {
    const variantEventCounts = await db.execute(sql`
      SELECT 
        COALESCE(cc.variant, 'control') as variant,
        ce.event_type,
        COUNT(*) as cnt
      FROM campaign_events ce
      JOIN campaign_contacts cc ON ce.campaign_contact_id = cc.id
      WHERE ce.company_id = ${companyId}
        AND ce.campaign_id = ${campaignId}
        ${windowStart ? sql`AND ce.created_at >= ${windowStart}` : sql``}
      GROUP BY cc.variant, ce.event_type
    `);
    
    const variantFailedFinal = await db.execute(sql`
      SELECT 
        COALESCE(cc.variant, 'control') as variant,
        COUNT(*) as cnt
      FROM campaign_events ce
      JOIN campaign_contacts cc ON ce.campaign_contact_id = cc.id
      WHERE ce.company_id = ${companyId}
        AND ce.campaign_id = ${campaignId}
        AND ce.event_type = 'MESSAGE_FAILED'
        AND (ce.payload->>'isFinal')::boolean = true
        ${windowStart ? sql`AND ce.created_at >= ${windowStart}` : sql``}
      GROUP BY cc.variant
    `);
    
    const failedFinalByVariant: Record<string, number> = {};
    for (const row of (variantFailedFinal.rows || []) as any[]) {
      failedFinalByVariant[row.variant || "control"] = Number(row.cnt);
    }
    
    const variantData: Record<string, { attempts: number; delivered: number; replied: number; optOut: number }> = {};
    
    for (const row of (variantEventCounts.rows || []) as any[]) {
      const v = row.variant || "control";
      if (!variantData[v]) {
        variantData[v] = { attempts: 0, delivered: 0, replied: 0, optOut: 0 };
      }
      
      const cnt = Number(row.cnt);
      const et = row.event_type as string;
      
      if (["MESSAGE_SENT", "CALL_PLACED", "VOICEMAIL_DROPPED", "RVM_DROPPED"].includes(et)) {
        variantData[v].attempts += cnt;
      }
      if (et === "MESSAGE_DELIVERED") variantData[v].delivered += cnt;
      if (et === "MESSAGE_REPLIED") variantData[v].replied += cnt;
      if (et === "OPT_OUT") variantData[v].optOut += cnt;
    }
    
    for (const [v, d] of Object.entries(variantData)) {
      const ff = failedFinalByVariant[v] || 0;
      metricsByVariant[v] = {
        attempts: d.attempts,
        delivered: d.delivered,
        replied: d.replied,
        optOut: d.optOut,
        failedFinal: ff,
        rates: {
          deliveryRate: d.attempts > 0 ? Math.round((d.delivered / d.attempts) * 100) / 100 : 0,
          replyRate: d.delivered > 0 ? Math.round((d.replied / d.delivered) * 100) / 100 : 0,
          optOutRate: d.delivered > 0 ? Math.round((d.optOut / d.delivered) * 100) / 100 : 0,
          failureRateFinal: d.attempts > 0 ? Math.round((ff / d.attempts) * 100) / 100 : 0
        },
        avgTimeToReplySeconds: null
      };
    }
  } catch (e) {
    // Ignore variant metrics errors
  }

  return {
    campaignId,
    window,
    totals: {
      contactsEnrolled: Number(contactStates?.total || 0),
      activeContacts: Number(contactStates?.active || 0),
      stoppedContacts: Number(contactStates?.stopped || 0),
      engagedContacts: Number(contactStates?.engaged || 0),
      unreachableContacts: Number(contactStates?.unreachable || 0)
    },
    attempts,
    delivered,
    read,
    failed,
    failedFinal: failedFinalTotal,
    replied,
    optOut,
    rates: {
      deliveryRate,
      replyRate,
      optOutRate,
      failureRate,
      failureRateFinal
    },
    avgTimeToReplySeconds,
    breakdownByChannel,
    metricsByVariant
  };
}

export async function getJobMetrics(
  companyId: string,
  campaignId: string
): Promise<JobMetrics> {
  const [counts] = await db.select({
    queued: sql<number>`COUNT(*) FILTER (WHERE ${orchestratorJobs.status} = 'queued')`,
    processing: sql<number>`COUNT(*) FILTER (WHERE ${orchestratorJobs.status} = 'processing')`,
    failed: sql<number>`COUNT(*) FILTER (WHERE ${orchestratorJobs.status} = 'failed')`,
    done: sql<number>`COUNT(*) FILTER (WHERE ${orchestratorJobs.status} = 'done')`,
    avgRetries: sql<number>`COALESCE(AVG(${orchestratorJobs.retryCount}), 0)`
  })
    .from(orchestratorJobs)
    .where(and(
      eq(orchestratorJobs.companyId, companyId),
      eq(orchestratorJobs.campaignId, campaignId)
    ));

  let oldestQueuedAgeSec: number | null = null;
  try {
    const [oldest] = await db.select({
      createdAt: orchestratorJobs.createdAt
    })
      .from(orchestratorJobs)
      .where(and(
        eq(orchestratorJobs.companyId, companyId),
        eq(orchestratorJobs.campaignId, campaignId),
        eq(orchestratorJobs.status, "queued")
      ))
      .orderBy(orchestratorJobs.createdAt)
      .limit(1);
    
    if (oldest?.createdAt) {
      oldestQueuedAgeSec = Math.round((Date.now() - new Date(oldest.createdAt).getTime()) / 1000);
    }
  } catch (e) {
    // Ignore
  }

  return {
    campaignId,
    queuedCount: Number(counts?.queued || 0),
    processingCount: Number(counts?.processing || 0),
    failedCount: Number(counts?.failed || 0),
    doneCount: Number(counts?.done || 0),
    avgRetryCount: Math.round((Number(counts?.avgRetries || 0)) * 100) / 100,
    oldestQueuedAgeSec
  };
}

export async function verifyCampaignAccess(
  companyId: string,
  campaignId: string
): Promise<boolean> {
  const [campaign] = await db.select({ id: orchestratorCampaigns.id })
    .from(orchestratorCampaigns)
    .where(and(
      eq(orchestratorCampaigns.id, campaignId),
      eq(orchestratorCampaigns.companyId, companyId)
    ))
    .limit(1);
  
  return !!campaign;
}
