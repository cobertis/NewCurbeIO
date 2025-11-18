import { useState, useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X, Grid3x3, Volume2, UserPlus, User, PhoneIncoming, PhoneOutgoing, Users, Search, Menu, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPhoneInput } from '@shared/phone';
import { format } from 'date-fns';

type ViewMode = 'calls' | 'contacts' | 'keypad' | 'search';

export function WebPhoneFloatingWindow() {
  const [dialNumber, setDialNumber] = useState('');
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 720 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [callDuration, setCallDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('keypad');
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
  const sipExtension = useWebPhoneStore(state => state.sipExtension);
  const callHistory = useWebPhoneStore(state => state.callHistory);
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
  
  // Return to keypad when call ends
  useEffect(() => {
    if (!currentCall) {
      setViewMode('keypad');
    }
  }, [currentCall]);
  
  // Auto-focus input when switching to keypad
  useEffect(() => {
    if (viewMode === 'keypad' && dialInputRef.current) {
      setTimeout(() => {
        dialInputRef.current?.focus();
      }, 100);
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
        className="fixed z-50 bg-background border-2 border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '360px',
          height: '700px',
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        {/* iPhone Notch/Header */}
        <div
          className="bg-background px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing h-[52px] flex-shrink-0"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            {sipExtension ? (
              <>
                <span className="text-foreground font-medium text-sm">Ext: {sipExtension}</span>
                <div className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  connectionStatus === 'connected' ? "bg-green-500" : "bg-red-500"
                )} />
              </>
            ) : (
              <span className="text-foreground font-medium text-sm">Not configured</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 no-drag">
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
        
        <div className="flex-1 flex flex-col overflow-hidden no-drag">
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
            ) : viewMode === 'calls' ? (
              /* Call History Screen */
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <button className="text-base text-blue-500">Edit</button>
                  <h2 className="text-lg font-semibold text-foreground">Calls</h2>
                  <button>
                    <Menu className="h-5 w-5 text-foreground" />
                  </button>
                </div>
                
                {/* Call History List */}
                <div className="flex-1 overflow-y-auto">
                  {callHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6">
                      <Phone className="h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No recent calls</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {callHistory.map((call) => {
                        const initials = call.displayName 
                          ? call.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                          : '';
                        const timeStr = format(new Date(call.startTime), 'h:mma');
                        const isMissed = call.status === 'missed';
                        const isUnknown = !call.displayName;
                        
                        return (
                          <div key={call.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              {initials ? (
                                <span className="text-sm font-medium text-muted-foreground">{initials}</span>
                              ) : (
                                <User className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            
                            {/* Call Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {call.direction === 'inbound' && (
                                  <PhoneIncoming className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {call.direction === 'outbound' && (
                                  <PhoneOutgoing className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <span className={cn(
                                  "text-base font-normal truncate",
                                  isMissed ? "text-red-500" : isUnknown ? "text-red-500" : "text-foreground"
                                )}>
                                  {call.displayName || formatPhoneInput(call.phoneNumber)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>phone</span>
                              </div>
                            </div>
                            
                            {/* Time and Call Button */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm text-muted-foreground">{timeStr}</span>
                              <button
                                onClick={() => {
                                  setViewMode('keypad');
                                  setDialNumber(call.phoneNumber);
                                }}
                                className="text-blue-500 hover:opacity-80 transition-opacity"
                              >
                                <Phone className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Bottom Navigation */}
                <div className="border-t border-border px-4 py-2 flex items-center justify-around bg-background h-[60px] flex-shrink-0">
                  <button
                    onClick={() => setViewMode('calls')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <div className="relative">
                      <Phone className={cn("h-6 w-6", viewMode === 'calls' ? "text-blue-500" : "text-muted-foreground")} />
                      {callHistory.filter(c => c.status === 'missed').length > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          <span className="text-white text-[10px] font-semibold">
                            {callHistory.filter(c => c.status === 'missed').length}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={cn("text-[10px]", viewMode === 'calls' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Calls
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('contacts')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <User className={cn("h-6 w-6", viewMode === 'contacts' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className={cn("text-[10px]", viewMode === 'contacts' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Contacts
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('keypad')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <Grid3x3 className={cn("h-6 w-6", viewMode === 'keypad' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className={cn("text-[10px]", viewMode === 'keypad' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Keypad
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('search')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <Search className={cn("h-6 w-6", viewMode === 'search' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className="text-[10px] text-transparent">.</span>
                  </button>
                </div>
              </div>
            ) : viewMode === 'contacts' || viewMode === 'search' ? (
              /* Contacts/Search Screen - Empty State */
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
                
                {/* Bottom Navigation */}
                <div className="border-t border-border px-4 py-2 flex items-center justify-around bg-background h-[60px] flex-shrink-0">
                  <button
                    onClick={() => setViewMode('calls')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <div className="relative">
                      <Phone className={cn("h-6 w-6", viewMode === 'calls' ? "text-blue-500" : "text-muted-foreground")} />
                      {callHistory.filter(c => c.status === 'missed').length > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          <span className="text-white text-[10px] font-semibold">
                            {callHistory.filter(c => c.status === 'missed').length}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={cn("text-[10px]", viewMode === 'calls' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Calls
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('contacts')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <User className={cn("h-6 w-6", viewMode === 'contacts' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className={cn("text-[10px]", viewMode === 'contacts' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Contacts
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('keypad')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <Grid3x3 className={cn("h-6 w-6", viewMode === 'keypad' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className={cn("text-[10px]", viewMode === 'keypad' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Keypad
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('search')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <Search className={cn("h-6 w-6", viewMode === 'search' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className="text-[10px] text-transparent">.</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Dialpad Screen */
              <div className="flex-1 flex flex-col">
                {/* Dialpad Content */}
                <div className="flex-1 overflow-y-auto flex flex-col justify-between py-4 px-6">
                  {/* Number Display */}
                  <div className="text-center py-3">
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
                      className="w-full bg-transparent border-none text-foreground text-2xl text-center focus:outline-none font-normal"
                      placeholder=""
                      data-testid="input-dial-number"
                      autoComplete="off"
                    />
                  </div>
                  
                  {/* Dialpad Grid */}
                  <div className="grid grid-cols-3 gap-3 px-2">
                    {digits.map((digit, index) => (
                      <button
                        key={digit}
                        onClick={() => handleDial(digit)}
                        className="w-20 h-20 mx-auto rounded-full bg-muted/40 hover:bg-muted/60 flex flex-col items-center justify-center transition-all active:scale-95 shadow-sm"
                        data-testid={`button-dialpad-${digit}`}
                      >
                        <span className="text-3xl text-foreground font-normal">
                          {digit}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium h-[14px]">
                          {letters[index] || '\u00A0'}
                        </span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Bottom Row - Call and Delete Buttons */}
                  <div className="grid grid-cols-3 gap-3 px-2 py-3">
                    <div></div>
                    <button
                      onClick={handleCall}
                      disabled={!dialNumber || connectionStatus !== 'connected'}
                      className={cn(
                        "w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                        dialNumber && connectionStatus === 'connected'
                          ? "bg-green-500 hover:bg-green-600" 
                          : "bg-green-500/40 cursor-not-allowed"
                      )}
                    >
                      <Phone className="h-7 w-7 text-white" />
                    </button>
                    
                    {dialNumber ? (
                      <button
                        onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                        className="w-20 h-20 mx-auto rounded-full hover:bg-muted/30 flex items-center justify-center transition-all active:scale-95"
                      >
                        <Delete className="h-6 w-6 text-foreground" />
                      </button>
                    ) : (
                      <div></div>
                    )}
                  </div>
                </div>
                
                {/* Bottom Navigation */}
                <div className="border-t border-border px-4 py-2 flex items-center justify-around bg-background h-[60px] flex-shrink-0">
                  <button
                    onClick={() => setViewMode('calls')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <div className="relative">
                      <Phone className={cn("h-6 w-6", viewMode === 'calls' ? "text-blue-500" : "text-muted-foreground")} />
                      {callHistory.filter(c => c.status === 'missed').length > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          <span className="text-white text-[10px] font-semibold">
                            {callHistory.filter(c => c.status === 'missed').length}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={cn("text-[10px]", viewMode === 'calls' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Calls
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('contacts')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <User className={cn("h-6 w-6", viewMode === 'contacts' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className={cn("text-[10px]", viewMode === 'contacts' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Contacts
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('keypad')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <Grid3x3 className={cn("h-6 w-6", viewMode === 'keypad' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className={cn("text-[10px]", viewMode === 'keypad' ? "text-blue-500 font-medium" : "text-muted-foreground")}>
                      Keypad
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setViewMode('search')}
                    className="flex flex-col items-center gap-0.5 py-1 px-2"
                  >
                    <Search className={cn("h-6 w-6", viewMode === 'search' ? "text-blue-500" : "text-muted-foreground")} />
                    <span className="text-[10px] text-transparent">.</span>
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
}
