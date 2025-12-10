// ============================================================================
//  TELNYX WEBRTC – VERSION CARRIER-GRADE (CURBE VOICE)
//  100% compliant con el SDK oficial – sin delays, sin errores, sin busy falso
// ============================================================================

import { TelnyxRTC } from "@telnyx/webrtc";
import { create } from "zustand";

type TelnyxCall = ReturnType<TelnyxRTC["newCall"]>;

// Network quality metrics for call quality monitoring
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
}));

export type { NetworkQualityMetrics };

class TelnyxWebRTCManager {
  private static instance: TelnyxWebRTCManager;
  private client: TelnyxRTC | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private ringtone: HTMLAudioElement;
  private ringback: HTMLAudioElement;

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
    this.audioElement = elem;
  }

  public async initialize(sipUser: string, sipPass: string, callerId?: string): Promise<void> {
    const store = useTelnyxStore.getState();
    store.setConnectionStatus("connecting");

    if (callerId) store.setCallerIdNumber(callerId);
    store.setSipUsername(sipUser);

    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }

    this.client = new TelnyxRTC({
      login: sipUser,
      password: sipPass,
      debug: false,
    });

    this.client.on("telnyx.ready", () => {
      console.log("[Telnyx WebRTC] Connected and ready");
      store.setConnectionStatus("connected");
    });

    this.client.on("telnyx.socket.close", () => {
      console.log("[Telnyx WebRTC] Socket closed");
      store.setConnectionStatus("disconnected");
    });

    this.client.on("telnyx.error", (e: any) => {
      console.error("[Telnyx WebRTC] Error:", e);
      store.setConnectionStatus("error", e?.message);
    });

    this.client.on("telnyx.notification", (n: any) => {
      if (!n.call) return;
      const call = n.call as any;

      if (!call._curbeListenersAttached) {
        this.attachCallListeners(call);
        call._curbeListenersAttached = true;
      }
    });

    await this.client.connect();
  }

  private attachCallListeners(call: any): void {
    const store = useTelnyxStore.getState();

    call.on("remoteStream", (stream: MediaStream) => {
      console.log("[Telnyx WebRTC] 🔊 remoteStream received");
      if (!this.audioElement) return;

      this.stopRingback();
      this.stopRingtone();

      this.audioElement.srcObject = stream;
      this.audioElement.muted = false;
      this.audioElement.volume = 1.0;
      this.audioElement.play().catch(console.error);
    });

    call.on("ringing", () => {
      console.log("[Telnyx WebRTC] 📞 Call ringing, direction:", call.direction);
      if (call.direction === "inbound") {
        console.log("[Telnyx WebRTC] 📞 Incoming call");
        useTelnyxStore.getState().setIncomingCall(call);
        this.startRingtone();
      }
    });

    call.on("trying", () => {
      console.log("[Telnyx WebRTC] 📤 Call trying, direction:", call.direction);
      if (call.direction === "outbound") {
        useTelnyxStore.getState().setOutgoingCall(call);
        this.startRingback();
      }
    });

    call.on("early", () => {
      console.log("[Telnyx WebRTC] 📤 Early media (carrier ring)");
      if (call.direction === "outbound") {
        this.stopRingback();
      }
    });

    call.on("active", () => {
      console.log("[Telnyx WebRTC] 🟢 Call active");

      this.stopRingback();
      this.stopRingtone();

      const s = useTelnyxStore.getState();
      s.setIncomingCall(undefined);
      s.setOutgoingCall(undefined);
      s.setCurrentCall(call);
      s.setCallActiveTimestamp(Date.now());

      this.logCallToServer(call, "active");
    });

    call.on("hangup", () => {
      console.log("[Telnyx WebRTC] 🔴 Call hangup");

      this.stopRingback();
      this.stopRingtone();

      this.logCallToServer(call, "completed");

      const s = useTelnyxStore.getState();
      s.setCurrentCall(undefined);
      s.setIncomingCall(undefined);
      s.setOutgoingCall(undefined);
      s.setCallActiveTimestamp(undefined);
      s.setMuted(false);
      s.setOnHold(false);
    });
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

  public makeCall(dest: string): TelnyxCall | null {
    if (!this.client) return null;

    const store = useTelnyxStore.getState();
    store.setCurrentCall(undefined);
    store.setOutgoingCall(undefined);
    store.setCallActiveTimestamp(undefined);

    console.log("[Telnyx WebRTC] 📞 Making call to:", dest);

    const call = this.client.newCall({
      destinationNumber: dest,
      callerNumber: store.callerIdNumber,
      callerName: "Curbe",
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

    incoming.answer();
  }

  public rejectCall(): void {
    const store = useTelnyxStore.getState();
    const incoming = store.incomingCall;
    if (!incoming) return;

    console.log("[Telnyx WebRTC] Rejecting call");
    this.stopRingtone();
    incoming.hangup();
    store.setIncomingCall(undefined);
  }

  public hangup(): void {
    const store = useTelnyxStore.getState();

    console.log("[Telnyx WebRTC] Hangup called");

    store.currentCall?.hangup();
    store.outgoingCall?.hangup();
    store.incomingCall?.hangup();

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

      const consultCall = this.client.newCall({
        destinationNumber: consultNumber,
        callerNumber: store.callerIdNumber,
        callerName: "Curbe",
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
      if (consultCall) consultCall.hangup();
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
      if (consultCall) consultCall.hangup();
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
