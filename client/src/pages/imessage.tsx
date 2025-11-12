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
  Smile, Image as ImageIcon, FileText, Mic, Camera, Plus, MessageCircle, MessageSquare, Eye
} from "lucide-react";
import type { User } from "@shared/schema";

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

const MESSAGE_EFFECTS = {
  slam: { name: "Slam", className: "animate-slam" },
  gentle: { name: "Gentle", className: "animate-gentle" },
  loud: { name: "Loud", className: "animate-loud" },
  invisible: { name: "Invisible Ink", className: "animate-invisible" },
  echo: { name: "Echo", className: "animate-echo" },
  spotlight: { name: "Spotlight", className: "animate-spotlight" }
} as const;

type MessageEffectKey = keyof typeof MESSAGE_EFFECTS;

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
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [selectedEffect, setSelectedEffect] = useState<MessageEffectKey | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<ImessageMessage | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showEffectsPicker, setShowEffectsPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isConnected, setIsConnected] = useState(true); // BlueBubbles is working, webhooks are arriving

  // WebSocket message handler - define before using in useWebSocket
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'imessage:new-message':
        // Merge message into cache instead of invalidating to prevent flicker
        if (message.conversationId === selectedConversationId && message.message) {
          queryClient.setQueryData<ImessageMessage[]>(
            [`/api/imessage/conversations/${selectedConversationId}/messages`],
            (old) => {
              if (!old) return [message.message];
              // Check if message already exists (dedup by GUID)
              const exists = old.some(m => m.guid === message.message.guid);
              if (exists) return old;
              // Add new message to the end
              return [...old, message.message];
            }
          );
        }
        queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
        if (soundEnabled && message.conversationId === selectedConversationId) {
          playSound('receive');
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
                      reaction: message.reaction,
                      senderHandle: message.sender || 'Unknown',
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
      setSelectedEffect(null);
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
      effectId: selectedEffect || undefined,
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
                    <AvatarFallback className="bg-blue-500 text-white">
                      {conversation.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
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
                  <AvatarFallback className="bg-blue-500 text-white">
                    {selectedConversation.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
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
                            {!message.isFromMe && (
                              <div className="w-8">
                                {showAvatar && (
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-gray-300">
                                      {message.senderName?.[0]?.toUpperCase() || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            )}
                            
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
                                        {message.attachments.map(attachment => (
                                          <div key={attachment.id}>
                                            {attachment.mimeType.startsWith('image/') ? (
                                              <ImessageAttachmentImage 
                                                url={attachment.url}
                                                alt={attachment.fileName}
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
                                        ))}
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

                            {message.isFromMe && <div className="w-8" />}
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
            <div className="flex items-end gap-2">
              {/* Attachment button - simplified */}
              <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
                data-testid="attachment-button"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              {/* Effects button */}
              <Popover open={showEffectsPicker} onOpenChange={setShowEffectsPicker}>
                <PopoverTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className={cn("rounded-full", selectedEffect && "text-blue-500")}
                  >
                    <span className="text-xl">✨</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48" side="top">
                  <div className="space-y-1">
                    {Object.entries(MESSAGE_EFFECTS).map(([id, effect]) => (
                      <Button
                        key={id}
                        variant={selectedEffect === id ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedEffect(selectedEffect === id ? null : id);
                          setShowEffectsPicker(false);
                        }}
                      >
                        {effect.name}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Message input */}
              <div className="flex-1 relative">
                <textarea
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
                    "w-full px-4 py-2 rounded-full resize-none",
                    "bg-gray-100 dark:bg-gray-800 border-0",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500",
                    "placeholder:text-gray-500"
                  )}
                  rows={1}
                  data-testid="message-input"
                />
                {selectedEffect && (
                  <Badge 
                    className="absolute top-1/2 right-12 -translate-y-1/2 bg-blue-500 text-white"
                  >
                    {MESSAGE_EFFECTS[selectedEffect].name}
                  </Badge>
                )}
              </div>

              {/* Send button */}
              <Button
                size="icon"
                className="rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                onClick={handleSendMessage}
                disabled={!messageText.trim() && attachments.length === 0}
                data-testid="send-button"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="text-center">
            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">iMessage on Bulk Solutions</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
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

      {/* Custom CSS for message effects */}
      <style>{`
        @keyframes slam {
          0% { transform: scale(1.5) rotate(-5deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        
        @keyframes gentle {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes loud {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.1); }
          50% { transform: scale(0.95); }
          75% { transform: scale(1.05); }
        }
        
        .animate-slam { animation: slam 0.5s ease-out; }
        .animate-gentle { animation: gentle 0.5s ease-out; }
        .animate-loud { animation: loud 0.5s ease-out; }
      `}</style>
    </div>
  );
}