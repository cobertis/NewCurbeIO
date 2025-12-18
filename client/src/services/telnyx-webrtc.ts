// ============================================================================
//  TELNYX WEBRTC – CURBE VOICE (SIP.JS IMPLEMENTATION)
//  Pure SIP.js implementation with zero-latency ICE configuration
//  Server: wss://rtc.telnyx.com:443
// ============================================================================

import { UserAgent, Registerer, Inviter, Invitation, SessionState, Session, RegistererState } from "sip.js";
import { create } from "zustand";
import { useExtensionCallStore } from "@/stores/extensionCallStore";

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
// WEBSOCKET MESSAGE INTERCEPTOR
// ============================================================================
// This class wraps the WebSocket to rewrite incoming INVITE Request-URIs
// When Telnyx sends calls directly to the DID (e.g., sip:13058423033@...)
// instead of the SIP username (sip:curbeb5325600gm3h@...), SIP.js rejects
// with 404. This interceptor rewrites the Request-URI to match our registered user.
class SipWebSocketInterceptor {
  private static registeredUser: string | null = null;
  private static originalWebSocket: typeof WebSocket | null = null;
  private static isInstalled = false;
  
  static install(sipUsername: string) {
    if (this.isInstalled) {
      this.registeredUser = sipUsername;
      return;
    }
    
    this.registeredUser = sipUsername;
    this.originalWebSocket = window.WebSocket;
    
    const interceptor = this;
    
    // Create intercepting WebSocket class
    window.WebSocket = class InterceptedWebSocket extends EventTarget {
      private ws: WebSocket;
      public binaryType: BinaryType = "blob";
      public bufferedAmount: number = 0;
      public extensions: string = "";
      public protocol: string = "";
      public readyState: number = WebSocket.CONNECTING;
      public url: string;
      
      public onopen: ((this: WebSocket, ev: Event) => any) | null = null;
      public onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
      public onerror: ((this: WebSocket, ev: Event) => any) | null = null;
      public onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
      
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      
      constructor(url: string | URL, protocols?: string | string[]) {
        super();
        this.url = url.toString();
        this.ws = new interceptor.originalWebSocket!(url, protocols);
        this.ws.binaryType = this.binaryType;
        
        this.ws.onopen = (ev) => {
          this.readyState = this.ws.readyState;
          this.protocol = this.ws.protocol;
          this.extensions = this.ws.extensions;
          if (this.onopen) this.onopen.call(this as any, ev);
          this.dispatchEvent(new Event("open"));
        };
        
        this.ws.onclose = (ev) => {
          this.readyState = this.ws.readyState;
          if (this.onclose) this.onclose.call(this as any, ev);
          this.dispatchEvent(new CloseEvent("close", ev));
        };
        
        this.ws.onerror = (ev) => {
          this.readyState = this.ws.readyState;
          if (this.onerror) this.onerror.call(this as any, ev);
          this.dispatchEvent(new Event("error"));
        };
        
        this.ws.onmessage = (ev) => {
          this.readyState = this.ws.readyState;
          let data = ev.data;
          
          // DEBUG: Log all SIP messages for Telnyx to detect incoming calls
          if (this.url.includes("telnyx.com") && typeof data === "string") {
            // Check if this is a SIP message (starts with method or SIP/2.0)
            const firstLine = data.split("\r\n")[0] || data.split("\n")[0] || "";
            if (firstLine.includes("SIP/2.0") || /^[A-Z]+\s+sip:/.test(firstLine)) {
              console.log("[SIP.js WS] <<< Received SIP message:", firstLine);
              
              // Specifically check for INVITE
              if (data.includes("INVITE sip:") || firstLine.startsWith("INVITE")) {
                console.log("[SIP.js WS] *** INCOMING INVITE DETECTED ***");
                console.log("[SIP.js WS] Full INVITE message (first 500 chars):", data.substring(0, 500));
              }
            }
            
            // Rewrite Request-URI for INVITE messages directed at DID instead of SIP username
            if (data.startsWith("INVITE")) {
              data = interceptor.rewriteInviteRequestUri(data);
            }
          }
          
          const newEvent = new MessageEvent("message", { data });
          if (this.onmessage) this.onmessage.call(this as any, newEvent);
          this.dispatchEvent(newEvent);
        };
      }
      
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        this.ws.send(data);
      }
      
      close(code?: number, reason?: string) {
        this.ws.close(code, reason);
      }
    } as any;
    
    this.isInstalled = true;
    console.log("[SIP.js WebRTC] WebSocket interceptor installed for Request-URI rewriting");
  }
  
  static uninstall() {
    if (this.originalWebSocket) {
      window.WebSocket = this.originalWebSocket;
      this.isInstalled = false;
    }
  }
  
  private static rewriteInviteRequestUri(message: string): string {
    if (!this.registeredUser) return message;
    
    // Match INVITE request line: INVITE sip:XXXXXXX@domain SIP/2.0
    const inviteLineMatch = message.match(/^(INVITE sip:)([^@]+)(@[^\s]+)(\s+SIP\/2\.0)/);
    if (!inviteLineMatch) return message;
    
    const originalUser = inviteLineMatch[2];
    
    // If already matches our registered user, no change needed
    if (originalUser === this.registeredUser) return message;
    
    // Rewrite the Request-URI to use our registered username
    const newMessage = message.replace(
      inviteLineMatch[0],
      `${inviteLineMatch[1]}${this.registeredUser}${inviteLineMatch[3]}${inviteLineMatch[4]}`
    );
    
    // Also rewrite the To header to match
    const toRewritten = newMessage.replace(
      /(\r\n[tT]:\s*<sip:)([^@]+)(@[^>]+>)/,
      `$1${this.registeredUser}$3`
    );
    
    console.log(`[SIP.js WebRTC] Rewriting Request-URI: ${originalUser} -> ${this.registeredUser}`);
    
    return toRewritten;
  }
}

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

// Extended call info for UI compatibility (matches legacy SDK structure)
export interface SipCallInfo {
  remoteCallerNumber: string;
  callerName?: string;
  queueName?: string;
  ivrLanguage?: string;
  direction: "inbound" | "outbound";
  state: "ringing" | "establishing" | "active" | "terminated";
  destinationNumber?: string;
  telnyxCallLegId?: string;
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
  isAnswering: boolean; // Prevents double-click on Answer button
  callerIdNumber?: string;
  sipUsername?: string;
  networkQuality?: NetworkQualityMetrics;
  callDuration: number;
  callActiveTimestamp?: number;
  activeTelnyxLegId?: string;
  // NEW: Call info for UI compatibility
  currentCallInfo?: SipCallInfo;
  incomingCallInfo?: SipCallInfo;
  outgoingCallInfo?: SipCallInfo;

  setConnectionStatus: (status: TelnyxWebRTCState["connectionStatus"], error?: string) => void;
  setCurrentCall: (call?: Session) => void;
  setIncomingCall: (call?: Invitation) => void;
  setOutgoingCall: (call?: Inviter) => void;
  setConsultCall: (call?: Session) => void;
  setMuted: (muted: boolean) => void;
  setOnHold: (hold: boolean) => void;
  setConsulting: (consulting: boolean) => void;
  setIsAnswering: (answering: boolean) => void;
  setCallerIdNumber: (number: string) => void;
  setSipUsername: (username: string) => void;
  setNetworkQuality: (metrics?: NetworkQualityMetrics) => void;
  setCallDuration: (duration: number) => void;
  setCallActiveTimestamp: (timestamp?: number) => void;
  setActiveTelnyxLegId: (legId?: string) => void;
  // NEW: Call info setters
  setCurrentCallInfo: (info?: SipCallInfo) => void;
  setIncomingCallInfo: (info?: SipCallInfo) => void;
  setOutgoingCallInfo: (info?: SipCallInfo) => void;
}

export const useTelnyxStore = create<TelnyxWebRTCState>((set) => ({
  isConnected: false,
  connectionStatus: "disconnected",
  isCallActive: false,
  isMuted: false,
  isOnHold: false,
  isConsulting: false,
  isAnswering: false,
  callDuration: 0,
  callActiveTimestamp: undefined,
  activeTelnyxLegId: undefined,
  currentCallInfo: undefined,
  incomingCallInfo: undefined,
  outgoingCallInfo: undefined,

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
  setIsAnswering: (answering) => set({ isAnswering: answering }),
  setCallerIdNumber: (number) => set({ callerIdNumber: number }),
  setSipUsername: (username) => set({ sipUsername: username }),
  setNetworkQuality: (metrics) => set({ networkQuality: metrics }),
  setCallDuration: (duration) => set({ callDuration: duration }),
  setCallActiveTimestamp: (timestamp) => set({ callActiveTimestamp: timestamp }),
  setActiveTelnyxLegId: (legId) => set({ activeTelnyxLegId: legId }),
  setCurrentCallInfo: (info) => set({ currentCallInfo: info }),
  setIncomingCallInfo: (info) => set({ incomingCallInfo: info }),
  setOutgoingCallInfo: (info) => set({ outgoingCallInfo: info }),
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
  private currentSipDomain: string = "sip.telnyx.com";
  
  // CRITICAL: Local microphone stream - required for two-way audio
  private localStream: MediaStream | null = null;
  
  // Auto-reconnect state
  private savedCredentials: { sipUser: string; sipPass: string; callerId?: string; sipDomain?: string } | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting: boolean = false;
  
  // Call logging state
  private currentSipCallId: string | null = null;
  private callStartTime: Date | null = null;
  private callAnswerTime: Date | null = null;
  private callLogId: string | null = null;
  private callWasAnswered: boolean = false;
  private currentTelnyxLegId: string | null = null;

  private constructor() {
    // CRITICAL: Create audio element immediately in constructor
    // This ensures it exists before any call attempt
    this.audioElement = document.createElement('audio');
    this.audioElement.id = 'telnyx-remote-audio-programmatic';
    this.audioElement.autoplay = true;
    this.audioElement.setAttribute('playsinline', 'true');
    this.audioElement.style.display = 'none';
    document.body.appendChild(this.audioElement);
    console.log("[SIP.js WebRTC] Audio element created in constructor");

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

  // ============================================================================
  // MICROPHONE CAPTURE - CRITICAL FOR TWO-WAY AUDIO
  // ============================================================================
  
  /**
   * Capture microphone audio - REQUIRED for outbound audio to work
   * Must be called before making or answering calls
   */
  private async captureLocalAudio(): Promise<MediaStream | null> {
    // If we already have an active stream, return it
    if (this.localStream && this.localStream.active) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
        console.log("[SIP.js WebRTC] Reusing existing local audio stream");
        return this.localStream;
      }
    }

    try {
      console.log("[SIP.js WebRTC] Capturing microphone audio...");
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      const audioTracks = this.localStream.getAudioTracks();
      console.log("[SIP.js WebRTC] Microphone captured successfully:", {
        tracks: audioTracks.length,
        trackLabel: audioTracks[0]?.label,
        trackEnabled: audioTracks[0]?.enabled,
        trackReadyState: audioTracks[0]?.readyState
      });
      
      return this.localStream;
    } catch (error) {
      console.error("[SIP.js WebRTC] Failed to capture microphone:", error);
      // Show user-friendly error
      const err = error as Error;
      if (err.name === 'NotAllowedError') {
        console.error("[SIP.js WebRTC] Microphone permission denied by user");
      } else if (err.name === 'NotFoundError') {
        console.error("[SIP.js WebRTC] No microphone found");
      }
      return null;
    }
  }

  /**
   * Stop local audio stream when call ends
   */
  private stopLocalAudio(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log("[SIP.js WebRTC] Stopped local audio track:", track.label);
      });
      this.localStream = null;
    }
  }

  // ============================================================================
  // CALL LOGGING FUNCTIONS
  // ============================================================================
  
  /**
   * Generate unique SIP call ID for tracking
   */
  private generateSipCallId(): string {
    return `sip-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Reset call logging state
   */
  private resetCallLoggingState(): void {
    this.currentSipCallId = null;
    this.callStartTime = null;
    this.callAnswerTime = null;
    this.callLogId = null;
    this.callWasAnswered = false;
    this.currentTelnyxLegId = null;
  }
  
  /**
   * Create call log entry when call starts
   */
  private async logCallStart(callInfo: SipCallInfo): Promise<void> {
    try {
      this.currentSipCallId = this.generateSipCallId();
      this.callStartTime = new Date();
      this.callWasAnswered = false;
      
      // Store the Telnyx Leg ID from call info (for inbound calls)
      if (callInfo.telnyxCallLegId) {
        this.currentTelnyxLegId = callInfo.telnyxCallLegId;
      }
      
      const store = useTelnyxStore.getState();
      const fromNumber = callInfo.direction === "outbound" 
        ? (store.callerIdNumber || "Unknown")
        : callInfo.remoteCallerNumber;
      const toNumber = callInfo.direction === "outbound" 
        ? callInfo.remoteCallerNumber 
        : (store.callerIdNumber || "Unknown");
      
      console.log(`[SIP.js CallLog] Creating call log: ${callInfo.direction} from ${fromNumber} to ${toNumber}, telnyxLegId: ${this.currentTelnyxLegId || "pending"}`);
      
      const response = await fetch("/api/call-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sipCallId: this.currentSipCallId,
          fromNumber,
          toNumber,
          direction: callInfo.direction,
          status: "ringing",
          callerName: callInfo.callerName || null,
          startedAt: this.callStartTime.toISOString(),
          telnyxCallId: this.currentTelnyxLegId || null,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.callLogId = data.id;
        console.log(`[SIP.js CallLog] Call log created: ${this.callLogId}`);
      } else {
        console.error(`[SIP.js CallLog] Failed to create call log: ${response.status}`);
      }
    } catch (error) {
      console.error("[SIP.js CallLog] Error creating call log:", error);
    }
  }
  
  /**
   * Update call log when call is answered
   * Also updates telnyxCallId if it wasn't available at call start (e.g., outbound calls)
   */
  private async logCallAnswered(): Promise<void> {
    if (!this.callLogId) {
      console.warn("[SIP.js CallLog] No call log ID to update for answered");
      return;
    }
    
    try {
      this.callAnswerTime = new Date();
      this.callWasAnswered = true;
      
      console.log(`[SIP.js CallLog] Updating call log ${this.callLogId} to answered, telnyxLegId: ${this.currentTelnyxLegId || "not available"}`);
      
      // Build update payload - include telnyxCallId if we have it now but didn't at start
      const updatePayload: Record<string, any> = {
        status: "answered",
        answeredAt: this.callAnswerTime.toISOString(),
      };
      
      // Add telnyxCallId if available (especially important for outbound calls)
      if (this.currentTelnyxLegId) {
        updatePayload.telnyxCallId = this.currentTelnyxLegId;
      }
      
      await fetch(`/api/call-logs/${this.callLogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      });
    } catch (error) {
      console.error("[SIP.js CallLog] Error updating call log to answered:", error);
    }
  }
  
  /**
   * Finalize call log when call ends
   */
  private async logCallEnd(hangupCause?: string): Promise<void> {
    if (!this.callLogId) {
      console.warn("[SIP.js CallLog] No call log ID to finalize");
      this.resetCallLoggingState();
      return;
    }
    
    try {
      const endTime = new Date();
      let duration = 0;
      let finalStatus: "answered" | "missed" | "busy" | "failed" | "no_answer" = "missed";
      
      if (this.callWasAnswered && this.callAnswerTime) {
        duration = Math.round((endTime.getTime() - this.callAnswerTime.getTime()) / 1000);
        finalStatus = "answered";
      } else if (hangupCause) {
        if (hangupCause.includes("busy") || hangupCause === "486") {
          finalStatus = "busy";
        } else if (hangupCause.includes("no_answer") || hangupCause === "408" || hangupCause === "480") {
          finalStatus = "no_answer";
        } else if (hangupCause.includes("failed") || hangupCause.includes("error")) {
          finalStatus = "failed";
        }
      }
      
      console.log(`[SIP.js CallLog] Finalizing call log ${this.callLogId}: status=${finalStatus}, duration=${duration}s`);
      
      await fetch(`/api/call-logs/${this.callLogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: finalStatus,
          duration,
          endedAt: endTime.toISOString(),
          hangupCause: hangupCause || "normal_clearing",
        }),
      });
    } catch (error) {
      console.error("[SIP.js CallLog] Error finalizing call log:", error);
    } finally {
      this.resetCallLoggingState();
    }
  }

  /**
   * Build zero-latency ICE configuration
   * Forces TURN relay with localhost STUN blackhole for instant failover
   */
  private getZeroLatencyRTCConfig(): RTCConfiguration {
    // Use "all" policy to allow host/srflx candidates while TURN resolves
    // This ensures we get SOME candidates even if TURN is slow
    const iceServers: RTCIceServer[] = [
      // Telnyx public STUN for fast host/srflx candidates
      { urls: "stun:stun.telnyx.com:3478" },
      // Add dynamic TURN servers from credentials
      ...this.turnServers
    ];
    
    const config: RTCConfiguration = {
      iceTransportPolicy: "all", // Allow all candidate types for reliability
      iceServers,
      bundlePolicy: "balanced",
      rtcpMuxPolicy: "negotiate" as RTCRtcpMuxPolicy // CRITICAL: Must be "negotiate" to accept SDPs without a=rtcp-mux
    };
    
    console.log("[SIP.js WebRTC] ICE config:", JSON.stringify({
      iceTransportPolicy: config.iceTransportPolicy,
      iceServersCount: config.iceServers?.length,
      turnServersCount: this.turnServers.length
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
            this.savedCredentials.callerId,
            undefined,
            this.savedCredentials.sipDomain
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
   * Called when session is Established - delegates to setupAudioOnPeerConnection
   */
  private setupRemoteAudio(session: Session): void {
    console.log("[SIP.js WebRTC] setupRemoteAudio called");
    // Use the improved method that handles ontrack properly
    this.setupAudioOnPeerConnection(session);
  }

  /**
   * Extract caller info from SIP.js session for UI compatibility
   */
  private extractCallerInfo(session: Session, isOutgoing: boolean, destination?: string): SipCallInfo {
    let callerNumber = "Unknown";
    let callerName: string | undefined;
    let queueName: string | undefined;
    let ivrLanguage: string | undefined;
    let telnyxCallLegId: string | undefined;
    
    if (session instanceof Invitation) {
      // Incoming call - check for custom headers (set by backend for queue calls)
      try {
        const request = session.request;
        
        // Check for X-Original-Caller header (the actual caller's phone number)
        const originalCaller = request.getHeader("X-Original-Caller");
        if (originalCaller && originalCaller !== "Unknown") {
          callerNumber = originalCaller;
          console.log("[SIP.js WebRTC] Found X-Original-Caller header:", originalCaller);
        }
        
        // Check for X-Queue-Name header (the queue this call came from)
        const xQueueName = request.getHeader("X-Queue-Name");
        if (xQueueName) {
          queueName = xQueueName;
          console.log("[SIP.js WebRTC] Found X-Queue-Name header:", xQueueName);
        }
        
        // Check for X-IVR-Language header (language of the IVR the caller used)
        const xIvrLanguage = request.getHeader("X-IVR-Language");
        if (xIvrLanguage) {
          ivrLanguage = xIvrLanguage;
          console.log("[SIP.js WebRTC] Found X-IVR-Language header:", xIvrLanguage);
        }
      } catch (e) {
        console.warn("[SIP.js WebRTC] Error reading custom headers:", e);
      }
      
      // Fallback to remoteIdentity if no custom header
      if (callerNumber === "Unknown") {
        try {
          const remoteUri = session.remoteIdentity?.uri;
          if (remoteUri) {
            callerNumber = remoteUri.user || "Unknown";
          }
          callerName = session.remoteIdentity?.displayName || undefined;
        } catch (e) {
          console.warn("[SIP.js WebRTC] Error extracting remoteIdentity:", e);
        }
      }
      
      // Fallback: parse From header
      if (callerNumber === "Unknown") {
        try {
          const request = session.request;
          const fromHeader = request.getHeader("From") || "";
          const nameMatch = fromHeader.match(/^"([^"]+)"/);
          if (nameMatch) callerName = nameMatch[1];
          const numberMatch = fromHeader.match(/<sip:([^@]+)@/);
          if (numberMatch) callerNumber = numberMatch[1];
        } catch (e) {
          console.warn("[SIP.js WebRTC] Error parsing From header:", e);
        }
      }
      
      // Also try to get caller name from P-Asserted-Identity or From header
      if (!callerName) {
        try {
          const request = session.request;
          const pAsserted = request.getHeader("P-Asserted-Identity") || "";
          const fromHeader = request.getHeader("From") || "";
          const nameMatch = (pAsserted || fromHeader).match(/^"([^"]+)"/);
          if (nameMatch && nameMatch[1] !== callerNumber) {
            callerName = nameMatch[1];
          }
        } catch (e) {}
      }
      
      // Try to extract Telnyx Call Leg ID from SIP headers (INBOUND calls)
      try {
        const request = session.request;
        // Log all available headers for debugging
        console.log("[SIP.js WebRTC] Checking for Telnyx headers in INVITE request...");
        
        // Telnyx sends these headers in the INVITE
        telnyxCallLegId = request.getHeader("X-Telnyx-Call-Control-Id") || 
                          request.getHeader("X-Telnyx-Call-Leg-Id") ||
                          request.getHeader("X-Call-Control-Id") ||
                          request.getHeader("X-Telnyx-Leg-Id");
        
        if (telnyxCallLegId) {
          console.log("[SIP.js WebRTC] Found Telnyx Call Leg ID:", telnyxCallLegId);
          this.currentTelnyxLegId = telnyxCallLegId;
        } else {
          console.log("[SIP.js WebRTC] No Telnyx Call Leg ID found in INVITE headers");
          // Log some header values for debugging
          const callId = request.getHeader("Call-ID");
          const xHeaders = request.getHeader("X-Telnyx-Connection-Id");
          console.log("[SIP.js WebRTC] Debug - Call-ID:", callId, "X-Telnyx-Connection-Id:", xHeaders);
        }
      } catch (e) {
        console.warn("[SIP.js WebRTC] Error extracting Telnyx Call Leg ID:", e);
      }
    } else if (session instanceof Inviter) {
      callerNumber = destination || "Unknown";
      // For outbound calls, Telnyx Call Leg ID comes in the 200 OK response
      // It will be extracted in setupSessionHandlers when call is Established
    }
    
    // Format caller number
    const cleanNumber = callerNumber.replace(/^\+?1?/, "");
    const formattedNumber = callerNumber.startsWith("+") ? callerNumber : 
                            (cleanNumber.length === 10 ? `+1${cleanNumber}` : callerNumber);
    
    console.log("[SIP.js WebRTC] Extracted caller info:", { 
      callerNumber: formattedNumber, 
      callerName,
      queueName,
      ivrLanguage,
      isOutgoing, 
      telnyxCallLegId: telnyxCallLegId || "not found" 
    });
    
    return {
      remoteCallerNumber: formattedNumber,
      callerName,
      queueName,
      ivrLanguage,
      direction: isOutgoing ? "outbound" : "inbound",
      state: "ringing",
      destinationNumber: isOutgoing ? destination : undefined,
      telnyxCallLegId
    };
  }

  /**
   * Handle session state changes
   */
  private setupSessionHandlers(session: Session, isOutgoing: boolean, destination?: string): void {
    const store = useTelnyxStore.getState();
    
    // Extract call info for UI
    const callInfo = this.extractCallerInfo(session, isOutgoing, destination);
    
    // Log call start when session is created (ringing/establishing phase)
    this.logCallStart(callInfo);

    session.stateChange.addListener((state: SessionState) => {
      console.log("[SIP.js WebRTC] Session state changed:", state);

      switch (state) {
        case SessionState.Establishing:
          console.log("[SIP.js WebRTC] Call establishing...");
          callInfo.state = "establishing";
          if (isOutgoing) {
            store.setOutgoingCallInfo({ ...callInfo });
          } else {
            store.setIncomingCallInfo({ ...callInfo });
          }
          break;

        case SessionState.Established:
          console.log("[SIP.js WebRTC] Call established");
          this.stopRingtone();
          this.stopRingback();
          
          // For OUTBOUND calls, try to extract Telnyx Call Leg ID from 200 OK response
          if (isOutgoing && session instanceof Inviter) {
            try {
              console.log("[SIP.js WebRTC] Checking for Telnyx headers in 200 OK response (outbound call)...");
              
              // In SIP.js, we can try to access dialog info or the session's message
              const dialog = (session as any).dialog;
              if (dialog) {
                console.log("[SIP.js WebRTC] Dialog found, checking for response headers...");
                
                // Try to get the response from the dialog
                const response = dialog.initialResponse || dialog.lastResponse;
                if (response && typeof response.getHeader === 'function') {
                  const telnyxLegId = response.getHeader("X-Telnyx-Call-Control-Id") || 
                                      response.getHeader("X-Telnyx-Call-Leg-Id") ||
                                      response.getHeader("X-Call-Control-Id") ||
                                      response.getHeader("X-Telnyx-Leg-Id");
                  
                  if (telnyxLegId) {
                    console.log("[SIP.js WebRTC] Found Telnyx Call Leg ID in 200 OK:", telnyxLegId);
                    this.currentTelnyxLegId = telnyxLegId;
                    callInfo.telnyxCallLegId = telnyxLegId;
                  } else {
                    console.log("[SIP.js WebRTC] No Telnyx Call Leg ID in 200 OK response headers");
                  }
                }
              }
              
              // Alternative: Try to check if there's a _acceptedResponse property
              const acceptedResponse = (session as any)._acceptedResponse || (session as any).acceptedResponse;
              if (acceptedResponse && !this.currentTelnyxLegId) {
                console.log("[SIP.js WebRTC] Checking _acceptedResponse for Telnyx headers...");
                const telnyxLegId = acceptedResponse.getHeader?.("X-Telnyx-Call-Control-Id") || 
                                    acceptedResponse.getHeader?.("X-Telnyx-Call-Leg-Id");
                if (telnyxLegId) {
                  console.log("[SIP.js WebRTC] Found Telnyx Call Leg ID in acceptedResponse:", telnyxLegId);
                  this.currentTelnyxLegId = telnyxLegId;
                  callInfo.telnyxCallLegId = telnyxLegId;
                }
              }
              
              // Debug: Log what's available on the session for future reference
              if (!this.currentTelnyxLegId) {
                console.log("[SIP.js WebRTC] Debug - Session keys:", Object.keys(session));
                if (dialog) {
                  console.log("[SIP.js WebRTC] Debug - Dialog keys:", Object.keys(dialog));
                }
              }
            } catch (e) {
              console.warn("[SIP.js WebRTC] Error extracting Telnyx Call Leg ID from 200 OK:", e);
            }
          }
          
          callInfo.state = "active";
          store.setCurrentCall(session);
          store.setCurrentCallInfo({ ...callInfo });
          store.setIncomingCall(undefined);
          store.setOutgoingCall(undefined);
          store.setIncomingCallInfo(undefined);
          store.setOutgoingCallInfo(undefined);
          store.setCallActiveTimestamp(Date.now());
          store.setMuted(false);
          store.setOnHold(false);
          
          // Update store with Telnyx Leg ID if found
          if (this.currentTelnyxLegId) {
            store.setActiveTelnyxLegId(this.currentTelnyxLegId);
          }
          
          this.setupRemoteAudio(session);
          // Log call answered (will include telnyxCallId if available now)
          this.logCallAnswered();
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
          store.setCurrentCallInfo(undefined);
          store.setIncomingCallInfo(undefined);
          store.setOutgoingCallInfo(undefined);
          store.setCallActiveTimestamp(undefined);
          store.setActiveTelnyxLegId(undefined);
          store.setMuted(false);
          store.setOnHold(false);
          // Log call end with final status
          this.logCallEnd();
          break;
      }
    });
  }

  /**
   * Handle incoming call (Invitation)
   */
  private handleIncomingCall(invitation: Invitation): void {
    const store = useTelnyxStore.getState();
    
    // Extract caller info using the standard method
    const callInfo = this.extractCallerInfo(invitation, false);
    
    console.log("[SIP.js WebRTC] Incoming call from:", callInfo.remoteCallerNumber, "Name:", callInfo.callerName);
    
    // Check if this is a queue call that was already accepted via WebSocket
    // If so, auto-answer immediately without showing incoming call UI
    const extStore = useExtensionCallStore.getState();
    
    if (extStore.pendingQueueCallAutoAnswer) {
      console.log("[SIP.js WebRTC] Auto-answering queue call (already accepted via WebSocket)");
      extStore.setPendingQueueCallAutoAnswer(false);
      
      // Set the invitation in store so answerCall() can use it
      store.setIncomingCall(invitation);
      store.setIncomingCallInfo(callInfo);
      
      // Setup handlers first
      this.setupSessionHandlers(invitation, false);
      
      // Auto-answer the call immediately (async, don't await)
      this.answerCall().catch(e => console.error("[SIP.js WebRTC] Auto-answer failed:", e));
      return;
    }
    
    // Set both the invitation AND the call info for UI
    store.setIncomingCall(invitation);
    store.setIncomingCallInfo(callInfo);
    this.startRingtone();
    
    // Setup handlers for incoming call
    this.setupSessionHandlers(invitation, false);
    
    // Handle cancel/bye before answer
    invitation.stateChange.addListener((state) => {
      if (state === SessionState.Terminated) {
        this.stopRingtone();
        store.setIncomingCall(undefined);
        store.setIncomingCallInfo(undefined);
      }
    });
  }

  /**
   * Initialize SIP.js UserAgent and connect to Telnyx
   */
  public async initialize(sipUser: string, sipPass: string, callerId?: string, iceServers?: RTCIceServer[], sipDomain?: string): Promise<void> {
    const store = useTelnyxStore.getState();
    store.setConnectionStatus("connecting");

    // Save credentials for auto-reconnect
    this.savedCredentials = { sipUser, sipPass, callerId, sipDomain };
    this.currentSipDomain = sipDomain || "sip.telnyx.com";
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

    // Build SIP URI - must use credential username for registration
    const uri = UserAgent.makeURI(`sip:${sipUser}@${this.currentSipDomain}`);
    if (!uri) {
      store.setConnectionStatus("error", "Invalid SIP URI");
      return;
    }
    
    // Install WebSocket interceptor to rewrite Request-URI for direct inward dial
    // This allows calls to the DID number to be accepted by SIP.js
    SipWebSocketInterceptor.install(sipUser);
    
    console.log("[SIP.js WebRTC] Using URI:", uri.toString());

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
          },
          // Disable Trickle ICE - include candidates in initial SDP
          disableTrickleIce: true,
          // Ultra-fast timeout - host candidates ready in ~50ms
          iceGatheringTimeout: 200
        },
        // Contact name for SIP REGISTER - must use credential username
        // even though URI uses DID for accepting inbound calls
        contactName: sipUser,
        // Store the original caller ID for later use
        userAgentString: `SIP.js/0.21.1 Curbe/${callerId || sipUser}`,
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

    // Build target URI - CRITICAL: Use sip.telnyx.com for outbound PSTN calls
    // The company subdomain (e.g., curbe-io.sip.telnyx.com) routes calls to the Call Control App
    // which creates a loop. For PSTN calls, we must use the main Telnyx SIP domain.
    const outboundSipDomain = "sip.telnyx.com";
    const targetUri = UserAgent.makeURI(`sip:${formattedDest}@${outboundSipDomain}`);
    if (!targetUri) {
      console.error("[SIP.js WebRTC] Invalid target URI");
      return null;
    }

    // =========================================================================
    // CRITICAL: Capture microphone BEFORE making the call
    // Without this, SDP negotiation fails and there's no two-way audio
    // =========================================================================
    console.log("[SIP.js WebRTC] Capturing microphone before call...");
    const localStream = await this.captureLocalAudio();
    if (!localStream) {
      console.error("[SIP.js WebRTC] Cannot make call without microphone access");
      return null;
    }
    console.log("[SIP.js WebRTC] Microphone ready, proceeding with call");

    // CRITICAL: Zero-latency RTCConfiguration for outbound calls
    const rtcConfig = this.getZeroLatencyRTCConfig();

    // CRITICAL: Ensure audio element exists BEFORE making the call
    if (!this.audioElement) {
      const audioElements = ensureTelnyxAudioElements();
      this.audioElement = audioElements.remote;
    }

    const inviter = new Inviter(this.userAgent, targetUri, {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: false
        },
        peerConnectionConfiguration: rtcConfig
      } as any,
      sessionDescriptionHandlerOptionsReInvite: {
        constraints: {
          audio: true,
          video: false
        },
        peerConnectionConfiguration: rtcConfig
      } as any,
      extraHeaders: [
        `P-Asserted-Identity: <sip:${store.callerIdNumber || store.sipUsername}@${this.currentSipDomain}>`
      ]
    });

    // Setup handlers with destination for caller info extraction
    this.setupSessionHandlers(inviter, true, formattedDest);
    
    // Set both the inviter AND the call info for UI
    const callInfo = this.extractCallerInfo(inviter, true, formattedDest);
    store.setOutgoingCall(inviter);
    store.setOutgoingCallInfo(callInfo);
    this.startRingback();

    // CRITICAL FIX: Set up audio handler BEFORE invite() by polling for peer connection
    // This ensures we don't miss ontrack events that fire during SDP negotiation
    let audioSetupAttempts = 0;
    const maxAudioSetupAttempts = 50; // 5 seconds max
    const audioSetupInterval = setInterval(() => {
      audioSetupAttempts++;
      const sdh = inviter.sessionDescriptionHandler as any;
      if (sdh?.peerConnection) {
        console.log("[SIP.js WebRTC] Peer connection available, setting up audio (attempt", audioSetupAttempts, ")");
        clearInterval(audioSetupInterval);
        this.addLocalTracksToConnection(inviter, localStream);
        this.setupAudioOnPeerConnection(inviter);
      } else if (audioSetupAttempts >= maxAudioSetupAttempts) {
        console.warn("[SIP.js WebRTC] Max audio setup attempts reached");
        clearInterval(audioSetupInterval);
      }
    }, 100);

    try {
      await inviter.invite({
        // Pass delegate to hook into sessionDescriptionHandler creation
        requestDelegate: {
          onAccept: (response) => {
            console.log("[SIP.js WebRTC] INVITE accepted (200 OK received)");
            clearInterval(audioSetupInterval); // Stop polling if still running
            // Add local audio tracks to the peer connection
            this.addLocalTracksToConnection(inviter, localStream);
            // Setup remote audio IMMEDIATELY when we get 200 OK
            this.setupAudioOnPeerConnection(inviter);
          },
          onProgress: (response) => {
            console.log("[SIP.js WebRTC] INVITE progress (18x received):", response.message.statusCode);
            // Add local audio tracks on early media too
            this.addLocalTracksToConnection(inviter, localStream);
            // Setup remote audio on provisional responses (early media)
            this.setupAudioOnPeerConnection(inviter);
          }
        }
      });
      console.log("[SIP.js WebRTC] INVITE sent");
      return inviter;
    } catch (error) {
      console.error("[SIP.js WebRTC] Call failed:", error);
      clearInterval(audioSetupInterval);
      this.stopRingback();
      this.stopLocalAudio();
      store.setOutgoingCall(undefined);
      return null;
    }
  }

  /**
   * Add local audio tracks to the peer connection
   */
  private addLocalTracksToConnection(session: Session, localStream: MediaStream): void {
    const sdh = session.sessionDescriptionHandler as any;
    if (!sdh || !sdh.peerConnection) {
      console.log("[SIP.js WebRTC] addLocalTracksToConnection: No peer connection yet");
      return;
    }

    const pc = sdh.peerConnection as RTCPeerConnection;
    
    // Check if we already have local tracks added
    const senders = pc.getSenders();
    const hasAudioSender = senders.some(s => s.track?.kind === 'audio');
    
    if (hasAudioSender) {
      console.log("[SIP.js WebRTC] Local audio track already added");
      return;
    }

    // Add local audio tracks to the connection
    localStream.getAudioTracks().forEach(track => {
      console.log("[SIP.js WebRTC] Adding local audio track to connection:", track.label);
      pc.addTrack(track, localStream);
    });
  }

  /**
   * Setup audio on peer connection - called early to catch ontrack events
   */
  private setupAudioOnPeerConnection(session: Session): void {
    const sdh = session.sessionDescriptionHandler as any;
    if (!sdh || !sdh.peerConnection) {
      console.log("[SIP.js WebRTC] setupAudioOnPeerConnection: No peer connection yet, will retry");
      return;
    }

    const pc = sdh.peerConnection as RTCPeerConnection;
    
    // Ensure audio element exists
    if (!this.audioElement) {
      const audioElements = ensureTelnyxAudioElements();
      this.audioElement = audioElements.remote;
    }
    
    const remoteAudio = this.audioElement;
    if (!remoteAudio) {
      console.error("[SIP.js WebRTC] setupAudioOnPeerConnection: No audio element!");
      return;
    }

    console.log("[SIP.js WebRTC] setupAudioOnPeerConnection: Setting up ontrack listener");

    // Helper to safely set stream and play
    const setStreamAndPlay = (stream: MediaStream, source: string) => {
      if (remoteAudio.srcObject === stream) {
        console.log(`[SIP.js WebRTC] Stream already set from ${source}, skipping`);
        return;
      }
      
      console.log(`[SIP.js WebRTC] Attaching audio stream from ${source}, tracks:`, stream.getAudioTracks().length);
      remoteAudio.srcObject = stream;
      remoteAudio.muted = false;
      remoteAudio.volume = 1.0;
      
      remoteAudio.play().then(() => {
        console.log(`[SIP.js WebRTC] Remote audio playing via ${source}`);
      }).catch(e => {
        if (e.name !== 'AbortError') {
          console.error("[SIP.js WebRTC] Audio play failed:", e);
        }
      });
    };

    // Setup ontrack listener for new tracks (this is the KEY fix)
    pc.ontrack = (event: RTCTrackEvent) => {
      console.log("[SIP.js WebRTC] ontrack event - kind:", event.track.kind, "streams:", event.streams.length);
      if (event.track.kind === 'audio') {
        if (event.streams && event.streams[0]) {
          setStreamAndPlay(event.streams[0], "ontrack-stream");
        } else {
          // Create stream from track if no streams available
          const stream = new MediaStream([event.track]);
          setStreamAndPlay(stream, "ontrack-track");
        }
      }
    };

    // Also check existing receivers (in case tracks already arrived)
    const receivers = pc.getReceivers();
    console.log("[SIP.js WebRTC] setupAudioOnPeerConnection: Checking", receivers.length, "existing receivers");
    
    for (const receiver of receivers) {
      if (receiver.track && receiver.track.kind === 'audio') {
        console.log("[SIP.js WebRTC] Found existing audio track from receiver, readyState:", receiver.track.readyState);
        const stream = new MediaStream([receiver.track]);
        setStreamAndPlay(stream, "existing-receiver");
        break;
      }
    }

    // ADDITIONAL CHECK: Look at remote streams directly (some browsers populate this)
    const remoteStreams = (pc as any).getRemoteStreams?.();
    if (remoteStreams && remoteStreams.length > 0) {
      console.log("[SIP.js WebRTC] Found", remoteStreams.length, "remote streams via getRemoteStreams()");
      for (const stream of remoteStreams) {
        if (stream.getAudioTracks().length > 0) {
          setStreamAndPlay(stream, "getRemoteStreams");
          break;
        }
      }
    }

    // RETRY MECHANISM: If no audio found yet, schedule retries
    if (!remoteAudio.srcObject) {
      let retryCount = 0;
      const maxRetries = 20;
      const retryInterval = setInterval(() => {
        retryCount++;
        const currentReceivers = pc.getReceivers();
        for (const receiver of currentReceivers) {
          if (receiver.track && receiver.track.kind === 'audio' && receiver.track.readyState === 'live') {
            console.log("[SIP.js WebRTC] Retry", retryCount, "- Found live audio track");
            const stream = new MediaStream([receiver.track]);
            setStreamAndPlay(stream, "retry-receiver");
            clearInterval(retryInterval);
            return;
          }
        }
        if (retryCount >= maxRetries) {
          console.warn("[SIP.js WebRTC] Max retries reached for audio setup");
          clearInterval(retryInterval);
        }
      }, 200);
    }
  }

  /**
   * Setup remote media - connect audio stream to HTML audio element
   */
  private setupRemoteMedia(session: Session): void {
    const sdh = session.sessionDescriptionHandler as any;
    if (!sdh || !sdh.peerConnection) {
      console.warn("[SIP.js WebRTC] No peer connection for remote media setup");
      return;
    }

    const pc = sdh.peerConnection as RTCPeerConnection;
    
    // Ensure audio element exists - create if needed
    if (!this.audioElement) {
      const audioElements = ensureTelnyxAudioElements();
      this.audioElement = audioElements.remote;
    }
    
    const remoteAudio = this.audioElement;
    
    if (!remoteAudio) {
      console.error("[SIP.js WebRTC] Remote audio element not found!");
      return;
    }

    console.log("[SIP.js WebRTC] Setting up remote media...");

    // Helper to safely set stream and play (avoids AbortError on rapid calls)
    const setStreamAndPlay = (stream: MediaStream, source: string) => {
      // Avoid reload if same stream already assigned
      if (remoteAudio.srcObject === stream) {
        console.log(`[SIP.js WebRTC] Stream already set from ${source}, skipping`);
        return;
      }
      
      remoteAudio.srcObject = stream;
      remoteAudio.play().then(() => {
        console.log(`[SIP.js WebRTC] Remote audio playing via ${source}`);
      }).catch(e => {
        // Ignore AbortError - benign when switching streams rapidly
        if (e.name !== 'AbortError') {
          console.error("[SIP.js WebRTC] Audio play failed:", e);
        }
      });
    };

    // Method 1: Listen for track events (for new tracks)
    pc.ontrack = (event: RTCTrackEvent) => {
      console.log("[SIP.js WebRTC] ontrack event - kind:", event.track.kind);
      if (event.track.kind === 'audio' && event.streams && event.streams[0]) {
        setStreamAndPlay(event.streams[0], "ontrack");
      }
    };

    // Method 2: Check if receivers already have tracks (for existing streams)
    const receivers = pc.getReceivers();
    console.log("[SIP.js WebRTC] Checking", receivers.length, "receivers for audio tracks");
    
    for (const receiver of receivers) {
      if (receiver.track && receiver.track.kind === 'audio') {
        console.log("[SIP.js WebRTC] Found existing audio track from receiver");
        const stream = new MediaStream([receiver.track]);
        setStreamAndPlay(stream, "receiver");
        return; // Exit after first successful setup
      }
    }

    // Method 3: Check remote streams directly (deprecated but fallback)
    const remoteStreams = (pc as any).getRemoteStreams?.();
    if (remoteStreams && remoteStreams.length > 0) {
      console.log("[SIP.js WebRTC] Found remote stream via getRemoteStreams");
      setStreamAndPlay(remoteStreams[0], "getRemoteStreams");
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

    // Check session state - only accept if in Initial state
    const currentState = invitation.state;
    console.log("[SIP.js WebRTC] Answering call, current state:", currentState);
    
    // If already establishing or established, don't call accept again
    if (currentState === SessionState.Establishing) {
      console.log("[SIP.js WebRTC] Call already being answered (Establishing), waiting...");
      return; // Already in progress, don't double-accept
    }
    
    if (currentState === SessionState.Established) {
      console.log("[SIP.js WebRTC] Call already answered (Established)");
      return; // Already connected
    }
    
    if (currentState === SessionState.Terminated) {
      console.log("[SIP.js WebRTC] Call already terminated");
      store.setIncomingCall(undefined);
      store.setIncomingCallInfo(undefined);
      return;
    }

    // Mark as answering in store to prevent double-clicks
    store.setIsAnswering(true);
    
    console.log("[SIP.js WebRTC] Proceeding to answer call...");
    this.stopRingtone();

    // =========================================================================
    // CRITICAL: Capture microphone BEFORE answering the call
    // Without this, SDP negotiation fails and there's no two-way audio
    // =========================================================================
    console.log("[SIP.js WebRTC] Capturing microphone before answering...");
    const localStream = await this.captureLocalAudio();
    if (!localStream) {
      console.error("[SIP.js WebRTC] Cannot answer call without microphone access");
      store.setIsAnswering(false);
      return;
    }
    console.log("[SIP.js WebRTC] Microphone ready, proceeding to answer");

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
    console.log("[SIP.js WebRTC] Zero-latency ICE config:", JSON.stringify({
      iceTransportPolicy: rtcConfig.iceTransportPolicy,
      iceServersCount: rtcConfig.iceServers?.length
    }));

    // Listen for state changes to setup media when established
    const stateListener = (newState: SessionState) => {
      console.log("[SIP.js WebRTC] Answer state change:", newState);
      if (newState === SessionState.Established) {
        console.log("[SIP.js WebRTC] Call established - setting up media");
        // Add local tracks and setup remote audio
        this.addLocalTracksToConnection(invitation, localStream);
        this.setupRemoteMedia(invitation);
        store.setIsAnswering(false);
      } else if (newState === SessionState.Terminated) {
        store.setIsAnswering(false);
        this.stopLocalAudio();
      }
    };
    invitation.stateChange.addListener(stateListener);

    try {
      // IMPORTANT: Pass peerConnectionConfiguration in sessionDescriptionHandlerOptions
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          peerConnectionConfiguration: rtcConfig,
          constraints: {
            audio: true,
            video: false
          }
        } as any
      });
      console.log("[SIP.js WebRTC] Call accept() completed");
    } catch (error) {
      console.error("[SIP.js WebRTC] Answer failed:", error);
      store.setIsAnswering(false);
      // Reset state on failure
      store.setIncomingCall(undefined);
      store.setIncomingCallInfo(undefined);
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
    store.setIncomingCallInfo(undefined);
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
    store.setCurrentCallInfo(undefined);
    store.setOutgoingCallInfo(undefined);
    store.setIncomingCallInfo(undefined);
    store.setCallActiveTimestamp(undefined);
    store.setActiveTelnyxLegId(undefined);
    this.stopRingtone();
    this.stopRingback();
    
    // CRITICAL: Stop local audio to release microphone
    this.stopLocalAudio();

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
      const targetUri = UserAgent.makeURI(`sip:${destinationNumber}@${this.currentSipDomain}`);
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
