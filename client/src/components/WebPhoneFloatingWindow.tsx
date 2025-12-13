import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X, Grid3x3, Volume2, UserPlus, User, PhoneIncoming, PhoneOutgoing, Users, Voicemail, Menu, Delete, Clock, Circle, PhoneForwarded, PhoneMissed, ChevronDown, ChevronLeft, ChevronRight, Check, Search, ShoppingBag, ExternalLink, RefreshCw, MessageSquare, Loader2, Shield, MapPin, Square, Trash2, type LucideIcon } from 'lucide-react';
import { EmergencyAddressForm } from '@/components/EmergencyAddressForm';
import { cn } from '@/lib/utils';
import { useWebPhoneStore, webPhone } from '@/services/webphone';
import { telnyxWebRTC, useTelnyxStore } from '@/services/telnyx-webrtc';
import { useExtensionCall } from '@/hooks/useExtensionCall';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPhoneInput } from '@shared/phone';
import { format } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NetworkQualityMetrics } from '@/services/telnyx-webrtc';

// DTMF Keypad Component for in-call digit sending
interface DtmfKeypadProps {
  onSendDigit: (digit: string) => void;
  onClose: () => void;
}

function DtmfKeypad({ onSendDigit, onClose }: DtmfKeypadProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];
  
  const handleKeyPress = (key: string) => {
    setPressedKey(key);
    onSendDigit(key);
    
    // Play DTMF tone feedback
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // DTMF frequency pairs
      const dtmfFreqs: Record<string, [number, number]> = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
      };
      
      const [low, high] = dtmfFreqs[key] || [697, 1209];
      oscillator.type = 'sine';
      oscillator.frequency.value = (low + high) / 2;
      gainNode.gain.value = 0.1;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      // Silently fail if audio context not available
    }
    
    setTimeout(() => setPressedKey(null), 150);
  };
  
  return (
    <div className="bg-card rounded-lg p-4 shadow-lg border border-border">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-foreground">Keypad</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-full transition-colors"
          data-testid="button-close-dtmf"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.flat().map((key) => (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-full text-xl sm:text-2xl font-medium transition-all",
              "bg-muted hover:bg-muted/80 text-foreground shadow-sm",
              pressedKey === key && "scale-95 bg-primary text-primary-foreground"
            )}
            data-testid={`button-dtmf-${key === '*' ? 'star' : key === '#' ? 'hash' : key}`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

// Network Quality Indicator Component (Traffic Light)
interface NetworkQualityIndicatorProps {
  quality?: NetworkQualityMetrics;
}

function NetworkQualityIndicator({ quality }: NetworkQualityIndicatorProps) {
  if (!quality) return null;
  
  const getQualityColor = () => {
    switch (quality.qualityLevel) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getQualityLabel = () => {
    switch (quality.qualityLevel) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Fair';
      case 'poor': return 'Poor';
      default: return 'Unknown';
    }
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 cursor-help"
            data-testid="network-quality-indicator"
          >
            <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", getQualityColor())} />
            <span className="text-[10px] text-muted-foreground">{getQualityLabel()}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p>MOS: {quality.mos.toFixed(1)}</p>
            <p>Jitter: {quality.jitter.toFixed(0)}ms</p>
            <p>Packet Loss: {quality.packetLoss.toFixed(1)}%</p>
            {quality.rtt > 0 && <p>Latency: {quality.rtt.toFixed(0)}ms</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatCallerNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length >= 3 && digits.length <= 4) {
    return `Ext. ${digits}`;
  }
  return formatPhoneInput(phoneNumber);
}

type ViewMode = 'recents' | 'contacts' | 'keypad' | 'voicemail';

interface Voicemail {
  id: string;
  fromNumber: string;
  callerName?: string;
  duration: number;
  recordingUrl: string;
  transcription?: string;
  status: 'new' | 'read' | 'deleted';
  receivedAt: string;
}

interface VoicemailViewProps {
  voicemails: Voicemail[];
  unreadCount: number;
  refetchVoicemails: () => void;
}

function VoicemailView({ voicemails, unreadCount, refetchVoicemails }: VoicemailViewProps) {
  const { toast } = useToast();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/voicemails/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'read' })
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      refetchVoicemails();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/voicemails/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete voicemail');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Voicemail deleted" });
      refetchVoicemails();
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  });

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handlePlay = (voicemail: Voicemail) => {
    // Stop any currently playing audio
    if (playingId && playingId !== voicemail.id) {
      const prevAudio = audioRefs.current[playingId];
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      }
    }

    if (!audioRefs.current[voicemail.id]) {
      const audio = new Audio(voicemail.recordingUrl);
      audio.onended = () => {
        setPlayingId(null);
        setAudioProgress(prev => ({ ...prev, [voicemail.id]: 0 }));
      };
      audio.ontimeupdate = () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        setAudioProgress(prev => ({ ...prev, [voicemail.id]: progress }));
      };
      audioRefs.current[voicemail.id] = audio;
    }

    const audio = audioRefs.current[voicemail.id];
    
    if (playingId === voicemail.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.play();
      setPlayingId(voicemail.id);
      
      // Mark as read when played
      if (voicemail.status === 'new') {
        markAsReadMutation.mutate(voicemail.id);
      }
    }
  };

  if (!voicemails || voicemails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-12">
        <Voicemail className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No voicemails</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {unreadCount > 0 && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {unreadCount} new voicemail{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
      
      <div className="divide-y divide-border">
        {voicemails.map((vm) => (
          <div 
            key={vm.id} 
            className={cn(
              "px-4 py-3",
              vm.status === 'new' && "bg-blue-50/50 dark:bg-blue-900/10"
            )}
            data-testid={`voicemail-item-${vm.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium text-sm truncate",
                      vm.status === 'new' && "text-foreground font-semibold"
                    )}>
                      {vm.callerName || formatPhoneInput(vm.fromNumber)}
                    </span>
                    {vm.status === 'new' && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatRelativeTime(vm.receivedAt)}
                  </span>
                </div>
                
                {vm.callerName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {formatPhoneInput(vm.fromNumber)}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => handlePlay(vm)}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                      playingId === vm.id 
                        ? "bg-blue-500 text-white" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                    data-testid={`button-play-voicemail-${vm.id}`}
                  >
                    {playingId === vm.id ? (
                      <Square className="h-3 w-3" fill="currentColor" />
                    ) : (
                      <Play className="h-3 w-3 ml-0.5" fill="currentColor" />
                    )}
                  </button>
                  
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-100"
                        style={{ width: `${audioProgress[vm.id] || 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {formatDuration(vm.duration)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => deleteMutation.mutate(vm.id)}
                    disabled={deleteMutation.isPending}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                    data-testid={`button-delete-voicemail-${vm.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                {vm.transcription && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {vm.transcription}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

interface OnlineExtensionForContacts {
  extensionId: string;
  extension: string;
  displayName: string;
  status: "available" | "busy";
}

interface ContactsViewProps {
  setDialNumber: (number: string) => void;
  setViewMode: (mode: ViewMode) => void;
  onlineExtensions?: OnlineExtensionForContacts[];
  onCallExtension?: (extension: string, displayName: string) => void;
}

function ContactsView({ setDialNumber, setViewMode, onlineExtensions = [], onCallExtension }: ContactsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'contacts' | 'extensions'>('contacts');
  
  // Fetch unified contacts (only those with phone numbers)
  const { data: contactsData } = useQuery<{ contacts: any[] }>({
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
  
  // Filter extensions based on search
  const filteredExtensions = useMemo(() => {
    if (!searchQuery) return onlineExtensions;
    
    const query = searchQuery.toLowerCase();
    return onlineExtensions.filter(ext => 
      ext.displayName.toLowerCase().includes(query) ||
      ext.extension.includes(query)
    );
  }, [onlineExtensions, searchQuery]);
  
  const handleCallContact = (phoneNumber: string) => {
    setDialNumber(phoneNumber);
    setViewMode('keypad');
  };
  
  const handleCallExtension = (ext: OnlineExtensionForContacts) => {
    if (onCallExtension && ext.status === 'available') {
      onCallExtension(ext.extension, ext.displayName);
    }
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
        {/* Tab switcher for contacts vs extensions */}
        {onlineExtensions.length > 0 && (
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('contacts')}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-md transition-colors",
                activeTab === 'contacts' ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
              )}
              data-testid="tab-contacts"
            >
              Contacts
            </button>
            <button
              onClick={() => setActiveTab('extensions')}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-md transition-colors flex items-center justify-center gap-1",
                activeTab === 'extensions' ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
              )}
              data-testid="tab-extensions"
            >
              <Users className="h-3 w-3" />
              Extensions ({onlineExtensions.length})
            </button>
          </div>
        )}
      </div>
      
      {/* Content based on active tab */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'contacts' ? (
          /* Contacts list */
          filteredContacts.length === 0 ? (
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
          )
        ) : (
          /* Extensions list */
          filteredExtensions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6">
              <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-2 sm:mb-3" />
              <p className="text-xs sm:text-sm text-muted-foreground">
                {searchQuery ? 'No extensions found' : 'No extensions online'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredExtensions.map((ext) => {
                const initials = ext.displayName
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();
                
                return (
                  <div
                    key={ext.extensionId}
                    className="flex items-center gap-2 px-2 sm:px-4 py-1.5 sm:py-2 hover:bg-muted/30 transition-colors"
                    data-testid={`extension-${ext.extension}`}
                  >
                    {/* Avatar with status indicator */}
                    <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground">{initials}</span>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                        ext.status === 'available' ? "bg-green-500" : "bg-yellow-500"
                      )} />
                    </div>
                    
                    {/* Extension Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-normal truncate text-foreground mb-0.5">
                        {ext.displayName}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                        <span>Ext. {ext.extension}</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] uppercase font-medium",
                          ext.status === 'available' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        )}>
                          {ext.status}
                        </span>
                      </div>
                    </div>
                    
                    {/* Call button */}
                    <button
                      onClick={() => handleCallExtension(ext)}
                      disabled={ext.status === 'busy'}
                      className={cn(
                        "transition-opacity",
                        ext.status === 'available' ? "text-blue-500 hover:opacity-80" : "text-muted-foreground opacity-50 cursor-not-allowed"
                      )}
                      data-testid={`button-call-ext-${ext.extension}`}
                    >
                      <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface AvailablePhoneNumber {
  phone_number: string;
  record_type: string;
  phone_number_type?: string;
  best_effort: boolean;
  reservable: boolean;
  cost_information: {
    currency: string;
    monthly_cost: string;
    upfront_cost: string;
  };
  features: Array<{ name: string }>;
  region_information: Array<{
    region_name: string;
    region_type: string;
  }>;
}

interface BuyNumbersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNumberPurchased?: () => void;
}

type PurchaseStep = "search" | "provisioning" | "e911" | "complete";

interface PurchasedNumberInfo {
  phoneNumber: string;
  phoneNumberId: string;
  isProvisioning: boolean;
}

export function BuyNumbersDialog({ open, onOpenChange, onNumberPurchased }: BuyNumbersDialogProps) {
  const { toast } = useToast();
  const [countryCode, setCountryCode] = useState("US");
  const [numberType, setNumberType] = useState<string>("all");
  const [searchBy, setSearchBy] = useState<string>("area_code");
  const [searchValue, setSearchValue] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const NUMBERS_PER_PAGE = 50;
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("search");
  const [purchasedNumber, setPurchasedNumber] = useState<PurchasedNumberInfo | null>(null);

  const availableFeatures = [
    { value: "sms", label: "SMS" },
    { value: "mms", label: "MMS" },
    { value: "voice", label: "Voice" },
    { value: "fax", label: "Fax" },
  ];


  // Query for client pricing
  const { data: pricingData } = useQuery<{ localMonthly: number; tollfreeMonthly: number }>({ 
    queryKey: ["/api/telnyx/number-pricing"],
    staleTime: 60000,
  });

  // Format phone number for USA display: +12605551234 -> (260) 555-1234
  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const areaCode = cleaned.slice(1, 4);
      const exchange = cleaned.slice(4, 7);
      const subscriber = cleaned.slice(7, 11);
      return `(${areaCode}) ${exchange}-${subscriber}`;
    }
    if (cleaned.length === 10) {
      const areaCode = cleaned.slice(0, 3);
      const exchange = cleaned.slice(3, 6);
      const subscriber = cleaned.slice(6, 10);
      return `(${areaCode}) ${exchange}-${subscriber}`;
    }
    return phone;
  };

  // Get client price based on number type
  const getClientPrice = (number: AvailablePhoneNumber): string => {
    const isTollfree = number.phone_number_type === "toll_free" || number.record_type === "tollfree";
    const price = isTollfree ? (pricingData?.tollfreeMonthly ?? 1.50) : (pricingData?.localMonthly ?? 1.00);
    return price.toFixed(2);
  };

  const { data: numbersData, isLoading, refetch } = useQuery<{ 
    numbers: AvailablePhoneNumber[]; 
    totalCount?: number;
    currentPage?: number;
    totalPages?: number;
    pageSize?: number;
  }>({
    queryKey: ['/api/telnyx/available-numbers', currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('country_code', countryCode);
      params.append('limit', String(NUMBERS_PER_PAGE));
      
      if (numberType && numberType !== "all") {
        params.append('phone_number_type', numberType);
      }
      
      if (searchValue) {
        switch (searchBy) {
          case "area_code":
            params.append('area_code', searchValue);
            break;
          case "starts_with":
            params.append('starts_with', searchValue);
            break;
          case "ends_with":
            params.append('ends_with', searchValue);
            break;
          case "contains":
            params.append('contains', searchValue);
            break;
          case "city":
            params.append('locality', searchValue);
            break;
          case "state":
            params.append('administrative_area', searchValue);
            break;
        }
      }
      
      if (selectedFeatures.length > 0) {
        params.append('features', selectedFeatures.join(','));
      }
      
      // Add pagination parameter
      params.append('page', String(currentPage));
      
      const res = await fetch(`/api/telnyx/available-numbers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch numbers');
      return res.json();
    },
    enabled: searchTriggered && open,
  });

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) 
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const purchaseMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return apiRequest("POST", "/api/telnyx/purchase-number", { phoneNumber });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/telnyx/my-numbers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/telnyx/numbers'] });
      
      const phoneNumberId = data.phoneNumberId;
      const hasValidId = phoneNumberId && phoneNumberId.length > 10;
      
      if (hasValidId) {
        toast({ title: "Number Purchased", description: "Now let's set up your emergency address (E911)." });
        setPurchasedNumber({
          phoneNumber: selectedNumber!,
          phoneNumberId: phoneNumberId,
          isProvisioning: false,
        });
        setPurchaseStep("e911");
      } else {
        // Number is still being provisioned
        toast({ title: "Number Purchased", description: "Your number is being provisioned. Please wait..." });
        setPurchasedNumber({
          phoneNumber: selectedNumber!,
          phoneNumberId: "",
          isProvisioning: true,
        });
        setPurchaseStep("provisioning");
      }
    },
    onError: (error: any) => {
      // Check if it's an insufficient funds error
      if (error.message?.includes("Insufficient") || error.insufficientFunds) {
        toast({ 
          title: "Insufficient Wallet Balance", 
          description: "You need to add funds to your wallet before purchasing a number. Redirecting to billing...",
          variant: "destructive" 
        });
        // Redirect to billing page after short delay
        setTimeout(() => {
          window.location.href = "/billing";
        }, 2000);
      } else {
        toast({ 
          title: "Error", 
          description: error.message || "Failed to purchase number",
          variant: "destructive" 
        });
      }
    },
  });
  
  // Mutation to check if number is ready
  const checkNumberReadyMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch(`/api/telnyx/my-numbers`);
      if (!res.ok) throw new Error("Failed to fetch numbers");
      const data = await res.json();
      const foundNumber = data.numbers?.find((n: any) => n.phone_number === phoneNumber);
      if (foundNumber?.id) {
        return { phoneNumberId: foundNumber.id };
      }
      throw new Error("Number not ready yet");
    },
    onSuccess: (data: any) => {
      if (data.phoneNumberId && purchasedNumber) {
        toast({ title: "Ready!", description: "Your number is now ready. Let's set up the emergency address." });
        setPurchasedNumber({
          ...purchasedNumber,
          phoneNumberId: data.phoneNumberId,
          isProvisioning: false,
        });
        setPurchaseStep("e911");
      }
    },
    onError: () => {
      toast({ 
        title: "Still Provisioning", 
        description: "Your number is still being set up. Please wait a few seconds and try again.",
        variant: "destructive" 
      });
    },
  });

  const handleSearch = () => {
    setCurrentPage(1);
    setSearchTriggered(true);
    refetch();
  };

  const selectNumber = (phoneNumber: string) => {
    setSelectedNumber(prev => prev === phoneNumber ? null : phoneNumber);
  };

  const handlePurchase = () => {
    if (!selectedNumber) return;
    purchaseMutation.mutate(selectedNumber);
  };

  const resetDialogState = () => {
    setPurchaseStep("search");
    setPurchasedNumber(null);
    setSelectedNumber(null);
    setSearchTriggered(false);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetDialogState();
    }
    onOpenChange(open);
  };

  const handleE911Success = () => {
    toast({ title: "Setup Complete", description: "Your phone number is now fully configured with E911." });
    queryClient.invalidateQueries({ queryKey: ['/api/telnyx/my-numbers'] });
    onNumberPurchased?.();
    resetDialogState();
    onOpenChange(false);
  };

  const handleE911Cancel = () => {
    // User cancelled E911 setup - number is purchased but without E911
    toast({ 
      title: "E911 Setup Skipped", 
      description: "Warning: Your number doesn't have emergency services configured. You can set this up later.",
      variant: "destructive"
    });
    onNumberPurchased?.();
    resetDialogState();
    onOpenChange(false);
  };

  const getCapabilityBadges = (features: Array<{ name: string }>) => {
    const featureLabels: Record<string, string> = {
      'sms': 'SMS',
      'mms': 'MMS',
      'voice': 'Voice',
      'fax': 'Fax',
      'emergency': 'E911',
      'e911': 'E911',
      'local_calling': 'Local',
      'hd_voice': 'HD Voice',
    };
    
    const featureOrder = ['sms', 'mms', 'voice', 'fax', 'emergency', 'e911', 'local_calling', 'hd_voice'];
    
    const sortedFeatures = [...features]
      .filter(f => f.name !== 'international_sms')
      .sort((a, b) => {
        const aIdx = featureOrder.indexOf(a.name);
        const bIdx = featureOrder.indexOf(b.name);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    
    return (
      <div className="flex flex-wrap gap-1">
        {sortedFeatures.map((feature, idx) => {
          const label = featureLabels[feature.name] || feature.name.replace(/_/g, ' ');
          return (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border"
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  };

  const formatNumberType = (type: string | undefined): string => {
    if (!type) return 'Local';
    const typeMap: Record<string, string> = {
      'local': 'Local',
      'toll_free': 'Toll-Free',
      'tollfree': 'Toll-Free',
      'national': 'National',
      'mobile': 'Mobile',
      'shared_cost': 'Shared Cost',
      'available_phone_number': 'Local',
    };
    return typeMap[type.toLowerCase()] || type.replace(/_/g, ' ');
  };

  const getRegionInfo = (regionInfo: Array<{ region_name: string; region_type: string }>, countryCode: string) => {
    if (!regionInfo || regionInfo.length === 0) {
      return countryCode || '-';
    }
    
    const typeOrder = ['rate_center', 'locality', 'city', 'administrative_area', 'state', 'country_code', 'country'];
    
    const sortedRegions = [...regionInfo].sort((a, b) => {
      const aIdx = typeOrder.indexOf(a.region_type);
      const bIdx = typeOrder.indexOf(b.region_type);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
    
    const parts: string[] = [];
    const seenNames = new Set<string>();
    
    for (const region of sortedRegions) {
      if (!region.region_name) continue;
      
      const name = region.region_name.trim();
      const nameLower = name.toLowerCase();
      
      if (seenNames.has(nameLower)) continue;
      if (region.region_type === 'country_code' && (name === 'US' || name === 'USA' || name === countryCode)) continue;
      if (region.region_type === 'country' && (name === 'United States' || name === 'USA')) continue;
      
      seenNames.add(nameLower);
      parts.push(name);
    }
    
    return parts.length > 0 ? parts.join(', ') : (countryCode || '-');
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogTitle className="sr-only">Buy Phone Number</DialogTitle>
        <DialogDescription className="sr-only">Search and purchase a phone number</DialogDescription>
        
        {/* Provisioning Step - Wait for number to be ready */}
        {purchaseStep === "provisioning" && purchasedNumber && (
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Provisioning Your Number</h2>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                Your number <span className="font-medium">{purchasedNumber.phoneNumber}</span> has been purchased and is being set up. This usually takes a few seconds.
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={() => checkNumberReadyMutation.mutate(purchasedNumber.phoneNumber)}
                  disabled={checkNumberReadyMutation.isPending}
                  data-testid="button-check-number-ready"
                >
                  {checkNumberReadyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check if Ready
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleE911Cancel}
                  data-testid="button-skip-e911"
                >
                  Skip E911 Setup
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                You can also set up E911 later from your phone settings.
              </p>
            </div>
          </div>
        )}
        
        {/* E911 Step - Show EmergencyAddressForm */}
        {purchaseStep === "e911" && purchasedNumber && (
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-foreground">Emergency Address (E911)</h2>
                  <p className="text-sm text-muted-foreground">
                    For {purchasedNumber.phoneNumber} - This address will be sent to emergency services if you call 911.
                  </p>
                </div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span><strong>Important:</strong> Enter the physical address where this phone will be used. This information is critical for emergency responders.</span>
                </p>
              </div>
            </div>
            <EmergencyAddressForm
              phoneNumberId={purchasedNumber.phoneNumberId}
              phoneNumber={purchasedNumber.phoneNumber}
              onSuccess={handleE911Success}
              onCancel={handleE911Cancel}
            />
          </div>
        )}
        
        {/* Search Step - Original content */}
        {purchaseStep === "search" && (
          <>
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Buy your Number</h2>
            <p className="text-sm text-muted-foreground">
              You need to complete few easy steps to get started with new number.{' '}
              <span className="text-muted-foreground">
                Pricing varies by number type and location.
              </span>
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="grid grid-cols-6 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Country</label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Features</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal" data-testid="select-features">
                    {selectedFeatures.length === 0 ? "All features" : `${selectedFeatures.length} selected`}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                  {availableFeatures.map((feature) => (
                    <DropdownMenuItem
                      key={feature.value}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleFeature(feature.value);
                      }}
                      className="cursor-pointer"
                    >
                      <div className={cn(
                        "w-4 h-4 border rounded mr-2 flex items-center justify-center",
                        selectedFeatures.includes(feature.value) ? "bg-primary border-primary" : "border-input"
                      )}>
                        {selectedFeatures.includes(feature.value) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      {feature.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={numberType} onValueChange={setNumberType}>
                <SelectTrigger data-testid="select-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="toll_free">Toll-free</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Search By</label>
              <Select value={searchBy} onValueChange={setSearchBy}>
                <SelectTrigger data-testid="select-search-by">
                  <SelectValue placeholder="Area code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area_code">Area code</SelectItem>
                  <SelectItem value="starts_with">Starts with</SelectItem>
                  <SelectItem value="ends_with">Ends with</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {searchBy === "area_code" ? "Area Code" : searchBy === "city" ? "City Name" : searchBy === "state" ? "State" : "Value"}
              </label>
              <Input
                placeholder={searchBy === "area_code" ? "e.g. 305" : searchBy === "city" ? "e.g. Miami" : searchBy === "state" ? "e.g. FL" : "Enter value"}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                data-testid="input-search-value"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground invisible">Action</label>
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full gap-2"
                data-testid="button-search-numbers"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {!searchTriggered ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Use the filters above and click "Search" to find available numbers
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-3" />
              <p className="text-muted-foreground">Searching numbers...</p>
            </div>
          ) : numbersData?.numbers && numbersData.numbers.length > 0 ? (
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Location/Rate Center</th>
                  <th className="px-4 py-3 font-medium">Number Type</th>
                  <th className="px-4 py-3 font-medium">Features</th>
                  <th className="px-4 py-3 font-medium text-right">Monthly Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {numbersData.numbers.map((number) => {
                  const isSelected = selectedNumber === number.phone_number;
                  return (
                    <tr
                      key={number.phone_number}
                      onClick={() => selectNumber(number.phone_number)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected ? "bg-blue-50 dark:bg-blue-950/50" : "hover:bg-muted/30"
                      )}
                      data-testid={`number-row-${number.phone_number}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-blue-500 border-blue-500" : "border-muted-foreground"
                          )}>
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className="font-medium font-mono text-sm">{formatPhoneNumber(number.phone_number)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">{getRegionInfo(number.region_information, countryCode)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm capitalize">{formatNumberType(number.phone_number_type || number.record_type)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {getCapabilityBadges(number.features)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">${getClientPrice(number)}/mo</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No numbers found for this area code</p>
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="px-6 py-4 border-t border-border bg-background">
          {/* Results info and Pagination Controls */}
          {numbersData?.numbers && numbersData.numbers.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-3">
              {numbersData.totalPages && numbersData.totalPages > 1 ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {numbersData.currentPage || currentPage} of {numbersData.totalPages}
                    {numbersData.totalCount && ` (${numbersData.totalCount.toLocaleString()} total)`}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(numbersData.totalPages || prev, prev + 1))}
                    disabled={currentPage >= (numbersData.totalPages || 1) || isLoading}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Showing {numbersData.numbers.length} numbers
                  {numbersData.totalCount && numbersData.totalCount > numbersData.numbers.length && 
                    ` of ${numbersData.totalCount.toLocaleString()} total`}
                </span>
              )}
            </div>
          )}
          
          {/* Purchase Controls */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedNumber ? "1 Number selected" : "No number selected"}
            </span>
            <Button
              onClick={handlePurchase}
              disabled={!selectedNumber || purchaseMutation.isPending}
              className="bg-blue-500 hover:bg-blue-600 gap-2"
              data-testid="button-proceed-to-buy"
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Purchasing...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Proceed to Buy
                </>
              )}
            </Button>
          </div>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  const { toast } = useToast();
  
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
  const [showBuyNumbers, setShowBuyNumbers] = useState(false);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  const [transferTab, setTransferTab] = useState<'blind' | 'attended'>('blind');
  const [attendedTransferNumber, setAttendedTransferNumber] = useState('');
  const [telnyxCallerName, setTelnyxCallerName] = useState<string | null>(null);
  const [telnyxCallerLookupPhone, setTelnyxCallerLookupPhone] = useState<string | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const dialInputRef = useRef<HTMLInputElement>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
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
  
  // Mutation to sync call history from Telnyx CDRs
  const syncCallsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/call-logs/sync");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      toast({ 
        title: "Sync Complete", 
        description: `Synced ${data.synced || 0} new call records from provider.`,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync Failed", 
        description: error.message || "Failed to sync call history",
        variant: "destructive" 
      });
    },
  });

  // Query for Telnyx phone numbers
  const { data: telnyxNumbersData } = useQuery<{ numbers: any[] }>({
    queryKey: ['/api/telnyx/my-numbers'],
  });
  
  const hasTelnyxNumber = (telnyxNumbersData?.numbers?.length || 0) > 0;
  const primaryTelnyxNumberId = telnyxNumbersData?.numbers?.[0]?.id;

  // Query for voice settings to check callerIdNameEnabled
  // Use array format to match phone-system.tsx invalidation pattern
  const { data: voiceSettingsData } = useQuery<{ callerIdNameEnabled?: boolean }>({
    queryKey: ["/api/telnyx/voice-settings", primaryTelnyxNumberId],
    queryFn: async () => {
      const res = await fetch(`/api/telnyx/voice-settings/${primaryTelnyxNumberId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch voice settings");
      return res.json();
    },
    enabled: !!primaryTelnyxNumberId,
  });
  const callerIdNameEnabled = voiceSettingsData?.callerIdNameEnabled ?? false;

  // Query for call logs from backend
  const { data: callLogsData, refetch: refetchCallLogs } = useQuery<{ logs: any[] }>({
    queryKey: ['/api/call-logs'],
  });
  const backendCallLogs = callLogsData?.logs || [];

  // Query for voicemails from backend
  const { data: voicemailsData, refetch: refetchVoicemails } = useQuery<{ voicemails: any[], unreadCount: number }>({
    queryKey: ['/api/voicemails'],
  });
  const voicemailList = voicemailsData?.voicemails || [];
  const voicemailUnreadCount = voicemailsData?.unreadCount || 0;
  const telnyxCallerIdNumber = telnyxNumbersData?.numbers?.[0]?.phone_number || telnyxNumbersData?.numbers?.[0]?.phoneNumber || '';
  
  // Query for PBX special extensions (IVR and queues)
  const { data: pbxSpecialExtensions } = useQuery<{ 
    ivrExtension: string | null; 
    queues: Array<{ id: string; extension: string; name: string }> 
  }>({
    queryKey: ['/api/pbx/special-extensions'],
    enabled: hasTelnyxNumber,
  });
  
  // Telnyx WebRTC state
  const telnyxConnectionStatus = useTelnyxStore(state => state.connectionStatus);
  const telnyxCurrentCall = useTelnyxStore(state => state.currentCall);
  const telnyxIncomingCall = useTelnyxStore(state => state.incomingCall);
  const telnyxOutgoingCall = useTelnyxStore(state => state.outgoingCall);
  const telnyxIsMuted = useTelnyxStore(state => state.isMuted);
  const telnyxIsOnHold = useTelnyxStore(state => state.isOnHold);
  const telnyxIsConsulting = useTelnyxStore(state => state.isConsulting);
  const telnyxNetworkQuality = useTelnyxStore(state => state.networkQuality);
  const telnyxCallActiveTimestamp = useTelnyxStore(state => state.callActiveTimestamp);
  // NEW: SipCallInfo from store for UI display (replaces SDK extraction)
  const telnyxCurrentCallInfo = useTelnyxStore(state => state.currentCallInfo);
  const telnyxIncomingCallInfo = useTelnyxStore(state => state.incomingCallInfo);
  const telnyxOutgoingCallInfo = useTelnyxStore(state => state.outgoingCallInfo);
  const telnyxIsAnswering = useTelnyxStore(state => state.isAnswering);
  const [telnyxInitialized, setTelnyxInitialized] = useState(false);
  const [telnyxCallDuration, setTelnyxCallDuration] = useState(0);
  const telnyxTimerRef = useRef<NodeJS.Timeout>();
  
  // Extension-to-Extension calling (internal WebRTC)
  const {
    connectionStatus: extConnectionStatus,
    myExtension: extMyExtension,
    onlineExtensions: extOnlineExtensions,
    currentExtCall,
    incomingExtCall,
    queueCall,
    isMuted: extIsMuted,
    connect: extConnect,
    startCall: extStartCall,
    answerCall: extAnswerCall,
    rejectCall: extRejectCall,
    endCall: extEndCall,
    toggleMute: extToggleMute,
    refreshOnlineExtensions: extRefreshOnlineExtensions,
    acceptQueueCall,
    rejectQueueCall,
  } = useExtensionCall();
  
  // Auto-connect to extension WebSocket when user has an extension
  useEffect(() => {
    if (sipExtension || hasTelnyxNumber || extMyExtension) {
      extConnect();
    }
  }, [sipExtension, hasTelnyxNumber, extMyExtension, extConnect]);
  
  // Timer for extension calls
  const [extCallDuration, setExtCallDuration] = useState(0);
  const extTimerRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (currentExtCall?.state === 'connected' && currentExtCall.answerTime) {
      const startTime = currentExtCall.answerTime.getTime();
      extTimerRef.current = setInterval(() => {
        setExtCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (extTimerRef.current) {
        clearInterval(extTimerRef.current);
        setExtCallDuration(0);
      }
    }
    return () => {
      if (extTimerRef.current) clearInterval(extTimerRef.current);
    };
  }, [currentExtCall?.state, currentExtCall?.answerTime]);
  
  // Audio refs for ringtone and ringback MP3 files
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize audio elements on mount
  useEffect(() => {
    ringtoneAudioRef.current = new Audio('/ringtone.mp3');
    ringtoneAudioRef.current.loop = true;
    ringbackAudioRef.current = new Audio('/ringback.mp3');
    ringbackAudioRef.current.loop = true;
    
    return () => {
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current = null;
      }
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    };
  }, []);
  
  // Play ringtone for incoming calls
  const playRingtone = useCallback(() => {
    try {
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.currentTime = 0;
        ringtoneAudioRef.current.play().catch(e => console.warn('[WebPhone] Ringtone play failed:', e));
      }
    } catch (e) {
      console.warn('[WebPhone] Ringtone playback failed:', e);
    }
  }, []);
  
  // Stop ringtone
  const stopRingtone = useCallback(() => {
    if (ringtoneAudioRef.current) {
      ringtoneAudioRef.current.pause();
      ringtoneAudioRef.current.currentTime = 0;
    }
  }, []);
  
  // Play ringback for outgoing calls
  const playRingback = useCallback(() => {
    try {
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.currentTime = 0;
        ringbackAudioRef.current.play().catch(e => console.warn('[WebPhone] Ringback play failed:', e));
      }
    } catch (e) {
      console.warn('[WebPhone] Ringback playback failed:', e);
    }
  }, []);
  
  // Stop ringback
  const stopRingback = useCallback(() => {
    if (ringbackAudioRef.current) {
      ringbackAudioRef.current.pause();
      ringbackAudioRef.current.currentTime = 0;
    }
  }, []);
  
  // Ringtone and auto-open effect for incoming calls (including queue calls)
  useEffect(() => {
    const hasIncomingCall = !!telnyxIncomingCall || !!incomingExtCall || !!queueCall;
    
    if (hasIncomingCall) {
      if (!isVisible) {
        toggleDialpad();
      }
      playRingtone();
    } else {
      stopRingtone();
    }
    
    return () => {
      stopRingtone();
    };
  }, [telnyxIncomingCall, incomingExtCall, queueCall, isVisible, toggleDialpad, playRingtone, stopRingtone]);
  
  // Ringback tone effect for outgoing calls (when dialing, before answer)
  useEffect(() => {
    // Play ringback ONLY when there's an outgoing call that hasn't been answered yet
    const hasOutgoingRinging = !!telnyxOutgoingCall && !telnyxCurrentCall && !telnyxIncomingCall;
    
    // For extension calls: play ringback when calling or ringing (before connected)
    const hasExtOutgoingRinging = !!currentExtCall && (currentExtCall.state === 'calling' || currentExtCall.state === 'ringing');
    
    const shouldPlayRingback = hasOutgoingRinging || hasExtOutgoingRinging;
    
    if (shouldPlayRingback) {
      playRingback();
    } else {
      stopRingback();
    }
    
    return () => {
      stopRingback();
    };
  }, [telnyxOutgoingCall, telnyxCurrentCall, telnyxIncomingCall, currentExtCall, playRingback, stopRingback]);
  
  // Check if phone is available (either SIP extension, Telnyx number, or PBX extension)
  const hasPhoneCapability = !!sipExtension || hasTelnyxNumber || !!extMyExtension;
  
  // Unified call state - detect Telnyx calls directly from store state
  // CRITICAL: This must NOT depend on hasTelnyxNumber query since that can be slow/stale
  // If there's a Telnyx call in the store (current, incoming, or outgoing), it's a Telnyx call
  const isTelnyxCall = !!(telnyxCurrentCall || telnyxIncomingCall || telnyxOutgoingCall);
  const isExtensionCall = !!(currentExtCall || incomingExtCall);
  
  // Build effective call object for UI rendering
  // Filter out default SDK caller names that aren't useful
  const isValidCallerName = (name: string | undefined | null): boolean => {
    if (!name) return false;
    // Case-insensitive comparison for invalid names
    const invalidNames = ['outbound call', 'unknown caller', 'unknown', ''];
    return !invalidNames.includes(name.trim().toLowerCase());
  };
  
  const effectiveCall = useMemo(() => {
    // Priority: Extension calls > Telnyx calls > SIP calls
    // Extension-to-extension calls (internal WebRTC)
    if (currentExtCall) {
      return {
        phoneNumber: `Ext. ${currentExtCall.remoteExtension}`,
        displayName: currentExtCall.remoteDisplayName,
        status: currentExtCall.state === 'connected' ? 'answered' : 'ringing',
        direction: 'outbound' as const,
        isTelnyx: false,
        isExtension: true,
      };
    }
    if (incomingExtCall) {
      return {
        phoneNumber: `Ext. ${incomingExtCall.callerExtension}`,
        displayName: incomingExtCall.callerDisplayName,
        status: 'ringing',
        direction: 'inbound' as const,
        isTelnyx: false,
        isExtension: true,
      };
    }
    
    // Telnyx PSTN calls
    // Use SipCallInfo from store for reliable caller info extraction
    // IMPORTANT: Only show caller name if callerIdNameEnabled is true (Caller ID Lookup setting)
    if (telnyxCurrentCall && telnyxCurrentCallInfo) {
      // Call is ACTIVE (answered) - show "In Call" UI with timer
      // Priority: 1) DB lookup name (always show), 2) SIP header name (only if callerIdNameEnabled)
      let displayName: string | null = null;
      if (telnyxCallerName) {
        // Always show name from DB (policies/contacts)
        displayName = telnyxCallerName;
      } else if (callerIdNameEnabled && isValidCallerName(telnyxCurrentCallInfo.callerName)) {
        // Only show SIP header name if Caller ID Lookup is enabled
        displayName = telnyxCurrentCallInfo.callerName || null;
      }
      return {
        phoneNumber: telnyxCurrentCallInfo.remoteCallerNumber || 'Unknown',
        displayName,
        status: 'answered', // currentCall means call is ACTIVE
        direction: telnyxCurrentCallInfo.direction || 'outbound',
        isTelnyx: true,
      };
    }
    if (telnyxOutgoingCall && telnyxOutgoingCallInfo) {
      // Outbound call is DIALING (not yet answered) - show "Calling..." UI, NO timer
      return {
        phoneNumber: telnyxOutgoingCallInfo.remoteCallerNumber || telnyxOutgoingCallInfo.destinationNumber || 'Unknown',
        displayName: null,
        status: 'ringing', // Use 'ringing' to show "Calling..." text
        direction: 'outbound',
        isTelnyx: true,
      };
    }
    if (telnyxIncomingCall && telnyxIncomingCallInfo) {
      // Inbound call is RINGING - show answer/reject buttons
      // Priority: 1) DB lookup name (always show), 2) SIP header name (only if callerIdNameEnabled)
      let displayName: string | null = null;
      if (telnyxCallerName) {
        // Always show name from DB (policies/contacts)
        displayName = telnyxCallerName;
      } else if (callerIdNameEnabled && isValidCallerName(telnyxIncomingCallInfo.callerName)) {
        // Only show SIP header name if Caller ID Lookup is enabled
        displayName = telnyxIncomingCallInfo.callerName || null;
      }
      console.log("[WebPhone UI] Incoming call displayName:", {
        dbName: telnyxCallerName,
        sipName: telnyxIncomingCallInfo.callerName,
        callerIdNameEnabled,
        finalDisplayName: displayName
      });
      return {
        phoneNumber: telnyxIncomingCallInfo.remoteCallerNumber || 'Unknown',
        displayName,
        status: 'ringing',
        direction: 'inbound',
        isTelnyx: true,
      };
    }
    // Fallback: if we have session but no callInfo (shouldn't happen)
    if (telnyxCurrentCall || telnyxOutgoingCall || telnyxIncomingCall) {
      console.warn("[WebPhone UI] Have Telnyx session but missing callInfo");
      return {
        phoneNumber: 'Unknown',
        displayName: null,
        status: telnyxCurrentCall ? 'answered' : 'ringing',
        direction: telnyxIncomingCall ? 'inbound' : 'outbound',
        isTelnyx: true,
      };
    }
    if (currentCall) {
      return { ...currentCall, isTelnyx: false, isExtension: false };
    }
    return null;
  }, [currentExtCall, incomingExtCall, telnyxCurrentCall, telnyxOutgoingCall, telnyxIncomingCall, telnyxCurrentCallInfo, telnyxOutgoingCallInfo, telnyxIncomingCallInfo, currentCall, telnyxCallerName, callerIdNameEnabled]);
  
  // Effective mute/hold state
  const effectiveMuted = isExtensionCall ? extIsMuted : (isTelnyxCall ? telnyxIsMuted : isMuted);
  const effectiveOnHold = isTelnyxCall ? telnyxIsOnHold : isOnHold;
  
  // Timer for Telnyx calls - only starts when call becomes active (not during ringing)
  useEffect(() => {
    if (telnyxCallActiveTimestamp) {
      // Calculate initial duration in case we're rejoining
      const initialDuration = Math.floor((Date.now() - telnyxCallActiveTimestamp) / 1000);
      setTelnyxCallDuration(initialDuration);
      
      telnyxTimerRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - telnyxCallActiveTimestamp) / 1000);
        setTelnyxCallDuration(duration);
      }, 1000);
    } else {
      if (telnyxTimerRef.current) {
        clearInterval(telnyxTimerRef.current);
        setTelnyxCallDuration(0);
      }
    }
    return () => {
      if (telnyxTimerRef.current) clearInterval(telnyxTimerRef.current);
    };
  }, [telnyxCallActiveTimestamp]);
  
  // Network quality metrics polling for Telnyx calls
  useEffect(() => {
    if (telnyxCurrentCall && (telnyxCurrentCall as any).state === 'active') {
      const qualityInterval = setInterval(() => {
        telnyxWebRTC.getCallQuality();
      }, 5000); // Poll every 5 seconds
      
      return () => clearInterval(qualityInterval);
    }
  }, [telnyxCurrentCall]);
  
  // Reset in-call keypad when call ends
  useEffect(() => {
    if (!effectiveCall) {
      setShowInCallKeypad(false);
    }
  }, [effectiveCall]);
  
  // Caller lookup for Telnyx inbound calls (CNAM + database)
  useEffect(() => {
    const performTelnyxCallerLookup = async (phoneNumber: string) => {
      if (!phoneNumber || phoneNumber === 'Unknown') return;
      
      // Skip if we already looked up this number
      if (telnyxCallerLookupPhone === phoneNumber && telnyxCallerName) return;
      
      setTelnyxCallerLookupPhone(phoneNumber);
      
      try {
        console.log('[Telnyx Caller Lookup] Looking up:', phoneNumber);
        const response = await fetch(`/api/caller-lookup/${encodeURIComponent(phoneNumber)}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Telnyx Caller Lookup] Result:', data);
          
          if (data.found && (data.clientFirstName || data.clientLastName)) {
            const name = `${data.clientFirstName || ''} ${data.clientLastName || ''}`.trim();
            setTelnyxCallerName(name);
            console.log('[Telnyx Caller Lookup] Found name:', name);
          }
        }
      } catch (error) {
        console.error('[Telnyx Caller Lookup] Error:', error);
      }
    };
    
    // Check for Telnyx inbound call using SipCallInfo (not session extraction)
    const callInfo = telnyxCurrentCallInfo || telnyxIncomingCallInfo;
    if (callInfo) {
      if (callInfo.direction === 'inbound' && callInfo.remoteCallerNumber) {
        performTelnyxCallerLookup(callInfo.remoteCallerNumber);
      }
    } else {
      // Reset when call ends
      setTelnyxCallerName(null);
      setTelnyxCallerLookupPhone(null);
    }
  }, [telnyxCurrentCallInfo, telnyxIncomingCallInfo, telnyxCallerLookupPhone, telnyxCallerName]);
  
  // Unified call handlers
  const handleMuteToggle = useCallback(() => {
    if (isExtensionCall) {
      extToggleMute();
    } else if (isTelnyxCall) {
      telnyxWebRTC.toggleMute();
    } else {
      isMuted ? webPhone.unmuteCall() : webPhone.muteCall();
    }
  }, [isExtensionCall, isTelnyxCall, isMuted, extToggleMute]);
  
  const handleHoldToggle = useCallback(() => {
    if (isTelnyxCall) {
      telnyxWebRTC.toggleHold();
    } else {
      isOnHold ? webPhone.unholdCall() : webPhone.holdCall();
    }
  }, [isTelnyxCall, isOnHold]);
  
  const handleHangup = useCallback(() => {
    if (isExtensionCall) {
      extEndCall();
    } else if (isTelnyxCall) {
      telnyxWebRTC.hangup();
    } else {
      webPhone.hangupCall();
    }
  }, [isExtensionCall, isTelnyxCall, extEndCall]);
  
  const handleAnswerCall = useCallback(() => {
    if (incomingExtCall) {
      extAnswerCall();
    } else if (telnyxIncomingCall) {
      telnyxWebRTC.answerCall();
    } else {
      webPhone.answerCall();
    }
  }, [incomingExtCall, telnyxIncomingCall, extAnswerCall]);
  
  const handleRejectCall = useCallback(() => {
    if (incomingExtCall) {
      extRejectCall();
    } else if (telnyxIncomingCall) {
      telnyxWebRTC.rejectCall();
    } else {
      webPhone.rejectCall();
    }
  }, [incomingExtCall, telnyxIncomingCall, extRejectCall]);
  
  const handleSendDTMF = useCallback((digit: string) => {
    if (isTelnyxCall) {
      telnyxWebRTC.sendDTMF(digit);
    } else {
      webPhone.sendDTMF(digit);
    }
  }, [isTelnyxCall]);
  
  // Get effective call duration
  const effectiveCallDuration = isExtensionCall ? extCallDuration : (isTelnyxCall ? telnyxCallDuration : callDuration);

  // Initialize Telnyx WebRTC when phone number is available
  const telnyxInitRef = useRef(false);
  
  useEffect(() => {
    const initializeTelnyx = async () => {
      // Prevent multiple initializations
      if (!hasTelnyxNumber || telnyxInitRef.current) {
        return;
      }
      
      telnyxInitRef.current = true;
      console.log('[WebPhone] Initializing Telnyx WebRTC...');
      
      try {
        // STEP 1: Fetch TURN credentials FIRST for manual ICE injection
        // Per Telnyx docs: This eliminates ~4 second delay in audio connection
        console.log('[WebPhone] Step 1: Fetching TURN credentials...');
        let iceServers: RTCIceServer[] | undefined;
        try {
          const turnResponse = await fetch('/api/telnyx/turn-credentials', {
            method: 'GET',
            credentials: 'include',
          });
          if (turnResponse.ok) {
            const turnData = await turnResponse.json();
            iceServers = turnData.iceServers;
            console.log('[WebPhone] TURN credentials received:', iceServers?.length, 'servers');
          } else {
            console.warn('[WebPhone] TURN credentials not available, will use SDK prefetch');
          }
        } catch (turnError) {
          console.warn('[WebPhone] Failed to fetch TURN credentials:', turnError);
        }

        // STEP 2: Fetch WebRTC SIP credentials
        console.log('[WebPhone] Step 2: Fetching WebRTC SIP credentials...');
        const response = await fetch('/api/webrtc/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        const data = await response.json();
        
        // CRITICAL: Handle insufficient balance error
        if (!response.ok) {
          if (data.error === 'INSUFFICIENT_BALANCE') {
            console.error('[WebPhone] BLOCKED - Insufficient wallet balance:', data.message);
            telnyxInitRef.current = false; // Allow retry after adding funds
            return;
          }
          telnyxInitRef.current = false;
          throw new Error(`Failed to fetch WebRTC credentials: ${response.status} ${JSON.stringify(data)}`);
        }
        
        if (!data.success || !data.sipUsername || !data.sipPassword) {
          throw new Error(data.error || 'Invalid WebRTC credentials');
        }
        
        console.log('[WebPhone] Got Telnyx SIP credentials:', { 
          sipUsername: data.sipUsername,
          callerIdNumber: data.callerIdNumber,
          iceServersProvided: !!iceServers
        });
        
        // Register audio element for Telnyx
        if (remoteAudioRef.current) {
          telnyxWebRTC.setAudioElement(remoteAudioRef.current);
        }
        
        // STEP 3: Initialize Telnyx WebRTC with manual ICE servers
        // This is the CRITICAL optimization - pre-loaded TURN credentials
        await telnyxWebRTC.initialize(
          data.sipUsername,
          data.sipPassword,
          data.callerIdNumber || telnyxCallerIdNumber,
          iceServers // Pass pre-fetched ICE servers for instant connection
        );
        
        setTelnyxInitialized(true);
        console.log('[WebPhone] Telnyx WebRTC initialized successfully');
        
      } catch (error: any) {
        console.error('[WebPhone] Failed to initialize Telnyx:', error?.message || error);
        telnyxInitRef.current = false; // Allow retry on failure
      }
    };
    
    initializeTelnyx();
  }, [hasTelnyxNumber, telnyxCallerIdNumber]);

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
  
  // CRITICAL: Audio elements are now created PROGRAMMATICALLY outside React
  // to avoid React Fiber references that cause "circular structure to JSON" errors
  // The telnyxWebRTC.initialize() function handles this automatically
  // No need to register React refs with the SDK anymore
  useEffect(() => {
    console.log('[WebPhone FloatingWindow] ✅ Audio elements handled by TelnyxWebRTC (programmatic)');
  }, []);
  
  // Debug callerInfo changes
  useEffect(() => {
    console.log('[WebPhone UI] CallerInfo changed:', callerInfo);
    console.log('[WebPhone UI] Current call:', currentCall);
    if (currentCall) {
      console.log('[WebPhone UI] Current call displayName:', currentCall.displayName);
      console.log('[WebPhone UI] Current call phoneNumber:', currentCall.phoneNumber);
    }
  }, [callerInfo, currentCall]);
  
  // Auto-open window when incoming call arrives (SIP.js)
  useEffect(() => {
    if (currentCall && currentCall.status === 'ringing' && currentCall.direction === 'inbound') {
      if (!isVisible) {
        toggleDialpad();
      }
    }
  }, [currentCall, isVisible, toggleDialpad]);
  
  // Auto-open window when Telnyx incoming call arrives
  useEffect(() => {
    if (telnyxIncomingCall) {
      console.log('[WebPhone] 📱 Telnyx incoming call detected - opening phone panel');
      if (!isVisible) {
        toggleDialpad();
      }
    }
  }, [telnyxIncomingCall, isVisible, toggleDialpad]);
  
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
    if (!effectiveCall) {
      setViewMode('keypad');
      setDialNumber('');
    }
  }, [effectiveCall]);
  
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
    
    // Don't format if 4 or fewer digits (extensions like 1000, 1001, 2001)
    if (limitedDigits.length <= 4) return limitedDigits;
    
    // Format only after 5th digit (phone numbers)
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
    
    if (effectiveCall?.status === 'answered') {
      handleSendDTMF(digit);
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
      
      // Check if this is an internal extension call
      // Only treat as extension if the number exists in online extensions list
      // This prevents accidentally calling 911, 411, etc. as extensions
      const targetExt = extOnlineExtensions.find(e => e.extension === digits);
      if (targetExt && targetExt.status === 'available') {
        console.log('[WebPhone] Making extension-to-extension call to:', digits, targetExt.displayName);
        await extStartCall(digits, targetExt.displayName);
        setDialNumber('');
        return;
      }
      
      // Check if dialing a 4-digit extension (1000-9999) - route via internal API
      if (digits.length === 4 && /^[1-9]\d{3}$/.test(digits)) {
        console.log('[WebPhone] Detected 4-digit extension, routing via internal API:', digits);
        try {
          // First check if this is a known extension type
          const checkRes = await fetch('/api/pbx/check-extension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ extension: digits }),
          });
          
          if (checkRes.ok) {
            const extInfo = await checkRes.json();
            console.log('[WebPhone] Extension info:', extInfo);
            
            if (extInfo.type === 'ivr' || extInfo.type === 'queue') {
              // Route via internal call API (Telnyx will call user back)
              const response = await fetch('/api/pbx/internal-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                  targetType: extInfo.type,
                  queueId: extInfo.queueId || null,
                }),
              });
              
              if (response.ok) {
                toast({ 
                  title: extInfo.type === 'ivr' ? 'Calling IVR' : `Calling ${extInfo.name || 'Queue'}`, 
                  description: 'Your phone will ring shortly...' 
                });
              } else {
                toast({ title: 'Call Failed', description: 'Could not connect', variant: 'destructive' });
              }
              setDialNumber('');
              return;
            }
            // If it's a user extension and they're online, already handled above by extOnlineExtensions
            // If offline, show message
            if (extInfo.type === 'user' && !extInfo.online) {
              toast({ title: 'Extension Offline', description: `Extension ${digits} is not available`, variant: 'destructive' });
              setDialNumber('');
              return;
            }
          }
        } catch (error) {
          console.error('[WebPhone] Extension check failed:', error);
        }
      }
      
      // Use Telnyx WebRTC if available, otherwise fallback to SIP.js
      if (hasTelnyxNumber) {
        // Check balance before making call
        try {
          const balanceRes = await fetch('/api/webrtc/check-balance', { 
            method: 'POST',
            credentials: 'include'
          });
          
          // Only block if we get a successful response with canCall: false
          if (balanceRes.ok) {
            const balanceData = await balanceRes.json();
            
            if (balanceData.canCall === false) {
              console.log('[WebPhone] Insufficient balance for call:', balanceData.message);
              // Try to play "no balance" audio notification
              try {
                const noBalanceAudio = new Audio('/audio/insufficient-balance.mp3');
                await noBalanceAudio.play();
              } catch {
                // Audio not available - silently continue to show toast
              }
              // Show toast notification with balance details
              toast({
                title: "Insufficient Balance",
                description: `Your wallet balance ($${balanceData.currentBalance || '0.00'}) is below the minimum required ($${balanceData.minimumRequired || '0.50'}) to make calls.`,
                variant: "destructive",
              });
              return;
            }
          } else {
            // Non-OK response - log and proceed with call (don't block on server errors)
            console.warn('[WebPhone] Balance check returned non-OK status:', balanceRes.status);
          }
        } catch (balanceError) {
          // Network or parse error - log and proceed with call
          console.warn('[WebPhone] Balance check failed, proceeding with call:', balanceError);
        }
        
        console.log('[WebPhone] Making call via Telnyx WebRTC to:', digits);
        const formattedNumber = digits.startsWith('+') ? digits : `+1${digits}`;
        await telnyxWebRTC.makeCall(formattedNumber);
      } else {
        await webPhone.makeCall(digits);
      }
      setDialNumber('');
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  };
  
  const missedCallsCount = backendCallLogs.filter((c: any) => c.status === 'missed').length;
  
  // Filter calls based on selected filter
  const filteredCallHistory = backendCallLogs.filter((call: any) => {
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
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20',
          icon: PhoneMissed,
          label: 'Missed'
        };
      case 'answered':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
          icon: Phone,
          label: 'Answered'
        };
      case 'ended':
        return {
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          icon: Phone,
          label: 'Completed'
        };
      case 'busy':
        return {
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/20',
          icon: PhoneOff,
          label: 'Busy'
        };
      case 'no_answer':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
          icon: Clock,
          label: 'No Answer'
        };
      case 'failed':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-600/10',
          borderColor: 'border-red-600/20',
          icon: PhoneOff,
          label: 'Failed'
        };
      case 'ringing':
        return {
          color: 'text-blue-400',
          bgColor: 'bg-blue-400/10',
          borderColor: 'border-blue-400/20',
          icon: Phone,
          label: 'Ringing'
        };
      default:
        return {
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/50',
          borderColor: 'border-muted',
          icon: Phone,
          label: status || 'Unknown'
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
  
  // Audio elements are now created PROGRAMMATICALLY by TelnyxWebRTCManager.initialize()
  // This prevents React Fiber references that cause "circular structure to JSON" errors
  // See ensureTelnyxAudioElements() in telnyx-webrtc.ts
  
  if (!isVisible) {
    // No need to render audio elements - they are programmatically created
    return null;
  }
  
  return (
    <>
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
            {hasPhoneCapability ? (
              <div className="flex items-center gap-1.5 sm:gap-2" data-testid="extension-status-indicator">
                <span className="text-foreground font-medium text-xs sm:text-sm">
                  {extMyExtension ? `Ext. ${extMyExtension}` : 'WebPhone'}
                </span>
                <div className={cn(
                  "h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full",
                  effectiveCall
                    ? (effectiveCall.status === 'answered' ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-pulse")
                    : extConnectionStatus === 'connected' 
                      ? "bg-green-500" 
                      : extConnectionStatus === 'connecting' 
                        ? "bg-yellow-500 animate-pulse" 
                        : "bg-red-500"
                )} />
              </div>
            ) : (
              <span className="text-foreground font-semibold text-xs sm:text-sm">WebPhone</span>
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
          {!hasPhoneCapability ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-8 text-center">
              {/* Shopping Bag Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <ShoppingBag className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
              </div>
              
              {/* Title */}
              <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                Get Started
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Purchase a phone number to start making calls
              </p>
              
              {/* Purchase Button - Opens Dialog */}
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full flex items-center gap-2"
                onClick={() => setShowBuyNumbers(true)}
                data-testid="button-purchase-phone"
              >
                <ShoppingBag className="h-4 w-4" />
                Purchase Now
              </Button>
              
              {/* Additional Info */}
              <p className="text-xs text-muted-foreground mt-6">
                Need to transfer an existing number? Contact support for assistance.
              </p>
            </div>
          ) : queueCall ? (
              /* Queue Call Incoming Screen */
              <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-8 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-4 animate-pulse">
                  <PhoneIncoming className="h-8 w-8 sm:h-10 sm:w-10 text-orange-600 dark:text-orange-400" />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                  Incoming Queue Call
                </h2>
                <p className="text-base sm:text-lg font-medium text-foreground">
                  {queueCall.callerNumber}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  External Caller
                </p>
                
                <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-xs">
                  <button
                    onClick={acceptQueueCall}
                    className="flex flex-col items-center gap-2 sm:gap-3 transition-all active:scale-95"
                    data-testid="button-accept-queue-call"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg">
                      <Phone className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    </div>
                    <span className="text-sm sm:text-base text-foreground font-medium">Accept</span>
                  </button>
                  
                  <button
                    onClick={rejectQueueCall}
                    className="flex flex-col items-center gap-2 sm:gap-3 transition-all active:scale-95"
                    data-testid="button-reject-queue-call"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg">
                      <PhoneOff className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    </div>
                    <span className="text-sm sm:text-base text-foreground font-medium">Decline</span>
                  </button>
                </div>
              </div>
          ) : effectiveCall ? (
              /* Active Call Screen - No bottom navigation */
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col justify-between p-3 sm:p-6 min-h-full">
                  {/* Contact Info */}
                  <div className="text-center pt-4 sm:pt-8">
                    <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-muted flex items-center justify-center mb-3 sm:mb-4">
                      <User className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-medium text-foreground mb-1.5 sm:mb-2">
                      {effectiveCall.displayName || "Unknown Caller"}
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground mb-1">
                      {formatCallerNumber(effectiveCall.phoneNumber)}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {effectiveCall.status === 'ringing' && effectiveCall.direction === 'inbound' && 'Incoming call...'}
                      {effectiveCall.status === 'ringing' && effectiveCall.direction === 'outbound' && 'Calling...'}
                      {effectiveCall.status === 'answered' && formatDuration(effectiveCallDuration)}
                    </p>
                    
                    {/* Network Quality Indicator & MUTED Badge */}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {effectiveCall.status === 'answered' && effectiveCall.isTelnyx && (
                        <NetworkQualityIndicator quality={telnyxNetworkQuality} />
                      )}
                      {effectiveMuted && (
                        <Badge variant="destructive" className="text-xs animate-pulse" data-testid="badge-muted">
                          <MicOff className="h-3 w-3 mr-1" />
                          MUTED
                        </Badge>
                      )}
                    </div>
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
                    {effectiveCall.status === 'ringing' && effectiveCall.direction === 'inbound' ? (
                      /* Incoming Call - Show Accept/Reject Buttons */
                      <div className="grid grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-8">
                        <button
                          onClick={handleAnswerCall}
                          disabled={telnyxIsAnswering}
                          className="flex flex-col items-center gap-2 sm:gap-3 transition-all active:scale-95"
                          data-testid="button-accept-call"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg bg-green-500 hover:bg-green-600">
                            <Phone className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                          </div>
                          <span className="text-sm sm:text-base text-foreground font-medium">
                            Accept
                          </span>
                        </button>
                        
                        <button
                          onClick={handleRejectCall}
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
                    ) : waitingCall && !effectiveCall.isTelnyx ? (
                      /* Call Waiting Active - Show Swap/Answer Buttons (SIP.js only) */
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
                            onClick={handleMuteToggle}
                            className="flex flex-col items-center gap-1.5 sm:gap-2 transition-opacity hover:opacity-80"
                            data-testid="button-mute-call"
                          >
                            <div className={cn(
                              "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-md",
                              effectiveMuted ? "bg-foreground" : "bg-muted/80"
                            )}>
                              {effectiveMuted ? (
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
                            onClick={handleHoldToggle}
                            className="flex flex-col items-center gap-1.5 sm:gap-2 transition-opacity hover:opacity-80"
                            data-testid="button-hold-call"
                          >
                            <div className={cn(
                              "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-md",
                              effectiveOnHold ? "bg-foreground" : "bg-muted/80"
                            )}>
                              <Pause className={cn("h-5 w-5 sm:h-7 sm:w-7", effectiveOnHold ? "text-background" : "text-foreground")} />
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">hold</span>
                          </button>
                        </div>
                      </>
                    ) : showInCallKeypad ? (
                      /* DTMF Keypad Overlay */
                      <div className="px-2 sm:px-4 flex justify-center">
                        <DtmfKeypad
                          onSendDigit={(digit) => {
                            if (effectiveCall.isTelnyx) {
                              telnyxWebRTC.sendDTMF(digit);
                            } else {
                              webPhone.sendDTMF(digit);
                            }
                          }}
                          onClose={() => setShowInCallKeypad(false)}
                        />
                      </div>
                    ) : (
                      /* Normal Call Controls - 4 buttons */
                      <div className="grid grid-cols-4 gap-2 sm:gap-4 px-2 sm:px-4">
                        <button
                          onClick={handleMuteToggle}
                          className="flex flex-col items-center gap-1 sm:gap-1.5 transition-opacity hover:opacity-80"
                          data-testid="button-mute-call"
                        >
                          <div className={cn(
                            "w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-md",
                            effectiveMuted ? "bg-red-500" : "bg-muted/80"
                          )}>
                            {effectiveMuted ? (
                              <MicOff className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                            ) : (
                              <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                            )}
                          </div>
                          <span className={cn(
                            "text-[9px] sm:text-[10px]",
                            effectiveMuted ? "text-red-500 font-medium" : "text-muted-foreground"
                          )}>
                            {effectiveMuted ? 'muted' : 'mute'}
                          </span>
                        </button>
                        
                        <button
                          onClick={() => setShowInCallKeypad(true)}
                          className="flex flex-col items-center gap-1 sm:gap-1.5 transition-opacity hover:opacity-80"
                          data-testid="button-keypad-incall"
                        >
                          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-muted/80 flex items-center justify-center shadow-md">
                            <Grid3x3 className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground">keypad</span>
                        </button>
                        
                        <button
                          onClick={() => setShowTransferDialog(true)}
                          className="flex flex-col items-center gap-1 sm:gap-1.5 transition-opacity hover:opacity-80"
                          data-testid="button-transfer"
                        >
                          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-muted/80 flex items-center justify-center shadow-md">
                            <PhoneForwarded className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground">transfer</span>
                        </button>
                        
                        <button
                          onClick={handleHoldToggle}
                          className="flex flex-col items-center gap-1 sm:gap-1.5 transition-opacity hover:opacity-80"
                          data-testid="button-hold-call"
                        >
                          <div className={cn(
                            "w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-md",
                            effectiveOnHold ? "bg-foreground" : "bg-muted/80"
                          )}>
                            <Pause className={cn("h-5 w-5 sm:h-6 sm:w-6", effectiveOnHold ? "text-background" : "text-foreground")} />
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground">hold</span>
                        </button>
                      </div>
                    )}
                    
                    {/* End Call Button - Only show when call is answered or outbound ringing */}
                    {!(effectiveCall.status === 'ringing' && effectiveCall.direction === 'inbound') && (
                      <div className="flex justify-center pt-3 sm:pt-6">
                        <button
                          onClick={handleHangup}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all active:scale-95"
                          data-testid="button-hangup-call"
                        >
                          <PhoneOff className="h-7 w-7 sm:h-9 sm:w-9 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Transfer Dialog with Tabs */}
                  {showTransferDialog && effectiveCall && (
                    <Dialog open={showTransferDialog} onOpenChange={(open) => {
                      setShowTransferDialog(open);
                      if (!open) {
                        setTransferNumber('');
                        setAttendedTransferNumber('');
                        setTransferTab('blind');
                      }
                    }}>
                      <DialogContent className="sm:max-w-md">
                        <DialogTitle className="text-lg font-semibold">Transfer Call</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                          Choose a transfer method
                        </DialogDescription>
                        
                        <Tabs value={transferTab} onValueChange={(v) => setTransferTab(v as 'blind' | 'attended')} className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="blind" data-testid="tab-blind-transfer">
                              Blind Transfer
                            </TabsTrigger>
                            <TabsTrigger value="attended" data-testid="tab-attended-transfer">
                              Attended Transfer
                            </TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="blind" className="space-y-4 mt-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">
                                Transfer immediately without announcement
                              </p>
                              <Input
                                type="tel"
                                value={transferNumber}
                                onChange={(e) => setTransferNumber(e.target.value)}
                                placeholder="Enter destination number"
                                className="w-full"
                                data-testid="input-blind-transfer-number"
                              />
                            </div>
                            
                            <Button
                              onClick={() => {
                                if (effectiveCall.isTelnyx) {
                                  telnyxWebRTC.blindTransfer(transferNumber);
                                } else {
                                  webPhone.blindTransfer(transferNumber);
                                }
                                setShowTransferDialog(false);
                                setTransferNumber('');
                              }}
                              disabled={!transferNumber}
                              className="w-full"
                              data-testid="button-execute-blind-transfer"
                            >
                              <PhoneForwarded className="h-4 w-4 mr-2" />
                              Transfer Now
                            </Button>
                          </TabsContent>
                          
                          <TabsContent value="attended" className="space-y-4 mt-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">
                                Consult with recipient before transferring
                              </p>
                              <Input
                                type="tel"
                                value={attendedTransferNumber}
                                onChange={(e) => setAttendedTransferNumber(e.target.value)}
                                placeholder="Enter consultant number"
                                className="w-full"
                                data-testid="input-attended-transfer-number"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Button
                                onClick={async () => {
                                  if (effectiveCall.isTelnyx) {
                                    await telnyxWebRTC.startAttendedTransfer(attendedTransferNumber);
                                  } else {
                                    webPhone.attendedTransfer(attendedTransferNumber);
                                  }
                                  setShowTransferDialog(false);
                                }}
                                disabled={!attendedTransferNumber}
                                className="w-full"
                                data-testid="button-start-consultation"
                              >
                                <Phone className="h-4 w-4 mr-2" />
                                Start Consultation
                              </Button>
                              <p className="text-xs text-muted-foreground text-center">
                                The current call will be placed on hold while you consult
                              </p>
                            </div>
                          </TabsContent>
                        </Tabs>
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
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-semibold text-foreground">Recents</h2>
                          <button
                            onClick={() => syncCallsMutation.mutate()}
                            disabled={syncCallsMutation.isPending}
                            className="p-1 hover:bg-muted rounded-full transition-colors"
                            title="Sync call history"
                            data-testid="button-sync-calls"
                          >
                            <RefreshCw className={`h-4 w-4 text-muted-foreground ${syncCallsMutation.isPending ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
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
                              const initials = call.callerName 
                                ? call.callerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                                : '';
                              const timeStr = format(new Date(call.startedAt), 'h:mma');
                              const dateStr = format(new Date(call.startedAt), 'MMM d');
                              const statusStyle = getCallStatusStyle(call.status);
                              const isSelected = selectedCallIds.has(call.id);
                              const durationStr = formatDuration(call.duration || 0);
                              const StatusIcon = statusStyle.icon;
                              const DirectionIcon = call.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;
                              
                              return (
                                <div 
                                  key={call.id} 
                                  className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 hover:bg-muted/30 transition-colors"
                                  data-testid={`call-log-${call.id}`}
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
                                  
                                  {/* Avatar with Direction Indicator */}
                                  <div className="relative flex-shrink-0">
                                    <div className={cn(
                                      "w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center",
                                      statusStyle.bgColor
                                    )}>
                                      {initials ? (
                                        <span className={cn("text-xs sm:text-sm font-semibold", statusStyle.color)}>{initials}</span>
                                      ) : (
                                        <StatusIcon className={cn("h-4 w-4 sm:h-5 sm:w-5", statusStyle.color)} />
                                      )}
                                    </div>
                                    {/* Direction indicator badge */}
                                    <div className={cn(
                                      "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-background",
                                      call.direction === 'inbound' ? 'bg-blue-500' : 'bg-green-500'
                                    )}>
                                      <DirectionIcon className="h-2 w-2 text-white" />
                                    </div>
                                  </div>
                                  
                                  {/* Call Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={cn(
                                        "text-sm sm:text-base font-medium truncate",
                                        call.status === 'missed' || call.status === 'failed' ? statusStyle.color : 'text-foreground'
                                      )}>
                                        {call.callerName || "Unknown Caller"}
                                      </span>
                                      {/* Status Badge */}
                                      <span className={cn(
                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border",
                                        statusStyle.bgColor,
                                        statusStyle.borderColor,
                                        statusStyle.color
                                      )}>
                                        {statusStyle.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
                                      <span>{formatCallerNumber((call.direction === 'inbound' ? call.fromNumber : call.toNumber))}</span>
                                      {durationStr && (
                                        <>
                                          <span className="text-muted-foreground/50">•</span>
                                          <span className="text-muted-foreground">{durationStr}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Time and Call Button */}
                                  {!isEditMode && (
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <span className="text-xs text-muted-foreground">{timeStr}</span>
                                      <span className="text-[10px] text-muted-foreground/60">{dateStr}</span>
                                    </div>
                                  )}
                                  
                                  {/* Call Button */}
                                  {!isEditMode && (
                                    <button
                                      onClick={() => {
                                        setViewMode('keypad');
                                        setDialNumber((call.direction === 'inbound' ? call.fromNumber : call.toNumber));
                                      }}
                                      className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
                                      data-testid={`button-call-${call.id}`}
                                    >
                                      <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                                    </button>
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
                          disabled={!dialNumber || (() => {
                            // Check if we can make calls - either via extension WebSocket or Telnyx/SIP
                            const canCallViaExtension = extMyExtension && extConnectionStatus === 'connected';
                            const canCallViaTelnyx = hasTelnyxNumber && telnyxConnectionStatus === 'connected';
                            const canCallViaSip = connectionStatus === 'connected';
                            // Allow calling if ANY connection is available
                            return !(canCallViaExtension || canCallViaTelnyx || canCallViaSip);
                          })()}
                          className={cn(
                            "w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                            dialNumber && (() => {
                              const canCallViaExtension = extMyExtension && extConnectionStatus === 'connected';
                              const canCallViaTelnyx = hasTelnyxNumber && telnyxConnectionStatus === 'connected';
                              const canCallViaSip = connectionStatus === 'connected';
                              return canCallViaExtension || canCallViaTelnyx || canCallViaSip;
                            })()
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
                    <ContactsView 
                      setDialNumber={setDialNumber} 
                      setViewMode={setViewMode}
                      onlineExtensions={extOnlineExtensions}
                      onCallExtension={extStartCall}
                    />
                  )}
                  
                  {viewMode === 'voicemail' && (
                    <VoicemailView 
                      voicemails={voicemailList}
                      unreadCount={voicemailUnreadCount}
                      refetchVoicemails={refetchVoicemails}
                    />
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
      
      {/* Buy Numbers Dialog - Full Screen Modal */}
      <BuyNumbersDialog 
        open={showBuyNumbers} 
        onOpenChange={setShowBuyNumbers} 
      />
    </>
  );
}
