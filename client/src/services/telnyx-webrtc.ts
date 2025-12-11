// ============================================================================
//  TELNYX WEBRTC – CURBE VOICE (SIP.JS IMPLEMENTATION)
//  Pure SIP.js implementation with zero-latency ICE configuration
//  Server: wss://rtc.telnyx.com:443
// ============================================================================

import { UserAgent, Registerer, Inviter, Invitation, SessionState, Session, RegistererState } from "sip.js";
import { create } from "zustand";

// ============================================================================
// CONSTANTS
// ============================================================================
// IMPORTANT: Use sip.telnyx.com:7443 for standard SIP over WebSocket (RFC 7118)
// Port 7443 is the correct WebSocket port for Telnyx SIP connections
// rtc.telnyx.com is for the legacy SDK - NOT for direct SIP.js
const TELNYX_WSS_SERVER = "wss://sip.telnyx.com:7443";
const TELNYX_REMOTE_AUDIO_ID = "telnyx-remote-audio";
const TELNYX_LOCAL_AUDIO_ID = "telnyx-local-audio";
const TELNYX_MEDIA_ROOT_ID = "telnyx-media-root";

// ============================================================================
// AUDIO ELEMENT MANAGEMENT
// ============================================================================
function ensureTelnyxAudioElements(): { remote: HTMLAudioElement; local: HTMLAudioElement } {
  let remote = document.getElementById(TELNYX_REMOTE_AUDIO_ID) as HTMLAudioElement | null;
  let local = document.getElementById(TELNYX_LOCAL_AUDIO_ID) as HTMLAudioElement | null;
  
  if (remote && local) {
    return { remote, local };
  }
  
  let container = document.getElementById(TELNYX_MEDIA_ROOT_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = TELNYX_MEDIA_ROOT_ID;
    container.style.display = "none";
    container.style.position = "absolute";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
    console.log("[SIP.js WebRTC] Created audio container:", TELNYX_MEDIA_ROOT_ID);
  }
  
  if (!remote) {
    remote = document.createElement("audio");
    remote.id = TELNYX_REMOTE_AUDIO_ID;
    remote.autoplay = true;
    remote.setAttribute("playsinline", "true");
    container.appendChild(remote);
    console.log("[SIP.js WebRTC] Created remote audio element:", TELNYX_REMOTE_AUDIO_ID);
  }
  
  if (!local) {
    local = document.createElement("audio");
    local.id = TELNYX_LOCAL_AUDIO_ID;
    local.autoplay = true;
    local.muted = true;
    local.setAttribute("playsinline", "true");
    container.appendChild(local);
    console.log("[SIP.js WebRTC] Created local audio element:", TELNYX_LOCAL_AUDIO_ID);
  }
  
  return { remote, local };
}

export function getTelnyxRemoteAudioElement(): HTMLAudioElement | null {
  return document.getElementById(TELNYX_REMOTE_AUDIO_ID) as HTMLAudioElement | null;
}

export function getTelnyxLocalAudioElement(): HTMLAudioElement | null {
  return document.getElementById(TELNYX_LOCAL_AUDIO_ID) as HTMLAudioElement | null;
}

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================
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
  currentCall?: Session;
  incomingCall?: Invitation;
  outgoingCall?: Inviter;
  consultCall?: Session;
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
  setCurrentCall: (call?: Session) => void;
  setIncomingCall: (call?: Invitation) => void;
  setOutgoingCall: (call?: Inviter) => void;
  setConsultCall: (call?: Session) => void;
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

// Legacy export for backward compatibility
export function setForcedIceServers(_servers: RTCIceServer[]) {
  console.log("[SIP.js WebRTC] setForcedIceServers called - handled via sessionDescriptionHandlerFactoryOptions");
}

// ============================================================================
// SIP.JS WEBRTC MANAGER
// ============================================================================
class TelnyxWebRTCManager {
  private static instance: TelnyxWebRTCManager;
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private ringtone: HTMLAudioElement;
  private ringback: HTMLAudioElement;
  private turnServers: RTCIceServer[] = [];
  
  // Auto-reconnect state
  private savedCredentials: { sipUser: string; sipPass: string; callerId?: string } | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting: boolean = false;

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
      console.error("[SIP.js WebRTC] Failed to create ringback tone:", error);
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
    console.log("[SIP.js WebRTC] Audio element registered:", !!elem);
    this.audioElement = elem;
  }

  /**
   * Build zero-latency ICE configuration
   * Forces TURN relay with localhost STUN blackhole for instant failover
   */
  private getZeroLatencyRTCConfig(): RTCConfiguration {
    const config: RTCConfiguration = {
      iceTransportPolicy: "relay", // FORCE TURN tunnel - skip STUN gathering
      iceServers: [
        { urls: "stun:127.0.0.1:3478" }, // Blackhole STUN for instant fail
        ...this.turnServers
      ],
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require"
    };
    
    console.log("[SIP.js WebRTC] Zero-latency ICE config:", JSON.stringify({
      iceTransportPolicy: config.iceTransportPolicy,
      iceServersCount: config.iceServers?.length
    }));
    
    return config;
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting || !this.savedCredentials) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[SIP.js WebRTC] Max reconnect attempts reached");
      return;
    }

    this.isReconnecting = true;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[SIP.js WebRTC] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      this.isReconnecting = false;
      if (this.savedCredentials) {
        try {
          console.log("[SIP.js WebRTC] Attempting auto-reconnect...");
          await this.initialize(
            this.savedCredentials.sipUser,
            this.savedCredentials.sipPass,
            this.savedCredentials.callerId
          );
        } catch (error) {
          console.error("[SIP.js WebRTC] Auto-reconnect failed:", error);
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
  }

  /**
   * Connect remote audio stream to audio element
   */
  private setupRemoteAudio(session: Session): void {
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (!sessionDescriptionHandler) {
      console.warn("[SIP.js WebRTC] No sessionDescriptionHandler available");
      return;
    }

    const peerConnection = (sessionDescriptionHandler as any).peerConnection as RTCPeerConnection | undefined;
    if (!peerConnection) {
      console.warn("[SIP.js WebRTC] No peerConnection available");
      return;
    }

    // Get remote stream from the peer connection
    const remoteStream = new MediaStream();
    peerConnection.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });

    if (remoteStream.getTracks().length === 0) {
      console.warn("[SIP.js WebRTC] No remote tracks found");
      return;
    }

    // Ensure audio element exists
    const audioElements = ensureTelnyxAudioElements();
    this.audioElement = audioElements.remote;

    // Connect stream to audio element
    this.audioElement.srcObject = remoteStream;
    this.audioElement.muted = false;
    this.audioElement.volume = 1.0;

    this.audioElement.play().then(() => {
      console.log("[SIP.js WebRTC] Remote audio playing");
    }).catch((e) => {
      console.error("[SIP.js WebRTC] Audio play error:", e.message);
    });

    // Also listen for track events on the peer connection
    peerConnection.ontrack = (event) => {
      console.log("[SIP.js WebRTC] ontrack event, adding track to audio element");
      if (event.streams && event.streams[0]) {
        this.audioElement!.srcObject = event.streams[0];
        this.audioElement!.play().catch(console.error);
      }
    };
  }

  /**
   * Handle session state changes
   */
  private setupSessionHandlers(session: Session, isOutgoing: boolean): void {
    const store = useTelnyxStore.getState();

    session.stateChange.addListener((state: SessionState) => {
      console.log("[SIP.js WebRTC] Session state changed:", state);

      switch (state) {
        case SessionState.Establishing:
          console.log("[SIP.js WebRTC] Call establishing...");
          break;

        case SessionState.Established:
          console.log("[SIP.js WebRTC] Call established");
          this.stopRingtone();
          this.stopRingback();
          store.setCurrentCall(session);
          store.setIncomingCall(undefined);
          store.setOutgoingCall(undefined);
          store.setCallActiveTimestamp(Date.now());
          store.setMuted(false);
          store.setOnHold(false);
          this.setupRemoteAudio(session);
          break;

        case SessionState.Terminating:
          console.log("[SIP.js WebRTC] Call terminating...");
          break;

        case SessionState.Terminated:
          console.log("[SIP.js WebRTC] Call terminated");
          this.stopRingtone();
          this.stopRingback();
          store.setCurrentCall(undefined);
          store.setIncomingCall(undefined);
          store.setOutgoingCall(undefined);
          store.setCallActiveTimestamp(undefined);
          store.setActiveTelnyxLegId(undefined);
          store.setMuted(false);
          store.setOnHold(false);
          break;
      }
    });
  }

  /**
   * Handle incoming call (Invitation)
   */
  private handleIncomingCall(invitation: Invitation): void {
    const store = useTelnyxStore.getState();
    
    // Extract caller info from the INVITE request
    const request = invitation.request;
    const fromHeader = request.getHeader("From") || "";
    const callerMatch = fromHeader.match(/<sip:([^@]+)@/);
    const callerNumber = callerMatch ? callerMatch[1] : "Unknown";
    
    console.log("[SIP.js WebRTC] Incoming call from:", callerNumber);
    
    store.setIncomingCall(invitation);
    this.startRingtone();
    
    // Setup handlers for incoming call
    this.setupSessionHandlers(invitation, false);
    
    // Handle cancel/bye before answer
    invitation.stateChange.addListener((state) => {
      if (state === SessionState.Terminated) {
        this.stopRingtone();
        store.setIncomingCall(undefined);
      }
    });
  }

  /**
   * Initialize SIP.js UserAgent and connect to Telnyx
   */
  public async initialize(sipUser: string, sipPass: string, callerId?: string, iceServers?: RTCIceServer[]): Promise<void> {
    const store = useTelnyxStore.getState();
    store.setConnectionStatus("connecting");

    // Save credentials for auto-reconnect
    this.savedCredentials = { sipUser, sipPass, callerId };
    this.cancelReconnect();

    if (callerId) store.setCallerIdNumber(callerId);
    store.setSipUsername(sipUser);

    // Store TURN servers
    this.turnServers = iceServers || [];
    console.log("[SIP.js WebRTC] TURN servers configured:", this.turnServers.length);

    // Cleanup existing connection
    if (this.userAgent) {
      try {
        await this.userAgent.stop();
      } catch (e) {
        console.warn("[SIP.js WebRTC] Error stopping previous UA:", e);
      }
      this.userAgent = null;
      this.registerer = null;
    }

    // Create audio elements before initializing
    const audioElements = ensureTelnyxAudioElements();
    this.audioElement = audioElements.remote;

    // Build SIP URI
    const uri = UserAgent.makeURI(`sip:${sipUser}@sip.telnyx.com`);
    if (!uri) {
      store.setConnectionStatus("error", "Invalid SIP URI");
      return;
    }

    // CRITICAL: Zero-latency RTCConfiguration
    const rtcConfig = this.getZeroLatencyRTCConfig();

    try {
      this.userAgent = new UserAgent({
        uri,
        // Auth: username WITHOUT domain, password from SIP credentials
        authorizationUsername: sipUser,
        authorizationPassword: sipPass,
        transportOptions: {
          server: TELNYX_WSS_SERVER,
          // Enable SIP trace for debugging 401/403 auth errors
          traceSip: true
        },
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionConfiguration: rtcConfig,
          constraints: {
            audio: true,
            video: false
          }
        },
        // Contact name for SIP REGISTER
        contactName: sipUser,
        displayName: "Curbe",
        // Debug level to see SIP messages
        logLevel: "debug",
        delegate: {
          onInvite: (invitation: Invitation) => {
            this.handleIncomingCall(invitation);
          },
          onDisconnect: (error?: Error) => {
            console.log("[SIP.js WebRTC] Disconnected:", error?.message);
            store.setConnectionStatus("disconnected");
            this.scheduleReconnect();
          }
        }
      });

      // Start the UserAgent (connects WebSocket)
      await this.userAgent.start();
      console.log("[SIP.js WebRTC] UserAgent started");

      // Register with Telnyx
      this.registerer = new Registerer(this.userAgent, {
        expires: 600,
        extraHeaders: [
          `X-Telnyx-Login: ${sipUser}`
        ]
      });

      this.registerer.stateChange.addListener((state: RegistererState) => {
        console.log("[SIP.js WebRTC] Registerer state:", state);
        
        switch (state) {
          case RegistererState.Registered:
            console.log("[SIP.js WebRTC] Registered successfully");
            store.setConnectionStatus("connected");
            this.reconnectAttempts = 0;
            break;
          case RegistererState.Unregistered:
            console.log("[SIP.js WebRTC] Unregistered");
            store.setConnectionStatus("disconnected");
            break;
          case RegistererState.Terminated:
            console.log("[SIP.js WebRTC] Registerer terminated");
            store.setConnectionStatus("disconnected");
            break;
        }
      });

      await this.registerer.register();
      console.log("[SIP.js WebRTC] Registration request sent");

    } catch (error) {
      console.error("[SIP.js WebRTC] Initialization error:", error);
      store.setConnectionStatus("error", (error as Error).message);
      this.scheduleReconnect();
    }
  }

  /**
   * Make an outbound call
   */
  public async makeCall(destination: string): Promise<Inviter | null> {
    if (!this.userAgent) {
      console.error("[SIP.js WebRTC] UserAgent not initialized");
      return null;
    }

    const store = useTelnyxStore.getState();

    // Format destination number
    const digits = destination.replace(/\D/g, "");
    let formattedDest: string;
    if (digits.startsWith("1") && digits.length === 11) {
      formattedDest = `+${digits}`;
    } else if (digits.length === 10) {
      formattedDest = `+1${digits}`;
    } else {
      formattedDest = `+1${digits}`;
    }
    console.log("[SIP.js WebRTC] Calling:", formattedDest);

    // Build target URI
    const targetUri = UserAgent.makeURI(`sip:${formattedDest}@sip.telnyx.com`);
    if (!targetUri) {
      console.error("[SIP.js WebRTC] Invalid target URI");
      return null;
    }

    // CRITICAL: Zero-latency RTCConfiguration for outbound calls
    const rtcConfig = this.getZeroLatencyRTCConfig();

    const inviter = new Inviter(this.userAgent, targetUri, {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: false
        }
      },
      sessionDescriptionHandlerOptionsReInvite: {
        constraints: {
          audio: true,
          video: false
        }
      },
      extraHeaders: [
        `P-Asserted-Identity: <sip:${store.callerIdNumber || store.sipUsername}@sip.telnyx.com>`
      ]
    });

    // Inject RTCConfiguration via sessionDescriptionHandlerFactory options
    (inviter as any).sessionDescriptionHandlerOptions = {
      ...((inviter as any).sessionDescriptionHandlerOptions || {}),
      peerConnectionConfiguration: rtcConfig
    };

    this.setupSessionHandlers(inviter, true);
    store.setOutgoingCall(inviter);
    this.startRingback();

    try {
      await inviter.invite();
      console.log("[SIP.js WebRTC] INVITE sent");
      return inviter;
    } catch (error) {
      console.error("[SIP.js WebRTC] Call failed:", error);
      this.stopRingback();
      store.setOutgoingCall(undefined);
      return null;
    }
  }

  /**
   * Answer an incoming call
   */
  public async answerCall(): Promise<void> {
    const store = useTelnyxStore.getState();
    const invitation = store.incomingCall;
    
    if (!invitation) {
      console.warn("[SIP.js WebRTC] No incoming call to answer");
      return;
    }

    console.log("[SIP.js WebRTC] Answering call...");
    this.stopRingtone();

    // Wake up AudioContext for instant audio
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          await ctx.resume();
          console.log("[SIP.js WebRTC] AudioContext resumed");
        }
      }
    } catch (e) {
      console.warn("[SIP.js WebRTC] Error waking AudioContext:", e);
    }

    // CRITICAL: Zero-latency RTCConfiguration for answer
    const rtcConfig = this.getZeroLatencyRTCConfig();

    try {
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        } as any
      });
      console.log("[SIP.js WebRTC] Call answered");
    } catch (error) {
      console.error("[SIP.js WebRTC] Answer failed:", error);
    }
  }

  /**
   * Reject an incoming call
   */
  public rejectCall(): void {
    const store = useTelnyxStore.getState();
    const invitation = store.incomingCall;
    
    if (!invitation) return;

    console.log("[SIP.js WebRTC] Rejecting call");
    this.stopRingtone();
    invitation.reject({ statusCode: 486 });
    store.setIncomingCall(undefined);
  }

  /**
   * Hang up the current call
   */
  public async hangup(): Promise<void> {
    const store = useTelnyxStore.getState();
    
    const activeSession = store.currentCall || store.outgoingCall || store.incomingCall;
    if (!activeSession) {
      console.log("[SIP.js WebRTC] No active call to hang up");
      store.setCurrentCall(undefined);
      store.setOutgoingCall(undefined);
      store.setIncomingCall(undefined);
      store.setCallActiveTimestamp(undefined);
      store.setActiveTelnyxLegId(undefined);
      this.stopRingtone();
      this.stopRingback();
      return;
    }

    console.log("[SIP.js WebRTC] Hanging up call, state:", activeSession.state);

    // Clean UI states immediately
    store.setCurrentCall(undefined);
    store.setOutgoingCall(undefined);
    store.setIncomingCall(undefined);
    store.setCallActiveTimestamp(undefined);
    store.setActiveTelnyxLegId(undefined);
    this.stopRingtone();
    this.stopRingback();

    try {
      // Handle based on session state
      switch (activeSession.state) {
        case SessionState.Initial:
        case SessionState.Establishing:
          // Cancel outgoing call
          if (activeSession instanceof Inviter) {
            await activeSession.cancel();
          } else if (activeSession instanceof Invitation) {
            activeSession.reject({ statusCode: 486 });
          }
          break;
        case SessionState.Established:
          // Terminate established call with BYE
          await activeSession.bye();
          break;
        default:
          console.log("[SIP.js WebRTC] Call in terminal state, no action needed");
      }
    } catch (e) {
      console.error("[SIP.js WebRTC] Hangup error:", e);
    }
  }

  /**
   * Toggle mute
   */
  public toggleMute(): void {
    const store = useTelnyxStore.getState();
    const session = store.currentCall;

    if (!session || !session.sessionDescriptionHandler) return;

    const pc = (session.sessionDescriptionHandler as any).peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;

    const senders = pc.getSenders();
    const audioSender = senders.find(s => s.track?.kind === "audio");
    
    if (audioSender && audioSender.track) {
      const newMutedState = !store.isMuted;
      audioSender.track.enabled = !newMutedState;
      store.setMuted(newMutedState);
      console.log("[SIP.js WebRTC] Mute toggled:", newMutedState);
    }
  }

  /**
   * Toggle hold (using sendonly/inactive SDP)
   */
  public toggleHold(): void {
    const store = useTelnyxStore.getState();
    const session = store.currentCall;

    if (!session) return;

    // SIP.js doesn't have built-in hold - we'd need to send re-INVITE
    // For now, just toggle the state and mute audio
    const newHoldState = !store.isOnHold;
    store.setOnHold(newHoldState);
    
    // Mute/unmute as a workaround
    const pc = (session.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
    if (pc) {
      pc.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.enabled = !newHoldState;
        }
      });
    }
    
    console.log("[SIP.js WebRTC] Hold toggled:", newHoldState);
  }

  /**
   * Send DTMF digit
   */
  public sendDTMF(digit: string): void {
    const store = useTelnyxStore.getState();
    const session = store.currentCall;

    if (!session || !session.sessionDescriptionHandler) {
      console.warn("[SIP.js WebRTC] No session for DTMF");
      return;
    }

    const pc = (session.sessionDescriptionHandler as any).peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;

    // Find audio sender and use DTMF sender
    const audioSender = pc.getSenders().find(s => s.track?.kind === "audio");
    if (audioSender && audioSender.dtmf) {
      audioSender.dtmf.insertDTMF(digit, 100, 70);
      console.log("[SIP.js WebRTC] DTMF sent:", digit);
    } else {
      // Fallback: Send via SIP INFO
      try {
        session.info({
          requestOptions: {
            body: {
              contentDisposition: "render",
              contentType: "application/dtmf-relay",
              content: `Signal=${digit}\nDuration=100`
            }
          }
        });
        console.log("[SIP.js WebRTC] DTMF sent via INFO:", digit);
      } catch (e) {
        console.error("[SIP.js WebRTC] DTMF INFO failed:", e);
      }
    }
  }

  /**
   * Blind transfer
   */
  public blindTransfer(destinationNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const session = store.currentCall;

    if (!session) return false;

    try {
      console.log("[SIP.js WebRTC] Blind transfer to:", destinationNumber);
      const targetUri = UserAgent.makeURI(`sip:${destinationNumber}@sip.telnyx.com`);
      if (targetUri) {
        session.refer(targetUri);
        store.setCurrentCall(undefined);
        store.setMuted(false);
        store.setOnHold(false);
        return true;
      }
    } catch (error) {
      console.error("[SIP.js WebRTC] Blind transfer failed:", error);
    }
    return false;
  }

  /**
   * Start attended transfer (put on hold, call consult number)
   */
  public async startAttendedTransfer(consultNumber: string): Promise<boolean> {
    if (!this.userAgent) return false;

    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (!currentCall) return false;

    try {
      console.log("[SIP.js WebRTC] Starting attended transfer");
      this.toggleHold(); // Put current call on hold
      store.setConsulting(true);

      const consultCall = await this.makeCall(consultNumber);
      if (consultCall) {
        store.setConsultCall(consultCall);
        return true;
      }
    } catch (error) {
      console.error("[SIP.js WebRTC] Start attended transfer failed:", error);
      this.toggleHold(); // Resume call if consult fails
      store.setConsulting(false);
    }
    return false;
  }

  /**
   * Complete attended transfer
   */
  public completeAttendedTransfer(consultNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    const consultCall = store.consultCall;

    if (!currentCall) return false;

    try {
      console.log("[SIP.js WebRTC] Completing attended transfer");
      if (consultCall) {
        consultCall.bye().catch(console.error);
      }
      this.blindTransfer(consultNumber);

      store.setConsultCall(undefined);
      store.setCurrentCall(undefined);
      store.setConsulting(false);
      store.setOnHold(false);
      store.setMuted(false);
      return true;
    } catch (error) {
      console.error("[SIP.js WebRTC] Complete attended transfer failed:", error);
      return false;
    }
  }

  /**
   * Cancel attended transfer
   */
  public cancelAttendedTransfer(): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    const consultCall = store.consultCall;

    if (!currentCall) return false;

    try {
      console.log("[SIP.js WebRTC] Canceling attended transfer");
      if (consultCall) {
        consultCall.bye().catch(console.error);
      }
      this.toggleHold(); // Resume current call

      store.setConsultCall(undefined);
      store.setConsulting(false);
      return true;
    } catch (error) {
      console.error("[SIP.js WebRTC] Cancel attended transfer failed:", error);
      return false;
    }
  }

  /**
   * Get call quality metrics from peer connection stats
   */
  public getCallQuality(): void {
    const store = useTelnyxStore.getState();
    const session = store.currentCall;

    if (!session || !session.sessionDescriptionHandler) {
      store.setNetworkQuality(undefined);
      return;
    }

    const pc = (session.sessionDescriptionHandler as any).peerConnection as RTCPeerConnection | undefined;
    if (!pc) {
      store.setNetworkQuality(undefined);
      return;
    }

    pc.getStats().then((stats) => {
      let jitter = 0;
      let packetLoss = 0;
      let rtt = 0;

      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.kind === "audio") {
          jitter = report.jitter ? report.jitter * 1000 : 0;
          packetLoss = report.packetsLost || 0;
        }
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
        }
      });

      // Calculate MOS (simplified)
      let mos = 4.5;
      if (jitter > 30) mos -= 0.5;
      if (jitter > 50) mos -= 0.5;
      if (packetLoss > 1) mos -= 0.3;
      if (packetLoss > 5) mos -= 0.5;
      if (rtt > 200) mos -= 0.3;
      mos = Math.max(1, Math.min(5, mos));

      let qualityLevel: "excellent" | "good" | "poor" = "excellent";
      if (mos < 3.0 || packetLoss > 5) {
        qualityLevel = "poor";
      } else if (mos < 4.0 || packetLoss > 1) {
        qualityLevel = "good";
      }

      store.setNetworkQuality({ mos, jitter, packetLoss, rtt, qualityLevel });
    }).catch(() => {
      store.setNetworkQuality(undefined);
    });
  }

  /**
   * Pre-warm ICE (optional - for faster first call)
   */
  public async preWarm(): Promise<void> {
    console.log("[SIP.js WebRTC] Pre-warm requested (handled by session creation)");
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

  /**
   * Disconnect and cleanup
   */
  public disconnect(): void {
    if (this.registerer) {
      try {
        this.registerer.unregister().catch(console.error);
      } catch (e) {
        console.warn("[SIP.js WebRTC] Unregister error:", e);
      }
      this.registerer = null;
    }

    if (this.userAgent) {
      try {
        this.userAgent.stop().catch(console.error);
      } catch (e) {
        console.warn("[SIP.js WebRTC] Stop error:", e);
      }
      this.userAgent = null;
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
    return this.userAgent !== null;
  }

  public getClient(): UserAgent | null {
    return this.userAgent;
  }
}

export const telnyxWebRTC = TelnyxWebRTCManager.getInstance();
