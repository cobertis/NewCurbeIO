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
  
  private constructor() {}
  
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
        console.log('[Telnyx WebRTC] Notification:', notification.type);
        
        if (notification.type === 'callUpdate') {
          const call = notification.call;
          
          if (call.state === 'ringing' && call.direction === 'inbound') {
            console.log('[Telnyx WebRTC] Incoming call from:', call.options?.remoteCallerNumber);
            store.setIncomingCall(call);
          } else if (call.state === 'active') {
            console.log('[Telnyx WebRTC] Call active');
            store.setCurrentCall(call);
            store.setIncomingCall(undefined);
            
            if (this.audioElement && call.remoteStream) {
              this.audioElement.srcObject = call.remoteStream;
              this.audioElement.play().catch(console.error);
            }
          } else if (call.state === 'hangup' || call.state === 'destroy') {
            console.log('[Telnyx WebRTC] Call ended');
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
