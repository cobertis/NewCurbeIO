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
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 580 });
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
        className="fixed z-50 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg overflow-hidden"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: isMinimized ? '240px' : '300px',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        {/* Header */}
        <div
          className="bg-muted/50 px-3 py-2 flex items-center justify-between border-b border-border"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium text-xs">Phone</span>
            {sipExtension && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {sipExtension}
              </Badge>
            )}
            {connectionStatus === 'connected' && (
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            )}
          </div>
          
          <div className="flex items-center gap-0.5 no-drag">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={toggleDialpad}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {!isMinimized && (
          <div className="p-3 no-drag">
            {/* Active Call Display */}
            {currentCall ? (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <div className="text-sm font-medium text-foreground">
                    {formatPhoneInput(currentCall.phoneNumber)}
                  </div>
                  {currentCall.displayName && (
                    <div className="text-xs text-muted-foreground">{currentCall.displayName}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {currentCall.status === 'ringing' && 'Ringing...'}
                    {currentCall.status === 'answered' && formatDuration(callDuration)}
                  </div>
                </div>
                
                <div className="flex gap-1.5 justify-center">
                  <Button
                    onClick={() => webPhone.toggleMute()}
                    variant={isMuted ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 h-8"
                  >
                    {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    onClick={() => webPhone.toggleHold()}
                    variant={isOnHold ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 h-8"
                  >
                    {isOnHold ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    onClick={() => webPhone.hangupCall()}
                    variant="destructive"
                    size="sm"
                    className="flex-1 h-8"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Dialpad Input */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={dialNumber}
                    onChange={(e) => setDialNumber(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-1.5 text-foreground text-base text-center focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter number..."
                    data-testid="input-dial-number"
                  />
                </div>
                
                {/* Dialpad */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {digits.map((digit, index) => (
                    <button
                      key={digit}
                      onClick={() => handleDial(digit)}
                      className="aspect-square bg-muted hover:bg-accent border border-border rounded-md flex flex-col items-center justify-center transition-colors"
                      data-testid={`button-dialpad-${digit}`}
                    >
                      <span className="text-lg text-foreground font-light">{digit}</span>
                      {letters[index] && (
                        <span className="text-[9px] text-muted-foreground">{letters[index]}</span>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Call Button */}
                <div className="flex gap-1.5">
                  <Button
                    onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                    variant="outline"
                    size="sm"
                    className="w-12 h-8"
                  >
                    ←
                  </Button>
                  <Button
                    onClick={handleCall}
                    size="sm"
                    className="flex-1 h-8 bg-green-600 hover:bg-green-700"
                    disabled={!dialNumber}
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
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
