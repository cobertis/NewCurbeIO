import { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, PhoneMissed, User, Mic, MicOff } from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface IncomingCall {
  callId: string;
  from: string;
  to: string;
  fromName: string;
  timestamp: string;
  status: 'ringing' | 'answered' | 'ended' | 'missed';
  sdpOffer: string;
}

interface WhatsAppCallHandlerProps {
  onCallStateChange?: (callId: string | null) => void;
}

export function WhatsAppCallHandler({ onCallStateChange }: WhatsAppCallHandlerProps) {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [activeCallInfo, setActiveCallInfo] = useState<{ from: string; fromName: string } | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs to avoid recreating WebSocket on state changes
  const activeCallRef = useRef<string | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  
  // Keep refs in sync with state
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);
  
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/whatsapp-call`);

    ws.onopen = () => {
      console.log('[WhatsApp Call] WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('[WhatsApp Call] WebSocket disconnected');
      setIsConnected(false);
      // Only reconnect if component is still mounted
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WhatsApp Call] WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WhatsApp Call] Received:', data.type);

        switch (data.type) {
          case 'registered':
            console.log('[WhatsApp Call] Registered for calls');
            break;

          case 'whatsapp_incoming_call':
            // Use refs to check current state without causing reconnects
            if (!activeCallRef.current && !incomingCallRef.current) {
              setIncomingCall(data.call);
              playRingtone();
            }
            break;

          case 'whatsapp_call_answered':
            if (data.callId === incomingCallRef.current?.callId) {
              setIncomingCall(null);
              stopRingtone();
            }
            break;

          case 'whatsapp_call_ended':
          case 'whatsapp_call_declined':
          case 'whatsapp_call_missed':
            if (data.callId === incomingCallRef.current?.callId || data.callId === activeCallRef.current) {
              handleCallEnd();
            }
            break;

          case 'answer_result':
            if (!data.success) {
              toast({
                title: 'Call Failed',
                description: data.error || 'Failed to answer call',
                variant: 'destructive'
              });
              handleCallEnd();
            }
            break;

          case 'error':
            console.error('[WhatsApp Call] Server error:', data.message);
            break;
        }
      } catch (error) {
        console.error('[WhatsApp Call] Error parsing message:', error);
      }
    };

    wsRef.current = ws;
  }, [toast]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      cleanupCall();
    };
  }, [connectWebSocket]);

  const playRingtone = () => {
    // Simple audio beep for ringtone
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 440;
      gainNode.gain.value = 0.1;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 200);
    } catch (e) {
      console.log('[WhatsApp Call] Could not play ringtone');
    }
  };

  const stopRingtone = () => {
    // Ringtone stopped
  };

  const handleCallEnd = () => {
    setIncomingCall(null);
    setActiveCall(null);
    setActiveCallInfo(null);
    setIsAnswering(false);
    setIsMuted(false);
    stopRingtone();
    cleanupCall();
    onCallStateChange?.(null);
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setCallDuration(0);
  };

  const cleanupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  };

  const answerCall = async () => {
    if (!incomingCall || !wsRef.current) return;
    
    setIsAnswering(true);
    stopRingtone();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        console.log('[WhatsApp Call] Remote track received');
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play().catch(console.error);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WhatsApp Call] ICE candidate:', event.candidate.type);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WhatsApp Call] Connection state:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          handleCallEnd();
        }
      };

      await pc.setRemoteDescription({
        type: 'offer',
        sdp: incomingCall.sdpOffer
      });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      let modifiedSdp = answer.sdp || '';
      modifiedSdp = modifiedSdp.replace(/a=setup:actpass/g, 'a=setup:active');

      wsRef.current.send(JSON.stringify({
        type: 'answer',
        callId: incomingCall.callId,
        sdpAnswer: modifiedSdp
      }));

      setActiveCall(incomingCall.callId);
      setActiveCallInfo({ from: incomingCall.from, fromName: incomingCall.fromName });
      setIncomingCall(null);
      onCallStateChange?.(incomingCall.callId);

      callStartTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }
      }, 1000);

      toast({
        title: 'Call Connected',
        description: `Connected to ${incomingCall.fromName}`,
      });

    } catch (error: any) {
      console.error('[WhatsApp Call] Error answering:', error);
      toast({
        title: 'Call Failed',
        description: error.message || 'Failed to answer call',
        variant: 'destructive'
      });
      handleCallEnd();
    }
  };

  const declineCall = () => {
    if (!incomingCall || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'decline',
      callId: incomingCall.callId
    }));

    handleCallEnd();
  };

  const hangUp = () => {
    if (!activeCall || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'decline',
      callId: activeCall
    }));

    handleCallEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!incomingCall && !activeCall) {
    return <audio ref={audioRef} autoPlay playsInline />;
  }

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />
      
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="whatsapp-incoming-call-overlay">
          <Card className="w-80 bg-white dark:bg-gray-900 shadow-2xl animate-in zoom-in-95">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center animate-pulse">
                    <User className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <SiWhatsapp className="h-4 w-4 text-white" />
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-1" data-testid="text-caller-name">
                  {incomingCall.fromName}
                </h3>
                <p className="text-sm text-muted-foreground mb-1" data-testid="text-caller-phone">
                  {incomingCall.from}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-6">
                  WhatsApp Voice Call
                </p>

                <div className="flex items-center gap-4">
                  <Button
                    size="lg"
                    variant="destructive"
                    className="h-14 w-14 rounded-full"
                    onClick={declineCall}
                    disabled={isAnswering}
                    data-testid="btn-decline-call"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                  
                  <Button
                    size="lg"
                    className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600"
                    onClick={answerCall}
                    disabled={isAnswering}
                    data-testid="btn-answer-call"
                  >
                    <Phone className="h-6 w-6" />
                  </Button>
                </div>

                {isAnswering && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Connecting...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeCall && (
        <div className="fixed bottom-4 right-4 z-50" data-testid="whatsapp-active-call">
          <Card className="w-80 bg-emerald-600 text-white shadow-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center relative flex-shrink-0">
                  <User className="h-6 w-6" />
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white flex items-center justify-center">
                    <SiWhatsapp className="h-3 w-3 text-emerald-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" data-testid="text-active-call-name">
                    {activeCallInfo?.fromName || 'Unknown'}
                  </p>
                  <p className="text-xs text-white/80 truncate" data-testid="text-active-call-number">
                    {activeCallInfo?.from || 'Unknown'}
                  </p>
                  <p className="text-xs text-white/60" data-testid="text-call-duration">
                    {formatDuration(callDuration)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-10 w-10 rounded-full ${isMuted ? 'bg-white text-emerald-600 hover:bg-white/90' : 'bg-white/20 hover:bg-white/30 text-white'}`}
                  onClick={toggleMute}
                  data-testid="btn-mute-call"
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white"
                  onClick={hangUp}
                  data-testid="btn-hangup-call"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
