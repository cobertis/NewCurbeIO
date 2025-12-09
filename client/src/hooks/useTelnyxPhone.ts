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
      
      // Step 1: Create remote audio element BEFORE connecting (per SDK docs)
      const audioElement = getOrCreateRemoteAudio();
      
      // Step 2: Request microphone permission BEFORE connecting (per SDK docs)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[TelnyxPhone] Microphone permission granted');
      } catch (e) {
        console.error('[TelnyxPhone] Microphone permission denied:', e);
      }
      
      // Step 3: Get credentials from backend
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

      // Cleanup existing client if any
      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      // Step 4: Build client config per SDK documentation
      const clientConfig: any = {};

      if (data.token) {
        clientConfig.login_token = data.token;
        console.log('[TelnyxPhone] Using login_token authentication');
      } else if (data.sipUsername && data.sipPassword) {
        clientConfig.login = data.sipUsername;
        clientConfig.password = data.sipPassword;
        console.log('[TelnyxPhone] Using SIP credentials authentication');
      }

      console.log('[TelnyxPhone] SDK version:', TelnyxRTC.version || '2.25.10');

      // Step 5: Create client instance
      const newClient = new TelnyxRTC(clientConfig);
      
      // Step 6: Set remoteElement BEFORE connect() per SDK docs
      // SDK will automatically attach remote audio to this element
      newClient.remoteElement = audioElement;
      console.log('[TelnyxPhone] Set client.remoteElement before connect');

      // Event: telnyx.ready - Client is connected and registered
      newClient.on('telnyx.ready', () => {
        console.log('[TelnyxPhone] telnyx.ready - Client registered');
        setState(prev => ({ ...prev, sessionStatus: 'registered' }));
      });

      // Event: telnyx.error - Client error
      newClient.on('telnyx.error', (error: any) => {
        console.error('[TelnyxPhone] telnyx.error:', error);
        setState(prev => ({ ...prev, sessionStatus: 'error' }));
      });

      // Event: telnyx.socket.close - Socket disconnected
      newClient.on('telnyx.socket.close', () => {
        console.log('[TelnyxPhone] telnyx.socket.close');
        setState(prev => ({ ...prev, sessionStatus: 'disconnected' }));
      });

      // Event: telnyx.notification - Per SDK documentation
      // This handles ALL notifications including incomingCall and callUpdate
      newClient.on('telnyx.notification', (notification: any) => {
        console.log('[TelnyxPhone] telnyx.notification type:', notification.type);
        
        const call = notification.call as Call;
        
        // Per SDK docs: Handle 'incomingCall' notification type
        if (notification.type === 'incomingCall') {
          console.log('[TelnyxPhone] incomingCall notification received');
          console.log('[TelnyxPhone] Caller:', (call as any).options?.remote_caller_id_number);
          setState(prev => ({ ...prev, incomingCall: call }));
          return;
        }
        
        // Per SDK docs: Handle 'callUpdate' notification type
        if (notification.type === 'callUpdate') {
          console.log('[TelnyxPhone] callUpdate - state:', call.state, 'direction:', call.direction);
          
          switch (call.state) {
            case 'ringing':
              // Per SDK docs: Check direction for inbound calls
              if (call.direction === 'inbound') {
                console.log('[TelnyxPhone] Inbound call ringing');
                setState(prev => ({ ...prev, incomingCall: call }));
              }
              break;
              
            case 'active':
              console.log('[TelnyxPhone] Call is now active');
              // SDK handles audio via remoteElement automatically
              if (call.remoteStream) {
                console.log('[TelnyxPhone] Remote stream tracks:', call.remoteStream.getTracks().length);
              }
              setState(prev => ({ 
                ...prev, 
                activeCall: call, 
                incomingCall: null 
              }));
              break;
              
            case 'hangup':
            case 'destroy':
              console.log('[TelnyxPhone] Call ended:', call.state);
              // Clear audio element
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

      // Step 7: Connect to Telnyx
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

  // Per SDK docs: client.newCall() for outbound calls
  const makeCall = useCallback((destination: string) => {
    if (!clientRef.current || state.sessionStatus !== 'registered') {
      console.error('[TelnyxPhone] Cannot make call - not registered');
      return;
    }
    
    console.log('[TelnyxPhone] Making outbound call to:', destination);
    
    const call = clientRef.current.newCall({
      destinationNumber: destination,
      callerName: 'Curbe Agent',
      callerNumber: state.callerIdNumber,
      audio: true,
    });
    
    setState(prev => ({ ...prev, activeCall: call }));
  }, [state.sessionStatus, state.callerIdNumber]);

  // Per SDK docs: call.answer() with NO arguments
  const answerCall = useCallback(() => {
    if (state.incomingCall) {
      console.log('[TelnyxPhone] Answering call - no arguments per SDK docs');
      state.incomingCall.answer();
    }
  }, [state.incomingCall]);

  // Per SDK docs: call.hangup() to reject
  const rejectCall = useCallback(() => {
    if (state.incomingCall) {
      console.log('[TelnyxPhone] Rejecting call');
      state.incomingCall.hangup();
      setState(prev => ({ ...prev, incomingCall: null }));
    }
  }, [state.incomingCall]);

  // Per SDK docs: call.hangup() to end active call
  const hangupCall = useCallback(() => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Hanging up active call');
      state.activeCall.hangup();
    }
  }, [state.activeCall]);

  // Per SDK docs: call.muteAudio() / call.unmuteAudio()
  const toggleMute = useCallback(() => {
    if (state.activeCall) {
      if (state.isMuted) {
        state.activeCall.unmuteAudio();
        console.log('[TelnyxPhone] Unmuted');
      } else {
        state.activeCall.muteAudio();
        console.log('[TelnyxPhone] Muted');
      }
      setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, [state.activeCall, state.isMuted]);

  // Per SDK docs: call.hold() / call.unhold()
  const toggleHold = useCallback(() => {
    if (state.activeCall) {
      if (state.isOnHold) {
        state.activeCall.unhold();
        console.log('[TelnyxPhone] Unhold');
      } else {
        state.activeCall.hold();
        console.log('[TelnyxPhone] Hold');
      }
      setState(prev => ({ ...prev, isOnHold: !prev.isOnHold }));
    }
  }, [state.activeCall, state.isOnHold]);

  // Per SDK docs: call.dtmf()
  const sendDTMF = useCallback((digit: string) => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Sending DTMF:', digit);
      state.activeCall.dtmf(digit);
    }
  }, [state.activeCall]);

  // Transfer call
  const transferCall = useCallback((target: string) => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Transferring to:', target);
      (state.activeCall as any).transfer?.(target) || 
      (state.activeCall as any).blindTransfer?.(target);
    }
  }, [state.activeCall]);

  const reconnect = useCallback(() => {
    console.log('[TelnyxPhone] Reconnecting...');
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
