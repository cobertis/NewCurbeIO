import { TelnyxRTC } from '@telnyx/webrtc';
import { create } from 'zustand';

type TelnyxCall = ReturnType<TelnyxRTC['newCall']>;

// Network quality metrics for call quality monitoring
interface NetworkQualityMetrics {
  mos: number; // Mean Opinion Score (1-5)
  jitter: number; // Jitter in ms
  packetLoss: number; // Packet loss percentage
  rtt: number; // Round trip time in ms
  qualityLevel: 'excellent' | 'good' | 'poor';
}

interface TelnyxWebRTCState {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectionError?: string;
  currentCall?: TelnyxCall;
  incomingCall?: TelnyxCall;
  consultCall?: TelnyxCall; // Second call for attended transfer
  currentCallDirection?: 'inbound' | 'outbound'; // Track direction for UI display
  isCallActive: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  isConsulting: boolean; // True when in attended transfer consultation
  callerIdNumber?: string;
  sipUsername?: string;
  networkQuality?: NetworkQualityMetrics;
  callDuration: number; // Duration in seconds
  
  setConnectionStatus: (status: TelnyxWebRTCState['connectionStatus'], error?: string) => void;
  setCurrentCall: (call?: TelnyxCall, direction?: 'inbound' | 'outbound') => void;
  setIncomingCall: (call?: TelnyxCall) => void;
  setConsultCall: (call?: TelnyxCall) => void;
  setMuted: (muted: boolean) => void;
  setOnHold: (hold: boolean) => void;
  setConsulting: (consulting: boolean) => void;
  setCallerIdNumber: (number: string) => void;
  setSipUsername: (username: string) => void;
  setNetworkQuality: (metrics?: NetworkQualityMetrics) => void;
  setCallDuration: (duration: number) => void;
}

export const useTelnyxStore = create<TelnyxWebRTCState>((set) => ({
  isConnected: false,
  connectionStatus: 'disconnected',
  isCallActive: false,
  isMuted: false,
  isOnHold: false,
  isConsulting: false,
  callDuration: 0,
  
  setConnectionStatus: (status, error) => set({ 
    connectionStatus: status, 
    connectionError: error,
    isConnected: status === 'connected'
  }),
  setCurrentCall: (call, direction) => set({ 
    currentCall: call, 
    isCallActive: !!call,
    currentCallDirection: call ? direction : undefined
  }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setConsultCall: (call) => set({ consultCall: call }),
  setMuted: (muted) => set({ isMuted: muted }),
  setOnHold: (hold) => set({ isOnHold: hold }),
  setConsulting: (consulting) => set({ isConsulting: consulting }),
  setCallerIdNumber: (number) => set({ callerIdNumber: number }),
  setSipUsername: (username) => set({ sipUsername: username }),
  setNetworkQuality: (metrics) => set({ networkQuality: metrics }),
  setCallDuration: (duration) => set({ callDuration: duration }),
}));

export type { NetworkQualityMetrics };

class TelnyxWebRTCManager {
  private static instance: TelnyxWebRTCManager;
  private client: TelnyxRTC | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private ringbackAudio: HTMLAudioElement | null = null;
  private ringtoneAudio: HTMLAudioElement | null = null;
  private isPlayingRingback: boolean = false;
  private isPlayingRingtone: boolean = false;
  private currentCallStartTime: Date | null = null;
  private currentCallInfo: { callId: string; fromNumber: string; toNumber: string; direction: 'inbound' | 'outbound' } | null = null;
  private isOutboundCallInProgress: boolean = false;
  
  private constructor() {
    // Create persistent audio element for remote audio - CRITICAL for incoming calls
    // This element is created once and persists for the lifetime of the application
    this.audioElement = document.createElement('audio');
    this.audioElement.id = 'telnyx-remote-audio';
    this.audioElement.autoplay = true;
    this.audioElement.playsInline = true;
    this.audioElement.volume = 1.0;
    // Append to document body to ensure it's always in DOM
    document.body.appendChild(this.audioElement);
    console.log('[Telnyx WebRTC] Created persistent remote audio element');
    
    // Create ringback audio element for outbound calls
    this.ringbackAudio = new Audio();
    this.ringbackAudio.loop = true;
    // US ringback tone pattern: 440Hz + 480Hz, 2s on, 4s off
    this.createRingbackTone();
    
    // Create ringtone audio element for inbound calls
    this.ringtoneAudio = new Audio();
    this.ringtoneAudio.loop = true;
    this.createRingtone();
  }
  
  private createRingbackTone(): void {
    // Create a simple ringback tone using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const duration = 6; // 2s ring + 4s silence
      const bufferSize = sampleRate * duration;
      const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate US ringback: 440Hz + 480Hz for 2 seconds, then 4 seconds silence
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        if (t < 2) {
          // Ring tone (2 seconds)
          data[i] = 0.3 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t));
        } else {
          // Silence (4 seconds)
          data[i] = 0;
        }
      }
      
      // Convert to WAV and create blob URL
      const wavBlob = this.audioBufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      if (this.ringbackAudio) {
        this.ringbackAudio.src = url;
      }
      
      audioContext.close();
    } catch (error) {
      console.error('[Telnyx WebRTC] Failed to create ringback tone:', error);
    }
  }
  
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const data = buffer.getChannelData(0);
    const samples = data.length;
    const dataSize = samples * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write samples
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
  
  // Send call log to server
  private async logCallToServer(status: 'active' | 'completed' | 'missed' | 'failed'): Promise<void> {
    if (!this.currentCallInfo) return;
    
    try {
      const duration = this.currentCallStartTime 
        ? Math.floor((Date.now() - this.currentCallStartTime.getTime()) / 1000)
        : 0;
      
      await fetch('/api/webrtc/call-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          callId: this.currentCallInfo.callId,
          fromNumber: this.currentCallInfo.fromNumber,
          toNumber: this.currentCallInfo.toNumber,
          direction: this.currentCallInfo.direction,
          status,
          duration,
          startedAt: this.currentCallStartTime?.toISOString(),
          endedAt: status === 'completed' ? new Date().toISOString() : undefined,
        }),
      });
      console.log('[Telnyx WebRTC] Call logged to server:', status);
    } catch (error) {
      console.error('[Telnyx WebRTC] Failed to log call:', error);
    }
  }
  
  private startRingback(): void {
    if (this.ringbackAudio && !this.isPlayingRingback) {
      console.log('[Telnyx WebRTC] Starting ringback tone');
      this.isPlayingRingback = true;
      this.ringbackAudio.currentTime = 0;
      this.ringbackAudio.play().catch(err => {
        console.error('[Telnyx WebRTC] Failed to play ringback:', err);
      });
    }
  }
  
  private stopRingback(): void {
    if (this.ringbackAudio && this.isPlayingRingback) {
      console.log('[Telnyx WebRTC] Stopping ringback tone');
      this.isPlayingRingback = false;
      this.ringbackAudio.pause();
      this.ringbackAudio.currentTime = 0;
    }
  }
  
  private createRingtone(): void {
    // Create a distinctive ringtone for incoming calls using Web Audio API
    // Using higher frequencies and double-pulse pattern to distinguish from outbound ringback
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const duration = 3; // Total pattern duration
      const bufferSize = sampleRate * duration;
      const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate distinctive double-pulse ring pattern: 
      // Two short bursts (0.4s each) with brief pause, then longer silence
      // Using 750Hz + 850Hz for a brighter, more attention-grabbing sound
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        if (t < 0.4) {
          // First ring pulse (0.4 seconds)
          const envelope = Math.sin(Math.PI * t / 0.4) * 0.6;
          data[i] = envelope * (Math.sin(2 * Math.PI * 750 * t) + Math.sin(2 * Math.PI * 850 * t));
        } else if (t < 0.5) {
          // Brief pause (0.1 seconds)
          data[i] = 0;
        } else if (t < 0.9) {
          // Second ring pulse (0.4 seconds)
          const localT = t - 0.5;
          const envelope = Math.sin(Math.PI * localT / 0.4) * 0.6;
          data[i] = envelope * (Math.sin(2 * Math.PI * 750 * t) + Math.sin(2 * Math.PI * 850 * t));
        } else {
          // Silence (rest of the pattern)
          data[i] = 0;
        }
      }
      
      // Convert to WAV and create blob URL
      const wavBlob = this.audioBufferToWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      if (this.ringtoneAudio) {
        this.ringtoneAudio.src = url;
      }
      
      audioContext.close();
    } catch (error) {
      console.error('[Telnyx WebRTC] Failed to create ringtone:', error);
    }
  }
  
  private startRingtone(): void {
    if (this.ringtoneAudio && !this.isPlayingRingtone) {
      console.log('[Telnyx WebRTC] Starting ringtone for incoming call');
      this.isPlayingRingtone = true;
      this.ringtoneAudio.currentTime = 0;
      this.ringtoneAudio.play().catch(err => {
        console.error('[Telnyx WebRTC] Failed to play ringtone:', err);
      });
    }
  }
  
  private stopRingtone(): void {
    if (this.ringtoneAudio && this.isPlayingRingtone) {
      console.log('[Telnyx WebRTC] Stopping ringtone');
      this.isPlayingRingtone = false;
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
    }
  }
  
  public static getInstance(): TelnyxWebRTCManager {
    if (!TelnyxWebRTCManager.instance) {
      TelnyxWebRTCManager.instance = new TelnyxWebRTCManager();
    }
    return TelnyxWebRTCManager.instance;
  }
  
  public setAudioElement(element: HTMLAudioElement) {
    // Audio element is now created in constructor, this method is kept for backward compatibility
    // Only log if a different element is provided (shouldn't happen normally)
    if (element !== this.audioElement) {
      console.log('[Telnyx WebRTC] setAudioElement called but using persistent element from constructor');
    }
  }
  
  public getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }
  
  public async initialize(sipUsername: string, sipPassword: string, callerIdNumber?: string): Promise<void> {
    const store = useTelnyxStore.getState();
    store.setConnectionStatus('connecting');
    
    if (callerIdNumber) {
      store.setCallerIdNumber(callerIdNumber);
    }
    store.setSipUsername(sipUsername);
    
    try {
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
      
      console.log('[Telnyx WebRTC] Initializing with:', { sipUsername, hasPassword: !!sipPassword });
      
      // CRITICAL: Pre-acquire microphone permission BEFORE creating client
      // This ensures the local audio track is ready when the first call arrives
      console.log('[Telnyx WebRTC] Pre-acquiring microphone permission...');
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[Telnyx WebRTC] Microphone permission granted');
      } catch (micError) {
        console.error('[Telnyx WebRTC] Failed to get microphone permission:', micError);
        // Continue - user can still receive audio
      }
      
      this.client = new TelnyxRTC({
        // ICE servers for better NAT traversal
        iceServers: [
          { urls: "stun:stun.telnyx.com:3478" },
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
        login: sipUsername,
        password: sipPassword,
        ringtoneFile: undefined,
        ringbackFile: undefined,
      });
      
      // CRITICAL: Assign remote audio element to SDK BEFORE connecting
      // This allows the SDK to automatically manage remote audio playback
      if (this.audioElement) {
        console.log('[Telnyx WebRTC] Setting remoteElement on client');
        this.client.remoteElement = this.audioElement;
      }
      
      // CRITICAL: Enable microphone BEFORE connect() so tracks are ready for first call
      console.log('[Telnyx WebRTC] Enabling microphone before connect...');
      try {
        await this.client.enableMicrophone();
        console.log('[Telnyx WebRTC] Microphone enabled successfully');
      } catch (micError) {
        console.error('[Telnyx WebRTC] Failed to enable microphone:', micError);
      }
      
      this.client.on('telnyx.ready', () => {
        console.log('[Telnyx WebRTC] Connected and ready');
        store.setConnectionStatus('connected');
      });
      
      this.client.on('telnyx.error', (error: any) => {
        console.error('[Telnyx WebRTC] Error:', error);
        store.setConnectionStatus('error', error?.message || 'Connection error');
      });
      
      this.client.on('telnyx.socket.close', () => {
        console.log('[Telnyx WebRTC] Socket closed');
        store.setConnectionStatus('disconnected');
      });
      
      this.client.on('telnyx.notification', (notification: any) => {
        // Resolve direction from payload (most reliable) or fall back to call object
        const resolvedDirection = notification.payload?.direction ?? notification.call?.direction ?? notification.call?.options?.direction;
        console.log('[Telnyx WebRTC] Notification:', notification.type, 'call state:', notification.call?.state, 'direction:', resolvedDirection);
        
        if (notification.type === 'callUpdate') {
          const call = notification.call;
          
          // Log all call properties for debugging incoming calls
          if (call.state === 'ringing' || call.state === 'new') {
            console.log('[Telnyx WebRTC] Call details:', {
              state: call.state,
              direction: resolvedDirection,
              payloadDirection: notification.payload?.direction,
              callDirection: call.direction,
              remoteCallerNumber: call.options?.remoteCallerNumber,
              destinationNumber: call.options?.destinationNumber,
              id: call.id
            });
          }
          
          // Handle incoming calls - check payload.direction first, then fall back to remoteCallerNumber detection
          const isInboundCall = resolvedDirection === 'inbound' || 
            (!resolvedDirection && call.options?.remoteCallerNumber && !this.isOutboundCallInProgress);
          
          if ((call.state === 'ringing' || call.state === 'new') && isInboundCall) {
            console.log('[Telnyx WebRTC] Incoming call from:', call.options?.remoteCallerNumber);
            store.setIncomingCall(call);
            this.startRingtone(); // Play ringtone for incoming calls
          } else if (call.state === 'trying' || call.state === 'early' || call.state === 'ringing') {
            // Outbound call is connecting - play ringback tone
            if (call.direction === 'outbound') {
              console.log('[Telnyx WebRTC] Outbound call connecting, starting ringback');
              this.startRingback();
              
              // Also try to play early media if available (carrier ringback)
              if (this.audioElement && call.remoteStream) {
                console.log('[Telnyx WebRTC] Early media available, playing carrier ringback');
                this.stopRingback(); // Stop local ringback if carrier provides one
                this.audioElement.srcObject = call.remoteStream;
                this.audioElement.play().catch(console.error);
              }
            }
          } else if (call.state === 'active') {
            console.log('[Telnyx WebRTC] Call active');
            this.stopRingback(); // Stop ringback when call is answered
            this.stopRingtone(); // Stop ringtone when call is answered
            
            // DEBUG: Log detailed stream information to diagnose audio issues
            console.log('[Telnyx WebRTC] DIAGNOSTIC - Call streams:', {
              hasLocalStream: !!call.localStream,
              hasRemoteStream: !!call.remoteStream,
              localTracks: call.localStream?.getTracks?.()?.map((t: any) => ({ kind: t.kind, enabled: t.enabled, muted: t.muted, readyState: t.readyState })) || [],
              remoteTracks: call.remoteStream?.getTracks?.()?.map((t: any) => ({ kind: t.kind, enabled: t.enabled, muted: t.muted, readyState: t.readyState })) || [],
              peerConnectionState: call.peer?.pc?.connectionState,
              iceConnectionState: call.peer?.pc?.iceConnectionState,
            });
            
            // Determine direction using resolved value or inference
            const callDirection = resolvedDirection || 
              (call.options?.remoteCallerNumber ? 'inbound' : 'outbound');
            
            store.setCurrentCall(call, callDirection as 'inbound' | 'outbound');
            store.setIncomingCall(undefined);
            
            // Record call start time and info for logging
            this.currentCallStartTime = new Date();
            const fromNum = callDirection === 'inbound' 
              ? (call.options?.remoteCallerNumber || 'Unknown')
              : (store.callerIdNumber || 'Unknown');
            const toNum = callDirection === 'inbound'
              ? (store.callerIdNumber || 'Unknown')
              : call.options?.destinationNumber || 'Unknown';
            this.currentCallInfo = {
              callId: call.id || `webrtc-${Date.now()}`,
              fromNumber: fromNum,
              toNumber: toNum,
              direction: callDirection as 'inbound' | 'outbound',
            };
            this.logCallToServer('active');
            
            // Connect remote audio stream
            console.log('[Telnyx WebRTC] Setting up audio, audioElement:', !!this.audioElement, 'remoteStream:', !!call.remoteStream);
            if (this.audioElement && call.remoteStream) {
              this.audioElement.srcObject = call.remoteStream;
              this.audioElement.volume = 1.0;
              this.audioElement.muted = false;
              this.audioElement.play()
                .then(() => console.log('[Telnyx WebRTC] Audio playback started successfully'))
                .catch(err => console.error('[Telnyx WebRTC] Audio playback error:', err));
            } else {
              console.warn('[Telnyx WebRTC] Missing audioElement or remoteStream for audio playback');
            }
          } else if (call.state === 'hangup' || call.state === 'destroy') {
            console.log('[Telnyx WebRTC] Call ended');
            this.stopRingback(); // Stop ringback if call ends before answer
            this.stopRingtone(); // Stop ringtone if call ends
            this.isOutboundCallInProgress = false; // Reset outbound flag
            
            // Log call completion
            if (this.currentCallInfo) {
              this.logCallToServer('completed');
              this.currentCallInfo = null;
              this.currentCallStartTime = null;
            }
            
            store.setCurrentCall(undefined);
            store.setIncomingCall(undefined);
            store.setMuted(false);
            store.setOnHold(false);
          }
        }
      });
      
      await this.client.connect();
      console.log('[Telnyx WebRTC] Connect initiated');
      
    } catch (error) {
      console.error('[Telnyx WebRTC] Initialization error:', error);
      store.setConnectionStatus('error', error instanceof Error ? error.message : 'Failed to connect');
      throw error;
    }
  }
  
  public async makeCall(destinationNumber: string): Promise<TelnyxCall | null> {
    if (!this.client) {
      console.error('[Telnyx WebRTC] Client not initialized');
      return null;
    }
    
    const store = useTelnyxStore.getState();
    const callerIdNumber = store.callerIdNumber;
    
    console.log('[Telnyx WebRTC] Making call to:', destinationNumber, 'from:', callerIdNumber);
    
    try {
      // Mark that we're making an outbound call to distinguish from incoming calls
      this.isOutboundCallInProgress = true;
      
      const call = this.client.newCall({
        destinationNumber,
        callerNumber: callerIdNumber,
        callerName: 'Curbe',
        audio: true,  // Ensure audio is enabled for outbound calls
        video: false,
      });
      
      store.setCurrentCall(call);
      return call;
    } catch (error) {
      console.error('[Telnyx WebRTC] Make call error:', error);
      return null;
    }
  }
  
  public answerCall(): void {
    const store = useTelnyxStore.getState();
    const incomingCall = store.incomingCall;
    
    if (incomingCall) {
      console.log('[Telnyx WebRTC] Answering call with audio enabled');
      this.stopRingtone(); // Stop ringtone when answering
      // CRITICAL: Pass audio options to ensure local audio track is attached immediately
      incomingCall.answer({ audio: true, video: false });
    }
  }
  
  public rejectCall(): void {
    const store = useTelnyxStore.getState();
    const incomingCall = store.incomingCall;
    
    if (incomingCall) {
      console.log('[Telnyx WebRTC] Rejecting call');
      this.stopRingtone(); // Stop ringtone when rejecting
      incomingCall.hangup();
      store.setIncomingCall(undefined);
    }
  }
  
  public hangup(): void {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    
    if (currentCall) {
      // CRITICAL: Only call hangup() if the call is still in a hangupable state
      // If the remote party already hung up (state is 'hangup' or 'destroy'), 
      // calling hangup() will send a 486 Busy response instead of accepting the BYE
      const callState = currentCall.state;
      if (callState === 'hangup' || callState === 'destroy' || callState === 'purge') {
        console.log('[Telnyx WebRTC] Call already ended by remote party, just clearing state');
      } else {
        console.log('[Telnyx WebRTC] Hanging up, call state:', callState);
        currentCall.hangup();
      }
      store.setCurrentCall(undefined);
    }
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
  
  // Blind Transfer - immediately transfers call to destination
  public blindTransfer(destinationNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    
    if (!currentCall) {
      console.error('[Telnyx WebRTC] No active call to transfer');
      return false;
    }
    
    try {
      console.log('[Telnyx WebRTC] Blind transfer to:', destinationNumber);
      currentCall.transfer(destinationNumber);
      store.setCurrentCall(undefined);
      store.setMuted(false);
      store.setOnHold(false);
      return true;
    } catch (error) {
      console.error('[Telnyx WebRTC] Blind transfer failed:', error);
      return false;
    }
  }
  
  // Attended Transfer - Start consultation call
  public async startAttendedTransfer(consultNumber: string): Promise<boolean> {
    if (!this.client) {
      console.error('[Telnyx WebRTC] Client not initialized');
      return false;
    }
    
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    
    if (!currentCall) {
      console.error('[Telnyx WebRTC] No active call for attended transfer');
      return false;
    }
    
    try {
      console.log('[Telnyx WebRTC] Starting attended transfer - putting current call on hold');
      
      // Put current call on hold
      currentCall.hold();
      store.setOnHold(true);
      store.setConsulting(true);
      
      // Start consultation call
      const consultCall = this.client.newCall({
        destinationNumber: consultNumber,
        callerNumber: store.callerIdNumber,
        callerName: 'Curbe',
      });
      
      store.setConsultCall(consultCall);
      return true;
    } catch (error) {
      console.error('[Telnyx WebRTC] Start attended transfer failed:', error);
      // Resume original call on failure
      currentCall.unhold();
      store.setOnHold(false);
      store.setConsulting(false);
      return false;
    }
  }
  
  // Complete the attended transfer
  public completeAttendedTransfer(consultNumber: string): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    const consultCall = store.consultCall;
    
    if (!currentCall) {
      console.error('[Telnyx WebRTC] No primary call for transfer completion');
      return false;
    }
    
    try {
      console.log('[Telnyx WebRTC] Completing attended transfer');
      
      // Hangup consult call first
      if (consultCall) {
        consultCall.hangup();
      }
      
      // Transfer original call to the consultant number
      currentCall.transfer(consultNumber);
      
      // Clean up state
      store.setConsultCall(undefined);
      store.setCurrentCall(undefined);
      store.setConsulting(false);
      store.setOnHold(false);
      store.setMuted(false);
      
      return true;
    } catch (error) {
      console.error('[Telnyx WebRTC] Complete attended transfer failed:', error);
      return false;
    }
  }
  
  // Cancel attended transfer - resume original call
  public cancelAttendedTransfer(): boolean {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    const consultCall = store.consultCall;
    
    if (!currentCall) {
      console.error('[Telnyx WebRTC] No primary call to resume');
      return false;
    }
    
    try {
      console.log('[Telnyx WebRTC] Canceling attended transfer - resuming original call');
      
      // Hangup consult call
      if (consultCall) {
        consultCall.hangup();
      }
      
      // Resume original call
      currentCall.unhold();
      
      // Clean up state
      store.setConsultCall(undefined);
      store.setConsulting(false);
      store.setOnHold(false);
      
      return true;
    } catch (error) {
      console.error('[Telnyx WebRTC] Cancel attended transfer failed:', error);
      return false;
    }
  }
  
  // Get current call quality metrics (called periodically)
  public getCallQuality(): void {
    const store = useTelnyxStore.getState();
    const currentCall = store.currentCall;
    
    if (!currentCall) {
      store.setNetworkQuality(undefined);
      return;
    }
    
    try {
      // Try to get RTC stats from the call
      const options = (currentCall as any).options || {};
      const stats = options.stats || {};
      
      // Parse quality metrics (these may vary based on Telnyx SDK version)
      const mos = stats.mos || stats.quality?.mos || 4.0;
      const jitter = stats.jitter || stats.audio?.jitter || 0;
      const packetLoss = stats.packetLoss || stats.audio?.packetsLost || 0;
      const rtt = stats.rtt || stats.roundTripTime || 0;
      
      // Calculate quality level
      let qualityLevel: 'excellent' | 'good' | 'poor' = 'excellent';
      if (mos < 3.0 || packetLoss > 5) {
        qualityLevel = 'poor';
      } else if (mos < 4.0 || packetLoss > 1) {
        qualityLevel = 'good';
      }
      
      store.setNetworkQuality({
        mos,
        jitter,
        packetLoss,
        rtt,
        qualityLevel,
      });
    } catch (error) {
      console.error('[Telnyx WebRTC] Failed to get call quality:', error);
    }
  }
  
  public disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    
    const store = useTelnyxStore.getState();
    store.setConnectionStatus('disconnected');
    store.setCurrentCall(undefined);
    store.setIncomingCall(undefined);
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
