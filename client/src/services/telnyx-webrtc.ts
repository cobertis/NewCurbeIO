// ============================================================================
//  TELNYX WEBRTC – CURBE VOICE (TelnyxRTC SDK Implementation)
//  Uses official @telnyx/webrtc SDK for simplified WebRTC handling
// ============================================================================

import { TelnyxRTC } from "@telnyx/webrtc";

type TelnyxCall = any;
type TelnyxNotification = { type: string; call?: TelnyxCall };
import { create } from "zustand";
import { useExtensionCallStore } from "@/stores/extensionCallStore";

// ============================================================================
// CONSTANTS
// ============================================================================
const TELNYX_REMOTE_AUDIO_ID = "telnyx-remote-audio";

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
  currentCall?: TelnyxCall;
  incomingCall?: TelnyxCall;
  outgoingCall?: TelnyxCall;
  consultCall?: TelnyxCall;
  isCallActive: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  isConsulting: boolean;
  isAnswering: boolean;
  callerIdNumber?: string;
  sipUsername?: string;
  networkQuality?: NetworkQualityMetrics;
  callDuration: number;
  callActiveTimestamp?: number;
  activeTelnyxLegId?: string;
  isOutboundPstnRinging: boolean;
  currentCallInfo?: SipCallInfo;
  incomingCallInfo?: SipCallInfo;
  outgoingCallInfo?: SipCallInfo;
  activeCallLogId?: string;
  agentAvailabilityStatus?: "online" | "busy" | "offline";

  setConnectionStatus: (status: TelnyxWebRTCState["connectionStatus"], error?: string) => void;
  setCurrentCall: (call?: TelnyxCall) => void;
  setIncomingCall: (call?: TelnyxCall) => void;
  setOutgoingCall: (call?: TelnyxCall) => void;
  setConsultCall: (call?: TelnyxCall) => void;
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
  setOutboundPstnRinging: (ringing: boolean) => void;
  setCurrentCallInfo: (info?: SipCallInfo) => void;
  setIncomingCallInfo: (info?: SipCallInfo) => void;
  setOutgoingCallInfo: (info?: SipCallInfo) => void;
  setActiveCallLogId: (id?: string) => void;
  setAgentAvailabilityStatus: (status?: "online" | "busy" | "offline") => void;
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
  isOutboundPstnRinging: false,
  currentCallInfo: undefined,
  incomingCallInfo: undefined,
  outgoingCallInfo: undefined,
  activeCallLogId: undefined,
  agentAvailabilityStatus: undefined,

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
  setOutboundPstnRinging: (ringing) => set({ isOutboundPstnRinging: ringing }),
  setCurrentCallInfo: (info) => set({ currentCallInfo: info }),
  setIncomingCallInfo: (info) => set({ incomingCallInfo: info }),
  setOutgoingCallInfo: (info) => set({ outgoingCallInfo: info }),
  setActiveCallLogId: (id) => set({ activeCallLogId: id }),
  setAgentAvailabilityStatus: (status) => set({ agentAvailabilityStatus: status }),
}));

export type { NetworkQualityMetrics };

export function setForcedIceServers(_servers: RTCIceServer[]) {
  console.log("[TelnyxRTC] setForcedIceServers called - handled by SDK");
}

export function getTelnyxRemoteAudioElement(): HTMLAudioElement | null {
  return document.getElementById(TELNYX_REMOTE_AUDIO_ID) as HTMLAudioElement | null;
}

export function getTelnyxLocalAudioElement(): HTMLAudioElement | null {
  return null;
}

// ============================================================================
// TELNYX WEBRTC MANAGER (using official SDK)
// ============================================================================
class TelnyxWebRTCManager {
  private static instance: TelnyxWebRTCManager;
  private client: TelnyxRTC | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private ringtone: HTMLAudioElement;
  
  private savedCredentials: { sipUser: string; sipPass: string; callerId?: string; sipDomain?: string } | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  private currentSipCallId: string | null = null;
  private callStartTime: Date | null = null;
  private callAnswerTime: Date | null = null;
  private callLogId: string | null = null;
  private callWasAnswered: boolean = false;
  private currentTelnyxLegId: string | null = null;

  private constructor() {
    this.ensureAudioElement();
    
    this.ringtone = new Audio();
    this.ringtone.loop = true;
    this.ringtone.src = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
    this.ringtone.volume = 0.7;
  }

  private ensureAudioElement(): HTMLAudioElement {
    let el = document.getElementById(TELNYX_REMOTE_AUDIO_ID) as HTMLAudioElement | null;
    if (!el) {
      el = document.createElement("audio");
      el.id = TELNYX_REMOTE_AUDIO_ID;
      el.autoplay = true;
      el.setAttribute("playsinline", "true");
      el.style.display = "none";
      document.body.appendChild(el);
      console.log("[TelnyxRTC] Created audio element");
    }
    this.audioElement = el;
    return el;
  }

  public static getInstance(): TelnyxWebRTCManager {
    if (!TelnyxWebRTCManager.instance) {
      TelnyxWebRTCManager.instance = new TelnyxWebRTCManager();
    }
    return TelnyxWebRTCManager.instance;
  }

  public setAudioElement(elem: HTMLAudioElement) {
    this.audioElement = elem;
  }

  // ============================================================================
  // CALL LOGGING
  // ============================================================================
  
  private generateSipCallId(): string {
    return `sip-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
  
  private resetCallLoggingState(): void {
    this.currentSipCallId = null;
    this.callStartTime = null;
    this.callAnswerTime = null;
    this.callLogId = null;
    this.callWasAnswered = false;
    this.currentTelnyxLegId = null;
    const store = useTelnyxStore.getState();
    store.setActiveCallLogId(undefined);
  }
  
  private async logCallStart(callInfo: SipCallInfo): Promise<void> {
    try {
      this.currentSipCallId = this.generateSipCallId();
      this.callStartTime = new Date();
      this.callWasAnswered = false;
      
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
      
      console.log(`[TelnyxRTC CallLog] Creating call log: ${callInfo.direction} from ${fromNumber} to ${toNumber}`);
      
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
        console.log(`[TelnyxRTC CallLog] Call log created with ID: ${this.callLogId}`);
        const store = useTelnyxStore.getState();
        store.setActiveCallLogId(this.callLogId || undefined);
      }
    } catch (error) {
      console.error("[TelnyxRTC CallLog] Failed to create call log:", error);
    }
  }
  
  private async logCallAnswered(): Promise<void> {
    if (!this.callLogId || this.callWasAnswered) return;
    
    try {
      this.callAnswerTime = new Date();
      this.callWasAnswered = true;
      
      await fetch(`/api/call-logs/${this.callLogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: "answered",
          answeredAt: this.callAnswerTime.toISOString(),
          telnyxCallId: this.currentTelnyxLegId || null,
        }),
      });
      
      console.log("[TelnyxRTC CallLog] Call marked as answered");
    } catch (error) {
      console.error("[TelnyxRTC CallLog] Failed to update call log:", error);
    }
  }
  
  private async logCallEnd(): Promise<void> {
    if (!this.callLogId) {
      this.resetCallLoggingState();
      return;
    }
    
    try {
      const endTime = new Date();
      let durationSeconds = 0;
      
      if (this.callWasAnswered && this.callAnswerTime) {
        durationSeconds = Math.floor((endTime.getTime() - this.callAnswerTime.getTime()) / 1000);
      }
      
      const finalStatus = this.callWasAnswered ? "completed" : "missed";
      
      await fetch(`/api/call-logs/${this.callLogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: finalStatus,
          endedAt: endTime.toISOString(),
          duration: durationSeconds,
          telnyxCallId: this.currentTelnyxLegId || null,
        }),
      });
      
      console.log(`[TelnyxRTC CallLog] Call ended: ${finalStatus}, duration: ${durationSeconds}s`);
    } catch (error) {
      console.error("[TelnyxRTC CallLog] Failed to update call log:", error);
    } finally {
      this.resetCallLoggingState();
    }
  }

  // ============================================================================
  // HELPER: EXTRACT CALLER INFO
  // ============================================================================
  
  private extractCallerInfo(call: TelnyxCall, isOutbound: boolean, destination?: string): SipCallInfo {
    let remoteNumber = destination || "";
    let callerName: string | undefined;
    let telnyxLegId: string | undefined;
    
    if (!isOutbound) {
      remoteNumber = (call as any).options?.remoteCallerNumber || 
                     (call as any).options?.callerNumber ||
                     (call as any).remoteIdentity?.uri?.user ||
                     "Unknown";
      callerName = (call as any).options?.remoteCallerName ||
                   (call as any).options?.callerName ||
                   (call as any).remoteIdentity?.displayName;
    }
    
    telnyxLegId = (call as any).telnyxCallControlId || 
                  (call as any).telnyxLegId ||
                  (call as any).id;
    
    const callInfo: SipCallInfo = {
      remoteCallerNumber: remoteNumber,
      callerName,
      direction: isOutbound ? "outbound" : "inbound",
      state: "ringing",
      destinationNumber: isOutbound ? destination : undefined,
      telnyxCallLegId: telnyxLegId,
    };
    
    console.log("[TelnyxRTC] Extracted call info:", callInfo);
    return callInfo;
  }

  // ============================================================================
  // RECONNECTION
  // ============================================================================
  
  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.savedCredentials || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[TelnyxRTC] Max reconnect attempts reached or no credentials");
      return;
    }

    this.cancelReconnect();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[TelnyxRTC] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      if (this.savedCredentials) {
        console.log("[TelnyxRTC] Attempting reconnection...");
        await this.initialize(
          this.savedCredentials.sipUser,
          this.savedCredentials.sipPass,
          this.savedCredentials.callerId,
          undefined,
          this.savedCredentials.sipDomain
        );
      }
    }, delay);
  }

  // ============================================================================
  // HANDLE CALL STATE CHANGES
  // ============================================================================
  
  private handleCallStateChange(call: TelnyxCall, callInfo: SipCallInfo): void {
    const store = useTelnyxStore.getState();
    const state = call.state;
    
    console.log(`[TelnyxRTC] Call state changed: ${state}, direction: ${callInfo.direction}`);
    
    switch (state) {
      case "new":
      case "trying":
      case "requesting":
        callInfo.state = "ringing";
        if (callInfo.direction === "outbound") {
          store.setOutboundPstnRinging(true);
        }
        break;
        
      case "ringing":
      case "early":
        callInfo.state = "ringing";
        if (callInfo.direction === "outbound") {
          store.setOutboundPstnRinging(true);
        }
        break;
        
      case "answering":
      case "connecting":
        callInfo.state = "establishing";
        break;
        
      case "active":
        callInfo.state = "active";
        store.setCurrentCall(call);
        store.setCurrentCallInfo({ ...callInfo });
        store.setIncomingCall(undefined);
        store.setOutgoingCall(undefined);
        store.setIncomingCallInfo(undefined);
        store.setOutgoingCallInfo(undefined);
        store.setMuted(false);
        store.setOnHold(false);
        store.setOutboundPstnRinging(false);
        store.setCallActiveTimestamp(Date.now());
        
        const legId = (call as any).telnyxCallControlId || (call as any).id;
        if (legId) {
          this.currentTelnyxLegId = legId;
          store.setActiveTelnyxLegId(legId);
        }
        
        this.logCallAnswered();
        this.stopRingtone();
        break;
        
      case "held":
        store.setOnHold(true);
        break;
        
      case "hangup":
      case "destroy":
      case "purge":
        callInfo.state = "terminated";
        this.stopRingtone();
        store.setCurrentCall(undefined);
        store.setIncomingCall(undefined);
        store.setOutgoingCall(undefined);
        store.setCurrentCallInfo(undefined);
        store.setIncomingCallInfo(undefined);
        store.setOutgoingCallInfo(undefined);
        store.setCallActiveTimestamp(undefined);
        store.setActiveTelnyxLegId(undefined);
        store.setOutboundPstnRinging(false);
        store.setMuted(false);
        store.setOnHold(false);
        store.setIsAnswering(false);
        this.logCallEnd();
        break;
    }
  }

  // ============================================================================
  // INITIALIZE
  // ============================================================================
  
  public async initialize(sipUser: string, sipPass: string, callerId?: string, _iceServers?: RTCIceServer[], sipDomain?: string): Promise<void> {
    const store = useTelnyxStore.getState();
    store.setConnectionStatus("connecting");

    this.savedCredentials = { sipUser, sipPass, callerId, sipDomain };
    this.cancelReconnect();
    
    console.log("[TelnyxRTC] ICE servers param ignored (handled by SDK)");

    if (callerId) store.setCallerIdNumber(callerId);
    store.setSipUsername(sipUser);

    if (this.client) {
      try {
        this.client.disconnect();
      } catch (e) {
        console.warn("[TelnyxRTC] Error disconnecting previous client:", e);
      }
      this.client = null;
    }

    const audioEl = this.ensureAudioElement();

    try {
      console.log("[TelnyxRTC] Initializing client with login:", sipUser);
      
      this.client = new TelnyxRTC({
        login: sipUser,
        password: sipPass,
      });

      (this.client as any).remoteElement = audioEl;

      this.client.on("telnyx.ready", () => {
        console.log("[TelnyxRTC] Client ready - registered successfully");
        store.setConnectionStatus("connected");
        this.reconnectAttempts = 0;
      });

      this.client.on("telnyx.error", (error: any) => {
        console.error("[TelnyxRTC] Error:", error);
        store.setConnectionStatus("error", error?.message || "Connection error");
      });

      this.client.on("telnyx.socket.error", (error: any) => {
        console.error("[TelnyxRTC] Socket error:", error);
        store.setConnectionStatus("error", "Socket connection failed");
        this.scheduleReconnect();
      });

      this.client.on("telnyx.socket.close", () => {
        console.log("[TelnyxRTC] Socket closed");
        store.setConnectionStatus("disconnected");
        this.scheduleReconnect();
      });

      this.client.on("telnyx.notification", (notification: TelnyxNotification) => {
        console.log("[TelnyxRTC] Notification:", notification.type);
        
        if (notification.type === "callUpdate") {
          const call = notification.call;
          if (!call) return;
          
          const existingCallInfo = store.currentCallInfo || store.incomingCallInfo || store.outgoingCallInfo;
          
          if (!existingCallInfo && call.state === "ringing") {
            const callInfo = this.extractCallerInfo(call, false);
            
            const extStore = useExtensionCallStore.getState();
            if (extStore.pendingQueueCallAutoAnswer) {
              console.log("[TelnyxRTC] Auto-answering queue call");
              extStore.setPendingQueueCallAutoAnswer(false);
              store.setIncomingCall(call);
              store.setIncomingCallInfo(callInfo);
              this.logCallStart(callInfo);
              call.answer();
              return;
            }
            
            // Check if we're in reject cooldown (user just pressed Reject, ignore SIP forks)
            if (this.isInRejectCooldown(callInfo.remoteCallerNumber)) {
              console.log("[TelnyxRTC] In reject cooldown - auto-rejecting SIP fork from:", callInfo.remoteCallerNumber);
              call.hangup();
              return;
            }

            // Check agent availability status - if offline, auto-reject and send to voicemail
            const agentStatus = store.agentAvailabilityStatus;
            console.log("[TelnyxRTC] Agent availability status:", agentStatus);
            
            if (agentStatus === "offline") {
              console.log("[TelnyxRTC] Agent is OFFLINE - auto-rejecting call and routing to voicemail");
              // Reject the call via SDK
              call.hangup();
              // Try to route to voicemail via server (fire and forget)
              const callerNumber = callInfo.remoteCallerNumber?.replace(/\D/g, '') || '';
              const callLegId = (call as any).id || (call as any).callId;
              if (callerNumber) {
                fetch(`/api/pbx/auto-reject-to-voicemail`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ callerNumber, callLegId, reason: 'agent_offline' })
                }).catch(err => console.error("[TelnyxRTC] Auto-reject voicemail request failed:", err));
              }
              return;
            }
            
            console.log("[TelnyxRTC] Incoming call from:", callInfo.remoteCallerNumber);
            store.setIncomingCall(call);
            store.setIncomingCallInfo(callInfo);
            this.logCallStart(callInfo);
            this.startRingtone();
          }
          
          const currentInfo = existingCallInfo || this.extractCallerInfo(call, false);
          this.handleCallStateChange(call, currentInfo);
        }
      });

      await this.client.connect();
      console.log("[TelnyxRTC] Connect called, waiting for ready event");

    } catch (error) {
      console.error("[TelnyxRTC] Initialization error:", error);
      store.setConnectionStatus("error", (error as Error).message);
      this.scheduleReconnect();
    }
  }

  // ============================================================================
  // MAKE CALL
  // ============================================================================
  
  public async makeCall(destination: string): Promise<TelnyxCall | null> {
    if (!this.client) {
      console.error("[TelnyxRTC] Client not initialized");
      return null;
    }

    const store = useTelnyxStore.getState();

    const digits = destination.replace(/\D/g, "");
    let formattedDest: string;
    if (digits.startsWith("1") && digits.length === 11) {
      formattedDest = `+${digits}`;
    } else if (digits.length === 10) {
      formattedDest = `+1${digits}`;
    } else {
      formattedDest = `+1${digits}`;
    }
    
    console.log("[TelnyxRTC] Calling:", formattedDest);

    try {
      const call = this.client.newCall({
        destinationNumber: formattedDest,
        callerNumber: store.callerIdNumber || undefined,
        audio: true,
        video: false,
      });

      const callInfo = this.extractCallerInfo(call, true, formattedDest);
      store.setOutgoingCall(call);
      store.setOutgoingCallInfo(callInfo);
      store.setOutboundPstnRinging(true);
      
      this.logCallStart(callInfo);

      return call;
    } catch (error) {
      console.error("[TelnyxRTC] Call failed:", error);
      store.setOutgoingCall(undefined);
      store.setOutgoingCallInfo(undefined);
      store.setOutboundPstnRinging(false);
      return null;
    }
  }

  // ============================================================================
  // ANSWER CALL
  // ============================================================================
  
  public async answerCall(): Promise<void> {
    const store = useTelnyxStore.getState();
    const call = store.incomingCall;
    
    if (!call) {
      console.warn("[TelnyxRTC] No incoming call to answer");
      return;
    }

    if (store.isAnswering) {
      console.log("[TelnyxRTC] Already answering call");
      return;
    }

    store.setIsAnswering(true);
    this.stopRingtone();

    try {
      console.log("[TelnyxRTC] Answering call...");
      call.answer();
    } catch (error) {
      console.error("[TelnyxRTC] Answer failed:", error);
      store.setIsAnswering(false);
    }
  }

  // ============================================================================
  // REJECT CALL
  // ============================================================================
  
  // Track rejected calls to ignore SIP forks
  private rejectedCallIds: Set<string> = new Set();
  private rejectCooldownUntil: number = 0;

  public rejectCall(): void {
    const store = useTelnyxStore.getState();
    const call = store.incomingCall;
    const callInfo = store.incomingCallInfo;
    
    if (!call) return;

    console.log("[TelnyxRTC] Rejecting call with SIP 486 Busy");
    this.stopRingtone();
    
    // Set cooldown to ignore SIP forks for the next 5 seconds
    this.rejectCooldownUntil = Date.now() + 5000;
    
    // Track this caller's number to reject forks
    if (callInfo?.remoteCallerNumber) {
      this.rejectedCallIds.add(callInfo.remoteCallerNumber);
      // Clean up after 10 seconds
      setTimeout(() => {
        this.rejectedCallIds.delete(callInfo.remoteCallerNumber!);
      }, 10000);
    }
    
    // Clear state first to hide UI immediately
    store.setIncomingCall(undefined);
    store.setIncomingCallInfo(undefined);
    
    // Then hangup - this will reject the call to Telnyx
    try {
      call.hangup();
    } catch (e) {
      console.error("[TelnyxRTC] Reject hangup error:", e);
    }
  }

  // Check if we should ignore this incoming call (during reject cooldown)
  public isInRejectCooldown(callerNumber?: string): boolean {
    // During cooldown period, ignore all calls
    if (Date.now() < this.rejectCooldownUntil) {
      return true;
    }
    // Also ignore if this specific caller was just rejected
    if (callerNumber && this.rejectedCallIds.has(callerNumber)) {
      return true;
    }
    return false;
  }

  // ============================================================================
  // HANGUP
  // ============================================================================
  
  public async hangupCall(): Promise<void> {
    const store = useTelnyxStore.getState();
    
    const activeCall = store.currentCall || store.outgoingCall || store.incomingCall;
    if (!activeCall) {
      console.log("[TelnyxRTC] No active call to hang up");
      store.setCurrentCall(undefined);
      store.setOutgoingCall(undefined);
      store.setIncomingCall(undefined);
      store.setCallActiveTimestamp(undefined);
      store.setActiveTelnyxLegId(undefined);
      this.stopRingtone();
      return;
    }

    console.log("[TelnyxRTC] Hanging up call");
    
    store.setCurrentCall(undefined);
    store.setOutgoingCall(undefined);
    store.setIncomingCall(undefined);
    store.setCurrentCallInfo(undefined);
    store.setOutgoingCallInfo(undefined);
    store.setIncomingCallInfo(undefined);
    store.setCallActiveTimestamp(undefined);
    store.setActiveTelnyxLegId(undefined);
    store.setOutboundPstnRinging(false);
    this.stopRingtone();

    try {
      activeCall.hangup();
    } catch (e) {
      console.error("[TelnyxRTC] Hangup error:", e);
    }
  }

  // Alias for backward compatibility if needed, though we will update calls
  public async hangup(): Promise<void> {
    return this.hangupCall();
  }

  // ============================================================================
  // MUTE
  // ============================================================================
  
  public muteToggle(): void {
    const store = useTelnyxStore.getState();
    const call = store.currentCall;

    if (!call) {
      console.warn("[TelnyxRTC] No active call for mute toggle");
      return;
    }

    const newMutedState = !store.isMuted;
    
    try {
      if (newMutedState) {
        // Try different mute methods available in SDK
        if (typeof (call as any).muteAudio === 'function') {
          (call as any).muteAudio();
        } else if (typeof call.mute === 'function') {
          call.mute();
        } else {
          console.error("[TelnyxRTC] No mute method available on call object");
          return;
        }
      } else {
        if (typeof (call as any).unmuteAudio === 'function') {
          (call as any).unmuteAudio();
        } else if (typeof call.unmute === 'function') {
          call.unmute();
        } else {
          console.error("[TelnyxRTC] No unmute method available on call object");
          return;
        }
      }
      
      store.setMuted(newMutedState);
      console.log("[TelnyxRTC] Mute toggled:", newMutedState);
    } catch (error) {
      console.error("[TelnyxRTC] Mute toggle error:", error);
    }
  }

  public toggleMute(): void {
    this.muteToggle();
  }

  // ============================================================================
  // HOLD
  // ============================================================================
  
  public holdToggle(): void {
    const store = useTelnyxStore.getState();
    const call = store.currentCall;

    if (!call) {
      console.warn("[TelnyxRTC] No active call for hold toggle");
      return;
    }

    const newHoldState = !store.isOnHold;
    
    try {
      if (newHoldState) {
        if (typeof call.hold === 'function') {
          call.hold();
        } else {
          console.error("[TelnyxRTC] No hold method available on call object");
          return;
        }
      } else {
        if (typeof call.unhold === 'function') {
          call.unhold();
        } else {
          console.error("[TelnyxRTC] No unhold method available on call object");
          return;
        }
      }
      
      store.setOnHold(newHoldState);
      console.log("[TelnyxRTC] Hold toggled:", newHoldState);
    } catch (error) {
      console.error("[TelnyxRTC] Hold toggle error:", error);
    }
  }

  public toggleHold(): void {
    this.holdToggle();
  }

  // ============================================================================
  // DTMF
  // ============================================================================
  
  public sendDTMF(digit: string): void {
    const store = useTelnyxStore.getState();
    const call = store.currentCall;

    if (!call) {
      console.warn("[TelnyxRTC] No call for DTMF");
      return;
    }

    call.dtmf(digit);
    console.log("[TelnyxRTC] DTMF sent:", digit);
  }

  // ============================================================================
  // TRANSFER
  // ============================================================================
  
  public blindTransfer(destinationNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const call = store.currentCall;

    if (!call) return false;

    try {
      console.log("[TelnyxRTC] Blind transfer to:", destinationNumber);
      const digits = destinationNumber.replace(/\D/g, "");
      const formatted = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
      
      (call as any).transfer?.(formatted) || call.hangup();
      
      store.setCurrentCall(undefined);
      store.setMuted(false);
      store.setOnHold(false);
      return true;
    } catch (error) {
      console.error("[TelnyxRTC] Blind transfer failed:", error);
      return false;
    }
  }

  public async startAttendedTransfer(consultNumber: string): Promise<boolean> {
    if (!this.client) return false;

    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;

    if (!currentCall) return false;

    try {
      console.log("[TelnyxRTC] Starting attended transfer");
      this.toggleHold();
      store.setConsulting(true);

      const consultCall = await this.makeCall(consultNumber);
      if (consultCall) {
        store.setConsultCall(consultCall);
        return true;
      }
    } catch (error) {
      console.error("[TelnyxRTC] Start attended transfer failed:", error);
      this.toggleHold();
      store.setConsulting(false);
    }
    return false;
  }

  public completeAttendedTransfer(consultNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    const consultCall = store.consultCall;

    if (!currentCall) return false;

    try {
      console.log("[TelnyxRTC] Completing attended transfer");
      if (consultCall) {
        consultCall.hangup();
      }
      this.blindTransfer(consultNumber);

      store.setConsultCall(undefined);
      store.setCurrentCall(undefined);
      store.setConsulting(false);
      store.setOnHold(false);
      store.setMuted(false);
      return true;
    } catch (error) {
      console.error("[TelnyxRTC] Complete attended transfer failed:", error);
      return false;
    }
  }

  public async startConsultTransfer(consultNumber: string): Promise<boolean> {
    return this.startAttendedTransfer(consultNumber);
  }

  public completeConsultTransfer(consultNumber: string): boolean {
    return this.completeAttendedTransfer(consultNumber);
  }

  public cancelAttendedTransfer(): boolean {
    const store = useTelnyxStore.getState();
    const consultCall = store.consultCall;

    try {
      console.log("[TelnyxRTC] Canceling attended transfer");
      if (consultCall) {
        consultCall.hangup();
      }
      
      // Resume original call
      if (store.isOnHold) {
        this.toggleHold();
      }
      
      store.setConsultCall(undefined);
      store.setConsulting(false);
      return true;
    } catch (error) {
      console.error("[TelnyxRTC] Cancel attended transfer failed:", error);
      return false;
    }
  }

  public cancelConsultTransfer(): boolean {
    return this.cancelAttendedTransfer();
  }

  // ============================================================================
  // NETWORK QUALITY
  // ============================================================================
  
  public getCallQuality(): void {
    const store = useTelnyxStore.getState();
    const call = store.currentCall as any;

    if (!call) {
      store.setNetworkQuality(undefined);
      return;
    }

    const peer = call.peer || call._peer || call.peerConnection;
    if (!peer || typeof peer.getStats !== "function") {
      store.setNetworkQuality(undefined);
      return;
    }

    peer.getStats().then((stats: RTCStatsReport) => {
      let jitter = 0;
      let packetLoss = 0;
      let rtt = 0;

      stats.forEach((report: any) => {
        if (report.type === "inbound-rtp" && report.kind === "audio") {
          jitter = report.jitter ? report.jitter * 1000 : 0;
          packetLoss = report.packetsLost || 0;
        }
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
        }
      });

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

  // ============================================================================
  // REGISTRATION
  // ============================================================================
  
  public async refreshRegistration(): Promise<void> {
    if (!this.client) return;
    
    console.log("[TelnyxRTC] Refreshing registration...");
    
    if (this.savedCredentials) {
      await this.initialize(
        this.savedCredentials.sipUser,
        this.savedCredentials.sipPass,
        this.savedCredentials.callerId,
        undefined,
        this.savedCredentials.sipDomain
      );
    }
  }

  public async preWarm(): Promise<void> {
    console.log("[TelnyxRTC] Pre-warm requested (handled by SDK)");
  }

  // ============================================================================
  // RINGTONE
  // ============================================================================
  
  private startRingtone(): void {
    this.ringtone.currentTime = 0;
    this.ringtone.play().catch(() => {});
  }

  private stopRingtone(): void {
    this.ringtone.pause();
    this.ringtone.currentTime = 0;
  }

  // ============================================================================
  // DISCONNECT
  // ============================================================================
  
  public disconnect(): void {
    this.cancelReconnect();
    
    if (this.client) {
      try {
        this.client.disconnect();
      } catch (e) {
        console.warn("[TelnyxRTC] Disconnect error:", e);
      }
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
