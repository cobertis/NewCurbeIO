import { useRef, useEffect, useCallback } from 'react';
import { useExtensionCallStore, OnlineExtension, IncomingExtCall, QueueCall } from '@/stores/extensionCallStore';
import { useToast } from '@/hooks/use-toast';
import { useTelnyxStore } from '@/services/telnyx-webrtc';

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.telnyx.com:3478" },
];

export function useExtensionCall() {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    connectionStatus,
    myExtension,
    onlineExtensions,
    currentExtCall,
    incomingExtCall,
    queueCall,
    isMuted,
    pendingQueueCallAutoAnswer,
    setWsConnection,
    setConnectionStatus,
    setMyExtension,
    setMyDisplayName,
    setOnlineExtensions,
    setCurrentExtCall,
    setIncomingExtCall,
    setQueueCall,
    setIsMuted,
    setPendingQueueCallAutoAnswer,
    updateCallState,
    reset,
  } = useExtensionCallStore();

  const createPeerConnection = useCallback((callId?: string) => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 8,
    });

    pc.onicecandidate = (event) => {
      const activeCallId = callId || callIdRef.current;
      if (event.candidate && wsRef.current && activeCallId) {
        wsRef.current.send(JSON.stringify({
          type: "ice_candidate",
          callId: activeCallId,
          candidate: event.candidate.toJSON(),
        }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(console.error);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endCall();
      }
    };

    return pc;
  }, []);

  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    callIdRef.current = null;
    setCurrentExtCall(null);
    setIncomingExtCall(null);
    setIsMuted(false);
  }, [setCurrentExtCall, setIncomingExtCall, setIsMuted]);

  const endCall = useCallback(() => {
    if (callIdRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "hangup",
        callId: callIdRef.current,
      }));
    }
    cleanupCall();
  }, [cleanupCall]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "registered":
          setConnectionStatus("connected");
          setMyExtension(msg.extension);
          setMyDisplayName(msg.displayName);
          break;

        case "error":
          // Don't show toast for "No extension assigned" - this is expected during onboarding
          if (msg.message !== "No extension assigned") {
            toast({
              title: "Extension Error",
              description: msg.message,
              variant: "destructive",
            });
          }
          break;

        case "online_extensions":
          const myExt = useExtensionCallStore.getState().myExtension;
          setOnlineExtensions(
            msg.extensions.filter((ext: OnlineExtension) => ext.extension !== myExt)
          );
          break;

        case "incoming_call":
          setIncomingExtCall({
            callId: msg.callId,
            callerExtension: msg.callerExtension,
            callerDisplayName: msg.callerDisplayName,
            sdpOffer: msg.sdpOffer,
          });
          break;

        case "call_result":
          if (msg.success) {
            callIdRef.current = msg.callId;
          } else {
            toast({
              title: "Call Failed",
              description: msg.error,
              variant: "destructive",
            });
            cleanupCall();
          }
          break;

        case "call_answered":
          if (peerConnectionRef.current && msg.sdpAnswer) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: msg.sdpAnswer })
            );
            updateCallState("connected");
          }
          break;

        case "ice_candidate":
          if (peerConnectionRef.current && msg.candidate) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(msg.candidate)
            );
          }
          break;

        case "call_ended":
          cleanupCall();
          if (msg.reason === "rejected") {
            toast({ title: "Call declined" });
          }
          break;

        case "queue_call_offer":
          console.log("[useExtensionCall] Queue call offer received:", msg);
          setQueueCall({
            queueCallId: msg.queueCallId,
            callControlId: msg.callControlId,
            queueId: msg.queueId,
            callerNumber: msg.callerNumber,
          });
          toast({
            title: "Incoming Queue Call",
            description: `Call from ${msg.callerNumber}`,
          });
          break;

        case "queue_call_taken":
          const currentQueueCall = useExtensionCallStore.getState().queueCall;
          if (currentQueueCall?.callControlId === msg.callControlId) {
            setQueueCall(null);
            toast({
              title: "Call Taken",
              description: "Another agent answered the call",
            });
          }
          break;

        case "queue_call_ended":
          const activeQueueCall = useExtensionCallStore.getState().queueCall;
          if (activeQueueCall?.callControlId === msg.callControlId) {
            setQueueCall(null);
            toast({
              title: "Queue Call Ended",
              description: msg.reason === "timeout" ? "Call timed out" : "Caller disconnected",
            });
          }
          break;

        case "queue_call_connected":
          toast({
            title: "Call Connected",
            description: `Connected to caller: ${msg.callerNumber}`,
          });
          break;

        case "accept_queue_call_result":
          if (!msg.success) {
            toast({
              title: "Accept Failed",
              description: msg.error || "Could not accept call",
              variant: "destructive",
            });
            setQueueCall(null);
          }
          break;

        case "outbound_call_answered":
          // PSTN answered the outbound call - now start the timer
          console.log("[useExtensionCall] Outbound PSTN call answered:", msg.destinationNumber);
          const telnyxStore = useTelnyxStore.getState();
          telnyxStore.setOutboundPstnRinging(false);
          telnyxStore.setCallActiveTimestamp(Date.now());
          break;
      }
    } catch (e) {
      console.error("[useExtensionCall] Message parse error:", e);
    }
  }, [toast, setConnectionStatus, setMyExtension, setMyDisplayName, setOnlineExtensions, setIncomingExtCall, setQueueCall, updateCallState, cleanupCall]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/pbx`);

    ws.onopen = () => {
      wsRef.current = ws;
      setWsConnection(ws);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      wsRef.current = null;
      setWsConnection(null);
      setConnectionStatus("disconnected");
      setMyExtension(null);
      setOnlineExtensions([]);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = (error) => {
      console.error("[useExtensionCall] WebSocket error:", error);
    };
  }, [handleMessage, setConnectionStatus, setMyExtension, setOnlineExtensions, setWsConnection]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    reset();
  }, [reset]);

  const startCall = useCallback(async (targetExtension: string, targetDisplayName: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({ title: "Not connected", variant: "destructive" });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setCurrentExtCall({
        callId: "",
        remoteExtension: targetExtension,
        remoteDisplayName: targetDisplayName,
        state: "calling",
        startTime: new Date(),
      });

      wsRef.current.send(JSON.stringify({
        type: "call",
        toExtension: targetExtension,
        sdpOffer: offer.sdp,
      }));
    } catch (error: any) {
      console.error("[useExtensionCall] Failed to start call:", error);
      toast({
        title: "Call Failed",
        description: error.message || "Could not access microphone",
        variant: "destructive",
      });
      cleanupCall();
    }
  }, [toast, createPeerConnection, setCurrentExtCall, cleanupCall]);

  const answerCall = useCallback(async () => {
    const incoming = useExtensionCallStore.getState().incomingExtCall;
    if (!incoming || !wsRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection(incoming.callId);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: "offer", sdp: incoming.sdpOffer })
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      callIdRef.current = incoming.callId;
      
      setCurrentExtCall({
        callId: incoming.callId,
        remoteExtension: incoming.callerExtension,
        remoteDisplayName: incoming.callerDisplayName,
        state: "connected",
        startTime: new Date(),
        answerTime: new Date(),
      });
      setIncomingExtCall(null);

      wsRef.current.send(JSON.stringify({
        type: "answer",
        callId: incoming.callId,
        sdpAnswer: answer.sdp,
      }));
    } catch (error: any) {
      console.error("[useExtensionCall] Failed to answer:", error);
      toast({
        title: "Answer Failed",
        description: error.message || "Could not access microphone",
        variant: "destructive",
      });
    }
  }, [toast, createPeerConnection, setCurrentExtCall, setIncomingExtCall]);

  const rejectCall = useCallback(() => {
    const incoming = useExtensionCallStore.getState().incomingExtCall;
    if (!incoming || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: "reject",
      callId: incoming.callId,
    }));

    setIncomingExtCall(null);
  }, [setIncomingExtCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [setIsMuted]);

  const refreshOnlineExtensions = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "get_online" }));
    }
  }, []);

  const acceptQueueCall = useCallback(() => {
    const qc = useExtensionCallStore.getState().queueCall;
    if (!qc || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    console.log("[useExtensionCall] Accepting queue call:", qc.callControlId);
    wsRef.current.send(JSON.stringify({
      type: "accept_queue_call",
      callControlId: qc.callControlId,
    }));
    setQueueCall(null);
    setPendingQueueCallAutoAnswer(true);
    console.log("[useExtensionCall] Set pendingQueueCallAutoAnswer=true for auto-answer");
  }, [setQueueCall, setPendingQueueCallAutoAnswer]);

  const rejectQueueCall = useCallback(() => {
    const qc = useExtensionCallStore.getState().queueCall;
    if (!qc || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    console.log("[useExtensionCall] Rejecting queue call:", qc.callControlId);
    wsRef.current.send(JSON.stringify({
      type: "reject_queue_call",
      callControlId: qc.callControlId,
    }));
    setQueueCall(null);
  }, [setQueueCall]);

  useEffect(() => {
    remoteAudioRef.current = new Audio();
    remoteAudioRef.current.autoplay = true;

    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    myExtension,
    onlineExtensions,
    currentExtCall,
    incomingExtCall,
    queueCall,
    isMuted,
    connect,
    disconnect,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    refreshOnlineExtensions,
    acceptQueueCall,
    rejectQueueCall,
  };
}

/**
 * Check if a number could be a PBX extension format (3-4 digits >= 100)
 * NOTE: This is only a format check. For actual extension calls, always verify
 * against the onlineExtensions list to avoid calling 911, 411, etc. as extensions.
 */
export function isExtensionNumber(num: string): boolean {
  const clean = num.replace(/\D/g, '');
  return clean.length >= 3 && clean.length <= 4 && parseInt(clean) >= 100;
}
