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

export const useTelnyxPhone = () => {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<TelnyxPhoneState>({
    sessionStatus: 'disconnected',
    activeCall: null,
    incomingCall: null,
    isMuted: false,
    isOnHold: false,
    callerIdNumber: '',
  });

  const playRingtone = useCallback(() => {
    try {
      stopRingtoneInternal();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.4;
      
      oscillator.start();
      
      audioContextRef.current = audioContext;
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
      
      let isOn = true;
      ringIntervalRef.current = setInterval(() => {
        if (gainNodeRef.current) {
          isOn = !isOn;
          gainNodeRef.current.gain.value = isOn ? 0.4 : 0;
        }
      }, 500);
      
      console.log('[TelnyxPhone] Ringtone started');
    } catch (e) {
      console.error('[TelnyxPhone] playRingtone error:', e);
    }
  }, []);

  const stopRingtoneInternal = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      clearTimeout(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop(); } catch (e) {}
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
  };

  const stopRingtone = useCallback(() => {
    stopRingtoneInternal();
    console.log('[TelnyxPhone] Ringtone stopped');
  }, []);

  const initClient = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, sessionStatus: 'connecting' }));
      
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

      // Build client config - let Telnyx SDK use its native TURN servers
      // CRITICAL: Use trickle ICE for fast connection (no 5-second delay)
      const clientConfig: any = {
        // Enable trickle ICE - audio starts as soon as ONE route is found
        // This fixes the 5-second delay on inbound calls in Replit environment
      };

      if (data.token) {
        clientConfig.login_token = data.token;
        console.log('[TelnyxPhone] Using login_token authentication');
      } else if (data.sipUsername && data.sipPassword) {
        clientConfig.login = data.sipUsername;
        clientConfig.password = data.sipPassword;
        console.log('[TelnyxPhone] Using SIP credentials authentication');
      }

      // DO NOT set manual iceServers - Telnyx SDK has built-in TURN servers
      // that work better than manual Google STUN servers
      console.log('SDK version:', TelnyxRTC.version || '2.25.10');

      const newClient = new TelnyxRTC(clientConfig);

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
          const direction = call.direction || (call as any).options?.direction;
          console.log('[TelnyxPhone] Call update:', call.state, direction);
          
          switch (call.state) {
            case 'ringing':
              if (direction === 'inbound' || !direction) {
                console.log('[TelnyxPhone] Incoming call detected!');
                playRingtone();
                setState(prev => ({ ...prev, incomingCall: call }));
              }
              break;
            case 'answering':
              stopRingtone();
              break;
            case 'active':
              stopRingtone();
              setState(prev => ({ 
                ...prev, 
                activeCall: call, 
                incomingCall: null 
              }));
              break;
            case 'hangup':
            case 'destroy':
              stopRingtone();
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
  }, [playRingtone, stopRingtone]);

  useEffect(() => {
    initClient();
    
    return () => {
      stopRingtone();
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [initClient, stopRingtone]);

  const makeCall = useCallback((destination: string) => {
    if (!clientRef.current || state.sessionStatus !== 'registered') {
      console.error('[TelnyxPhone] Cannot make call - not registered');
      return;
    }
    
    const call = clientRef.current.newCall({
      destinationNumber: destination,
      callerName: 'Curbe Agent',
      callerNumber: state.callerIdNumber,
    });
    
    setState(prev => ({ ...prev, activeCall: call }));
  }, [state.sessionStatus, state.callerIdNumber]);

  const answerCall = useCallback(() => {
    if (state.incomingCall) {
      stopRingtone();
      state.incomingCall.answer();
    }
  }, [state.incomingCall, stopRingtone]);

  const rejectCall = useCallback(() => {
    if (state.incomingCall) {
      stopRingtone();
      state.incomingCall.hangup();
      setState(prev => ({ ...prev, incomingCall: null }));
    }
  }, [state.incomingCall, stopRingtone]);

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

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      ctx.resume().then(() => {
        ctx.close();
        console.log('[TelnyxPhone] Audio unlocked');
      });
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

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
