import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";
import { 
  Search, Send, MoreVertical, Phone, Video, RefreshCw, 
  QrCode, Wifi, WifiOff, MessageCircle, Check, CheckCheck,
  Smile, Paperclip, Mic, ArrowLeft, User, Image, FileText, 
  Download, Play, Volume2, X, Trash2, Square, Pause
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { format, isToday, isYesterday } from "date-fns";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface WhatsappInstance {
  id: string;
  instanceName: string;
  status: string;
  qrCode?: string;
  phoneNumber?: string;
  profileName?: string;
}

interface WhatsappContact {
  id: string;
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
  isGroup: boolean;
  businessPhone?: string;
  businessName?: string;
}

interface WhatsappConversation {
  id: string;
  remoteJid: string;
  unreadCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageFromMe?: boolean;
  isPinned: boolean;
  isArchived: boolean;
  contact?: WhatsappContact;
}

function formatMessagePreview(preview: string | undefined, fromMe?: boolean): string {
  if (!preview) return "No messages";
  
  const mediaTypes: Record<string, string> = {
    "[image]": "📷 Image",
    "image": "📷 Image",
    "📷 Image": "📷 Image",
    "[video]": "🎥 Video",
    "video": "🎥 Video",
    "🎥 Video": "🎥 Video",
    "[audio]": "🎵 Audio",
    "audio": "🎵 Audio",
    "🎵 Audio": "🎵 Audio",
    "[document]": "📄 Document",
    "document": "📄 Document",
    "[sticker]": "🎨 Sticker",
    "sticker": "🎨 Sticker",
    "🎨 Sticker": "🎨 Sticker",
  };
  
  const formattedType = mediaTypes[preview.toLowerCase()] || mediaTypes[preview];
  if (formattedType) {
    const direction = fromMe === true ? " sent" : fromMe === false ? " received" : "";
    return formattedType + direction;
  }
  
  return preview;
}

interface WhatsappMessage {
  id: string;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  content?: string;
  messageType: string;
  mediaUrl?: string;
  status: string;
  timestamp: string;
  reaction?: string | null;
}

function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Standard phone number formatting for US numbers
  if (phone.length === 10) {
    return `(${phone.substring(0, 3)}) ${phone.substring(3, 6)}-${phone.substring(6)}`;
  } else if (phone.length === 11 && phone.startsWith("1")) {
    return `+1 (${phone.substring(1, 4)}) ${phone.substring(4, 7)}-${phone.substring(7)}`;
  }
  
  if (/^\d+$/.test(phone)) {
    return `+${phone}`;
  }
  
  return phone;
}

function formatJidToPhone(jid: string, contactName?: string, businessPhone?: string, businessName?: string): string {
  if (!jid) return "";
  
  // Check if this is a group
  if (jid.includes("@g.us")) {
    const groupId = jid.split("@")[0];
    return `Group (${groupId.slice(-6)})`;
  }
  
  // Check if this is a WhatsApp Business ID (@lid)
  if (jid.includes("@lid")) {
    // ALWAYS show phone number first for @lid contacts
    if (businessPhone) {
      return formatPhoneNumber(businessPhone);
    }
    
    // Fallback to business name if no phone
    if (businessName) return businessName;
    
    // Last fallback: show truncated ID
    const bizId = jid.split("@")[0];
    return `Business (${bizId.slice(-6)})`;
  }
  
  // Regular contacts - extract phone from JID
  const phone = jid.split("@")[0];
  return formatPhoneNumber(phone);
}

function formatMessageTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  if (isToday(date)) {
    return format(date, "HH:mm");
  } else if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "dd/MM/yyyy");
}

function getInitials(jid: string): string {
  const phone = jid.split("@")[0];
  return phone.slice(-2);
}

const formatAudioTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const AudioMessagePlayer = ({ messageId, mediaUrl }: { messageId: string; mediaUrl: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const waveform = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < messageId.length; i++) {
      hash = ((hash << 5) - hash) + messageId.charCodeAt(i);
      hash = hash & hash;
    }
    return [...Array(40)].map((_, i) => {
      const seed = Math.abs((hash * (i + 1) * 9301 + 49297) % 233280);
      return 6 + (seed / 233280) * 18;
    });
  }, [messageId]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);
  
  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };
  
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * duration;
  };
  
  return (
    <div className="flex items-center gap-3 p-2 min-w-[220px]">
      <button 
        onClick={togglePlayback}
        className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-green-600 transition-colors"
        data-testid={`button-audio-toggle-${messageId}`}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 text-white" />
        ) : (
          <Play className="w-5 h-5 text-white ml-0.5" />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div 
          className="flex items-end gap-0.5 h-6 cursor-pointer"
          onClick={handleSeek}
          data-testid={`audio-waveform-${messageId}`}
        >
          {waveform.map((height, i) => {
            const barProgress = (i / waveform.length) * 100;
            const isPlayed = barProgress < progress;
            return (
              <div 
                key={i} 
                className={cn(
                  "w-1 rounded-full transition-colors",
                  isPlayed ? "bg-green-500" : "bg-gray-300 dark:bg-gray-500"
                )}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{duration > 0 ? formatAudioTime(duration) : '--:--'}</span>
        </div>
      </div>
      <audio ref={audioRef} src={mediaUrl} preload="metadata" className="hidden" />
    </div>
  );
};

function MediaMessage({ 
  message,
  remoteJid,
  onMediaLoaded 
}: { 
  message: WhatsappMessage;
  remoteJid: string;
  onMediaLoaded?: (mediaUrl: string) => void;
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(message.mediaUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const downloadAttemptedRef = useRef(false);

  const downloadMedia = useCallback(async () => {
    if (mediaUrl || loading || downloadAttemptedRef.current) return;
    downloadAttemptedRef.current = true;
    
    setLoading(true);
    setError(false);
    
    try {
      const response = await apiRequest("POST", `/api/whatsapp/download-media/${message.id}`);
      const data = await response.json();
      
      if (data.mediaUrl) {
        setMediaUrl(data.mediaUrl);
        onMediaLoaded?.(data.mediaUrl);
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats", remoteJid, "messages"] });
      } else {
        setError(true);
        toast({
          title: "Media unavailable",
          description: "Could not download this media",
          variant: "destructive",
        });
      }
    } catch (err) {
      setError(true);
      toast({
        title: "Download failed",
        description: "Failed to download media",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [mediaUrl, loading, message.id, onMediaLoaded, remoteJid, queryClient, toast]);

  useEffect(() => {
    const mediaTypes = ["image", "video", "audio", "document"];
    if (!mediaUrl && !loading && mediaTypes.includes(message.messageType)) {
      downloadMedia();
    }
  }, [mediaUrl, loading, message.messageType, downloadMedia]);

  const renderMedia = () => {
    const mediaTypes = ["image", "video", "audio", "document"];
    if (!mediaTypes.includes(message.messageType)) {
      return null;
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center w-48 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg">
          <LoadingSpinner fullScreen={false} />
        </div>
      );
    }

    if (!mediaUrl) {
      return (
        <button 
          onClick={downloadMedia}
          className="flex flex-col items-center justify-center w-48 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
          disabled={loading}
        >
          {message.messageType === "image" && <Image className="w-8 h-8 text-gray-500 mb-2" />}
          {message.messageType === "video" && <Play className="w-8 h-8 text-gray-500 mb-2" />}
          {message.messageType === "audio" && <Volume2 className="w-8 h-8 text-gray-500 mb-2" />}
          {message.messageType === "document" && <FileText className="w-8 h-8 text-gray-500 mb-2" />}
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Download className="w-3 h-3" />
            {error ? "Retry" : "Load"} {message.messageType}
          </span>
        </button>
      );
    }

    if (message.messageType === "image") {
      return (
        <>
          <img 
            src={mediaUrl} 
            alt="Image" 
            className="max-w-48 max-h-48 rounded-lg cursor-pointer object-cover"
            onClick={() => setShowFullImage(true)}
            loading="lazy"
          />
          <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
            <DialogContent className="max-w-fit max-h-fit p-0 border-0 bg-transparent [&>button]:hidden">
              <button 
                onClick={() => setShowFullImage(false)}
                className="absolute top-2 right-2 z-50 p-2 bg-black/50 rounded-full hover:bg-black/70"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <img 
                src={mediaUrl} 
                alt="Full size" 
                className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg"
                onClick={() => setShowFullImage(false)}
              />
            </DialogContent>
          </Dialog>
        </>
      );
    }

    if (message.messageType === "video") {
      return (
        <video 
          src={mediaUrl} 
          controls 
          className="max-w-48 max-h-48 rounded-lg"
          preload="metadata"
        />
      );
    }

    if (message.messageType === "audio") {
      return <AudioMessagePlayer messageId={message.id} mediaUrl={mediaUrl} />;
    }

    if (message.messageType === "document") {
      const fileName = message.content && message.content !== 'document' && message.content !== '[document]' 
        ? message.content 
        : 'Document';
      const displayName = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
      const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
      
      const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        const link = document.createElement('a');
        link.href = mediaUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      
      return (
        <button 
          onClick={handleDownload}
          className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 min-w-[200px] text-left"
        >
          <div className="w-10 h-10 bg-red-500 rounded flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ext}</p>
          </div>
          <Download className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>
      );
    }

    return null;
  };

  return renderMedia();
}

const profilePicCache = new Map<string, string | null>();
const pendingFetches = new Set<string>();

function ContactAvatar({ 
  remoteJid, 
  profilePicUrl, 
  className = "h-12 w-12",
  onProfilePicLoaded
}: { 
  remoteJid: string; 
  profilePicUrl?: string | null;
  className?: string;
  onProfilePicLoaded?: (remoteJid: string, url: string) => void;
}) {
  const avatarRef = useRef<HTMLDivElement>(null);
  const [localPicUrl, setLocalPicUrl] = useState<string | null>(
    profilePicUrl || profilePicCache.get(remoteJid) || null
  );
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (profilePicUrl) {
      setLocalPicUrl(profilePicUrl);
      profilePicCache.set(remoteJid, profilePicUrl);
    }
  }, [profilePicUrl, remoteJid]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (avatarRef.current) {
      observer.observe(avatarRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || localPicUrl || pendingFetches.has(remoteJid)) return;
    if (profilePicCache.has(remoteJid)) {
      setLocalPicUrl(profilePicCache.get(remoteJid) || null);
      return;
    }

    pendingFetches.add(remoteJid);
    
    apiRequest("POST", "/api/whatsapp/profile-picture", { remoteJid })
      .then(data => {
        const url = data.profilePicUrl || null;
        profilePicCache.set(remoteJid, url);
        setLocalPicUrl(url);
        if (url && onProfilePicLoaded) {
          onProfilePicLoaded(remoteJid, url);
        }
      })
      .catch(() => {
        profilePicCache.set(remoteJid, null);
      })
      .finally(() => {
        pendingFetches.delete(remoteJid);
      });
  }, [isVisible, localPicUrl, remoteJid, onProfilePicLoaded]);

  return (
    <div ref={avatarRef}>
      <Avatar className={className}>
        {localPicUrl ? (
          <AvatarImage src={localPicUrl} alt="Profile" />
        ) : null}
        <AvatarFallback className="bg-gray-300 dark:bg-gray-600">
          <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

type ConnectionPhase = "loading" | "waitingForQr" | "qrReady" | "connected";

export default function WhatsAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [typingJids, setTypingJids] = useState<Set<string>>(new Set());
  const draftsRef = useRef<Map<string, string>>(new Map());
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    preview: string;
    type: 'image' | 'video' | 'audio' | 'document';
  } | null>(null);
  const [newChatNumber, setNewChatNumber] = useState("");
  const [chatReady, setChatReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectAttemptedRef = useRef(false);
  const previousUnreadRef = useRef<number>(0);
  const lastTypingSentRef = useRef<number>(0);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioWaveform, setAudioWaveform] = useState<number[]>([]);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiSelect = (emoji: any) => {
    setMessageText(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  // Switch chat with draft preservation
  const switchChat = useCallback((newChatJid: string | null) => {
    // Save current draft before switching
    if (selectedChat && messageText.trim()) {
      draftsRef.current.set(selectedChat, messageText);
    } else if (selectedChat) {
      // Remove empty draft
      draftsRef.current.delete(selectedChat);
    }
    
    // Restore draft for new chat
    if (newChatJid) {
      const savedDraft = draftsRef.current.get(newChatJid) || "";
      setMessageText(savedDraft);
    } else {
      setMessageText("");
    }
    
    setSelectedChat(newChatJid);
  }, [selectedChat, messageText]);

  // Notification sound function using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Could not play notification sound');
    }
  }, []);

  const { data: instanceData, isLoading: loadingInstance, refetch: refetchInstance } = useQuery<{
    instance: WhatsappInstance | null;
    connected: boolean;
  }>({
    queryKey: ["/api/whatsapp/instance"],
  });

  const sendTypingIndicator = useCallback(() => {
    if (!selectedChat || !instanceData?.connected) return;
    
    const now = Date.now();
    // Only send typing every 3 seconds to avoid spam
    if (now - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = now;
    
    fetch('/api/whatsapp/send-typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ remoteJid: selectedChat }),
    }).catch(() => {});
  }, [selectedChat, instanceData?.connected]);

  // Send GLOBAL presence status (available/unavailable) for the entire instance
  const sendGlobalPresence = useCallback((presence: "available" | "unavailable") => {
    if (!instanceData?.connected) return;
    
    fetch('/api/whatsapp/send-presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ presence }),
    }).catch(() => {});
  }, [instanceData?.connected]);

  // Manage GLOBAL presence when WhatsApp page is open
  useEffect(() => {
    if (instanceData?.connected) {
      // Set online when WhatsApp page is open and connected
      sendGlobalPresence("available");
      
      // Keep-alive every 25 seconds to maintain online status
      presenceIntervalRef.current = setInterval(() => {
        sendGlobalPresence("available");
      }, 25000);
      
      return () => {
        // Set offline when leaving WhatsApp page
        sendGlobalPresence("unavailable");
        if (presenceIntervalRef.current) {
          clearInterval(presenceIntervalRef.current);
          presenceIntervalRef.current = null;
        }
      };
    }
  }, [instanceData?.connected, sendGlobalPresence]);

  const { data: chats = [], isLoading: loadingChats } = useQuery<WhatsappConversation[]>({
    queryKey: ["/api/whatsapp/chats"],
    enabled: instanceData?.connected === true,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<WhatsappMessage[]>({
    queryKey: ["/api/whatsapp/chats", selectedChat, "messages"],
    queryFn: async () => {
      if (!selectedChat) return [];
      const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(selectedChat)}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedChat && instanceData?.connected === true,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp/connect");
    },
    onSuccess: () => {
      refetchInstance();
    },
    onError: () => {
      connectAttemptedRef.current = false;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp/disconnect");
    },
    onSuccess: () => {
      connectAttemptedRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instance"] });
      toast({ title: "Disconnected", description: "WhatsApp has been disconnected" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ number, text }: { number: string; text: string }) => {
      return apiRequest("POST", "/api/whatsapp/send", { number, text });
    },
    onMutate: async ({ number, text }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
      const previousMessages = queryClient.getQueryData(["/api/whatsapp/chats", selectedChat, "messages"]);
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        messageId: `temp_${Date.now()}`,
        content: text,
        fromMe: true,
        timestamp: new Date().toISOString(),
        messageType: "text",
        status: "sending",
      };
      queryClient.setQueryData(["/api/whatsapp/chats", selectedChat, "messages"], (old: any[] = []) => [...old, optimisticMessage]);
      setMessageText("");
      // Clear draft after sending
      if (selectedChat) {
        draftsRef.current.delete(selectedChat);
      }
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/whatsapp/chats", selectedChat, "messages"], context.previousMessages);
      }
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    },
  });

  const sendMediaMutation = useMutation({
    mutationFn: async ({ number, file, preview, mediaType }: { number: string; file: File; preview: string; mediaType: string }) => {
      const base64 = preview.split(',')[1];
      return apiRequest("POST", "/api/whatsapp/send-media", {
        number,
        mediaType,
        base64,
        mimetype: file.type,
        fileName: file.name,
      });
    },
    onMutate: async ({ file, preview, mediaType }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
      const previousMessages = queryClient.getQueryData(["/api/whatsapp/chats", selectedChat, "messages"]);
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        messageId: `temp_${Date.now()}`,
        content: mediaType === "document" ? file.name : `[${mediaType}]`,
        fromMe: true,
        timestamp: new Date().toISOString(),
        messageType: mediaType,
        mediaUrl: preview,
        status: "sending",
      };
      queryClient.setQueryData(["/api/whatsapp/chats", selectedChat, "messages"], (old: any[] = []) => [...old, optimisticMessage]);
      setPendingAttachment(null);
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/whatsapp/chats", selectedChat, "messages"], context.previousMessages);
      }
      toast({ title: "Send Failed", description: error.message || "Failed to send file", variant: "destructive" });
    },
  });

  const sendAudioMutation = useMutation({
    mutationFn: async ({ number, base64, audioDataUrl }: { number: string; base64: string; audioDataUrl: string }) => {
      return apiRequest("POST", "/api/whatsapp/send-audio", {
        number,
        base64,
      });
    },
    onMutate: async ({ audioDataUrl }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
      const previousMessages = queryClient.getQueryData(["/api/whatsapp/chats", selectedChat, "messages"]);
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        messageId: `temp_${Date.now()}`,
        content: "audio",
        fromMe: true,
        timestamp: new Date().toISOString(),
        messageType: "audio",
        mediaUrl: audioDataUrl,
        status: "sending",
      };
      queryClient.setQueryData(["/api/whatsapp/chats", selectedChat, "messages"], (old: any[] = []) => [...old, optimisticMessage]);
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/whatsapp/chats", selectedChat, "messages"], context.previousMessages);
      }
      toast({ title: "Send Failed", description: error.message || "Failed to send audio", variant: "destructive" });
    },
  });

  // Local reactions state for optimistic UI
  const [localReactions, setLocalReactions] = useState<Record<string, string>>({});

  const sendReactionMutation = useMutation({
    mutationFn: async ({ remoteJid, messageId, emoji, fromMe }: { remoteJid: string; messageId: string; emoji: string; fromMe: boolean }) => {
      return apiRequest("POST", "/api/whatsapp/send-reaction", { remoteJid, messageId, emoji, fromMe });
    },
    onMutate: async ({ messageId, emoji }) => {
      const previousReaction = localReactions[messageId];
      setLocalReactions(prev => {
        if (emoji === "") {
          const { [messageId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [messageId]: emoji };
      });
      return { previousReaction, messageId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
    },
    onError: (error: any, _variables, context) => {
      if (context?.messageId) {
        if (context.previousReaction !== undefined) {
          setLocalReactions(prev => ({ ...prev, [context.messageId]: context.previousReaction }));
        } else {
          setLocalReactions(prev => {
            const { [context.messageId]: _, ...rest } = prev;
            return rest;
          });
        }
      }
      toast({ title: "Reaction Failed", description: error.message || "Failed to send reaction", variant: "destructive" });
    },
  });

  const handleReaction = (messageId: string, remoteJid: string, emoji: string, fromMe: boolean) => {
    const currentReaction = localReactions[messageId];
    const newEmoji = currentReaction === emoji ? "" : emoji;
    sendReactionMutation.mutate({ remoteJid, messageId, emoji: newEmoji, fromMe });
  };

  const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const syncChatsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp/sync-chats");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
      toast({ title: "Synced", description: `${data.synced} new chats synced` });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      return apiRequest("DELETE", `/api/whatsapp/chats/${chatId}`);
    },
    onSuccess: () => {
      switchChat(null);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
      toast({ title: "Deleted", description: "Chat deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Detect new messages and play notification sound
  useEffect(() => {
    if (chats.length > 0) {
      const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
      if (totalUnread > previousUnreadRef.current && previousUnreadRef.current > 0) {
        playNotificationSound();
      }
      previousUnreadRef.current = totalUnread;
    }
  }, [chats, playNotificationSound]);

  const connectionPhase: ConnectionPhase = (() => {
    if (instanceData?.connected) return "connected";
    if (instanceData?.instance?.qrCode) return "qrReady";
    if (loadingInstance || connectMutation.isPending) return "loading";
    return "waitingForQr";
  })();

  useEffect(() => {
    if (connectionPhase === "connected") {
      connectAttemptedRef.current = false;
    }
  }, [connectionPhase]);

  useEffect(() => {
    if (connectionPhase === "waitingForQr" && !connectAttemptedRef.current) {
      connectAttemptedRef.current = true;
      connectMutation.mutate();
    }
  }, [connectionPhase]);

  useEffect(() => {
    if (instanceData?.connected && !loadingChats && chats.length === 0 && !syncChatsMutation.isPending) {
      syncChatsMutation.mutate();
    }
  }, [instanceData?.connected, loadingChats, chats.length]);

  // Ref to track selectedChat without causing WebSocket reconnection
  const selectedChatRef = useRef<string | null>(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Refresh contact profile when selecting a chat without pushName
  const refreshedContactsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedChat) return;
    if (refreshedContactsRef.current.has(selectedChat)) return;
    const chat = chats.find(c => c.remoteJid === selectedChat);
    if (!chat?.contact?.pushName && !chat?.contact?.businessName) {
      refreshedContactsRef.current.add(selectedChat);
      fetch('/api/whatsapp/refresh-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteJid: selectedChat }),
        credentials: 'include'
      }).then(res => res.json()).then(data => {
        if (data.pushName || data.businessName) {
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
        }
      }).catch(() => {});
    }
  }, [selectedChat, chats]);

  // WebSocket listener for real-time WhatsApp updates - singleton connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
    
    ws.onopen = () => {
      console.log('[WhatsApp] WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const currentChat = selectedChatRef.current;
        
        if (data.type?.startsWith('whatsapp:')) {
          console.log('[WhatsApp] WebSocket event:', data.type);
          if (data.type === 'whatsapp:message') {
            if (data.data?.remoteJid === currentChat) {
              queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats', currentChat, 'messages'] });
              if (scrollViewportRef.current) {
                scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
              }
              // Auto mark-read when message arrives in currently open chat
              if (!data.data?.fromMe) {
                fetch('/api/whatsapp/mark-read', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ remoteJid: currentChat }),
                  credentials: 'include'
                }).catch(() => {});
              }
            }
            queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
          }
          if (data.type === 'whatsapp:message_status') {
            const { remoteJid, messageId, status } = data.data || {};
            if (remoteJid === currentChat && messageId && status) {
              queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats', currentChat, 'messages'] });
            }
          }
          if (data.type === 'whatsapp:chat_update') {
            queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
          }
          if (data.type === 'whatsapp:connection' || data.type === 'whatsapp:qr_code') {
            queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/instance'] });
          }
          if (data.type === 'whatsapp:reaction') {
            // Reaction received - refresh messages to show the reaction
            const remoteJid = data.data?.remoteJid;
            if (remoteJid === currentChat) {
              queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats', currentChat, 'messages'] });
            }
          }
        }
        // Handle typing indicator - supports multiple contacts typing simultaneously
        if (data.type === 'whatsapp_typing') {
          const jid = data.remoteJid;
          if (data.isTyping) {
            setTypingJids(prev => new Set(prev).add(jid));
            // Clear this contact's typing indicator after 5 seconds if no update received
            setTimeout(() => {
              setTypingJids(prev => {
                const next = new Set(prev);
                next.delete(jid);
                return next;
              });
            }, 5000);
          } else {
            setTypingJids(prev => {
              const next = new Set(prev);
              next.delete(jid);
              return next;
            });
          }
        }
      } catch (e) {
        console.log('[WhatsApp] WebSocket parse error:', e);
      }
    };
    
    ws.onerror = (error) => {
      console.log('[WhatsApp] WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('[WhatsApp] WebSocket closed');
    };
    
    return () => {
      ws.close();
    };
  }, [queryClient]); // Only depends on queryClient, not selectedChat

  // Initial sync when chat is selected (one-time, not polling)
  useEffect(() => {
    if (!selectedChat || !instanceData?.connected) return;
    
    const syncMessages = async () => {
      try {
        const res = await fetch(`/api/whatsapp/sync-messages/${encodeURIComponent(selectedChat)}`, {
          method: 'POST',
          credentials: 'include',
        });
        const data = await res.json();
        if (data.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats', selectedChat, 'messages'] });
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
        }
        
        // Mark messages as read when opening the chat
        try {
          await fetch(`/api/whatsapp/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ remoteJid: selectedChat }),
          });
        } catch (error) {
          console.log('Mark read error:', error);
        }
      } catch (error) {
        console.log('Sync error:', error);
      }
    };
    
    syncMessages();
  }, [selectedChat, instanceData?.connected, queryClient]);

  // Use ResizeObserver to keep scroll locked to bottom until content stabilizes
  useEffect(() => {
    if (loadingMessages) {
      setChatReady(false);
      return;
    }
    
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      setChatReady(true);
      return;
    }
    
    // Immediately scroll to bottom
    viewport.scrollTop = viewport.scrollHeight;
    
    // Track if we should keep scrolling to bottom
    let isLocked = true;
    let stabilityTimer: ReturnType<typeof setTimeout>;
    let scrollCount = 0;
    
    // ResizeObserver keeps scroll at bottom while content grows (images loading, etc)
    const resizeObserver = new ResizeObserver(() => {
      if (isLocked && viewport) {
        viewport.scrollTop = viewport.scrollHeight;
        scrollCount++;
        
        // After each resize, reset stability timer
        clearTimeout(stabilityTimer);
        stabilityTimer = setTimeout(() => {
          // Content has stabilized (no resizes for 200ms)
          isLocked = false;
          setChatReady(true);
        }, 200);
      }
    });
    
    // Observe the content container (first child of viewport)
    const contentContainer = viewport.firstElementChild;
    if (contentContainer) {
      resizeObserver.observe(contentContainer);
    }
    
    // Also observe viewport itself
    resizeObserver.observe(viewport);
    
    // Initial scroll and set ready after short delay if no resizes happen
    stabilityTimer = setTimeout(() => {
      viewport.scrollTop = viewport.scrollHeight;
      setChatReady(true);
      isLocked = false;
    }, 150);
    
    return () => {
      clearTimeout(stabilityTimer);
      resizeObserver.disconnect();
    };
  }, [loadingMessages, selectedChat, messages.length]);

  const handleSend = () => {
    if (!messageText.trim() || !selectedChat) return;
    sendMessageMutation.mutate({ number: selectedChat, text: messageText });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 16MB", variant: "destructive" });
      return;
    }
    
    const mediaType = file.type.startsWith('image/') ? 'image' 
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'document';
    
    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        file,
        preview: reader.result as string,
        type: mediaType,
      });
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendAttachment = () => {
    if (!pendingAttachment || !selectedChat) return;
    sendMediaMutation.mutate({
      number: selectedChat,
      file: pendingAttachment.file,
      preview: pendingAttachment.preview,
      mediaType: pendingAttachment.type,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const bars = Array.from(dataArray.slice(0, 80)).map(v => Math.max(4, (v / 255) * 24));
        setAudioWaveform(bars);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();
      
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setAudioWaveform([]);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (error) {
      toast({ title: "Microphone Error", description: "Could not access microphone", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingDuration(0);
    setIsPlaying(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAudioWaveform([]);
  };

  const toggleAudioPlayback = () => {
    if (!audioPreviewRef.current || !audioUrl) return;
    if (isPlaying) {
      audioPreviewRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlaying(true);
    }
  };

  const sendAudio = async () => {
    if (!audioBlob || !selectedChat || !audioUrl) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const audioDataUrl = reader.result as string;
      sendAudioMutation.mutate({
        number: selectedChat,
        base64,
        audioDataUrl,
      });
    };
    reader.readAsDataURL(audioBlob);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setRecordingDuration(0);
    setIsPlaying(false);
  };

  const filteredChats = chats.filter((chat) =>
    chat.remoteJid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (connectionPhase !== "connected") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center space-y-6 max-w-md">
          {connectionPhase === "qrReady" && instanceData?.instance?.qrCode ? (
            <>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl inline-block shadow-lg">
                <img 
                  src={instanceData.instance.qrCode.startsWith('data:') 
                    ? instanceData.instance.qrCode 
                    : `data:image/png;base64,${instanceData.instance.qrCode}`} 
                  alt="QR Code" 
                  className="w-72 h-72"
                  data-testid="whatsapp-qr-code"
                />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Scan to Connect</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  1. Open WhatsApp on your phone<br />
                  2. Go to Settings &rarr; Linked Devices<br />
                  3. Tap "Link a Device" and scan this code
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner fullScreen={false} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Connected - show chat interface
  return (
    <div className="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className={cn(
        "w-full md:w-[400px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col",
        selectedChat && "hidden md:flex"
      )}>
        <div className="p-2 bg-white dark:bg-gray-950 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-100 dark:bg-gray-800 border-0"
              data-testid="input-search-chats"
            />
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => syncChatsMutation.mutate()}
            disabled={syncChatsMutation.isPending}
            data-testid="button-sync-chats"
          >
            <RefreshCw className={cn("w-4 h-4", syncChatsMutation.isPending && "animate-spin")} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            data-testid="button-disconnect"
          >
            <WifiOff className="w-4 h-4 text-red-500" />
          </Button>
        </div>

        <div className="p-2 border-b dark:border-gray-800">
          <div className="flex gap-2">
            <Input
              placeholder="Phone number (e.g., 5511999999999)"
              value={newChatNumber}
              onChange={(e) => setNewChatNumber(e.target.value)}
              className="flex-1"
              data-testid="input-new-chat-number"
            />
            <Button
              size="sm"
              onClick={() => {
                if (newChatNumber.trim()) {
                  switchChat(newChatNumber.replace(/\D/g, "") + "@s.whatsapp.net");
                  setNewChatNumber("");
                }
              }}
              data-testid="button-start-new-chat"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <MessageCircle className="w-10 h-10 mb-2" />
              <p>No chats yet</p>
              <p className="text-xs">Enter a number above to start chatting</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => switchChat(chat.remoteJid)}
                className={cn(
                  "flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800",
                  selectedChat === chat.remoteJid && "bg-gray-100 dark:bg-gray-800"
                )}
                data-testid={`chat-item-${chat.id}`}
              >
                <ContactAvatar 
                  remoteJid={chat.remoteJid}
                  profilePicUrl={chat.contact?.profilePicUrl}
                  className="h-12 w-12"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium truncate dark:text-white">
                      {formatJidToPhone(chat.remoteJid, chat.contact?.pushName, chat.contact?.businessPhone, chat.contact?.businessName)}
                    </p>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {chat.lastMessageAt && formatMessageTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    {typingJids.has(chat.remoteJid) ? (
                      <p className="text-sm text-green-600 dark:text-green-400 truncate animate-pulse font-semibold">
                        typing...
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 truncate">
                        {formatMessagePreview(chat.lastMessagePreview, chat.lastMessageFromMe)}
                      </p>
                    )}
                    {chat.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground rounded-full h-5 min-w-[20px] flex items-center justify-center">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      <div className={cn(
        "flex-1 flex flex-col",
        !selectedChat && "hidden md:flex"
      )}>
        {selectedChat ? (
          <>
            <div className="p-3 bg-gray-100 dark:bg-gray-900 flex items-center gap-3 border-b dark:border-gray-800">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => switchChat(null)}
                data-testid="button-back-to-chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <ContactAvatar 
                remoteJid={selectedChat}
                profilePicUrl={chats.find(c => c.remoteJid === selectedChat)?.contact?.profilePicUrl}
                className="h-10 w-10"
              />
              <div className="flex-1">
                <p className="font-medium dark:text-white">{formatJidToPhone(selectedChat, chats.find(c => c.remoteJid === selectedChat)?.contact?.pushName, chats.find(c => c.remoteJid === selectedChat)?.contact?.businessPhone, chats.find(c => c.remoteJid === selectedChat)?.contact?.businessName)}</p>
                <p className="text-xs text-gray-500">
                  {typingJids.has(selectedChat) ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="font-semibold">typing...</span>
                    </span>
                  ) : (
                    chats.find(c => c.remoteJid === selectedChat)?.contact?.pushName || 
                    chats.find(c => c.remoteJid === selectedChat)?.contact?.businessName || 
                    null
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon">
                  <Video className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Phone className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div 
              ref={scrollViewportRef}
              className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 overflow-y-auto"
              style={{ scrollBehavior: 'auto' }}
            >
              <div 
                className="dark:opacity-80"
                style={{ 
                  visibility: chatReady ? 'visible' : 'hidden'
                }}
              >
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner fullScreen={false} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500 bg-white/50 dark:bg-black/20 rounded-lg p-4">
                    <MessageCircle className="w-10 h-10 mb-2" />
                    <p>No messages yet</p>
                    <p className="text-xs">Send a message to start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex group",
                            msg.fromMe ? "justify-end" : "justify-start",
                            (msg.reaction || localReactions[msg.messageId]) && "mb-4"
                          )}
                          data-testid={`message-${msg.id}`}
                        >
                          <div className={cn("flex items-end gap-1", msg.fromMe ? "flex-row-reverse" : "flex-row")}>
                            <div
                              className={cn(
                                "max-w-[65%] rounded-lg px-3 py-2 shadow-sm relative",
                                msg.fromMe
                                  ? "bg-primary/10 dark:bg-primary/20"
                                  : "bg-white dark:bg-gray-800"
                              )}
                            >
                              {["image", "video", "audio", "document"].includes(msg.messageType) ? (
                                <div className="mb-1">
                                  <MediaMessage message={msg} remoteJid={msg.remoteJid} />
                                  {msg.messageType !== "document" && msg.content && 
                                   msg.content !== msg.messageType && 
                                   msg.content !== `[${msg.messageType}]` &&
                                   !["image", "video", "audio", "document", "[image]", "[video]", "[audio]", "[document]"].includes(msg.content) && (
                                    <p className="text-sm dark:text-white break-words mt-1">
                                      {msg.content}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm dark:text-white break-words">
                                  {msg.content || `[${msg.messageType}]`}
                                </p>
                              )}
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className="text-[10px] text-gray-500">
                                  {msg.timestamp && !isNaN(new Date(msg.timestamp).getTime()) 
                                    ? format(new Date(msg.timestamp), "HH:mm") 
                                    : ""}
                                </span>
                                {msg.fromMe && (
                                  msg.status === "read" ? (
                                    <CheckCheck className="w-3 h-3 text-blue-500" />
                                  ) : msg.status === "delivered" ? (
                                    <CheckCheck className="w-3 h-3 text-gray-400" />
                                  ) : (
                                    <Check className="w-3 h-3 text-gray-400" />
                                  )
                                )}
                              </div>
                              {(msg.reaction || localReactions[msg.messageId]) && (
                                <div className={cn(
                                  "absolute -bottom-3 text-base bg-white dark:bg-gray-700 rounded-full px-1 shadow-sm border dark:border-gray-600",
                                  msg.fromMe ? "right-1" : "left-1"
                                )}>
                                  {localReactions[msg.messageId] || msg.reaction}
                                </div>
                              )}
                            </div>
                            <div className={cn(
                              "opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-white dark:bg-gray-800 rounded-full shadow-md border dark:border-gray-700 px-1 py-0.5",
                              msg.fromMe ? "order-first" : ""
                            )}>
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(msg.messageId, msg.remoteJid, emoji, msg.fromMe)}
                                  className={cn(
                                    "text-sm hover:scale-125 transition-transform p-0.5 rounded",
                                    localReactions[msg.messageId] === emoji && "bg-primary/20"
                                  )}
                                  data-testid={`button-reaction-${emoji}-${msg.id}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {pendingAttachment && (
              <div className="p-4 border-t bg-gray-50 dark:bg-gray-800">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    {pendingAttachment.type === 'image' ? (
                      <img 
                        src={pendingAttachment.preview} 
                        alt="Preview" 
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ) : pendingAttachment.type === 'video' ? (
                      <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <Video className="w-8 h-8 text-gray-500" />
                      </div>
                    ) : pendingAttachment.type === 'audio' ? (
                      <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <Mic className="w-8 h-8 text-gray-500" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-500" />
                      </div>
                    )}
                    <button 
                      onClick={() => setPendingAttachment(null)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      data-testid="button-remove-attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {pendingAttachment.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(pendingAttachment.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button 
                    onClick={handleSendAttachment}
                    disabled={sendMediaMutation.isPending}
                    className="shrink-0"
                    data-testid="button-send-attachment"
                  >
                    {sendMediaMutation.isPending ? (
                      <LoadingSpinner fullScreen={false} />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3 bg-gray-100 dark:bg-gray-900 flex items-center gap-2">
              {isRecording ? (
                <div className="flex items-center gap-2 flex-1 bg-red-50 dark:bg-red-900/20 rounded-full px-3 py-2">
                  <Button variant="ghost" size="icon" onClick={cancelRecording} className="h-8 w-8 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full flex-shrink-0" data-testid="button-cancel-recording">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 flex items-center justify-center gap-px overflow-hidden">
                    {audioWaveform.length > 0 ? audioWaveform.map((height, i) => (
                      <div 
                        key={i} 
                        className="w-0.5 bg-red-500 rounded-full transition-all duration-75 flex-shrink-0"
                        style={{ height: `${height}px` }}
                      />
                    )) : [...Array(80)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-0.5 bg-red-300 dark:bg-red-700 rounded-full animate-pulse flex-shrink-0"
                        style={{ height: `${4 + (i % 5) * 3}px`, animationDelay: `${i * 20}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-mono text-sm min-w-[40px] flex-shrink-0">
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                  <Button size="icon" onClick={stopRecording} className="h-10 w-10 bg-red-500 hover:bg-red-600 rounded-full flex-shrink-0" data-testid="button-stop-recording">
                    <Square className="w-4 h-4 text-white fill-white" />
                  </Button>
                </div>
              ) : audioBlob && audioUrl ? (
                <div className="flex items-center gap-2 flex-1 bg-green-50 dark:bg-green-900/20 rounded-full px-3 py-2">
                  <Button variant="ghost" size="icon" onClick={cancelRecording} className="h-8 w-8 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full flex-shrink-0" data-testid="button-discard-audio">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={toggleAudioPlayback}
                    className="h-10 w-10 bg-green-500 hover:bg-green-600 rounded-full flex-shrink-0"
                    data-testid="button-toggle-audio-playback"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                  </Button>
                  <div className="flex-1 flex items-center justify-center gap-px overflow-hidden">
                    {[...Array(100)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-0.5 bg-green-400 dark:bg-green-600 rounded-full flex-shrink-0"
                        style={{ height: `${Math.sin(i * 0.3) * 10 + 12}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-green-600 dark:text-green-400 font-mono text-sm min-w-[40px] flex-shrink-0">
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                  <audio 
                    ref={audioPreviewRef} 
                    src={audioUrl} 
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                  <Button 
                    size="icon" 
                    onClick={sendAudio} 
                    disabled={sendAudioMutation.isPending}
                    className="h-10 w-10 bg-green-500 hover:bg-green-600 rounded-full"
                    data-testid="button-send-audio"
                  >
                    {sendAudioMutation.isPending ? <LoadingSpinner fullScreen={false} /> : <Send className="w-5 h-5 text-white" />}
                  </Button>
                </div>
              ) : (
                <>
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                      data-testid="input-file-attachment"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendMediaMutation.isPending}
                      data-testid="button-attach-file"
                    >
                      {sendMediaMutation.isPending ? (
                        <LoadingSpinner fullScreen={false} />
                      ) : (
                        <Paperclip className="w-6 h-6 text-gray-500" />
                      )}
                    </Button>
                  </>
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Type a message"
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value);
                        sendTypingIndicator();
                      }}
                      onKeyPress={(e) => e.key === "Enter" && handleSend()}
                      className="w-full bg-white dark:bg-gray-800 border-0 rounded-lg pr-10"
                      data-testid="input-message"
                    />
                    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <PopoverTrigger asChild>
                        <button 
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          data-testid="button-emoji-picker"
                        >
                          <Smile className="w-5 h-5 text-gray-500" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-auto p-0 border-0" 
                        side="top" 
                        align="end"
                        sideOffset={10}
                      >
                        <Picker 
                          data={data} 
                          onEmojiSelect={handleEmojiSelect}
                          theme="light"
                          set="native"
                          previewPosition="none"
                          skinTonePosition="search"
                          searchPosition="sticky"
                          navPosition="bottom"
                          perLine={8}
                          emojiSize={24}
                          emojiButtonSize={32}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {messageText.trim() ? (
                    <Button 
                      size="icon"
                      onClick={handleSend}
                      disabled={sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onMouseLeave={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      data-testid="button-record-audio"
                    >
                      <Mic className="w-6 h-6 text-gray-500" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <MessageCircle className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-light text-gray-700 dark:text-gray-300">WhatsApp</h2>
              <p className="text-gray-500 max-w-sm">
                Select a chat from the list or enter a phone number to start a new conversation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
