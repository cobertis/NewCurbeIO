import { db } from "../db";
import { pbxService } from "./pbx-service";
import { extensionCallService } from "./extension-call-service";
import { getCompanyManagedAccountId } from "./telnyx-managed-accounts";
import { SecretsService } from "./secrets-service";
import { getUserSipCredentials } from "./telnyx-e911-service";
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
  pbxIvrs,
  PbxIvr,
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
    let managedAccountId: string | null = null;
    if (companyId) {
      managedAccountId = await getCompanyManagedAccountId(companyId);
      if (managedAccountId) {
        headers["X-Managed-Account-Id"] = managedAccountId;
        console.log(`[TelnyxMedia] Using managed account: ${managedAccountId}`);
      }
    }
    
    // First, try to delete existing media with the same name
    try {
      const deleteResponse = await fetch(`https://api.telnyx.com/v2/media/${encodeURIComponent(mediaName)}`, {
        method: "DELETE",
        headers
      });
      if (deleteResponse.ok) {
        console.log(`[TelnyxMedia] Deleted existing media: ${mediaName}`);
      }
    } catch (deleteError) {
      // Ignore delete errors - media may not exist
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

    // Check if phone number has a specific IVR assigned (multi-IVR support)
    if (phoneNumber.ivrId) {
      const ivr = await pbxService.getIvr(phoneNumber.companyId, phoneNumber.ivrId);
      if (ivr && ivr.isActive) {
        console.log(`[CallControl] Phone number has specific IVR: ${ivr.name} (${ivr.id})`);
        await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "ivr");
        await this.playIvrGreetingForIvr(call_control_id, phoneNumber.companyId, ivr);
        return;
      }
    }

    // Check if company has a default IVR (multi-IVR support)
    const defaultIvr = await pbxService.getDefaultIvr(phoneNumber.companyId);
    if (defaultIvr && defaultIvr.isActive) {
      console.log(`[CallControl] Using company default IVR: ${defaultIvr.name} (${defaultIvr.id})`);
      await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "ivr");
      await this.playIvrGreetingForIvr(call_control_id, phoneNumber.companyId, defaultIvr);
      return;
    }

    // Fallback to legacy PBX settings IVR
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
      const { companyId, pbxSettingsId, ivrId } = state;

      // Handle call hangup - caller disconnected
      if (status === "call_hangup") {
        console.log(`[CallControl] Caller hung up during IVR`);
        return;
      }

      // Handle timeout or no digits - replay the IVR greeting
      if (status === "timeout" || status === "cancelled" || !digits) {
        console.log(`[CallControl] No selection received, replaying IVR greeting`);
        // Multi-IVR: replay the specific IVR greeting
        if (ivrId) {
          const ivr = await pbxService.getIvr(companyId, ivrId);
          if (ivr) {
            await this.playIvrGreetingForIvr(call_control_id, companyId, ivr);
            return;
          }
        }
        // Fallback to legacy pbxSettings
        const settings = await pbxService.getPbxSettings(companyId);
        if (settings) {
          await this.playIvrGreeting(call_control_id, companyId, settings);
        }
        return;
      }

      // Take the first digit for menu selection
      const digit = digits.charAt(0);
      
      // Multi-IVR: get menu options from specific IVR
      let menuOptions;
      if (ivrId) {
        menuOptions = await pbxService.getIvrMenuOptions(companyId, ivrId);
      } else if (pbxSettingsId) {
        menuOptions = await pbxService.getMenuOptions(companyId, pbxSettingsId);
      } else {
        console.log(`[CallControl] No ivrId or pbxSettingsId in state`);
        return;
      }
      
      const selectedOption = menuOptions.find((opt) => opt.digit === digit && opt.isActive);

      if (!selectedOption) {
        await this.speakText(call_control_id, `Invalid selection. Please try again.`);
        // Replay appropriate IVR greeting
        if (ivrId) {
          const ivr = await pbxService.getIvr(companyId, ivrId);
          if (ivr) {
            await this.playIvrGreetingForIvr(call_control_id, companyId, ivr);
            return;
          }
        }
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
          // Include ivrId in gather state for multi-IVR support
          const gatherClientState = Buffer.from(
            JSON.stringify({ 
              companyId: state.companyId, 
              pbxSettingsId: state.pbxSettingsId,
              ivrId: state.ivrId 
            })
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
          // Include ivrId in gather state for multi-IVR support
          const gatherClientState = Buffer.from(
            JSON.stringify({ 
              companyId: state.companyId, 
              pbxSettingsId: state.pbxSettingsId,
              ivrId: state.ivrId 
            })
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
      case "ivr":
        // Route to another IVR (multi-IVR support)
        if (option.targetIvrId) {
          const targetIvr = await pbxService.getIvr(companyId, option.targetIvrId);
          if (targetIvr && targetIvr.isActive) {
            console.log(`[CallControl] Routing to IVR: ${targetIvr.name} (${targetIvr.id})`);
            await this.playIvrGreetingForIvr(callControlId, companyId, targetIvr);
          } else {
            await this.speakText(callControlId, "The requested menu is unavailable.");
          }
        }
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
   * Dials the agent's personal SIP URI and bridges the call
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

    // Get the agent's userId from the extension
    const [extension] = await db
      .select({ userId: pbxExtensions.userId })
      .from(pbxExtensions)
      .where(eq(pbxExtensions.id, extensionId));

    if (!extension?.userId) {
      console.error(`[CallControl] No userId found for extension ${extensionId}`);
      return { success: false, error: "Extension has no assigned user" };
    }

    // Get the agent's personal SIP credentials
    const sipCreds = await getUserSipCredentials(extension.userId);
    
    if (sipCreds?.sipUsername) {
      // Dial the agent's personal SIP URI
      const sipUri = `sip:${sipCreds.sipUsername}@sip.telnyx.com`;
      console.log(`[CallControl] Dialing agent's SIP URI: ${sipUri}`);

      try {
        // Create client state for the bridged call
        const clientState = Buffer.from(JSON.stringify({
          companyId,
          agentUserId: extension.userId,
          extensionId,
          queueId: queueCall.queueId,
          originalCallControlId: callControlId,
        })).toString("base64");

        // Dial the agent's SIP endpoint and bridge the call
        await this.dialAndBridgeToSip(callControlId, sipUri, clientState, companyId);

        // Update call state to connected
        await pbxService.trackActiveCall(companyId, callControlId, queueCall.callerNumber, sipUri, "connected", {
          queueId: queueCall.queueId,
          answeredByExtensionId: extensionId,
          agentSipUri: sipUri
        });

        // Notify the agent that they are now connected
        if (agent) {
          agent.ws.send(JSON.stringify({
            type: "queue_call_connected",
            callControlId,
            callerNumber: queueCall.callerNumber,
            sipUri,
          }));
        }

        return { success: true };
      } catch (error) {
        console.error(`[CallControl] Failed to dial agent SIP:`, error);
        return { success: false, error: "Failed to connect to agent" };
      }
    } else {
      // No personal SIP credentials - notify via WebSocket only (fallback)
      console.log(`[CallControl] Agent has no personal SIP credentials, using WebSocket notification only`);
      
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
  }

  /**
   * Create outbound call to SIP URI and bridge it to existing call
   * Uses POST /calls to create new leg, then bridges both calls
   */
  private async dialAndBridgeToSip(
    callControlId: string,
    sipUri: string,
    clientState: string,
    companyId: string
  ): Promise<void> {
    console.log(`[CallControl] Creating outbound call to SIP: ${sipUri} for bridging with ${callControlId}`);

    const apiKey = await getTelnyxApiKey();
    const context = callContextMap.get(callControlId);
    const managedAccountId = context?.managedAccountId;

    // Get company's caller ID and connection
    const [phoneNumber] = await db
      .select({ 
        phoneNumber: telnyxPhoneNumbers.phoneNumber,
        connectionId: telnyxPhoneNumbers.connectionId 
      })
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId))
      .limit(1);

    const callerIdNumber = phoneNumber?.phoneNumber || "+15555555555";

    // Get credential connection for the company
    const [settings] = await db
      .select({ credentialConnectionId: telephonySettings.credentialConnectionId })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    const connectionId = settings?.credentialConnectionId || phoneNumber?.connectionId;

    if (!connectionId) {
      throw new Error("No connection ID found for company");
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (managedAccountId) {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }

    // Create outbound call to the agent's SIP endpoint
    const response = await fetch(`${TELNYX_API_BASE}/calls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        connection_id: connectionId,
        to: sipUri,
        from: callerIdNumber,
        timeout_secs: 30,
        answering_machine_detection: "disabled",
        client_state: clientState,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CallControl] Failed to create outbound call: ${response.status} - ${errorText}`);
      throw new Error(`Failed to dial agent: ${response.status}`);
    }

    const data = await response.json();
    const agentCallControlId = data.data?.call_control_id;

    if (!agentCallControlId) {
      throw new Error("No call_control_id returned from dial");
    }

    console.log(`[CallControl] Created outbound call to agent: ${agentCallControlId}`);

    // Store context for the new call leg
    callContextMap.set(agentCallControlId, { companyId, managedAccountId });

    // Bridge the original caller's call with the agent's call
    // Wait a moment for the call to be established before bridging
    setTimeout(async () => {
      try {
        await this.makeCallControlRequest(callControlId, "bridge", {
          call_control_id: agentCallControlId,
          client_state: clientState,
        });
        console.log(`[CallControl] Bridged caller ${callControlId} with agent ${agentCallControlId}`);
      } catch (bridgeError) {
        console.error(`[CallControl] Failed to bridge calls:`, bridgeError);
        // Hangup agent call if bridge fails
        try {
          await this.makeCallControlRequest(agentCallControlId, "hangup", { hangup_cause: "NORMAL_CLEARING" });
        } catch (e) { /* ignore */ }
      }
    }, 500);
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
    const clientState = Buffer.from(
      JSON.stringify({ 
        companyId, 
        pbxSettingsId: settings.id
      })
    ).toString("base64");

    const timeoutMs = (settings.ivrTimeout || 10) * 1000;

    if (settings.useTextToSpeech && settings.greetingText) {
      // For TTS, use gather with speak - allows DTMF during speech
      await this.gatherWithSpeak(callControlId, settings.greetingText, clientState, timeoutMs);
    } else if (settings.greetingMediaName) {
      // Use gather with media_name for instant playback + DTMF during audio
      console.log(`[CallControl] Using gather with Telnyx Media Storage: ${settings.greetingMediaName}`);
      await this.gatherWithMedia(callControlId, settings.greetingMediaName, clientState, timeoutMs);
    } else if (settings.greetingAudioUrl) {
      // Use gather with audio_url - allows DTMF during audio
      await this.gatherWithAudio(callControlId, settings.greetingAudioUrl, clientState, timeoutMs);
    } else {
      await this.gatherWithSpeak(callControlId, "Welcome. Please enter your selection.", clientState, timeoutMs);
    }
  }

  /**
   * Play IVR greeting for a specific IVR (multi-IVR support)
   * Uses the IVR object instead of legacy pbxSettings
   */
  private async playIvrGreetingForIvr(
    callControlId: string,
    companyId: string,
    ivr: PbxIvr
  ): Promise<void> {
    const clientState = Buffer.from(
      JSON.stringify({ 
        companyId, 
        ivrId: ivr.id
      })
    ).toString("base64");

    const timeoutMs = (ivr.ivrTimeout || 10) * 1000;

    console.log(`[CallControl] Playing IVR greeting for: ${ivr.name} (${ivr.id}), language: ${ivr.language || 'en-US'}`);

    if (ivr.useTextToSpeech && ivr.greetingText) {
      // For TTS, use gather with speak - allows DTMF during speech
      await this.gatherWithSpeakLanguage(callControlId, ivr.greetingText, clientState, timeoutMs, ivr.language || "en-US");
    } else if (ivr.greetingMediaName) {
      // Use gather with media_name for instant playback + DTMF during audio
      console.log(`[CallControl] Using gather with Telnyx Media Storage: ${ivr.greetingMediaName}`);
      await this.gatherWithMedia(callControlId, ivr.greetingMediaName, clientState, timeoutMs);
    } else if (ivr.greetingAudioUrl) {
      // Use gather with audio_url - allows DTMF during audio
      await this.gatherWithAudio(callControlId, ivr.greetingAudioUrl, clientState, timeoutMs);
    } else {
      // Default greeting based on language
      const defaultGreeting = ivr.language === "es-ES" || ivr.language === "es-MX" 
        ? "Bienvenido. Por favor ingrese su selección."
        : "Welcome. Please enter your selection.";
      await this.gatherWithSpeakLanguage(callControlId, defaultGreeting, clientState, timeoutMs, ivr.language || "en-US");
    }
  }

  /**
   * Gather DTMF with TTS in a specific language
   */
  private async gatherWithSpeakLanguage(
    callControlId: string,
    text: string,
    clientState: string,
    timeoutMs: number,
    language: string
  ): Promise<void> {
    await this.makeCallControlRequest(callControlId, "gather_using_speak", {
      payload: text,
      voice: "female",
      language: language,
      minimum_digits: 1,
      maximum_digits: 1,
      timeout_millis: timeoutMs,
      inter_digit_timeout_millis: 5000,
      valid_digits: "0123456789*#",
      client_state: clientState,
    });
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

  private async gatherWithSpeak(
    callControlId: string,
    text: string,
    clientState: string,
    timeoutMs: number
  ): Promise<void> {
    // Gather DTMF while speaking text - allows user to press digits during TTS
    await this.makeCallControlRequest(callControlId, "gather_using_speak", {
      payload: text,
      voice: "female",
      language: "en-US",
      minimum_digits: 1,
      maximum_digits: 1,
      timeout_millis: timeoutMs,
      inter_digit_timeout_millis: 5000,
      valid_digits: "0123456789*#",
      client_state: clientState,
    });
  }

  private async gatherWithAudio(
    callControlId: string,
    audioUrl: string,
    clientState: string,
    timeoutMs: number
  ): Promise<void> {
    // Convert relative URLs to absolute URLs for Telnyx
    let absoluteUrl = audioUrl;
    if (audioUrl.startsWith('/')) {
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
      if (domain) {
        absoluteUrl = `https://${domain}${audioUrl}`;
        console.log(`[CallControl] Converting relative audio URL to absolute: ${absoluteUrl}`);
      }
    }

    // Gather DTMF while playing audio - allows user to press digits during playback
    await this.makeCallControlRequest(callControlId, "gather_using_audio", {
      audio_url: absoluteUrl,
      minimum_digits: 1,
      maximum_digits: 1,
      timeout_millis: timeoutMs,
      inter_digit_timeout_millis: 5000,
      valid_digits: "0123456789*#",
      client_state: clientState,
    });
  }

  private async gatherWithMedia(
    callControlId: string,
    mediaName: string,
    clientState: string,
    timeoutMs: number
  ): Promise<void> {
    // Gather DTMF using Telnyx Media Storage - instant playback + DTMF during audio
    console.log(`[CallControl] Gather with Telnyx Media: ${mediaName}`);
    await this.makeCallControlRequest(callControlId, "gather_using_audio", {
      media_name: mediaName,
      minimum_digits: 1,
      maximum_digits: 1,
      timeout_millis: timeoutMs,
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
