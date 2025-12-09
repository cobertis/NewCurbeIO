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

// Per SDK docs: Create HTML audio element for remote media
let remoteAudioElement: HTMLAudioElement | null = null;

const getOrCreateRemoteAudio = (): HTMLAudioElement => {
  if (!remoteAudioElement) {
    remoteAudioElement = document.createElement('audio');
    remoteAudioElement.id = 'remoteMedia';
    remoteAudioElement.autoplay = true;
    document.body.appendChild(remoteAudioElement);
    console.log('[TelnyxPhone] Created audio element with id="remoteMedia"');
  }
  return remoteAudioElement;
};

export const useTelnyxPhone = () => {
  const clientRef = useRef<TelnyxRTC | null>(null);
  // Track if we initiated a call (for distinguishing outbound from inbound)
  const weInitiatedCallRef = useRef(false);
  
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
      
      // Per SDK docs: Create audio element
      const audioElement = getOrCreateRemoteAudio();
      
      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[TelnyxPhone] Microphone permission granted');
      } catch (e) {
        console.error('[TelnyxPhone] Microphone permission denied:', e);
      }
      
      // Get credentials from backend
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

      // Per SDK docs: Initialize the client
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

      const client = new TelnyxRTC(clientConfig);
      
      // Per SDK docs: Set remoteElement to hear/view calls in the browser
      client.remoteElement = audioElement;
      console.log('[TelnyxPhone] Set client.remoteElement');

      // Per SDK docs: Attach event listeners
      client.on('telnyx.ready', () => {
        console.log('[TelnyxPhone] telnyx.ready - ready to call');
        setState(prev => ({ ...prev, sessionStatus: 'registered' }));
      });

      client.on('telnyx.error', (error: any) => {
        console.error('[TelnyxPhone] telnyx.error:', error);
        setState(prev => ({ ...prev, sessionStatus: 'error' }));
      });

      client.on('telnyx.socket.close', () => {
        console.log('[TelnyxPhone] telnyx.socket.close');
        setState(prev => ({ ...prev, sessionStatus: 'disconnected' }));
      });

      // Per SDK docs: Events are fired on both session and call updates
      // ex: when the session has been established
      // ex: when there's an incoming call
      client.on('telnyx.notification', (notification: any) => {
        console.log('[TelnyxPhone] telnyx.notification type:', notification.type);
        
        if (notification.type === 'callUpdate') {
          const call = notification.call as Call;
          console.log('[TelnyxPhone] callUpdate state:', call.state);
          
          // Per SDK docs: Check call.state === 'ringing' for incoming calls
          if (call.state === 'ringing') {
            // If we didn't initiate this call, it's incoming
            if (!weInitiatedCallRef.current) {
              console.log('[TelnyxPhone] Incoming call detected - showing UI');
              setState(prev => ({ ...prev, incomingCall: call }));
            }
          } else if (call.state === 'active') {
            console.log('[TelnyxPhone] Call is now active');
            weInitiatedCallRef.current = false;
            setState(prev => ({ 
              ...prev, 
              activeCall: call, 
              incomingCall: null 
            }));
          } else if (call.state === 'hangup' || call.state === 'destroy') {
            console.log('[TelnyxPhone] Call ended:', call.state);
            weInitiatedCallRef.current = false;
            const audioEl = getOrCreateRemoteAudio();
            audioEl.srcObject = null;
            setState(prev => ({ 
              ...prev, 
              activeCall: null, 
              incomingCall: null,
              isMuted: false,
              isOnHold: false,
            }));
          }
        }
      });

      // Per SDK docs: Connect and login
      await client.connect();
      clientRef.current = client;
      
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

  // Per SDK docs: To initiate an outgoing call
  const makeCall = useCallback((destination: string) => {
    if (!clientRef.current || state.sessionStatus !== 'registered') {
      console.error('[TelnyxPhone] Cannot make call - not registered');
      return;
    }
    
    console.log('[TelnyxPhone] Making outbound call to:', destination);
    weInitiatedCallRef.current = true;
    
    const call = clientRef.current.newCall({
      destinationNumber: destination,
      callerNumber: state.callerIdNumber,
    });
    
    setState(prev => ({ ...prev, activeCall: call }));
  }, [state.sessionStatus, state.callerIdNumber]);

  // Per SDK docs: To answer an incoming call - call.answer()
  const answerCall = useCallback(() => {
    if (state.incomingCall) {
      console.log('[TelnyxPhone] Answering call');
      state.incomingCall.answer();
    }
  }, [state.incomingCall]);

  // Per SDK docs: Hangup or reject an incoming call - call.hangup()
  const rejectCall = useCallback(() => {
    if (state.incomingCall) {
      console.log('[TelnyxPhone] Rejecting call');
      state.incomingCall.hangup();
      setState(prev => ({ ...prev, incomingCall: null }));
    }
  }, [state.incomingCall]);

  // Per SDK docs: Hangup or reject an incoming call - call.hangup()
  const hangupCall = useCallback(() => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Hanging up call');
      state.activeCall.hangup();
    }
  }, [state.activeCall]);

  // Per SDK docs: Call states that can be toggled - call.muteAudio()
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

  // Per SDK docs: Call states that can be toggled - call.hold()
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

  // Per SDK docs: Send digits and keypresses - call.dtmf('1234')
  const sendDTMF = useCallback((digit: string) => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Sending DTMF:', digit);
      state.activeCall.dtmf(digit);
    }
  }, [state.activeCall]);

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
