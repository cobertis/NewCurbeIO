import { useState, useEffect, useCallback, useRef } from 'react';
import { TelnyxRTC, Call } from '@telnyx/webrtc';

interface TelnyxPhoneState {
  sessionStatus: 'disconnected' | 'connecting' | 'registered' | 'error';
  activeCall: Call | null;
  incomingCall: Call | null;
  isMuted: boolean;
  isOnHold: boolean;
  callerIdNumber: string;
}

// Create global audio element for remote audio playback
let remoteAudioElement: HTMLAudioElement | null = null;

const getOrCreateRemoteAudio = (): HTMLAudioElement => {
  if (!remoteAudioElement) {
    remoteAudioElement = document.createElement('audio');
    remoteAudioElement.id = 'telnyx-remote-audio';
    remoteAudioElement.autoplay = true;
    remoteAudioElement.playsInline = true;
    document.body.appendChild(remoteAudioElement);
    console.log('[TelnyxPhone] Created remote audio element');
  }
  return remoteAudioElement;
};

// Attach remote stream to audio element
const attachRemoteStream = (call: Call) => {
  const audioElement = getOrCreateRemoteAudio();
  const stream = call.remoteStream;
  
  if (stream) {
    console.log('[TelnyxPhone] Attaching remoteStream to audio element');
    console.log('[TelnyxPhone] Stream tracks:', stream.getTracks().length);
    audioElement.srcObject = stream;
    audioElement.play()
      .then(() => console.log('[TelnyxPhone] Remote audio playing'))
      .catch(e => console.error('[TelnyxPhone] Audio play error:', e));
  } else {
    console.log('[TelnyxPhone] No remoteStream available yet');
  }
};

export const useTelnyxPhone = () => {
  const clientRef = useRef<TelnyxRTC | null>(null);
  
  const [state, setState] = useState<TelnyxPhoneState>({
    sessionStatus: 'disconnected',
    activeCall: null,
    incomingCall: null,
    isMuted: false,
    isOnHold: false,
    callerIdNumber: '',
  });

  const initClient = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, sessionStatus: 'connecting' }));
      
      // Create remote audio element
      getOrCreateRemoteAudio();
      
      // Per Telnyx docs: Request microphone permission BEFORE connecting
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[TelnyxPhone] Microphone permission granted');
      } catch (e) {
        console.error('[TelnyxPhone] Microphone permission denied:', e);
      }
      
      const response = await fetch('/api/webrtc/token', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to get WebRTC credentials');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get credentials');
      }

      if (!data.token && !data.sipUsername) {
        throw new Error('No valid credentials received');
      }

      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      // Build client config per IClientOptions
      const clientConfig: any = {};

      if (data.token) {
        clientConfig.login_token = data.token;
        console.log('[TelnyxPhone] Using login_token authentication');
      } else if (data.sipUsername && data.sipPassword) {
        clientConfig.login = data.sipUsername;
        clientConfig.password = data.sipPassword;
        console.log('[TelnyxPhone] Using SIP credentials authentication');
      }

      console.log('SDK version:', TelnyxRTC.version || '2.25.10');

      const newClient = new TelnyxRTC(clientConfig);
      
      // Set remoteElement on client
      newClient.remoteElement = getOrCreateRemoteAudio();
      console.log('[TelnyxPhone] Set client.remoteElement');

      newClient.on('telnyx.ready', () => {
        console.log('[TelnyxPhone] Client ready and registered');
        setState(prev => ({ ...prev, sessionStatus: 'registered' }));
      });

      newClient.on('telnyx.error', (error: any) => {
        console.error('[TelnyxPhone] Client error:', error);
        setState(prev => ({ ...prev, sessionStatus: 'error' }));
      });

      newClient.on('telnyx.socket.close', () => {
        console.log('[TelnyxPhone] Socket closed');
        setState(prev => ({ ...prev, sessionStatus: 'disconnected' }));
      });

      newClient.on('telnyx.notification', (notification: any) => {
        const call = notification.call as Call;
        
        if (notification.type === 'callUpdate') {
          const direction = call.direction;
          console.log('[TelnyxPhone] Call update:', call.state, 'direction:', direction);
          
          switch (call.state) {
            case 'ringing':
              if (direction === 'inbound') {
                console.log('[TelnyxPhone] Incoming call detected!');
                setState(prev => ({ ...prev, incomingCall: call }));
              }
              break;
            case 'active':
              console.log('[TelnyxPhone] Call is now active');
              // Attach remote stream when call becomes active
              attachRemoteStream(call);
              setState(prev => ({ 
                ...prev, 
                activeCall: call, 
                incomingCall: null 
              }));
              break;
            case 'hangup':
            case 'destroy':
              // Clear audio
              const audioEl = getOrCreateRemoteAudio();
              audioEl.srcObject = null;
              setState(prev => ({ 
                ...prev, 
                activeCall: null, 
                incomingCall: null,
                isMuted: false,
                isOnHold: false,
              }));
              break;
          }
        }
      });

      await newClient.connect();
      clientRef.current = newClient;
      
      setState(prev => ({ 
        ...prev, 
        callerIdNumber: data.callerIdNumber || '' 
      }));

    } catch (error) {
      console.error('[TelnyxPhone] Init error:', error);
      setState(prev => ({ ...prev, sessionStatus: 'error' }));
    }
  }, []);

  useEffect(() => {
    initClient();
    
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [initClient]);

  const makeCall = useCallback((destination: string) => {
    if (!clientRef.current || state.sessionStatus !== 'registered') {
      console.error('[TelnyxPhone] Cannot make call - not registered');
      return;
    }
    
    const call = clientRef.current.newCall({
      destinationNumber: destination,
      callerName: 'Curbe Agent',
      callerNumber: state.callerIdNumber,
      audio: true,
    });
    
    setState(prev => ({ ...prev, activeCall: call }));
  }, [state.sessionStatus, state.callerIdNumber]);

  // Per Telnyx docs: answer with audio: true
  const answerCall = useCallback(() => {
    if (state.incomingCall) {
      const call = state.incomingCall;
      
      console.log('[TelnyxPhone] Answering call with audio: true');
      
      // Answer with audio enabled per documentation
      call.answer({ audio: true } as any);
      
      // Attach stream after small delay (within same user gesture context)
      setTimeout(() => {
        attachRemoteStream(call);
      }, 300);
    }
  }, [state.incomingCall]);

  const rejectCall = useCallback(() => {
    if (state.incomingCall) {
      state.incomingCall.hangup();
      setState(prev => ({ ...prev, incomingCall: null }));
    }
  }, [state.incomingCall]);

  const hangupCall = useCallback(() => {
    if (state.activeCall) {
      state.activeCall.hangup();
    }
  }, [state.activeCall]);

  const toggleMute = useCallback(() => {
    if (state.activeCall) {
      if (state.isMuted) {
        state.activeCall.unmuteAudio();
      } else {
        state.activeCall.muteAudio();
      }
      setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, [state.activeCall, state.isMuted]);

  const toggleHold = useCallback(() => {
    if (state.activeCall) {
      if (state.isOnHold) {
        state.activeCall.unhold();
      } else {
        state.activeCall.hold();
      }
      setState(prev => ({ ...prev, isOnHold: !prev.isOnHold }));
    }
  }, [state.activeCall, state.isOnHold]);

  const sendDTMF = useCallback((digit: string) => {
    if (state.activeCall) {
      state.activeCall.dtmf(digit);
    }
  }, [state.activeCall]);

  const transferCall = useCallback((target: string) => {
    if (state.activeCall) {
      (state.activeCall as any).transfer?.(target) || 
      (state.activeCall as any).blindTransfer?.(target);
    }
  }, [state.activeCall]);

  const reconnect = useCallback(() => {
    initClient();
  }, [initClient]);

  return {
    ...state,
    makeCall,
    answerCall,
    rejectCall,
    hangupCall,
    toggleMute,
    toggleHold,
    sendDTMF,
    transferCall,
    reconnect,
  };
};
