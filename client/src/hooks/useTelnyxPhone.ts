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
    remoteAudioElement.setAttribute('autoplay', 'true');
    remoteAudioElement.setAttribute('playsinline', 'true');
    document.body.appendChild(remoteAudioElement);
    console.log('[TelnyxPhone] Created audio element');
  }
  return remoteAudioElement;
};

// Per SDK docs: Get OPUS codec for lower latency
const getOpusCodec = (): RTCRtpCodecCapability | undefined => {
  try {
    const capabilities = RTCRtpReceiver.getCapabilities?.('audio');
    if (capabilities?.codecs) {
      return capabilities.codecs.find(c => 
        c.mimeType.toLowerCase().includes('opus')
      );
    }
  } catch (e) {
    console.log('[TelnyxPhone] Could not get OPUS codec');
  }
  return undefined;
};

export const useTelnyxPhone = () => {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const weInitiatedCallRef = useRef(false);
  // CRITICAL: Store the microphone stream so we can pass it to answer()
  const micStreamRef = useRef<MediaStream | null>(null);
  
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
      
      // Create audio element first
      const audioElement = getOrCreateRemoteAudio();
      
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

      // Initialize the client
      const clientConfig: any = {};

      if (data.token) {
        clientConfig.login_token = data.token;
        console.log('[TelnyxPhone] Using login_token authentication');
      } else if (data.sipUsername && data.sipPassword) {
        clientConfig.login = data.sipUsername;
        clientConfig.password = data.sipPassword;
        console.log('[TelnyxPhone] Using SIP credentials');
      }

      console.log('[TelnyxPhone] SDK version:', TelnyxRTC.version || '2.25.10');

      const client = new TelnyxRTC(clientConfig);
      
      // Set remoteElement for remote audio
      client.remoteElement = audioElement;
      console.log('[TelnyxPhone] Set client.remoteElement');

      // CRITICAL FIX: Pre-warm the microphone stream BEFORE connect
      // This ensures the stream is ready when we answer incoming calls
      // Without this, answer() triggers getUserMedia which causes 4-5s delay
      console.log('[TelnyxPhone] Pre-warming microphone stream...');
      try {
        // Get microphone stream directly so it's ready for incoming calls
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        micStreamRef.current = stream;
        console.log('[TelnyxPhone] Microphone stream pre-warmed and stored');
        
        // Also call SDK's enableMicrophone for internal state
        client.enableMicrophone();
      } catch (e) {
        console.error('[TelnyxPhone] Failed to pre-warm microphone:', e);
      }

      // Attach event listeners
      client.on('telnyx.ready', () => {
        console.log('[TelnyxPhone] telnyx.ready - registered');
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

      // Handle notifications
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
          } else if (call.state === 'active') {
            console.log('[TelnyxPhone] Call is now active');
            weInitiatedCallRef.current = false;
            setState(prev => ({ 
              ...prev, 
              activeCall: call, 
              incomingCall: null 
            }));
          } else if (call.state === 'hangup' || call.state === 'destroy') {
            console.log('[TelnyxPhone] Call ended:', call.state, 
              'cause:', callAny.cause, 'causeCode:', callAny.causeCode, 
              'sipCode:', callAny.sipCode, 'sipReason:', callAny.sipReason);
            weInitiatedCallRef.current = false;
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

      // Connect after microphone is ready
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
      // Cleanup microphone stream
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [initClient]);

  // Outgoing call
  const makeCall = useCallback((destination: string) => {
    if (!clientRef.current || state.sessionStatus !== 'registered') {
      console.error('[TelnyxPhone] Cannot make call - not registered');
      return;
    }
    
    console.log('[TelnyxPhone] Making outbound call to:', destination);
    weInitiatedCallRef.current = true;
    
    const opusCodec = getOpusCodec();
    const callOptions: any = {
      destinationNumber: destination,
      callerNumber: state.callerIdNumber,
      audio: true,
    };
    
    if (opusCodec) {
      callOptions.preferred_codecs = [opusCodec];
    }
    
    const call = clientRef.current.newCall(callOptions);
    setState(prev => ({ ...prev, activeCall: call }));
  }, [state.sessionStatus, state.callerIdNumber]);

  // CRITICAL FIX: Answer with pre-warmed microphone stream
  // This eliminates the 4-5 second audio delay
  const answerCall = useCallback(() => {
    if (state.incomingCall) {
      console.log('[TelnyxPhone] Answering with pre-warmed mic stream');
      
      // Pass the pre-warmed stream to answer() to skip internal getUserMedia
      if (micStreamRef.current) {
        console.log('[TelnyxPhone] Using pre-warmed stream for immediate audio');
        // The SDK's answer() accepts audio options including a stream
        (state.incomingCall as any).answer({
          audio: { stream: micStreamRef.current }
        });
      } else {
        // Fallback: answer without stream (will have delay)
        console.log('[TelnyxPhone] No pre-warmed stream, using default answer');
        state.incomingCall.answer();
      }
    }
  }, [state.incomingCall]);

  // Reject incoming call
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

  // Hangup active call - sends NORMAL_CLEARING
  const hangupCall = useCallback(() => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Hanging up active call');
      state.activeCall.hangup();
    }
  }, [state.activeCall]);

  // Mute/unmute
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

  // Hold/unhold
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

  // DTMF
  const sendDTMF = useCallback((digit: string) => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Sending DTMF:', digit);
      state.activeCall.dtmf(digit);
    }
  }, [state.activeCall]);

  // Transfer
  const transferCall = useCallback((target: string) => {
    if (state.activeCall) {
      console.log('[TelnyxPhone] Transferring to:', target);
      (state.activeCall as any).transfer?.(target) || 
      (state.activeCall as any).blindTransfer?.(target);
    }
  }, [state.activeCall]);

  // Reconnect
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
