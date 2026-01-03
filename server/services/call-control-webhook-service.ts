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
  callLogs,
  recordingAnnouncementMedia,
} from "@shared/schema";
import { eq, and, inArray, desc, isNull, or, sql } from "drizzle-orm";

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
  clientState?: string;
  companyId: string;
  queueId?: string;
  isDirectCall?: boolean; // true when it's a direct call to assigned user (not queue)
  isDirectRingThrough?: boolean; // true for new dial+bridge ring-through pattern
  isBlindTransfer?: boolean; // true for blind transfer pattern (no answer first)
  isOutboundPstn?: boolean; // true when this is an outbound PSTN call from WebRTC
  destinationNumber?: string; // The destination number for outbound calls
  agentUserId?: string; // The user ID of the agent being called
  callerNumber?: string; // The caller's phone number
  sipUri?: string; // The SIP URI being dialed
}
const pendingBridges = new Map<string, PendingBridge>();

// Ring-All tracking: Map caller call_control_id to all agent legs
// When one agent answers, we cancel all the other legs
const ringAllLegs = new Map<string, Set<string>>();

// =====================================================
// Active Inbound Calls Map - For reject-to-voicemail
// Maps normalized caller number to active call_control_id
// =====================================================
interface ActiveInboundCall {
  callControlId: string;
  callerNumber: string;
  toNumber: string;
  companyId: string;
  timestamp: number;
}
const activeInboundCalls = new Map<string, ActiveInboundCall>();

/**
 * Register an active inbound call for reject-to-voicemail lookup
 */
export function registerActiveInboundCall(
  callControlId: string,
  callerNumber: string,
  toNumber: string,
  companyId: string
): void {
  // Use normalized caller number as key (last 10 digits)
  const normalizedCaller = callerNumber.replace(/\D/g, '').slice(-10);
  const key = `${normalizedCaller}_${companyId}`;
  
  activeInboundCalls.set(key, {
    callControlId,
    callerNumber,
    toNumber,
    companyId,
    timestamp: Date.now()
  });
  
  console.log(`[ActiveCalls] Registered: ${normalizedCaller} -> ${callControlId}`);
  
  // Cleanup old entries (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  Array.from(activeInboundCalls.entries()).forEach(([k, v]) => {
    if (v.timestamp < tenMinutesAgo) {
      activeInboundCalls.delete(k);
    }
  });
}

/**
 * Get active inbound call by caller number
 */
export function getActiveInboundCall(callerNumber: string, companyId: string): ActiveInboundCall | undefined {
  const normalizedCaller = callerNumber.replace(/\D/g, '').slice(-10);
  const key = `${normalizedCaller}_${companyId}`;
  return activeInboundCalls.get(key);
}

/**
 * Remove active inbound call (on hangup or answered)
 */
export function removeActiveInboundCall(callerNumber: string, companyId: string): void {
  const normalizedCaller = callerNumber.replace(/\D/g, '').slice(-10);
  const key = `${normalizedCaller}_${companyId}`;
  activeInboundCalls.delete(key);
  console.log(`[ActiveCalls] Removed: ${normalizedCaller}`);
}

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
      if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
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

    console.log(`[CallControl] Call initiated: from=${from}, to=${to}, direction=${direction}`);

    if (direction !== "incoming") {
      console.log(`[CallControl] Ignoring outgoing call initiated event (direction=${direction})`);
      return;
    }

    // If "to" is a SIP URI (contains @), this is a forked call leg from SIP Forking
    // These should be ignored, not hung up - the SIP client will handle them directly
    if (to.includes('@')) {
      console.log(`[CallControl] Ignoring SIP URI call (forked leg): ${to}`);
      return;
    }

    // CRITICAL: Check if "from" is one of our numbers - this means it's an OUTBOUND call
    // WebRTC calls through credential connections appear as direction="incoming" to Call Control
    // but they are actually outbound user calls to external numbers
    const fromNumber = await this.findPhoneNumberByE164(from);
    if (fromNumber) {
      console.log(`[CallControl] Outbound WebRTC call detected (from=${from} is our number)`);
      console.log(`[CallControl] Outbound call destination: ${to}`);
      
      // Store call context for the outbound call (for recording, billing, etc.)
      const managedAccountId = await getCompanyManagedAccountId(fromNumber.companyId);
      callContextMap.set(call_control_id, {
        companyId: fromNumber.companyId,
        managedAccountId,
        callerNumber: from
      });
      
      // CRITICAL: Update the call_logs record with the correct call_control_id
      // The WebRTC SDK creates a call log with a local UUID, but we need the real call_control_id
      // for recording and other Call Control API operations
      try {
        const normalizedFrom = from.replace(/\D/g, '');
        const normalizedTo = to.replace(/\D/g, '');
        
        // Find the most recent outbound call from this number to this destination
        // that doesn't have a valid call_control_id yet
        const [recentCall] = await db
          .select()
          .from(callLogs)
          .where(and(
            eq(callLogs.companyId, fromNumber.companyId),
            eq(callLogs.direction, 'outbound')
          ))
          .orderBy(desc(callLogs.startedAt))
          .limit(1);
        
        if (recentCall) {
          // Check if the call matches (from/to numbers) and update with call_control_id
          const callFrom = recentCall.fromNumber?.replace(/\D/g, '') || '';
          const callTo = recentCall.toNumber?.replace(/\D/g, '') || '';
          
          if ((callFrom.includes(normalizedFrom) || normalizedFrom.includes(callFrom)) &&
              (callTo.includes(normalizedTo) || normalizedTo.includes(callTo))) {
            await db
              .update(callLogs)
              .set({ telnyxCallId: call_control_id })
              .where(eq(callLogs.id, recentCall.id));
            console.log(`[CallControl] Updated call log ${recentCall.id} with call_control_id: ${call_control_id}`);
          }
        }
      } catch (err) {
        console.error(`[CallControl] Error updating call log with call_control_id:`, err);
      }
      
      // Answer the WebRTC leg first
      await this.answerCall(call_control_id);
      
      // Dial the PSTN destination and bridge with the WebRTC leg
      await this.dialOutboundPSTN(call_control_id, to, from, fromNumber.companyId, managedAccountId);
      return;
    }

    // This is a true inbound call - verify destination number is ours
    const phoneNumber = await this.findPhoneNumberByE164(to);
    if (!phoneNumber) {
      console.log(`[CallControl] Phone number not found for: ${to}`);
      await this.hangupCall(call_control_id, "USER_NOT_FOUND");
      return;
    }

    // Register this call for reject-to-voicemail lookup
    // This allows the WebPhone to find the real call_control_id when rejecting
    registerActiveInboundCall(call_control_id, from, to, phoneNumber.companyId);

    // CRITICAL: For SIP Forking calls, check agent availability BEFORE the call is forked
    // If the number has an assigned user and they're offline/busy, reject immediately
    if (phoneNumber.ownerUserId) {
      const [agentUser] = await db
        .select({ agentAvailabilityStatus: users.agentAvailabilityStatus })
        .from(users)
        .where(eq(users.id, phoneNumber.ownerUserId));
      
      if (agentUser && (agentUser.agentAvailabilityStatus === "busy" || agentUser.agentAvailabilityStatus === "offline")) {
        console.log(`[CallControl] Agent ${phoneNumber.ownerUserId} is ${agentUser.agentAvailabilityStatus}, rejecting call to voicemail immediately`);
        await this.answerCall(call_control_id);
        await this.routeToVoicemail(call_control_id, phoneNumber.companyId);
        return;
      }
    }

    // Store call context for managed account routing (including caller number for queue routing)
    const managedAccountId = await getCompanyManagedAccountId(phoneNumber.companyId);
    callContextMap.set(call_control_id, {
      companyId: phoneNumber.companyId,
      managedAccountId,
      callerNumber: from // Store original caller number
    });
    console.log(`[CallControl] Stored call context: companyId=${phoneNumber.companyId}, managedAccountId=${managedAccountId}, callerNumber=${from}`);

    // Check for internal call with specific target (IVR or Queue) - must answer first for internal routing
    if (client_state) {
      try {
        const state = JSON.parse(Buffer.from(client_state, "base64").toString());
        
        if (state.internalCall) {
          console.log(`[CallControl] Internal call detected, target: ${state.targetType}`);
          await this.answerCall(call_control_id);
          
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
    
    // PRIORITY 1: Check if phone number has a specific IVR assigned (multi-IVR support)
    // If IVR is active, answer and play IVR
    if (phoneNumber.ivrId && phoneNumber.ivrId !== "unassigned") {
      const ivr = await pbxService.getIvr(phoneNumber.companyId, phoneNumber.ivrId);
      if (ivr && ivr.isActive) {
        console.log(`[CallControl] Phone number has specific IVR: ${ivr.name} (${ivr.id}), answering call`);
        await this.answerCall(call_control_id);
        await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "ivr");
        await this.playIvrGreetingForIvr(call_control_id, phoneNumber.companyId, ivr);
        return;
      }
    }

    // PRIORITY 2: Check if company has a default IVR (multi-IVR support)
    const defaultIvr = await pbxService.getDefaultIvr(phoneNumber.companyId);
    if (defaultIvr && defaultIvr.isActive) {
      console.log(`[CallControl] Using company default IVR: ${defaultIvr.name} (${defaultIvr.id}), answering call`);
      await this.answerCall(call_control_id);
      await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "ivr");
      await this.playIvrGreetingForIvr(call_control_id, phoneNumber.companyId, defaultIvr);
      return;
    }

    // PRIORITY 3: Check legacy PBX settings IVR
    const settings = await pbxService.getPbxSettings(phoneNumber.companyId);
    if (settings?.ivrEnabled) {
      console.log(`[CallControl] Legacy IVR enabled, answering call`);
      await this.answerCall(call_control_id);
      await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "ivr");
      await this.playIvrGreeting(call_control_id, phoneNumber.companyId, settings);
      return;
    }

    // NO IVR CONFIGURED - Ring-through to agent directly
    // DO NOT answer the call - billing starts only when agent picks up
    // This is the correct flow: caller hears ringback tone while agent's phone rings
    if (phoneNumber.ownerUserId) {
      console.log(`[CallControl] No IVR configured, ring-through to assigned user (billing starts when agent answers)`);
      await pbxService.trackActiveCall(phoneNumber.companyId, call_control_id, from, to, "ringing");
      await this.transferToAssignedUser(call_control_id, phoneNumber, from);
      return;
    }

    // No IVR and no assigned user - answer and route to voicemail
    console.log(`[CallControl] No IVR and no assigned user, routing to voicemail`);
    await this.answerCall(call_control_id);
    await this.routeToVoicemail(call_control_id, phoneNumber.companyId);
  }

  private async handleCallAnswered(payload: CallControlEvent["data"]["payload"]): Promise<void> {
    const { call_control_id, client_state } = payload;

    // Check if this is an agent answering a queue call or PSTN answering outbound call - need to bridge
    const pendingBridge = pendingBridges.get(call_control_id);
    if (pendingBridge) {
      // Check if this is an outbound PSTN call being answered
      if (pendingBridge.isOutboundPstn) {
        console.log(`[CallControl] PSTN ${pendingBridge.destinationNumber} answered! Bridging with WebRTC leg ${pendingBridge.callerCallControlId}`);
        pendingBridges.delete(call_control_id);
        
        try {
          // Bridge the WebRTC leg with the PSTN leg
          await this.makeCallControlRequest(pendingBridge.callerCallControlId, "bridge", {
            call_control_id: call_control_id,
            client_state: "",
          });
          console.log(`[CallControl] Successfully bridged WebRTC with PSTN`);
          
          // Notify frontend that PSTN answered - this is when the timer should start
          extensionCallService.broadcastToCompany(pendingBridge.companyId, {
            type: "outbound_call_answered",
            webrtcCallControlId: pendingBridge.callerCallControlId,
            pstnCallControlId: call_control_id,
            destinationNumber: pendingBridge.destinationNumber,
          });
          console.log(`[CallControl] Notified frontend that PSTN answered`);
        } catch (bridgeError) {
          console.error(`[CallControl] Failed to bridge outbound call:`, bridgeError);
          try {
            await this.hangupCall(call_control_id, "NORMAL_CLEARING");
            await this.hangupCall(pendingBridge.callerCallControlId, "NORMAL_CLEARING");
          } catch (e) { /* ignore */ }
        }
        return;
      }
      
      // For blind transfers, Telnyx handles the bridge automatically - don't do manual bridge
      if (pendingBridge.isBlindTransfer) {
        console.log(`[CallControl] Blind transfer answered - Telnyx handles bridge automatically, no manual bridge needed`);
        const pstnCallControlId = pendingBridge.callerCallControlId;
        const callerNumber = pendingBridge.callerNumber;
        
        // Update the call log with the correct PSTN call_control_id for recording
        // The call log was created by the WebRTC frontend with the SDK's internal ID
        // We need to update it with the PSTN leg's call_control_id for Call Control API operations
        if (callerNumber && pstnCallControlId) {
          const normalizedCaller = callerNumber.replace(/\D/g, '');
          console.log(`[CallControl] Updating call log for caller ${normalizedCaller} with PSTN call_control_id: ${pstnCallControlId}`);
          
          try {
            // Find the most recent call log for this caller number (created by WebRTC frontend)
            const recentCallLogs = await db
              .select()
              .from(callLogs)
              .where(and(
                eq(callLogs.companyId, pendingBridge.companyId),
                eq(callLogs.direction, 'inbound'),
                or(
                  sql`${callLogs.fromNumber} LIKE ${'%' + normalizedCaller}`,
                  sql`${callLogs.fromNumber} LIKE ${'+' + normalizedCaller}`,
                  eq(callLogs.fromNumber, normalizedCaller)
                )
              ))
              .orderBy(desc(callLogs.createdAt))
              .limit(1);
            
            if (recentCallLogs.length > 0) {
              const callLog = recentCallLogs[0];
              // Update the call log with the PSTN call_control_id
              await db
                .update(callLogs)
                .set({ 
                  telnyxCallId: pstnCallControlId,
                  telnyxSessionId: pstnCallControlId // Also store as session ID for backup
                })
                .where(eq(callLogs.id, callLog.id));
              console.log(`[CallControl] Updated call log ${callLog.id} with PSTN call_control_id for recording support`);
            } else {
              console.log(`[CallControl] No call log found for caller ${normalizedCaller} to update`);
            }
          } catch (updateError) {
            console.error(`[CallControl] Failed to update call log with PSTN call_control_id:`, updateError);
          }
        }
        
        pendingBridges.delete(call_control_id);
        return;
      }

      console.log(`[CallControl] Agent answered! Bridging with caller ${pendingBridge.callerCallControlId}`);
      pendingBridges.delete(call_control_id);

      // Stop hold music/ads for the caller since agent answered
      await stopHoldPlayback(pendingBridge.callerCallControlId);

      // Cancel all other ring-all legs for this caller (this agent won the race)
      const otherLegs = ringAllLegs.get(pendingBridge.callerCallControlId);
      if (otherLegs) {
        console.log(`[CallControl] Cancelling ${otherLegs.size - 1} other ring-all legs`);
        for (const otherLegId of Array.from(otherLegs)) {
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
        // For direct calls (IVR disabled), the caller was already answered before Dial
        // For queue calls, the caller needs to be answered now
        if (!pendingBridge.isDirectCall) {
          // CRITICAL: Answer the caller's call FIRST (it was in ringing state until agent answered)
          // This is when billing starts - only after an agent actually picks up
          console.log(`[CallControl] Answering caller ${pendingBridge.callerCallControlId} now that agent answered`);
          await this.answerCall(pendingBridge.callerCallControlId);
          
          // Small delay to ensure answer is processed before bridge
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          console.log(`[CallControl] Direct call - caller already answered, proceeding to bridge`);
        }
        
        // Bridge the caller with the agent
        await this.makeCallControlRequest(pendingBridge.callerCallControlId, "bridge", {
          call_control_id: call_control_id,
          client_state: pendingBridge.clientState,
        });
        console.log(`[CallControl] Successfully bridged caller with agent`);
      } catch (bridgeError) {
        console.error(`[CallControl] Failed to answer/bridge calls:`, bridgeError);
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

        // Handle direct ring-through: agent answered, bridge with caller
        if (state.directCallRingThrough && state.callerCallControlId) {
          console.log(`[CallControl] Agent answered ring-through call! Bridging with caller ${state.callerCallControlId}`);
          
          try {
            // STEP 1: Answer the caller leg (it was unanswered, just ringing)
            // Per Telnyx docs: "answer the original leg before bridging"
            console.log(`[CallControl] Answering caller leg ${state.callerCallControlId} (billing starts now)`);
            await this.answerCall(state.callerCallControlId);
            
            // Small delay to ensure answer is processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // STEP 2: Bridge caller with agent
            console.log(`[CallControl] Bridging caller ${state.callerCallControlId} with agent ${call_control_id}`);
            await this.makeCallControlRequest(state.callerCallControlId, "bridge", {
              call_control_id: call_control_id,
              client_state: "",
            });
            console.log(`[CallControl] Successfully bridged ring-through call`);
            
            // Clean up pending bridge
            pendingBridges.delete(state.callerCallControlId);
            
          } catch (bridgeError) {
            console.error(`[CallControl] Failed to bridge ring-through call:`, bridgeError);
            try {
              await this.hangupCall(call_control_id, "NORMAL_CLEARING");
            } catch (e) { /* ignore */ }
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
    const { call_control_id, hangup_cause, client_state, from } = payload;
    console.log(`[CallControl] Call hangup, cause: ${hangup_cause}`);

    await pbxService.removeActiveCall(call_control_id);

    // Stop hold music/ads if caller was in queue
    await stopHoldPlayback(call_control_id);

    // End any queue call notifications for this call
    extensionCallService.endQueueCall(call_control_id, "caller_hangup");

    // Clean up call context and active inbound calls map
    const context = callContextMap.get(call_control_id);
    if (context?.callerNumber) {
      removeActiveInboundCall(context.callerNumber, context.companyId);
    } else if (from) {
      // Fallback: try to remove by from number (may match multiple companies, but cleanup is best-effort)
      const entries = Array.from(activeInboundCalls.entries());
      for (const [key, value] of entries) {
        if (value.callControlId === call_control_id) {
          activeInboundCalls.delete(key);
          console.log(`[ActiveCalls] Removed by call_control_id: ${call_control_id}`);
          break;
        }
      }
    }
    callContextMap.delete(call_control_id);

    // Clean up ring-all legs if caller hangs up during ringing
    const ringAllForCaller = ringAllLegs.get(call_control_id);
    if (ringAllForCaller) {
      console.log(`[CallControl] Caller ${call_control_id} hung up, cancelling ${ringAllForCaller.size} ring-all legs`);
      for (const agentLegId of Array.from(ringAllForCaller)) {
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
          
          // Retry queue dial if we have the queueId, otherwise route to voicemail for direct calls
          if (pendingBridge.queueId) {
            // Small delay before retrying to avoid hammering agents
            setTimeout(() => {
              this.retryQueueDial(pendingBridge.callerCallControlId, pendingBridge.companyId, pendingBridge.queueId!);
            }, 3000); // 3 second delay before retry
          } else if (pendingBridge.isDirectCall || pendingBridge.isDirectRingThrough) {
            // Direct call timeout - route to voicemail with custom greeting
            console.log(`[CallControl] Direct call timeout, routing caller ${pendingBridge.callerCallControlId} to voicemail`);
            // Answer the call first (it was unanswered during ring-through), then route to voicemail
            this.answerCall(pendingBridge.callerCallControlId).then(() => {
              // Route directly to voicemail - it will play the custom greeting
              this.routeToVoicemail(pendingBridge.callerCallControlId, pendingBridge.companyId);
            }).catch((err) => {
              console.error(`[CallControl] Error routing to voicemail after timeout:`, err);
            });
          } else {
            console.log(`[CallControl] No queueId in pendingBridge, caller stays on hold`);
          }
        }
      } else if (pendingBridge.isDirectCall || pendingBridge.isDirectRingThrough || pendingBridge.isBlindTransfer) {
        // Direct call with single agent leg (no ringAllLegs) - route to voicemail on timeout
        console.log(`[CallControl] Direct call/transfer timeout, routing caller ${pendingBridge.callerCallControlId} to voicemail`);
        this.answerCall(pendingBridge.callerCallControlId).then(() => {
          // Route directly to voicemail - it will play the custom greeting
          this.routeToVoicemail(pendingBridge.callerCallControlId, pendingBridge.companyId);
        }).catch((err) => {
          console.error(`[CallControl] Error routing to voicemail after timeout:`, err);
        });
      }
    }

    // Handle blind transfer timeout - the transfer leg hung up but caller may still be active
    // When transfer times out, we receive call.hangup with the client_state we passed
    if (client_state && hangup_cause === "timeout") {
      try {
        const state = JSON.parse(Buffer.from(client_state, "base64").toString());
        if (state.blindTransferToVoicemail && state.callerCallControlId) {
          console.log(`[CallControl] Blind transfer timeout detected, routing caller ${state.callerCallControlId} to voicemail`);
          // Clean up the pending bridge for this caller
          pendingBridges.delete(state.callerCallControlId);
          
          // Answer the original caller leg and route to voicemail
          this.answerCall(state.callerCallControlId).then(() => {
            this.routeToVoicemail(state.callerCallControlId, state.companyId);
          }).catch((err) => {
            console.error(`[CallControl] Error routing to voicemail after blind transfer timeout:`, err);
          });
        }
      } catch (e) {
        // Ignore parse errors
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

      // Get IVR language for queue calls
      let ivrLanguage: string | undefined;
      if (ivrId) {
        const ivr = await pbxService.getIvr(companyId, ivrId);
        if (ivr?.language) {
          ivrLanguage = ivr.language;
        }
      }
      
      await this.handleMenuOption(call_control_id, companyId, selectedOption, ivrLanguage);
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
    const { call_control_id, recording_urls, recording_started_at, recording_ended_at } = payload as any;
    console.log(`[CallControl] Recording saved for call ${call_control_id}:`, recording_urls);
    
    if (!call_control_id || !recording_urls) {
      console.log(`[CallControl] Missing call_control_id or recording_urls`);
      return;
    }
    
    // Get the MP3 URL (preferred) or WAV URL
    const recordingUrl = recording_urls.mp3 || recording_urls.wav;
    if (!recordingUrl) {
      console.log(`[CallControl] No recording URL found in payload`);
      return;
    }
    
    // Calculate recording duration from timestamps
    let recordingDurationSeconds = 0;
    if (recording_started_at && recording_ended_at) {
      const startTime = new Date(recording_started_at).getTime();
      const endTime = new Date(recording_ended_at).getTime();
      recordingDurationSeconds = Math.ceil((endTime - startTime) / 1000);
      console.log(`[CallControl] Recording duration: ${recordingDurationSeconds}s (from ${recording_started_at} to ${recording_ended_at})`);
    }
    
    try {
      // Find the call log by telnyxCallId
      const [callLog] = await db
        .select()
        .from(callLogs)
        .where(eq(callLogs.telnyxCallId, call_control_id));
      
      if (!callLog) {
        console.log(`[CallControl] No call log found for call_control_id: ${call_control_id}`);
        return;
      }
      
      // Update the call log with the recording URL AND duration
      await db
        .update(callLogs)
        .set({ 
          recordingUrl,
          recordingDuration: recordingDurationSeconds > 0 ? recordingDurationSeconds : null
        })
        .where(eq(callLogs.id, callLog.id));
      
      console.log(`[CallControl] Updated recording URL and duration (${recordingDurationSeconds}s) for call ${callLog.id}`);
    } catch (error) {
      console.error(`[CallControl] Failed to save recording URL:`, error);
    }
  }

  private async handleMenuOption(
    callControlId: string,
    companyId: string,
    option: any,
    ivrLanguage?: string
  ): Promise<void> {
    switch (option.actionType) {
      case "queue":
        if (option.targetQueueId) {
          await this.routeToQueue(callControlId, companyId, option.targetQueueId, ivrLanguage);
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
  private async routeToQueue(callControlId: string, companyId: string, queueId: string, ivrLanguage?: string): Promise<void> {
    console.log(`[CallControl] Routing call to queue: ${queueId} using Ring-All strategy${ivrLanguage ? `, IVR language: ${ivrLanguage}` : ''}`);

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

    // Get Call Control App ID and SIP Domain - REQUIRED for outbound calls via Call Control API
    // The connection_id in POST /calls MUST be a Call Control App ID, NOT a Credential Connection
    const [settings] = await db
      .select({ 
        callControlAppId: telephonySettings.callControlAppId,
        sipDomain: telephonySettings.sipDomain
      })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    const connectionId = settings?.callControlAppId;
    const sipDomain = settings?.sipDomain || "sip.telnyx.com";

    if (!connectionId) {
      console.error(`[CallControl] No Call Control App ID for company ${companyId} - cannot dial agents`);
      await this.speakText(callControlId, "System error. Please try again later.");
      await this.hangupCall(callControlId, "NORMAL_CLEARING");
      return;
    }
    console.log(`[CallControl] Using Call Control App ID: ${connectionId}, SIP Domain: ${sipDomain} for dialing agents`);

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }

    // Initialize ring-all tracking for this caller
    ringAllLegs.set(callControlId, new Set());

    let successfulDials = 0;

    // Dial all agents simultaneously
    for (const member of activeMembers) {
      if (!member.userId) continue;

      // Check agent availability status - skip if busy or offline
      const [agentUser] = await db
        .select({ agentAvailabilityStatus: users.agentAvailabilityStatus })
        .from(users)
        .where(eq(users.id, member.userId));
      
      if (agentUser && (agentUser.agentAvailabilityStatus === "busy" || agentUser.agentAvailabilityStatus === "offline")) {
        console.log(`[CallControl] Agent ${member.userId} is ${agentUser.agentAvailabilityStatus}, skipping`);
        continue;
      }

      // Get agent's extension SIP credentials (what WebPhone registers with)
      const [extension] = await db
        .select({
          sipUsername: pbxExtensions.sipUsername,
          extension: pbxExtensions.extension,
          credentialConnectionId: pbxExtensions.telnyxCredentialConnectionId
        })
        .from(pbxExtensions)
        .where(
          and(
            eq(pbxExtensions.companyId, companyId),
            eq(pbxExtensions.userId, member.userId),
            eq(pbxExtensions.isActive, true)
          )
        );
      
      if (!extension?.sipUsername) {
        console.log(`[CallControl] Agent ${member.userId} has no extension SIP credentials, skipping`);
        continue;
      }

      // For Call Control API dial, MUST use Call Control App ID as connection_id
      // The SIP URI must use sip.telnyx.com (not company subdomain) for Call Control routing
      const sipUri = `sip:${extension.sipUsername}@sip.telnyx.com`;
      console.log(`[CallControl] Dialing agent extension ${extension.extension} SIP: ${sipUri} via Call Control App: ${connectionId}`);

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
              { name: "X-Queue-Name", value: queue.name },
              ...(ivrLanguage ? [{ name: "X-IVR-Language", value: ivrLanguage }] : [])
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
          callContextMap.set(agentCallControlId, { companyId, managedAccountId: managedAccountId ?? null });
          
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
    
    // Get SIP domain for the company
    const [sipSettings] = await db
      .select({ sipDomain: telephonySettings.sipDomain })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    const sipDomain = sipSettings?.sipDomain || "sip.telnyx.com";
    
    if (sipCreds?.sipUsername) {
      // Dial the agent's personal SIP URI
      const sipUri = `sip:${sipCreds.sipUsername}@${sipDomain}`;
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

    // Get Call Control App ID - REQUIRED for Dial API (Telnyx only accepts Call Control App IDs)
    // The SIP Forking happens automatically when the SIP URI is registered on a Credential Connection
    // with simultaneous_ringing: "enabled" - Telnyx routes the call through that connection
    const [settings] = await db
      .select({ 
        callControlAppId: telephonySettings.callControlAppId,
        credentialConnectionId: telephonySettings.credentialConnectionId 
      })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    const connectionId = settings?.callControlAppId;

    if (!connectionId) {
      throw new Error("No Call Control App ID found for company - cannot create outbound call");
    }
    
    console.log(`[CallControl] Using Call Control App ID: ${connectionId} for dial to SIP URI: ${sipUri}`);
    console.log(`[CallControl] SIP Forking configured on Credential Connection: ${settings?.credentialConnectionId}`)

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }

    // Create outbound call to the agent's SIP endpoint
    // connection_id = Call Control App ID (required by Dial API)
    // SIP Forking happens automatically because the SIP URI is registered on the Credential Connection
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
    callContextMap.set(agentCallControlId, { companyId, managedAccountId: managedAccountId ?? null });
    
    // Store pending bridge info - will be processed when agent answers (call.answered event)
    pendingBridges.set(agentCallControlId, {
      callerCallControlId: callControlId,
      clientState,
      companyId,
    });

    console.log(`[CallControl] Waiting for agent to answer call ${agentCallControlId}, will bridge with ${callControlId}`);
  }

  /**
   * Dial outbound to PSTN number and bridge with WebRTC leg
   * Used for outbound WebRTC calls - the WebRTC leg is answered first, then we dial PSTN
   */
  private async dialOutboundPSTN(
    webrtcCallControlId: string,
    destinationNumber: string,
    callerIdNumber: string,
    companyId: string,
    managedAccountId: string | null
  ): Promise<void> {
    console.log(`[CallControl] Dialing outbound PSTN: ${destinationNumber} for bridging with WebRTC leg ${webrtcCallControlId}`);

    const apiKey = await getTelnyxApiKey();

    // Get Call Control App ID and Caller ID Name for the outbound leg
    const [settings] = await db
      .select({ 
        callControlAppId: telephonySettings.callControlAppId
      })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));

    // Get Caller ID Name from the phone number
    const [phoneNumberRecord] = await db
      .select({ callerIdName: telnyxPhoneNumbers.callerIdName })
      .from(telnyxPhoneNumbers)
      .where(eq(telnyxPhoneNumbers.phoneNumber, callerIdNumber))
      .limit(1);
    
    const callerIdName = phoneNumberRecord?.callerIdName || undefined;
    console.log(`[CallControl] Using Caller ID: ${callerIdNumber}, Name: ${callerIdName || 'not set'}`);

    const connectionId = settings?.callControlAppId;

    if (!connectionId) {
      console.error(`[CallControl] No Call Control App ID found for company ${companyId}`);
      await this.hangupCall(webrtcCallControlId, "NORMAL_CLEARING");
      return;
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }

    // Build request body with optional caller_id_name
    const requestBody: Record<string, unknown> = {
      connection_id: connectionId,
      to: destinationNumber,
      from: callerIdNumber,
      timeout_secs: 60,
      answering_machine_detection: "disabled",
    };
    
    if (callerIdName) {
      requestBody.from_display_name = callerIdName;
    }

    // Create outbound call to PSTN number
    const response = await fetch(`${TELNYX_API_BASE}/calls`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CallControl] Failed to dial PSTN: ${response.status} - ${errorText}`);
      await this.hangupCall(webrtcCallControlId, "NORMAL_CLEARING");
      return;
    }

    const data = await response.json();
    const pstnCallControlId = data.data?.call_control_id;

    if (!pstnCallControlId) {
      console.error(`[CallControl] No call_control_id returned from PSTN dial`);
      await this.hangupCall(webrtcCallControlId, "NORMAL_CLEARING");
      return;
    }

    console.log(`[CallControl] Created outbound PSTN call: ${pstnCallControlId}`);

    // Store context for the PSTN leg
    callContextMap.set(pstnCallControlId, { companyId, managedAccountId });
    
    // Store pending bridge info - will bridge when PSTN leg answers
    pendingBridges.set(pstnCallControlId, {
      callerCallControlId: webrtcCallControlId,
      clientState: "",
      companyId,
      isOutboundPstn: true,
      destinationNumber,
    });

    console.log(`[CallControl] Waiting for PSTN ${destinationNumber} to answer, will bridge with WebRTC leg ${webrtcCallControlId}`);
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

    // Get Call Control App ID and SIP Domain - REQUIRED for outbound calls via Call Control API
    const [settings] = await db
      .select({ 
        callControlAppId: telephonySettings.callControlAppId,
        sipDomain: telephonySettings.sipDomain
      })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    const connectionId = settings?.callControlAppId;
    const sipDomain = settings?.sipDomain || "sip.telnyx.com";

    if (!connectionId) {
      console.error(`[CallControl] No Call Control App ID for retry - cannot dial agents`);
      return;
    }
    console.log(`[CallControl] Retry: Using Call Control App ID: ${connectionId}, SIP Domain: ${sipDomain}`);

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
      headers["X-Managed-Account-Id"] = managedAccountId;
    }

    // Initialize ring-all tracking
    ringAllLegs.set(callControlId, new Set());
    let successfulDials = 0;

    for (const member of activeMembers) {
      if (!member.userId) continue;

      // Check agent availability status - skip if busy or offline
      const [agentUserRetry] = await db
        .select({ agentAvailabilityStatus: users.agentAvailabilityStatus })
        .from(users)
        .where(eq(users.id, member.userId));
      
      if (agentUserRetry && (agentUserRetry.agentAvailabilityStatus === "busy" || agentUserRetry.agentAvailabilityStatus === "offline")) {
        console.log(`[CallControl] Retry: Agent ${member.userId} is ${agentUserRetry.agentAvailabilityStatus}, skipping`);
        continue;
      }

      // Get agent's extension SIP credentials (what WebPhone registers with)
      const [extension] = await db
        .select({
          sipUsername: pbxExtensions.sipUsername,
          extension: pbxExtensions.extension,
          credentialConnectionId: pbxExtensions.telnyxCredentialConnectionId
        })
        .from(pbxExtensions)
        .where(
          and(
            eq(pbxExtensions.companyId, companyId),
            eq(pbxExtensions.userId, member.userId),
            eq(pbxExtensions.isActive, true)
          )
        );
      
      if (!extension?.sipUsername) continue;

      // For Call Control API dial, MUST use Call Control App ID as connection_id
      // The SIP URI must use sip.telnyx.com (not company subdomain) for Call Control routing
      const sipUri = `sip:${extension.sipUsername}@sip.telnyx.com`;
      console.log(`[CallControl] Retry: Dialing agent extension ${extension.extension} SIP: ${sipUri} via Call Control App: ${connectionId}`);

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
            callContextMap.set(agentCallControlId, { companyId, managedAccountId: managedAccountId ?? null });
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
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    // Get the agent's SIP credentials
    const sipCreds = await getUserSipCredentials(extData.userId);
    
    if (!sipCreds?.sipUsername) {
      console.log(`[CallControl] User ${extData.userId} has no SIP credentials, routing to voicemail`);
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    const activeCall = await pbxService.getActiveCall(callControlId);
    const callerNumber = activeCall?.fromNumber || callContextMap.get(callControlId)?.callerNumber || "Unknown";

    // Get SIP domain for the company
    const [sipSettings] = await db
      .select({ sipDomain: telephonySettings.sipDomain })
      .from(telephonySettings)
      .where(eq(telephonySettings.companyId, companyId));
    const sipDomain = sipSettings?.sipDomain || "sip.telnyx.com";

    // Create client state for the bridged call
    const clientState = Buffer.from(JSON.stringify({
      companyId,
      agentUserId: extData.userId,
      extensionId,
      directCall: true,
      originalCallControlId: callControlId,
    })).toString("base64");

    // Dial the agent's SIP URI directly
    const sipUri = `sip:${sipCreds.sipUsername}@${sipDomain}`;
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
      await this.routeToVoicemail(callControlId, companyId);
    }
  }

  private async routeToVoicemail(callControlId: string, companyId: string): Promise<void> {
    console.log(`[CallControl] Routing to voicemail for company: ${companyId}`);

    // Get global voicemail greeting from Super Admin settings
    // Try English first, then Spanish as fallback
    const voicemailGreetings = await db.select()
      .from(recordingAnnouncementMedia)
      .where(
        and(
          eq(recordingAnnouncementMedia.type, "voicemail"),
          eq(recordingAnnouncementMedia.isActive, true)
        )
      );

    // Prefer English, fallback to Spanish, then TTS
    const englishGreeting = voicemailGreetings.find(g => g.language === "en");
    const spanishGreeting = voicemailGreetings.find(g => g.language === "es");
    const greetingToUse = englishGreeting || spanishGreeting;

    if (greetingToUse?.audioUrl) {
      console.log(`[CallControl] Playing global voicemail greeting: ${greetingToUse.audioUrl}`);
      await this.playAudio(callControlId, greetingToUse.audioUrl);
    } else {
      console.log(`[CallControl] No global voicemail greeting found, using TTS`);
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
    const callerNumber = activeCall?.fromNumber || "Unknown";

    // Use WebSocket to notify available agents
    const result = extensionCallService.startQueueCall(
      callControlId,
      companyId,
      "default-agent",
      callerNumber,
      30
    );

    if (!result.success || result.notifiedCount === 0) {
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
      await this.routeToVoicemail(callControlId, phoneNumber.companyId);
      return;
    }

    const companyId = phoneNumber.companyId;
    const activeCall = await pbxService.getActiveCall(callControlId);
    const callerNumber = activeCall?.fromNumber || callContextMap.get(callControlId)?.callerNumber || "Unknown";

    // Get the assigned user's extension
    const extension = await pbxService.getExtensionByUserId(companyId, phoneNumber.ownerUserId);
    if (!extension) {
      console.log(`[CallControl] Assigned user has no extension, trying direct SIP dial`);
      
      // Get the assigned user's SIP credentials directly
      const sipCreds = await getUserSipCredentials(phoneNumber.ownerUserId);
      
      if (!sipCreds?.sipUsername) {
        console.log(`[CallControl] User ${phoneNumber.ownerUserId} has no SIP credentials, routing to voicemail`);
        await this.routeToVoicemail(callControlId, companyId);
        return;
      }

      // Get SIP domain for the company
      const [sipSettings] = await db
        .select({ sipDomain: telephonySettings.sipDomain })
        .from(telephonySettings)
        .where(eq(telephonySettings.companyId, companyId));
      const sipDomain = sipSettings?.sipDomain || "sip.telnyx.com";

      // Create client state for the bridged call
      const clientState = Buffer.from(JSON.stringify({
        companyId,
        agentUserId: phoneNumber.ownerUserId,
        directCall: true,
        originalCallControlId: callControlId,
      })).toString("base64");

      // Dial the agent's SIP URI directly
      const sipUri = `sip:${sipCreds.sipUsername}@${sipDomain}`;
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
        await this.routeToVoicemail(callControlId, companyId);
      }
      return;
    }

    console.log(`[CallControl] Found extension ${extension.extensionNumber} for assigned user, routing call`);
    
    // Route to the extension
    await this.routeToExtension(callControlId, companyId, extension.id);
  }

  /**
   * Transfer call to assigned user using blind transfer (no answer required)
   * 
   * Per Telnyx documentation: The transfer command performs a BLIND TRANSFER
   * without requiring the answer command first. This means:
   * - Caller continues to hear ringback (billing hasn't started)
   * - Agent's phone rings with correct caller ID
   * - If agent answers: call is bridged, billing starts
   * - If agent doesn't answer (timeout): original call remains active,
   *   we then answer and route to voicemail
   */
  private async transferToAssignedUser(
    callControlId: string,
    phoneNumber: any,
    callerNumber?: string
  ): Promise<void> {
    const companyId = phoneNumber.companyId;
    console.log(`[CallControl] Blind transfer to assigned user (no answer first), caller: ${callerNumber}`);

    if (!phoneNumber.ownerUserId) {
      console.log(`[CallControl] No assigned user, cannot transfer`);
      await this.answerCall(callControlId);
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    // Get extension with SIP credentials from PBX extensions table
    const extension = await pbxService.getExtensionByUserId(companyId, phoneNumber.ownerUserId);
    
    if (!extension?.sipUsername) {
      console.log(`[CallControl] User ${phoneNumber.ownerUserId} has no extension with SIP credentials`);
      await this.answerCall(callControlId);
      await this.routeToVoicemail(callControlId, companyId);
      return;
    }

    const sipUri = `sip:${extension.sipUsername}@sip.telnyx.com`;
    const ringTimeout = extension.ringTimeout || 25;
    
    console.log(`[CallControl] Blind transferring to agent SIP: ${sipUri} with timeout: ${ringTimeout}s`);
    console.log(`[CallControl] Caller ${callerNumber} will continue to hear ringback (NOT answered yet)`);

    // Store pending transfer info for handling timeout/voicemail
    const clientState = Buffer.from(JSON.stringify({
      companyId,
      callerCallControlId: callControlId,
      agentUserId: phoneNumber.ownerUserId,
      callerNumber: callerNumber || "",
      blindTransferToVoicemail: true,
    })).toString("base64");

    try {
      // BLIND TRANSFER - does NOT answer the call first
      // Per Telnyx docs: "No answer required: You can transfer an incoming call 
      // immediately without calling the answer command first"
      // The caller ID passed to "from" will show on the agent's phone
      await this.makeCallControlRequest(callControlId, "transfer", {
        to: sipUri,
        from: callerNumber || phoneNumber.phoneNumber, // Show caller's number to agent
        timeout_secs: ringTimeout,
        client_state: clientState,
      });
      
      console.log(`[CallControl] Blind transfer initiated - agent phone should ring with caller ID: ${callerNumber}`);
      
      // Store pending transfer for voicemail fallback on timeout
      pendingBridges.set(callControlId, {
        callerCallControlId: callControlId,
        companyId,
        agentUserId: phoneNumber.ownerUserId,
        callerNumber: callerNumber || "",
        isBlindTransfer: true,
        sipUri,
      });
      
      await pbxService.trackActiveCall(companyId, callControlId, callerNumber || "", sipUri, "ringing", {
        agentUserId: phoneNumber.ownerUserId,
        agentSipUri: sipUri,
      });
      
    } catch (error) {
      console.error(`[CallControl] Blind transfer failed:`, error);
      // If transfer fails, answer and route to voicemail
      await this.answerCall(callControlId);
      await this.routeToVoicemail(callControlId, companyId);
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
      if (managedAccountId && managedAccountId !== "MASTER_ACCOUNT") {
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

  /**
   * Reject an incoming call and send the caller to voicemail
   * This is called when an agent rejects a call instead of just hanging up
   * 
   * @param agentLegId - The call leg ID from the WebPhone (SDK UUID)
   * @param companyId - The company ID
   * @param callerNumber - Optional: the caller's phone number for fallback lookup
   */
  public async rejectCallToVoicemail(
    agentLegId: string, 
    companyId: string,
    callerNumber?: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[CallControl] Agent rejecting call ${agentLegId}, routing caller to voicemail`);
    console.log(`[CallControl] Current pendingBridges keys:`, Array.from(pendingBridges.keys()));
    console.log(`[CallControl] Caller number for fallback lookup: ${callerNumber || 'not provided'}`);
    
    try {
      // Find the pending bridge for this agent leg
      let pendingBridge = pendingBridges.get(agentLegId);
      
      if (pendingBridge) {
        const callerCallControlId = pendingBridge.callerCallControlId;
        console.log(`[CallControl] Found caller leg ${callerCallControlId} for agent leg ${agentLegId}`);
        
        // Remove this pending bridge
        pendingBridges.delete(agentLegId);
        
        // If ring-all is active, cancel other agent legs
        const otherLegs = ringAllLegs.get(callerCallControlId);
        if (otherLegs) {
          const otherLegsArray = Array.from(otherLegs);
          for (const otherLegId of otherLegsArray) {
            if (otherLegId !== agentLegId) {
              pendingBridges.delete(otherLegId);
              try {
                await this.hangupCall(otherLegId, "NORMAL_CLEARING");
              } catch (e) {
                // Ignore errors from already-ended calls
              }
            }
          }
          ringAllLegs.delete(callerCallControlId);
        }
        
        // Stop any hold music
        await stopHoldPlayback(callerCallControlId);
        
        // Answer the caller if not already answered
        try {
          await this.answerCall(callerCallControlId);
        } catch (e) {
          // Might already be answered
        }
        
        // Route to voicemail (greeting is inside routeToVoicemail)
        await this.routeToVoicemail(callerCallControlId, pendingBridge.companyId);
        
        // Hangup the agent leg
        try {
          await this.hangupCall(agentLegId, "NORMAL_CLEARING");
        } catch (e) {
          // Ignore
        }
        
        console.log(`[CallControl] Caller ${callerCallControlId} routed to voicemail`);
        return { success: true };
      }
      
      // No pending bridge found - try to find by searching all pending bridges
      const bridgeEntries = Array.from(pendingBridges.entries());
      for (const [legId, bridge] of bridgeEntries) {
        if (bridge.callerCallControlId === agentLegId) {
          // The agentLegId is actually the caller leg, reject directly
          console.log(`[CallControl] Agent leg ${agentLegId} is the caller, routing directly to voicemail`);
          pendingBridges.delete(legId);
          await this.routeToVoicemail(agentLegId, bridge.companyId);
          return { success: true };
        }
      }
      
      // NEW: Try to find by caller number using activeInboundCalls map
      // This is used when the WebPhone SDK provides an internal UUID instead of the real call_control_id
      if (callerNumber) {
        const activeCall = getActiveInboundCall(callerNumber, companyId);
        if (activeCall) {
          console.log(`[CallControl] Found active call by caller number ${callerNumber}: ${activeCall.callControlId}`);
          
          // Remove from active calls map
          removeActiveInboundCall(callerNumber, companyId);
          
          // Answer if not already answered
          try {
            await this.answerCall(activeCall.callControlId);
          } catch (e) {
            // Might already be answered
          }
          
          // Route to voicemail (greeting is inside routeToVoicemail)
          await this.routeToVoicemail(activeCall.callControlId, companyId);
          
          console.log(`[CallControl] Caller routed to voicemail via number lookup`);
          return { success: true };
        }
      }
      
      // Fallback: try the SDK-provided ID anyway (might work for some call flows)
      console.log(`[CallControl] No pending bridge or active call found, attempting direct voicemail route for ${agentLegId}`);
      try {
        await this.routeToVoicemail(agentLegId, companyId);
        return { success: true };
      } catch (error: any) {
        console.error(`[CallControl] Direct voicemail route failed:`, error);
        return { success: false, error: "Could not find active call to reject. The call may have already ended." };
      }
      
    } catch (error: any) {
      console.error(`[CallControl] Error rejecting to voicemail:`, error);
      return { success: false, error: error.message || "Failed to route to voicemail" };
    }
  }
}

export const callControlWebhookService = new CallControlWebhookService();
