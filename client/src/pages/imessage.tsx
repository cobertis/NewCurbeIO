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
  Smile, Image as ImageIcon, FileText, Mic, Camera, Plus, MessageCircle, MessageSquare
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
  const documentInputRef = useRef<HTMLInputElement>(null);
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
  const [showAttachmentDialog, setShowAttachmentDialog] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingIndicator>>(new Map());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isConnected, setIsConnected] = useState(true); // BlueBubbles is working, webhooks are arriving

  // WebSocket message handler - define before using in useWebSocket
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'imessage:new-message':
        queryClient.invalidateQueries({ queryKey: ['/api/imessage/messages', message.conversationId] });
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
        queryClient.invalidateQueries({ queryKey: ['/api/imessage/messages', message.conversationId] });
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
    refetchInterval: 5000
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { text: string; effectId?: string; replyToMessageId?: string; attachments?: File[] }) => {
      // If we have attachments, use FormData, otherwise use JSON
      if (data.attachments && data.attachments.length > 0) {
        const formData = new FormData();
        formData.append('conversationId', selectedConversationId!);
        formData.append('text', data.text);
        if (data.effectId) formData.append('effectId', data.effectId);
        if (data.replyToMessageId) formData.append('replyToMessageId', data.replyToMessageId);
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
          replyToGuid: data.replyToMessageId
        });
      }
    },
    onSuccess: () => {
      setMessageText("");
      setSelectedEffect(null);
      setReplyingToMessage(null);
      setAttachments([]);
      if (soundEnabled) playSound('send');
      queryClient.invalidateQueries({ queryKey: [`/api/imessage/conversations/${selectedConversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/imessage/conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive"
      });
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

  // Helper functions
  const playSound = (type: 'send' | 'receive') => {
    if (!soundEnabled) return;
    const audio = new Audio(type === 'send' ? '/sounds/imessage-send.mp3' : '/sounds/imessage-receive.mp3');
    audio.play().catch(console.error);
  };

  const formatMessageTime = (date: string) => {
    const msgDate = new Date(date);
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

    sendMessageMutation.mutate({
      text: messageText,
      effectId: selectedEffect || undefined,
      replyToMessageId: replyingToMessage?.id,
      attachments
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
    setShowAttachmentDialog(false);
  };

  const groupedMessages = useMemo(() => {
    if (!messages) return [];
    
    const groups: Array<{ date: string; messages: ImessageMessage[] }> = [];
    let currentDate = '';
    
    messages.forEach(message => {
      const messageDate = startOfDay(new Date(message.dateCreated)).toISOString();
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
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={cn(
                    "w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left",
                    selectedConversationId === conversation.id && "bg-blue-50 dark:bg-blue-950 hover:bg-blue-50 dark:hover:bg-blue-950"
                  )}
                  data-testid={`conversation-${conversation.id}`}
                >
                  <div className="flex items-start gap-3">
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
                  </div>
                </button>
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
                            key={message.id}
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
                                    <p className="break-words whitespace-pre-wrap">{message.text}</p>
                                    
                                    {/* Attachments */}
                                    {message.hasAttachments && message.attachments.length > 0 && (
                                      <div className="mt-2 space-y-2">
                                        {message.attachments.map(attachment => (
                                          <div key={attachment.id} className="rounded-lg overflow-hidden">
                                            {attachment.mimeType.startsWith('image/') ? (
                                              <img 
                                                src={attachment.url} 
                                                alt={attachment.fileName}
                                                className="max-w-full rounded-lg"
                                              />
                                            ) : (
                                              <div className="flex items-center gap-2 p-2 bg-white/10 rounded">
                                                <FileText className="h-4 w-4" />
                                                <span className="text-sm">{attachment.fileName}</span>
                                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                                  <Download className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Reactions */}
                                    {message.reactions.length > 0 && (
                                      <div className="absolute -bottom-3 right-2 flex gap-1">
                                        {Array.from(new Set(message.reactions.map(r => r.reaction))).map(reaction => (
                                          <span
                                            key={reaction}
                                            className="bg-white dark:bg-gray-700 rounded-full px-1.5 py-0.5 text-xs shadow-sm border border-gray-200 dark:border-gray-600"
                                          >
                                            {reaction}
                                            {message.reactions.filter(r => r.reaction === reaction).length > 1 && (
                                              <span className="ml-1 text-gray-500">
                                                {message.reactions.filter(r => r.reaction === reaction).length}
                                              </span>
                                            )}
                                          </span>
                                        ))}
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
              {/* Attachment button */}
              <Popover open={showAttachmentDialog} onOpenChange={setShowAttachmentDialog}>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="rounded-full">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48" side="top">
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowAttachmentDialog(false);
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Photo/Video
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        documentInputRef.current?.click();
                        setShowAttachmentDialog(false);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Document
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setShowAttachmentDialog(false);
                      }}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Camera
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

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

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={documentInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.rtf,.pages,.odt"
        onChange={handleFileSelect}
        className="hidden"
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