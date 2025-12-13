import { db } from "../db";
import { pbxService } from "./pbx-service";
import {
  pbxSettings,
  pbxQueues,
  pbxMenuOptions,
  pbxExtensions,
  pbxAgentStatus,
  telnyxPhoneNumbers,
  telephonyCredentials,
  users,
  PbxRingStrategy,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";

// Track active queue ring attempts for ring-all strategy
interface QueueRingAttempt {
  originalCallControlId: string;
  companyId: string;
  queueId: string;
  agentCallControlIds: string[];
  answeredBy: string | null;
  status: "ringing" | "answered" | "failed";
}

const activeQueueRings = new Map<string, QueueRingAttempt>();

interface CallControlEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_session_id?: string;
      call_leg_id?: string;
      from: string;
      to: string;
      direction: "incoming" | "outgoing";
      state?: string;
      client_state?: string;
      digit?: string;
      hangup_cause?: string;
      hangup_source?: string;
      result?: string;
      recording_urls?: {
        wav?: string;
        mp3?: string;
      };
      sip_hangup_cause?: string;
    };
    record_type: "event";
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
}

export class CallControlWebhookService {
  async handleWebhook(event: CallControlEvent): Promise<void> {
    const { event_type, payload } = event.data;
    const { call_control_id, from, to } = payload;

    console.log(`[CallControl] Event: ${event_type}, CallControlId: ${call_control_id}`);

    switch (event_type) {
      case "call.initiated":
        await this.handleCallInitiated(payload);
        break;
      case "call.answered":
        await this.handleCallAnswered(payload);
        break;
      case "call.hangup":
        await this.handleCallHangup(payload);
        break;
      case "call.gather.ended":
        await this.handleGatherEnded(payload);
        break;
      case "call.playback.ended":
        await this.handlePlaybackEnded(payload);
        break;
      case "call.speak.ended":
        await this.handleSpeakEnded(payload);
        break;
      case "call.bridged":
        await this.handleCallBridged(payload);
        break;
      case "call.recording.saved":
        await this.handleRecordingSaved(payload);
        break;
      default:
        console.log(`[CallControl] Unhandled event type: ${event_type}`);
    }
  }

  private async handleCallInitiated(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    const { call_control_id, from, to, direction } = payload;

    if (direction !== "incoming") {
      console.log(`[CallControl] Ignoring outgoing call initiated event`);
      return;
    }

    const phoneNumber = await this.findPhoneNumberByE164(to);
    if (!phoneNumber) {
      console.log(`[CallControl] Phone number not found for: ${to}`);
      await this.hangupCall(call_control_id, "USER_NOT_FOUND");
      return;
    }

    await this.answerCall(call_control_id);

    const settings = await pbxService.getPbxSettings(phoneNumber.companyId);

    if (settings?.ivrEnabled) {
      await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "ivr");
      await this.playIvrGreeting(call_control_id, phoneNumber.companyId, settings);
    } else {
      await this.routeToDefaultAgent(call_control_id, phoneNumber);
    }
  }

  private async handleCallAnswered(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    const { call_control_id, client_state } = payload;

    if (client_state) {
      try {
        const state = JSON.parse(Buffer.from(client_state, "base64").toString());
        console.log(`[CallControl] Call answered with state:`, state);

        // Handle ring-all answer - bridge and cancel other rings
        if (state.ringAllAttempt && state.originalCallControlId) {
          await this.handleRingAllAnswer(
            call_control_id,
            state.originalCallControlId,
            state.agentUserId,
            state.companyId,
            state.queueId
          );
          return;
        }

        if (state.agentUserId) {
          await pbxService.updateAgentStatus(state.companyId, state.agentUserId, "busy", call_control_id);
        }
      } catch (e) {
        console.log(`[CallControl] Could not parse client_state`);
      }
    }
  }

  private async handleCallHangup(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    const { call_control_id, hangup_cause, client_state } = payload;
    console.log(`[CallControl] Call hangup, cause: ${hangup_cause}`);

    await pbxService.removeActiveCall(call_control_id);

    if (client_state) {
      try {
        const state = JSON.parse(Buffer.from(client_state, "base64").toString());
        if (state.agentUserId) {
          await pbxService.updateAgentStatus(state.companyId, state.agentUserId, "available");
        }
      } catch (e) {
        console.log(`[CallControl] Could not parse client_state on hangup`);
      }
    }
  }

  private async handleGatherEnded(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    const { call_control_id, digit, result, client_state } = payload;

    console.log(`[CallControl] DTMF gathered: ${digit}, result: ${result}`);

    if (!client_state) {
      console.log(`[CallControl] No client_state in gather.ended event`);
      return;
    }

    try {
      const state = JSON.parse(Buffer.from(client_state, "base64").toString());
      const { companyId, pbxSettingsId } = state;

      if (result === "timeout" || result === "cancelled") {
        await this.speakText(call_control_id, "Sorry, we didn't receive your selection. Goodbye.");
        await this.hangupCall(call_control_id, "NORMAL_CLEARING");
        return;
      }

      if (!digit) {
        console.log(`[CallControl] No digit pressed`);
        return;
      }

      const menuOptions = await pbxService.getMenuOptions(companyId, pbxSettingsId);
      const selectedOption = menuOptions.find((opt) => opt.digit === digit && opt.isActive);

      if (!selectedOption) {
        await this.speakText(call_control_id, `Invalid selection. Please try again.`);
        const settings = await pbxService.getPbxSettings(companyId);
        if (settings) {
          await this.playIvrGreeting(call_control_id, companyId, settings);
        }
        return;
      }

      await this.handleMenuOption(call_control_id, companyId, selectedOption);
    } catch (e) {
      console.error(`[CallControl] Error in handleGatherEnded:`, e);
    }
  }

  private async handlePlaybackEnded(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    console.log(`[CallControl] Playback ended for call: ${payload.call_control_id}`);
  }

  private async handleSpeakEnded(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    console.log(`[CallControl] Speak ended for call: ${payload.call_control_id}`);
  }

  private async handleCallBridged(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    console.log(`[CallControl] Call bridged: ${payload.call_control_id}`);
  }

  private async handleRecordingSaved(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    const { call_control_id, recording_urls } = payload;
    console.log(`[CallControl] Recording saved:`, recording_urls);
  }

  private async handleMenuOption(
    callControlId: string,
    companyId: string,
    option: any
  ): Promise<void> {
    switch (option.actionType) {
      case "queue":
        if (option.targetQueueId) {
          await this.routeToQueue(callControlId, companyId, option.targetQueueId);
        }
        break;
      case "extension":
        if (option.targetExtensionId) {
          await this.routeToExtension(callControlId, companyId, option.targetExtensionId);
        }
        break;
      case "external":
        if (option.targetExternalNumber) {
          await this.transferToExternal(callControlId, option.targetExternalNumber, companyId);
        }
        break;
      case "voicemail":
        await this.routeToVoicemail(callControlId, companyId);
        break;
      case "hangup":
        await this.hangupCall(callControlId, "NORMAL_CLEARING");
        break;
      default:
        console.log(`[CallControl] Unknown action type: ${option.actionType}`);
    }
  }

  private async routeToQueue(callControlId: string, companyId: string, queueId: string): Promise<void> {
    console.log(`[CallControl] Routing call to queue: ${queueId}`);

    const queue = await pbxService.getQueue(companyId, queueId);
    if (!queue) {
      await this.speakText(callControlId, "Sorry, this queue is unavailable. Please try again later.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    // Get queue members with their extensions
    const queueMembers = await pbxService.getQueueMembers(companyId, queueId);
    if (queueMembers.length === 0) {
      await this.speakText(callControlId, "No agents are configured for this queue. Please try again later.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    // Get SIP credentials for all queue members
    const memberUserIds = queueMembers.map(m => m.userId);
    const memberCredentials = await db
      .select()
      .from(telephonyCredentials)
      .where(and(
        eq(telephonyCredentials.companyId, companyId),
        inArray(telephonyCredentials.userId, memberUserIds)
      ));

    if (memberCredentials.length === 0) {
      await this.speakText(callControlId, "No agents are available. Please leave a message.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    // Build SIP URIs for all available agents
    const sipUris = memberCredentials.map(cred => `sip:${cred.sipUsername}@sip.telnyx.com`);
    const ringTimeout = queue.ringTimeout || 20;
    const ringStrategy = queue.ringStrategy as PbxRingStrategy || "ring_all";

    console.log(`[CallControl] Queue ring strategy: ${ringStrategy}, agents: ${sipUris.length}`);

    await this.speakText(callControlId, "Please hold while we connect you to an agent.");

    // Update call state to queue
    await pbxService.trackActiveCall(companyId, callControlId, "", "", "queue", {
      queueId,
      ringStrategy,
      agentCount: sipUris.length
    });

    if (ringStrategy === "ring_all" && sipUris.length > 1) {
      // Ring all agents simultaneously using dial with multiple destinations
      await this.ringAllAgents(callControlId, companyId, queueId, sipUris, memberCredentials, ringTimeout);
    } else {
      // For round_robin, least_recent, or single agent - dial first available
      const firstCred = memberCredentials[0];
      const firstUser = queueMembers.find(m => m.userId === firstCred.userId);
      
      const clientState = Buffer.from(JSON.stringify({
        companyId,
        queueId,
        agentUserId: firstCred.userId,
        ringStrategy
      })).toString("base64");

      await this.makeCallControlRequest(callControlId, "transfer", {
        to: `sip:${firstCred.sipUsername}@sip.telnyx.com`,
        client_state: clientState,
        timeout_secs: ringTimeout,
      });
    }
  }

  private async ringAllAgents(
    callControlId: string,
    companyId: string,
    queueId: string,
    sipUris: string[],
    credentials: any[],
    ringTimeout: number
  ): Promise<void> {
    console.log(`[CallControl] Ring-all: dialing ${sipUris.length} agents simultaneously`);

    // Track this ring attempt
    const ringAttempt: QueueRingAttempt = {
      originalCallControlId: callControlId,
      companyId,
      queueId,
      agentCallControlIds: [],
      answeredBy: null,
      status: "ringing"
    };
    activeQueueRings.set(callControlId, ringAttempt);

    // Get the company's outbound caller ID (main phone number)
    const [phoneNumber] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId));

    const fromNumber = phoneNumber?.phoneNumber || "";

    // Create outbound calls to all agents simultaneously
    for (const cred of credentials) {
      try {
        const clientState = Buffer.from(JSON.stringify({
          companyId,
          queueId,
          agentUserId: cred.userId,
          originalCallControlId: callControlId,
          ringAllAttempt: true
        })).toString("base64");

        const response = await fetch(`${TELNYX_API_BASE}/calls`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: `sip:${cred.sipUsername}@sip.telnyx.com`,
            from: fromNumber,
            connection_id: phoneNumber?.connectionId || "",
            timeout_secs: ringTimeout,
            client_state: clientState,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const agentCallControlId = data.data?.call_control_id;
          if (agentCallControlId) {
            ringAttempt.agentCallControlIds.push(agentCallControlId);
            console.log(`[CallControl] Ring-all: initiated call to agent ${cred.userId}`);
          }
        }
      } catch (error) {
        console.error(`[CallControl] Ring-all: failed to dial agent ${cred.userId}:`, error);
      }
    }

    // If no calls were initiated, fall back to transfer
    if (ringAttempt.agentCallControlIds.length === 0) {
      activeQueueRings.delete(callControlId);
      console.log(`[CallControl] Ring-all: no calls initiated, falling back to transfer`);
      
      const firstCred = credentials[0];
      const clientState = Buffer.from(JSON.stringify({
        companyId,
        queueId,
        agentUserId: firstCred.userId
      })).toString("base64");

      await this.makeCallControlRequest(callControlId, "transfer", {
        to: `sip:${firstCred.sipUsername}@sip.telnyx.com`,
        client_state: clientState,
        timeout_secs: ringTimeout,
      });
    }
  }

  private async handleRingAllAnswer(
    agentCallControlId: string,
    originalCallControlId: string,
    agentUserId: string,
    companyId: string,
    queueId: string
  ): Promise<void> {
    const ringAttempt = activeQueueRings.get(originalCallControlId);
    if (!ringAttempt || ringAttempt.status === "answered") {
      // Already answered by another agent, hangup this one
      await this.hangupCall(agentCallControlId, "NORMAL_CLEARING");
      return;
    }

    ringAttempt.status = "answered";
    ringAttempt.answeredBy = agentUserId;

    console.log(`[CallControl] Ring-all: agent ${agentUserId} answered, bridging calls`);

    // Hangup all other ringing agents
    for (const otherCallId of ringAttempt.agentCallControlIds) {
      if (otherCallId !== agentCallControlId) {
        try {
          await this.hangupCall(otherCallId, "NORMAL_CLEARING");
        } catch (e) {
          // Ignore errors for already disconnected calls
        }
      }
    }

    // Bridge the answered agent call with the original caller
    try {
      await this.makeCallControlRequest(originalCallControlId, "bridge", {
        call_control_id: agentCallControlId,
      });
      
      // Update agent status
      await pbxService.updateAgentStatus(companyId, agentUserId, "busy", agentCallControlId);
      
      // Update active call state
      await pbxService.trackActiveCall(companyId, originalCallControlId, "", "", "connected", {
        queueId,
        agentUserId
      });
    } catch (error) {
      console.error(`[CallControl] Ring-all: bridge failed:`, error);
    }

    // Clean up
    activeQueueRings.delete(originalCallControlId);
  }

  private async routeToExtension(
    callControlId: string,
    companyId: string,
    extensionId: string
  ): Promise<void> {
    console.log(`[CallControl] Routing call to extension: ${extensionId}`);

    const extensions = await pbxService.getExtensions(companyId);
    const extension = extensions.find((ext) => ext.id === extensionId);

    if (!extension) {
      await this.speakText(callControlId, "Extension not found. Please try again.");
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, extension.userId));
    if (!user) {
      await this.speakText(callControlId, "User not found for this extension.");
      return;
    }

    await this.dialSipUri(callControlId, companyId, user);
  }

  private async routeToVoicemail(callControlId: string, companyId: string): Promise<void> {
    console.log(`[CallControl] Routing to voicemail for company: ${companyId}`);

    const settings = await pbxService.getPbxSettings(companyId);
    if (settings?.voicemailGreetingUrl) {
      await this.playAudio(callControlId, settings.voicemailGreetingUrl);
    } else {
      await this.speakText(
        callControlId,
        "Please leave your message after the tone. Press pound when finished."
      );
    }

    const clientState = Buffer.from(
      JSON.stringify({ companyId, action: "voicemail" })
    ).toString("base64");

    await this.makeCallControlRequest(callControlId, "record_start", {
      format: "mp3",
      channels: "single",
      client_state: clientState,
      max_length: 180,
      timeout_secs: 5,
      play_beep: true,
    });
  }

  private async routeToDefaultAgent(
    callControlId: string,
    phoneNumber: any
  ): Promise<void> {
    if (!phoneNumber.ownerUserId) {
      await this.speakText(callControlId, "This number is not configured. Please try again later.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, phoneNumber.ownerUserId));

    if (!user) {
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    await this.dialSipUri(callControlId, phoneNumber.companyId, user);
  }

  private async dialSipUri(callControlId: string, companyId: string, user: any): Promise<void> {
    const [credential] = await db
      .select()
      .from(telephonyCredentials)
      .where(and(eq(telephonyCredentials.companyId, companyId), eq(telephonyCredentials.userId, user.id)));

    if (!credential) {
      console.log(`[CallControl] No SIP credential for user: ${user.id}`);
      await this.speakText(callControlId, "The agent is not available.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    const sipUri = `sip:${credential.sipUsername}@sip.telnyx.com`;
    const clientState = Buffer.from(
      JSON.stringify({ companyId, agentUserId: user.id })
    ).toString("base64");

    console.log(`[CallControl] Dialing SIP URI: ${sipUri}`);

    await this.makeCallControlRequest(callControlId, "transfer", {
      to: sipUri,
      client_state: clientState,
      timeout_secs: 30,
    });
  }

  private async transferToExternal(
    callControlId: string,
    phoneNumber: string,
    companyId: string
  ): Promise<void> {
    console.log(`[CallControl] Transferring to external number: ${phoneNumber}`);

    const clientState = Buffer.from(JSON.stringify({ companyId })).toString("base64");

    await this.makeCallControlRequest(callControlId, "transfer", {
      to: phoneNumber,
      client_state: clientState,
    });
  }

  private async playIvrGreeting(
    callControlId: string,
    companyId: string,
    settings: any
  ): Promise<void> {
    const clientState = Buffer.from(
      JSON.stringify({ companyId, pbxSettingsId: settings.id })
    ).toString("base64");

    if (settings.useTextToSpeech && settings.greetingText) {
      await this.speakText(callControlId, settings.greetingText);
      await this.gatherDtmf(callControlId, clientState, settings.ivrTimeout || 10);
    } else if (settings.greetingAudioUrl) {
      await this.playAudio(callControlId, settings.greetingAudioUrl);
      await this.gatherDtmf(callControlId, clientState, settings.ivrTimeout || 10);
    } else {
      await this.speakText(callControlId, "Welcome. Please enter your selection.");
      await this.gatherDtmf(callControlId, clientState, settings.ivrTimeout || 10);
    }
  }

  private async answerCall(callControlId: string): Promise<void> {
    await this.makeCallControlRequest(callControlId, "answer", {});
  }

  private async hangupCall(callControlId: string, cause: string): Promise<void> {
    await this.makeCallControlRequest(callControlId, "hangup", {
      hangup_cause: cause,
    });
  }

  private async speakText(callControlId: string, text: string): Promise<void> {
    await this.makeCallControlRequest(callControlId, "speak", {
      payload: text,
      voice: "female",
      language: "en-US",
    });
  }

  private async playAudio(callControlId: string, audioUrl: string): Promise<void> {
    await this.makeCallControlRequest(callControlId, "playback_start", {
      audio_url: audioUrl,
    });
  }

  private async gatherDtmf(
    callControlId: string,
    clientState: string,
    timeoutSecs: number
  ): Promise<void> {
    await this.makeCallControlRequest(callControlId, "gather", {
      minimum_digits: 1,
      maximum_digits: 1,
      timeout_millis: timeoutSecs * 1000,
      inter_digit_timeout_millis: 5000,
      valid_digits: "0123456789*#",
      client_state: clientState,
    });
  }

  private async findPhoneNumberByE164(phoneNumber: string): Promise<any> {
    const cleanNumber = phoneNumber.replace(/^\+/, "");
    const [result] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.phoneNumber, phoneNumber));

    if (result) return result;

    const [resultWithPlus] = await db
      .select()
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.phoneNumber, `+${cleanNumber}`));

    return resultWithPlus || null;
  }

  private async makeCallControlRequest(
    callControlId: string,
    action: string,
    payload: Record<string, any>
  ): Promise<any> {
    const url = `${TELNYX_API_BASE}/calls/${callControlId}/actions/${action}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CallControl] API error for ${action}:`, response.status, errorText);
        throw new Error(`Call Control API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[CallControl] ${action} success:`, data);
      return data;
    } catch (error) {
      console.error(`[CallControl] Request failed for ${action}:`, error);
      throw error;
    }
  }
}

export const callControlWebhookService = new CallControlWebhookService();
