import { create } from 'zustand';

export interface WhatsAppCall {
  callId: string;
  from: string;
  to: string;
  fromName: string;
  timestamp: string;
  status: 'ringing' | 'answered' | 'ended' | 'missed';
  sdpOffer: string;
}

interface WhatsAppCallState {
  isConnected: boolean;
  incomingCall: WhatsAppCall | null;
  activeCall: WhatsAppCall | null;
  isAnswering: boolean;
  isMuted: boolean;
  callDuration: number;
  
  setConnected: (connected: boolean) => void;
  setIncomingCall: (call: WhatsAppCall | null) => void;
  setActiveCall: (call: WhatsAppCall | null) => void;
  setIsAnswering: (answering: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setCallDuration: (duration: number) => void;
  reset: () => void;
}

export const useWhatsAppCallStore = create<WhatsAppCallState>((set) => ({
  isConnected: false,
  incomingCall: null,
  activeCall: null,
  isAnswering: false,
  isMuted: false,
  callDuration: 0,
  
  setConnected: (connected) => set({ isConnected: connected }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setActiveCall: (call) => set({ activeCall: call }),
  setIsAnswering: (answering) => set({ isAnswering: answering }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setCallDuration: (duration) => set({ callDuration: duration }),
  reset: () => set({
    incomingCall: null,
    activeCall: null,
    isAnswering: false,
    isMuted: false,
    callDuration: 0,
  }),
}));

class WhatsAppCallService {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private callStartTime: number | null = null;
  private durationInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private ringtoneOscillator: OscillatorNode | null = null;
  private ringtoneInterval: NodeJS.Timeout | null = null;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws/whatsapp-call`);

    this.ws.onopen = () => {
      console.log('[WhatsApp Call Service] WebSocket connected');
      useWhatsAppCallStore.getState().setConnected(true);
    };

    this.ws.onclose = () => {
      console.log('[WhatsApp Call Service] WebSocket disconnected');
      useWhatsAppCallStore.getState().setConnected(false);
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('[WhatsApp Call Service] WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WhatsApp Call Service] Received:', data.type);
        this.handleMessage(data);
      } catch (error) {
        console.error('[WhatsApp Call Service] Error parsing message:', error);
      }
    };
  }

  private handleMessage(data: any) {
    const store = useWhatsAppCallStore.getState();

    switch (data.type) {
      case 'registered':
        console.log('[WhatsApp Call Service] Registered for calls');
        break;

      case 'whatsapp_incoming_call':
        if (!store.activeCall && !store.incomingCall) {
          store.setIncomingCall(data.call);
          this.playRingtone();
        }
        break;

      case 'whatsapp_call_answered':
        if (data.callId === store.incomingCall?.callId) {
          store.setIncomingCall(null);
          this.stopRingtone();
        }
        break;

      case 'whatsapp_call_ended':
      case 'whatsapp_call_declined':
      case 'whatsapp_call_missed':
        if (data.callId === store.incomingCall?.callId || data.callId === store.activeCall?.callId) {
          this.handleCallEnd();
        }
        break;

      case 'answer_result':
        if (!data.success) {
          console.error('[WhatsApp Call Service] Answer failed:', data.error);
          this.handleCallEnd();
        }
        break;

      case 'error':
        console.error('[WhatsApp Call Service] Server error:', data.message);
        break;
    }
  }

  private playRingtone() {
    try {
      const audioContext = new AudioContext();
      const playBeep = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 440;
        gainNode.gain.value = 0.1;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
      };
      
      playBeep();
      this.ringtoneInterval = setInterval(playBeep, 2000);
    } catch (e) {
      console.log('[WhatsApp Call Service] Could not play ringtone');
    }
  }

  private stopRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  async answerCall() {
    const store = useWhatsAppCallStore.getState();
    const incomingCall = store.incomingCall;
    
    if (!incomingCall || !this.ws) return;

    store.setIsAnswering(true);
    this.stopRingtone();

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });

      this.pc.ontrack = (event) => {
        console.log('[WhatsApp Call Service] Remote track received');
        if (!this.audioElement) {
          this.audioElement = document.createElement('audio');
          this.audioElement.autoplay = true;
          document.body.appendChild(this.audioElement);
        }
        if (event.streams[0]) {
          this.audioElement.srcObject = event.streams[0];
          this.audioElement.play().catch(console.error);
        }
      };

      this.pc.onconnectionstatechange = () => {
        console.log('[WhatsApp Call Service] Connection state:', this.pc?.connectionState);
        if (this.pc?.connectionState === 'disconnected' || this.pc?.connectionState === 'failed') {
          this.handleCallEnd();
        }
      };

      await this.pc.setRemoteDescription({
        type: 'offer',
        sdp: incomingCall.sdpOffer
      });

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      let modifiedSdp = answer.sdp || '';
      modifiedSdp = modifiedSdp.replace(/a=setup:actpass/g, 'a=setup:active');

      this.ws.send(JSON.stringify({
        type: 'answer',
        callId: incomingCall.callId,
        sdpAnswer: modifiedSdp
      }));

      const activeCall: WhatsAppCall = {
        ...incomingCall,
        status: 'answered'
      };
      
      store.setActiveCall(activeCall);
      store.setIncomingCall(null);
      store.setIsAnswering(false);

      this.callStartTime = Date.now();
      this.durationInterval = setInterval(() => {
        if (this.callStartTime) {
          store.setCallDuration(Math.floor((Date.now() - this.callStartTime) / 1000));
        }
      }, 1000);

    } catch (error: any) {
      console.error('[WhatsApp Call Service] Error answering:', error);
      this.handleCallEnd();
    }
  }

  declineCall() {
    const store = useWhatsAppCallStore.getState();
    const incomingCall = store.incomingCall;
    
    if (!incomingCall || !this.ws) return;

    this.ws.send(JSON.stringify({
      type: 'decline',
      callId: incomingCall.callId
    }));

    this.handleCallEnd();
  }

  hangUp() {
    const store = useWhatsAppCallStore.getState();
    const activeCall = store.activeCall;
    
    if (!activeCall || !this.ws) return;

    this.ws.send(JSON.stringify({
      type: 'decline',
      callId: activeCall.callId
    }));

    this.handleCallEnd();
  }

  toggleMute() {
    const store = useWhatsAppCallStore.getState();
    
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        store.setIsMuted(!audioTrack.enabled);
      }
    }
  }

  private handleCallEnd() {
    const store = useWhatsAppCallStore.getState();
    
    this.stopRingtone();
    this.cleanup();
    store.reset();
    
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    this.callStartTime = null;
  }

  private cleanup() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }
}

export const whatsAppCallService = new WhatsAppCallService();
