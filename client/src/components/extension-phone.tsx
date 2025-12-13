import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  PhoneOff, 
  PhoneCall,
  PhoneIncoming,
  Users,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from "lucide-react";

interface OnlineExtension {
  extensionId: string;
  extension: string;
  displayName: string;
  status: "available" | "busy";
}

interface ExtensionPhoneProps {
  className?: string;
}

type CallState = "idle" | "calling" | "ringing" | "connected" | "queue_ringing";

export function ExtensionPhone({ className }: ExtensionPhoneProps) {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [myExtension, setMyExtension] = useState<string | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string>("");
  const [onlineExtensions, setOnlineExtensions] = useState<OnlineExtension[]>([]);
  const [callState, setCallState] = useState<CallState>("idle");
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [remoteParty, setRemoteParty] = useState<{extension: string; displayName: string} | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerExtension: string;
    callerDisplayName: string;
    sdpOffer: string;
  } | null>(null);
  const [queueCall, setQueueCall] = useState<{
    queueCallId: string;
    callControlId: string;
    queueId: string;
    callerNumber: string;
  } | null>(null);

  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.telnyx.com:3478" },
  ];

  const createPeerConnection = useCallback((callId?: string) => {
    const pc = new RTCPeerConnection({ 
      iceServers,
      iceCandidatePoolSize: 8
    });

    pc.onicecandidate = (event) => {
      const activeCallId = callId || callIdRef.current;
      if (event.candidate && wsRef.current && activeCallId) {
        console.log("[ExtensionPhone] Sending ICE candidate for call:", activeCallId);
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
      console.log("[ExtensionPhone] Connection state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endCall();
      }
    };

    return pc;
  }, []);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/pbx`);

    ws.onopen = () => {
      console.log("[ExtensionPhone] WebSocket connected");
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("[ExtensionPhone] Received:", msg.type);

        switch (msg.type) {
          case "registered":
            setIsConnected(true);
            setMyExtension(msg.extension);
            setMyDisplayName(msg.displayName);
            toast({ 
              title: "Extension Connected", 
              description: `Registered as extension ${msg.extension}` 
            });
            break;

          case "error":
            toast({ 
              title: "Connection Error", 
              description: msg.message,
              variant: "destructive"
            });
            break;

          case "online_extensions":
            setOnlineExtensions(msg.extensions.filter((ext: OnlineExtension) => 
              ext.extension !== myExtension
            ));
            break;

          case "incoming_call":
            setIncomingCall({
              callId: msg.callId,
              callerExtension: msg.callerExtension,
              callerDisplayName: msg.callerDisplayName,
              sdpOffer: msg.sdpOffer,
            });
            setCallState("ringing");
            break;

          case "call_result":
            if (msg.success) {
              // Check if this is a special extension (IVR or Queue) that needs Telnyx routing
              if (msg.specialExtension) {
                console.log(`[ExtensionPhone] Special extension detected: ${msg.specialExtension.type}`);
                // Initiate call via Telnyx API for IVR/Queue
                try {
                  const response = await fetch("/api/pbx/internal-call", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      targetType: msg.specialExtension.type,
                      queueId: msg.specialExtension.queueId || null,
                    }),
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    toast({ 
                      title: msg.specialExtension.type === "ivr" ? "Calling IVR" : "Calling Queue",
                      description: "Your phone will ring shortly..."
                    });
                    // The call will come back via Telnyx WebRTC, reset P2P state
                    setCallState("idle");
                    setRemoteParty(null);
                  } else {
                    throw new Error("Failed to initiate call");
                  }
                } catch (error) {
                  toast({ 
                    title: "Call Failed", 
                    description: "Could not connect to IVR/Queue",
                    variant: "destructive"
                  });
                  setCallState("idle");
                  setRemoteParty(null);
                }
              } else {
                // Normal P2P extension call
                callIdRef.current = msg.callId;
                setCurrentCallId(msg.callId);
              }
            } else {
              toast({ 
                title: "Call Failed", 
                description: msg.error,
                variant: "destructive"
              });
              setCallState("idle");
              setRemoteParty(null);
            }
            break;

          case "call_answered":
            if (peerConnectionRef.current && msg.sdpAnswer) {
              await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription({ type: "answer", sdp: msg.sdpAnswer })
              );
              setCallState("connected");
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
            endCall();
            toast({ 
              title: "Call Ended", 
              description: msg.reason === "rejected" ? "Call was declined" : "Call ended" 
            });
            break;

          case "queue_call_offer":
            setQueueCall({
              queueCallId: msg.queueCallId,
              callControlId: msg.callControlId,
              queueId: msg.queueId,
              callerNumber: msg.callerNumber,
            });
            setCallState("queue_ringing");
            break;

          case "queue_call_taken":
            if (queueCall?.callControlId === msg.callControlId) {
              setQueueCall(null);
              setCallState("idle");
              toast({
                title: "Call Taken",
                description: "Another agent answered the call",
              });
            }
            break;

          case "queue_call_ended":
            if (queueCall?.callControlId === msg.callControlId) {
              setQueueCall(null);
              setCallState("idle");
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
            setCallState("connected");
            setRemoteParty({ extension: msg.callerNumber, displayName: msg.callerNumber });
            break;

          case "accept_queue_call_result":
            if (!msg.success) {
              toast({
                title: "Accept Failed",
                description: msg.error || "Could not accept call",
                variant: "destructive",
              });
              setQueueCall(null);
              setCallState("idle");
            }
            break;
        }
      } catch (e) {
        console.error("[ExtensionPhone] Message parse error:", e);
      }
    };

    ws.onclose = () => {
      console.log("[ExtensionPhone] WebSocket disconnected");
      setIsConnected(false);
      setMyExtension(null);
      setOnlineExtensions([]);
      setTimeout(() => connectWebSocket(), 3000);
    };

    ws.onerror = (error) => {
      console.error("[ExtensionPhone] WebSocket error:", error);
    };

    wsRef.current = ws;

    return ws;
  }, [myExtension, toast]);

  useEffect(() => {
    const ws = connectWebSocket();
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    remoteAudioRef.current = new Audio();
    remoteAudioRef.current.autoplay = true;
    
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const startCall = async (targetExtension: string, targetDisplayName: string) => {
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

      setCallState("calling");
      setRemoteParty({ extension: targetExtension, displayName: targetDisplayName });

      wsRef.current?.send(JSON.stringify({
        type: "call",
        toExtension: targetExtension,
        sdpOffer: offer.sdp,
      }));
    } catch (error: any) {
      console.error("[ExtensionPhone] Failed to start call:", error);
      toast({ 
        title: "Call Failed", 
        description: error.message || "Could not access microphone",
        variant: "destructive"
      });
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection(incomingCall.callId);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: "offer", sdp: incomingCall.sdpOffer })
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      callIdRef.current = incomingCall.callId;
      setCurrentCallId(incomingCall.callId);
      setRemoteParty({ 
        extension: incomingCall.callerExtension, 
        displayName: incomingCall.callerDisplayName 
      });
      setCallState("connected");

      wsRef.current?.send(JSON.stringify({
        type: "answer",
        callId: incomingCall.callId,
        sdpAnswer: answer.sdp,
      }));

      setIncomingCall(null);
    } catch (error: any) {
      console.error("[ExtensionPhone] Failed to answer:", error);
      toast({ 
        title: "Answer Failed", 
        description: error.message || "Could not access microphone",
        variant: "destructive"
      });
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;

    wsRef.current?.send(JSON.stringify({
      type: "reject",
      callId: incomingCall.callId,
    }));

    setIncomingCall(null);
    setCallState("idle");
  };

  const endCall = () => {
    if (currentCallId && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "hangup",
        callId: currentCallId,
      }));
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setCallState("idle");
    callIdRef.current = null;
    setCurrentCallId(null);
    setRemoteParty(null);
    setIncomingCall(null);
    setIsMuted(false);
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

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
      setIsSpeakerOn(!remoteAudioRef.current.muted);
    }
  };

  const refreshOnlineExtensions = () => {
    wsRef.current?.send(JSON.stringify({ type: "get_online" }));
  };

  const acceptQueueCall = () => {
    if (!queueCall) return;
    wsRef.current?.send(JSON.stringify({
      type: "accept_queue_call",
      callControlId: queueCall.callControlId,
    }));
    setQueueCall(null);
  };

  const rejectQueueCall = () => {
    if (!queueCall) return;
    wsRef.current?.send(JSON.stringify({
      type: "reject_queue_call",
      callControlId: queueCall.callControlId,
    }));
    setQueueCall(null);
    setCallState("idle");
  };

  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Extension Calling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No extension assigned or connecting...</p>
            <p className="text-sm mt-2">You need an active PBX extension to use this feature.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Extension Calling
          </div>
          <Badge variant="outline" className="font-mono">
            Ext. {myExtension}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {callState === "ringing" && incomingCall && (
          <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardContent className="py-4">
              <div className="text-center">
                <PhoneIncoming className="h-8 w-8 mx-auto mb-2 text-green-600 animate-pulse" />
                <p className="font-medium">Incoming Call</p>
                <p className="text-lg">{incomingCall.callerDisplayName}</p>
                <p className="text-sm text-muted-foreground">Ext. {incomingCall.callerExtension}</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={rejectCall}
                    data-testid="button-reject-call"
                  >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={answerCall}
                    data-testid="button-answer-call"
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Answer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {callState === "queue_ringing" && queueCall && (
          <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
            <CardContent className="py-4">
              <div className="text-center">
                <PhoneIncoming className="h-8 w-8 mx-auto mb-2 text-orange-600 animate-pulse" />
                <p className="font-medium">Incoming Queue Call</p>
                <p className="text-lg">{queueCall.callerNumber}</p>
                <p className="text-sm text-muted-foreground">External Caller</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={rejectQueueCall}
                    data-testid="button-reject-queue-call"
                  >
                    <PhoneOff className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={acceptQueueCall}
                    data-testid="button-accept-queue-call"
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {(callState === "calling" || callState === "connected") && remoteParty && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="py-4">
              <div className="text-center">
                {callState === "calling" ? (
                  <PhoneCall className="h-8 w-8 mx-auto mb-2 text-blue-600 animate-pulse" />
                ) : (
                  <Phone className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                )}
                <p className="text-sm text-muted-foreground">
                  {callState === "calling" ? "Calling..." : "Connected"}
                </p>
                <p className="text-lg font-medium">{remoteParty.displayName}</p>
                <p className="text-sm text-muted-foreground">Ext. {remoteParty.extension}</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={toggleMute}
                    data-testid="button-toggle-mute"
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={toggleSpeaker}
                    data-testid="button-toggle-speaker"
                  >
                    {isSpeakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon"
                    onClick={endCall}
                    data-testid="button-end-call"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {callState === "idle" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Online Extensions ({onlineExtensions.length})
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refreshOnlineExtensions}
                data-testid="button-refresh-extensions"
              >
                Refresh
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              {onlineExtensions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No other extensions online</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {onlineExtensions.map((ext) => (
                    <div 
                      key={ext.extensionId}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      data-testid={`extension-row-${ext.extension}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {ext.displayName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{ext.displayName}</p>
                          <p className="text-xs text-muted-foreground">Ext. {ext.extension}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={ext.status === "available" ? "default" : "secondary"}
                          className={ext.status === "available" ? "bg-green-500" : ""}
                        >
                          {ext.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ext.status === "busy"}
                          onClick={() => startCall(ext.extension, ext.displayName)}
                          data-testid={`button-call-${ext.extension}`}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
