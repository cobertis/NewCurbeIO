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
  isCallActive: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  isConsulting: boolean; // True when in attended transfer consultation
  callerIdNumber?: string;
  sipUsername?: string;
  networkQuality?: NetworkQualityMetrics;
  callDuration: number; // Duration in seconds
  
  setConnectionStatus: (status: TelnyxWebRTCState['connectionStatus'], error?: string) => void;
  setCurrentCall: (call?: TelnyxCall) => void;
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
  setCurrentCall: (call) => set({ currentCall: call, isCallActive: !!call }),
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
  
  private constructor() {
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
    // Create a ringtone for incoming calls using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sampleRate = audioContext.sampleRate;
      const duration = 3; // 1s ring, 2s silence
      const bufferSize = sampleRate * duration;
      const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate classic phone ring: 440Hz + 480Hz alternating with silence
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        if (t < 1) {
          // Ring tone (1 second) - classic phone ring frequencies
          const envelope = Math.sin(Math.PI * t / 1) * 0.5; // Fade in/out
          data[i] = envelope * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t));
        } else {
          // Silence (2 seconds)
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
    console.log('[Telnyx WebRTC] Audio element registered:', !!element);
    this.audioElement = element;
    
    // If there's an active call with remoteStream, connect it now
    const store = useTelnyxStore.getState();
    if (store.currentCall) {
      const call = store.currentCall as any;
      if (call.remoteStream) {
        console.log('[Telnyx WebRTC] Reconnecting existing call audio after element registration');
        this.connectRemoteAudio(call);
      }
    }
  }
  
  /**
   * CRITICAL: Connect remote audio stream to audio element with robust retry logic
   * This ensures bidirectional audio works even if audio element wasn't available initially
   */
  private connectRemoteAudio(call: any, retryCount = 0): void {
    const maxRetries = 5;
    const retryDelay = 200;
    
    console.log(`[Telnyx WebRTC] connectRemoteAudio attempt ${retryCount + 1}/${maxRetries + 1}:`, {
      hasAudioElement: !!this.audioElement,
      hasRemoteStream: !!call?.remoteStream,
      remoteStreamActive: call?.remoteStream?.active,
      audioTracks: call?.remoteStream?.getAudioTracks?.()?.length || 0,
    });
    
    if (this.audioElement && call?.remoteStream) {
      try {
        // Set the stream as source
        this.audioElement.srcObject = call.remoteStream;
        this.audioElement.volume = 1.0;
        this.audioElement.muted = false;
        
        // Play the audio
        this.audioElement.play()
          .then(() => {
            console.log('[Telnyx WebRTC] ✅ Remote audio playing successfully!');
            console.log('[Telnyx WebRTC] Audio element state:', {
              paused: this.audioElement?.paused,
              muted: this.audioElement?.muted,
              volume: this.audioElement?.volume,
              readyState: this.audioElement?.readyState,
            });
          })
          .catch((error) => {
            console.error('[Telnyx WebRTC] ❌ Failed to play audio:', error);
            // Retry on autoplay issues
            if (retryCount < maxRetries) {
              setTimeout(() => this.connectRemoteAudio(call, retryCount + 1), retryDelay);
            }
          });
      } catch (error) {
        console.error('[Telnyx WebRTC] ❌ Error connecting audio:', error);
        if (retryCount < maxRetries) {
          setTimeout(() => this.connectRemoteAudio(call, retryCount + 1), retryDelay);
        }
      }
    } else {
      console.warn('[Telnyx WebRTC] ⚠️ Missing audio element or remoteStream');
      // Retry if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        console.log(`[Telnyx WebRTC] Retrying in ${retryDelay}ms...`);
        setTimeout(() => this.connectRemoteAudio(call, retryCount + 1), retryDelay);
      } else {
        console.error('[Telnyx WebRTC] ❌ Max retries exceeded for audio connection');
      }
    }
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
      
      this.client = new TelnyxRTC({
        login: sipUsername,
        password: sipPassword,
        ringtoneFile: undefined,
        ringbackFile: undefined,
        // Enable debugging for troubleshooting audio issues
        debug: true,
        debugOutput: 'socket',
      });
      
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
        const call = notification.call;
        
        // CRITICAL: Get fresh store state for each notification (not cached from initialize)
        const currentStore = useTelnyxStore.getState();
        const callerIdNumber = currentStore.callerIdNumber;
        const remoteNumber = call?.options?.remoteCallerNumber;
        const destinationNumber = call?.options?.destinationNumber;
        
        // Direction inference: 
        // - If destinationNumber matches our callerIdNumber -> inbound (someone calling us)
        // - Otherwise -> outbound (we're calling someone)
        let inferredDirection = call?.direction;
        if (!inferredDirection && destinationNumber) {
          // Normalize numbers for comparison (remove + and non-digits, take last 10 digits)
          const normalizeNum = (n: string) => (n || '').replace(/\D/g, '').slice(-10);
          const normalizedDestination = normalizeNum(destinationNumber);
          const normalizedCallerIdNumber = normalizeNum(callerIdNumber || '');
          
          // If destination matches our number, it's an inbound call
          const isInbound = normalizedDestination === normalizedCallerIdNumber && normalizedCallerIdNumber.length > 0;
          inferredDirection = isInbound ? 'inbound' : 'outbound';
          
          console.log('[Telnyx WebRTC] Direction inference:', {
            destinationNumber,
            callerIdNumber,
            normalizedDestination,
            normalizedCallerIdNumber,
            isInbound,
            inferredDirection,
          });
        }
        
        console.log('[Telnyx WebRTC] Notification:', notification.type, {
          state: call?.state,
          direction: call?.direction,
          inferredDirection,
          remoteCallerNumber: remoteNumber,
          destinationNumber: destinationNumber,
          ourCallerIdNumber: callerIdNumber,
          callId: call?.id,
        });
        
        if (notification.type === 'callUpdate') {
          // Handle incoming calls - use inferredDirection since SDK may not provide direction
          if ((call.state === 'ringing' || call.state === 'new') && inferredDirection === 'inbound') {
            console.log('[Telnyx WebRTC] 📞 INCOMING CALL from:', remoteNumber);
            store.setIncomingCall(call);
            this.startRingtone(); // Play ringtone for incoming calls
          } else if (call.state === 'trying' || call.state === 'early' || call.state === 'ringing') {
            // Outbound call is connecting - play ringback tone
            if (inferredDirection === 'outbound') {
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
            store.setCurrentCall(call);
            store.setIncomingCall(undefined);
            
            // Record call start time and info for logging
            this.currentCallStartTime = new Date();
            const fromNum = call.direction === 'inbound' 
              ? (call.options?.remoteCallerNumber || 'Unknown')
              : (store.callerIdNumber || 'Unknown');
            const toNum = call.direction === 'inbound'
              ? (store.callerIdNumber || 'Unknown')
              : call.options?.destinationNumber || 'Unknown';
            this.currentCallInfo = {
              callId: call.id || `webrtc-${Date.now()}`,
              fromNumber: fromNum,
              toNumber: toNum,
              direction: call.direction as 'inbound' | 'outbound',
            };
            this.logCallToServer('active');
            
            // CRITICAL: Connect remote audio stream for bidirectional audio
            this.connectRemoteAudio(call);
          } else if (call.state === 'hangup' || call.state === 'destroy') {
            // Log detailed hangup information for debugging
            console.log('[Telnyx WebRTC] Call ended with details:', {
              state: call.state,
              cause: call.cause,
              causeCode: call.causeCode,
              sipCode: call.sipCode,
              sipReason: call.sipReason,
              direction: call.direction,
              hangupReason: call.options?.hangupReason,
            });
            this.stopRingback(); // Stop ringback if call ends before answer
            this.stopRingtone(); // Stop ringtone if call ends
            
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
      const call = this.client.newCall({
        destinationNumber,
        callerNumber: callerIdNumber,
        callerName: 'Curbe',
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
      console.log('[Telnyx WebRTC] Answering call');
      this.stopRingtone(); // Stop ringtone when answering
      incomingCall.answer();
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
      console.log('[Telnyx WebRTC] Hanging up');
      currentCall.hangup();
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
