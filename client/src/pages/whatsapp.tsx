import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  Search, Send, MoreVertical, Phone, Video, 
  CheckCheck, MessageSquare, RefreshCw, Smile, Paperclip, Lock, ArrowLeft,
  X, Reply, Forward, Star, Download, Info, Copy, Trash2, Archive, Pin, BellOff,
  Users, MapPin, UserPlus, BarChart3, Check, Mic, Clock, StarOff,
  LogOut, ArchiveX, Trash, Bell, PinOff, UserMinus, Shield, ShieldOff, Edit
} from "lucide-react";

// =====================================================
// TYPES & INTERFACES
// =====================================================

type FilterTab = 'all' | 'unread' | 'favorites' | 'groups';

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  lastMessage?: {
    body: string;
    timestamp: number;
    from: string;
  };
  participants?: Array<{
    id: string;
    name: string;
    isAdmin: boolean;
  }>;
  groupMetadata?: {
    subject: string;
    description: string;
  };
}

interface WhatsAppMessage {
  id: string;
  body: string;
  from: string;
  to: string;
  timestamp: number;
  isFromMe: boolean;
  hasMedia: boolean;
  type: string;
  isStarred?: boolean;
  isForwarded?: boolean;
  reactions?: Array<{
    id: string;
    emoji: string;
    from: string;
  }>;
  quotedMsg?: {
    id: string;
    body: string;
    from: string;
  };
  ack?: number; // 0=error, 1=pending, 2=sent, 3=delivered, 4=read
}

interface WhatsAppStatus {
  status: 'authenticated' | 'ready' | 'disconnected' | 'qr' | 'loading';
  qrCode?: string;
  message?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getAvatarColorFromString(str: string): string {
  const colors = [
    '#6B7280', '#EF4444', '#F59E0B', '#10B981', 
    '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  if (!name || name.trim() === '') return '?';
  if (/^[\+\d\s\-\(\)]+$/.test(name.trim())) return '';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'M/d/yy');
  }
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return format(date, 'h:mm a');
}

// =====================================================
// EMOJI PICKER COMPONENT
// =====================================================

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🎉', '🔥'];

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="text-2xl hover:bg-[var(--whatsapp-hover)] rounded p-2 transition-colors"
          data-testid={`emoji-${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// =====================================================
// MESSAGE COMPONENT
// =====================================================

function MessageItem({ 
  message, 
  onReply, 
  onForward, 
  onStar, 
  onDelete, 
  onReact, 
  onDownload,
  onInfo,
  onCopy 
}: { 
  message: WhatsAppMessage;
  onReply: () => void;
  onForward: () => void;
  onStar: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onDownload: () => void;
  onInfo: () => void;
  onCopy: () => void;
}) {
  const renderAckIcon = () => {
    if (!message.isFromMe) return null;
    
    const ack = message.ack ?? 1;
    if (ack === 0) {
      return <Clock className="h-3 w-3 text-red-500" data-testid="icon-error" />;
    } else if (ack === 1 || ack === 2) {
      return <Check className="h-3 w-3 text-[var(--whatsapp-text-tertiary)]" data-testid="icon-sent" />;
    } else if (ack === 3) {
      return <CheckCheck className="h-3 w-3 text-[var(--whatsapp-text-tertiary)]" data-testid="icon-delivered" />;
    } else if (ack === 4) {
      return <CheckCheck className="h-3 w-3 text-[var(--whatsapp-green-dark)]" data-testid="icon-read" />;
    }
    return null;
  };

  return (
    <div
      className={cn(
        "flex group relative",
        message.isFromMe ? "justify-end" : "justify-start"
      )}
      data-testid={`message-${message.id}`}
    >
      <div className="relative max-w-[65%]">
        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 shadow-sm",
            message.isFromMe
              ? "bg-[var(--whatsapp-bubble-sent)]"
              : "bg-[var(--whatsapp-bubble-received)]"
          )}
          style={{
            borderRadius: message.isFromMe 
              ? '7.5px 7.5px 0 7.5px' 
              : '7.5px 7.5px 7.5px 0'
          }}
        >
          {/* Forwarded Indicator */}
          {message.isForwarded && (
            <div className="flex items-center gap-1 mb-1 text-xs text-[var(--whatsapp-text-tertiary)]" data-testid="forwarded-indicator">
              <Forward className="h-3 w-3" />
              <span>Forwarded</span>
            </div>
          )}

          {/* Quoted Message */}
          {message.quotedMsg && (
            <div 
              className="border-l-4 border-[var(--whatsapp-green-dark)] bg-[var(--whatsapp-bg-primary)]/40 pl-2 py-1 mb-2 rounded text-xs"
              data-testid="quoted-message"
            >
              <div className="font-semibold text-[var(--whatsapp-green-dark)]">{message.quotedMsg.from}</div>
              <div className="text-[var(--whatsapp-text-secondary)] line-clamp-2">{message.quotedMsg.body}</div>
            </div>
          )}

          {/* Message Body */}
          <p className="text-sm text-[var(--whatsapp-text-primary)] break-words whitespace-pre-wrap">
            {message.body}
          </p>

          {/* Time and Status */}
          <div className="flex items-center gap-1 justify-end mt-1">
            {message.isStarred && (
              <Star className="h-3 w-3 fill-[var(--whatsapp-text-tertiary)] text-[var(--whatsapp-text-tertiary)]" data-testid="star-indicator" />
            )}
            <span className="text-[11px] text-[var(--whatsapp-text-tertiary)]">
              {formatMessageTime(message.timestamp)}
            </span>
            {renderAckIcon()}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap" data-testid="message-reactions">
            {message.reactions.map((reaction) => (
              <span
                key={reaction.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5 text-sm shadow-sm"
                title={reaction.from}
                data-testid={`reaction-${reaction.emoji}`}
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        )}

        {/* Context Menu */}
        <div className={cn(
          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
          message.isFromMe ? "-left-10" : "-right-10"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-[var(--whatsapp-bg-secondary)] hover:bg-[var(--whatsapp-hover)] shadow-md"
                data-testid={`button-message-menu-${message.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onReply} data-testid="menu-reply">
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onForward} data-testid="menu-forward">
                <Forward className="h-4 w-4 mr-2" />
                Forward
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid="menu-react">
                  <Smile className="h-4 w-4 mr-2" />
                  React
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="p-0">
                  <EmojiPicker onSelect={onReact} />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={onStar} data-testid="menu-star">
                {message.isStarred ? (
                  <>
                    <StarOff className="h-4 w-4 mr-2" />
                    Unstar
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    Star
                  </>
                )}
              </DropdownMenuItem>
              {message.hasMedia && (
                <DropdownMenuItem onClick={onDownload} data-testid="menu-download">
                  <Download className="h-4 w-4 mr-2" />
                  Download Media
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onCopy} data-testid="menu-copy">
                <Copy className="h-4 w-4 mr-2" />
                Copy Text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onInfo} data-testid="menu-info">
                <Info className="h-4 w-4 mr-2" />
                Message Info
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600" data-testid="menu-delete">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// GROUP INFO SHEET COMPONENT
// =====================================================

function GroupInfoSheet({ 
  chat, 
  open, 
  onOpenChange,
  onEditSubject,
  onEditDescription,
  onAddParticipants,
  onRemoveParticipant,
  onPromoteParticipant,
  onDemoteParticipant,
  onLeaveGroup
}: {
  chat: WhatsAppChat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditSubject: () => void;
  onEditDescription: () => void;
  onAddParticipants: () => void;
  onRemoveParticipant: (participantId: string) => void;
  onPromoteParticipant: (participantId: string) => void;
  onDemoteParticipant: (participantId: string) => void;
  onLeaveGroup: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Group Info</SheetTitle>
          <SheetDescription>
            Manage group settings and participants
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Group Avatar and Name */}
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarFallback
                className="text-white font-semibold text-2xl"
                style={{ backgroundColor: getAvatarColorFromString(chat.id) }}
              >
                {getInitials(chat.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="text-lg font-semibold">{chat.groupMetadata?.subject || chat.name}</h3>
              <p className="text-sm text-muted-foreground">
                {chat.participants?.length || 0} participants
              </p>
            </div>
          </div>

          {/* Group Actions */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={onEditSubject}
              data-testid="button-edit-subject"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Group Name
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={onEditDescription}
              data-testid="button-edit-description"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Description
            </Button>
          </div>

          <Separator />

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Participants</h4>
              <Button 
                size="sm" 
                onClick={onAddParticipants}
                data-testid="button-add-participants"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {chat.participants?.map((participant) => (
                  <div 
                    key={participant.id} 
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                    data-testid={`participant-${participant.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback style={{ backgroundColor: getAvatarColorFromString(participant.id) }}>
                          {getInitials(participant.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{participant.name}</div>
                        {participant.isAdmin && (
                          <div className="text-xs text-[var(--whatsapp-green-dark)]">Admin</div>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-participant-menu-${participant.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {participant.isAdmin ? (
                          <DropdownMenuItem 
                            onClick={() => onDemoteParticipant(participant.id)}
                            data-testid="menu-demote"
                          >
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Remove Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => onPromoteParticipant(participant.id)}
                            data-testid="menu-promote"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => onRemoveParticipant(participant.id)}
                          className="text-red-600"
                          data-testid="menu-remove"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Leave Group */}
          <Button 
            variant="destructive" 
            className="w-full" 
            onClick={onLeaveGroup}
            data-testid="button-leave-group"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Leave Group
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function WhatsAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [replyingTo, setReplyingTo] = useState<WhatsAppMessage | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [showEditSubjectDialog, setShowEditSubjectDialog] = useState(false);
  const [showEditDescriptionDialog, setShowEditDescriptionDialog] = useState(false);
  const [showMessageInfoDialog, setShowMessageInfoDialog] = useState(false);
  const [messageInfoData, setMessageInfoData] = useState<any>(null);

  // Location dialog state
  const [locationData, setLocationData] = useState({ latitude: '', longitude: '', name: '' });
  
  // Poll dialog state
  const [pollData, setPollData] = useState({
    name: '',
    options: ['', ''],
    multipleAnswers: false
  });

  // Edit dialogs state
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // =====================================================
  // QUERIES
  // =====================================================

  const { data: statusData } = useQuery<{ success: boolean; status: WhatsAppStatus }>({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 3000,
  });

  const status = statusData?.status;
  const isAuthenticated = status?.status === 'authenticated' || status?.status === 'ready';

  const { data: chatsData, isLoading: chatsLoading } = useQuery<{ success: boolean; chats: WhatsAppChat[] }>({
    queryKey: ['/api/whatsapp/chats'],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const chats = chatsData?.chats || [];

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ success: boolean; messages: WhatsAppMessage[] }>({
    queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId && isAuthenticated,
    refetchInterval: 3000,
  });

  const messages = messagesData?.messages || [];

  // =====================================================
  // MUTATIONS
  // =====================================================

  const sendMessageMutation = useMutation({
    mutationFn: async ({ to, message, quotedMsgId }: { to: string; message: string; quotedMsgId?: string }) => {
      return await apiRequest('/api/whatsapp/send', 'POST', { to, message, quotedMsgId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setMessageInput('');
      setReplyingTo(null);
    },
  });

  const starMutation = useMutation({
    mutationFn: async ({ messageId, star }: { messageId: string; star: boolean }) => {
      const endpoint = star ? 'star' : 'unstar';
      return await apiRequest(`/api/whatsapp/messages/${messageId}/${endpoint}`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ messageId, deleteForEveryone }: { messageId: string; deleteForEveryone: boolean }) => {
      return await apiRequest(`/api/whatsapp/messages/${messageId}`, 'DELETE', { deleteForEveryone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      toast({ title: 'Success', description: 'Message deleted' });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return await apiRequest(`/api/whatsapp/messages/${messageId}/react`, 'POST', { emoji });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ chatId, archive }: { chatId: string; archive: boolean }) => {
      const endpoint = archive ? 'archive' : 'unarchive';
      return await apiRequest(`/api/whatsapp/chats/${chatId}/${endpoint}`, 'PUT', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Chat updated' });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ chatId, pin }: { chatId: string; pin: boolean }) => {
      const endpoint = pin ? 'pin' : 'unpin';
      return await apiRequest(`/api/whatsapp/chats/${chatId}/${endpoint}`, 'PUT', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    },
  });

  const muteMutation = useMutation({
    mutationFn: async ({ chatId, duration }: { chatId: string; duration: number }) => {
      return await apiRequest(`/api/whatsapp/chats/${chatId}/mute`, 'PUT', { duration });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Chat muted' });
    },
  });

  const unmuteMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      return await apiRequest(`/api/whatsapp/chats/${chatId}/unmute`, 'PUT', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Chat unmuted' });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      return await apiRequest(`/api/whatsapp/chats/${chatId}/messages`, 'DELETE', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      toast({ title: 'Success', description: 'Chat cleared' });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      return await apiRequest(`/api/whatsapp/chats/${chatId}`, 'DELETE', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChatId(null);
      toast({ title: 'Success', description: 'Chat deleted' });
    },
  });

  const sendTypingMutation = useMutation({
    mutationFn: async ({ chatId, isTyping }: { chatId: string; isTyping: boolean }) => {
      return await apiRequest('/api/whatsapp/send-typing', 'POST', { chatId, isTyping });
    },
  });

  const sendLocationMutation = useMutation({
    mutationFn: async ({ chatId, latitude, longitude, name }: { chatId: string; latitude: number; longitude: number; name?: string }) => {
      return await apiRequest('/api/whatsapp/send-location', 'POST', { chatId, latitude, longitude, name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      setShowLocationDialog(false);
      setLocationData({ latitude: '', longitude: '', name: '' });
      toast({ title: 'Success', description: 'Location sent' });
    },
  });

  const sendPollMutation = useMutation({
    mutationFn: async ({ chatId, name, options, multipleAnswers }: { chatId: string; name: string; options: string[]; multipleAnswers: boolean }) => {
      return await apiRequest('/api/whatsapp/send-poll', 'POST', { chatId, name, options, multipleAnswers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      setShowPollDialog(false);
      setPollData({ name: '', options: ['', ''], multipleAnswers: false });
      toast({ title: 'Success', description: 'Poll sent' });
    },
  });

  const editSubjectMutation = useMutation({
    mutationFn: async ({ chatId, subject }: { chatId: string; subject: string }) => {
      return await apiRequest(`/api/whatsapp/groups/${chatId}/subject`, 'PUT', { subject });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setShowEditSubjectDialog(false);
      toast({ title: 'Success', description: 'Group name updated' });
    },
  });

  const editDescriptionMutation = useMutation({
    mutationFn: async ({ chatId, description }: { chatId: string; description: string }) => {
      return await apiRequest(`/api/whatsapp/groups/${chatId}/description`, 'PUT', { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setShowEditDescriptionDialog(false);
      toast({ title: 'Success', description: 'Description updated' });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      return await apiRequest(`/api/whatsapp/groups/${chatId}/leave`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChatId(null);
      setShowGroupInfo(false);
      toast({ title: 'Success', description: 'Left group' });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async ({ chatId, participantId }: { chatId: string; participantId: string }) => {
      return await apiRequest(`/api/whatsapp/groups/${chatId}/remove-participant`, 'POST', { participantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Participant removed' });
    },
  });

  const promoteParticipantMutation = useMutation({
    mutationFn: async ({ chatId, participantIds }: { chatId: string; participantIds: string[] }) => {
      return await apiRequest(`/api/whatsapp/groups/${chatId}/promote`, 'PUT', { participantIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Participant promoted to admin' });
    },
  });

  const demoteParticipantMutation = useMutation({
    mutationFn: async ({ chatId, participantIds }: { chatId: string; participantIds: string[] }) => {
      return await apiRequest(`/api/whatsapp/groups/${chatId}/demote`, 'PUT', { participantIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Admin privileges removed' });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/whatsapp/logout', 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChatId(null);
      toast({ title: 'Success', description: 'Logged out of WhatsApp' });
    },
  });

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicator effect
  useEffect(() => {
    if (!selectedChatId || !messageInput) {
      if (typingTimeout) clearTimeout(typingTimeout);
      if (isTyping) {
        setIsTyping(false);
        sendTypingMutation.mutate({ chatId: selectedChatId!, isTyping: false });
      }
      return;
    }

    if (!isTyping) {
      setIsTyping(true);
      sendTypingMutation.mutate({ chatId: selectedChatId, isTyping: true });
    }

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      setIsTyping(false);
      sendTypingMutation.mutate({ chatId: selectedChatId, isTyping: false });
    }, 3000);

    setTypingTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [messageInput]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChatId) return;
    
    sendMessageMutation.mutate({ 
      to: selectedChatId, 
      message: messageInput,
      quotedMsgId: replyingTo?.id 
    });
  };

  const handleReply = (message: WhatsAppMessage) => {
    setReplyingTo(message);
  };

  const handleForward = (message: WhatsAppMessage) => {
    const chatIds = prompt('Enter chat IDs (comma-separated):');
    if (chatIds) {
      chatIds.split(',').forEach(async (chatId) => {
        try {
          await apiRequest(`/api/whatsapp/messages/${message.id}/forward`, 'POST', { to: chatId.trim() });
        } catch (error) {
          toast({ title: 'Error', description: 'Failed to forward message', variant: 'destructive' });
        }
      });
      toast({ title: 'Success', description: 'Message forwarded' });
    }
  };

  const handleStar = (message: WhatsAppMessage) => {
    starMutation.mutate({ messageId: message.id, star: !message.isStarred });
  };

  const handleDelete = (message: WhatsAppMessage) => {
    setDeleteMessageId(message.id);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = (deleteForEveryone: boolean) => {
    if (deleteMessageId) {
      deleteMutation.mutate({ messageId: deleteMessageId, deleteForEveryone });
      setShowDeleteDialog(false);
      setDeleteMessageId(null);
    }
  };

  const handleReact = (message: WhatsAppMessage, emoji: string) => {
    reactMutation.mutate({ messageId: message.id, emoji });
  };

  const handleDownload = async (message: WhatsAppMessage) => {
    try {
      const response = await fetch(`/api/whatsapp/messages/${message.id}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `media-${message.id}`;
      a.click();
      toast({ title: 'Success', description: 'Media downloaded' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to download media', variant: 'destructive' });
    }
  };

  const handleMessageInfo = async (message: WhatsAppMessage) => {
    try {
      const response = await fetch(`/api/whatsapp/messages/${message.id}/info`);
      const data = await response.json();
      setMessageInfoData(data);
      setShowMessageInfoDialog(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to get message info', variant: 'destructive' });
    }
  };

  const handleCopy = (message: WhatsAppMessage) => {
    navigator.clipboard.writeText(message.body);
    toast({ title: 'Success', description: 'Text copied to clipboard' });
  };

  const handleSendLocation = () => {
    if (!selectedChatId || !locationData.latitude || !locationData.longitude) return;
    
    sendLocationMutation.mutate({
      chatId: selectedChatId,
      latitude: parseFloat(locationData.latitude),
      longitude: parseFloat(locationData.longitude),
      name: locationData.name
    });
  };

  const handleSendPoll = () => {
    if (!selectedChatId || !pollData.name || pollData.options.filter(o => o.trim()).length < 2) {
      toast({ title: 'Error', description: 'Please enter poll name and at least 2 options', variant: 'destructive' });
      return;
    }
    
    sendPollMutation.mutate({
      chatId: selectedChatId,
      name: pollData.name,
      options: pollData.options.filter(o => o.trim()),
      multipleAnswers: pollData.multipleAnswers
    });
  };

  const handleMuteChat = (duration: number) => {
    if (!selectedChatId) return;
    muteMutation.mutate({ chatId: selectedChatId, duration });
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      activeFilter === 'all' ? true :
      activeFilter === 'unread' ? chat.unreadCount > 0 :
      activeFilter === 'groups' ? chat.isGroup :
      false;
    
    return matchesSearch && matchesFilter;
  });

  // =====================================================
  // RENDER: QR CODE VIEW
  // =====================================================

  if (!isAuthenticated) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-[var(--whatsapp-bg-primary)]">
        <Card className="w-full max-w-lg p-8 bg-[var(--whatsapp-bg-secondary)] border-[var(--whatsapp-border)]">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-[var(--whatsapp-green-primary)] rounded-full flex items-center justify-center mb-4 mx-auto">
              <MessageSquare className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-medium text-[var(--whatsapp-text-primary)]">WhatsApp Web</h2>
            
            {status?.qrCode ? (
              <div className="space-y-4">
                <p className="text-[var(--whatsapp-text-secondary)]">
                  Scan the QR code with your WhatsApp mobile app
                </p>
                <div className="flex justify-center bg-white p-6 rounded-lg">
                  <img 
                    src={status.qrCode} 
                    alt="QR Code" 
                    className="w-64 h-64"
                    data-testid="img-qr-code"
                  />
                </div>
                <div className="text-sm text-[var(--whatsapp-text-secondary)] space-y-1 text-left max-w-sm mx-auto">
                  <p>1. Open WhatsApp on your phone</p>
                  <p>2. Tap Menu or Settings and select Linked Devices</p>
                  <p>3. Tap on Link a Device</p>
                  <p>4. Point your phone at this screen to scan the code</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <RefreshCw className="h-12 w-12 text-[var(--whatsapp-text-tertiary)] animate-spin" />
                </div>
                <p className="text-[var(--whatsapp-text-secondary)]">
                  {status?.message || 'Initializing WhatsApp connection...'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // =====================================================
  // RENDER: MAIN CHAT VIEW
  // =====================================================

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-[var(--whatsapp-bg-primary)]">
      {/* Sidebar - Chat List */}
      <div className={cn(
        "w-full md:w-[420px] border-r border-[var(--whatsapp-border)] bg-[var(--whatsapp-bg-secondary)] flex flex-col",
        selectedChatId ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="h-[60px] px-4 bg-[var(--whatsapp-bg-panel-header)] flex items-center justify-between border-b border-[var(--whatsapp-border)]">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-[var(--whatsapp-green-primary)] text-white font-semibold">
                <MessageSquare className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2 bg-[var(--whatsapp-bg-secondary)]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--whatsapp-text-tertiary)]" />
            <Input
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-[var(--whatsapp-bg-primary)] border-0 rounded-lg h-9 text-sm text-[var(--whatsapp-text-primary)] placeholder:text-[var(--whatsapp-text-tertiary)]"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-6 px-6 py-2 bg-[var(--whatsapp-bg-secondary)] border-b border-[var(--whatsapp-border)]">
          {(['all', 'unread', 'favorites', 'groups'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={cn(
                "text-sm capitalize pb-2 relative transition-colors",
                activeFilter === tab 
                  ? "text-[var(--whatsapp-green-dark)] font-medium" 
                  : "text-[var(--whatsapp-text-secondary)]"
              )}
              data-testid={`filter-tab-${tab}`}
            >
              {tab}
              {activeFilter === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--whatsapp-green-dark)]" />
              )}
            </button>
          ))}
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {chatsLoading && !chatsData ? (
            <div className="p-3 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-[52px] w-[52px] rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50 text-[var(--whatsapp-text-tertiary)]" />
              <p className="text-[var(--whatsapp-text-secondary)]">No chats found</p>
            </div>
          ) : (
            <div>
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 transition-colors text-left border-b border-[var(--whatsapp-border)]",
                    selectedChatId === chat.id 
                      ? "bg-[var(--whatsapp-selected)]" 
                      : "hover:bg-[var(--whatsapp-hover)]"
                  )}
                  data-testid={`chat-item-${chat.id}`}
                >
                  <Avatar className="h-[52px] w-[52px]">
                    <AvatarFallback
                      className="text-white font-semibold"
                      style={{ backgroundColor: getAvatarColorFromString(chat.id) }}
                    >
                      {getInitials(chat.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[var(--whatsapp-text-primary)] truncate">{chat.name}</h3>
                        {chat.isPinned && <Pin className="h-3 w-3 text-[var(--whatsapp-text-tertiary)]" />}
                        {chat.isMuted && <BellOff className="h-3 w-3 text-[var(--whatsapp-text-tertiary)]" />}
                      </div>
                      <span className="text-xs text-[var(--whatsapp-text-tertiary)] ml-2 flex-shrink-0">
                        {chat.lastMessage && formatTimestamp(chat.lastMessage.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[var(--whatsapp-text-secondary)] truncate">
                        {chat.lastMessage?.body || 'No messages yet'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <Badge 
                          className="ml-2 bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-primary)] text-white rounded-full h-5 min-w-[20px] px-1.5 text-xs"
                        >
                          {chat.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedChatId ? "hidden md:flex" : "flex"
      )}>
        {selectedChatId && selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-[60px] px-4 bg-[var(--whatsapp-bg-panel-header)] border-b border-[var(--whatsapp-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setSelectedChatId(null)}
                  data-testid="button-back-to-chats"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback
                    className="text-white font-semibold"
                    style={{ backgroundColor: getAvatarColorFromString(selectedChat.id) }}
                  >
                    {getInitials(selectedChat.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-medium text-[var(--whatsapp-text-primary)]">{selectedChat.name}</h2>
                  <p className="text-xs text-[var(--whatsapp-text-secondary)]">
                    {isTyping ? 'typing...' : 'click here for contact info'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                  data-testid="button-video"
                >
                  <Video className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                  data-testid="button-call"
                >
                  <Phone className="h-5 w-5" />
                </Button>

                {/* Chat Options Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                      data-testid="button-chat-menu"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selectedChat.isGroup && (
                      <>
                        <DropdownMenuItem onClick={() => setShowGroupInfo(true)} data-testid="menu-group-info">
                          <Users className="h-4 w-4 mr-2" />
                          Group Info
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem 
                      onClick={() => pinMutation.mutate({ chatId: selectedChatId, pin: !selectedChat.isPinned })}
                      data-testid="menu-pin"
                    >
                      {selectedChat.isPinned ? (
                        <>
                          <PinOff className="h-4 w-4 mr-2" />
                          Unpin Chat
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4 mr-2" />
                          Pin Chat
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => archiveMutation.mutate({ chatId: selectedChatId, archive: !selectedChat.isArchived })}
                      data-testid="menu-archive"
                    >
                      {selectedChat.isArchived ? (
                        <>
                          <ArchiveX className="h-4 w-4 mr-2" />
                          Unarchive
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </>
                      )}
                    </DropdownMenuItem>
                    
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger data-testid="menu-mute">
                        {selectedChat.isMuted ? (
                          <>
                            <Bell className="h-4 w-4 mr-2" />
                            Unmute
                          </>
                        ) : (
                          <>
                            <BellOff className="h-4 w-4 mr-2" />
                            Mute
                          </>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {selectedChat.isMuted ? (
                          <DropdownMenuItem 
                            onClick={() => unmuteMutation.mutate({ chatId: selectedChatId })}
                            data-testid="menu-unmute"
                          >
                            Unmute Notifications
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => handleMuteChat(8 * 3600)} data-testid="menu-mute-8h">
                              8 hours
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMuteChat(7 * 24 * 3600)} data-testid="menu-mute-1w">
                              1 week
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMuteChat(-1)} data-testid="menu-mute-always">
                              Always
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem data-testid="menu-search">
                      <Search className="h-4 w-4 mr-2" />
                      Search Messages
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => clearChatMutation.mutate({ chatId: selectedChatId })}
                      data-testid="menu-clear"
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Clear Messages
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteChatMutation.mutate({ chatId: selectedChatId })}
                      className="text-red-600"
                      data-testid="menu-delete-chat"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              className="flex-1 overflow-y-auto p-6 relative"
              style={{ 
                backgroundColor: 'var(--whatsapp-bg-chat)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4dbd7' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}
            >
              {messagesLoading && !messagesData ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                      <Skeleton className={cn("h-16 rounded-lg", i % 2 === 0 ? "w-64" : "w-48")} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--whatsapp-text-secondary)]">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start the conversation!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      onReply={() => handleReply(message)}
                      onForward={() => handleForward(message)}
                      onStar={() => handleStar(message)}
                      onDelete={() => handleDelete(message)}
                      onReact={(emoji) => handleReact(message, emoji)}
                      onDownload={() => handleDownload(message)}
                      onInfo={() => handleMessageInfo(message)}
                      onCopy={() => handleCopy(message)}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Reply Preview */}
            {replyingTo && (
              <div className="px-4 py-2 bg-[var(--whatsapp-bg-panel-header)] border-t border-[var(--whatsapp-border)] flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <Reply className="h-4 w-4 text-[var(--whatsapp-green-dark)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[var(--whatsapp-green-dark)]">
                      Replying to {replyingTo.from}
                    </div>
                    <div className="text-xs text-[var(--whatsapp-text-secondary)] truncate">
                      {replyingTo.body}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setReplyingTo(null)}
                  className="h-8 w-8"
                  data-testid="button-cancel-reply"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Message Input Footer */}
            <div className="px-4 py-2 bg-[var(--whatsapp-bg-panel-header)] border-t border-[var(--whatsapp-border)]">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                  data-testid="button-emoji"
                >
                  <Smile className="h-6 w-6" />
                </Button>

                {/* Special send buttons */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                      data-testid="button-attach"
                    >
                      <Paperclip className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setShowLocationDialog(true)} data-testid="menu-send-location">
                      <MapPin className="h-4 w-4 mr-2" />
                      Send Location
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="menu-send-contact">
                      <Users className="h-4 w-4 mr-2" />
                      Send Contact
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowPollDialog(true)} data-testid="menu-send-poll">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Send Poll
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem data-testid="menu-attach-media">
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach Media
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input
                  placeholder="Type a message"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 bg-[var(--whatsapp-bg-secondary)] border-0 rounded-lg h-10 text-sm text-[var(--whatsapp-text-primary)]"
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                {messageInput.trim() ? (
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending}
                    size="icon"
                    className="h-10 w-10 rounded-full bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)] text-white"
                    data-testid="button-send"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                    data-testid="button-voice"
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[var(--whatsapp-bg-primary)] border-l border-[var(--whatsapp-border)]">
            <div className="text-center max-w-md px-6">
              <div className="mb-8">
                <div className="inline-block p-8 rounded-full bg-[var(--whatsapp-bg-secondary)] border border-[var(--whatsapp-border)] mb-6">
                  <MessageSquare className="h-32 w-32 text-[var(--whatsapp-green-primary)]" />
                </div>
              </div>
              <h2 className="text-3xl font-light text-[var(--whatsapp-text-primary)] mb-4">
                WhatsApp Web
              </h2>
              <p className="text-sm text-[var(--whatsapp-text-secondary)] mb-12">
                Send and receive messages without keeping your phone online.
                <br />
                Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </p>
              <div className="pt-12 border-t border-[var(--whatsapp-border)] flex items-center justify-center gap-2 text-[var(--whatsapp-text-tertiary)]">
                <Lock className="h-3 w-3" />
                <span className="text-xs">End-to-end encrypted</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          DIALOGS AND MODALS
          ===================================================== */}

      {/* Group Info Sheet */}
      {selectedChat?.isGroup && (
        <GroupInfoSheet
          chat={selectedChat}
          open={showGroupInfo}
          onOpenChange={setShowGroupInfo}
          onEditSubject={() => {
            setEditSubject(selectedChat.groupMetadata?.subject || selectedChat.name);
            setShowEditSubjectDialog(true);
          }}
          onEditDescription={() => {
            setEditDescription(selectedChat.groupMetadata?.description || '');
            setShowEditDescriptionDialog(true);
          }}
          onAddParticipants={() => {
            toast({ title: 'Coming soon', description: 'Add participants feature' });
          }}
          onRemoveParticipant={(participantId) => {
            if (selectedChatId) {
              removeParticipantMutation.mutate({ chatId: selectedChatId, participantId });
            }
          }}
          onPromoteParticipant={(participantId) => {
            if (selectedChatId) {
              promoteParticipantMutation.mutate({ chatId: selectedChatId, participantIds: [participantId] });
            }
          }}
          onDemoteParticipant={(participantId) => {
            if (selectedChatId) {
              demoteParticipantMutation.mutate({ chatId: selectedChatId, participantIds: [participantId] });
            }
          }}
          onLeaveGroup={() => {
            if (selectedChatId) {
              leaveGroupMutation.mutate({ chatId: selectedChatId });
            }
          }}
        />
      )}

      {/* Delete Message Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent data-testid="dialog-delete-message">
          <DialogHeader>
            <DialogTitle>Delete message?</DialogTitle>
            <DialogDescription>
              Choose how you want to delete this message
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleConfirmDelete(false)}
              data-testid="button-delete-for-me"
            >
              Delete for me
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleConfirmDelete(true)}
              data-testid="button-delete-for-everyone"
            >
              Delete for everyone
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent data-testid="dialog-send-location">
          <DialogHeader>
            <DialogTitle>Send Location</DialogTitle>
            <DialogDescription>
              Share your location or a specific place
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={locationData.latitude}
                onChange={(e) => setLocationData({ ...locationData, latitude: e.target.value })}
                placeholder="40.7128"
                data-testid="input-latitude"
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={locationData.longitude}
                onChange={(e) => setLocationData({ ...locationData, longitude: e.target.value })}
                placeholder="-74.0060"
                data-testid="input-longitude"
              />
            </div>
            <div>
              <Label htmlFor="location-name">Name (optional)</Label>
              <Input
                id="location-name"
                value={locationData.name}
                onChange={(e) => setLocationData({ ...locationData, name: e.target.value })}
                placeholder="New York City"
                data-testid="input-location-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendLocation} data-testid="button-confirm-send-location">
              Send Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Poll Dialog */}
      <Dialog open={showPollDialog} onOpenChange={setShowPollDialog}>
        <DialogContent data-testid="dialog-send-poll">
          <DialogHeader>
            <DialogTitle>Create Poll</DialogTitle>
            <DialogDescription>
              Ask a question with multiple options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="poll-name">Question</Label>
              <Input
                id="poll-name"
                value={pollData.name}
                onChange={(e) => setPollData({ ...pollData, name: e.target.value })}
                placeholder="What's your favorite color?"
                data-testid="input-poll-name"
              />
            </div>
            {pollData.options.map((option, index) => (
              <div key={index}>
                <Label htmlFor={`option-${index}`}>Option {index + 1}</Label>
                <div className="flex gap-2">
                  <Input
                    id={`option-${index}`}
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...pollData.options];
                      newOptions[index] = e.target.value;
                      setPollData({ ...pollData, options: newOptions });
                    }}
                    placeholder={`Option ${index + 1}`}
                    data-testid={`input-poll-option-${index}`}
                  />
                  {index >= 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newOptions = pollData.options.filter((_, i) => i !== index);
                        setPollData({ ...pollData, options: newOptions });
                      }}
                      data-testid={`button-remove-option-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {pollData.options.length < 12 && (
              <Button
                variant="outline"
                onClick={() => setPollData({ ...pollData, options: [...pollData.options, ''] })}
                data-testid="button-add-option"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="multiple-answers"
                checked={pollData.multipleAnswers}
                onChange={(e) => setPollData({ ...pollData, multipleAnswers: e.target.checked })}
                data-testid="checkbox-multiple-answers"
              />
              <Label htmlFor="multiple-answers">Allow multiple answers</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPollDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendPoll} data-testid="button-confirm-send-poll">
              Send Poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={showEditSubjectDialog} onOpenChange={setShowEditSubjectDialog}>
        <DialogContent data-testid="dialog-edit-subject">
          <DialogHeader>
            <DialogTitle>Edit Group Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Group name"
              data-testid="input-edit-subject"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSubjectDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedChatId) {
                  editSubjectMutation.mutate({ chatId: selectedChatId, subject: editSubject });
                }
              }}
              data-testid="button-confirm-edit-subject"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Description Dialog */}
      <Dialog open={showEditDescriptionDialog} onOpenChange={setShowEditDescriptionDialog}>
        <DialogContent data-testid="dialog-edit-description">
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Group description"
              rows={4}
              data-testid="input-edit-description"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDescriptionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedChatId) {
                  editDescriptionMutation.mutate({ chatId: selectedChatId, description: editDescription });
                }
              }}
              data-testid="button-confirm-edit-description"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Info Dialog */}
      <Dialog open={showMessageInfoDialog} onOpenChange={setShowMessageInfoDialog}>
        <DialogContent data-testid="dialog-message-info">
          <DialogHeader>
            <DialogTitle>Message Info</DialogTitle>
          </DialogHeader>
          {messageInfoData && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Read by</h4>
                {messageInfoData.readBy?.length > 0 ? (
                  <div className="space-y-2">
                    {messageInfoData.readBy.map((info: any) => (
                      <div key={info.id} className="flex items-center justify-between">
                        <span>{info.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(info.timestamp * 1000), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not read yet</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Delivered to</h4>
                {messageInfoData.deliveredTo?.length > 0 ? (
                  <div className="space-y-2">
                    {messageInfoData.deliveredTo.map((info: any) => (
                      <div key={info.id} className="flex items-center justify-between">
                        <span>{info.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(info.timestamp * 1000), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not delivered yet</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
