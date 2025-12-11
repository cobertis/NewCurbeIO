// ============================================================================
//  TELNYX WEBRTC – CURBE VOICE
//  Usando el patrón real del SDK de Telnyx (notification-based, no call.on)
// ============================================================================

import { TelnyxRTC } from "@telnyx/webrtc";
import { create } from "zustand";

type TelnyxCall = ReturnType<TelnyxRTC["newCall"]>;

// ============================================================================
// CRITICAL: Audio elements must be created OUTSIDE of React to avoid
// React Fiber references that cause "circular structure to JSON" errors
// when the Telnyx SDK tries to serialize call data.
// 
// Per Telnyx docs: client.remoteElement accepts a string ID, and the SDK
// will use document.getElementById internally. By creating the element
// programmatically (not via JSX), we avoid React's __reactFiber$ properties.
// ============================================================================
const TELNYX_REMOTE_AUDIO_ID = "telnyx-remote-audio";
const TELNYX_LOCAL_AUDIO_ID = "telnyx-local-audio";
const TELNYX_MEDIA_ROOT_ID = "telnyx-media-root";

/**
 * Creates audio elements programmatically outside of React.
 * This is required because React-rendered elements have __reactFiber$ properties
 * that cause circular JSON serialization errors in the Telnyx SDK.
 */
function ensureTelnyxAudioElements(): { remote: HTMLAudioElement; local: HTMLAudioElement } {
  // Check if elements already exist
  let remote = document.getElementById(TELNYX_REMOTE_AUDIO_ID) as HTMLAudioElement | null;
  let local = document.getElementById(TELNYX_LOCAL_AUDIO_ID) as HTMLAudioElement | null;
  
  if (remote && local) {
    return { remote, local };
  }
  
  // Create container if needed
  let container = document.getElementById(TELNYX_MEDIA_ROOT_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = TELNYX_MEDIA_ROOT_ID;
    container.style.display = "none";
    container.style.position = "absolute";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
    console.log("[Telnyx WebRTC] Created audio container:", TELNYX_MEDIA_ROOT_ID);
  }
  
  // Create remote audio element (plays caller's voice)
  if (!remote) {
    remote = document.createElement("audio");
    remote.id = TELNYX_REMOTE_AUDIO_ID;
    remote.autoplay = true;
    remote.setAttribute("playsinline", "true");
    container.appendChild(remote);
    console.log("[Telnyx WebRTC] Created remote audio element:", TELNYX_REMOTE_AUDIO_ID);
  }
  
  // Create local audio element (optional, for monitoring own voice)
  if (!local) {
    local = document.createElement("audio");
    local.id = TELNYX_LOCAL_AUDIO_ID;
    local.autoplay = true;
    local.muted = true; // Muted to prevent feedback
    local.setAttribute("playsinline", "true");
    container.appendChild(local);
    console.log("[Telnyx WebRTC] Created local audio element:", TELNYX_LOCAL_AUDIO_ID);
  }
  
  return { remote, local };
}

/**
 * Get the programmatically created remote audio element
 */
export function getTelnyxRemoteAudioElement(): HTMLAudioElement | null {
  return document.getElementById(TELNYX_REMOTE_AUDIO_ID) as HTMLAudioElement | null;
}

/**
 * Get the programmatically created local audio element
 */
export function getTelnyxLocalAudioElement(): HTMLAudioElement | null {
  return document.getElementById(TELNYX_LOCAL_AUDIO_ID) as HTMLAudioElement | null;
}

interface NetworkQualityMetrics {
  mos: number;
  jitter: number;
  packetLoss: number;
  rtt: number;
  qualityLevel: "excellent" | "good" | "poor";
}

interface TelnyxWebRTCState {
  isConnected: boolean;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  connectionError?: string;
  currentCall?: TelnyxCall;
  incomingCall?: TelnyxCall;
  outgoingCall?: TelnyxCall;
  consultCall?: TelnyxCall;
  isCallActive: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  isConsulting: boolean;
  callerIdNumber?: string;
  sipUsername?: string;
  networkQuality?: NetworkQualityMetrics;
  callDuration: number;
  callActiveTimestamp?: number;
  activeTelnyxLegId?: string;

  setConnectionStatus: (status: TelnyxWebRTCState["connectionStatus"], error?: string) => void;
  setCurrentCall: (call?: TelnyxCall) => void;
  setIncomingCall: (call?: TelnyxCall) => void;
  setOutgoingCall: (call?: TelnyxCall) => void;
  setConsultCall: (call?: TelnyxCall) => void;
  setMuted: (muted: boolean) => void;
  setOnHold: (hold: boolean) => void;
  setConsulting: (consulting: boolean) => void;
  setCallerIdNumber: (number: string) => void;
  setSipUsername: (username: string) => void;
  setNetworkQuality: (metrics?: NetworkQualityMetrics) => void;
  setCallDuration: (duration: number) => void;
  setCallActiveTimestamp: (timestamp?: number) => void;
  setActiveTelnyxLegId: (legId?: string) => void;
}

export const useTelnyxStore = create<TelnyxWebRTCState>((set) => ({
  isConnected: false,
  connectionStatus: "disconnected",
  isCallActive: false,
  isMuted: false,
  isOnHold: false,
  isConsulting: false,
  callDuration: 0,
  callActiveTimestamp: undefined,
  activeTelnyxLegId: undefined,

  setConnectionStatus: (status, error) =>
    set({
      connectionStatus: status,
      connectionError: error,
      isConnected: status === "connected",
    }),
  setCurrentCall: (call) => set({ currentCall: call, isCallActive: !!call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setOutgoingCall: (call) => set({ outgoingCall: call }),
  setConsultCall: (call) => set({ consultCall: call }),
  setMuted: (muted) => set({ isMuted: muted }),
  setOnHold: (hold) => set({ isOnHold: hold }),
  setConsulting: (consulting) => set({ isConsulting: consulting }),
  setCallerIdNumber: (number) => set({ callerIdNumber: number }),
  setSipUsername: (username) => set({ sipUsername: username }),
  setNetworkQuality: (metrics) => set({ networkQuality: metrics }),
  setCallDuration: (duration) => set({ callDuration: duration }),
  setCallActiveTimestamp: (timestamp) => set({ callActiveTimestamp: timestamp }),
  setActiveTelnyxLegId: (legId) => set({ activeTelnyxLegId: legId }),
}));

export type { NetworkQualityMetrics };

class TelnyxWebRTCManager {
  private static instance: TelnyxWebRTCManager;
  private client: TelnyxRTC | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private ringtone: HTMLAudioElement;
  private ringback: HTMLAudioElement;
  private lastCallState: string | null = null;
  private remoteStreamConnected: boolean = false;
  
  // Auto-reconnect state
  private savedCredentials: { sipUser: string; sipPass: string; callerId?: string } | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting: boolean = false;
  
  // Track outbound call initiation to prevent misidentifying as inbound
  private pendingOutboundDestination: string | null = null;

  private constructor() {
    this.ringtone = new Audio();
    this.ringtone.loop = true;
    this.ringtone.src = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
    this.ringtone.volume = 0.7;

    this.ringback = new Audio();
    this.ringback.loop = true;
    this.createRingbackTone();
  }

  private createRingbackTone(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const duration = 6;
      const bufferSize = sampleRate * duration;
      const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        if (t < 2) {
          data[i] = 0.3 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t));
        } else {
          data[i] = 0;
        }
      }

      const wavBlob = this.audioBufferToWav(buffer);
      this.ringback.src = URL.createObjectURL(wavBlob);
      audioContext.close();
    } catch (error) {
      console.error("[Telnyx WebRTC] Failed to create ringback tone:", error);
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const data = buffer.getChannelData(0);
    const samples = data.length;
    const dataSize = samples * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  public static getInstance(): TelnyxWebRTCManager {
    if (!TelnyxWebRTCManager.instance) {
      TelnyxWebRTCManager.instance = new TelnyxWebRTCManager();
    }
    return TelnyxWebRTCManager.instance;
  }

  public setAudioElement(elem: HTMLAudioElement) {
    console.log("[Telnyx WebRTC] 🔊 Audio element registered:", !!elem);
    this.audioElement = elem;
    
    // CRITICAL: Per Telnyx docs, set client.remoteElement so SDK knows where to send audio
    // Docs: https://www.npmjs.com/package/@telnyx/webrtc
    // Type: string | Function | HTMLMediaElement
    // Using Function to avoid circular JSON serialization errors with React DOM elements
    if (this.client) {
      console.log("[Telnyx WebRTC] 🔊 Setting client.remoteElement as string ID");
      this.client.remoteElement = "telnyx-remote-audio";
    }
    
    // If we already have a remoteStream waiting, connect it now
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall as any;
    if (currentCall?.remoteStream && elem && !this.remoteStreamConnected) {
      console.log("[Telnyx WebRTC] 🔊 Connecting waiting remoteStream to new audio element");
      this.connectRemoteAudio(currentCall);
    }
  }

  /**
   * Schedule an automatic reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting || !this.savedCredentials) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[Telnyx WebRTC] Max reconnect attempts reached, giving up");
      return;
    }

    this.isReconnecting = true;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds
    this.reconnectAttempts++;

    console.log(`[Telnyx WebRTC] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      this.isReconnecting = false;
      if (this.savedCredentials) {
        try {
          console.log("[Telnyx WebRTC] Attempting auto-reconnect...");
          await this.initialize(
            this.savedCredentials.sipUser,
            this.savedCredentials.sipPass,
            this.savedCredentials.callerId
          );
        } catch (error) {
          console.error("[Telnyx WebRTC] Auto-reconnect failed:", error);
          this.scheduleReconnect(); // Try again
        }
      }
    }, delay);
  }

  /**
   * Cancel any pending reconnection
   */
  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
  }

  private connectRemoteAudio(call: any, retryCount: number = 0): void {
    if (this.remoteStreamConnected) return;
    
    if (!this.audioElement) {
      console.warn("[Telnyx WebRTC] 🔊 No audio element, retry in 100ms (attempt", retryCount + 1, ")");
      if (retryCount < 10) {
        setTimeout(() => this.connectRemoteAudio(call, retryCount + 1), 100);
      }
      return;
    }
    
    if (!call?.remoteStream) {
      console.warn("[Telnyx WebRTC] 🔊 No remoteStream available");
      return;
    }

    const stream = call.remoteStream as MediaStream;
    const audioTracks = stream.getAudioTracks();
    
    console.log("[Telnyx WebRTC] 🔊 Connecting remoteStream, audio tracks:", audioTracks.length);
    
    // Set up the audio element immediately
    this.audioElement.srcObject = stream;
    this.audioElement.muted = false;
    this.audioElement.volume = 1.0;
    
    // Listen for track unmute - this is when audio actually starts flowing
    audioTracks.forEach((track, idx) => {
      console.log(`[Telnyx WebRTC] 🔊 Track ${idx}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
      
      if (!track.muted) {
        // Track already unmuted, play immediately
        this.tryPlayAudio(retryCount);
      } else {
        // Wait for unmute event
        track.onunmute = () => {
          console.log(`[Telnyx WebRTC] 🔊 Track ${idx} unmuted - attempting playback`);
          this.tryPlayAudio(0);
        };
      }
    });
    
    // Also try playing immediately in case tracks report wrong muted state
    this.tryPlayAudio(retryCount);
  }
  
  private tryPlayAudio(retryCount: number): void {
    if (this.remoteStreamConnected || !this.audioElement) return;
    
    const playPromise = this.audioElement.play();
    if (playPromise) {
      playPromise
        .then(() => {
          console.log("[Telnyx WebRTC] 🔊 Audio playback started successfully");
          this.remoteStreamConnected = true;
        })
        .catch((e) => {
          console.error("[Telnyx WebRTC] 🔊 Audio play error:", e.message);
          // Retry on autoplay error
          if (retryCount < 10) {
            setTimeout(() => this.tryPlayAudio(retryCount + 1), 200);
          }
        });
    } else {
      this.remoteStreamConnected = true;
    }
  }

  public async initialize(sipUser: string, sipPass: string, callerId?: string): Promise<void> {
    const store = useTelnyxStore.getState();
    store.setConnectionStatus("connecting");

    // Save credentials for auto-reconnect
    this.savedCredentials = { sipUser, sipPass, callerId };
    this.cancelReconnect(); // Cancel any pending reconnect

    if (callerId) store.setCallerIdNumber(callerId);
    store.setSipUsername(sipUser);

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    // CRITICAL: Create audio elements OUTSIDE of React BEFORE initializing TelnyxRTC
    // This prevents React Fiber references from being attached to the elements,
    // which would cause "circular structure to JSON" errors in the SDK
    const audioElements = ensureTelnyxAudioElements();
    this.audioElement = audioElements.remote;
    console.log("[Telnyx WebRTC] 🔊 Using programmatic audio element (no React Fiber)");

    // Per official Telnyx SDK docs:
    // https://developers.telnyx.com/docs/voice/webrtc/js-sdk/interfaces/iclientoptions
    // https://developers.telnyx.com/docs/voice/webrtc/troubleshooting/debug-logs
    // IClientOptions includes: login, password, debug, debugOutput, prefetchIceCandidates, etc.
    // Note: useStereo and audio are IVertoCallOptions (for newCall), NOT constructor options
    this.client = new TelnyxRTC({
      login: sipUser,
      password: sipPass,
      // Per docs: prefetchIceCandidates can improve connection time
      prefetchIceCandidates: true,
    });

    // CRITICAL: Per Telnyx docs, set client.remoteElement IMMEDIATELY after creation
    // Docs: https://www.npmjs.com/package/@telnyx/webrtc
    // Using STRING ID - the SDK will use document.getElementById internally
    // Since we created the element programmatically (not via React JSX),
    // it won't have __reactFiber$ properties that cause circular JSON errors
    console.log("[Telnyx WebRTC] 🔊 Setting client.remoteElement as string ID:", TELNYX_REMOTE_AUDIO_ID);
    this.client.remoteElement = TELNYX_REMOTE_AUDIO_ID;

    this.client.on("telnyx.ready", async () => {
      console.log("[Telnyx WebRTC] Connected and ready");
      store.setConnectionStatus("connected");
      // Reset reconnect counter on successful connection
      this.reconnectAttempts = 0;
      
      // Per official Telnyx docs: Apply audio settings AFTER connection
      // https://developers.telnyx.com/docs/voice/webrtc/js-sdk/classes/telnyxrtc#setaudiosettings
      // This enables browser-level audio processing for noise reduction
      try {
        if (this.client) {
          const audioSettings = await this.client.setAudioSettings({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          console.log("[Telnyx WebRTC] 🔊 Audio settings applied:", audioSettings);
        }
      } catch (audioError) {
        console.warn("[Telnyx WebRTC] ⚠️ Failed to apply audio settings:", audioError);
      }
    });

    this.client.on("telnyx.socket.close", () => {
      console.log("[Telnyx WebRTC] Socket closed");
      store.setConnectionStatus("disconnected");
      // Auto-reconnect if we have saved credentials and not currently in a call
      const currentStore = useTelnyxStore.getState();
      if (this.savedCredentials && !currentStore.currentCall && !currentStore.incomingCall && !currentStore.outgoingCall) {
        this.scheduleReconnect();
      }
    });

    this.client.on("telnyx.error", (e: any) => {
      console.error("[Telnyx WebRTC] Error:", e);
      store.setConnectionStatus("error", e?.message);
    });

    // Per official Telnyx docs: Handle userMediaError for microphone issues
    // https://developers.telnyx.com/docs/voice/webrtc/js-sdk/error-handling
    // "User media errors occur when the browser cannot access the user's microphone or camera"
    this.client.on("telnyx.notification", (notification: any) => {
      if (notification.type === 'userMediaError') {
        console.error("[Telnyx WebRTC] ❌ User media error (microphone/camera access denied):", notification.error);
        store.setConnectionStatus("error", "Cannot access microphone. Check browser permissions.");
        return;
      }
    });

    // NOTIFICATION HANDLER - El SDK de Telnyx usa este patrón
    this.client.on("telnyx.notification", (notification: any) => {
      const call = notification.call;
      if (!call) return;

      const state = call.state;
      
      // CRITICAL: Inferir direction si no está disponible
      // El SDK moderno no siempre proporciona direction
      let direction = call.direction;
      if (!direction) {
        const currentStore = useTelnyxStore.getState();
        const destNumber = call.options?.destinationNumber;
        const normalizedDest = destNumber ? this.normalizePhoneNumber(destNumber) : '';
        
        // Check 1: If we just initiated an outbound call to this destination
        if (this.pendingOutboundDestination && normalizedDest === this.pendingOutboundDestination) {
          direction = "outbound";
        }
        // Check 2: If we have an outgoing call stored with matching ID
        else if (currentStore.outgoingCall && (currentStore.outgoingCall as any).id === call.id) {
          direction = "outbound";
        }
        // Check 3: Only then assume inbound for new/invite/ringing
        else if (state === "new" || state === "invite" || state === "ringing") {
          direction = "inbound";
        }
      }

      console.log("[Telnyx WebRTC] Notification:", notification.type, { 
        state, 
        direction,
        remoteCallerNumber: call.options?.remoteCallerNumber,
        destinationNumber: call.options?.destinationNumber
      });

      // Per Telnyx SDK: Connect remoteStream to audio element when available
      // The SDK handles ICE negotiation internally
      if (call.remoteStream && this.audioElement && !this.remoteStreamConnected) {
        console.log("[Telnyx WebRTC] 🔊 remoteStream detected in notification");
        this.stopRingtone();
        this.stopRingback();
        this.audioElement.srcObject = call.remoteStream;
        this.audioElement.muted = false;
        this.audioElement.volume = 1.0;
        this.audioElement.play().catch((e) => console.error("[Telnyx WebRTC] Audio play error:", e));
        this.remoteStreamConnected = true;
      }

      // Evitar procesar el mismo estado dos veces
      const stateKey = `${call.id}-${state}`;
      if (this.lastCallState === stateKey) return;
      this.lastCallState = stateKey;

      if (notification.type === "callUpdate") {
        this.handleCallStateChange(call, state, direction);
      }
    });

    await this.client.connect();
  }

  private handleCallStateChange(call: any, state: string, direction: string): void {
    const store = useTelnyxStore.getState();

    switch (state) {
      case "new":
      case "invite":
      case "ringing":
        if (direction === "inbound") {
          console.log("[Telnyx WebRTC] 📞 Incoming call (state:", state, ")");
          store.setIncomingCall(call);
          this.startRingtone();
        }
        break;

      case "trying":
        if (direction === "outbound") {
          console.log("[Telnyx WebRTC] 📤 Outbound trying");
          store.setOutgoingCall(call);
          this.startRingback();
        }
        break;

      case "answering":
        // CRITICAL: For inbound calls, connect audio as early as possible
        // This is the state right after answer() is called, before "active"
        if (direction === "inbound") {
          console.log("[Telnyx WebRTC] 📥 Answering state - connecting audio early");
          this.stopRingtone();
          if (call.remoteStream && this.audioElement && !this.remoteStreamConnected) {
            console.log("[Telnyx WebRTC] 🔊 Connecting remoteStream in answering state");
            this.audioElement.srcObject = call.remoteStream;
            this.audioElement.muted = false;
            this.audioElement.volume = 1.0;
            this.audioElement.play().catch(console.error);
            this.remoteStreamConnected = true;
          }
        }
        break;

      case "early":
        console.log("[Telnyx WebRTC] 📤 Early media state", { direction });
        this.stopRingback();
        this.stopRingtone();
        // Early media - connect audio immediately for BOTH directions
        if (call.remoteStream && this.audioElement && !this.remoteStreamConnected) {
          console.log("[Telnyx WebRTC] 🔊 Connecting remoteStream in early state");
          this.audioElement.srcObject = call.remoteStream;
          this.audioElement.muted = false;
          this.audioElement.volume = 1.0;
          this.audioElement.play().catch(console.error);
          this.remoteStreamConnected = true;
        }
        break;

      case "active":
        console.log("[Telnyx WebRTC] 🟢 Call active");
        this.stopRingback();
        this.stopRingtone();

        store.setIncomingCall(undefined);
        store.setOutgoingCall(undefined);
        store.setCurrentCall(call);
        store.setCallActiveTimestamp(Date.now());
        
        // CRITICAL: Capture call_control_id for Call Control API hangup
        // The SDK has a bug where hangup() always sends 486 USER_BUSY
        // We need the call_control_id to hangup via REST API instead
        // Per Telnyx docs: POST /v2/calls/{call_control_id}/actions/hangup
        const callControlId = (call as any).telnyxCallControlId || 
                              (call as any).callControlId ||
                              (call as any).telnyxIDs?.telnyxCallControlId ||
                              (call as any).telnyxIDs?.telnyxLegId ||
                              (call as any).options?.telnyxCallControlId;
        console.log("[Telnyx WebRTC] 📞 Call IDs available:", {
          telnyxCallControlId: (call as any).telnyxCallControlId,
          callControlId: (call as any).callControlId,
          telnyxLegId: (call as any).telnyxIDs?.telnyxLegId,
          callId: (call as any).id
        });
        if (callControlId) {
          console.log("[Telnyx WebRTC] 📞 Using call_control_id:", callControlId);
          store.setActiveTelnyxLegId(callControlId);
        } else {
          console.log("[Telnyx WebRTC] ⚠️ No call_control_id available, hangup may show USER_BUSY");
        }

        // Conectar audio remoto
        this.remoteStreamConnected = false;
        this.connectRemoteAudio(call);

        this.logCallToServer(call, "active");
        break;

      case "hangup":
      case "destroy":
        // Log detailed hangup reason for debugging
        console.log("[Telnyx WebRTC] 🔴 Call ended", {
          cause: call.cause,
          causeCode: call.causeCode,
          sipCode: call.sipCode,
          sipReason: call.sipReason,
          direction
        });
        this.stopRingback();
        this.stopRingtone();

        this.logCallToServer(call, "completed");

        store.setCurrentCall(undefined);
        store.setIncomingCall(undefined);
        store.setOutgoingCall(undefined);
        store.setCallActiveTimestamp(undefined);
        store.setActiveTelnyxLegId(undefined);
        store.setMuted(false);
        store.setOnHold(false);

        this.remoteStreamConnected = false;
        this.lastCallState = null;
        // Clear pending outbound destination
        this.pendingOutboundDestination = null;
        break;
    }
  }

  private async logCallToServer(call: any, status: string): Promise<void> {
    try {
      const store = useTelnyxStore.getState();
      const activeTimestamp = store.callActiveTimestamp;
      const duration = activeTimestamp ? Math.floor((Date.now() - activeTimestamp) / 1000) : 0;

      await fetch("/api/webrtc/call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          callId: call.id || `webrtc-${Date.now()}`,
          fromNumber: call.direction === "inbound" ? call.options?.remoteCallerNumber : store.callerIdNumber,
          toNumber: call.direction === "inbound" ? store.callerIdNumber : call.options?.destinationNumber,
          direction: call.direction,
          status,
          duration,
        }),
      });
    } catch (error) {
      console.error("[Telnyx WebRTC] Failed to log call:", error);
    }
  }

  /**
   * Get preferred codecs as RTCRtpCodecCapability objects in Telnyx SIP Connection order.
   * Per Telnyx documentation: preferred_codecs must be a sub-array of 
   * RTCRtpReceiver.getCapabilities('audio').codecs
   * 
   * Order matches Telnyx SIP Connection settings: PCMU -> PCMA -> G722 -> OPUS
   * This eliminates codec negotiation delay that causes 5-second audio delay.
   * 
   * @see https://developers.telnyx.com/docs/voice/webrtc/js-sdk/classes/telnyxrtc
   */
  private getPreferredCodecs(): any[] {
    try {
      const capabilities = RTCRtpReceiver.getCapabilities('audio');
      if (!capabilities?.codecs) {
        console.warn("[Telnyx WebRTC] No audio codecs available from browser");
        return [];
      }
      
      const allCodecs = capabilities.codecs;
      
      // Order: PCMU -> PCMA -> G722 -> OPUS (matching Telnyx SIP Connection settings)
      const codecOrder = ['pcmu', 'pcma', 'g722', 'opus'];
      
      const orderedCodecs: any[] = [];
      for (const codecName of codecOrder) {
        const found = allCodecs.find(c => 
          c.mimeType.toLowerCase().includes(codecName)
        );
        if (found) {
          orderedCodecs.push(found);
        }
      }
      
      console.log("[Telnyx WebRTC] Preferred codecs:", orderedCodecs.map(c => c.mimeType));
      return orderedCodecs;
    } catch (error) {
      console.error("[Telnyx WebRTC] Failed to get codecs:", error);
      return [];
    }
  }

  /**
   * Get ONLY PCMU/PCMA codecs for outbound calls
   * Telnyx SIP Connection only supports μ-law/A-law with SRTP
   * Using OPUS/G722 causes 488 "Not Acceptable Here" errors
   */
  private getOutboundCodecs(): any[] {
    try {
      const capabilities = RTCRtpReceiver.getCapabilities('audio');
      if (!capabilities) return [];
      
      const allCodecs = capabilities.codecs;
      
      // ONLY PCMU and PCMA - no OPUS, no G722
      const codecOrder = ['pcmu', 'pcma'];
      
      const orderedCodecs: any[] = [];
      for (const codecName of codecOrder) {
        const found = allCodecs.find(c => 
          c.mimeType.toLowerCase().includes(codecName)
        );
        if (found) {
          orderedCodecs.push(found);
        }
      }
      
      return orderedCodecs;
    } catch (error) {
      console.error("[Telnyx WebRTC] Failed to get outbound codecs:", error);
      return [];
    }
  }

  /**
   * Normalize phone number to digits only for comparison
   */
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10); // Last 10 digits
  }

  public makeCall(dest: string): TelnyxCall | null {
    if (!this.client) return null;

    const store = useTelnyxStore.getState();
    store.setCurrentCall(undefined);
    store.setOutgoingCall(undefined);
    store.setCallActiveTimestamp(undefined);
    this.remoteStreamConnected = false;
    this.lastCallState = null;

    // CRITICAL: Set pending destination BEFORE newCall to prevent direction misidentification
    this.pendingOutboundDestination = this.normalizePhoneNumber(dest);
    console.log("[Telnyx WebRTC] 📞 Making call to:", dest, "normalized:", this.pendingOutboundDestination);

    // Format destination number to E.164 format
    // Handle cases: "7866302522", "17866302522", "+17866302522"
    const digits = dest.replace(/\D/g, '');
    let formattedDest: string;
    if (dest.startsWith('+')) {
      formattedDest = dest; // Already has +, keep as is
    } else if (digits.length === 11 && digits.startsWith('1')) {
      formattedDest = `+${digits}`; // Has country code, just add +
    } else if (digits.length === 10) {
      formattedDest = `+1${digits}`; // 10-digit US number, add +1
    } else {
      formattedDest = `+1${digits}`; // Default: assume US
    }
    console.log("[Telnyx WebRTC] 📞 Formatted destination:", formattedDest);

    // Get ONLY PCMU/PCMA codecs (no OPUS/G722) to match Telnyx SIP Connection settings
    // This prevents 488 "Not Acceptable Here" errors on outbound calls
    const preferredCodecs = this.getOutboundCodecs();
    console.log("[Telnyx WebRTC] 📞 Using codecs for outbound:", preferredCodecs.map(c => c.mimeType));

    // Per official Telnyx docs (ICallOptions):
    // https://developers.telnyx.com/docs/voice/webrtc/js-sdk/interfaces/icalloptions
    // audio: boolean - "Overrides client's default audio constraints. Defaults to true"
    // useStereo: boolean - "Uses stereo audio instead of mono"
    const call = this.client.newCall({
      destinationNumber: formattedDest,
      callerNumber: store.callerIdNumber,
      callerName: "Curbe",
      preferred_codecs: preferredCodecs,
      // Per docs: Explicitly enable audio (microphone) for outgoing calls
      audio: true,
      // Per docs: Use stereo audio for better quality
      useStereo: true,
    });

    store.setOutgoingCall(call);
    this.startRingback();

    return call;
  }

  public answerCall(): void {
    const store = useTelnyxStore.getState();
    const incoming = store.incomingCall;
    if (!incoming) return;

    console.log("[Telnyx WebRTC] 📞 Answering call...");
    this.stopRingtone();

    // CRITICAL: Per Telnyx docs, ensure remoteElement is set BEFORE answering
    // Docs: https://www.npmjs.com/package/@telnyx/webrtc
    // Type: string | Function | HTMLMediaElement
    // Using STRING ID to avoid circular JSON serialization errors when debug is enabled
    if (this.client) {
      console.log("[Telnyx WebRTC] 🔊 Ensuring client.remoteElement as string ID before answer");
      this.client.remoteElement = "telnyx-remote-audio";
    }

    // Reset stream connected flag so we can reconnect if needed
    this.remoteStreamConnected = false;

    // Per official Telnyx docs: answer() triggers getUserMedia internally
    // https://developers.telnyx.com/docs/voice/webrtc/js-sdk/classes/call
    // NOTE: Do NOT modify incoming.options.preferred_codecs - the SDK does not
    // honor codec preferences on inbound calls and modifying them causes a 4-6
    // second audio delay due to local renegotiation conflict with server-side SDP
    incoming.answer();

    // Per official docs: After answering, verify localStream has audio tracks
    // and ensure microphone is not muted
    // https://developers.telnyx.com/docs/voice/webrtc/js-sdk/anatomy
    setTimeout(() => {
      const call = incoming as any;
      
      // Check localStream for audio tracks
      if (call.localStream) {
        const audioTracks = call.localStream.getAudioTracks();
        console.log("[Telnyx WebRTC] 🎤 localStream audio tracks:", audioTracks.length);
        audioTracks.forEach((track: MediaStreamTrack, i: number) => {
          console.log(`[Telnyx WebRTC] 🎤 Track ${i}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
        });
        
        if (audioTracks.length === 0) {
          console.error("[Telnyx WebRTC] ❌ No audio tracks in localStream - microphone may not be captured!");
        }
      } else {
        console.error("[Telnyx WebRTC] ❌ No localStream available after answer!");
      }
      
      // Check if microphone is muted and unmute if needed
      // Per docs: https://developers.telnyx.com/docs/voice/webrtc/js-sdk/classes/call#unmuteaudio
      if (call.audioMuted) {
        console.log("[Telnyx WebRTC] 🎤 Microphone is muted, unmuting...");
        call.unmuteAudio();
      }
      
      console.log("[Telnyx WebRTC] 🎤 audioMuted:", call.audioMuted);
    }, 1000);
  }

  public rejectCall(): void {
    const store = useTelnyxStore.getState();
    const incoming = store.incomingCall;
    if (!incoming) return;

    console.log("[Telnyx WebRTC] Rejecting call");
    this.stopRingtone();
    incoming.hangup({ sipHangupCode: 486 });
    store.setIncomingCall(undefined);
  }

  public async hangup(): Promise<void> {
    const store = useTelnyxStore.getState();
    
    // Get the active call before we clean up state
    const activeCall = store.currentCall || store.outgoingCall || store.incomingCall;
    if (!activeCall) {
      console.log("[Telnyx WebRTC] No active call to hang up");
      return;
    }
    
    const callState = (activeCall as any)?.state;
    const direction = (activeCall as any)?.direction || "unknown";
    const webrtcCallId = (activeCall as any)?.id || (activeCall as any)?.callId;
    const telnyxLegId = store.activeTelnyxLegId;
    
    console.log("[Telnyx WebRTC] Hanging up call:", { 
      state: callState, 
      direction, 
      webrtcCallId,
      telnyxLegId
    });

    // CRITICAL: The Telnyx WebRTC SDK has a BUG where hangup() ALWAYS sends 486 USER_BUSY
    // This is hardcoded in BaseCall.ts: cause: 'USER_BUSY', causeCode: 17
    // The only way to properly hangup with NORMAL_CLEARING (16) is via Call Control API
    
    if (direction === "inbound" && telnyxLegId) {
      // For inbound calls with leg ID: Use Call Control API to hangup properly
      console.log("[Telnyx WebRTC] Using Call Control API hangup for inbound call");
      try {
        const response = await fetch("/api/webrtc/call-control-hangup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ telnyxLegId })
        });
        const result = await response.json();
        console.log("[Telnyx WebRTC] Call Control hangup result:", result);
        
        if (!result.success) {
          console.error("[Telnyx WebRTC] Call Control hangup failed, falling back to SDK");
          activeCall.hangup();
        }
      } catch (e) {
        console.error("[Telnyx WebRTC] Call Control hangup error:", e);
        // Fallback to SDK hangup
        activeCall.hangup();
      }
    } else {
      // For outbound calls or no leg ID: use SDK hangup
      console.log("[Telnyx WebRTC] Using SDK hangup");
      try {
        activeCall.hangup();
      } catch (e) {
        console.error("[Telnyx WebRTC] SDK hangup error:", e);
      }
    }

    // Clean UI states AFTER hangup
    store.setCurrentCall(undefined);
    store.setOutgoingCall(undefined);
    store.setIncomingCall(undefined);
    store.setCallActiveTimestamp(undefined);
    store.setActiveTelnyxLegId(undefined);

    this.stopRingtone();
    this.stopRingback();
  }

  public toggleMute(): void {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (currentCall) {
      if (store.isMuted) {
        currentCall.unmuteAudio();
      } else {
        currentCall.muteAudio();
      }
      store.setMuted(!store.isMuted);
    }
  }

  public toggleHold(): void {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (currentCall) {
      if (store.isOnHold) {
        currentCall.unhold();
      } else {
        currentCall.hold();
      }
      store.setOnHold(!store.isOnHold);
    }
  }

  public sendDTMF(digit: string): void {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (currentCall) {
      currentCall.dtmf(digit);
    }
  }

  public blindTransfer(destinationNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (!currentCall) return false;

    try {
      console.log("[Telnyx WebRTC] Blind transfer to:", destinationNumber);
      (currentCall as any).transfer(destinationNumber);
      store.setCurrentCall(undefined);
      store.setMuted(false);
      store.setOnHold(false);
      return true;
    } catch (error) {
      console.error("[Telnyx WebRTC] Blind transfer failed:", error);
      return false;
    }
  }

  public async startAttendedTransfer(consultNumber: string): Promise<boolean> {
    if (!this.client) return false;

    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (!currentCall) return false;

    try {
      console.log("[Telnyx WebRTC] Starting attended transfer");
      currentCall.hold();
      store.setOnHold(true);
      store.setConsulting(true);

      // Use same codec order as Telnyx connection settings
      const preferredCodecs = this.getPreferredCodecs();
      
      // Per official Telnyx docs (ICallOptions):
      // https://developers.telnyx.com/docs/voice/webrtc/js-sdk/interfaces/icalloptions
      const consultCall = this.client.newCall({
        destinationNumber: consultNumber,
        callerNumber: store.callerIdNumber,
        callerName: "Curbe",
        preferred_codecs: preferredCodecs,
        // Per docs: Explicitly enable audio (microphone)
        audio: true,
        // Per docs: Use stereo audio for better quality
        useStereo: true,
      });

      store.setConsultCall(consultCall);
      return true;
    } catch (error) {
      console.error("[Telnyx WebRTC] Start attended transfer failed:", error);
      currentCall.unhold();
      store.setOnHold(false);
      store.setConsulting(false);
      return false;
    }
  }

  public completeAttendedTransfer(consultNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    const consultCall = store.consultCall;

    if (!currentCall) return false;

    try {
      console.log("[Telnyx WebRTC] Completing attended transfer");
      if (consultCall) consultCall.hangup({ sipHangupCode: 16 });
      (currentCall as any).transfer(consultNumber);

      store.setConsultCall(undefined);
      store.setCurrentCall(undefined);
      store.setConsulting(false);
      store.setOnHold(false);
      store.setMuted(false);
      return true;
    } catch (error) {
      console.error("[Telnyx WebRTC] Complete attended transfer failed:", error);
      return false;
    }
  }

  public cancelAttendedTransfer(): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    const consultCall = store.consultCall;

    if (!currentCall) return false;

    try {
      console.log("[Telnyx WebRTC] Canceling attended transfer");
      if (consultCall) consultCall.hangup({ sipHangupCode: 16 });
      currentCall.unhold();

      store.setConsultCall(undefined);
      store.setConsulting(false);
      store.setOnHold(false);
      return true;
    } catch (error) {
      console.error("[Telnyx WebRTC] Cancel attended transfer failed:", error);
      return false;
    }
  }

  public getCallQuality(): void {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (!currentCall) {
      store.setNetworkQuality(undefined);
      return;
    }

    try {
      const options = (currentCall as any).options || {};
      const stats = options.stats || {};

      const mos = stats.mos || stats.quality?.mos || 4.0;
      const jitter = stats.jitter || stats.audio?.jitter || 0;
      const packetLoss = stats.packetLoss || stats.audio?.packetsLost || 0;
      const rtt = stats.rtt || stats.roundTripTime || 0;

      let qualityLevel: "excellent" | "good" | "poor" = "excellent";
      if (mos < 3.0 || packetLoss > 5) {
        qualityLevel = "poor";
      } else if (mos < 4.0 || packetLoss > 1) {
        qualityLevel = "good";
      }

      store.setNetworkQuality({ mos, jitter, packetLoss, rtt, qualityLevel });
    } catch (error) {
      console.error("[Telnyx WebRTC] Failed to get call quality:", error);
    }
  }

  private startRingtone(): void {
    this.stopRingback();
    this.ringtone.currentTime = 0;
    this.ringtone.play().catch(() => {});
  }

  private stopRingtone(): void {
    this.ringtone.pause();
    this.ringtone.currentTime = 0;
  }

  private startRingback(): void {
    this.stopRingtone();
    this.ringback.currentTime = 0;
    this.ringback.play().catch(() => {});
  }

  private stopRingback(): void {
    this.ringback.pause();
    this.ringback.currentTime = 0;
  }

  public disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    const store = useTelnyxStore.getState();
    store.setConnectionStatus("disconnected");
    store.setCurrentCall(undefined);
    store.setIncomingCall(undefined);
    store.setOutgoingCall(undefined);
    store.setConsultCall(undefined);
    store.setConsulting(false);
    store.setNetworkQuality(undefined);
  }

  public isInitialized(): boolean {
    return this.client !== null;
  }

  public getClient(): TelnyxRTC | null {
    return this.client;
  }
}

export const telnyxWebRTC = TelnyxWebRTCManager.getInstance();
