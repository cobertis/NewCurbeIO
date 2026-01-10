/**
 * Orchestrator Experiments Service
 * A/B testing framework for campaign orchestration strategies
 * 
 * EXPERIMENT POLICY STRUCTURE:
 * {
 *   "experiment": {
 *     "enabled": true,
 *     "variants": [
 *       { "name": "A_heuristic", "aiEnabled": false, "channelOrder": ["sms","voice"] },
 *       { "name": "B_ai_enabled", "aiEnabled": true }
 *     ],
 *     "allocation": { "A_heuristic": 0.5, "B_ai_enabled": 0.5 }
 *   }
 * }
 */

import { db } from "../db";
import { campaignContacts, orchestratorCampaigns } from "@shared/schema";
import { eq } from "drizzle-orm";
import { OrchestratorChannel } from "./policy-engine";

export interface ExperimentVariant {
  name: string;
  aiEnabled?: boolean;
  channelOrder?: OrchestratorChannel[];
}

export interface ExperimentConfig {
  enabled: boolean;
  variants: ExperimentVariant[];
  allocation: Record<string, number>;
}

export interface VariantSettings {
  variant: string;
  aiEnabled: boolean;
  channelOrder: OrchestratorChannel[] | null;
}

const DEFAULT_CHANNEL_ORDER: OrchestratorChannel[] = [
  "imessage",
  "sms",
  "mms",
  "voice",
  "voicemail",
  "whatsapp",
  "rvm"
];

export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}

export function assignVariant(
  contactId: string,
  experiment: ExperimentConfig
): string {
  if (!experiment.enabled || !experiment.variants.length) {
    return "control";
  }

  const bucket = simpleHash(contactId);

  // Normalize allocation: detect if allocations are fractional (0.5) vs percentage (50)
  // If total allocation is <= 1, it's fractional and needs to be scaled to 0-100
  const totalAlloc = Object.values(experiment.allocation).reduce((a, b) => a + b, 0);
  const scale = totalAlloc <= 1 ? 100 : 1;

  let cumulative = 0;
  for (const variant of experiment.variants) {
    const alloc = (experiment.allocation[variant.name] || 0) * scale;
    cumulative += alloc;
    if (bucket < cumulative) {
      return variant.name;
    }
  }

  return experiment.variants[0]?.name || "control";
}

export function getVariantSettings(
  experiment: ExperimentConfig,
  variantName: string,
  defaultAiEnabled: boolean
): VariantSettings {
  if (!experiment.enabled) {
    return {
      variant: "control",
      aiEnabled: defaultAiEnabled,
      channelOrder: null
    };
  }

  const variant = experiment.variants.find(v => v.name === variantName);
  if (!variant) {
    return {
      variant: variantName,
      aiEnabled: defaultAiEnabled,
      channelOrder: null
    };
  }

  return {
    variant: variantName,
    aiEnabled: variant.aiEnabled !== undefined ? variant.aiEnabled : defaultAiEnabled,
    channelOrder: variant.channelOrder || null
  };
}

export function parseExperimentConfig(policyJson: any): ExperimentConfig | null {
  if (!policyJson?.experiment?.enabled) {
    return null;
  }

  const exp = policyJson.experiment;
  if (!Array.isArray(exp.variants) || !exp.allocation) {
    return null;
  }

  return {
    enabled: true,
    variants: exp.variants,
    allocation: exp.allocation
  };
}

export async function getOrAssignContactVariant(
  contactId: string,
  campaignContactId: string,
  policyJson: any
): Promise<VariantSettings | null> {
  const experiment = parseExperimentConfig(policyJson);
  if (!experiment) {
    return null;
  }

  const [existing] = await db.select({ variant: campaignContacts.variant })
    .from(campaignContacts)
    .where(eq(campaignContacts.id, campaignContactId))
    .limit(1);

  let variantName = existing?.variant;

  if (!variantName) {
    variantName = assignVariant(contactId, experiment);
    
    await db.update(campaignContacts)
      .set({ variant: variantName, updatedAt: new Date() })
      .where(eq(campaignContacts.id, campaignContactId));
  }

  const defaultAiEnabled = process.env.ORCHESTRATOR_AI_ENABLED === "true";
  return getVariantSettings(experiment, variantName, defaultAiEnabled);
}

export async function assignVariantsToCampaignContacts(
  campaignId: string,
  policyJson: any
): Promise<number> {
  const experiment = parseExperimentConfig(policyJson);
  if (!experiment) {
    return 0;
  }

  const contacts = await db.select({
    id: campaignContacts.id,
    contactId: campaignContacts.contactId,
    variant: campaignContacts.variant
  })
    .from(campaignContacts)
    .where(eq(campaignContacts.campaignId, campaignId));

  let assigned = 0;
  for (const contact of contacts) {
    if (!contact.variant) {
      const variantName = assignVariant(contact.contactId, experiment);
      await db.update(campaignContacts)
        .set({ variant: variantName, updatedAt: new Date() })
        .where(eq(campaignContacts.id, contact.id));
      assigned++;
    }
  }

  return assigned;
}
