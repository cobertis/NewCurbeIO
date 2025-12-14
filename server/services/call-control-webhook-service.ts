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
  pbxAudioFiles,
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
  callerNumber?: string; // Original caller's phone number
}
const callContextMap = new Map<string, CallContext>();

// Track pending bridges - when agent answers, bridge with caller
interface PendingBridge {
  callerCallControlId: string;
  clientState: string;
  companyId: string;
}
const pendingBridges = new Map<string, PendingBridge>();

// Ring-All tracking: Map caller call_control_id to all agent legs
// When one agent answers, we cancel all the other legs
const ringAllLegs = new Map<string, Set<string>>();

// =====================================================
// Hold Playback Manager - Music + Ads for Queue Hold
// =====================================================
interface HoldPlaybackState {
  companyId: string;
  queueId: string;
  holdMusicTracks: { id: string; audioUrl: string; telnyxMediaId?: string | null }[];
  currentTrackIndex: number;
  playbackMode: 'sequential' | 'random';
  ads: { id: string; audioUrl: string; telnyxMediaId?: string | null }[];
  currentAdIndex: number;
  adsEnabled: boolean;
  adsIntervalMin: number; // seconds
  adsIntervalMax: number; // seconds
  timerId: NodeJS.Timeout | null;
  isPlayingAd: boolean;
}
const holdPlaybackMap = new Map<string, HoldPlaybackState>();

/**
 * Start hold music with periodic ads for a caller in queue
 */
async function startHoldMusicWithAds(
  callControlId: string,
  companyId: string,
  queueId: string,
  queue: any
): Promise<void> {
  console.log(`[HoldPlayback] Starting hold music with ads for call ${callControlId}`);
  
  // Get hold music tracks from the pbx_queue_hold_music table (new multi-track system)
  const queueHoldMusic = await pbxService.getQueueHoldMusic(companyId, queueId);
  const holdMusicTracks = queueHoldMusic
    .filter(hm => hm.isActive && hm.audioFile?.fileUrl)
    .map(hm => ({
      id: hm.id,
      audioUrl: hm.audioFile?.fileUrl || '',
      telnyxMediaId: hm.audioFile?.telnyxMediaId || null
    }));
  console.log(`[HoldPlayback] Found ${holdMusicTracks.length} hold music tracks for queue ${queueId}`);
  
  // Get active ads for this queue
  let ads: { id: string; audioUrl: string; telnyxMediaId?: string | null }[] = [];
  if (queue.adsEnabled) {
    const queueAds = await pbxService.getActiveQueueAds(companyId, queueId);
    ads = queueAds.map(ad => ({
      id: ad.id,
      audioUrl: ad.audioFile?.fileUrl || '',
      telnyxMediaId: ad.audioFile?.telnyxMediaId || null
    })).filter(ad => ad.audioUrl || ad.telnyxMediaId);
    console.log(`[HoldPlayback] Found ${ads.length} active ads for queue ${queueId}`);
  }
  
  // Determine playback mode (default to sequential)
  const playbackMode = queue.holdMusicPlaybackMode || 'sequential';
  
  // Store state
  const state: HoldPlaybackState = {
    companyId,
    queueId,
    holdMusicTracks,
    currentTrackIndex: playbackMode === 'random' ? Math.floor(Math.random() * holdMusicTracks.length) : 0,
    playbackMode,
    ads,
    currentAdIndex: 0,
    adsEnabled: queue.adsEnabled && ads.length > 0,
    adsIntervalMin: queue.adsIntervalMin || 45,
    adsIntervalMax: queue.adsIntervalMax || 60,
    timerId: null,
    isPlayingAd: false,
  };
  holdPlaybackMap.set(callControlId, state);
  
  // Start hold music loop
  await playHoldMusic(callControlId, state);
  
  // Schedule first ad if enabled
  if (state.adsEnabled) {
    scheduleNextAd(callControlId, state);
  }
}

/**
 * Play hold music in loop for a call
 */
async function playHoldMusic(callControlId: string, state: HoldPlaybackState): Promise<void> {
  if (state.holdMusicTracks.length === 0) {
    console.log(`[HoldPlayback] No hold music tracks configured for queue ${state.queueId}`);
    return;
  }
  
  // Get current track
  const currentTrack = state.holdMusicTracks[state.currentTrackIndex];
  if (!currentTrack) {
    console.log(`[HoldPlayback] Invalid track index ${state.currentTrackIndex}`);
    return;
  }
  
  state.isPlayingAd = false;
  
  try {
    // Check if we have a Telnyx media_id - use it instead of audio_url
    // Telnyx Media Storage URLs require authentication that Call Control doesn't have
    const telnyxMediaId = (currentTrack as any).telnyxMediaId;
    
    // Convert relative URLs to absolute (only needed for external URLs)
    let audioUrl = currentTrack.audioUrl;
    if (audioUrl.startsWith('/')) {
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
      if (domain) {
        audioUrl = `https://${domain}${audioUrl}`;
      }
    }
    
    console.log(`[HoldPlayback] Playing hold music track ${state.currentTrackIndex + 1}/${state.holdMusicTracks.length} for call ${callControlId}`);
    if (telnyxMediaId) {
      console.log(`[HoldPlayback] Using Telnyx media_id: ${telnyxMediaId}`);
    } else {
      console.log(`[HoldPlayback] Audio URL: ${audioUrl}`);
    }
    
    const apiKey = await getTelnyxApiKey();
    const context = callContextMap.get(callControlId);
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    if (context?.managedAccountId) {
      headers["X-Managed-Account-Id"] = context.managedAccountId;
    }
    
    // Client state to identify this as hold music
    const clientState = Buffer.from(JSON.stringify({
      holdPlayback: true,
      type: 'music',
      trackId: currentTrack.id,
      companyId: state.companyId,
      queueId: state.queueId,
    })).toString("base64");
    
    // If single track, loop infinitely. If multiple tracks, play once then advance
    const shouldLoop = state.holdMusicTracks.length === 1;
    
    // Build playback body - use media_id for Telnyx-stored media, audio_url for external
    const playbackBody: Record<string, any> = {
      loop: shouldLoop ? "infinity" : undefined,
      client_state: clientState,
    };
    
    if (telnyxMediaId) {
      // Use media_name for Telnyx Media Storage (same as IVR greeting playback)
      playbackBody.media_name = telnyxMediaId;
    } else {
      // Use audio_url for external URLs
      playbackBody.audio_url = audioUrl;
    }
    
    const response = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/playback_start`, {
      method: "POST",
      headers,
      body: JSON.stringify(playbackBody),
    });
    
    const responseData = await response.json();
    if (!response.ok) {
      console.error(`[HoldPlayback] Telnyx playback_start failed:`, responseData);
    } else {
      console.log(`[HoldPlayback] Playback started successfully`);
    }
  } catch (error) {
    console.error(`[HoldPlayback] Error playing hold music:`, error);
  }
}

/**
 * Schedule the next ad to play after a random interval
 */
function scheduleNextAd(callControlId: string, state: HoldPlaybackState): void {
  // Clear any existing timer
  if (state.timerId) {
    clearTimeout(state.timerId);
  }
  
  // Calculate random interval between min and max
  const intervalSecs = state.adsIntervalMin + Math.random() * (state.adsIntervalMax - state.adsIntervalMin);
  console.log(`[HoldPlayback] Scheduling next ad in ${intervalSecs.toFixed(1)}s for call ${callControlId}`);
  
  state.timerId = setTimeout(async () => {
    const currentState = holdPlaybackMap.get(callControlId);
    if (!currentState || currentState.isPlayingAd) {
      return; // Call ended or already playing an ad
    }
    
    await playNextAd(callControlId, currentState);
  }, intervalSecs * 1000);
}

/**
 * Stop hold music and play the next ad
 */
async function playNextAd(callControlId: string, state: HoldPlaybackState): Promise<void> {
  if (state.ads.length === 0) return;
  
  const ad = state.ads[state.currentAdIndex];
  console.log(`[HoldPlayback] Playing ad ${state.currentAdIndex + 1}/${state.ads.length} for call ${callControlId}`);
  
  state.isPlayingAd = true;
  state.currentAdIndex = (state.currentAdIndex + 1) % state.ads.length; // Rotate to next ad
  
  try {
    const apiKey = await getTelnyxApiKey();
    const context = callContextMap.get(callControlId);
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    if (context?.managedAccountId) {
      headers["X-Managed-Account-Id"] = context.managedAccountId;
    }
    
    // First, stop the current hold music
    await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/playback_stop`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    
    // Wait a bit for stop to take effect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Client state to identify this as an ad
    const clientState = Buffer.from(JSON.stringify({
      holdPlayback: true,
      type: 'ad',
      adId: ad.id,
      companyId: state.companyId,
      queueId: state.queueId,
    })).toString("base64");
    
    // Build playback body - prefer telnyxMediaId for Telnyx-stored media
    const playbackBody: Record<string, any> = {
      client_state: clientState,
    };
    
    if (ad.telnyxMediaId) {
      // Use media_name for Telnyx Media Storage
      playbackBody.media_name = ad.telnyxMediaId;
      console.log(`[HoldPlayback] Using Telnyx media_id for ad: ${ad.telnyxMediaId}`);
    } else {
      // Convert relative URLs to absolute
      let audioUrl = ad.audioUrl;
      if (audioUrl.startsWith('/')) {
        const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
        if (domain) {
          audioUrl = `https://${domain}${audioUrl}`;
        }
      }
      playbackBody.audio_url = audioUrl;
      console.log(`[HoldPlayback] Using audio_url for ad: ${audioUrl}`);
    }
    
    // Play the ad (no loop - plays once)
    const playResponse = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/playback_start`, {
      method: "POST",
      headers,
      body: JSON.stringify(playbackBody),
    });
    
    const playResponseData = await playResponse.json();
    if (!playResponse.ok) {
      console.error(`[HoldPlayback] Telnyx playback_start for ad failed:`, playResponseData);
      throw new Error("Ad playback failed");
    } else {
      console.log(`[HoldPlayback] Ad playback started successfully`);
    }
  } catch (error) {
    console.error(`[HoldPlayback] Error playing ad:`, error);
    // On error, try to resume hold music
    state.isPlayingAd = false;
    await playHoldMusic(callControlId, state);
    scheduleNextAd(callControlId, state);
  }
}

/**
 * Handle when an ad finishes playing - resume hold music
 */
async function handleHoldAdEnded(callControlId: string): Promise<void> {
  const state = holdPlaybackMap.get(callControlId);
  if (!state) return;
  
  console.log(`[HoldPlayback] Ad ended, resuming hold music for call ${callControlId}`);
  
  // Resume hold music
  await playHoldMusic(callControlId, state);
  
  // Schedule next ad
  if (state.adsEnabled) {
    scheduleNextAd(callControlId, state);
  }
}

/**
 * Handle when a hold music track finishes playing - advance to next track
 */
async function handleHoldMusicTrackEnded(callControlId: string): Promise<void> {
  const state = holdPlaybackMap.get(callControlId);
  if (!state) return;
  
  // Don't advance if we're currently playing an ad - let the ad complete first
  // (playNextAd stops music which triggers playback.ended, we don't want to restart music)
  if (state.isPlayingAd) {
    console.log(`[HoldPlayback] Ignoring track ended - ad is playing for call ${callControlId}`);
    return;
  }
  
  // Only advance if there are multiple tracks (single track loops infinitely)
  if (state.holdMusicTracks.length <= 1) {
    return;
  }
  
  // Advance to next track based on playback mode
  if (state.playbackMode === 'random') {
    // Random: pick a different track
    let newIndex = Math.floor(Math.random() * state.holdMusicTracks.length);
    // Avoid playing the same track twice in a row if possible
    if (state.holdMusicTracks.length > 1 && newIndex === state.currentTrackIndex) {
      newIndex = (newIndex + 1) % state.holdMusicTracks.length;
    }
    state.currentTrackIndex = newIndex;
  } else {
    // Sequential: move to next track
    state.currentTrackIndex = (state.currentTrackIndex + 1) % state.holdMusicTracks.length;
  }
  
  console.log(`[HoldPlayback] Advancing to track ${state.currentTrackIndex + 1}/${state.holdMusicTracks.length} (${state.playbackMode} mode)`);
  
  // Play the next track
  await playHoldMusic(callControlId, state);
}

/**
 * Stop all hold playback for a call (agent answered or caller hung up)
 */
async function stopHoldPlayback(callControlId: string): Promise<void> {
  const state = holdPlaybackMap.get(callControlId);
  if (!state) return;
  
  console.log(`[HoldPlayback] Stopping hold playback for call ${callControlId}`);
  
  // Clear the ad timer
  if (state.timerId) {
    clearTimeout(state.timerId);
  }
  
  // Stop any current playback
  try {
    const apiKey = await getTelnyxApiKey();
    const context = callContextMap.get(callControlId);
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    if (context?.managedAccountId) {
      headers["X-Managed-Account-Id"] = context.managedAccountId;
    }
    
    await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/playback_stop`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.error(`[HoldPlayback] Error stopping playback:`, error);
  }
  
  // Clean up state
  holdPlaybackMap.delete(callControlId);
}

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

    // Store call context for managed account routing (including caller number for queue routing)
    const managedAccountId = await getCompanyManagedAccountId(phoneNumber.companyId);
    callContextMap.set(call_control_id, {
      companyId: phoneNumber.companyId,
      managedAccountId,
      callerNumber: from // Store original caller number
    });
    console.log(`[CallControl] Stored call context: companyId=${phoneNumber.companyId}, managedAccountId=${managedAccountId}, callerNumber=${from}`);

    // Check if phone number has IVR explicitly disabled ("unassigned")
    // In this case, transfer directly to the assigned user WITHOUT answering first
    // This ensures billing only starts when the agent answers, not when the call is received
    if (phoneNumber.ivrId === "unassigned") {
      console.log(`[CallControl] IVR disabled (unassigned), transferring directly to assigned user (no answer = no billing until agent picks up)`);
      await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "direct");
      await this.transferToAssignedUser(call_control_id, phoneNumber, from);
      return;
    }

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

    // Check if this is an agent answering a queue call - need to bridge
    const pendingBridge = pendingBridges.get(call_control_id);
    if (pendingBridge) {
      console.log(`[CallControl] Agent answered! Bridging with caller ${pendingBridge.callerCallControlId}`);
      pendingBridges.delete(call_control_id);

      // Stop hold music/ads for the caller since agent answered
      await stopHoldPlayback(pendingBridge.callerCallControlId);

      // Cancel all other ring-all legs for this caller (this agent won the race)
      const otherLegs = ringAllLegs.get(pendingBridge.callerCallControlId);
      if (otherLegs) {
        console.log(`[CallControl] Cancelling ${otherLegs.size - 1} other ring-all legs`);
        for (const otherLegId of otherLegs) {
          if (otherLegId !== call_control_id) {
            // Remove from pending bridges
            pendingBridges.delete(otherLegId);
            // Hangup the other leg
            try {
              await this.hangupCall(otherLegId, "NORMAL_CLEARING");
              console.log(`[CallControl] Cancelled ring-all leg: ${otherLegId}`);
            } catch (e) {
              console.log(`[CallControl] Could not cancel leg ${otherLegId} (may have already ended)`);
            }
          }
        }
        // Clean up ring-all tracking
        ringAllLegs.delete(pendingBridge.callerCallControlId);
      }

      try {
        // Bridge the caller with the agent
        await this.makeCallControlRequest(pendingBridge.callerCallControlId, "bridge", {
          call_control_id: call_control_id,
          client_state: pendingBridge.clientState,
        });
        console.log(`[CallControl] Successfully bridged caller with agent`);
      } catch (bridgeError) {
        console.error(`[CallControl] Failed to bridge calls:`, bridgeError);
        // Hangup agent call if bridge fails
        try {
          await this.hangupCall(call_control_id, "NORMAL_CLEARING");
        } catch (e) { /* ignore */ }
      }
      return;
    }

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

    // Stop hold music/ads if caller was in queue
    await stopHoldPlayback(call_control_id);

    // End any queue call notifications for this call
    extensionCallService.endQueueCall(call_control_id, "caller_hangup");

    // Clean up call context
    callContextMap.delete(call_control_id);

    // Clean up ring-all legs if caller hangs up during ringing
    const ringAllForCaller = ringAllLegs.get(call_control_id);
    if (ringAllForCaller) {
      console.log(`[CallControl] Caller ${call_control_id} hung up, cancelling ${ringAllForCaller.size} ring-all legs`);
      for (const agentLegId of ringAllForCaller) {
        pendingBridges.delete(agentLegId);
        try {
          await this.hangupCall(agentLegId, "NORMAL_CLEARING");
        } catch (e) {
          console.log(`[CallControl] Could not hangup ring-all leg ${agentLegId}`);
        }
      }
      ringAllLegs.delete(call_control_id);
    }

    // Clean up pending bridges - agent leg hung up before answering (timeout or rejected)
    const pendingBridge = pendingBridges.get(call_control_id);
    if (pendingBridge) {
      console.log(`[CallControl] Agent leg ${call_control_id} ended without answering, caller: ${pendingBridge.callerCallControlId}`);
      pendingBridges.delete(call_control_id);
      
      // Remove this agent leg from the caller's ringAllLegs set
      const callerLegs = ringAllLegs.get(pendingBridge.callerCallControlId);
      if (callerLegs) {
        callerLegs.delete(call_control_id);
        console.log(`[CallControl] Remaining ring-all legs for caller: ${callerLegs.size}`);
        
        // If no more legs are ringing, retry dialing the queue instead of voicemail
        if (callerLegs.size === 0) {
          console.log(`[CallControl] All agent legs ended without answering, retrying queue dial`);
          ringAllLegs.delete(pendingBridge.callerCallControlId);
          
          // Retry queue dial if we have the queueId, otherwise the caller stays on hold
          if (pendingBridge.queueId) {
            // Small delay before retrying to avoid hammering agents
            setTimeout(() => {
              this.retryQueueDial(pendingBridge.callerCallControlId, pendingBridge.companyId, pendingBridge.queueId!);
            }, 3000); // 3 second delay before retry
          } else {
            console.log(`[CallControl] No queueId in pendingBridge, caller stays on hold`);
          }
        }
      }
    }

    // Also check if this was the caller leg - clean up any pending bridges waiting for this caller
    const bridgeEntries = Array.from(pendingBridges.entries());
    for (const [agentCallId, bridge] of bridgeEntries) {
      if (bridge.callerCallControlId === call_control_id) {
        console.log(`[CallControl] Caller ${call_control_id} hung up, cleaning pending bridge for agent ${agentCallId}`);
        pendingBridges.delete(agentCallId);
        // Hangup the agent leg since caller is gone
        try {
          await this.hangupCall(agentCallId, "NORMAL_CLEARING");
        } catch (e) {
          console.log(`[CallControl] Could not hangup orphaned agent call ${agentCallId}`);
        }
      }
    }

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
        
        // Handle hold playback ad ended - resume hold music
        if (state.holdPlayback && state.type === 'ad') {
          console.log(`[CallControl] Hold ad ended, resuming hold music`);
          await handleHoldAdEnded(call_control_id);
          return;
        }
        
        // Handle hold music track ended - play next track (for multi-track playlists)
        if (state.holdPlayback && state.type === 'music') {
          console.log(`[CallControl] Hold music track ended, advancing to next track`);
          await handleHoldMusicTrackEnded(call_control_id);
          return;
        }
        
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

  /**
   * Route call to queue using Ring-All strategy
   * Dials all queue agents' SIP endpoints simultaneously
   * First agent to answer gets bridged, others are cancelled
   */
  private async routeToQueue(callControlId: string, companyId: string, queueId: string): Promise<void> {
    console.log(`[CallControl] Routing call to queue: ${queueId} using Ring-All strategy`);

    const queue = await pbxService.getQueue(companyId, queueId);
    if (!queue) {
      await this.speakText(callControlId, "Sorry, this queue is unavailable. Please try again later.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    const ringTimeout = queue.ringTimeout || 30;
    
    // Get caller number from call context (stored when call initiated)
    const context = callContextMap.get(callControlId);
    const callerNumber = context?.callerNumber || "Unknown";
    console.log(`[CallControl] Queue routing - caller number from context: ${callerNumber}`);

    // Get all queue members
    const members = await pbxService.getQueueMembers(companyId, queueId);
    const activeMembers = members.filter(m => m.isActive);

    if (activeMembers.length === 0) {
      // No active members - start hold music and retry in 30 seconds
      console.log(`[CallControl] No active members in queue ${queueId}, starting hold music and will retry`);
      await startHoldMusicWithAds(callControlId, companyId, queueId, queue);
      setTimeout(() => {
        this.retryQueueDial(callControlId, companyId, queueId);
      }, 30000);
      return;
    }

    console.log(`[CallControl] Queue has ${activeMembers.length} active members, dialing all SIPs...`);

    // Start hold music immediately - no voice message
    await startHoldMusicWithAds(callControlId, companyId, queueId, queue);

    // Get API key for making calls (context already obtained above)
    const apiKey = await getTelnyxApiKey();
    const managedAccountId = context?.managedAccountId;

    // Get company's caller ID
    const [phoneNumber] = await db
      .select({ phoneNumber: telnyxPhoneNumbers.phoneNumber })
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId))
      .limit(1);
    const callerIdNumber = phoneNumber?.phoneNumber || "+15555555555";

    // Get Call Control App ID
    const [settings] = await db
      .select({ callControlAppId: telephonySettings.callControlAppId })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    const connectionId = settings?.callControlAppId;

    if (!connectionId) {
      console.error(`[CallControl] No Call Control App ID for company ${companyId}`);
      await this.speakText(callControlId, "System error. Please try again later.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (managedAccountId) {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }

    // Initialize ring-all tracking for this caller
    ringAllLegs.set(callControlId, new Set());

    let successfulDials = 0;

    // Dial all agents simultaneously
    for (const member of activeMembers) {
      if (!member.userId) continue;

      // Get agent's SIP credentials
      const sipCreds = await getUserSipCredentials(member.userId);
      if (!sipCreds?.sipUsername) {
        console.log(`[CallControl] Agent ${member.userId} has no SIP credentials, skipping`);
        continue;
      }

      const sipUri = `sip:${sipCreds.sipUsername}@sip.telnyx.com`;
      console.log(`[CallControl] Dialing agent SIP: ${sipUri}`);

      try {
        const clientState = Buffer.from(JSON.stringify({
          companyId,
          agentUserId: member.userId,
          queueId,
          ringAll: true,
          originalCallerNumber: callerNumber,
        })).toString("base64");

        // Format display name to show queue name and caller number
        const queueDisplayName = `${queue.name} - ${callerNumber}`;
        
        const response = await fetch(`${TELNYX_API_BASE}/calls`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            connection_id: connectionId,
            to: sipUri,
            from: callerIdNumber,
            from_display_name: queueDisplayName,
            timeout_secs: ringTimeout,
            answering_machine_detection: "disabled",
            client_state: clientState,
            custom_headers: [
              { name: "X-Original-Caller", value: callerNumber },
              { name: "X-Queue-Name", value: queue.name }
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[CallControl] Failed to dial ${sipUri}: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json();
        const agentCallControlId = data.data?.call_control_id;

        if (agentCallControlId) {
          console.log(`[CallControl] Created ring-all leg: ${agentCallControlId} for ${sipUri}`);
          
          // Track this leg
          ringAllLegs.get(callControlId)?.add(agentCallControlId);
          callContextMap.set(agentCallControlId, { companyId, managedAccountId });
          
          // Store pending bridge info
          pendingBridges.set(agentCallControlId, {
            callerCallControlId: callControlId,
            clientState,
            companyId,
            queueId,
          });
          
          successfulDials++;
        }
      } catch (error) {
        console.error(`[CallControl] Error dialing ${sipUri}:`, error);
      }
    }

    if (successfulDials === 0) {
      // No agents available - keep caller in queue with hold music
      // They will wait until an agent becomes available or caller hangs up
      console.log(`[CallControl] No agents could be dialed - caller stays in queue with hold music`);
      ringAllLegs.delete(callControlId);
      // Hold music is already playing - don't go to voicemail
      // Set a retry timer to try dialing agents again
      setTimeout(() => {
        this.retryQueueDial(callControlId, companyId, queueId);
      }, 30000); // Retry in 30 seconds
      return;
    }

    console.log(`[CallControl] Successfully started ${successfulDials} ring-all legs for queue ${queueId}`);

    // Update call state
    await pbxService.trackActiveCall(companyId, callControlId, callerNumber, "", "queue", {
      queueId,
      ringAllLegs: successfulDials
    });
    // Hold music already started at the beginning of routeToQueue
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

    // Get company's caller ID
    const [phoneNumber] = await db
      .select({ 
        phoneNumber: telnyxPhoneNumbers.phoneNumber
      })
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId))
      .limit(1);

    const callerIdNumber = phoneNumber?.phoneNumber || "+15555555555";

    // Get Call Control App ID for the company (required for outbound calls via REST API)
    const [settings] = await db
      .select({ callControlAppId: telephonySettings.callControlAppId })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    const connectionId = settings?.callControlAppId;

    if (!connectionId) {
      throw new Error("No Call Control App ID found for company - cannot create outbound call");
    }
    
    console.log(`[CallControl] Using Call Control App ID: ${connectionId} for outbound call`)

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

    // Store context for the new call leg with pending bridge info
    callContextMap.set(agentCallControlId, { companyId, managedAccountId });
    
    // Store pending bridge info - will be processed when agent answers (call.answered event)
    pendingBridges.set(agentCallControlId, {
      callerCallControlId: callControlId,
      clientState,
      companyId,
    });

    console.log(`[CallControl] Waiting for agent to answer call ${agentCallControlId}, will bridge with ${callControlId}`);
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
      // All agents rejected - retry dialing all agents (queue behavior)
      console.log(`[CallControl] All agents rejected queue call ${callControlId}, retrying dial to all agents`);
      
      // Get the queue ID from call context
      const activeCall = await pbxService.getActiveCall(callControlId);
      const metadata = activeCall?.metadata as { queueId?: string } | null;
      const queueId = metadata?.queueId;
      
      if (queueId) {
        // Wait a moment then retry dialing all agents
        setTimeout(() => {
          this.retryQueueDial(callControlId, companyId, queueId);
        }, 5000); // Wait 5 seconds before retrying
      }
      
      return { success: true, routeToVoicemail: false };
    }

    return { success: result.success, routeToVoicemail: false };
  }

  /**
   * Handle queue call timeout - retry dialing all agents
   */
  async handleQueueCallTimeout(callControlId: string, companyId: string): Promise<void> {
    console.log(`[CallControl] Queue call ${callControlId} timed out, retrying dial to all agents`);
    
    // Get the queue ID from call context
    const activeCall = await pbxService.getActiveCall(callControlId);
    const metadata = activeCall?.metadata as { queueId?: string } | null;
    const queueId = metadata?.queueId;
    
    if (queueId) {
      // Retry dialing all agents - hold music continues
      await this.retryQueueDial(callControlId, companyId, queueId);
    }
  }

  /**
   * Retry dialing all queue agents - called when timeout or all agents reject
   * Hold music continues playing, just re-dial the agents
   */
  private async retryQueueDial(callControlId: string, companyId: string, queueId: string): Promise<void> {
    console.log(`[CallControl] Retrying queue dial for call ${callControlId}, queue ${queueId}`);

    // First check if the caller is still connected
    const activeCall = await pbxService.getActiveCall(callControlId);
    if (!activeCall) {
      console.log(`[CallControl] Caller ${callControlId} no longer active, stopping retry`);
      await stopHoldPlayback(callControlId);
      return;
    }

    const queue = await pbxService.getQueue(companyId, queueId);
    if (!queue) {
      console.log(`[CallControl] Queue ${queueId} not found for retry`);
      return;
    }

    const ringTimeout = queue.ringTimeout || 30;
    const context = callContextMap.get(callControlId);
    const callerNumber = context?.callerNumber || "Unknown";

    // Get all queue members
    const members = await pbxService.getQueueMembers(companyId, queueId);
    const activeMembers = members.filter(m => m.isActive);

    if (activeMembers.length === 0) {
      console.log(`[CallControl] No active members in queue ${queueId} for retry, will retry in 30s`);
      setTimeout(() => {
        this.retryQueueDial(callControlId, companyId, queueId);
      }, 30000);
      return;
    }

    console.log(`[CallControl] Retry: dialing ${activeMembers.length} agents...`);

    const apiKey = await getTelnyxApiKey();
    const managedAccountId = context?.managedAccountId;

    const [phoneNumber] = await db
      .select({ phoneNumber: telnyxPhoneNumbers.phoneNumber })
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.companyId, companyId))
      .limit(1);
    const callerIdNumber = phoneNumber?.phoneNumber || "+15555555555";

    const [settings] = await db
      .select({ callControlAppId: telephonySettings.callControlAppId })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    const connectionId = settings?.callControlAppId;

    if (!connectionId) {
      console.error(`[CallControl] No Call Control App ID for retry`);
      return;
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (managedAccountId) {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }

    // Initialize ring-all tracking
    ringAllLegs.set(callControlId, new Set());
    let successfulDials = 0;

    for (const member of activeMembers) {
      if (!member.userId) continue;

      const sipCreds = await getUserSipCredentials(member.userId);
      if (!sipCreds?.sipUsername) continue;

      const sipUri = `sip:${sipCreds.sipUsername}@sip.telnyx.com`;

      try {
        const clientState = Buffer.from(JSON.stringify({
          companyId,
          agentUserId: member.userId,
          queueId,
          ringAll: true,
          originalCallerNumber: callerNumber,
        })).toString("base64");

        const queueDisplayName = `${queue.name} - ${callerNumber}`;
        
        const response = await fetch(`${TELNYX_API_BASE}/calls`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            connection_id: connectionId,
            to: sipUri,
            from: callerIdNumber,
            from_display_name: queueDisplayName,
            timeout_secs: ringTimeout,
            answering_machine_detection: "disabled",
            client_state: clientState,
            custom_headers: [
              { name: "X-Original-Caller", value: callerNumber },
              { name: "X-Queue-Name", value: queue.name }
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const agentCallControlId = data.data?.call_control_id;

          if (agentCallControlId) {
            ringAllLegs.get(callControlId)?.add(agentCallControlId);
            callContextMap.set(agentCallControlId, { companyId, managedAccountId });
            pendingBridges.set(agentCallControlId, {
              callerCallControlId: callControlId,
              clientState,
              companyId,
              queueId,
            });
            successfulDials++;
          }
        }
      } catch (error) {
        console.error(`[CallControl] Error retrying dial to ${sipUri}:`, error);
      }
    }

    if (successfulDials === 0) {
      console.log(`[CallControl] Retry failed to dial any agents, will retry in 30s`);
      setTimeout(() => {
        this.retryQueueDial(callControlId, companyId, queueId);
      }, 30000);
    } else {
      console.log(`[CallControl] Retry: started ${successfulDials} ring-all legs`);
    }
  }

  private async routeToExtension(
    callControlId: string,
    companyId: string,
    extensionId: string
  ): Promise<void> {
    console.log(`[CallControl] Routing call to extension: ${extensionId} directly via SIP`);

    const extensions = await pbxService.getExtensions(companyId);
    const extension = extensions.find((ext) => ext.id === extensionId);

    if (!extension) {
      await this.speakText(callControlId, "Extension not found. Please try again.");
      return;
    }

    // Get the userId from the extension
    const [extData] = await db
      .select({ userId: pbxExtensions.userId })
      .from(pbxExtensions)
      .where(eq(pbxExtensions.id, extensionId));

    if (!extData?.userId) {
      console.log(`[CallControl] Extension ${extensionId} has no assigned user, routing to voicemail`);
      await this.speakText(callControlId, "This extension is not configured. Please leave a message.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    // Get the agent's SIP credentials
    const sipCreds = await getUserSipCredentials(extData.userId);
    
    if (!sipCreds?.sipUsername) {
      console.log(`[CallControl] User ${extData.userId} has no SIP credentials, routing to voicemail`);
      await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    const activeCall = await pbxService.getActiveCall(callControlId);
    const callerNumber = activeCall?.from || callContextMap.get(callControlId)?.callerNumber || "Unknown";

    // Create client state for the bridged call
    const clientState = Buffer.from(JSON.stringify({
      companyId,
      agentUserId: extData.userId,
      extensionId,
      directCall: true,
      originalCallControlId: callControlId,
    })).toString("base64");

    // Dial the agent's SIP URI directly
    const sipUri = `sip:${sipCreds.sipUsername}@sip.telnyx.com`;
    console.log(`[CallControl] Dialing agent's SIP URI directly: ${sipUri}`);

    try {
      await this.speakText(callControlId, "Please hold while we connect you.");
      await this.dialAndBridgeToSip(callControlId, sipUri, clientState, companyId);
      
      // Update call state to connected
      await pbxService.trackActiveCall(companyId, callControlId, callerNumber, sipUri, "connected", {
        extensionId,
        agentSipUri: sipUri
      });
    } catch (error) {
      console.error(`[CallControl] Failed to dial agent SIP:`, error);
      await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
      await this.routeToVoicemail(callControlId, companyId);
    }
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

  private async routeToAssignedUser(
    callControlId: string,
    phoneNumber: any
  ): Promise<void> {
    console.log(`[CallControl] Routing directly to assigned user for phone number`);

    if (!phoneNumber.ownerUserId) {
      console.log(`[CallControl] No assigned user, falling back to voicemail`);
      await this.speakText(callControlId, "This number is not configured. Please leave a message.");
      await this.routeToVoicemail(callControlId, phoneNumber.companyId);
      return;
    }

    const companyId = phoneNumber.companyId;
    const activeCall = await pbxService.getActiveCall(callControlId);
    const callerNumber = activeCall?.from || callContextMap.get(callControlId)?.callerNumber || "Unknown";

    // Get the assigned user's extension
    const extension = await pbxService.getExtensionByUserId(companyId, phoneNumber.ownerUserId);
    if (!extension) {
      console.log(`[CallControl] Assigned user has no extension, trying direct SIP dial`);
      
      // Get the assigned user's SIP credentials directly
      const sipCreds = await getUserSipCredentials(phoneNumber.ownerUserId);
      
      if (!sipCreds?.sipUsername) {
        console.log(`[CallControl] User ${phoneNumber.ownerUserId} has no SIP credentials, routing to voicemail`);
        await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
        await this.routeToVoicemail(callControlId, companyId);
        return;
      }

      // Create client state for the bridged call
      const clientState = Buffer.from(JSON.stringify({
        companyId,
        agentUserId: phoneNumber.ownerUserId,
        directCall: true,
        originalCallControlId: callControlId,
      })).toString("base64");

      // Dial the agent's SIP URI directly
      const sipUri = `sip:${sipCreds.sipUsername}@sip.telnyx.com`;
      console.log(`[CallControl] Dialing assigned user's SIP URI directly: ${sipUri}`);

      try {
        await this.speakText(callControlId, "Please hold while we connect you.");
        await this.dialAndBridgeToSip(callControlId, sipUri, clientState, companyId);
        
        // Update call state to connected
        await pbxService.trackActiveCall(companyId, callControlId, callerNumber, sipUri, "connected", {
          agentUserId: phoneNumber.ownerUserId,
          agentSipUri: sipUri
        });
      } catch (error) {
        console.error(`[CallControl] Failed to dial assigned user SIP:`, error);
        await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
        await this.routeToVoicemail(callControlId, companyId);
      }
      return;
    }

    console.log(`[CallControl] Found extension ${extension.extensionNumber} for assigned user, routing call`);
    
    // Route to the extension
    await this.routeToExtension(callControlId, companyId, extension.id);
  }

  /**
   * Transfer call to assigned user with RING-ALL to multiple devices
   * This dials ALL registered endpoints (webphone + physical phone) simultaneously
   * When one answers, the others are cancelled and call is bridged
   */
  private async transferToAssignedUser(
    callControlId: string,
    phoneNumber: any,
    callerNumber?: string
  ): Promise<void> {
    console.log(`[CallControl] Ring-all transfer to assigned user, caller: ${callerNumber}`);

    if (!phoneNumber.ownerUserId) {
      console.log(`[CallControl] No assigned user, cannot transfer`);
      await this.answerCall(callControlId);
      await this.speakText(callControlId, "This number is not configured. Please leave a message.");
      await this.routeToVoicemail(callControlId, phoneNumber.companyId);
      return;
    }

    const sipCreds = await getUserSipCredentials(phoneNumber.ownerUserId);
    
    if (!sipCreds?.sipUsername) {
      console.log(`[CallControl] User ${phoneNumber.ownerUserId} has no SIP credentials`);
      await this.answerCall(callControlId);
      await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
      await this.routeToVoicemail(callControlId, phoneNumber.companyId);
      return;
    }

    const companyId = phoneNumber.companyId;
    
    // Get the REAL credential connection ID from telephony_settings (numeric Telnyx ID)
    // NOT from telephony_credentials.telnyxCredentialId (which is an internal UUID)
    const [telSettings] = await db
      .select({ credentialConnectionId: telephonySettings.credentialConnectionId })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    
    const credentialConnectionId = telSettings?.credentialConnectionId;
    
    if (!credentialConnectionId) {
      console.log(`[CallControl] No credential connection ID found for company, using simple transfer`);
      // Fallback to simple transfer
      const sipUri = `sip:${sipCreds.sipUsername}@sip.telnyx.com`;
      const clientState = Buffer.from(JSON.stringify({
        companyId,
        agentUserId: phoneNumber.ownerUserId,
        directTransfer: true,
      })).toString("base64");
      const transferParams: any = { to: sipUri, client_state: clientState };
      if (callerNumber) transferParams.from = callerNumber;
      await this.makeCallControlRequest(callControlId, "transfer", transferParams);
      return;
    }
    
    console.log(`[CallControl] Getting registered endpoints for credential connection: ${credentialConnectionId}`);
    
    try {
      const apiKey = await getTelnyxApiKey();
      const managedAccountId = await getCompanyManagedAccountId(companyId);
      
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      if (managedAccountId) {
        headers["X-Managed-Account-Id"] = managedAccountId;
      }

      // Get all registered endpoints for this credential connection
      const registrationsResponse = await fetch(
        `${TELNYX_API_BASE}/credential_connections/${credentialConnectionId}/registrations`,
        { method: "GET", headers }
      );

      let sipEndpoints: string[] = [];
      
      if (registrationsResponse.ok) {
        const registrationsData = await registrationsResponse.json();
        const registrations = registrationsData.data || [];
        console.log(`[CallControl] Found ${registrations.length} registered endpoints:`, registrations);
        
        // Extract SIP URIs from registrations - each registration has a contact with the device's address
        for (const reg of registrations) {
          // The registration should have contact info with the device's IP:port
          // Format varies but we need to extract the SIP address
          if (reg.contact) {
            // Contact might be like: sip:username@IP:port or <sip:username@IP:port>
            const contactMatch = reg.contact.match(/<?(sip:[^>]+)>?/i);
            if (contactMatch) {
              sipEndpoints.push(contactMatch[1]);
              console.log(`[CallControl] Found registered endpoint: ${contactMatch[1]}`);
            }
          }
          // Also check for address field
          if (reg.address && !sipEndpoints.includes(`sip:${sipCreds.sipUsername}@${reg.address}`)) {
            const endpoint = `sip:${sipCreds.sipUsername}@${reg.address}`;
            sipEndpoints.push(endpoint);
            console.log(`[CallControl] Found registered endpoint from address: ${endpoint}`);
          }
        }
      } else {
        console.log(`[CallControl] Could not fetch registrations (${registrationsResponse.status}), using default SIP URI`);
      }

      // Always include the default Telnyx SIP URI as fallback (this is what webphone uses)
      const defaultSipUri = `sip:${sipCreds.sipUsername}@sip.telnyx.com`;
      if (!sipEndpoints.some(e => e.includes('sip.telnyx.com'))) {
        sipEndpoints.push(defaultSipUri);
      }

      // If no endpoints found, just use the default
      if (sipEndpoints.length === 0) {
        sipEndpoints = [defaultSipUri];
      }

      console.log(`[CallControl] Will dial ${sipEndpoints.length} endpoints: ${sipEndpoints.join(', ')}`);

      // If only one endpoint, use simple transfer (no billing until answer)
      if (sipEndpoints.length === 1) {
        console.log(`[CallControl] Single endpoint, using simple transfer`);
        const clientState = Buffer.from(JSON.stringify({
          companyId,
          agentUserId: phoneNumber.ownerUserId,
          directTransfer: true,
        })).toString("base64");

        const transferParams: any = {
          to: sipEndpoints[0],
          client_state: clientState,
        };
        if (callerNumber) {
          transferParams.from = callerNumber;
        }
        await this.makeCallControlRequest(callControlId, "transfer", transferParams);
        return;
      }

      // Multiple endpoints: answer and dial all in parallel (ring-all)
      console.log(`[CallControl] Multiple endpoints detected, using ring-all strategy`);
      await this.answerCall(callControlId);

      // Get Call Control App ID for dialing
      const [settings] = await db
        .select({ callControlAppId: telephonySettings.callControlAppId })
        .from(telephonySettings)
        .where(eq(telephonySettings.companyId, companyId));
      
      if (!settings?.callControlAppId) {
        console.error(`[CallControl] No Call Control App ID for company ${companyId}`);
        await this.speakText(callControlId, "System error. Please try again later.");
        await this.routeToVoicemail(callControlId, companyId);
        return;
      }

      // Use caller's number so agent sees who is calling
      // Fall back to company number only if caller number is unavailable
      const [phoneNumberRecord] = await db
        .select({ phoneNumber: telnyxPhoneNumbers.phoneNumber })
        .from(telnyxPhoneNumbers)
        .where(eq(telnyxPhoneNumbers.companyId, companyId))
        .limit(1);
      const fallbackNumber = phoneNumberRecord?.phoneNumber || "+15555555555";
      const displayFromNumber = callerNumber || fallbackNumber;

      // Initialize ring-all tracking
      ringAllLegs.set(callControlId, new Set());
      let successfulDials = 0;

      // Dial all endpoints simultaneously
      for (const endpoint of sipEndpoints) {
        try {
          const clientState = Buffer.from(JSON.stringify({
            companyId,
            agentUserId: phoneNumber.ownerUserId,
            ringAll: true,
            directTransfer: true,
            originalCallerNumber: callerNumber,
          })).toString("base64");

          const displayName = callerNumber || "Llamada entrante";
          
          const response = await fetch(`${TELNYX_API_BASE}/calls`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              connection_id: settings.callControlAppId,
              to: endpoint,
              from: displayFromNumber,
              from_display_name: displayName,
              timeout_secs: 30,
              answering_machine_detection: "disabled",
              client_state: clientState,
              custom_headers: [
                { name: "X-Original-Caller", value: callerNumber || "unknown" }
              ],
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[CallControl] Failed to dial ${endpoint}: ${response.status} - ${errorText}`);
            continue;
          }

          const data = await response.json();
          const agentCallControlId = data.data?.call_control_id;

          if (agentCallControlId) {
            console.log(`[CallControl] Created ring-all leg: ${agentCallControlId} for ${endpoint}`);
            
            ringAllLegs.get(callControlId)?.add(agentCallControlId);
            callContextMap.set(agentCallControlId, { companyId, managedAccountId, callerNumber });
            
            pendingBridges.set(agentCallControlId, {
              callerCallControlId: callControlId,
              clientState,
              companyId,
            });
            
            successfulDials++;
          }
        } catch (error) {
          console.error(`[CallControl] Error dialing ${endpoint}:`, error);
        }
      }

      if (successfulDials === 0) {
        console.log(`[CallControl] No endpoints could be dialed`);
        ringAllLegs.delete(callControlId);
        await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
        await this.routeToVoicemail(callControlId, companyId);
        return;
      }

      console.log(`[CallControl] Successfully started ${successfulDials} ring-all legs`);
      
      await pbxService.trackActiveCall(companyId, callControlId, callerNumber || "", "", "ringing", {
        agentUserId: phoneNumber.ownerUserId,
        ringAllLegs: successfulDials
      });

    } catch (error) {
      console.error(`[CallControl] Ring-all transfer failed:`, error);
      await this.answerCall(callControlId);
      await this.speakText(callControlId, "The agent is currently unavailable. Please leave a message.");
      await this.routeToVoicemail(callControlId, phoneNumber.companyId);
    }
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

  /**
   * Start hold music for a call (agent-initiated hold with music playback to caller)
   */
  public async startHoldMusic(callControlId: string, companyId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[CallControl] Starting hold music for call ${callControlId}`);
    
    try {
      const apiKey = await getTelnyxApiKey();
      const context = callContextMap.get(callControlId);
      
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };
      if (context?.managedAccountId) {
        headers["X-Managed-Account-Id"] = context.managedAccountId;
      }
      
      // Get hold music from company PBX settings
      const settings = await pbxService.getPbxSettings(companyId);
      
      // Check if there's a default hold music file in PBX audio library
      const [audioFile] = await db
        .select()
        .from(pbxAudioFiles)
        .where(and(
          eq(pbxAudioFiles.companyId, companyId),
          eq(pbxAudioFiles.audioType, "hold_music")
        ))
        .limit(1);
      
      let playbackBody: Record<string, any> = {
        loop: "infinity",
        client_state: Buffer.from(JSON.stringify({
          holdPlayback: true,
          type: 'agent_hold',
          companyId,
        })).toString("base64"),
      };
      
      if (audioFile?.telnyxMediaId) {
        // Use Telnyx media_name for uploaded audio
        playbackBody.media_name = audioFile.telnyxMediaId;
        console.log(`[CallControl] Using Telnyx media: ${audioFile.telnyxMediaId}`);
      } else if (settings?.holdMusicUrl) {
        // Fallback to holdMusicUrl from settings
        let audioUrl = settings.holdMusicUrl;
        if (audioUrl.startsWith('/')) {
          const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
          if (domain) {
            audioUrl = `https://${domain}${audioUrl}`;
          }
        }
        playbackBody.audio_url = audioUrl;
        console.log(`[CallControl] Using audio URL: ${audioUrl}`);
      } else {
        console.log(`[CallControl] No hold music configured for company ${companyId}`);
        return { success: false, error: "No hold music configured" };
      }
      
      const response = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/playback_start`, {
        method: "POST",
        headers,
        body: JSON.stringify(playbackBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[CallControl] playback_start failed:`, errorData);
        return { success: false, error: "Failed to start hold music" };
      }
      
      console.log(`[CallControl] Hold music started successfully`);
      return { success: true };
    } catch (error) {
      console.error(`[CallControl] Error starting hold music:`, error);
      return { success: false, error: "Internal error" };
    }
  }

  /**
   * Stop hold music for a call (agent resumes call)
   */
  public async stopHoldMusic(callControlId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[CallControl] Stopping hold music for call ${callControlId}`);
    
    try {
      const apiKey = await getTelnyxApiKey();
      const context = callContextMap.get(callControlId);
      
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };
      if (context?.managedAccountId) {
        headers["X-Managed-Account-Id"] = context.managedAccountId;
      }
      
      const response = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/playback_stop`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[CallControl] playback_stop failed:`, errorData);
        return { success: false, error: "Failed to stop hold music" };
      }
      
      console.log(`[CallControl] Hold music stopped successfully`);
      return { success: true };
    } catch (error) {
      console.error(`[CallControl] Error stopping hold music:`, error);
      return { success: false, error: "Internal error" };
    }
  }
}

export const callControlWebhookService = new CallControlWebhookService();
