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
      
      const response = await fetch('/api/webrtc/token', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to get WebRTC token');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.token) {
        throw new Error(data.error || 'No token received');
      }

      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      const newClient = new TelnyxRTC({
        login_token: data.token,
        ringtoneFile: '/ring.mp3',
        ringbackFile: '/ringback.mp3',
      });

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
          console.log('[TelnyxPhone] Call update:', call.state, call.direction);
          
          switch (call.state) {
            case 'ringing':
              if (call.direction === 'inbound') {
                setState(prev => ({ ...prev, incomingCall: call }));
              }
              break;
            case 'active':
              setState(prev => ({ 
                ...prev, 
                activeCall: call, 
                incomingCall: null 
              }));
              break;
            case 'hangup':
            case 'destroy':
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
    });
    
    setState(prev => ({ ...prev, activeCall: call }));
  }, [state.sessionStatus, state.callerIdNumber]);

  const answerCall = useCallback(() => {
    if (state.incomingCall) {
      state.incomingCall.answer();
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
