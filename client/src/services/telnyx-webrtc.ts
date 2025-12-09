import { TelnyxRTC } from '@telnyx/webrtc';
import { create } from 'zustand';

type TelnyxCall = ReturnType<TelnyxRTC['newCall']>;

interface TelnyxWebRTCState {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectionError?: string;
  currentCall?: TelnyxCall;
  incomingCall?: TelnyxCall;
  isCallActive: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  callerIdNumber?: string;
  sipUsername?: string;
  
  setConnectionStatus: (status: TelnyxWebRTCState['connectionStatus'], error?: string) => void;
  setCurrentCall: (call?: TelnyxCall) => void;
  setIncomingCall: (call?: TelnyxCall) => void;
  setMuted: (muted: boolean) => void;
  setOnHold: (hold: boolean) => void;
  setCallerIdNumber: (number: string) => void;
  setSipUsername: (username: string) => void;
}

export const useTelnyxStore = create<TelnyxWebRTCState>((set) => ({
  isConnected: false,
  connectionStatus: 'disconnected',
  isCallActive: false,
  isMuted: false,
  isOnHold: false,
  
  setConnectionStatus: (status, error) => set({ 
    connectionStatus: status, 
    connectionError: error,
    isConnected: status === 'connected'
  }),
  setCurrentCall: (call) => set({ currentCall: call, isCallActive: !!call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setMuted: (muted) => set({ isMuted: muted }),
  setOnHold: (hold) => set({ isOnHold: hold }),
  setCallerIdNumber: (number) => set({ callerIdNumber: number }),
  setSipUsername: (username) => set({ sipUsername: username }),
}));

class TelnyxWebRTCManager {
  private static instance: TelnyxWebRTCManager;
  private client: TelnyxRTC | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private ringbackAudio: HTMLAudioElement | null = null;
  private isPlayingRingback: boolean = false;
  
  private constructor() {
    // Create ringback audio element for outbound calls
    this.ringbackAudio = new Audio();
    this.ringbackAudio.loop = true;
    // US ringback tone pattern: 440Hz + 480Hz, 2s on, 4s off
    this.createRingbackTone();
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
  
  public static getInstance(): TelnyxWebRTCManager {
    if (!TelnyxWebRTCManager.instance) {
      TelnyxWebRTCManager.instance = new TelnyxWebRTCManager();
    }
    return TelnyxWebRTCManager.instance;
  }
  
  public setAudioElement(element: HTMLAudioElement) {
    this.audioElement = element;
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
        console.log('[Telnyx WebRTC] Notification:', notification.type, 'call state:', notification.call?.state);
        
        if (notification.type === 'callUpdate') {
          const call = notification.call;
          
          if (call.state === 'ringing' && call.direction === 'inbound') {
            console.log('[Telnyx WebRTC] Incoming call from:', call.options?.remoteCallerNumber);
            store.setIncomingCall(call);
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
            store.setCurrentCall(call);
            store.setIncomingCall(undefined);
            
            if (this.audioElement && call.remoteStream) {
              this.audioElement.srcObject = call.remoteStream;
              this.audioElement.play().catch(console.error);
            }
          } else if (call.state === 'hangup' || call.state === 'destroy') {
            console.log('[Telnyx WebRTC] Call ended');
            this.stopRingback(); // Stop ringback if call ends before answer
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
      incomingCall.answer();
    }
  }
  
  public rejectCall(): void {
    const store = useTelnyxStore.getState();
    const incomingCall = store.incomingCall;
    
    if (incomingCall) {
      console.log('[Telnyx WebRTC] Rejecting call');
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
  
  public disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    
    const store = useTelnyxStore.getState();
    store.setConnectionStatus('disconnected');
    store.setCurrentCall(undefined);
    store.setIncomingCall(undefined);
  }
  
  public isInitialized(): boolean {
    return this.client !== null;
  }
}

export const telnyxWebRTC = TelnyxWebRTCManager.getInstance();
