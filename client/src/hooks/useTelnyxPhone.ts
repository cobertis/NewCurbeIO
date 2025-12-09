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

let remoteAudioElement: HTMLAudioElement | null = null;

const getOrCreateRemoteAudio = (): HTMLAudioElement => {
  if (!remoteAudioElement) {
    remoteAudioElement = document.createElement('audio');
    remoteAudioElement.id = 'remoteMedia';
    remoteAudioElement.autoplay = true;
    remoteAudioElement.setAttribute('autoplay', 'true');
    remoteAudioElement.setAttribute('playsinline', 'true');
    document.body.appendChild(remoteAudioElement);
    console.log('[TelnyxPhone] Created audio element');
  }
  return remoteAudioElement;
};

export const useTelnyxPhone = () => {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const weInitiatedCallRef = useRef(false);
  const micPrewarmedRef = useRef(false);
  const pendingAnswerRef = useRef<Call | null>(null);
  
  const [state, setState] = useState<TelnyxPhoneState>({
    sessionStatus: 'disconnected',
    activeCall: null,
    incomingCall: null,
    isMuted: false,
    isOnHold: false,
    callerIdNumber: '',
  });

  // Pre-warm microphone permission - call once when client is ready
  const prewarmMicrophone = useCallback(async () => {
    if (micPrewarmedRef.current) return;
    
    try {
      console.log('[TelnyxPhone] Pre-warming microphone on client ready...');
      const startTime = Date.now();
      
      // Request microphone permission early - this ensures the browser has permission
      // cached so subsequent getUserMedia calls are nearly instant
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const elapsed = Date.now() - startTime;
      console.log('[TelnyxPhone] Microphone pre-warmed in', elapsed, 'ms');
      
      // Stop the tracks - we just needed to get permission
      stream.getTracks().forEach(track => track.stop());
      
      micPrewarmedRef.current = true;
      
      // Also enable microphone on the Telnyx client for good measure
      if (clientRef.current) {
        clientRef.current.enableMicrophone();
        console.log('[TelnyxPhone] Called client.enableMicrophone()');
      }
      
    } catch (error) {
      console.error('[TelnyxPhone] Failed to pre-warm microphone:', error);
    }
  }, []);

  const initClient = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, sessionStatus: 'connecting' }));
      
      const audioElement = getOrCreateRemoteAudio();
      
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

      const clientConfig: any = {};

      if (data.token) {
        clientConfig.login_token = data.token;
        console.log('[TelnyxPhone] Using login_token');
      } else if (data.sipUsername && data.sipPassword) {
        clientConfig.login = data.sipUsername;
        clientConfig.password = data.sipPassword;
        console.log('[TelnyxPhone] Using SIP credentials');
      }

      console.log('[TelnyxPhone] SDK version:', (TelnyxRTC as any).version || '2.25.10');

      const client = new TelnyxRTC(clientConfig);
      
      client.remoteElement = audioElement;
      console.log('[TelnyxPhone] Set client.remoteElement');

      client.on('telnyx.ready', () => {
        console.log('[TelnyxPhone] telnyx.ready - registered');
        setState(prev => ({ ...prev, sessionStatus: 'registered' }));
        
        // CRITICAL: Pre-warm microphone as soon as client is ready
        // This ensures getUserMedia is fast when answering calls
        prewarmMicrophone();
      });

      client.on('telnyx.error', (error: any) => {
        console.error('[TelnyxPhone] telnyx.error:', error);
        setState(prev => ({ ...prev, sessionStatus: 'error' }));
      });

      client.on('telnyx.socket.close', () => {
        console.log('[TelnyxPhone] telnyx.socket.close');
        setState(prev => ({ ...prev, sessionStatus: 'disconnected' }));
      });

      client.on('telnyx.notification', (notification: any) => {
        console.log('[TelnyxPhone] notification type:', notification.type);
        
        if (notification.type === 'userMediaError') {
          console.error('[TelnyxPhone] userMediaError:', notification.error);
          return;
        }
        
        if (notification.type === 'callUpdate') {
          const call = notification.call as Call;
          const callAny = call as any;
          console.log('[TelnyxPhone] callUpdate state:', call.state, 
            'cause:', callAny.cause, 'sipCode:', callAny.sipCode);
          
          if (call.state === 'ringing') {
            if (!weInitiatedCallRef.current) {
              console.log('[TelnyxPhone] Incoming call detected');
              setState(prev => ({ ...prev, incomingCall: call }));
            }
          } else if (call.state === 'answering') {
            // Call is being answered but not yet active
            console.log('[TelnyxPhone] Call state: answering');
          } else if (call.state === 'active') {
            // CRITICAL: Only set activeCall when SDK confirms call is active
            // This is the ONLY place where we should transition to activeCall
            console.log('[TelnyxPhone] Call is now ACTIVE - transitioning state');
            weInitiatedCallRef.current = false;
            pendingAnswerRef.current = null;
            setState(prev => ({ 
              ...prev, 
              activeCall: call, 
              incomingCall: null 
            }));
          } else if (call.state === 'hangup' || call.state === 'destroy') {
            console.log('[TelnyxPhone] Call ended:', call.state, 
              'cause:', callAny.cause, 'causeCode:', callAny.causeCode);
            weInitiatedCallRef.current = false;
            pendingAnswerRef.current = null;
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
  }, [prewarmMicrophone]);

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
    
    console.log('[TelnyxPhone] Making outbound call to:', destination);
    weInitiatedCallRef.current = true;
    
    const call = clientRef.current.newCall({
      destinationNumber: destination,
      callerNumber: state.callerIdNumber,
      audio: true,
    });
    setState(prev => ({ ...prev, activeCall: call }));
  }, [state.sessionStatus, state.callerIdNumber]);

  // FIXED: Just call answer() - let the SDK handle media acquisition
  // The callUpdate handler will transition to activeCall when ready
  // Since we pre-warmed the microphone, getUserMedia should be fast
  const answerCall = useCallback(() => {
    if (!state.incomingCall || !clientRef.current) return;
    
    const call = state.incomingCall;
    pendingAnswerRef.current = call;
    
    console.log('[TelnyxPhone] Answering call (microphone pre-warmed:', micPrewarmedRef.current, ')');
    
    // Just call answer() - the SDK will handle getUserMedia internally
    // Since we pre-warmed the mic on telnyx.ready, it should be fast
    // DO NOT change state here - wait for callUpdate: active
    call.answer();
    
    console.log('[TelnyxPhone] answer() called, waiting for active state...');
  }, [state.incomingCall]);

  const rejectCall = useCallback(() => {
    if (state.incomingCall) {
      console.log('[TelnyxPhone] Rejecting incoming call');
      const call = state.incomingCall as any;
      if (typeof call.reject === 'function') {
        call.reject();
      } else {
        state.incomingCall.hangup();
      }
      setState(prev => ({ ...prev, incomingCall: null }));
    }
  }, [state.incomingCall]);

  const hangupCall = useCallback(() => {
    // Only allow hangup if we have an active call (confirmed by SDK)
    if (state.activeCall) {
      console.log('[TelnyxPhone] Hanging up active call');
      state.activeCall.hangup();
    } else if (pendingAnswerRef.current) {
      // If we're in the answering phase, this is still technically a reject
      console.log('[TelnyxPhone] Canceling pending answer (call not yet active)');
      pendingAnswerRef.current.hangup();
      pendingAnswerRef.current = null;
    }
  }, [state.activeCall]);

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
    micPrewarmedRef.current = false; // Reset so we re-warm on reconnect
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
