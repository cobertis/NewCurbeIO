import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, isToday, isYesterday, differenceInMinutes, startOfDay, isThisWeek, isThisYear } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";
import { 
  Search, Send, Paperclip, MoreVertical, Phone, Video, Info,
  Download, Reply, Trash2, Copy, Forward, Pin, Archive, Heart,
  ThumbsUp, ThumbsDown, Laugh, AlertCircle, HelpCircle, CheckCheck,
  Check, Clock, Volume2, VolumeX, RefreshCw, X, ChevronDown,
  Smile, Image as ImageIcon, FileText, Camera, Plus, MessageCircle, MessageSquare, Eye, User as UserIcon, MapPin, Play, Pause, AudioWaveform, Mic, MicOff, Square, Circle
} from "lucide-react";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import type { User } from "@shared/schema";
import { formatPhoneInput, formatForDisplay, isValidPhoneNumber } from "@shared/phone";

// Helper function to generate consistent color from string
function getAvatarColorFromString(str: string): string {
  const colors = [
    '#6B7280', // gray-500 - default
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#14B8A6', // teal-500
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Helper function to get initials from name
function getInitials(name: string): string {
  if (!name || name.trim() === '') return '';
  
  // If it's a phone number (starts with + or is all digits), don't show initials
  if (/^[\+\d\s\-\(\)]+$/.test(name.trim())) {
    return '';
  }
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Helper function to format display names (formats phone numbers, leaves regular names as-is)
function formatDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  
  // Check if it's a phone number pattern
  if (isValidPhoneNumber(name)) {
    return formatForDisplay(name);
  }
  
  // Otherwise return as-is (it's a contact name)
  return name;
}

// Updated interface types for BlueBubbles integration
interface ImessageConversation {
  id: string;
  companyId: string;
  chatGuid: string;
  displayName: string;
  participants: string[];
  lastMessageText?: string;
  lastMessageAt?: string | Date;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  avatarUrl?: string;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ImessageMessage {
  id: string;
  conversationId: string;
  guid: string;
  text: string;
  subject?: string;
  isFromMe: boolean;
  senderName?: string;
  senderAddress?: string;
  dateCreated: string;
  dateSent?: string;
  dateRead?: string;
  dateDelivered?: string;
  hasAttachments: boolean;
  attachments: MessageAttachment[];
  effectId?: string;
  replyToMessageId?: string;
  reactions: MessageReaction[];
  isDeleted: boolean;
  isEdited: boolean;
  editedAt?: string;
  metadata?: any;
  status: string; // 'sending', 'sent', 'delivered', 'read', 'failed'
}

interface MessageAttachment {
  id: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  metadata?: {
    duration?: number;
    waveform?: number[];
    codec?: string;
    sampleRate?: number;
  };
}

interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  reaction: '❤️' | '👍' | '👎' | '😂' | '!!' | '❓';
  createdAt: string;
}

interface TypingIndicator {
  conversationId: string;
  userName: string;
  isTyping: boolean;
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
}

// Helper function to get file type display name
function getFileTypeDisplay(mimeType: string): string {
  const typeMap: { [key: string]: string } = {
    'application/pdf': 'PDF Document',
    'application/msword': 'Word Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.ms-excel': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
    'application/vnd.ms-powerpoint': 'PowerPoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'text/plain': 'Text File',
    'application/zip': 'ZIP Archive',
    'application/x-rar-compressed': 'RAR Archive',
  };
  return typeMap[mimeType] || 'Document';
}

// Component to display file attachments (PDF, docs, etc.)
function ImessageAttachmentFile({ attachment }: { attachment: MessageAttachment }) {
  const fileType = getFileTypeDisplay(attachment.mimeType);
  const fileSize = formatFileSize(attachment.fileSize);
  const isPdf = attachment.mimeType === 'application/pdf';
  
  const handleDownload = async () => {
    try {
      const response = await fetch(attachment.url, {
        credentials: 'include',
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm"
      style={{ maxWidth: '320px' }}
      onClick={handleDownload}
      data-testid="attachment-file"
    >
      {/* File icon with thumbnail effect */}
      <div className="flex-shrink-0 w-14 h-16 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center">
        {isPdf ? (
          <>
            <FileText className="h-7 w-7 text-red-500 mb-1" />
            <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase">PDF</span>
          </>
        ) : (
          <FileText className="h-7 w-7 text-blue-500" />
        )}
      </div>
      
      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] text-gray-900 dark:text-white truncate leading-tight">
          {attachment.fileName}
        </p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
          {fileType} · {fileSize}
        </p>
      </div>
    </div>
  );
}

// Component to handle authenticated video loading
// Uses direct server URLs - browser handles caching and authentication via cookies
function ImessageAttachmentVideo({ url, fileName }: { url: string; fileName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <>
      {/* Video thumbnail with play button - iMessage style */}
      <div 
        className="relative group cursor-pointer"
        onClick={() => setIsOpen(true)}
        data-testid="video-thumbnail"
      >
        {/* Video element for thumbnail (paused at first frame) */}
        <video
          src={url}
          className="rounded-2xl w-full object-cover bg-black"
          style={{ maxHeight: '250px', maxWidth: '200px' }}
          preload="metadata"
        />
        
        {/* Play button overlay - iMessage style (smaller, more subtle) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-full p-1.5 shadow-md">
            <svg className="h-3.5 w-3.5 text-gray-700 dark:text-white pl-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Full-size video dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-black/95">
          <video
            ref={videoRef}
            src={url}
            controls
            autoPlay
            className="w-full h-full max-h-[85vh] object-contain"
          >
            Your browser does not support the video tag.
          </video>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Component to handle authenticated image loading
// Uses direct server URLs - browser handles caching and authentication via cookies
// This prevents images from disappearing during React re-renders
function ImessageAttachmentImage({ url, alt }: { url: string; alt: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(false);

  return (
    <>
      {/* Thumbnail with eye icon */}
      <div 
        className="relative group cursor-pointer"
        onClick={() => setIsOpen(true)}
        data-testid="attachment-thumbnail"
      >
        <img 
          src={url}
          alt={alt} 
          className="rounded-2xl object-cover"
          style={{ maxHeight: '250px', maxWidth: '200px' }}
          onError={() => setError(true)}
          loading="lazy"
        />
        {/* Eye icon overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-2xl flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-full p-1.5 shadow-md">
              <Eye className="h-3.5 w-3.5 text-gray-700 dark:text-gray-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Full-size image dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-black/95">
          <img 
            src={url}
            alt={alt} 
            className="w-full h-full max-h-[85vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Component to display audio messages with waveform visualization
function ImessageAudioMessage({ 
  url, 
  fileName, 
  waveform 
}: { 
  url: string; 
  fileName: string; 
  waveform?: number[];
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Use direct URL - browser handles caching and auth via cookies
  useEffect(() => {
    setBlobUrl(url);
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [blobUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error('Audio play error:', err);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Use real waveform if available, otherwise generate random bars (64 bars standard)
  const waveformBars = useMemo(() => {
    if (waveform && waveform.length > 0) {
      // Resample to 64 bars if needed
      const targetBars = 64;
      if (waveform.length === targetBars) {
        return waveform;
      }
      // Resample
      const resampled: number[] = [];
      const step = waveform.length / targetBars;
      for (let i = 0; i < targetBars; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        const slice = waveform.slice(start, end);
        const avg = slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
        resampled.push(avg);
      }
      return resampled;
    }
    // Fallback: generate 64 random bars
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 90) + 20);
  }, [waveform]);

  return (
    <div className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
      {blobUrl && (
        <audio ref={audioRef} src={blobUrl} preload="metadata" />
      )}
      
      {/* Play/Pause Button */}
      <Button
        size="icon"
        onClick={togglePlay}
        className="rounded-full h-10 w-10 flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
        disabled={!blobUrl}
        data-testid="audio-play-button"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" fill="white" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" fill="white" />
        )}
      </Button>

      {/* Waveform Visualization - 64 bars */}
      <div className="flex-1 flex items-center gap-[2px] min-w-0" style={{ height: '32px' }}>
        {waveformBars.map((amp, i) => {
          const progress = duration > 0 ? currentTime / duration : 0;
          const isActive = i < waveformBars.length * progress;
          const height = Math.max(5, Math.min(32, (amp / 255) * 32));
          
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-sm transition-colors duration-150",
                isActive 
                  ? "bg-blue-500 dark:bg-blue-400" 
                  : "bg-gray-300 dark:bg-gray-600"
              )}
              style={{ 
                minWidth: '2px',
                maxWidth: '3px',
                height: `${height}px`
              }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className="text-sm text-gray-600 dark:text-gray-400 font-mono flex-shrink-0 min-w-[45px] text-right">
        {formatTime(isPlaying ? currentTime : duration)}
      </span>
    </div>
  );
}

const TAPBACK_REACTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '👍', label: 'Like' },
  { emoji: '👎', label: 'Dislike' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '!!', label: 'Exclaim' },
  { emoji: '❓', label: 'Question' }
];

export default function IMessagePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<ImessageMessage | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  
  // New conversation state
  const [isNewConversationMode, setIsNewConversationMode] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState("");
  
  // Contact info sheet state
  const [showContactInfo, setShowContactInfo] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>([]); // Progressive bars array
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const DISPLAY_BAR_COUNT = 64; // Standard bar count for waveform display
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null); // For duration timer
  const samplingIntervalRef = useRef<NodeJS.Timeout | null>(null); // For waveform sampling
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Helper function to resample waveform to fixed bar count
  const resampleWaveform = (input: number[], targetCount: number): number[] => {
    if (input.length === 0) return Array(targetCount).fill(0);
    if (input.length === targetCount) return input;
    
    const output: number[] = [];
    const step = input.length / targetCount;
    
    for (let i = 0; i < targetCount; i++) {
      const start = Math.floor(i * step);
      const end = Math.floor((i + 1) * step);
      const slice = input.slice(start, end);
      const avg = slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
      output.push(avg);
    }
    
    return output;
  };

  // WebSocket message handler - define before using in useWebSocket
  const handleWebSocketMessage = useCallback((message: any) => {
    console.log('[iMessage WebSocket] Received:', message.type, message);
    
    switch (message.type) {
      case 'imessage_message':
        // Merge message into cache instead of invalidating to prevent flicker
        if (message.conversationId && message.message) {
          queryClient.setQueryData<ImessageMessage[]>(
            [`/api/imessage/conversations/${message.conversationId}/messages`],
            (old) => {
              if (!old) return [message.message];
              
              // Check if message already exists (dedup by GUID)
              const existsByGuid = old.some(m => m.guid === message.message.guid);
              if (existsByGuid) return old;
              
              // Check if this is replacing an optimistic message (by clientGuid in metadata)
              const optimisticIndex = old.findIndex(m => 
                m.metadata?.clientGuid && message.message.metadata?.clientGuid &&
                m.metadata.clientGuid === message.message.metadata.clientGuid
              );
              
              if (optimisticIndex !== -1) {
                // Replace optimistic message with real one
                const newMessages = [...old];
                // Revoke any blob URLs from optimistic attachments
                if (newMessages[optimisticIndex].attachments) {
                  newMessages[optimisticIndex].attachments.forEach(att => {
                    if (att.url.startsWith('blob:')) {
                      URL.revokeObjectURL(att.url);
                    }
                  });
                }
                newMessages[optimisticIndex] = message.message;
                return newMessages;
              }
              
              // Add new message to the end
              return [...old, message.message];
            }
          );
          
          // Update conversation list to show latest message
          queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
          
          // Play sound if enabled and message is in selected conversation
          if (soundEnabled && message.conversationId === selectedConversationId && !message.message.isFromMe) {
            playSound('receive');
          }
        }
        break;
      case 'imessage:typing-start':
        setTypingUsers(prev => new Map(prev).set(message.userId, {
          conversationId: message.conversationId,
          userName: message.userName,
          isTyping: true
        }));
        break;
      case 'imessage:typing-stop':
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(message.userId);
          return newMap;
        });
        break;
      case 'imessage:message-read':
        queryClient.invalidateQueries({ queryKey: ['/api/imessage/messages', message.conversationId] });
        break;
      case 'imessage:reaction-added':
        // Merge reaction into cache instead of invalidating
        if (message.conversationId === selectedConversationId && message.messageGuid && message.reaction) {
          queryClient.setQueryData<ImessageMessage[]>(
            [`/api/imessage/conversations/${selectedConversationId}/messages`],
            (old) => {
              if (!old) return old;
              return old.map(msg => {
                if (msg.guid === message.messageGuid) {
                  const reactionExists = msg.reactions.some(r => r.reaction === message.reaction);
                  if (reactionExists) return msg;
                  return {
                    ...msg,
                    reactions: [...msg.reactions, {
                      id: `temp-${Date.now()}`,
                      messageId: msg.id,
                      userId: message.userId || 'unknown',
                      userName: message.userName || message.sender || 'Unknown',
                      reaction: message.reaction,
                      createdAt: new Date().toISOString()
                    }]
                  };
                }
                return msg;
              });
            }
          );
        }
        break;
    }
  }, [selectedConversationId, soundEnabled, queryClient]);

  // WebSocket setup - use the WebSocket instance directly
  const ws = useWebSocket(handleWebSocketMessage);

  // Helper function to send WebSocket messages
  const wsSendMessage = useCallback((data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, [ws]);

  // Queries
  const { data: conversations, isLoading: conversationsLoading } = useQuery<ImessageConversation[]>({
    queryKey: ['/api/imessage/conversations'],
    refetchInterval: 30000
  });

  // Auto-open existing conversation when phone number matches
  useEffect(() => {
    if (isNewConversationMode && newConversationPhone && conversations) {
      // Extract just digits from the input for comparison
      const digitsOnly = newConversationPhone.replace(/\D/g, '');
      
      // Only check if we have at least 10 digits (complete phone number)
      if (digitsOnly.length >= 10) {
        // Find conversation that matches this phone number
        const matchingConversation = conversations.find(conv => {
          // Check if any participant matches the phone number
          return conv.participants?.some(participant => {
            const participantDigits = participant.replace(/\D/g, '');
            // Match if the last 10 digits are the same (ignoring country code differences)
            return participantDigits.slice(-10) === digitsOnly.slice(-10);
          });
        });

        if (matchingConversation) {
          // Open the existing conversation
          setSelectedConversationId(matchingConversation.id);
          setIsNewConversationMode(false);
          setNewConversationPhone("");
          setMessageText("");
          setAttachments([]);
          
          // Focus the message input
          setTimeout(() => {
            messageInputRef.current?.focus();
          }, 100);
        }
      }
    }
  }, [newConversationPhone, isNewConversationMode, conversations]);

  const { data: messages, isLoading: messagesLoading } = useQuery<ImessageMessage[]>({
    queryKey: selectedConversationId ? [`/api/imessage/conversations/${selectedConversationId}/messages`] : [''],
    enabled: !!selectedConversationId,
    refetchInterval: 30000, // Reduced from 5s to 30s - rely on WebSocket instead
    placeholderData: (previousData) => previousData // Keep previous data during refetch to prevent flicker
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { text: string; effectId?: string; replyToMessageId?: string; attachments?: File[]; clientGuid?: string }) => {
      // If we have attachments, use FormData, otherwise use JSON
      if (data.attachments && data.attachments.length > 0) {
        const formData = new FormData();
        formData.append('conversationId', selectedConversationId!);
        formData.append('text', data.text);
        if (data.effectId) formData.append('effectId', data.effectId);
        if (data.replyToMessageId) formData.append('replyToMessageId', data.replyToMessageId);
        if (data.clientGuid) formData.append('clientGuid', data.clientGuid);
        data.attachments.forEach(file => formData.append('attachments', file));

        const response = await fetch('/api/imessage/messages/send', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Failed to send message');
        }
        
        return response.json();
      } else {
        // For text-only messages, use JSON
        return apiRequest('POST', '/api/imessage/messages/send', {
          conversationId: selectedConversationId!,
          text: data.text,
          effect: data.effectId,
          replyToGuid: data.replyToMessageId,
          clientGuid: data.clientGuid
        });
      }
    },
    // Optimistic update - add message immediately to UI
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/imessage/conversations/${selectedConversationId}/messages`] });
      
      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ImessageMessage[]>([`/api/imessage/conversations/${selectedConversationId}/messages`]);
      
      // Use the clientGuid passed from handleSendMessage
      const clientGuid = variables.clientGuid!;
      
      // Create temporary blob URLs for attachments (so images show immediately)
      const tempAttachments = variables.attachments?.map((file, index) => ({
        id: `temp-${clientGuid}-${index}`,
        guid: `temp-${clientGuid}-${index}`,
        mimeType: file.type,
        fileName: file.name,
        fileSize: file.size,
        url: URL.createObjectURL(file), // Temporary blob URL for immediate display
        thumbnailUrl: undefined,
      })) || [];
      
      // Optimistically update to the new value
      const optimisticMessage: ImessageMessage = {
        id: clientGuid, // Use GUID as ID too
        conversationId: selectedConversationId!,
        guid: clientGuid, // Real GUID for matching
        text: variables.text,
        isFromMe: true, // CRITICAL: Set isFromMe to true so it renders on the right
        dateCreated: new Date().toISOString(),
        dateSent: new Date().toISOString(),
        dateDelivered: undefined,
        dateRead: undefined,
        senderAddress: 'me',
        senderName: undefined,
        hasAttachments: (variables.attachments?.length || 0) > 0,
        attachments: tempAttachments,
        reactions: [],
        replyToMessageId: variables.replyToMessageId || undefined,
        effectId: variables.effectId || undefined,
        status: 'sending',
        isDeleted: false,
        isEdited: false,
        metadata: { clientGuid }
      };
      
      queryClient.setQueryData<ImessageMessage[]>(
        [`/api/imessage/conversations/${selectedConversationId}/messages`],
        (old) => [...(old || []), optimisticMessage]
      );
      
      // Clear inputs immediately
      setMessageText("");
      setReplyingToMessage(null);
      setAttachments([]);
      
      if (soundEnabled) playSound('send');
      
      return { previousMessages, clientGuid };
    },
    onError: (error: any, variables, context) => {
      // Revert to previous state on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          [`/api/imessage/conversations/${selectedConversationId}/messages`],
          context.previousMessages
        );
      }
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive"
      });
    },
    onSuccess: (response: any, variables, context) => {
      // For attachments, DON'T replace the optimistic message here
      // Let the webhook handle it so we don't lose the blob URL temporarily
      if (variables.attachments && variables.attachments.length > 0) {
        console.log('[iMessage] Skipping onSuccess update for attachment - webhook will handle it');
        // Only invalidate conversations list (for last message preview)
        queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
        return;
      }
      
      // For text-only messages, replace optimistic message with real message from server
      const realMessage = response?.message;
      const clientGuid = context?.clientGuid;
      
      if (realMessage && clientGuid) {
        queryClient.setQueryData<ImessageMessage[]>(
          [`/api/imessage/conversations/${selectedConversationId}/messages`],
          (old) => {
            if (!old) return [realMessage];
            
            // Replace optimistic message by GUID
            return old.map(msg => 
              msg.guid === clientGuid ? { ...realMessage, isFromMe: true } : msg
            ).filter((msg, index, self) => 
              // Remove duplicates based on GUID
              index === self.findIndex(m => m.guid === msg.guid)
            );
          }
        );
      }
      
      // Only invalidate conversations list (for last message preview)
      queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
    }
  });

  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, reaction }: { messageId: string; reaction: string }) => {
      return apiRequest('POST', `/api/imessage/messages/${messageId}/reaction`, { reaction });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/imessage/conversations/${selectedConversationId}/messages`] });
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest('DELETE', `/api/imessage/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/imessage/conversations/${selectedConversationId}/messages`] });
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest('POST', `/api/imessage/conversations/${conversationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest('DELETE', `/api/imessage/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
      // Clear selected conversation if it was deleted
      if (selectedConversationId === deleteConversationMutation.variables) {
        setSelectedConversationId(null);
      }
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete conversation",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // New conversation mutation
  const sendNewConversationMutation = useMutation({
    mutationFn: async ({ to, text, attachments }: { to: string; text: string; attachments?: File[] }) => {
      const clientGuid = `temp-${Date.now()}-${Math.random()}`;
      
      // Handle attachments if present
      if (attachments && attachments.length > 0) {
        const formData = new FormData();
        formData.append('to', to);
        formData.append('text', text);
        formData.append('clientGuid', clientGuid);
        attachments.forEach(file => formData.append('attachments', file));
        
        return fetch('/api/imessage/messages/send', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        }).then(res => res.json());
      }
      
      return apiRequest('POST', '/api/imessage/messages/send', {
        to,
        text,
        clientGuid
      });
    },
    onSuccess: () => {
      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
      
      // Exit new conversation mode
      setIsNewConversationMode(false);
      setNewConversationPhone("");
      setMessageText("");
      setAttachments([]);
      
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const pinConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest('PUT', `/api/imessage/conversations/${conversationId}/pin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
      toast({
        title: "Conversación fijada",
        description: "La conversación se ha fijado al inicio"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al fijar conversación",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const unpinConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest('PUT', `/api/imessage/conversations/${conversationId}/unpin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
      toast({
        title: "Conversación desfijada",
        description: "La conversación ya no está fijada"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al desfijar conversación",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Helper functions
  const playSound = (type: 'send' | 'receive') => {
    if (!soundEnabled) return;
    const audio = new Audio(type === 'send' ? '/sounds/imessage-send.mp3' : '/sounds/imessage-receive.mp3');
    audio.play().catch(console.error);
  };

  const formatMessageTime = (date: string | undefined) => {
    if (!date) return '';
    
    const msgDate = new Date(date);
    
    // Validate date is valid
    if (isNaN(msgDate.getTime())) {
      return '';
    }
    
    // Always show only the time
    return format(msgDate, 'h:mm a');
  };

  const formatDateSeparator = (date: string) => {
    const msgDate = new Date(date);
    
    // Validate date is valid
    if (isNaN(msgDate.getTime())) {
      return 'Today';
    }
    
    if (isToday(msgDate)) return 'Today';
    if (isYesterday(msgDate)) return 'Yesterday';
    if (isThisYear(msgDate)) return format(msgDate, 'EEEE, MMMM d');
    return format(msgDate, 'EEEE, MMMM d, yyyy');
  };

  const getMessageStatus = (message: ImessageMessage) => {
    if (message.dateRead) {
      return { icon: CheckCheck, label: `Read ${formatMessageTime(message.dateRead)}`, className: "text-blue-500" };
    } else if (message.dateDelivered) {
      return { icon: Check, label: `Delivered ${formatMessageTime(message.dateDelivered)}`, className: "text-gray-500" };
    } else {
      return { icon: Clock, label: "Sending...", className: "text-gray-400" };
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim() && attachments.length === 0) return;
    if (!selectedConversationId) return;

    // Generate clientGuid that will be used for optimistic update
    const clientGuid = crypto.randomUUID();

    // If replying to an unread message, mark conversation as read
    if (replyingToMessage && !replyingToMessage.dateRead) {
      markAsReadMutation.mutate(selectedConversationId);
    }

    sendMessageMutation.mutate({
      text: messageText,
      replyToMessageId: replyingToMessage?.guid, // Use GUID instead of ID
      attachments,
      clientGuid // Pass to backend for echo back
    });

    // Send typing stop event
    wsSendMessage({
      type: 'imessage:typing-stop',
      conversationId: selectedConversationId
    });
  };

  const handleTyping = () => {
    if (!selectedConversationId) return;
    wsSendMessage({
      type: 'imessage:typing-start',
      conversationId: selectedConversationId
    });
  };

  const handleStopTyping = () => {
    if (!selectedConversationId) return;
    wsSendMessage({
      type: 'imessage:typing-stop',
      conversationId: selectedConversationId
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize audio context and analyzer
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Initialize MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingWaveform([]); // Start with empty waveform
      
      // Start duration timer
      const startTime = Date.now();
      const durationInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(elapsed);
        
        // Stop at 5 minutes
        if (elapsed >= 300) {
          stopRecording();
        }
      }, 100);
      
      // Store interval ref for cleanup
      recordingIntervalRef.current = durationInterval;
      
      // Start progressive waveform sampling (adds one bar every 50ms - gives ~20 bars per second)
      // For a 10 second recording: 200 bars, which will be displayed as maxRecordingBars (100)
      samplingIntervalRef.current = setInterval(() => {
        captureSample();
      }, 50);
      
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Recording Failed",
        description: error.message === 'Permission denied' 
          ? "Microphone permission was denied. Please enable it in your browser settings."
          : "Failed to access microphone. Please check your device settings.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (samplingIntervalRef.current) {
      clearInterval(samplingIntervalRef.current);
      samplingIntervalRef.current = null;
    }
    
    // Cleanup audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    // Note: recordingWaveform already contains all the progressive bars from captureSample
  };

  const cancelRecording = () => {
    stopRecording();
    setRecordedAudio(null);
    setRecordingDuration(0);
    setRecordingWaveform([]);
    setPreviewCurrentTime(0);
    setIsPlayingPreview(false);
  };

  // Capture audio level sample for time-based waveform (adds one bar progressively)
  const captureSample = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Use time domain data for RMS calculation (better loudness metric)
    analyser.getByteTimeDomainData(dataArray);
    
    // Calculate RMS (Root Mean Square) for perceived loudness
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    
    // Convert RMS to 0-255 scale for visualization
    const amplitude = Math.min(255, rms * 255 * 3); // Multiply by 3 for better visual range
    
    // Add this bar to the waveform progressively (left to right)
    setRecordingWaveform(prev => {
      // Limit to ~200 samples (about 10 seconds at 20 samples/sec) to prevent overflow
      const MAX_SAMPLES = 200;
      if (prev.length >= MAX_SAMPLES) {
        // Keep adding but maintain max length by shifting (rolling window)
        return [...prev.slice(1), amplitude];
      }
      return [...prev, amplitude];
    });
  };

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playPreview = () => {
    if (!recordedAudio) return;
    
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    
    const audio = new Audio(URL.createObjectURL(recordedAudio));
    previewAudioRef.current = audio;
    
    audio.addEventListener('timeupdate', () => {
      setPreviewCurrentTime(audio.currentTime);
    });
    
    audio.addEventListener('ended', () => {
      setIsPlayingPreview(false);
      setPreviewCurrentTime(0);
    });
    
    audio.play();
    setIsPlayingPreview(true);
  };

  const pausePreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    }
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudio || !selectedConversationId) return;
    
    try {
      // Create file from recorded audio
      const timestamp = Date.now();
      const fileName = `Voice Message ${timestamp}.webm`;
      const file = new File([recordedAudio], fileName, { type: recordedAudio.type });
      
      // Add to attachments array for sending
      const tempAttachments = [file];
      
      // Generate a unique client GUID for this message
      const clientGuid = crypto.randomUUID();
      
      // Send message with audio attachment
      await sendMessageMutation.mutateAsync({
        text: '',
        attachments: tempAttachments,
        clientGuid: clientGuid
      });
      
      // Clear recording state
      cancelRecording();
      
    } catch (error: any) {
      console.error('Failed to send voice message:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send voice message. Please try again.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const groupedMessages = useMemo(() => {
    if (!messages) return [];
    
    const groups: Array<{ date: string; messages: ImessageMessage[] }> = [];
    let currentDate = '';
    
    messages.forEach(message => {
      // Safely handle date parsing - check if date is valid
      const dateObj = message.dateCreated ? new Date(message.dateCreated) : new Date();
      const messageDate = dateObj.getTime() && !isNaN(dateObj.getTime()) 
        ? startOfDay(dateObj).toISOString() 
        : startOfDay(new Date()).toISOString();
      
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(message);
    });
    
    return groups;
  }, [messages]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    
    // Filter and sort: pinned first, then by lastMessageAt
    return conversations
      .filter(conv => 
        !conversationSearch || 
        conv.displayName.toLowerCase().includes(conversationSearch.toLowerCase()) ||
        conv.participants.some(p => p.toLowerCase().includes(conversationSearch.toLowerCase()))
      )
      .sort((a, b) => {
        // Sort by isPinned first (pinned conversations at top)
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        // Then sort by lastMessageAt (most recent first)
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [conversations, conversationSearch]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);
  const currentTypingUsers = Array.from(typingUsers.values()).filter(
    t => t.conversationId === selectedConversationId && t.isTyping
  );

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-950">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold">Messages</h1>
            <Button 
              size="icon" 
              variant="ghost" 
              className="rounded-full"
              onClick={() => {
                setIsNewConversationMode(true);
                setSelectedConversationId(null);
                setNewConversationPhone("");
                setMessageText("");
                setAttachments([]);
              }}
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search conversations"
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              className="pl-9 bg-gray-100 dark:bg-gray-800 border-0"
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredConversations?.length === 0 && !isNewConversationMode ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No conversations</p>
              <p className="text-sm mt-1">Start a new conversation to begin messaging</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* New Message item - shown when in new conversation mode */}
              {isNewConversationMode && (
                <div
                  className="group relative flex items-center gap-2.5 py-2 px-3 bg-blue-500 dark:bg-blue-600 text-white cursor-pointer"
                  data-testid="conversation-new-message"
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-white/20 text-white">
                        <UserIcon className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <p className="font-semibold text-[15px]">New Message</p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-white hover:bg-white/20 shrink-0 -mr-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNewConversationMode(false);
                          setNewConversationPhone("");
                          setMessageText("");
                          setAttachments([]);
                        }}
                        data-testid="button-close-new-message-item"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {newConversationPhone && (
                      <p className="text-sm text-white/90 truncate">
                        {formatDisplayName(newConversationPhone)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {filteredConversations?.map(conversation => (
                <AlertDialog key={conversation.id}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        className={cn(
                          "group relative flex items-center gap-2.5 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer",
                          selectedConversationId === conversation.id && "bg-blue-50 dark:bg-blue-950 hover:bg-blue-50 dark:hover:bg-blue-950"
                        )}
                        onClick={() => setSelectedConversationId(conversation.id)}
                        data-testid={`conversation-${conversation.id}`}
                      >
                        {/* Unread indicator - BEFORE avatar like iOS */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conversation.unreadCount > 0 && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" data-testid={`unread-indicator-${conversation.id}`} />
                          )}
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={conversation.avatarUrl} />
                            <AvatarFallback 
                              className="text-white font-semibold flex items-center justify-center"
                              style={{ backgroundColor: getAvatarColorFromString(conversation.chatGuid || conversation.displayName) }}
                            >
                              {getInitials(conversation.displayName) ? (
                                getInitials(conversation.displayName)
                              ) : (
                                <UserIcon className="h-5 w-5" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <p className="font-semibold text-[15px] truncate">{formatDisplayName(conversation.displayName)}</p>
                              {conversation.isPinned && (
                                <Pin className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" data-testid={`pin-indicator-${conversation.id}`} />
                              )}
                            </div>
                            {conversation.lastMessageAt && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                                {formatMessageTime(new Date(conversation.lastMessageAt).toISOString())}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 flex-1 min-w-0 leading-tight">
                              {conversation.lastMessageText || "No messages yet"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    
                    <ContextMenuContent>
                      {conversation.isPinned ? (
                        <ContextMenuItem
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            unpinConversationMutation.mutate(conversation.id);
                          }}
                        >
                          <Pin className="h-4 w-4 mr-2" />
                          Desfijar conversación
                        </ContextMenuItem>
                      ) : (
                        <ContextMenuItem
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            pinConversationMutation.mutate(conversation.id);
                          }}
                        >
                          <Pin className="h-4 w-4 mr-2" />
                          Fijar conversación
                        </ContextMenuItem>
                      )}
                      
                      <AlertDialogTrigger asChild>
                        <ContextMenuItem className="cursor-pointer text-red-600 dark:text-red-400" onSelect={(e) => e.preventDefault()}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar conversación
                        </ContextMenuItem>
                      </AlertDialogTrigger>
                    </ContextMenuContent>
                  </ContextMenu>
                  
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminar conversación</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Estás seguro de que quieres eliminar esta conversación con {formatDisplayName(conversation.displayName)}? Esta acción no se puede deshacer y eliminará todos los mensajes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteConversationMutation.mutate(conversation.id)}
                        disabled={deleteConversationMutation.isPending}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid={`button-confirm-delete-${conversation.id}`}
                      >
                        {deleteConversationMutation.isPending ? "Eliminando..." : "Eliminar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      {isNewConversationMode ? (
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
          {/* New Message Header */}
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-gray-600 dark:text-gray-400 font-medium">To:</span>
              <input
                type="tel"
                placeholder="Name or Number"
                value={newConversationPhone}
                onChange={(e) => {
                  const formatted = formatPhoneInput(e.target.value);
                  setNewConversationPhone(formatted);
                }}
                className="flex-1 bg-transparent border-0 outline-none placeholder:text-gray-400"
                data-testid="input-new-message-phone"
                autoFocus
              />
            </div>
          </div>

          {/* Empty Messages Area */}
          <div className="flex-1 bg-white dark:bg-gray-900"></div>

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={file.name}
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-gray-500" />
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              {/* Attachment button */}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                data-testid="attach-button"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              {/* Message input */}
              <Input
                ref={messageInputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && newConversationPhone && (messageText.trim() || attachments.length > 0)) {
                    e.preventDefault();
                    sendNewConversationMutation.mutate({
                      to: newConversationPhone,
                      text: messageText,
                      attachments: attachments.length > 0 ? attachments : undefined
                    });
                  }
                }}
                placeholder="iMessage"
                className="flex-1 border-0 bg-gray-100 dark:bg-gray-800 rounded-full px-4 focus-visible:ring-2 focus-visible:ring-blue-500"
                disabled={sendNewConversationMutation.isPending}
                data-testid="message-input"
              />

              {/* Emoji picker */}
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                    data-testid="emoji-button"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  side="top" 
                  align="end" 
                  className="w-full p-0 border-0"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: any) => {
                      const cursorPosition = messageInputRef.current?.selectionStart || messageText.length;
                      const textBeforeCursor = messageText.slice(0, cursorPosition);
                      const textAfterCursor = messageText.slice(cursorPosition);
                      const newText = textBeforeCursor + emoji.native + textAfterCursor;
                      setMessageText(newText);
                      setShowEmojiPicker(false);
                      
                      setTimeout(() => {
                        messageInputRef.current?.focus();
                        const newCursorPosition = cursorPosition + emoji.native.length;
                        messageInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
                      }, 0);
                    }}
                    theme="auto"
                    previewPosition="none"
                    skinTonePosition="none"
                  />
                </PopoverContent>
              </Popover>

              {/* Send button */}
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full text-blue-500 hover:text-blue-600 disabled:opacity-50"
                onClick={() => {
                  if (newConversationPhone && (messageText.trim() || attachments.length > 0)) {
                    sendNewConversationMutation.mutate({
                      to: newConversationPhone,
                      text: messageText,
                      attachments: attachments.length > 0 ? attachments : undefined
                    });
                  }
                }}
                disabled={!newConversationPhone || (!messageText.trim() && attachments.length === 0) || sendNewConversationMutation.isPending}
                data-testid="send-button"
              >
                {sendNewConversationMutation.isPending ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : selectedConversation ? (
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
          {/* Chat Header */}
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedConversation.avatarUrl} />
                  <AvatarFallback 
                    className="text-white font-semibold flex items-center justify-center"
                    style={{ backgroundColor: getAvatarColorFromString(selectedConversation.chatGuid || selectedConversation.displayName) }}
                  >
                    {getInitials(selectedConversation.displayName) ? (
                      getInitials(selectedConversation.displayName)
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p 
                    className="font-semibold cursor-pointer hover:text-blue-500 transition-colors" 
                    onClick={() => setShowContactInfo(true)}
                    data-testid="button-show-contact-info"
                  >
                    {formatDisplayName(selectedConversation.displayName)}
                  </p>
                  {currentTypingUsers.length > 0 && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      {currentTypingUsers.map(u => u.userName).join(', ')} typing
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="rounded-full">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="rounded-full">
                  <Video className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="rounded-full">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-6 py-4">
            {messagesLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className={cn("h-12 rounded-2xl", i % 2 === 0 ? "w-1/2" : "w-1/2 ml-auto")} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedMessages.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center justify-center my-3">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDateSeparator(group.date)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.messages.map((message, idx) => {
                        const prevMessage = idx > 0 ? group.messages[idx - 1] : null;
                        const nextMessage = idx < group.messages.length - 1 ? group.messages[idx + 1] : null;
                        const showAvatar = !message.isFromMe && (!nextMessage || nextMessage.isFromMe || nextMessage.senderAddress !== message.senderAddress);
                        const isFirstInGroup = !prevMessage || prevMessage.isFromMe !== message.isFromMe || prevMessage.senderAddress !== message.senderAddress;
                        const isLastInGroup = !nextMessage || nextMessage.isFromMe !== message.isFromMe || nextMessage.senderAddress !== message.senderAddress;
                        const status = message.isFromMe ? getMessageStatus(message) : null;
                        const replyToMessage = message.replyToMessageId ? messages?.find(m => m.id === message.replyToMessageId) : null;

                        return (
                          <div
                            key={message.guid || message.id}
                            data-testid={`message-${message.id}`}
                            className={cn(
                              "flex items-end gap-2 group",
                              message.isFromMe ? "justify-end" : "justify-start",
                              !isFirstInGroup && "mt-0.5"
                            )}
                          >
                            <div className={cn("max-w-[65%] relative group/message", message.isFromMe && "text-right")}>
                              {/* Reply indicator */}
                              {replyToMessage && (
                                <div className={cn(
                                  "text-xs mb-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800",
                                  message.isFromMe && "ml-auto"
                                )}>
                                  <p className="font-medium">{replyToMessage.senderName || 'You'}</p>
                                  <p className="text-gray-600 truncate">{replyToMessage.text}</p>
                                </div>
                              )}

                              {/* Message bubble with context menu */}
                              <ContextMenu>
                                <ContextMenuTrigger>
                                  <div
                                    className={cn(
                                      "relative inline-block px-4 py-2.5 rounded-2xl",
                                      message.isFromMe
                                        ? "text-white"
                                        : "text-black dark:text-gray-100",
                                      isSelectionMode && selectedMessages.has(message.id) && "ring-2 ring-blue-400"
                                    )}
                                    style={message.isFromMe ? { backgroundColor: '#007AFF' } : { backgroundColor: '#E5E5EA' }}
                                    onClick={() => {
                                      if (isSelectionMode) {
                                        setSelectedMessages(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(message.id)) {
                                            newSet.delete(message.id);
                                          } else {
                                            newSet.add(message.id);
                                          }
                                          return newSet;
                                        });
                                      }
                                    }}
                                  >
                                    {/* Message text */}
                                    {message.text && <p className="break-words whitespace-pre-wrap">{message.text}</p>}
                                    
                                    {/* Attachments - iMessage style with gray background wrapper */}
                                    {message.hasAttachments && message.attachments.length > 0 && (
                                      <div className={cn(
                                        "rounded-3xl overflow-hidden inline-block bg-gray-200 dark:bg-gray-700 flex flex-col gap-1 p-1.5",
                                        message.text ? "mt-2" : ""
                                      )}>
                                        {message.attachments.map(attachment => {
                                          // WebM files can be audio-only but BlueBubbles returns them as video/webm
                                          // Detect audio by:
                                          // 1. Explicit width/height === 0 (BlueBubbles marks audio this way)
                                          // 2. Missing width/height AND small file size (< 50KB)
                                          // 3. Missing dimensions defaults to undefined, so use == to catch both 0 and undefined
                                          const hasNoDimensions = attachment.width == 0 || attachment.height == 0 || 
                                            (attachment.width === undefined && attachment.height === undefined);
                                          const isAudioWebm = attachment.mimeType === 'video/webm' && 
                                            (hasNoDimensions || attachment.fileSize < 50000);
                                          
                                          return (
                                            <div key={attachment.url}>
                                              {(attachment.mimeType?.startsWith('image/') ?? false) ? (
                                                <ImessageAttachmentImage 
                                                  url={attachment.url}
                                                  alt={attachment.fileName}
                                                />
                                              ) : ((attachment.mimeType?.startsWith('audio/') ?? false) || isAudioWebm) ? (
                                                <ImessageAudioMessage
                                                  url={attachment.url}
                                                  fileName={attachment.fileName}
                                                  waveform={attachment.metadata?.waveform}
                                                />
                                              ) : (attachment.mimeType?.startsWith('video/') ?? false) ? (
                                                <ImessageAttachmentVideo 
                                                  url={attachment.url}
                                                  fileName={attachment.fileName}
                                                />
                                              ) : (
                                                <ImessageAttachmentFile 
                                                  attachment={attachment}
                                                />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Reactions - iMessage style */}
                                    {message.reactions && message.reactions.length > 0 && (
                                      <div className={cn(
                                        "absolute -bottom-2 flex gap-0.5",
                                        message.isFromMe ? "-left-2" : "-right-2"
                                      )}>
                                        {Array.from(new Set(message.reactions.map(r => r.reaction))).map(reaction => {
                                          const count = message.reactions?.filter(r => r.reaction === reaction).length || 0;
                                          return (
                                            <div
                                              key={reaction}
                                              className="flex items-center justify-center w-7 h-7 rounded-full shadow-md border-2 border-white dark:border-gray-900"
                                              style={{ backgroundColor: '#007AFF' }}
                                              title={`${count} reaction${count > 1 ? 's' : ''}`}
                                            >
                                              <span className="text-sm leading-none">{reaction}</span>
                                              {count > 1 && (
                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                                  {count}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                                  {/* Tapback submenu */}
                                  <ContextMenuSub>
                                    <ContextMenuSubTrigger className="cursor-pointer">
                                      Tapback
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                                      <div className="flex gap-1 p-2">
                                        {TAPBACK_REACTIONS.map(({ emoji, label }) => (
                                          <Button
                                            key={emoji}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={() => addReactionMutation.mutate({ messageId: message.guid, reaction: emoji })}
                                            title={label}
                                          >
                                            {emoji}
                                          </Button>
                                        ))}
                                      </div>
                                    </ContextMenuSubContent>
                                  </ContextMenuSub>
                                  
                                  {/* Reply option */}
                                  <ContextMenuItem
                                    className="cursor-pointer"
                                    onClick={() => setReplyingToMessage(message)}
                                  >
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                  </ContextMenuItem>
                                  
                                  {/* Copy option */}
                                  <ContextMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {
                                      navigator.clipboard.writeText(message.text);
                                      toast({
                                        title: "Copied to clipboard",
                                        description: "Message text copied successfully"
                                      });
                                    }}
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy
                                  </ContextMenuItem>
                                  
                                  {/* Delete option */}
                                  <ContextMenuItem
                                    className="cursor-pointer text-red-600 dark:text-red-400"
                                    onClick={() => deleteMessageMutation.mutate(message.guid)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>

                              {/* Message time - ALWAYS visible */}
                              <div className={cn("mt-0.5 flex items-center gap-1.5", message.isFromMe ? "justify-end" : "justify-start")}>
                                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                  {formatMessageTime(message.dateCreated)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Reply indicator */}
          {replyingToMessage && (
            <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Reply className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Replying to {replyingToMessage.senderName || 'yourself'}</p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">{replyingToMessage.text}</p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setReplyingToMessage(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={file.name}
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-gray-500" />
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
            {/* Show recording interface when recording or have recorded audio */}
            {(isRecording || recordedAudio) ? (
              <div className="flex items-center gap-3">
                {/* Recording interface */}
                {isRecording ? (
                  <>
                    {/* Cancel button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      onClick={cancelRecording}
                      data-testid="cancel-recording-button"
                    >
                      <X className="h-5 w-5" />
                    </Button>

                    {/* Waveform visualization during recording */}
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 flex items-center gap-3">
                      {/* Recording indicator */}
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      
                      {/* Waveform bars */}
                      <div className="flex-1 flex items-center gap-[2px]" style={{ 
                        height: '32px'
                      }}>
                        {resampleWaveform(recordingWaveform, DISPLAY_BAR_COUNT).map((amplitude, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-blue-500 rounded-sm"
                            style={{ 
                              minWidth: '2px',
                              maxWidth: '3px',
                              height: amplitude > 0 ? `${Math.max(5, Math.min(32, (amplitude / 255) * 32))}px` : '5px'
                            }}
                          />
                        ))}
                      </div>
                      
                      {/* Duration */}
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {formatRecordingTime(recordingDuration)}
                      </span>
                    </div>

                    {/* Stop button */}
                    <Button
                      size="icon"
                      className="rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={stopRecording}
                      data-testid="stop-recording-button"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  </>
                ) : recordedAudio ? (
                  <>
                    {/* Playback interface after recording */}
                    {/* Delete button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                      onClick={cancelRecording}
                      data-testid="delete-recording-button"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>

                    {/* Playback waveform */}
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 flex items-center gap-3">
                      {/* Play/Pause button */}
                      <Button
                        size="icon"
                        className="h-8 w-8 rounded-full bg-gray-600 hover:bg-gray-700 text-white"
                        onClick={isPlayingPreview ? pausePreview : playPreview}
                        data-testid="preview-play-button"
                      >
                        {isPlayingPreview ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5 ml-0.5" />
                        )}
                      </Button>
                      
                      {/* Static waveform with progress indicator */}
                      <div className="flex-1 relative">
                        <div className="flex items-center gap-[2px]" style={{ 
                          height: '32px'
                        }}>
                          {resampleWaveform(recordingWaveform, DISPLAY_BAR_COUNT).map((amplitude, i) => {
                            const progress = recordingDuration > 0 
                              ? previewCurrentTime / recordingDuration 
                              : 0;
                            const isPlayed = i < DISPLAY_BAR_COUNT * progress;
                            
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "flex-1 rounded-sm transition-colors duration-200",
                                  isPlayed ? "bg-blue-500" : "bg-gray-400 dark:bg-gray-500"
                                )}
                                style={{ 
                                  minWidth: '2px',
                                  maxWidth: '3px',
                                  height: amplitude > 0 ? `${Math.max(5, Math.min(32, (amplitude / 255) * 32))}px` : '5px'
                                }}
                              />
                            );
                          })}
                        </div>
                        
                        {/* Progress line indicator */}
                        {isPlayingPreview && recordingDuration > 0 && (
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all duration-100"
                            style={{ 
                              left: `${(previewCurrentTime / recordingDuration) * 100}%`,
                              boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)'
                            }}
                          >
                            {/* Playhead dot */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
                          </div>
                        )}
                      </div>
                      
                      {/* Duration with current time */}
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400 min-w-[65px] text-right">
                        {isPlayingPreview 
                          ? `${formatRecordingTime(Math.floor(previewCurrentTime))} / ${formatRecordingTime(recordingDuration)}`
                          : formatRecordingTime(recordingDuration)
                        }
                      </span>
                    </div>

                    {/* Send button */}
                    <Button
                      size="icon"
                      className="rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={sendVoiceMessage}
                      data-testid="send-voice-button"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Microphone button - moved to first */}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={cn(
                    "rounded-full transition-colors",
                    isRecording 
                      ? "text-blue-500 hover:text-blue-600" 
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  )}
                  onClick={startRecording}
                  data-testid="microphone-button"
                >
                  <Mic className="h-5 w-5" />
                </Button>

                {/* Image/Gallery button - moved to second */}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="gallery-button"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>

                {/* Location button - moved to third */}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  data-testid="location-button"
                >
                  <MapPin className="h-5 w-5" />
                </Button>

                {/* Text input with emoji picker */}
                <div className="flex-1 relative bg-gray-100 dark:bg-gray-800 rounded-full flex items-center px-4 py-2">
                  <input
                    ref={messageInputRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onFocus={handleTyping}
                    onBlur={handleStopTyping}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="iMessage"
                    className={cn(
                      "flex-1 bg-transparent border-0 outline-none pr-2",
                      "placeholder:text-gray-500"
                    )}
                    data-testid="message-input"
                  />
                  
                  {/* Emoji picker button inside input */}
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                        data-testid="emoji-button"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      side="top" 
                      align="end" 
                      className="w-full p-0 border-0"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <Picker
                        data={data}
                        onEmojiSelect={(emoji: any) => {
                          const cursorPosition = messageInputRef.current?.selectionStart || messageText.length;
                          const textBeforeCursor = messageText.slice(0, cursorPosition);
                          const textAfterCursor = messageText.slice(cursorPosition);
                          const newText = textBeforeCursor + emoji.native + textAfterCursor;
                          setMessageText(newText);
                          setShowEmojiPicker(false);
                          
                          // Focus back on input
                          setTimeout(() => {
                            messageInputRef.current?.focus();
                            const newCursorPosition = cursorPosition + emoji.native.length;
                            messageInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
                          }, 0);
                        }}
                        theme="auto"
                        previewPosition="none"
                        skinTonePosition="none"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Send button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-blue-500 hover:text-blue-600 disabled:opacity-50"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() && attachments.length === 0}
                  data-testid="send-button"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">iMessage on Bulk Solutions</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Send and receive iMessages right from your dashboard. Select a conversation to start chatting.
            </p>
            {!isConnected && (
              <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Connecting to BlueBubbles server...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input - accepts all file types */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="file-input"
      />

      {/* Contact Info Sheet */}
      <Sheet open={showContactInfo} onOpenChange={setShowContactInfo}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Contact Information</SheetTitle>
            <SheetDescription>
              Details for this conversation
            </SheetDescription>
          </SheetHeader>
          
          <ContactInfoContent 
            phone={selectedConversation?.contactPhone || selectedConversation?.participants?.[0]} 
            displayName={selectedConversation?.displayName}
          />
        </SheetContent>
      </Sheet>

    </div>
  );
}

// Contact Info Component
function ContactInfoContent({ phone, displayName }: { phone?: string; displayName?: string }) {
  const [, setLocation] = useLocation();
  const { data: contact, isLoading } = useQuery({
    queryKey: ['/api/contacts/search-by-phone', phone],
    enabled: !!phone && isValidPhoneNumber(phone),
  });

  if (isLoading) {
    return <LoadingSpinner fullScreen={false} text="Loading contact..." />;
  }

  if (!contact || (Array.isArray(contact) && contact.length === 0)) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <UserIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No contact information available</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{displayName || phone}</p>
          </div>
        </div>
      </div>
    );
  }

  const contactData = Array.isArray(contact) ? contact[0] : contact;

  return (
    <div className="mt-6 space-y-6">
      {/* Avatar */}
      <div className="flex items-center justify-center">
        <Avatar className="h-24 w-24">
          <AvatarFallback 
            className="text-white font-semibold text-2xl flex items-center justify-center"
            style={{ backgroundColor: getAvatarColorFromString(contactData.phone || contactData.email || '') }}
          >
            {getInitials(contactData.firstName || contactData.lastName || displayName || '')}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Name */}
      <div className="text-center">
        <h3 className="text-xl font-semibold">
          {[contactData.firstName, contactData.lastName].filter(Boolean).join(' ') || displayName || 'Unknown Contact'}
        </h3>
      </div>

      {/* Contact Details */}
      <div className="space-y-4">
        {contactData.phone && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</label>
            <p className="text-sm">{formatForDisplay(contactData.phone)}</p>
          </div>
        )}

        {contactData.email && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
            <p className="text-sm">{contactData.email}</p>
          </div>
        )}

        {contactData.notes && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</label>
            <p className="text-sm text-gray-600 dark:text-gray-300">{contactData.notes}</p>
          </div>
        )}

        {contactData.createdAt && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Added</label>
            <p className="text-sm">{format(new Date(contactData.createdAt), 'PPP')}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 space-y-2">
        <Button 
          className="w-full" 
          variant="outline"
          onClick={() => setLocation(`/contacts?id=${contactData.id}`)}
          data-testid="button-view-full-contact"
        >
          <UserIcon className="h-4 w-4 mr-2" />
          View Full Contact
        </Button>
      </div>
    </div>
  );
}