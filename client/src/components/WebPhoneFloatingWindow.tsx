import { useState, useRef, useEffect, useMemo } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X, Grid3x3, Volume2, UserPlus, User, PhoneIncoming, PhoneOutgoing, Users, Voicemail, Menu, Delete, Clock, Circle, PhoneForwarded, PhoneMissed, ChevronDown, Check, Search, ShoppingBag, ExternalLink, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatPhoneInput } from '@shared/phone';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

function formatCallerNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length >= 3 && digits.length <= 4) {
    return `Ext. ${digits}`;
  }
  return formatPhoneInput(phoneNumber);
}

type ViewMode = 'recents' | 'contacts' | 'keypad' | 'voicemail';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

interface ContactsViewProps {
  setDialNumber: (number: string) => void;
  setViewMode: (mode: ViewMode) => void;
}

function ContactsView({ setDialNumber, setViewMode }: ContactsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch unified contacts (only those with phone numbers)
  const { data: contactsData } = useQuery({
    queryKey: ['/api/contacts/list'],
  });
  
  // Transform contacts into the format we need
  const allContacts = useMemo(() => {
    if (!contactsData?.contacts) return [];
    
    const contacts: Contact[] = contactsData.contacts.map((contact: any) => ({
      id: contact.id,
      name: contact.displayName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
      phoneNumber: contact.phoneNormalized || contact.phoneDisplay || ''
    })).filter((c: Contact) => c.phoneNumber);
    
    // Sort by name
    return contacts.sort((a, b) => a.name.localeCompare(b.name));
  }, [contactsData]);
  
  // Filter contacts based on search
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return allContacts;
    
    const query = searchQuery.toLowerCase();
    return allContacts.filter(contact => 
      contact.name.toLowerCase().includes(query) ||
      contact.phoneNumber.includes(query)
    );
  }, [allContacts, searchQuery]);
  
  const handleCallContact = (phoneNumber: string) => {
    setDialNumber(phoneNumber);
    setViewMode('keypad');
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="px-2 sm:px-4 py-2 sm:py-3 flex-shrink-0 space-y-2">
        <h2 className="text-base sm:text-lg font-semibold text-foreground text-center">Contacts</h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 sm:h-9 text-xs sm:text-sm"
            data-testid="input-search-contacts"
          />
        </div>
      </div>
      
      {/* Contacts list */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6">
            <User className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-2 sm:mb-3" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery ? 'No contacts found' : 'No contacts'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredContacts.map((contact) => {
              const initials = contact.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
              
              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-2 px-2 sm:px-4 py-1.5 sm:py-2 hover:bg-muted/30 transition-colors"
                  data-testid={`contact-${contact.id}`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">{initials}</span>
                  </div>
                  
                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-normal truncate text-foreground mb-0.5">
                      {contact.name}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      {formatCallerNumber(contact.phoneNumber)}
                    </div>
                  </div>
                  
                  {/* Call button */}
                  <button
                    onClick={() => handleCallContact(contact.phoneNumber)}
                    className="text-blue-500 hover:opacity-80 transition-opacity"
                    data-testid={`button-call-contact-${contact.id}`}
                  >
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
  const [callFilter, setCallFilter] = useState<'all' | 'missed' | 'answered'>('all');
  const windowRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const dialInputRef = useRef<HTMLInputElement>(null);
  
  const isVisible = useWebPhoneStore(state => state.dialpadVisible);
  const connectionStatus = useWebPhoneStore(state => state.connectionStatus);
  const currentCall = useWebPhoneStore(state => state.currentCall);
  const waitingCall = useWebPhoneStore(state => state.waitingCall);
  const consultationCall = useWebPhoneStore(state => state.consultationCall);
  const callerInfo = useWebPhoneStore(state => state.callerInfo);
  const isMuted = useWebPhoneStore(state => state.isMuted);
  const isOnHold = useWebPhoneStore(state => state.isOnHold);
  const isRecording = useWebPhoneStore(state => state.isRecording);
  const sipExtension = useWebPhoneStore(state => state.sipExtension);
  const callHistory = useWebPhoneStore(state => state.callHistory);
  const toggleDialpad = useWebPhoneStore(state => state.toggleDialpad);
  const setAudioElements = useWebPhoneStore(state => state.setAudioElements);
  const clearCallHistory = useWebPhoneStore(state => state.clearCallHistory);
  const deleteCallsFromHistory = useWebPhoneStore(state => state.deleteCallsFromHistory);

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
  
  // Debug callerInfo changes
  useEffect(() => {
    console.log('[WebPhone UI] CallerInfo changed:', callerInfo);
    console.log('[WebPhone UI] Current call:', currentCall);
    if (currentCall) {
      console.log('[WebPhone UI] Current call displayName:', currentCall.displayName);
      console.log('[WebPhone UI] Current call phoneNumber:', currentCall.phoneNumber);
    }
  }, [callerInfo, currentCall]);
  
  // Auto-open window when incoming call arrives
  useEffect(() => {
    if (currentCall && currentCall.status === 'ringing' && currentCall.direction === 'inbound') {
      if (!isVisible) {
        toggleDialpad();
      }
    }
  }, [currentCall, isVisible, toggleDialpad]);
  
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
  
  // Return to keypad when call ends and clear dial number
  useEffect(() => {
    if (!currentCall) {
      setViewMode('keypad');
      setDialNumber('');
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
    
    // Don't format if 3 or fewer digits (extensions like 301)
    if (limitedDigits.length <= 3) return limitedDigits;
    
    // Format only after 4th digit
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
  
  // Filter calls based on selected filter
  const filteredCallHistory = callHistory.filter(call => {
    if (callFilter === 'all') return true;
    if (callFilter === 'missed') return call.status === 'missed';
    if (callFilter === 'answered') return call.status === 'answered' || call.status === 'ended';
    return true;
  });
  
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
  
  // Edit mode handlers
  const handleToggleEdit = () => {
    setIsEditMode(!isEditMode);
    setSelectedCallIds(new Set());
  };
  
  const handleToggleSelectAll = () => {
    if (selectedCallIds.size === filteredCallHistory.length) {
      setSelectedCallIds(new Set());
    } else {
      setSelectedCallIds(new Set(filteredCallHistory.map(c => c.id)));
    }
  };
  
  const handleToggleCallSelection = (callId: string) => {
    const newSelection = new Set(selectedCallIds);
    if (newSelection.has(callId)) {
      newSelection.delete(callId);
    } else {
      newSelection.add(callId);
    }
    setSelectedCallIds(newSelection);
  };
  
  const handleDeleteSelected = () => {
    deleteCallsFromHistory(Array.from(selectedCallIds));
    setSelectedCallIds(new Set());
    setIsEditMode(false);
  };
  
  const handleClearAll = () => {
    clearCallHistory();
    setSelectedCallIds(new Set());
    setIsEditMode(false);
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
          <div className="flex flex-col">
            {sipExtension ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-foreground font-medium text-xs sm:text-sm">Ext: {sipExtension}</span>
                <div className={cn(
                  "h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full",
                  connectionStatus === 'connected' ? "bg-green-500" : "bg-red-500"
                )} />
              </div>
            ) : (
              <>
                <span className="text-foreground font-semibold text-xs sm:text-sm">Calling From</span>
                <span className="text-muted-foreground text-[10px] sm:text-xs">Purchase Phone number to select</span>
              </>
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
          {/* No Phone Account Screen */}
          {!sipExtension ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-8 text-center">
              {/* Shopping Bag Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <ShoppingBag className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
              </div>
              
              {/* Title */}
              <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
                Purchase Phone numbers to Call
              </h2>
              
              {/* Purchase Button */}
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full flex items-center gap-2"
                onClick={() => window.open('https://telnyx.com/pricing', '_blank')}
                data-testid="button-purchase-phone"
              >
                <ShoppingBag className="h-4 w-4" />
                Purchase Now
                <ExternalLink className="h-4 w-4" />
              </Button>
              
              {/* Divider */}
              <div className="flex items-center w-full my-6">
                <div className="flex-1 border-t border-border" />
                <span className="px-4 text-sm text-muted-foreground">Or</span>
                <div className="flex-1 border-t border-border" />
              </div>
              
              {/* Transfer Option */}
              <p className="text-sm text-muted-foreground mb-3">
                Do you want transfer your number ?
              </p>
              
              <Button
                variant="outline"
                className="rounded-full flex items-center gap-2"
                onClick={() => window.open('https://telnyx.com/number-porting', '_blank')}
                data-testid="button-learn-more-transfer"
              >
                Learn More
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ) : currentCall ? (
              /* Active Call Screen - No bottom navigation */
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col justify-between p-3 sm:p-6 min-h-full">
                  {/* Contact Info */}
                  <div className="text-center pt-4 sm:pt-8">
                    <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-muted flex items-center justify-center mb-3 sm:mb-4">
                      <User className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-medium text-foreground mb-1.5 sm:mb-2">
                      {currentCall.displayName || "Unknown Caller"}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground mb-1">
                      {formatCallerNumber(currentCall.phoneNumber)}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {currentCall.status === 'ringing' && currentCall.direction === 'inbound' && 'Incoming call...'}
                      {currentCall.status === 'ringing' && currentCall.direction === 'outbound' && 'Calling...'}
                      {currentCall.status === 'answered' && formatDuration(callDuration)}
                    </p>
                  </div>
                  
                  {/* Waiting Call Banner */}
                  {waitingCall && (
                    <div className="px-2 sm:px-4 pb-3">
                      <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900 rounded-lg p-3 animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300">
                              Llamada en Espera
                            </p>
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                              {waitingCall.displayName || "Unknown Caller"} · {formatCallerNumber(waitingCall.phoneNumber)}
                            </p>
                          </div>
                          <PhoneIncoming className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 ml-2" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Call Controls */}
                  <div className="space-y-3 sm:space-y-4 pb-4 sm:pb-8">
                    {currentCall.status === 'ringing' && currentCall.direction === 'inbound' ? (
                      /* Incoming Call - Show Accept/Reject Buttons */
                      <div className="grid grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-8">
                        <button
                          onClick={() => webPhone.answerCall()}
                          className="flex flex-col items-center gap-2 sm:gap-3 transition-all active:scale-95"
                          data-testid="button-accept-call"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg">
                            <Phone className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                          </div>
                          <span className="text-sm sm:text-base text-foreground font-medium">Accept</span>
                        </button>
                        
                        <button
                          onClick={() => webPhone.rejectCall()}
                          className="flex flex-col items-center gap-2 sm:gap-3 transition-all active:scale-95"
                          data-testid="button-reject-call"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg">
                            <PhoneOff className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                          </div>
                          <span className="text-sm sm:text-base text-foreground font-medium">Reject</span>
                        </button>
                      </div>
                    ) : consultationCall ? (
                      /* Consultation Call Active - Show Complete/Cancel Transfer Buttons */
                      <>
                        {/* Info Banner */}
                        <div className="px-2 sm:px-4">
                          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 text-center">
                              <span className="font-semibold">Consultation Call Active</span>
                              <br />
                              Talking to: {consultationCall.displayName}
                            </p>
                          </div>
                        </div>
                        
                        {/* Transfer Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 px-2 sm:px-4">
                          <Button
                            onClick={() => webPhone.completeAttendedTransfer()}
                            className="bg-green-600 hover:bg-green-700 text-white h-12"
                            data-testid="button-complete-transfer"
                          >
                            <Check className="h-5 w-5 mr-2" />
                            Complete Transfer
                          </Button>
                          
                          <Button
                            onClick={() => webPhone.cancelAttendedTransfer()}
                            variant="outline"
                            className="h-12 border-2"
                            data-testid="button-cancel-transfer"
                          >
                            <X className="h-5 w-5 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : waitingCall ? (
                      /* Call Waiting Active - Show Swap/Answer Buttons */
                      <>
                        {/* Waiting Call Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 px-2 sm:px-4">
                          <Button
                            onClick={() => webPhone.swapCalls()}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-12"
                            data-testid="button-swap-calls"
                          >
                            <Users className="h-5 w-5 mr-2" />
                            Swap Calls
                          </Button>
                          
                          <Button
                            onClick={() => webPhone.answerWaitingCall()}
                            className="bg-green-600 hover:bg-green-700 text-white h-12"
                            data-testid="button-answer-waiting"
                          >
                            <PhoneIncoming className="h-5 w-5 mr-2" />
                            Answer
                          </Button>
                        </div>
                        
                        {/* Basic Controls Row */}
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
                      </>
                    ) : (
                      /* Normal Call Controls - 3 buttons */
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
                    )}
                    
                    {/* End Call Button - Only show when call is answered or outbound ringing */}
                    {!(currentCall.status === 'ringing' && currentCall.direction === 'inbound') && (
                      <div className="flex justify-center pt-3 sm:pt-6">
                        <button
                          onClick={() => webPhone.hangupCall()}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                        >
                          <PhoneOff className="h-7 w-7 sm:h-9 sm:w-9 text-white" />
                        </button>
                      </div>
                    )}
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
                        <button 
                          onClick={handleToggleEdit}
                          className="text-sm sm:text-base text-blue-500"
                          data-testid="button-edit-recents"
                        >
                          {isEditMode ? 'Done' : 'Edit'}
                        </button>
                        <h2 className="text-base sm:text-lg font-semibold text-foreground">Recents</h2>
                        {isEditMode ? (
                          <button 
                            onClick={handleClearAll}
                            className="text-sm sm:text-base text-blue-500"
                            data-testid="button-clear-all"
                          >
                            Clear All
                          </button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="text-sm sm:text-base text-blue-500 flex items-center gap-1"
                                data-testid="button-filter-calls"
                              >
                                {callFilter === 'all' ? 'All' : callFilter === 'missed' ? 'Missed' : 'Answered'}
                                <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem 
                                onClick={() => setCallFilter('all')}
                                className="cursor-pointer"
                                data-testid="filter-all"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>All</span>
                                  {callFilter === 'all' && <Check className="h-4 w-4 text-blue-500" />}
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCallFilter('missed')}
                                className="cursor-pointer"
                                data-testid="filter-missed"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>Missed</span>
                                  {callFilter === 'missed' && <Check className="h-4 w-4 text-blue-500" />}
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCallFilter('answered')}
                                className="cursor-pointer"
                                data-testid="filter-answered"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span>Answered</span>
                                  {callFilter === 'answered' && <Check className="h-4 w-4 text-blue-500" />}
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      
                      {/* Call History List - Scrollable */}
                      {filteredCallHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6">
                          <Phone className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-2 sm:mb-3" />
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {callFilter === 'all' 
                              ? 'No recent calls' 
                              : callFilter === 'missed' 
                                ? 'No missed calls' 
                                : 'No answered calls'}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Select All Row - Only in Edit Mode */}
                          {isEditMode && (
                            <div 
                              onClick={handleToggleSelectAll}
                              className="flex items-center gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
                              data-testid="button-select-all"
                            >
                              <div 
                                className={cn(
                                  "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                  selectedCallIds.size === filteredCallHistory.length
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-muted-foreground"
                                )}
                              >
                                {selectedCallIds.size === filteredCallHistory.length && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                )}
                              </div>
                              <span className="text-xs sm:text-sm text-foreground">Select All</span>
                            </div>
                          )}
                          
                          <div className="divide-y divide-border">
                            {filteredCallHistory.map((call) => {
                              const initials = call.displayName 
                                ? call.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                : '';
                              const timeStr = format(new Date(call.startTime), 'h:mma');
                              const statusStyle = getCallStatusStyle(call.status);
                              const isSelected = selectedCallIds.has(call.id);
                              
                              return (
                                <div 
                                  key={call.id} 
                                  className="flex items-center gap-2 px-2 sm:px-4 py-1.5 sm:py-2 hover:bg-muted/30 transition-colors"
                                >
                                  {/* Checkbox - Only in Edit Mode */}
                                  {isEditMode && (
                                    <div 
                                      onClick={() => handleToggleCallSelection(call.id)}
                                      className={cn(
                                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors",
                                        isSelected
                                          ? "bg-blue-500 border-blue-500"
                                          : "border-muted-foreground"
                                      )}
                                      data-testid={`checkbox-call-${call.id}`}
                                    >
                                      {isSelected && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                      )}
                                    </div>
                                  )}
                                  
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
                                    <div className="mb-0.5">
                                      <span className={cn(
                                        "text-sm sm:text-base font-normal truncate",
                                        call.status === 'missed' ? statusStyle.color : 'text-foreground'
                                      )}>
                                        {call.displayName || "Unknown Caller"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                                      <span>{formatCallerNumber(call.phoneNumber)}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Time and Call Button */}
                                  {!isEditMode && (
                                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                      <span className="text-xs sm:text-sm text-muted-foreground">{timeStr}</span>
                                      <button
                                        onClick={() => {
                                          setViewMode('keypad');
                                          setDialNumber(call.phoneNumber);
                                        }}
                                        className="text-blue-500 hover:opacity-80 transition-opacity"
                                        data-testid={`button-call-${call.id}`}
                                      >
                                        <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                                      </button>
                                    </div>
                                  )}
                                  
                                  {/* Time Only in Edit Mode */}
                                  {isEditMode && (
                                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">{timeStr}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Delete Button - Only in Edit Mode with Selections - STICKY */}
                          {isEditMode && selectedCallIds.size > 0 && (
                            <div className="sticky bottom-0 bg-background border-t border-border px-2 sm:px-4 py-2 sm:py-3">
                              <button
                                onClick={handleDeleteSelected}
                                className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
                                data-testid="button-delete-selected"
                              >
                                Delete {selectedCallIds.size} {selectedCallIds.size === 1 ? 'call' : 'calls'}
                              </button>
                            </div>
                          )}
                        </>
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
                  
                  {viewMode === 'contacts' && (
                    <ContactsView setDialNumber={setDialNumber} setViewMode={setViewMode} />
                  )}
                  
                  {viewMode === 'voicemail' && (
                    /* Voicemail - Empty State */
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
