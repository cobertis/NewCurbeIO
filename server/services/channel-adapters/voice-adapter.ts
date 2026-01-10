/**
 * Voice/Voicemail Adapter for Campaign Orchestrator
 * Provides interface for placing calls and dropping voicemails
 * Supports Telnyx/Twilio backends or mock for testing
 */

export interface PlaceCallInput {
  to: string;
  from?: string;
  scriptId?: string;
  campaignContactId?: string;
  companyId: string;
  metadata?: Record<string, any>;
}

export interface PlaceCallResult {
  ok: boolean;
  providerCallId?: string;
  outcome?: "answered" | "no_answer" | "busy" | "failed" | "voicemail";
  error?: string;
}

export interface DropVoicemailInput {
  to: string;
  from?: string;
  recordingId?: string;
  recordingUrl?: string;
  textToSpeech?: string;
  companyId: string;
  metadata?: Record<string, any>;
}

export interface DropVoicemailResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface VoiceAdapter {
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  dropVoicemail(input: DropVoicemailInput): Promise<DropVoicemailResult>;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `***${phone.slice(-4)}`;
}

export class TelnyxVoiceAdapter implements VoiceAdapter {
  private apiKey: string;
  private connectionId?: string;

  constructor(apiKey?: string, connectionId?: string) {
    this.apiKey = apiKey || process.env.TELNYX_API_KEY || "";
    this.connectionId = connectionId || process.env.TELNYX_VOICE_CONNECTION_ID;
  }

  async placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
    const { to, from, companyId, metadata } = input;

    if (!this.apiKey) {
      return { ok: false, error: "TELNYX_API_KEY not configured" };
    }

    if (!to) {
      return { ok: false, error: "Missing 'to' number" };
    }

    try {
      const response = await fetch("https://api.telnyx.com/v2/calls", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connection_id: this.connectionId,
          to,
          from: from || process.env.TELNYX_VOICE_FROM_NUMBER,
          answering_machine_detection: "detect",
          client_state: Buffer.from(JSON.stringify({
            companyId,
            type: "campaign_voice",
            ...metadata
          })).toString("base64")
        })
      });

      const data = await response.json() as any;

      if (!response.ok) {
        console.log(`[VoiceAdapter] Call failed to ${maskPhone(to)}: ${data?.errors?.[0]?.detail || response.status}`);
        return {
          ok: false,
          error: data?.errors?.[0]?.detail || `HTTP ${response.status}`
        };
      }

      console.log(`[VoiceAdapter] Call placed to ${maskPhone(to)}, callId: ${data?.data?.call_control_id}`);

      return {
        ok: true,
        providerCallId: data?.data?.call_control_id || data?.data?.id,
        outcome: undefined
      };
    } catch (error: any) {
      console.error(`[VoiceAdapter] Network error to ${maskPhone(to)}: ${error.message}`);
      return {
        ok: false,
        error: error.message || "Network error"
      };
    }
  }

  async dropVoicemail(input: DropVoicemailInput): Promise<DropVoicemailResult> {
    const { to, from, recordingUrl, textToSpeech, companyId } = input;

    if (!this.apiKey) {
      return { ok: false, error: "TELNYX_API_KEY not configured" };
    }

    if (!to) {
      return { ok: false, error: "Missing 'to' number" };
    }

    if (!recordingUrl && !textToSpeech) {
      return { ok: false, error: "Either recordingUrl or textToSpeech required" };
    }

    try {
      const response = await fetch("https://api.telnyx.com/v2/calls", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          connection_id: this.connectionId,
          to,
          from: from || process.env.TELNYX_VOICE_FROM_NUMBER,
          answering_machine_detection: "detect_beep",
          client_state: Buffer.from(JSON.stringify({
            companyId,
            type: "campaign_voicemail",
            recordingUrl,
            textToSpeech
          })).toString("base64")
        })
      });

      const data = await response.json() as any;

      if (!response.ok) {
        console.log(`[VoiceAdapter] Voicemail drop failed to ${maskPhone(to)}: ${data?.errors?.[0]?.detail || response.status}`);
        return {
          ok: false,
          error: data?.errors?.[0]?.detail || `HTTP ${response.status}`
        };
      }

      console.log(`[VoiceAdapter] Voicemail drop initiated to ${maskPhone(to)}`);

      return {
        ok: true,
        providerId: data?.data?.call_control_id || data?.data?.id
      };
    } catch (error: any) {
      console.error(`[VoiceAdapter] Network error for voicemail to ${maskPhone(to)}: ${error.message}`);
      return {
        ok: false,
        error: error.message || "Network error"
      };
    }
  }
}

export type MockCallOutcome = "answered" | "no_answer" | "busy" | "failed" | "voicemail";

export class MockVoiceAdapter implements VoiceAdapter {
  public callLog: PlaceCallInput[] = [];
  public voicemailLog: DropVoicemailInput[] = [];
  public shouldFail: boolean = false;
  public failAfterAttempts: number = 0;
  public callOutcome: MockCallOutcome = "answered";
  private attemptCount: number = 0;

  async placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
    this.callLog.push(input);
    this.attemptCount++;

    if (this.shouldFail) {
      return { ok: false, error: "Mock voice adapter failure", outcome: "failed" };
    }

    if (this.failAfterAttempts > 0 && this.attemptCount <= this.failAfterAttempts) {
      return { ok: false, error: `Mock failure attempt ${this.attemptCount}`, outcome: "failed" };
    }

    const outcome = this.callOutcome;
    const validOutcomes = ["answered", "voicemail", "no_answer", "busy"];
    const ok = outcome !== undefined && validOutcomes.includes(outcome);

    return {
      ok: outcome === undefined ? true : ok,
      providerCallId: `mock-call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      outcome,
      error: (ok || outcome === undefined) ? undefined : `Call ${outcome}`
    };
  }

  async dropVoicemail(input: DropVoicemailInput): Promise<DropVoicemailResult> {
    this.voicemailLog.push(input);

    if (this.shouldFail) {
      return { ok: false, error: "Mock voicemail adapter failure" };
    }

    return {
      ok: true,
      providerId: `mock-vm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };
  }

  reset(): void {
    this.callLog = [];
    this.voicemailLog = [];
    this.shouldFail = false;
    this.failAfterAttempts = 0;
    this.callOutcome = "answered";
    this.attemptCount = 0;
  }

  setOutcome(outcome: MockCallOutcome): void {
    this.callOutcome = outcome;
  }
}

let defaultVoiceAdapter: VoiceAdapter = new TelnyxVoiceAdapter();

export function setDefaultVoiceAdapter(adapter: VoiceAdapter): void {
  defaultVoiceAdapter = adapter;
}

export function getDefaultVoiceAdapter(): VoiceAdapter {
  return defaultVoiceAdapter;
}
