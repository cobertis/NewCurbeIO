import { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X, Grid3x3, Volume2, UserPlus, User, PhoneIncoming, PhoneOutgoing, Users, Voicemail, Menu, Delete, Clock, Circle, PhoneForwarded, PhoneMissed, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatPhoneInput } from '@shared/phone';
import { format } from 'date-fns';

function formatCallerNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length >= 3 && digits.length <= 4) {
    return `Ext. ${digits}`;
  }
  return formatPhoneInput(phoneNumber);
}

type ViewMode = 'recents' | 'contacts' | 'keypad' | 'voicemail';

interface BottomNavigationProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  missedCallsCount: number;
}

function BottomNavigation({ viewMode, setViewMode, missedCallsCount }: BottomNavigationProps) {
  return (
    <div className="border-t border-border/30 px-0.5 sm:px-1 py-1 sm:py-1.5 flex items-center justify-around bg-background h-[50px] sm:h-[60px] flex-shrink-0">
      <button
        onClick={() => setViewMode('recents')}
        className="flex flex-col items-center justify-center gap-0.5 py-0.5 sm:py-1 px-1 sm:px-2"
      >
        <div className="relative">
          <Clock className={cn("h-5 w-5 sm:h-7 sm:w-7", viewMode === 'recents' ? "text-blue-500" : "text-foreground")} />
          {missedCallsCount > 0 && (
            <div className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full min-w-[14px] h-[14px] sm:min-w-[18px] sm:h-[18px] px-0.5 sm:px-1 flex items-center justify-center">
              <span className="text-white text-[8px] sm:text-[10px] font-semibold">
                {missedCallsCount}
              </span>
            </div>
          )}
        </div>
        <span className={cn("text-[8px] sm:text-[9px]", viewMode === 'recents' ? "text-blue-500" : "text-foreground/90")}>
          Recents
        </span>
      </button>
      
      <button
        onClick={() => setViewMode('contacts')}
        className="flex flex-col items-center justify-center gap-0.5 py-0.5 sm:py-1 px-1 sm:px-2"
      >
        <User className={cn("h-5 w-5 sm:h-7 sm:w-7", viewMode === 'contacts' ? "text-blue-500" : "text-foreground")} />
        <span className={cn("text-[8px] sm:text-[9px]", viewMode === 'contacts' ? "text-blue-500" : "text-foreground/90")}>
          Contacts
        </span>
      </button>
      
      <button
        onClick={() => setViewMode('keypad')}
        className="flex flex-col items-center justify-center gap-0.5 py-0.5 sm:py-1 px-1 sm:px-2"
      >
        <Grid3x3 className={cn("h-5 w-5 sm:h-7 sm:w-7", viewMode === 'keypad' ? "text-blue-500" : "text-foreground")} />
        <span className={cn("text-[8px] sm:text-[9px]", viewMode === 'keypad' ? "text-blue-500" : "text-foreground/90")}>
          Keypad
        </span>
      </button>
      
      <button
        onClick={() => setViewMode('voicemail')}
        className="flex flex-col items-center justify-center gap-0.5 py-0.5 sm:py-1 px-1 sm:px-2"
      >
        <Voicemail className={cn("h-5 w-5 sm:h-7 sm:w-7", viewMode === 'voicemail' ? "text-blue-500" : "text-foreground")} />
        <span className={cn("text-[8px] sm:text-[9px]", viewMode === 'voicemail' ? "text-blue-500" : "text-foreground/90")}>
          Voicemail
        </span>
      </button>
    </div>
  );
}

export function WebPhoneFloatingWindow() {
  // Helper function to calculate responsive dimensions
  const calculateDimensions = () => {
    const width = Math.min(360, window.innerWidth * 0.9);
    const height = Math.min(700, window.innerHeight * 0.85);
    return { width, height };
  };

  // Helper function to clamp position within viewport
  const clampPosition = (pos: { x: number; y: number }, dims: { width: number; height: number }) => {
    return {
      x: Math.max(0, Math.min(pos.x, window.innerWidth - dims.width)),
      y: Math.max(0, Math.min(pos.y, window.innerHeight - dims.height))
    };
  };

  const [dimensions, setDimensions] = useState(calculateDimensions());
  const [dialNumber, setDialNumber] = useState('');
  const [position, setPosition] = useState(() => {
    const dims = calculateDimensions();
    return clampPosition(
      { x: window.innerWidth - dims.width - 20, y: window.innerHeight - dims.height - 20 },
      dims
    );
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('keypad');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const windowRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const dialInputRef = useRef<HTMLInputElement>(null);
  
  const isVisible = useWebPhoneStore(state => state.dialpadVisible);
  const connectionStatus = useWebPhoneStore(state => state.connectionStatus);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const isMuted = useWebPhoneStore(state => state.isMuted);
  const isOnHold = useWebPhoneStore(state => state.isOnHold);
  const isRecording = useWebPhoneStore(state => state.isRecording);
  const sipExtension = useWebPhoneStore(state => state.sipExtension);
  const callHistory = useWebPhoneStore(state => state.callHistory);
  const toggleDialpad = useWebPhoneStore(state => state.toggleDialpad);
  const setAudioElements = useWebPhoneStore(state => state.setAudioElements);

  // Handle window resize - recalculate dimensions and clamp position
  useEffect(() => {
    const handleResize = () => {
      const newDims = calculateDimensions();
      setDimensions(newDims);
      setPosition(prev => clampPosition(prev, newDims));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // FIX PROBLEM 1: Re-register audio elements EVERY time component becomes visible
  // This ensures audio refs are NEVER lost after reload or when dialpad is toggled
  useEffect(() => {
    if (isVisible && remoteAudioRef.current && localAudioRef.current) {
      console.log('[WebPhone FloatingWindow] ✅ Registering audio elements on mount/visibility');
      setAudioElements(localAudioRef.current, remoteAudioRef.current);
    } else if (isVisible) {
      console.warn('[WebPhone FloatingWindow] ⚠️ Audio refs not ready:', {
        remote: !!remoteAudioRef.current,
        local: !!localAudioRef.current
      });
    }
  }, [isVisible, setAudioElements]);
  
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
  
  // Return to keypad when call ends
  useEffect(() => {
    if (!currentCall) {
      setViewMode('keypad');
    }
  }, [currentCall]);
  
  // Auto-focus input when switching to keypad and clear when leaving
  useEffect(() => {
    if (viewMode === 'keypad' && dialInputRef.current) {
      setTimeout(() => {
        dialInputRef.current?.focus();
      }, 100);
    } else if (viewMode !== 'keypad') {
      setDialNumber('');
    }
  }, [viewMode]);
  
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
        const newPos = {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        };
        // Clamp position to keep window within viewport
        setPosition(clampPosition(newPos, dimensions));
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
  }, [isDragging, dragOffset, dimensions]);
  
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
  
  const missedCallsCount = callHistory.filter(c => c.status === 'missed').length;
  
  const getCallStatusStyle = (status: string) => {
    switch(status) {
      case 'missed':
        return {
          color: 'text-red-500',
          icon: PhoneMissed,
          label: 'Missed'
        };
      case 'answered':
        return {
          color: 'text-green-600',
          icon: Phone,
          label: 'Answered'
        };
      case 'ended':
        return {
          color: 'text-foreground',
          icon: Phone,
          label: 'Ended'
        };
      default:
        return {
          color: 'text-muted-foreground',
          icon: Phone,
          label: status
        };
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
        className="fixed z-50 bg-background border-2 border-border rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        {/* iPhone Notch/Header */}
        <div
          className="bg-background px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between cursor-grab active:cursor-grabbing h-[44px] sm:h-[52px] flex-shrink-0"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            {sipExtension ? (
              <>
                <span className="text-foreground font-medium text-xs sm:text-sm">Ext: {sipExtension}</span>
                <div className={cn(
                  "h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full",
                  connectionStatus === 'connected' ? "bg-green-500" : "bg-red-500"
                )} />
              </>
            ) : (
              <span className="text-foreground font-medium text-xs sm:text-sm">Not configured</span>
            )}
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 no-drag">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground hover:text-foreground"
              onClick={toggleDialpad}
            >
              <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden no-drag">
          {currentCall ? (
              /* Active Call Screen - No bottom navigation */
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col justify-between p-3 sm:p-6 min-h-full">
                  {/* Contact Info */}
                  <div className="text-center pt-4 sm:pt-8">
                    <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-muted flex items-center justify-center mb-3 sm:mb-4">
                      <User className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-medium text-foreground mb-1.5 sm:mb-2">
                      {currentCall.displayName || 'Unknown'}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground mb-1">
                      {formatCallerNumber(currentCall.phoneNumber)}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {currentCall.status === 'ringing' && 'Calling...'}
                      {currentCall.status === 'answered' && formatDuration(callDuration)}
                    </p>
                  </div>
                  
                  {/* Call Controls */}
                  <div className="space-y-3 sm:space-y-4 pb-4 sm:pb-8">
                    {/* Control Buttons Grid - Only 3 buttons */}
                    <div className="grid grid-cols-3 gap-3 sm:gap-6 px-2 sm:px-4">
                      <button
                        onClick={() => isMuted ? webPhone.unmuteCall() : webPhone.muteCall()}
                        className="flex flex-col items-center gap-1.5 sm:gap-2 transition-opacity hover:opacity-80"
                        data-testid="button-mute-call"
                      >
                        <div className={cn(
                          "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-md",
                          isMuted ? "bg-foreground" : "bg-muted/80"
                        )}>
                          {isMuted ? (
                            <MicOff className="h-5 w-5 sm:h-7 sm:w-7 text-background" />
                          ) : (
                            <Mic className="h-5 w-5 sm:h-7 sm:w-7 text-foreground" />
                          )}
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">mute</span>
                      </button>
                      
                      <button
                        onClick={() => setShowTransferDialog(true)}
                        className="flex flex-col items-center gap-1.5 sm:gap-2 transition-opacity hover:opacity-80"
                        data-testid="button-transfer"
                      >
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted/80 flex items-center justify-center shadow-md">
                          <PhoneForwarded className="h-5 w-5 sm:h-7 sm:w-7 text-foreground" />
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">transfer</span>
                      </button>
                      
                      <button
                        onClick={() => isOnHold ? webPhone.unholdCall() : webPhone.holdCall()}
                        className="flex flex-col items-center gap-1.5 sm:gap-2 transition-opacity hover:opacity-80"
                        data-testid="button-hold-call"
                      >
                        <div className={cn(
                          "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-md",
                          isOnHold ? "bg-foreground" : "bg-muted/80"
                        )}>
                          <Pause className={cn("h-5 w-5 sm:h-7 sm:w-7", isOnHold ? "text-background" : "text-foreground")} />
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">hold</span>
                      </button>
                    </div>
                    
                    {/* End Call Button */}
                    <div className="flex justify-center pt-3 sm:pt-6">
                      <button
                        onClick={() => webPhone.hangupCall()}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                      >
                        <PhoneOff className="h-7 w-7 sm:h-9 sm:w-9 text-white" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Transfer Dialog */}
                  {showTransferDialog && currentCall && (
                    <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                      <DialogContent className="sm:max-w-md">
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Transfer Call</h3>
                            <p className="text-sm text-muted-foreground">Enter the number to transfer to</p>
                          </div>
                          
                          <input
                            type="tel"
                            value={transferNumber}
                            onChange={(e) => setTransferNumber(e.target.value)}
                            placeholder="Enter phone number"
                            className="w-full px-4 py-2 border rounded-lg"
                            data-testid="input-transfer-number"
                          />
                          
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                webPhone.blindTransfer(transferNumber);
                                setShowTransferDialog(false);
                                setTransferNumber('');
                              }}
                              disabled={!transferNumber}
                              className="flex-1"
                              data-testid="button-blind-transfer"
                            >
                              Blind Transfer
                            </Button>
                            <Button
                              onClick={() => {
                                webPhone.attendedTransfer(transferNumber);
                                setShowTransferDialog(false);
                                setTransferNumber('');
                              }}
                              disabled={!transferNumber}
                              variant="outline"
                              className="flex-1"
                              data-testid="button-attended-transfer"
                            >
                              Attended Transfer
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            ) : (
              /* Main Layout with Fixed Bottom Navigation */
              <>
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {viewMode === 'recents' && (
                    <>
                      {/* Header - Fixed at top of scrollable area */}
                      <div className="px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between flex-shrink-0">
                        <button className="text-sm sm:text-base text-blue-500">Edit</button>
                        <h2 className="text-base sm:text-lg font-semibold text-foreground">Recents</h2>
                        <button>
                          <Menu className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
                        </button>
                      </div>
                      
                      {/* Call History List - Scrollable */}
                      {callHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6">
                          <Phone className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-2 sm:mb-3" />
                          <p className="text-xs sm:text-sm text-muted-foreground">No recent calls</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {callHistory.map((call) => {
                            const initials = call.displayName 
                              ? call.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                              : '';
                            const timeStr = format(new Date(call.startTime), 'h:mma');
                            const statusStyle = getCallStatusStyle(call.status);
                            
                            return (
                              <div key={call.id} className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-2.5 hover:bg-muted/30 transition-colors">
                                {/* Avatar */}
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  {initials ? (
                                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">{initials}</span>
                                  ) : (
                                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                                  )}
                                </div>
                                
                                {/* Call Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                                    {call.direction === 'inbound' && call.status === 'missed' ? (
                                      <PhoneMissed className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", statusStyle.color)} />
                                    ) : call.direction === 'inbound' ? (
                                      <PhoneIncoming className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                                    ) : (
                                      <PhoneOutgoing className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                                    )}
                                    <span className={cn(
                                      "text-sm sm:text-base font-normal truncate",
                                      statusStyle.color
                                    )}>
                                      {call.displayName || formatCallerNumber(call.phoneNumber)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                                    <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    <span>phone</span>
                                  </div>
                                </div>
                                
                                {/* Time and Call Button */}
                                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                  <span className="text-xs sm:text-sm text-muted-foreground">{timeStr}</span>
                                  <button
                                    onClick={() => {
                                      setViewMode('keypad');
                                      setDialNumber(call.phoneNumber);
                                    }}
                                    className="text-blue-500 hover:opacity-80 transition-opacity"
                                  >
                                    <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  
                  {viewMode === 'keypad' && (
                    /* Dialpad Content */
                    <div className="flex flex-col justify-between py-2 sm:py-4 px-3 sm:px-6 min-h-full">
                      {/* Number Display */}
                      <div className="text-center py-2 sm:py-3">
                        <input
                          ref={dialInputRef}
                          type="tel"
                          value={dialNumber}
                          onChange={(e) => handleNumberChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && dialNumber) {
                              handleCall();
                            } else if (e.key === 'Backspace') {
                              e.preventDefault();
                              setDialNumber(prev => prev.slice(0, -1));
                            }
                          }}
                          className="w-full bg-transparent border-none text-foreground text-xl sm:text-2xl text-center focus:outline-none font-normal"
                          placeholder=""
                          data-testid="input-dial-number"
                          autoComplete="off"
                        />
                      </div>
                      
                      {/* Dialpad Grid */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 px-1 sm:px-2">
                        {digits.map((digit, index) => (
                          <button
                            key={digit}
                            onClick={() => handleDial(digit)}
                            className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-full bg-muted/40 hover:bg-muted/60 flex flex-col items-center justify-center transition-all active:scale-95 shadow-sm"
                            data-testid={`button-dialpad-${digit}`}
                          >
                            <span className="text-2xl sm:text-3xl text-foreground font-normal">
                              {digit}
                            </span>
                            <span className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-widest font-medium h-[12px] sm:h-[14px]">
                              {letters[index] || '\u00A0'}
                            </span>
                          </button>
                        ))}
                      </div>
                      
                      {/* Bottom Row - Call and Delete Buttons */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 px-1 sm:px-2 py-2 sm:py-3">
                        <div></div>
                        <button
                          onClick={handleCall}
                          disabled={!dialNumber || connectionStatus !== 'connected'}
                          className={cn(
                            "w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                            dialNumber && connectionStatus === 'connected'
                              ? "bg-green-500 hover:bg-green-600" 
                              : "bg-green-500/40 cursor-not-allowed"
                          )}
                        >
                          <Phone className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                        </button>
                        
                        {dialNumber ? (
                          <button
                            onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                            className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-full hover:bg-muted/30 flex items-center justify-center transition-all active:scale-95"
                          >
                            <Delete className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                          </button>
                        ) : (
                          <div></div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {(viewMode === 'contacts' || viewMode === 'voicemail') && (
                    /* Contacts/Voicemail - Empty State */
                    <div className="flex items-center justify-center min-h-full">
                      <p className="text-sm text-muted-foreground">Coming soon</p>
                    </div>
                  )}
                </div>
                
                {/* Bottom Navigation - Fixed at bottom, OUTSIDE scrollable area */}
                <BottomNavigation 
                  viewMode={viewMode} 
                  setViewMode={setViewMode} 
                  missedCallsCount={missedCallsCount} 
                />
              </>
            )}
        </div>
      </div>
    </>
  );
}
