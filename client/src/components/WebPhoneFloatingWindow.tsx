import { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X, Minimize2, Maximize2, Grid3x3, Volume2, UserPlus, StickyNote, MoreHorizontal, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPhoneInput } from '@shared/phone';

export function WebPhoneFloatingWindow() {
  const [dialNumber, setDialNumber] = useState('');
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 660 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
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
  
  const formatDialerInput = (value: string): string => {
    const rawDigits = value.replace(/\D/g, '');
    const limitedDigits = rawDigits.slice(0, 10);
    
    if (limitedDigits.length === 0) return '';
    if (limitedDigits.length <= 3) return `(${limitedDigits}`;
    if (limitedDigits.length <= 6) {
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    }
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
  };
  
  const handleDial = (digit: string) => {
    const currentDigits = dialNumber.replace(/\D/g, '');
    if (currentDigits.length < 10) {
      const newDigits = currentDigits + digit;
      setDialNumber(formatDialerInput(newDigits));
    }
    
    if (currentCall?.status === 'answered') {
      webPhone.sendDTMF(digit);
    }
  };
  
  const handleNumberChange = (value: string) => {
    const formatted = formatDialerInput(value);
    setDialNumber(formatted);
  };
  
  const handleCall = async () => {
    if (!dialNumber) return;
    try {
      const digits = dialNumber.replace(/\D/g, '');
      await webPhone.makeCall(digits);
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
      
      {/* iPhone-style Floating Window */}
      <div
        ref={windowRef}
        className="fixed z-50 bg-background border-2 border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '360px',
          height: '640px',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        {/* iPhone Notch/Header */}
        <div
          className="bg-background px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <span className="text-foreground font-medium text-sm">Phone</span>
            {sipExtension && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                Ext {sipExtension}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 no-drag">
            {connectionStatus === 'connected' && (
              <div className="h-2 w-2 rounded-full bg-green-500" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={toggleDialpad}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col h-[588px] no-drag">
            {currentCall ? (
              /* Active Call Screen */
              <div className="flex-1 flex flex-col justify-between p-6">
                {/* Contact Info */}
                <div className="text-center pt-8">
                  <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h2 className="text-xl font-medium text-foreground mb-2">
                    {currentCall.displayName || 'Unknown'}
                  </h2>
                  <p className="text-base text-muted-foreground mb-1">
                    {formatPhoneInput(currentCall.phoneNumber)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentCall.status === 'ringing' && 'Calling...'}
                    {currentCall.status === 'answered' && formatDuration(callDuration)}
                  </p>
                </div>
                
                {/* Call Controls */}
                <div className="space-y-4 pb-8">
                  {/* Control Buttons Grid */}
                  <div className="grid grid-cols-3 gap-6 px-4">
                    <button
                      onClick={() => webPhone.toggleMute()}
                      className="flex flex-col items-center gap-2 transition-opacity hover:opacity-80"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center shadow-md",
                        isMuted ? "bg-foreground" : "bg-muted/80"
                      )}>
                        {isMuted ? (
                          <MicOff className="h-7 w-7 text-background" />
                        ) : (
                          <Mic className="h-7 w-7 text-foreground" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">mute</span>
                    </button>
                    
                    <button
                      onClick={() => setShowKeypad(!showKeypad)}
                      className="flex flex-col items-center gap-2 transition-opacity hover:opacity-80"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center shadow-md",
                        showKeypad ? "bg-foreground" : "bg-muted/80"
                      )}>
                        <Grid3x3 className={cn("h-7 w-7", showKeypad ? "text-background" : "text-foreground")} />
                      </div>
                      <span className="text-xs text-muted-foreground">keypad</span>
                    </button>
                    
                    <button className="flex flex-col items-center gap-2 opacity-40 cursor-not-allowed">
                      <div className="w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center shadow-md">
                        <Volume2 className="h-7 w-7 text-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">speaker</span>
                    </button>
                    
                    <button className="flex flex-col items-center gap-2 opacity-40 cursor-not-allowed">
                      <div className="w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center shadow-md">
                        <UserPlus className="h-7 w-7 text-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">add call</span>
                    </button>
                    
                    <button
                      onClick={() => webPhone.toggleHold()}
                      className="flex flex-col items-center gap-2 transition-opacity hover:opacity-80"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center shadow-md",
                        isOnHold ? "bg-foreground" : "bg-muted/80"
                      )}>
                        <Pause className={cn("h-7 w-7", isOnHold ? "text-background" : "text-foreground")} />
                      </div>
                      <span className="text-xs text-muted-foreground">hold</span>
                    </button>
                    
                    <button className="flex flex-col items-center gap-2 opacity-40 cursor-not-allowed">
                      <div className="w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center shadow-md">
                        <Phone className="h-7 w-7 text-foreground" />
                      </div>
                      <span className="text-xs text-muted-foreground">contacts</span>
                    </button>
                  </div>
                  
                  {/* End Call Button */}
                  <div className="flex justify-center pt-6">
                    <button
                      onClick={() => webPhone.hangupCall()}
                      className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                    >
                      <PhoneOff className="h-9 w-9 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Dialpad Screen */
              <div className="flex-1 flex flex-col justify-between px-4 py-8">
                {/* Number Display */}
                <div className="pt-8 pb-12">
                  <input
                    type="text"
                    value={dialNumber}
                    onChange={(e) => handleNumberChange(e.target.value)}
                    className="w-full bg-transparent border-none text-muted-foreground text-4xl text-center focus:outline-none font-light tracking-wide"
                    placeholder="Enter number"
                    data-testid="input-dial-number"
                  />
                </div>
                
                {/* Dialpad Grid */}
                <div className="grid grid-cols-3 gap-x-8 gap-y-6 px-8">
                  {digits.map((digit, index) => (
                    <button
                      key={digit}
                      onClick={() => handleDial(digit)}
                      className="flex flex-col items-center justify-center py-4 hover:bg-muted/20 rounded-lg transition-colors active:bg-muted/30"
                      data-testid={`button-dialpad-${digit}`}
                    >
                      <span className="text-4xl text-foreground font-light leading-none mb-1">
                        {digit}
                      </span>
                      {letters[index] && (
                        <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                          {letters[index]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Call Button */}
                <div className="flex justify-center pt-8 pb-6">
                  <button
                    onClick={handleCall}
                    disabled={!dialNumber}
                    className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                      dialNumber 
                        ? "bg-green-500 hover:bg-green-600 active:scale-95" 
                        : "bg-muted/20 cursor-not-allowed opacity-40"
                    )}
                  >
                    <Phone className={cn(
                      "h-7 w-7",
                      dialNumber ? "text-white" : "text-muted-foreground"
                    )} />
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
}
