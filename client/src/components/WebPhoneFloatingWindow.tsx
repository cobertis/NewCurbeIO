import { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X, Minimize2, Maximize2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPhoneInput } from '@shared/phone';

export function WebPhoneFloatingWindow() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const windowRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  
  const isVisible = useWebPhoneStore(state => state.dialpadVisible);
  const connectionStatus = useWebPhoneStore(state => state.connectionStatus);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const isMuted = useWebPhoneStore(state => state.isMuted);
  const isOnHold = useWebPhoneStore(state => state.isOnHold);
  const sipExtension = useWebPhoneStore(state => state.sipExtension);
  const toggleDialpad = useWebPhoneStore(state => state.toggleDialpad);
  const setAudioElements = useWebPhoneStore(state => state.setAudioElements);
  
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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);
  
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  const letters = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ', '', '+', ''];
  
  const handleDial = (digit: string) => {
    setDialNumber(prev => prev + digit);
    if (currentCall?.status === 'answered') {
      webPhone.sendDTMF(digit);
    }
  };
  
  const handleCall = async () => {
    if (!dialNumber) return;
    try {
      await webPhone.makeCall(dialNumber);
      setDialNumber('');
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <>
      {/* Hidden audio elements */}
      <audio ref={remoteAudioRef} autoPlay />
      <audio ref={localAudioRef} autoPlay muted />
      
      {/* Floating Window */}
      <div
        ref={windowRef}
        className="fixed z-50 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: isMinimized ? '300px' : '380px',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        {/* Header */}
        <div
          className="bg-gradient-to-r from-blue-600 to-blue-500 p-3 flex items-center justify-between"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-white" />
            <span className="text-white font-semibold text-sm">WebPhone</span>
            {sipExtension && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                Ext {sipExtension}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1 no-drag">
            {/* Connection Status */}
            <div className="flex items-center gap-1 mr-2">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-3.5 w-3.5 text-green-300" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-300" />
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white hover:bg-white/20"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white hover:bg-white/20"
              onClick={toggleDialpad}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {!isMinimized && (
          <div className="p-4 no-drag">
            {/* Active Call Display */}
            {currentCall ? (
              <div className="mb-4 p-4 bg-slate-800/50 rounded-lg">
                <div className="text-center mb-3">
                  <div className="text-lg font-semibold text-white">
                    {formatPhoneInput(currentCall.phoneNumber)}
                  </div>
                  {currentCall.displayName && (
                    <div className="text-sm text-slate-400">{currentCall.displayName}</div>
                  )}
                  <div className="text-sm text-slate-400 mt-1">
                    {currentCall.status === 'ringing' && 'Ringing...'}
                    {currentCall.status === 'answered' && formatDuration(callDuration)}
                  </div>
                </div>
                
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => webPhone.toggleMute()}
                    variant={isMuted ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={() => webPhone.toggleHold()}
                    variant={isOnHold ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                  >
                    {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={() => webPhone.hangupCall()}
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Dialpad Input */}
                <div className="mb-4">
                  <input
                    type="text"
                    value={dialNumber}
                    onChange={(e) => setDialNumber(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-white text-xl text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter number..."
                    data-testid="input-dial-number"
                  />
                </div>
                
                {/* Dialpad */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {digits.map((digit, index) => (
                    <button
                      key={digit}
                      onClick={() => handleDial(digit)}
                      className="aspect-square bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-lg flex flex-col items-center justify-center transition-all transform active:scale-95"
                      data-testid={`button-dialpad-${digit}`}
                    >
                      <span className="text-2xl text-white font-light">{digit}</span>
                      {letters[index] && (
                        <span className="text-xs text-slate-400">{letters[index]}</span>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Call Button */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                    variant="outline"
                    className="flex-1 bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50"
                  >
                    ←
                  </Button>
                  <Button
                    onClick={handleCall}
                    className="flex-1 bg-green-600 text-white hover:bg-green-700"
                    disabled={!dialNumber}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
