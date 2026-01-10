import { AiOpenAIService } from "./ai-openai-service";
import { format } from "date-fns";

export interface DecideNextActionInput {
  companyId: string;
  campaignId: string;
  campaignContactId: string;
  contactId: string;
  campaignName?: string;
  campaignGoal?: string;
  policy: Record<string, any>;
  allowedActions: Array<{ channel: string; allowed: boolean; reasons?: string[] }>;
  history: Array<{ eventType: string; channel?: string; createdAt: string; payload?: any }>;
  lastOutbound?: { channel: string; at: string } | null;
  fatigueScore: number;
  locale?: "en" | "es";
}

export interface DecideNextActionOutput {
  channel: string;
  prefer?: "auto" | "imessage" | "sms";
  messageTemplateId?: string;
  messageBody?: string;
  waitSeconds: number;
  explanation: string;
  confidence: number;
}

const MIN_WAIT_SECONDS = 300;
const MAX_WAIT_SECONDS = 172800;

function buildSystemPrompt(input: DecideNextActionInput): string {
  const allowedChannels = input.allowedActions
    .filter(a => a.allowed)
    .map(a => a.channel);

  return `You are an AI campaign orchestrator deciding the next action for a contact outreach campaign.

CAMPAIGN: ${input.campaignName || "Outreach Campaign"}
GOAL: ${input.campaignGoal || "Contact engagement"}
LOCALE: ${input.locale || "en"}

ALLOWED CHANNELS (you MUST choose from these only):
${allowedChannels.map(c => `- ${c}`).join("\n")}

FATIGUE SCORE: ${input.fatigueScore} (higher = more fatigued, be more cautious)

RULES:
1. channel MUST be one of the allowed channels listed above
2. waitSeconds must be between ${MIN_WAIT_SECONDS} and ${MAX_WAIT_SECONDS} seconds
3. Do not spam - respect fatigue and history
4. If history shows OPT_OUT or COMPLAINT, recommend stopping (null channel)
5. Consider time of day and channel effectiveness

Respond with ONLY valid JSON matching this exact schema:
{
  "channel": "string (from allowed channels)",
  "prefer": "auto" | "imessage" | "sms" (optional, for bridge routing),
  "messageTemplateId": "string (optional)",
  "messageBody": "string (optional brief message suggestion)",
  "waitSeconds": number (${MIN_WAIT_SECONDS}-${MAX_WAIT_SECONDS}),
  "explanation": "string (brief reason for decision)",
  "confidence": number (0-1)
}`;
}

function buildUserPrompt(input: DecideNextActionInput): string {
  const recentHistory = input.history.slice(0, 10);
  const historyText = recentHistory.length > 0
    ? recentHistory.map(e => `- ${e.eventType}${e.channel ? ` (${e.channel})` : ""} at ${e.createdAt}`).join("\n")
    : "No previous events";

  return `CONTACT HISTORY (last 10 events):
${historyText}

LAST OUTBOUND: ${input.lastOutbound ? `${input.lastOutbound.channel} at ${input.lastOutbound.at}` : "None"}

What should be the next action for this contact?`;
}

function validateOutput(
  output: any,
  allowedChannels: string[]
): { valid: boolean; reason?: string } {
  if (!output || typeof output !== "object") {
    return { valid: false, reason: "Output is not an object" };
  }

  if (!output.channel || typeof output.channel !== "string") {
    return { valid: false, reason: "Missing or invalid channel" };
  }

  if (!allowedChannels.includes(output.channel)) {
    return { valid: false, reason: `Channel '${output.channel}' not in allowed list: ${allowedChannels.join(", ")}` };
  }

  if (typeof output.waitSeconds !== "number") {
    return { valid: false, reason: "waitSeconds is not a number" };
  }

  if (output.waitSeconds < MIN_WAIT_SECONDS || output.waitSeconds > MAX_WAIT_SECONDS) {
    return { valid: false, reason: `waitSeconds ${output.waitSeconds} out of range (${MIN_WAIT_SECONDS}-${MAX_WAIT_SECONDS})` };
  }

  if (typeof output.confidence !== "number" || output.confidence < 0 || output.confidence > 1) {
    return { valid: false, reason: "confidence must be a number between 0 and 1" };
  }

  return { valid: true };
}

export async function decideNextAction(
  input: DecideNextActionInput
): Promise<{ decision: DecideNextActionOutput | null; error?: string; fallbackUsed?: boolean }> {
  const allowedChannels = input.allowedActions
    .filter(a => a.allowed)
    .map(a => a.channel);

  if (allowedChannels.length === 0) {
    return { decision: null, error: "No allowed channels available" };
  }

  const hasOptOut = input.history.some(e => 
    e.eventType === "OPT_OUT" || 
    e.eventType === "COMPLAINT" ||
    e.eventType === "MESSAGE_STOP"
  );

  if (hasOptOut) {
    return { decision: null, error: "Contact has opted out or complained" };
  }

  try {
    const aiService = new AiOpenAIService();
    const systemPrompt = buildSystemPrompt(input);
    const userPrompt = buildUserPrompt(input);

    const result = await aiService.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      {
        temperature: 0.3,
        maxTokens: 500,
        model: "gpt-4o-mini"
      }
    );

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { decision: null, error: "AI did not return valid JSON", fallbackUsed: true };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      return { decision: null, error: "Failed to parse AI JSON response", fallbackUsed: true };
    }

    const validation = validateOutput(parsed, allowedChannels);
    if (!validation.valid) {
      return { decision: null, error: `Invalid AI output: ${validation.reason}`, fallbackUsed: true };
    }

    const decision: DecideNextActionOutput = {
      channel: parsed.channel,
      prefer: parsed.prefer,
      messageTemplateId: parsed.messageTemplateId,
      messageBody: parsed.messageBody,
      waitSeconds: Math.max(MIN_WAIT_SECONDS, Math.min(MAX_WAIT_SECONDS, parsed.waitSeconds)),
      explanation: parsed.explanation || "AI decision",
      confidence: Math.max(0, Math.min(1, parsed.confidence))
    };

    return { decision, fallbackUsed: false };

  } catch (error: any) {
    console.error("[AI NextAction] Error calling AI:", error.message);
    return { decision: null, error: error.message || "AI call failed", fallbackUsed: true };
  }
}

export function generateDecisionExternalId(campaignContactId: string): string {
  const minuteKey = format(new Date(), "yyyyMMddHHmm");
  return `decision:${campaignContactId}:${minuteKey}`;
}
