import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, PhoneOff, PhoneMissed, PhoneIncoming, PhoneOutgoing,
  Mic, MicOff, Pause, Play, Maximize2, X, 
  User, Clock, Wifi, WifiOff, Settings,
  Volume2, KeyboardIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, getWebPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPhoneInput } from '@shared/phone';
import { useQuery } from '@tanstack/react-query';
import type { User as UserType } from '@shared/schema';

// WebPhone Header Component
export function WebPhoneHeader() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [dialNumber, setDialNumber] = useState('');
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  
  // Use stable Zustand selectors instead of entire store
  const connectionStatus = useWebPhoneStore(state => state.connectionStatus);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const isMuted = useWebPhoneStore(state => state.isMuted);
  const isOnHold = useWebPhoneStore(state => state.isOnHold);
  const dialpadVisible = useWebPhoneStore(state => state.dialpadVisible);
  const incomingCallVisible = useWebPhoneStore(state => state.incomingCallVisible);
  const sipExtension = useWebPhoneStore(state => state.sipExtension);
  const callHistory = useWebPhoneStore(state => state.callHistory);
  const toggleDialpad = useWebPhoneStore(state => state.toggleDialpad);
  const clearCallHistory = useWebPhoneStore(state => state.clearCallHistory);
  const setAudioElements = useWebPhoneStore(state => state.setAudioElements);
  const setSipCredentials = useWebPhoneStore(state => state.setSipCredentials);
  const setWssServer = useWebPhoneStore(state => state.setWssServer);
  
  // Fetch user session to get SIP credentials
  const { data: sessionData } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });
  
  const user = sessionData?.user;
  
  // Auto-initialize WebPhone when user has saved credentials (runs only once per unique credentials)
  useEffect(() => {
    console.log('[WebPhone] Auto-init check:', {
      hasUser: !!user,
      sipEnabled: user?.sipEnabled,
      hasExtension: !!user?.sipExtension,
      hasPassword: !!user?.sipPassword,
      server: user?.sipServer
    });
    
    if (user?.sipEnabled && user?.sipExtension && user?.sipPassword) {
      console.log('[WebPhone] Starting auto-initialization...');
      
      // Load credentials into store
      setSipCredentials(user.sipExtension, user.sipPassword);
      if (user.sipServer) {
        setWssServer(user.sipServer);
      }
      
      // Initialize WebPhone connection
      getWebPhone().initialize(user.sipExtension, user.sipPassword, user.sipServer || undefined)
        .then(() => {
          console.log('[WebPhone] Auto-initialized successfully from saved credentials');
        })
        .catch((error) => {
          console.error('[WebPhone] Auto-initialization failed:', error);
        });
    } else {
      console.log('[WebPhone] Auto-init skipped - missing credentials or not enabled');
    }
    // Only re-run when credentials change
  }, [user?.sipEnabled, user?.sipExtension, user?.sipPassword, user?.sipServer, setSipCredentials, setWssServer]);
  
  // Initialize audio elements
  useEffect(() => {
    if (remoteAudioRef.current && localAudioRef.current) {
      setAudioElements(localAudioRef.current, remoteAudioRef.current);
    }
  }, [setAudioElements]);
  
  // Call timer
  useEffect(() => {
    if (currentCall && currentCall.status === 'answered') {
      timerRef.current = setInterval(() => {
        const duration = Math.floor((new Date().getTime() - currentCall!.startTime.getTime()) / 1000);
        setCallDuration(duration);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        setCallDuration(0);
      }
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentCall?.status]);
  
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleDial = (digit: string) => {
    setDialNumber(prev => prev + digit);
    if (currentCall?.status === 'answered') {
      getWebPhone().sendDTMF(digit);
    }
  };
  
  const handleCall = async () => {
    if (!dialNumber) return;
    try {
      await getWebPhone().makeCall(dialNumber);
      setDialNumber('');
      toggleDialpad();
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  };
  
  const ConnectionStatus = () => {
    const statusConfig = {
      connected: { icon: Wifi, color: 'text-green-400', label: 'Connected' },
      connecting: { icon: Wifi, color: 'text-yellow-400 animate-pulse', label: 'Connecting...' },
      disconnected: { icon: WifiOff, color: 'text-gray-400', label: 'Disconnected' },
      error: { icon: WifiOff, color: 'text-red-400', label: 'Error' }
    };
    
    const config = statusConfig[connectionStatus];
    const Icon = config.icon;
    
    return (
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", config.color)} />
        <span className={cn("text-xs", config.color)}>{config.label}</span>
        {sipExtension && (
          <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
            Ext {sipExtension}
          </Badge>
        )}
      </div>
    );
  };
  
  const IncomingCallModal = () => {
    if (!incomingCallVisible || !currentCall) return null;
    
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="fixed top-20 right-4 z-[100] w-80"
        >
          <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-400 p-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PhoneIncoming className="h-6 w-6 text-white animate-bounce" />
                  <span className="text-white font-medium">Incoming Call</span>
                </div>
                <Volume2 className="h-5 w-5 text-white animate-pulse" />
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">
                  {formatPhoneInput(currentCall.phoneNumber)}
                </div>
                {currentCall.displayName && (
                  <div className="text-sm text-gray-400 mt-1">
                    {currentCall.displayName}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => getWebPhone().rejectCall()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  data-testid="button-reject-call"
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button
                  onClick={() => getWebPhone().answerCall()}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  data-testid="button-answer-call"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Answer
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };
  
  const Dialpad = () => {
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    const letters = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ', '', '+', ''];
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute top-full right-0 mt-2 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 w-72"
      >
        <div className="mb-4">
          <input
            type="text"
            value={dialNumber}
            onChange={(e) => setDialNumber(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white text-xl text-center focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            placeholder="Enter number..."
            data-testid="input-dial-number"
          />
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-4">
          {digits.map((digit, index) => (
            <button
              key={digit}
              onClick={() => handleDial(digit)}
              className="aspect-square bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex flex-col items-center justify-center transition-all transform active:scale-95"
              data-testid={`button-dialpad-${digit}`}
            >
              <span className="text-2xl text-white font-light">{digit}</span>
              {letters[index] && (
                <span className="text-xs text-gray-400">{letters[index]}</span>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setDialNumber(prev => prev.slice(0, -1))}
            variant="outline"
            className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
            data-testid="button-backspace"
          >
            Backspace
          </Button>
          <Button
            onClick={handleCall}
            className="flex-1 bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-600 hover:to-green-500"
            disabled={!dialNumber}
            data-testid="button-make-call"
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
        </div>
      </motion.div>
    );
  };
  
  const ActiveCall = () => {
    if (!currentCall) return null;
    
    const isRinging = currentCall.status === 'ringing';
    const isAnswered = currentCall.status === 'answered';
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-500/30"
      >
        <div className="relative">
          {currentCall.direction === 'inbound' ? (
            <PhoneIncoming className="h-4 w-4 text-cyan-400" />
          ) : (
            <PhoneOutgoing className="h-4 w-4 text-cyan-400" />
          )}
          {isRinging && (
            <div className="absolute inset-0 animate-ping">
              <div className="h-4 w-4 bg-cyan-400 rounded-full opacity-75" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">
            {formatPhoneInput(currentCall.phoneNumber)}
          </div>
          <div className="text-xs text-gray-400">
            {isRinging ? 'Calling...' : isAnswered ? formatDuration(callDuration) : 'Connected'}
          </div>
        </div>
        
        {isAnswered && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => getWebPhone().toggleMute()}
              className={cn(
                "h-7 w-7 p-0",
                isMuted ? "text-red-400" : "text-gray-400"
              )}
              data-testid="button-mute"
            >
              {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => getWebPhone().toggleHold()}
              className={cn(
                "h-7 w-7 p-0",
                isOnHold ? "text-yellow-400" : "text-gray-400"
              )}
              data-testid="button-hold"
            >
              {isOnHold ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toggleDialpad()}
              className="h-7 w-7 p-0 text-gray-400"
              data-testid="button-toggle-dialpad"
            >
              <KeyboardIcon className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        
        <Button
          size="sm"
          onClick={() => getWebPhone().hangupCall()}
          className="h-7 px-3 bg-red-500 hover:bg-red-600 text-white"
          data-testid="button-hangup"
        >
          <PhoneOff className="h-3.5 w-3.5" />
        </Button>
      </motion.div>
    );
  };
  
  const CallHistory = () => {
    const recentCalls = callHistory.slice(0, 5);
    
    if (!isExpanded || recentCalls.length === 0) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="absolute top-full left-0 right-0 mt-1 bg-black/95 backdrop-blur-xl border border-white/10 shadow-2xl"
      >
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Recent Calls</span>
            <button
              onClick={() => clearCallHistory()}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear All
            </button>
          </div>
          {recentCalls.map((call) => (
            <div
              key={call.id}
              className="flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer"
              onClick={() => {
                setDialNumber(call.phoneNumber);
                toggleDialpad();
              }}
            >
              {call.status === 'missed' ? (
                <PhoneMissed className="h-3.5 w-3.5 text-red-400" />
              ) : call.direction === 'inbound' ? (
                <PhoneIncoming className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <PhoneOutgoing className="h-3.5 w-3.5 text-blue-400" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">
                  {formatPhoneInput(call.phoneNumber)}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(call.startTime).toLocaleTimeString()} • {call.duration ? `${call.duration}s` : 'Missed'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  };
  
  // Don't render if SIP is not enabled
  if (!sipExtension) return null;
  
  return (
    <>
      {/* Audio elements (hidden) */}
      <audio ref={remoteAudioRef} autoPlay />
      <audio ref={localAudioRef} autoPlay muted />
      
      {/* Incoming call modal */}
      <IncomingCallModal />
      
      {/* Main header bar */}
      <div className="fixed top-0 right-0 z-50 p-3">
        <div className="relative">
          <motion.div
            className={cn(
              "bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl",
              "transition-all duration-300 ease-in-out"
            )}
          >
            <div className="flex items-center gap-3 px-4 py-2">
              {/* Connection status */}
              <ConnectionStatus />
              
              {/* Active call */}
              {currentCall && <ActiveCall />}
              
              {/* Dialpad button */}
              {!currentCall && (
                <Button
                  size="sm"
                  onClick={() => toggleDialpad()}
                  className="h-8 px-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
                  data-testid="button-open-dialpad"
                >
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  Dial
                </Button>
              )}
              
              {/* History toggle */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 p-0 text-gray-400"
                data-testid="button-toggle-history"
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
          
          {/* Dialpad dropdown */}
          {dialpadVisible && <Dialpad />}
          
          {/* Call history dropdown */}
          <CallHistory />
        </div>
      </div>
    </>
  );
}