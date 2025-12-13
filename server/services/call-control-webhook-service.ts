import { db } from "../db";
import { pbxService } from "./pbx-service";
import { extensionCallService } from "./extension-call-service";
import { getCompanyManagedAccountId } from "./telnyx-managed-accounts";
import { SecretsService } from "./secrets-service";
import {
  pbxSettings,
  pbxQueues,
  pbxMenuOptions,
  pbxExtensions,
  pbxAgentStatus,
  telnyxPhoneNumbers,
  telephonyCredentials,
  telephonySettings,
  users,
  PbxRingStrategy,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";
const secretsService = new SecretsService();

// Track call context for managed account routing
interface CallContext {
  companyId: string;
  managedAccountId: string | null;
}
const callContextMap = new Map<string, CallContext>();

async function getTelnyxApiKey(): Promise<string> {
  let apiKey = await secretsService.getCredential("telnyx", "api_key");
  if (!apiKey) {
    throw new Error("Telnyx API key not configured");
  }
  return apiKey.trim().replace(/[\r\n\t]/g, '');
}

export async function uploadAudioToTelnyxMedia(audioUrl: string, mediaName: string, companyId?: string): Promise<string | null> {
  try {
    const apiKey = await getTelnyxApiKey();
    console.log(`[TelnyxMedia] Uploading audio to Telnyx Media Storage: ${mediaName}, URL: ${audioUrl}`);
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    
    // Add managed account header if company has one
    if (companyId) {
      const managedAccountId = await getCompanyManagedAccountId(companyId);
      if (managedAccountId) {
        headers["X-Managed-Account-Id"] = managedAccountId;
        console.log(`[TelnyxMedia] Using managed account: ${managedAccountId}`);
      }
    }
    
    const response = await fetch("https://api.telnyx.com/v2/media", {
      method: "POST",
      headers,
      body: JSON.stringify({
        media_url: audioUrl,
        media_name: mediaName,
        ttl_secs: 31536000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[TelnyxMedia] Upload failed: ${error}`);
      return null;
    }

    const data = await response.json();
    console.log(`[TelnyxMedia] Upload successful: ${mediaName}`, data);
    return mediaName;
  } catch (error) {
    console.error(`[TelnyxMedia] Error uploading audio:`, error);
    return null;
  }
}

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
      digits?: string;
      hangup_cause?: string;
      hangup_source?: string;
      result?: string;
      status?: string;
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
    const { call_control_id, from, to, direction, client_state } = payload;

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

    // Store call context for managed account routing
    const managedAccountId = await getCompanyManagedAccountId(phoneNumber.companyId);
    callContextMap.set(call_control_id, {
      companyId: phoneNumber.companyId,
      managedAccountId
    });
    console.log(`[CallControl] Stored call context: companyId=${phoneNumber.companyId}, managedAccountId=${managedAccountId}`);

    await this.answerCall(call_control_id);

    // Check for internal call with specific target (IVR or Queue)
    if (client_state) {
      try {
        const state = JSON.parse(Buffer.from(client_state, "base64").toString());
        
        if (state.internalCall) {
          console.log(`[CallControl] Internal call detected, target: ${state.targetType}`);
          
          if (state.targetType === "queue" && state.queueId) {
            // Direct route to queue without IVR
            await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "queue");
            await this.routeToQueue(call_control_id, phoneNumber.companyId, state.queueId);
            return;
          }
          // For IVR targetType, continue to play IVR greeting below
        }
      } catch (e) {
        console.log(`[CallControl] Could not parse client_state in handleCallInitiated`);
      }
    }

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

        // Handle internal call (IVR or Queue) - user answered the call from company
        if (state.internalCall && state.companyId) {
          console.log(`[CallControl] Internal call answered, target: ${state.targetType}`);
          
          if (state.targetType === "queue" && state.queueId) {
            // Direct route to queue
            await pbxService.trackActiveCall(state.companyId, call_control_id, "", "", "queue");
            await this.routeToQueue(call_control_id, state.companyId, state.queueId);
          } else {
            // Play IVR greeting
            const settings = await pbxService.getPbxSettings(state.companyId);
            if (settings?.ivrEnabled) {
              await pbxService.trackActiveCall(state.companyId, call_control_id, "", "", "ivr");
              await this.playIvrGreeting(call_control_id, state.companyId, settings);
            } else {
              await this.speakText(call_control_id, "IVR is not enabled.");
              await this.hangupCall(call_control_id, "NORMAL_CLEARING");
            }
          }
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

    // End any queue call notifications for this call
    extensionCallService.endQueueCall(call_control_id, "caller_hangup");

    // Clean up call context
    callContextMap.delete(call_control_id);

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
    // Telnyx uses 'digits' (plural) and 'status' in gather.ended event
    const { call_control_id, digits, status, client_state } = payload;

    console.log(`[CallControl] DTMF gathered: ${digits}, status: ${status}`);

    if (!client_state) {
      console.log(`[CallControl] No client_state in gather.ended event`);
      return;
    }

    try {
      const state = JSON.parse(Buffer.from(client_state, "base64").toString());
      const { companyId, pbxSettingsId } = state;

      // Check for timeout, call_hangup, or cancelled status
      if (status === "timeout" || status === "cancelled" || status === "call_hangup") {
        await this.speakText(call_control_id, "Sorry, we didn't receive your selection. Goodbye.");
        await this.hangupCall(call_control_id, "NORMAL_CLEARING");
        return;
      }

      if (!digits) {
        console.log(`[CallControl] No digits received`);
        return;
      }

      // Take the first digit for menu selection
      const digit = digits.charAt(0);
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
    const { call_control_id, client_state } = payload;
    console.log(`[CallControl] Playback ended for call: ${call_control_id}`);

    // Check if we need to start DTMF gathering after playback
    if (client_state) {
      try {
        const state = JSON.parse(Buffer.from(client_state, "base64").toString());
        if (state.pendingGather) {
          console.log(`[CallControl] Starting DTMF gather after playback for company: ${state.companyId}`);
          const gatherClientState = Buffer.from(
            JSON.stringify({ companyId: state.companyId, pbxSettingsId: state.pbxSettingsId })
          ).toString("base64");
          await this.gatherDtmf(call_control_id, gatherClientState, state.ivrTimeout || 10);
        }
      } catch (e) {
        console.log(`[CallControl] Could not parse client_state in playback.ended`);
      }
    }
  }

  private async handleSpeakEnded(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    const { call_control_id, client_state } = payload;
    console.log(`[CallControl] Speak ended for call: ${call_control_id}`);

    // Check if we need to start DTMF gathering after speak
    if (client_state) {
      try {
        const state = JSON.parse(Buffer.from(client_state, "base64").toString());
        if (state.pendingGather) {
          console.log(`[CallControl] Starting DTMF gather after speak for company: ${state.companyId}`);
          const gatherClientState = Buffer.from(
            JSON.stringify({ companyId: state.companyId, pbxSettingsId: state.pbxSettingsId })
          ).toString("base64");
          await this.gatherDtmf(call_control_id, gatherClientState, state.ivrTimeout || 10);
        }
      } catch (e) {
        console.log(`[CallControl] Could not parse client_state in speak.ended`);
      }
    }
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
    console.log(`[CallControl] Routing call to queue: ${queueId} via WebSocket`);

    const queue = await pbxService.getQueue(companyId, queueId);
    if (!queue) {
      await this.speakText(callControlId, "Sorry, this queue is unavailable. Please try again later.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    const ringTimeout = queue.ringTimeout || 30;

    // Use extensionCallService to notify agents via WebSocket
    // This finds agents connected to /ws/pbx and sends them a notification
    const activeCall = await pbxService.getActiveCall(callControlId);
    const callerNumber = activeCall?.from || "Unknown";

    const result = extensionCallService.startQueueCall(
      callControlId,
      companyId,
      queueId,
      callerNumber,
      ringTimeout
    );

    if (!result.success || result.notifiedCount === 0) {
      console.log(`[CallControl] No agents available via WebSocket, routing to voicemail`);
      await this.speakText(callControlId, "All agents are currently unavailable. Please leave a message after the tone.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    console.log(`[CallControl] Notified ${result.notifiedCount} agents via WebSocket for queue call`);

    // Play hold message while waiting for agent to accept
    await this.speakText(callControlId, "Please hold while we connect you to an available agent.");

    // Update call state to queue
    await pbxService.trackActiveCall(companyId, callControlId, callerNumber, "", "queue", {
      queueId,
      queueCallId: result.queueCallId,
      notifiedAgents: result.notifiedCount
    });
  }

  /**
   * Handle when an agent accepts a queue call via WebSocket
   * This is called from the API route when agent clicks "Accept"
   */
  async handleAgentAcceptQueueCall(
    callControlId: string,
    extensionId: string,
    companyId: string
  ): Promise<{ success: boolean; error?: string }> {
    const queueCall = extensionCallService.getQueueCall(callControlId);
    if (!queueCall) {
      return { success: false, error: "Queue call not found" };
    }

    const acceptResult = extensionCallService.acceptQueueCall(callControlId, extensionId);
    if (!acceptResult.success) {
      return acceptResult;
    }

    const agent = extensionCallService.getClientByExtensionId(extensionId);
    console.log(`[CallControl] Agent ${agent?.extension || extensionId} accepted queue call ${callControlId}`);

    // Update call state to connected
    await pbxService.trackActiveCall(companyId, callControlId, queueCall.callerNumber, "", "connected", {
      queueId: queueCall.queueId,
      answeredByExtensionId: extensionId
    });

    // Notify the agent that they are now connected
    if (agent) {
      agent.ws.send(JSON.stringify({
        type: "queue_call_connected",
        callControlId,
        callerNumber: queueCall.callerNumber,
      }));
    }

    return { success: true };
  }

  /**
   * Handle when an agent rejects a queue call via WebSocket
   */
  async handleAgentRejectQueueCall(
    callControlId: string,
    extensionId: string,
    companyId: string
  ): Promise<{ success: boolean; routeToVoicemail: boolean }> {
    const result = extensionCallService.rejectQueueCall(callControlId, extensionId);
    
    if (result.remainingAgents === 0) {
      // All agents rejected, route to voicemail
      console.log(`[CallControl] All agents rejected queue call ${callControlId}, routing to voicemail`);
      extensionCallService.endQueueCall(callControlId, "all_rejected");
      await this.speakText(callControlId, "All agents are currently unavailable. Please leave a message after the tone.");
      await this.routeToVoicemail(callControlId, companyId);
      return { success: true, routeToVoicemail: true };
    }

    return { success: result.success, routeToVoicemail: false };
  }

  /**
   * Handle queue call timeout (called from extensionCallService)
   */
  async handleQueueCallTimeout(callControlId: string, companyId: string): Promise<void> {
    console.log(`[CallControl] Queue call ${callControlId} timed out, routing to voicemail`);
    await this.speakText(callControlId, "All agents are currently unavailable. Please leave a message after the tone.");
    await this.routeToVoicemail(callControlId, companyId);
  }

  private async routeToExtension(
    callControlId: string,
    companyId: string,
    extensionId: string
  ): Promise<void> {
    console.log(`[CallControl] Routing call to extension: ${extensionId} via WebSocket`);

    const extensions = await pbxService.getExtensions(companyId);
    const extension = extensions.find((ext) => ext.id === extensionId);

    if (!extension) {
      await this.speakText(callControlId, "Extension not found. Please try again.");
      return;
    }

    // Check if the agent is connected via WebSocket
    const agent = extensionCallService.getClientByExtensionId(extensionId);
    if (!agent) {
      await this.speakText(callControlId, "The extension is currently offline. Please leave a message.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    const activeCall = await pbxService.getActiveCall(callControlId);
    const callerNumber = activeCall?.from || "Unknown";

    // Create a queue call for this single extension
    const result = extensionCallService.startQueueCall(
      callControlId,
      companyId,
      "direct-extension",
      callerNumber,
      30 // 30 second timeout
    );

    if (!result.success) {
      await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    await this.speakText(callControlId, "Please hold while we connect you.");
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
    console.log(`[CallControl] Routing to default agent via WebSocket`);

    if (!phoneNumber.ownerUserId) {
      await this.speakText(callControlId, "This number is not configured. Please try again later.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    const companyId = phoneNumber.companyId;
    const activeCall = await pbxService.getActiveCall(callControlId);
    const callerNumber = activeCall?.from || "Unknown";

    // Use WebSocket to notify available agents
    const result = extensionCallService.startQueueCall(
      callControlId,
      companyId,
      "default-agent",
      callerNumber,
      30
    );

    if (!result.success || result.notifiedCount === 0) {
      await this.speakText(callControlId, "No agents are available. Please leave a message.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    await this.speakText(callControlId, "Please hold while we connect you to an agent.");
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
    // Create client_state with flag to start gather after playback ends
    const clientState = Buffer.from(
      JSON.stringify({ 
        companyId, 
        pbxSettingsId: settings.id,
        pendingGather: true,
        ivrTimeout: settings.ivrTimeout || 10
      })
    ).toString("base64");

    if (settings.useTextToSpeech && settings.greetingText) {
      // For TTS, use speak with client_state - gather will start on speak.ended
      await this.speakTextWithState(callControlId, settings.greetingText, clientState);
    } else if (settings.greetingMediaName) {
      // Use Telnyx Media Storage for instant playback (no 5s delay)
      console.log(`[CallControl] Using Telnyx Media Storage: ${settings.greetingMediaName}`);
      await this.playMediaWithState(callControlId, settings.greetingMediaName, clientState);
    } else if (settings.greetingAudioUrl) {
      // Fallback to audio URL (has 5s delay for first playback)
      await this.playAudioWithState(callControlId, settings.greetingAudioUrl, clientState);
    } else {
      await this.speakTextWithState(callControlId, "Welcome. Please enter your selection.", clientState);
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

  private async speakTextWithState(callControlId: string, text: string, clientState: string): Promise<void> {
    await this.makeCallControlRequest(callControlId, "speak", {
      payload: text,
      voice: "female",
      language: "en-US",
      client_state: clientState,
    });
  }

  private async playAudio(callControlId: string, audioUrl: string): Promise<void> {
    // Convert relative URLs to absolute URLs for Telnyx
    let absoluteUrl = audioUrl;
    if (audioUrl.startsWith('/')) {
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
      if (domain) {
        absoluteUrl = `https://${domain}${audioUrl}`;
        console.log(`[CallControl] Converting relative audio URL to absolute: ${absoluteUrl}`);
      }
    }
    
    await this.makeCallControlRequest(callControlId, "playback_start", {
      audio_url: absoluteUrl,
    });
  }

  private async playAudioWithState(callControlId: string, audioUrl: string, clientState: string): Promise<void> {
    // Convert relative URLs to absolute URLs for Telnyx
    let absoluteUrl = audioUrl;
    if (audioUrl.startsWith('/')) {
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
      if (domain) {
        absoluteUrl = `https://${domain}${audioUrl}`;
        console.log(`[CallControl] Converting relative audio URL to absolute: ${absoluteUrl}`);
      }
    }
    
    await this.makeCallControlRequest(callControlId, "playback_start", {
      audio_url: absoluteUrl,
      client_state: clientState,
    });
  }

  private async playMediaWithState(callControlId: string, mediaName: string, clientState: string): Promise<void> {
    // Use Telnyx Media Storage for instant playback
    console.log(`[CallControl] Playing from Telnyx Media Storage: ${mediaName}`);
    await this.makeCallControlRequest(callControlId, "playback_start", {
      media_name: mediaName,
      client_state: clientState,
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
      const apiKey = await getTelnyxApiKey();
      
      // Get managed account from call context
      const context = callContextMap.get(callControlId);
      const managedAccountId = context?.managedAccountId;
      
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      
      // CRITICAL: Include managed account header for multi-tenant routing
      if (managedAccountId) {
        headers["X-Managed-Account-Id"] = managedAccountId;
        console.log(`[CallControl] API call with managed account: ${managedAccountId}`);
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
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
