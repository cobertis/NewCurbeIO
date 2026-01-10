/**
 * Bridge Adapter for iMessage/SMS
 * Sends messages via the bridge endpoint (POST /send with X-API-Key)
 */

export type BridgePreference = "imessage" | "sms" | "auto";

export interface BridgeSendInput {
  to: string;
  body: string;
  prefer: BridgePreference;
}

export interface BridgeSendResult {
  ok: boolean;
  providerId?: string;
  channel?: "imessage" | "sms";
  error?: string;
}

export interface BridgeAdapter {
  send(input: BridgeSendInput): Promise<BridgeSendResult>;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `***${phone.slice(-4)}`;
}

export class RealBridgeAdapter implements BridgeAdapter {
  private bridgeUrl: string;
  private apiKey: string;

  constructor(bridgeUrl?: string, apiKey?: string) {
    this.bridgeUrl = bridgeUrl || process.env.BRIDGE_URL || "";
    this.apiKey = apiKey || process.env.BRIDGE_API_KEY || "";
  }

  async send(input: BridgeSendInput): Promise<BridgeSendResult> {
    const { to, body, prefer } = input;

    if (!this.bridgeUrl) {
      return { ok: false, error: "BRIDGE_URL not configured" };
    }

    if (!this.apiKey) {
      return { ok: false, error: "BRIDGE_API_KEY not configured" };
    }

    if (!to || !body) {
      return { ok: false, error: "Missing 'to' or 'body' in payload" };
    }

    try {
      const response = await fetch(`${this.bridgeUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey
        },
        body: JSON.stringify({
          to,
          body,
          prefer: prefer || "auto"
        })
      });

      const data = await response.json() as Record<string, any>;

      if (!response.ok) {
        console.log(`[Bridge] Send failed to ${maskPhone(to)}: ${data.error || response.status}`);
        return {
          ok: false,
          error: data.error || `HTTP ${response.status}`
        };
      }

      console.log(`[Bridge] Sent to ${maskPhone(to)} via ${data.channel || prefer}`);

      return {
        ok: true,
        providerId: data.messageId || data.id || data.providerId,
        channel: data.channel || (prefer === "auto" ? "sms" : prefer)
      };
    } catch (error: any) {
      console.error(`[Bridge] Network error to ${maskPhone(to)}: ${error.message}`);
      return {
        ok: false,
        error: error.message || "Network error"
      };
    }
  }
}

export class MockBridgeAdapter implements BridgeAdapter {
  public calls: BridgeSendInput[] = [];
  public shouldFail: boolean = false;
  public failAfterAttempts: number = 0;
  private attemptCount: number = 0;

  async send(input: BridgeSendInput): Promise<BridgeSendResult> {
    this.calls.push(input);
    this.attemptCount++;

    if (this.shouldFail) {
      return { ok: false, error: "Mock bridge failure" };
    }

    if (this.failAfterAttempts > 0 && this.attemptCount <= this.failAfterAttempts) {
      return { ok: false, error: `Mock failure attempt ${this.attemptCount}` };
    }

    const channel = input.prefer === "auto" ? "imessage" : input.prefer;
    return {
      ok: true,
      providerId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channel: channel as "imessage" | "sms"
    };
  }

  reset(): void {
    this.calls = [];
    this.shouldFail = false;
    this.failAfterAttempts = 0;
    this.attemptCount = 0;
  }
}

let defaultAdapter: BridgeAdapter = new RealBridgeAdapter();

export function setDefaultAdapter(adapter: BridgeAdapter): void {
  defaultAdapter = adapter;
}

export function getDefaultAdapter(): BridgeAdapter {
  return defaultAdapter;
}

export async function sendViaBridge(input: BridgeSendInput): Promise<BridgeSendResult> {
  return defaultAdapter.send(input);
}
