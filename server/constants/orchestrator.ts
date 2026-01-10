/**
 * Campaign Orchestrator Constants
 * Shared definitions used across policy-engine, campaign-events, and other orchestrator services.
 */

/**
 * Event types that count as "attempts" for caps/limits.
 * Used by:
 * - Policy Engine: 24h caps, total caps
 * - Event Emitter: attemptsTotal increment, lastAttemptAt update
 */
export const ATTEMPT_EVENT_TYPES = [
  "MESSAGE_SENT",
  "CALL_PLACED",
  "VOICEMAIL_DROPPED",
  "RVM_DROPPED"
] as const;

export type AttemptEventType = typeof ATTEMPT_EVENT_TYPES[number];
