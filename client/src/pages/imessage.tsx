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
  Smile, Image as ImageIcon, FileText, Mic, Camera, Plus, MessageCircle, MessageSquare, Eye, User as UserIcon, MapPin, Play, Pause, AudioWaveform
} from "lucide-react";
import type { User } from "@shared/schema";

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

// Updated interface types for BlueBubbles integration
interface ImessageConversation {
  id: string;
  companyId: string;
  chatGuid: string;
  displayName: string;
  participants: string[];
  lastMessageText?: string;
  lastMessageTime?: string;
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

// Component to handle authenticated video loading with thumbnail and play button
function ImessageAttachmentVideo({ url, fileName }: { url: string; fileName: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    
    fetch(url, {
      credentials: 'include', // Include session cookies
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        console.error('[iMessage] Failed to load video:', url, err);
        setError(true);
      });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  if (error) {
    return <div className="text-xs text-gray-500">Failed to load video</div>;
  }

  if (!blobUrl) {
    return <div className="h-32 w-48 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />;
  }

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
          src={blobUrl}
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
            src={blobUrl}
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

// Component to handle authenticated image loading with thumbnail and full-size preview
function ImessageAttachmentImage({ url, alt }: { url: string; alt: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    
    fetch(url, {
      credentials: 'include', // Include session cookies
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        console.error('[iMessage] Failed to load attachment:', url, err);
        setError(true);
      });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  if (error) {
    return <div className="text-xs text-gray-500">Failed to load image</div>;
  }

  if (!blobUrl) {
    return <div className="h-32 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />;
  }

  return (
    <>
      {/* Thumbnail with eye icon */}
      <div 
        className="relative group cursor-pointer"
        onClick={() => setIsOpen(true)}
        data-testid="attachment-thumbnail"
      >
        <img 
          src={blobUrl} 
          alt={alt} 
          className="rounded-2xl object-cover"
          style={{ maxHeight: '250px', maxWidth: '200px' }}
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
            src={blobUrl} 
            alt={alt} 
            className="w-full h-full max-h-[85vh] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Component to display audio messages with waveform visualization
function ImessageAudioMessage({ url, fileName }: { url: string; fileName: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Fetch audio with credentials
  useEffect(() => {
    let objectUrl: string | null = null;
    
    fetch(url, {
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        console.error('[iMessage] Failed to load audio:', url, err);
      });

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
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
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate random waveform bars for visualization
  const waveformBars = useMemo(() => {
    return Array.from({ length: 40 }, () => Math.random() * 100);
  }, []);

  return (
    <div className="flex items-center gap-2 min-w-[280px] max-w-[320px] p-2">
      {blobUrl && (
        <audio ref={audioRef} src={blobUrl} preload="metadata" />
      )}
      
      {/* Play/Pause Button */}
      <Button
        size="icon"
        onClick={togglePlay}
        className="rounded-full h-9 w-9 flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white"
        disabled={!blobUrl}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>

      {/* Waveform Visualization */}
      <div className="flex-1 flex items-center gap-[2px] h-8">
        {waveformBars.map((height, i) => {
          const progress = duration > 0 ? currentTime / duration : 0;
          const isActive = i < waveformBars.length * progress;
          
          return (
            <div
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-colors",
                isActive ? "bg-blue-500" : "bg-gray-400"
              )}
              style={{ 
                height: `${Math.max(10, height * 0.6)}%`,
              }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className="text-xs text-gray-600 dark:text-gray-400 font-mono flex-shrink-0 w-10 text-right">
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<ImessageMessage | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isConnected, setIsConnected] = useState(true); // BlueBubbles is working, webhooks are arriving
  // Audio recording state machine: idle | recording | preview
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [waveformRenderKey, setWaveformRenderKey] = useState(0); // Trigger re-renders periodically
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Fixed-size buffer for performance
  const waveformBufferRef = useRef<number[]>(new Array(100).fill(0));
  const waveformIndexRef = useRef(0); // How many values captured so far
  const frameCountRef = useRef(0); // For throttled UI updates
  const waveformPreviewRef = useRef<number[]>([]); // Frozen snapshot for preview
  const waveformPreviewIndexRef = useRef(0); // How many samples in preview

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
    
    if (isToday(msgDate)) {
      return format(msgDate, 'h:mm a');
    } else if (isYesterday(msgDate)) {
      return `Yesterday ${format(msgDate, 'h:mm a')}`;
    } else if (isThisWeek(msgDate)) {
      return format(msgDate, 'EEEE h:mm a');
    } else if (isThisYear(msgDate)) {
      return format(msgDate, 'MMM d, h:mm a');
    } else {
      return format(msgDate, 'MMM d, yyyy h:mm a');
    }
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

  // Audio waveform analysis - captures waveform progressively with fixed buffer
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume for this moment
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedValue = Math.max(0.05, average / 255); // Normalize to 0-1, min 0.05
    
    // Update buffer (circular if we exceed 100 samples)
    const currentIndex = waveformIndexRef.current % 100;
    waveformBufferRef.current[currentIndex] = normalizedValue;
    waveformIndexRef.current++;
    
    // Throttle React re-renders: only update UI every 5 frames (~12 updates/sec instead of 60)
    frameCountRef.current++;
    if (frameCountRef.current % 5 === 0) {
      setWaveformRenderKey(prev => prev + 1);
    }
    
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  // Audio recording functions
  const startRecording = async () => {
    if (!selectedConversationId) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation before recording a voice message",
        variant: "destructive"
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup Web Audio API for waveform visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Start analyzing audio for waveform
      analyzeAudio();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Freeze waveform buffer for preview (clone to prevent mutation)
        waveformPreviewRef.current = [...waveformBufferRef.current];
        waveformPreviewIndexRef.current = waveformIndexRef.current; // Capture sample count
        
        // Get actual audio duration from the blob
        const audio = new Audio(audioUrl);
        audio.addEventListener('loadedmetadata', () => {
          const actualDuration = Math.floor(audio.duration);
          
          // Transition to preview mode (do NOT auto-send)
          setAudioPreview({
            blob: audioBlob,
            url: audioUrl,
            duration: actualDuration
          });
          setRecordingState('preview');
        });
        
        // Stop audio analysis
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        
        // Release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingDuration(0);
      // Reset waveform buffer for new recording
      waveformBufferRef.current = new Array(100).fill(0);
      waveformIndexRef.current = 0;
      frameCountRef.current = 0;
      setWaveformRenderKey(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record audio messages",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (recordingState === 'recording') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      audioChunksRef.current = [];
      setRecordingState('idle');
      setRecordingDuration(0);
      setWaveformBars([0, 0, 0, 0, 0]);
    }
  };

  const playPreview = () => {
    if (!audioPreview || !audioPreviewRef.current) return;
    
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const sendAudioPreview = async () => {
    if (!audioPreview || !selectedConversationId) return;

    const audioFile = new File([audioPreview.blob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
    const clientGuid = crypto.randomUUID();
    
    sendMessageMutation.mutate({
      text: '',
      replyToMessageId: replyingToMessage?.guid,
      attachments: [audioFile],
      clientGuid
    });

    // Clean up preview
    URL.revokeObjectURL(audioPreview.url);
    setAudioPreview(null);
    setRecordingState('idle');
    setRecordingDuration(0);
    waveformBufferRef.current = new Array(100).fill(0);
    waveformIndexRef.current = 0;
    waveformPreviewRef.current = [];
    waveformPreviewIndexRef.current = 0;
    setIsPlayingPreview(false);
  };

  const cancelPreview = () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview.url);
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    }
    setAudioPreview(null);
    setRecordingState('idle');
    setRecordingDuration(0);
    waveformBufferRef.current = new Array(100).fill(0);
    waveformIndexRef.current = 0;
    waveformPreviewRef.current = [];
    waveformPreviewIndexRef.current = 0;
    setIsPlayingPreview(false);
  };

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState]);

  // Audio preview element for playback
  useEffect(() => {
    if (audioPreview && !audioPreviewRef.current) {
      const audio = new Audio(audioPreview.url);
      audio.onended = () => setIsPlayingPreview(false);
      audioPreviewRef.current = audio;
    }
  }, [audioPreview]);

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
    return conversations.filter(conv => 
      !conversationSearch || 
      conv.displayName.toLowerCase().includes(conversationSearch.toLowerCase()) ||
      conv.participants.some(p => p.toLowerCase().includes(conversationSearch.toLowerCase()))
    );
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
            <Button size="icon" variant="ghost" className="rounded-full">
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
          ) : filteredConversations?.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No conversations</p>
              <p className="text-sm mt-1">Start a new conversation to begin messaging</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredConversations?.map(conversation => (
                <div
                  key={conversation.id}
                  className={cn(
                    "group relative flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer",
                    selectedConversationId === conversation.id && "bg-blue-50 dark:bg-blue-950 hover:bg-blue-50 dark:hover:bg-blue-950"
                  )}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  data-testid={`conversation-${conversation.id}`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conversation.avatarUrl} />
                    <AvatarFallback 
                      className="text-white font-semibold flex items-center justify-center"
                      style={{ backgroundColor: getAvatarColorFromString(conversation.chatGuid || conversation.displayName) }}
                    >
                      {getInitials(conversation.displayName) ? (
                        getInitials(conversation.displayName)
                      ) : (
                        <UserIcon className="h-6 w-6" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium truncate">{conversation.displayName}</p>
                      {conversation.lastMessageTime && (
                        <span className="text-xs text-gray-500">
                          {formatMessageTime(conversation.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {conversation.lastMessageText || "No messages yet"}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <Badge className="bg-blue-500 text-white ml-2">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Dropdown Menu */}
                  <AlertDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-conversation-actions-${conversation.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem className="text-red-600 dark:text-red-400" onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Conversation
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this conversation with {conversation.displayName}? This action cannot be undone and will remove all messages.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteConversationMutation.mutate(conversation.id)}
                          disabled={deleteConversationMutation.isPending}
                          className="bg-red-600 hover:bg-red-700"
                          data-testid={`button-confirm-delete-${conversation.id}`}
                        >
                          {deleteConversationMutation.isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      {selectedConversation ? (
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
                  <p className="font-semibold">{selectedConversation.displayName}</p>
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
                            <div className={cn("max-w-[65%] relative", message.isFromMe && "text-right")}>
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
                                            <div key={attachment.guid || attachment.url}>
                                              {attachment.mimeType.startsWith('image/') ? (
                                                <ImessageAttachmentImage 
                                                  url={attachment.url}
                                                  alt={attachment.fileName}
                                                />
                                              ) : attachment.mimeType.startsWith('audio/') || isAudioWebm ? (
                                                <ImessageAudioMessage
                                                  url={attachment.url}
                                                  fileName={attachment.fileName}
                                                />
                                              ) : attachment.mimeType.startsWith('video/') ? (
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

                              {/* Message time - only on last message in group */}
                              {isLastInGroup && (
                                <div className={cn("mt-1", message.isFromMe ? "text-right" : "text-left")}>
                                  <span className="text-xs text-gray-500">
                                    {formatMessageTime(message.dateCreated)}
                                  </span>
                                </div>
                              )}
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
            {/* STATE 1: IDLE - Normal message input */}
            {recordingState === 'idle' && (
              <div className="flex items-center gap-2">
                {/* Message input with microphone button inside */}
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
                  
                  {/* Audio waveform button - inside input on the right */}
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 rounded-full transition-colors flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startRecording();
                    }}
                    data-testid="mic-button"
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                    >
                      <rect x="2" y="4" width="1.5" height="8" rx="0.75" fill="currentColor" opacity="0.6"/>
                      <rect x="5" y="2" width="1.5" height="12" rx="0.75" fill="currentColor"/>
                      <rect x="8" y="5" width="1.5" height="6" rx="0.75" fill="currentColor" opacity="0.8"/>
                      <rect x="11" y="2" width="1.5" height="12" rx="0.75" fill="currentColor"/>
                      <rect x="14" y="4" width="1.5" height="8" rx="0.75" fill="currentColor" opacity="0.6"/>
                    </svg>
                  </Button>
                </div>

                {/* Image/Gallery button */}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="gallery-button"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>

                {/* Emoji button */}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  data-testid="emoji-button"
                >
                  <Smile className="h-5 w-5" />
                </Button>

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

                {/* Location button */}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  data-testid="location-button"
                >
                  <MapPin className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* STATE 2: RECORDING - Full width recording UI with progressive red waveform */}
            {recordingState === 'recording' && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 py-4 flex items-center gap-4">
                {/* Progressive waveform bars - 100 bars showing recording progress */}
                <div className="flex-1 flex items-center gap-px h-10" key={waveformRenderKey}>
                  {waveformBufferRef.current.map((value, i) => {
                    // For recordings under 100 samples: show progressive fill left-to-right
                    // For longer recordings: all bars show data (circular buffer effect)
                    const totalSamples = waveformIndexRef.current;
                    const hasData = totalSamples >= 100 ? true : i < totalSamples;
                    
                    // Show real amplitude where recorded, flat line where not yet recorded
                    const height = hasData ? Math.max(0.05, value) : 0.05;
                    
                    return (
                      <div
                        key={`recording-bar-${i}`}
                        className="flex-1 bg-red-500 rounded-full transition-all duration-75"
                        style={{ 
                          height: `${height * 100}%`,
                          opacity: hasData ? 1 : 0.3
                        }}
                      />
                    );
                  })}
                </div>

                {/* Timer */}
                <span className="text-gray-700 dark:text-gray-300 font-mono text-sm font-medium min-w-[40px]">
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>

                {/* Stop button (square icon) */}
                <Button
                  size="icon"
                  className="rounded-full bg-red-500 hover:bg-red-600 text-white h-10 w-10"
                  onClick={stopRecording}
                  data-testid="stop-recording-button"
                >
                  <div className="w-4 h-4 bg-white rounded-sm" />
                </Button>
              </div>
            )}

            {/* STATE 3: PREVIEW - Full width preview UI with gray waveform */}
            {recordingState === 'preview' && audioPreview && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 py-4 flex items-center gap-4">
                {/* X button (cancel) */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 h-10 w-10"
                  onClick={cancelPreview}
                  data-testid="cancel-preview-button"
                >
                  <X className="h-5 w-5" />
                </Button>

                {/* Play/Pause button */}
                <Button
                  size="icon"
                  className="rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 h-10 w-10"
                  onClick={playPreview}
                  data-testid="play-preview-button"
                >
                  {isPlayingPreview ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </Button>

                {/* Static waveform bars - 100 bars showing captured recording */}
                <div className="flex-1 flex items-center gap-px h-10">
                  {Array.from({ length: 100 }).map((_, i) => {
                    // For recordings under 100 samples: only show captured bars
                    // For longer recordings: all bars show data (circular buffer)
                    const totalSamples = waveformPreviewIndexRef.current;
                    const hasData = totalSamples >= 100 ? true : i < totalSamples;
                    
                    // Get value from frozen preview buffer
                    const value = hasData && waveformPreviewRef.current[i] ? waveformPreviewRef.current[i] : 0.1;
                    const height = Math.max(0.1, value);
                    
                    return (
                      <div
                        key={`preview-bar-${i}`}
                        className="flex-1 bg-gray-600 dark:bg-gray-500 rounded-full"
                        style={{ 
                          height: `${height * 100}%`,
                          opacity: hasData ? 1 : 0.3
                        }}
                      />
                    );
                  })}
                </div>

                {/* Timer showing duration */}
                <span className="text-gray-600 dark:text-gray-400 font-mono text-sm font-medium min-w-[40px]">
                  {Math.floor(audioPreview.duration / 60)}:{(audioPreview.duration % 60).toString().padStart(2, '0')}
                </span>

                {/* Send button (blue up arrow) */}
                <Button
                  size="icon"
                  className="rounded-full bg-blue-500 hover:bg-blue-600 text-white h-10 w-10"
                  onClick={sendAudioPreview}
                  data-testid="send-audio-button"
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

    </div>
  );
}