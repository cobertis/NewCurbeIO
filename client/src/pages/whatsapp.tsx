import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from "@/components/ui/context-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";
import { 
  Search, Send, MoreVertical, Phone, Video, 
  CheckCheck, MessageSquare, RefreshCw, Smile, Paperclip, Lock, ArrowLeft,
  X, Reply, Forward, Star, Download, Info, Copy, Trash2, Archive, Pin, BellOff,
  Users, MapPin, UserPlus, BarChart3, Check, Mic, Clock, StarOff, ChevronDown,
  LogOut, ArchiveX, Trash, Bell, PinOff, UserMinus, Shield, ShieldOff, Edit, Plus, Loader2,
  Image, FileIcon, Play, Square, File as FileIconLucide, Link2, RefreshCcw, Settings, Sticker, AtSign,
  Camera, User, AlertCircle
} from "lucide-react";

// =====================================================
// TYPES & INTERFACES
// =====================================================

type FilterTab = 'all' | 'unread' | 'favorites' | 'groups' | 'archived';

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  isPinned?: boolean;
  isArchived?: boolean;
  isMuted?: boolean;
  profilePicUrl?: string | null;
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

interface ContactProfile {
  id: string;
  name: string;
  number: string;
  profilePicUrl: string | null;
  isBlocked: boolean;
  isBusiness: boolean;
  pushname: string | null;
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
// VIDEO THUMBNAIL COMPONENT (lazy load video on click)
// =====================================================

function VideoThumbnail({ messageId, ...props }: { messageId: string; [key: string]: any }) {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (showVideo) {
    return (
      <video 
        ref={videoRef}
        controls 
        autoPlay
        className="max-w-xs rounded-lg"
        preload="auto"
        data-testid="media-video"
        {...props}
      >
        <source src={`/api/whatsapp/messages/${messageId}/media`} />
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <div 
      className="relative max-w-xs h-48 rounded-lg bg-black/80 flex items-center justify-center cursor-pointer group"
      onClick={() => setShowVideo(true)}
      data-testid="media-video-thumbnail"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-white transition-colors shadow-lg">
          <Play className="h-8 w-8 text-black ml-1" />
        </div>
      </div>
      <div className="absolute bottom-2 left-2 text-white/80 text-xs flex items-center gap-1">
        <Video className="h-3 w-3" />
        <span>Video</span>
      </div>
    </div>
  );
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

function formatContactName(name: string): string {
  if (!name) return 'Unknown';
  return name.replace(/@c\.us$|@g\.us$|@s\.whatsapp\.net$/gi, '');
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

function formatDateSeparator(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  
  if (isToday(date)) {
    return 'Today';
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMMM d, yyyy');
  }
}

function getMessageDateKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return format(date, 'yyyy-MM-dd');
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
  onDelete: (deleteForEveryone: boolean) => void;
  onReact: (emoji: string) => void;
  onDownload: () => void;
  onInfo: () => void;
  onCopy: () => void;
}) {
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const renderAckIcon = () => {
    if (!message.isFromMe) return null;
    
    const ack = message.ack ?? 1;
    if (ack === 0) {
      return <Clock className="h-3 w-3 text-gray-400" data-testid="icon-pending" />;
    } else if (ack === 1) {
      return <Check className="h-3 w-3 text-gray-400" data-testid="icon-sent" />;
    } else if (ack === 2) {
      return <CheckCheck className="h-3 w-3 text-gray-400" data-testid="icon-delivered" />;
    } else if (ack >= 3) {
      return <CheckCheck className="h-3 w-3 text-blue-500" data-testid="icon-read" />;
    }
    return <Check className="h-3 w-3 text-gray-400" data-testid="icon-sent" />;
  };

  const MessageContent = () => (
    <div className="relative max-w-[65%]">
      {/* Message Bubble */}
      <div
        className={cn(
          "rounded-lg px-2 py-1 shadow-sm",
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

        {/* Media Content */}
        {(message.hasMedia || message.type === 'location') && (
          <div className="mb-2">
            {(message.type === 'image' || message.type === 'sticker') && (
              <>
                {(message as any)._blobUrl ? (
                  <div className="relative">
                    <img 
                      src={(message as any)._blobUrl} 
                      alt="Media" 
                      className="max-w-xs rounded-lg opacity-70"
                      data-testid="media-image-optimistic"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white drop-shadow-lg" />
                    </div>
                  </div>
                ) : (
                  <img 
                    src={`/api/whatsapp/messages/${message.id}/media`} 
                    alt="Media" 
                    className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(`/api/whatsapp/messages/${message.id}/media`, '_blank')}
                    data-testid="media-image"
                  />
                )}
              </>
            )}
            {message.type === 'video' && (
              <>
                {(message as any)._blobUrl ? (
                  <div className="relative">
                    <div className="max-w-xs h-48 rounded-lg bg-black/20 flex items-center justify-center opacity-70">
                      <Loader2 className="h-8 w-8 animate-spin text-white drop-shadow-lg" />
                    </div>
                  </div>
                ) : (
                  <VideoThumbnail 
                    messageId={message.id}
                    data-testid="media-video"
                  />
                )}
              </>
            )}
            {(message.type === 'ptt' || message.type === 'audio') && (
              <div className="flex items-center gap-2 min-w-[200px]">
                <audio 
                  controls 
                  className="w-full h-8"
                  preload="metadata"
                  data-testid="media-audio"
                >
                  <source src={`/api/whatsapp/messages/${message.id}/media`} />
                  Your browser does not support the audio tag.
                </audio>
              </div>
            )}
            {message.type === 'document' && (
              <a 
                href={`/api/whatsapp/messages/${message.id}/media`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-[var(--whatsapp-bg-primary)]/50 rounded-lg hover:bg-[var(--whatsapp-bg-primary)]/70 transition-colors"
                data-testid="media-document"
              >
                <FileIconLucide className="h-8 w-8 text-[var(--whatsapp-green-primary)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Document</p>
                  <p className="text-xs text-[var(--whatsapp-text-tertiary)]">Click to download</p>
                </div>
              </a>
            )}
            {message.type === 'location' && (message as any).location && (
              <a
                href={`https://www.google.com/maps?q=${(message as any).location.latitude},${(message as any).location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity max-w-xs"
                data-testid="media-location"
              >
                <img
                  src={`/api/google-maps/static?lat=${(message as any).location.latitude}&lng=${(message as any).location.longitude}&zoom=15&size=300x150`}
                  alt="Location map"
                  className="w-full h-36 object-cover"
                />
                <div className="bg-[var(--whatsapp-bg-primary)] px-3 py-2 text-sm border-t border-[var(--whatsapp-border)]">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-[var(--whatsapp-text-primary)] truncate">
                      {(message as any).location.description || (message as any).location.address ||
                       `${(message as any).location.latitude.toFixed(6)}, ${(message as any).location.longitude.toFixed(6)}`}
                    </span>
                  </div>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Message Body */}
        {message.type !== 'location' && message.body && (
          <p className="text-[var(--whatsapp-text-primary)] break-words whitespace-pre-wrap text-[18px]">
            {message.body}
          </p>
        )}

        {/* Time and Status */}
        <div className="flex items-center gap-1 justify-end mt-1">
          {message.isStarred && (
            <Star className="h-3 w-3 fill-[var(--whatsapp-text-tertiary)] text-[var(--whatsapp-text-tertiary)]" data-testid="star-indicator" />
          )}
          <span className="text-[var(--whatsapp-text-tertiary)] text-[12px]">
            {formatMessageTime(message.timestamp)}
          </span>
          {renderAckIcon()}
        </div>

        {/* Reactions - positioned at bottom right corner of bubble */}
        {message.reactions && message.reactions.length > 0 && (
          <div 
            className="absolute -bottom-3 right-2 flex items-center bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 px-1.5 py-0.5"
            data-testid="message-reactions"
          >
            {message.reactions.slice(0, 3).map((reaction, index) => (
              <span
                key={reaction.id}
                className="text-sm"
                style={{ marginLeft: index > 0 ? '-2px' : '0' }}
                title={reaction.from}
                data-testid={`reaction-${reaction.emoji}`}
              >
                {reaction.emoji}
              </span>
            ))}
            {message.reactions.length > 3 && (
              <span className="text-[10px] text-gray-500 ml-0.5">+{message.reactions.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Hover Actions - Options Button and React Button */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1",
        message.isFromMe ? "right-full mr-1" : "left-full ml-1"
      )}>
        {/* React Button */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full bg-[var(--whatsapp-bg-secondary)] hover:bg-[var(--whatsapp-hover)] shadow-sm border border-gray-200 dark:border-gray-700"
              data-testid={`button-react-${message.id}`}
            >
              <Smile className="h-4 w-4 text-gray-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto" align={message.isFromMe ? "end" : "start"}>
            <EmojiPicker onSelect={(emoji) => {
              onReact(emoji);
              setShowEmojiPicker(false);
            }} />
          </PopoverContent>
        </Popover>

        {/* More Options Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full bg-[var(--whatsapp-bg-secondary)] hover:bg-[var(--whatsapp-hover)] shadow-sm"
              data-testid={`button-message-menu-${message.id}`}
            >
              <ChevronDown className="h-3.5 w-3.5" />
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(false)} className="text-red-600" data-testid="menu-delete-for-me">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete for me
            </DropdownMenuItem>
            {message.isFromMe && (
              <DropdownMenuItem 
                onClick={() => onDelete(true)} 
                className="text-red-600" 
                data-testid="menu-delete-for-everyone"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete for everyone
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "flex group relative",
            message.isFromMe ? "justify-end" : "justify-start"
          )}
          data-testid={`message-${message.id}`}
        >
          <MessageContent />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onReply} data-testid="context-reply">
          <Reply className="h-4 w-4 mr-2" />
          Reply
        </ContextMenuItem>
        <ContextMenuItem onClick={onForward} data-testid="context-forward">
          <Forward className="h-4 w-4 mr-2" />
          Forward
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopy} data-testid="context-copy">
          <Copy className="h-4 w-4 mr-2" />
          Copy Text
        </ContextMenuItem>
        <ContextMenuItem onClick={onStar} data-testid="context-star">
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
        </ContextMenuItem>
        {message.hasMedia && (
          <ContextMenuItem onClick={onDownload} data-testid="context-download">
            <Download className="h-4 w-4 mr-2" />
            Download Media
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDelete(false)} className="text-red-600" data-testid="context-delete-for-me">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete for me
        </ContextMenuItem>
        {message.isFromMe && (
          <ContextMenuItem 
            onClick={() => onDelete(true)} 
            className="text-red-600" 
            data-testid="context-delete-for-everyone"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete for everyone
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
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
  onLeaveGroup,
  inviteLink,
  isLoadingInviteLink,
  onGetInviteLink,
  onCopyInviteLink,
  onRevokeInviteLink
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
  inviteLink: string | null;
  isLoadingInviteLink: boolean;
  onGetInviteLink: () => void;
  onCopyInviteLink: () => void;
  onRevokeInviteLink: () => void;
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

          {/* Invite Link Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Invite Link
              </h4>
              <Button 
                size="sm" 
                variant="outline"
                onClick={onGetInviteLink}
                disabled={isLoadingInviteLink}
                data-testid="button-get-invite-link"
              >
                {isLoadingInviteLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Get Link'
                )}
              </Button>
            </div>
            
            {inviteLink && (
              <div className="space-y-2">
                <div className="p-3 bg-muted rounded-lg break-all text-sm text-muted-foreground" data-testid="text-invite-link">
                  {inviteLink}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={onCopyInviteLink}
                    data-testid="button-copy-invite-link"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={onRevokeInviteLink}
                    data-testid="button-revoke-invite-link"
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Revoke
                  </Button>
                </div>
              </div>
            )}
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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false);
  const [showEditSubjectDialog, setShowEditSubjectDialog] = useState(false);
  const [showEditDescriptionDialog, setShowEditDescriptionDialog] = useState(false);
  const [showMessageInfoDialog, setShowMessageInfoDialog] = useState(false);
  const [messageInfoData, setMessageInfoData] = useState<any>(null);
  
  // Forward dialog state
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<WhatsAppMessage | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [selectedForwardChats, setSelectedForwardChats] = useState<string[]>([]);

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
  
  // Sticker file input ref
  const stickerInputRef = useRef<HTMLInputElement>(null);
  
  // Join group state
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  
  // Group invite link state
  const [groupInviteLink, setGroupInviteLink] = useState<string | null>(null);
  const [isLoadingInviteLink, setIsLoadingInviteLink] = useState(false);
  
  // Status/About settings state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [userStatus, setUserStatus] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [myProfilePicUrl, setMyProfilePicUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  
  // Search messages state
  const [showSearchMessagesDialog, setShowSearchMessagesDialog] = useState(false);
  const [searchMessagesQuery, setSearchMessagesQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WhatsAppMessage[]>([]);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  
  // Mentions state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const messageInputRef = useRef<HTMLInputElement>(null);
  
  // New Chat dialog state
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatTab, setNewChatTab] = useState<'contacts' | 'join-group'>('contacts');
  const [newChatPhoneNumber, setNewChatPhoneNumber] = useState('');
  const [isValidatingNumber, setIsValidatingNumber] = useState(false);
  const [validatedWhatsAppId, setValidatedWhatsAppId] = useState<string | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  
  // Inline new chat mode state (like iMessage)
  const [isNewChatMode, setIsNewChatMode] = useState(false);
  const [newChatToNumber, setNewChatToNumber] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [isSendingNewChatMessage, setIsSendingNewChatMessage] = useState(false);
  const [newChatValidationStatus, setNewChatValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [newChatProfilePic, setNewChatProfilePic] = useState<string | null>(null);
  const [newChatContactName, setNewChatContactName] = useState<string | null>(null);
  const [newChatError, setNewChatError] = useState<string | null>(null);
  
  // Profile picture cache
  const [profilePictures, setProfilePictures] = useState<Record<string, string | null>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Media upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Contact presence state (typing, recording, online status)
  const [contactIsTyping, setContactIsTyping] = useState(false);
  const [contactIsRecording, setContactIsRecording] = useState(false);
  const [contactLastSeen, setContactLastSeen] = useState<string | null>(null);
  const contactPresenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // =====================================================
  // QUERIES
  // =====================================================

  const { data: statusData } = useQuery<{ success: boolean; status: WhatsAppStatus; hasSavedSession?: boolean }>({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 3000,
  });

  const status = statusData?.status;
  const hasSavedSession = statusData?.hasSavedSession ?? false;
  const isAuthenticated = status?.status === 'authenticated' || status?.status === 'ready';
  // Show interface immediately if there's a saved session (even if not fully connected yet)
  const showInterface = isAuthenticated || hasSavedSession;

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

  // Filter out empty/system messages that WhatsApp creates
  const SYSTEM_MESSAGE_TYPES = ['notification', 'protocol', 'e2e_notification', 'gp2', 'revoked'];
  const messages = (messagesData?.messages || []).filter((msg: any) => {
    // Filter out system message types
    if (SYSTEM_MESSAGE_TYPES.includes(msg.type)) {
      return false;
    }
    // Keep messages with media (images, videos, audio, etc.)
    if (msg.hasMedia) {
      return true;
    }
    // Filter out messages with empty body (only for non-media messages)
    const body = msg.body || '';
    if (body.trim() === '') {
      return false;
    }
    return true;
  });

  // Query for WhatsApp contacts (for New Chat dialog)
  const { data: contactsData, isLoading: contactsLoading } = useQuery<{ success: boolean; contacts: Array<{ id: string; name: string; number: string; pushname?: string }> }>({
    queryKey: ['/api/whatsapp/contacts'],
    enabled: isAuthenticated && showNewChatDialog,
    staleTime: 60000,
  });

  const contacts = contactsData?.contacts || [];

  const selectedChatForInfo = chats.find(c => c.id === selectedChatId);
  const { data: contactInfoData } = useQuery<{ success: boolean; contact: { id: string; name: string; number: string; about: string | null; profilePic: string | null } }>({
    queryKey: ['/api/whatsapp/contacts', selectedChatId, 'info'],
    queryFn: async () => {
      if (!selectedChatId) return null;
      const res = await fetch(`/api/whatsapp/contacts/${encodeURIComponent(selectedChatId)}/info`);
      if (!res.ok) throw new Error('Failed to fetch contact info');
      return res.json();
    },
    enabled: !!selectedChatId && isAuthenticated && !selectedChatForInfo?.isGroup,
    staleTime: 60000,
  });

  const contactInfo = contactInfoData?.contact;

  // =====================================================
  // MUTATIONS
  // =====================================================

  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, content, quotedMsgId }: { chatId: string; content: string; quotedMsgId?: string }) => {
      return await apiRequest('POST', '/api/whatsapp/messages', { chatId, content, quotedMsgId });
    },
    onMutate: async ({ chatId, content, quotedMsgId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/whatsapp/chats/${chatId}/messages`] });
      
      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData([`/api/whatsapp/chats/${chatId}/messages`]);
      
      // Optimistically update - add new message immediately
      const optimisticMessage: WhatsAppMessage = {
        id: `temp-${Date.now()}`,
        body: content,
        from: 'me',
        to: chatId,
        timestamp: Math.floor(Date.now() / 1000),
        isFromMe: true,
        hasMedia: false,
        type: 'chat',
        ack: 0, // Pending
        quotedMsg: replyingTo ? { id: replyingTo.id, body: replyingTo.body, from: replyingTo.from } : undefined,
      };
      
      queryClient.setQueryData([`/api/whatsapp/chats/${chatId}/messages`], (old: any) => {
        if (!old?.messages) return { success: true, messages: [optimisticMessage] };
        return { ...old, messages: [...old.messages, optimisticMessage] };
      });
      
      // Clear input immediately for fast UX
      setMessageInput('');
      setReplyingTo(null);
      
      return { previousMessages, chatId };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData([`/api/whatsapp/chats/${context.chatId}/messages`], context.previousMessages);
      }
      console.error('[WhatsApp] Failed to send message:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send message', 
        variant: 'destructive' 
      });
    },
    onSettled: (data, error, variables) => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${variables.chatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    },
  });

  const starMutation = useMutation({
    mutationFn: async ({ messageId, star }: { messageId: string; star: boolean }) => {
      if (star) {
        return await apiRequest('POST', `/api/whatsapp/messages/${messageId}/star`, {});
      } else {
        return await apiRequest('DELETE', `/api/whatsapp/messages/${messageId}/star`, {});
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      toast({ title: 'Success', description: variables.star ? 'Message starred' : 'Message unstarred' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to star message', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ messageId, deleteForEveryone }: { messageId: string; deleteForEveryone: boolean }) => {
      return await apiRequest('DELETE', `/api/whatsapp/messages/${messageId}`, { deleteForEveryone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      toast({ title: 'Success', description: 'Message deleted' });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return await apiRequest('POST', `/api/whatsapp/messages/${messageId}/react`, { emoji });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      toast({ title: 'Success', description: 'Reaction sent' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to send reaction', variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ chatId, archive }: { chatId: string; archive: boolean }) => {
      const endpoint = archive ? 'archive' : 'unarchive';
      const encodedChatId = encodeURIComponent(chatId);
      return await apiRequest('POST', `/api/whatsapp/chats/${encodedChatId}/${endpoint}`, {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      if (variables.archive) {
        setActiveFilter('archived');
        setSelectedChatId(null);
      } else {
        setActiveFilter('all');
      }
      toast({ title: 'Success', description: variables.archive ? 'Chat archived' : 'Chat unarchived' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to archive chat', variant: 'destructive' });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ chatId, pin }: { chatId: string; pin: boolean }) => {
      const endpoint = pin ? 'pin' : 'unpin';
      const encodedChatId = encodeURIComponent(chatId);
      return await apiRequest('POST', `/api/whatsapp/chats/${encodedChatId}/${endpoint}`, {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: variables.pin ? 'Chat pinned' : 'Chat unpinned' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to pin chat', variant: 'destructive' });
    },
  });

  const muteMutation = useMutation({
    mutationFn: async ({ chatId, duration }: { chatId: string; duration: number }) => {
      const encodedChatId = encodeURIComponent(chatId);
      const durationMs = duration === -1 ? -1 : duration * 1000;
      return await apiRequest('POST', `/api/whatsapp/chats/${encodedChatId}/mute`, { durationMs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Chat muted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to mute chat', variant: 'destructive' });
    },
  });

  const unmuteMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      const encodedChatId = encodeURIComponent(chatId);
      return await apiRequest('POST', `/api/whatsapp/chats/${encodedChatId}/unmute`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Chat unmuted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to unmute chat', variant: 'destructive' });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      const encodedChatId = encodeURIComponent(chatId);
      return await apiRequest('DELETE', `/api/whatsapp/chats/${encodedChatId}/messages`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats', selectedChatId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Messages cleared' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to clear messages', variant: 'destructive' });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      const encodedChatId = encodeURIComponent(chatId);
      return await apiRequest('DELETE', `/api/whatsapp/chats/${encodedChatId}`, {});
    },
    onMutate: async ({ chatId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/whatsapp/chats'] });
      
      // Snapshot the previous value
      const previousChats = queryClient.getQueryData(['/api/whatsapp/chats']);
      
      // Optimistically remove the chat from the list
      queryClient.setQueryData(['/api/whatsapp/chats'], (old: any) => {
        if (!old?.chats) return old;
        return {
          ...old,
          chats: old.chats.filter((chat: any) => {
            const id = chat.id?._serialized || chat.id;
            return id !== chatId;
          })
        };
      });
      
      // Clear selected chat immediately
      setSelectedChatId(null);
      
      return { previousChats };
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Chat deleted' });
    },
    onError: (error: any, _variables, context) => {
      // Rollback on error
      if (context?.previousChats) {
        queryClient.setQueryData(['/api/whatsapp/chats'], context.previousChats);
      }
      console.error('[WhatsApp] Delete chat error:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to delete chat', variant: 'destructive' });
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    },
  });

  const sendTypingMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(chatId)}/typing`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.json();
    },
  });

  const stopTypingMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(chatId)}/typing/stop`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.json();
    },
  });

  const sendRecordingMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(chatId)}/recording`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.json();
    },
  });
  const sendPollMutation = useMutation({
    mutationFn: async ({ chatId, name, options, multipleAnswers }: { chatId: string; name: string; options: string[]; multipleAnswers: boolean }) => {
      return await apiRequest('POST', '/api/whatsapp/send-poll', { chatId, name, options, multipleAnswers });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats', selectedChatId, 'messages'] });
      setShowPollDialog(false);
      setPollData({ name: '', options: ['', ''], multipleAnswers: false });
      toast({ title: 'Success', description: 'Poll sent' });
    },
  });

  const editSubjectMutation = useMutation({
    mutationFn: async ({ chatId, subject }: { chatId: string; subject: string }) => {
      return await apiRequest('PUT', `/api/whatsapp/groups/${chatId}/subject`, { subject });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setShowEditSubjectDialog(false);
      toast({ title: 'Success', description: 'Group name updated' });
    },
  });

  const editDescriptionMutation = useMutation({
    mutationFn: async ({ chatId, description }: { chatId: string; description: string }) => {
      return await apiRequest('PUT', `/api/whatsapp/groups/${chatId}/description`, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setShowEditDescriptionDialog(false);
      toast({ title: 'Success', description: 'Description updated' });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      return await apiRequest('POST', `/api/whatsapp/groups/${chatId}/leave`, {});
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
      return await apiRequest('POST', `/api/whatsapp/groups/${chatId}/remove-participant`, { participantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Participant removed' });
    },
  });

  const promoteParticipantMutation = useMutation({
    mutationFn: async ({ chatId, participantIds }: { chatId: string; participantIds: string[] }) => {
      return await apiRequest('PUT', `/api/whatsapp/groups/${chatId}/promote`, { participantIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Participant promoted to admin' });
    },
  });

  const demoteParticipantMutation = useMutation({
    mutationFn: async ({ chatId, participantIds }: { chatId: string; participantIds: string[] }) => {
      return await apiRequest('PUT', `/api/whatsapp/groups/${chatId}/demote`, { participantIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Admin privileges removed' });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/whatsapp/logout', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChatId(null);
      toast({ title: 'Success', description: 'Logged out of WhatsApp' });
    },
  });

  const validateNumberMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return await apiRequest('POST', '/api/whatsapp/validate-number', { phoneNumber });
    },
    onSuccess: (data: any) => {
      if (data.isValid && data.whatsappId) {
        setValidatedWhatsAppId(data.whatsappId);
        toast({ title: 'Success', description: 'Number verified! You can start chatting.' });
      } else {
        toast({ title: 'Invalid Number', description: 'This number is not registered on WhatsApp.', variant: 'destructive' });
      }
      setIsValidatingNumber(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to validate number. Please try again.', variant: 'destructive' });
      setIsValidatingNumber(false);
    },
  });

  // Send message to new chat mutation (creates chat if doesn't exist)
  const sendNewChatMessageMutation = useMutation({
    mutationFn: async ({ phoneNumber, content }: { phoneNumber: string; content: string }) => {
      return await apiRequest('POST', '/api/whatsapp/messages/send-to-number', { phoneNumber, content });
    },
    onSuccess: (data: any) => {
      if (data.success && data.chatId) {
        setSelectedChatId(data.chatId);
        setIsNewChatMode(false);
        setNewChatToNumber('');
        setNewChatMessage('');
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
        toast({ title: 'Message sent', description: 'Your message has been delivered.' });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send', 
        description: error.message || 'Could not send message. Please verify the number is registered on WhatsApp.', 
        variant: 'destructive' 
      });
    },
  });

  // Media upload mutation using FormData (cannot use apiRequest)
  const sendMediaMutation = useMutation({
    mutationFn: async ({ chatId, file, caption, sendAsVoiceNote, blobUrl }: { chatId: string, file: File, caption?: string, sendAsVoiceNote?: boolean, blobUrl?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (caption) formData.append('caption', caption);
      if (sendAsVoiceNote) formData.append('sendAsVoiceNote', 'true');
      
      const res = await fetch(`/api/whatsapp/chats/${chatId}/media`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send media');
      }
      const result = await res.json();
      
      // All media now processes async - schedule refreshes to get real message
      if (result.pending) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${chatId}/messages`] });
        }, 2000);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${chatId}/messages`] });
        }, 5000);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${chatId}/messages`] });
        }, 10000);
      }
      
      return result;
    },
    onMutate: async ({ chatId, file, caption, blobUrl }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/whatsapp/chats/${chatId}/messages`] });
      
      const previousMessages = queryClient.getQueryData([`/api/whatsapp/chats/${chatId}/messages`]);
      
      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';
      
      const tempId = `temp-media-${Date.now()}`;
      const optimisticMessage: WhatsAppMessage = {
        id: tempId,
        body: caption || '',
        from: 'me',
        to: chatId,
        timestamp: Math.floor(Date.now() / 1000),
        isFromMe: true,
        hasMedia: true,
        type: mediaType,
        ack: 0,
        _blobUrl: blobUrl,
      } as WhatsAppMessage & { _blobUrl?: string };
      
      queryClient.setQueryData([`/api/whatsapp/chats/${chatId}/messages`], (old: any) => {
        if (!old?.messages) return { success: true, messages: [optimisticMessage] };
        return { ...old, messages: [...old.messages, optimisticMessage] };
      });
      
      setSelectedFile(null);
      setMediaCaption('');
      setShowMediaPreview(false);
      
      return { previousMessages, chatId, tempId, blobUrl };
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${variables.chatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      if (context?.blobUrl) {
        URL.revokeObjectURL(context.blobUrl);
      }
      toast({ 
        title: 'Success', 
        description: 'Sending in background...'
      });
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData([`/api/whatsapp/chats/${context.chatId}/messages`], context.previousMessages);
      }
      if (context?.blobUrl) {
        URL.revokeObjectURL(context.blobUrl);
      }
      toast({ title: 'Error', description: error.message || 'Failed to send media', variant: 'destructive' });
    },
  });

  // Send sticker mutation
  const sendStickerMutation = useMutation({
    mutationFn: async ({ chatId, file }: { chatId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`/api/whatsapp/chats/${chatId}/sticker`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send sticker');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({ title: 'Success', description: 'Sticker sent' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to send sticker', variant: 'destructive' });
    },
  });

  // Join group by invitation code
  const joinGroupMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      return await apiRequest('POST', '/api/whatsapp/groups/join', { inviteCode });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setShowNewChatDialog(false);
      setJoinGroupCode('');
      setNewChatTab('contacts');
      if (data.chatId) {
        setSelectedChatId(data.chatId);
      }
      toast({ title: 'Success', description: 'Successfully joined the group!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to join group', variant: 'destructive' });
    },
  });

  // Get group invite link
  const getInviteLinkMutation = useMutation({
    mutationFn: async (chatId: string) => {
      return await apiRequest('GET', `/api/whatsapp/groups/${chatId}/invite-link`);
    },
    onSuccess: (data: any) => {
      if (data.inviteLink) {
        setGroupInviteLink(data.inviteLink);
      }
      setIsLoadingInviteLink(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to get invite link', variant: 'destructive' });
      setIsLoadingInviteLink(false);
    },
  });

  // Revoke group invite link
  const revokeInviteLinkMutation = useMutation({
    mutationFn: async (chatId: string) => {
      return await apiRequest('POST', `/api/whatsapp/groups/${chatId}/revoke-invite`);
    },
    onSuccess: (data: any) => {
      if (data.newInviteLink) {
        setGroupInviteLink(data.newInviteLink);
        toast({ title: 'Success', description: 'Invite link revoked and new link generated' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to revoke invite link', variant: 'destructive' });
    },
  });

  // Set user status/about
  const setStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest('PUT', '/api/whatsapp/profile/status', { status });
    },
    onSuccess: () => {
      setIsSavingStatus(false);
      setShowSettingsDialog(false);
      toast({ title: 'Success', description: 'Status updated successfully' });
    },
    onError: (error: Error) => {
      setIsSavingStatus(false);
      toast({ title: 'Error', description: error.message || 'Failed to update status', variant: 'destructive' });
    },
  });

  // Function to fetch profile picture for a contact
  const fetchProfilePicture = async (contactId: string): Promise<string | null> => {
    if (profilePictures[contactId] !== undefined) {
      return profilePictures[contactId];
    }
    
    try {
      const response = await apiRequest('GET', `/api/whatsapp/contacts/${encodeURIComponent(contactId)}/profile`);
      if (response.success && response.profile?.profilePicUrl) {
        setProfilePictures(prev => ({ ...prev, [contactId]: response.profile.profilePicUrl }));
        return response.profile.profilePicUrl;
      }
      setProfilePictures(prev => ({ ...prev, [contactId]: null }));
      return null;
    } catch (error) {
      setProfilePictures(prev => ({ ...prev, [contactId]: null }));
      return null;
    }
  };

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing indicator effect with debounce
  useEffect(() => {
    if (!selectedChatId || !messageInput) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTyping && selectedChatId) {
        setIsTyping(false);
        stopTypingMutation.mutate({ chatId: selectedChatId });
      }
      return;
    }

    if (!isTyping) {
      setIsTyping(true);
      sendTypingMutation.mutate({ chatId: selectedChatId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (selectedChatId) {
        stopTypingMutation.mutate({ chatId: selectedChatId });
      }
    }, 3000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [messageInput, selectedChatId]);

  // Reset contact presence state when switching chats
  useEffect(() => {
    setContactIsTyping(false);
    setContactIsRecording(false);
    setContactLastSeen(null);
    
    // Clear any previous timeout
    if (contactPresenceTimeoutRef.current) {
      clearTimeout(contactPresenceTimeoutRef.current);
      contactPresenceTimeoutRef.current = null;
    }
    
    // Poll for chat presence status periodically
    const pollPresence = async () => {
      if (!selectedChatId || !isAuthenticated) return;
      
      try {
        const res = await fetch(`/api/whatsapp/chats/${encodeURIComponent(selectedChatId)}/presence`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            if (data.presence?.isRecording) {
              setContactIsRecording(true);
              setContactIsTyping(false);
            } else if (data.presence?.isTyping) {
              setContactIsTyping(true);
              setContactIsRecording(false);
            } else {
              setContactIsTyping(false);
              setContactIsRecording(false);
            }
            if (data.presence?.lastSeen) {
              setContactLastSeen(data.presence.lastSeen);
            }
          }
        }
      } catch (error) {
        console.debug('[WhatsApp] Presence check failed:', error);
      }
    };
    
    // Initial poll and set up interval
    if (selectedChatId && isAuthenticated) {
      pollPresence();
      const intervalId = setInterval(pollPresence, 5000);
      return () => clearInterval(intervalId);
    }
  }, [selectedChatId, isAuthenticated]);

  // Mark chat as read when selected
  useEffect(() => {
    if (selectedChatId && isAuthenticated) {
      fetch(`/api/whatsapp/chats/${encodeURIComponent(selectedChatId)}/read`, { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        if (!response.ok) {
          console.error('[WhatsApp] Failed to mark chat as read:', response.status);
        }
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      }).catch((error) => {
        console.error('[WhatsApp] Failed to mark chat as read:', error);
      });
    }
  }, [selectedChatId, isAuthenticated]);

  // Fetch profile pictures for visible chats (first 10)
  useEffect(() => {
    if (!isAuthenticated || !chats.length) return;
    
    const visibleChats = chats.slice(0, 10);
    visibleChats.forEach(chat => {
      if (!chat.isGroup && profilePictures[chat.id] === undefined) {
        fetchProfilePicture(chat.id);
      }
    });
  }, [chats, isAuthenticated]);

  // Fetch profile picture for selected chat
  useEffect(() => {
    if (selectedChatId && isAuthenticated && profilePictures[selectedChatId] === undefined) {
      const selectedChat = chats.find(c => c.id === selectedChatId);
      if (selectedChat && !selectedChat.isGroup) {
        fetchProfilePicture(selectedChatId);
      }
    }
  }, [selectedChatId, isAuthenticated]);

  // Auto-detect existing chat and fetch profile picture when typing in "New Message" mode
  useEffect(() => {
    if (!isNewChatMode || !newChatToNumber.trim()) {
      // Clear profile pic when not in new chat mode or no number
      if (!newChatToNumber.trim()) {
        setNewChatProfilePic(null);
        setNewChatContactName(null);
        setNewChatError(null);
        setNewChatValidationStatus('idle');
      }
      return;
    }
    
    // Clean the entered number - remove spaces, dashes, parentheses, and leading +
    const cleanNumber = newChatToNumber.replace(/[\s\-\(\)\+]/g, '');
    
    // Need at least 10 digits for a valid phone number
    if (cleanNumber.length < 10) {
      setNewChatProfilePic(null);
      setNewChatContactName(null);
      setNewChatError(null);
      setNewChatValidationStatus('idle');
      return;
    }
    
    // Check if this number matches an existing chat
    const existingChat = chats.find(chat => {
      const chatPhone = chat.id.split('@')[0];
      // Match if the clean number ends with or equals the chat phone
      return chatPhone === cleanNumber || 
             chatPhone.endsWith(cleanNumber) || 
             cleanNumber.endsWith(chatPhone);
    });
    
    if (existingChat) {
      // Found existing chat - switch to it automatically
      setSelectedChatId(existingChat.id);
      setIsNewChatMode(false);
      setNewChatToNumber('');
      setNewChatMessage('');
      setNewChatProfilePic(null);
      setNewChatContactName(null);
      return;
    }
    
    // Fetch profile picture and check if number has WhatsApp
    const fetchNewChatProfile = async () => {
      try {
        setNewChatValidationStatus('validating');
        setNewChatError(null);
        
        // First check if the number is registered on WhatsApp
        const registeredRes = await fetch(`/api/whatsapp/number/${encodeURIComponent(cleanNumber)}/registered`, {
          credentials: 'include'
        });
        
        if (registeredRes.ok) {
          const registeredData = await registeredRes.json();
          if (!registeredData.isRegistered) {
            // Number is not on WhatsApp
            setNewChatError('This number is not registered on WhatsApp');
            setNewChatValidationStatus('invalid');
            setNewChatProfilePic(null);
            setNewChatContactName(null);
            return;
          }
        }
        
        // Number has WhatsApp - get profile info
        setNewChatValidationStatus('valid');
        setNewChatError(null);
        const contactId = `${cleanNumber}@c.us`;
        
        // Get contact profile (includes profile picture and name)
        const profileRes = await fetch(`/api/whatsapp/contacts/${encodeURIComponent(contactId)}/profile`, {
          credentials: 'include'
        });
        
        if (profileRes.ok) {
          const data = await profileRes.json();
          console.log('[WhatsApp] Profile data received:', data);
          if (data.success && data.profile) {
            // Set profile picture
            if (data.profile.profilePicUrl) {
              setNewChatProfilePic(data.profile.profilePicUrl);
            }
            // Set contact name from profile object (pushname is the WhatsApp display name)
            const name = data.profile.pushname || data.profile.name;
            console.log('[WhatsApp] Contact name:', name);
            if (name) {
              setNewChatContactName(name);
            }
          }
        }
      } catch (error) {
        console.log('[WhatsApp] Could not fetch profile for:', cleanNumber);
        setNewChatValidationStatus('idle');
      }
    };
    
    // Debounce the fetch to avoid too many requests
    const timeoutId = setTimeout(fetchNewChatProfile, 500);
    return () => clearTimeout(timeoutId);
  }, [newChatToNumber, chats, isNewChatMode]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChatId) return;
    
    sendMessageMutation.mutate({ 
      chatId: selectedChatId, 
      content: messageInput,
      quotedMsgId: replyingTo?.id 
    });
  };

  const handleReply = (message: WhatsAppMessage) => {
    setReplyingTo(message);
  };

  const handleForward = (message: WhatsAppMessage) => {
    setForwardingMessage(message);
    setSelectedForwardChats([]);
    setForwardSearchQuery('');
    setShowForwardDialog(true);
  };
  
  const handleConfirmForward = async () => {
    if (!forwardingMessage || selectedForwardChats.length === 0) return;
    
    try {
      for (const chatId of selectedForwardChats) {
        await apiRequest('POST', `/api/whatsapp/messages/${forwardingMessage.id}/forward`, { chatId });
      }
      toast({ title: 'Success', description: `Message forwarded to ${selectedForwardChats.length} chat(s)` });
      setShowForwardDialog(false);
      setForwardingMessage(null);
      setSelectedForwardChats([]);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to forward message', variant: 'destructive' });
    }
  };

  const handleStar = (message: WhatsAppMessage) => {
    starMutation.mutate({ messageId: message.id, star: !message.isStarred });
  };

  const handleDeleteDirect = (messageId: string, deleteForEveryone: boolean) => {
    deleteMutation.mutate({ messageId, deleteForEveryone });
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

  const handleValidateNumber = () => {
    if (!newChatPhoneNumber.trim()) {
      toast({ title: 'Error', description: 'Please enter a phone number', variant: 'destructive' });
      return;
    }
    setIsValidatingNumber(true);
    setValidatedWhatsAppId(null);
    validateNumberMutation.mutate(newChatPhoneNumber);
  };

  const handleStartNewChat = () => {
    // Clean number and create chatId format
    const cleanNumber = newChatPhoneNumber.replace(/\D/g, '');
    if (cleanNumber.length >= 10) {
      const chatId = cleanNumber + '@c.us';
      setSelectedChatId(chatId);
      setShowNewChatDialog(false);
      setNewChatPhoneNumber('');
      setValidatedWhatsAppId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    } else {
      toast({ title: 'Error', description: 'Please enter a valid phone number with country code', variant: 'destructive' });
    }
  };

  const handleCloseNewChatDialog = () => {
    setShowNewChatDialog(false);
    setNewChatPhoneNumber('');
    setValidatedWhatsAppId(null);
    setIsValidatingNumber(false);
    setContactSearchQuery('');
    setJoinGroupCode('');
    setNewChatTab('contacts');
  };

  // Handle inline new chat mode
  const handleValidateNewChatNumber = async (phoneNumber: string) => {
    if (!phoneNumber.trim()) {
      setNewChatValidationStatus('idle');
      return;
    }
    
    // Clean phone number - remove spaces, dashes, parentheses
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Check if it's an existing chat
    const existingChat = chats.find(chat => {
      const chatPhone = chat.id.split('@')[0];
      return chatPhone === cleanNumber || chatPhone === cleanNumber.replace(/^\+/, '');
    });
    
    if (existingChat) {
      // Switch to existing chat
      setSelectedChatId(existingChat.id);
      setIsNewChatMode(false);
      setNewChatToNumber('');
      setNewChatMessage('');
      return;
    }
    
    // Validate with WhatsApp
    setNewChatValidationStatus('validating');
    
    try {
      const res = await fetch('/api/whatsapp/validate-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber: cleanNumber })
      });
      
      const data = await res.json();
      
      if (data.success && data.isValid) {
        setNewChatValidationStatus('valid');
      } else {
        setNewChatValidationStatus('invalid');
      }
    } catch {
      setNewChatValidationStatus('invalid');
    }
  };
  
  const handleSendNewChatMessage = async () => {
    if (!newChatToNumber.trim() || !newChatMessage.trim()) return;
    
    setIsSendingNewChatMessage(true);
    
    // Clean phone number - remove non-digit characters except leading +
    const cleanNumber = newChatToNumber.replace(/[^\d+]/g, '').replace(/^\+/, '');
    
    try {
      const res = await fetch('/api/whatsapp/messages/send-to-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          phoneNumber: cleanNumber,
          content: newChatMessage 
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.chatId) {
        // Refetch chats and select the new chat
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
        
        // Wait a bit for the chats to update then select the new chat
        setTimeout(() => {
          setSelectedChatId(data.chatId);
          setIsNewChatMode(false);
          setNewChatToNumber('');
          setNewChatMessage('');
          setNewChatValidationStatus('idle');
        }, 500);
        
        toast({ title: 'Message sent', description: 'Chat started successfully' });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to send message. Make sure the number is valid.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setIsSendingNewChatMessage(false);
    }
  };

  // Handle sticker file selection
  const handleStickerSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && selectedChatId) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Error', description: 'Please select an image file for sticker', variant: 'destructive' });
        return;
      }
      if (file.size > 1 * 1024 * 1024) {
        toast({ title: 'Error', description: 'Sticker image must be less than 1MB', variant: 'destructive' });
        return;
      }
      sendStickerMutation.mutate({ chatId: selectedChatId, file });
    }
    event.target.value = '';
  };

  // Handle join group by invite code/link
  const handleJoinGroup = () => {
    if (!joinGroupCode.trim()) {
      toast({ title: 'Error', description: 'Please enter an invite code or link', variant: 'destructive' });
      return;
    }
    setIsJoiningGroup(true);
    let code = joinGroupCode.trim();
    if (code.includes('chat.whatsapp.com/')) {
      code = code.split('chat.whatsapp.com/').pop() || code;
    }
    joinGroupMutation.mutate(code);
    setIsJoiningGroup(false);
  };

  // Handle fetching group invite link
  const handleGetInviteLink = () => {
    if (!selectedChatId) return;
    setIsLoadingInviteLink(true);
    setGroupInviteLink(null);
    getInviteLinkMutation.mutate(selectedChatId);
  };

  // Handle copying invite link to clipboard
  const handleCopyInviteLink = () => {
    if (groupInviteLink) {
      navigator.clipboard.writeText(groupInviteLink);
      toast({ title: 'Copied!', description: 'Invite link copied to clipboard' });
    }
  };

  // Handle revoking invite link
  const handleRevokeInviteLink = () => {
    if (!selectedChatId) return;
    revokeInviteLinkMutation.mutate(selectedChatId);
  };

  // Handle saving user status
  const handleSaveStatus = () => {
    if (!userStatus.trim()) {
      toast({ title: 'Error', description: 'Please enter a status', variant: 'destructive' });
      return;
    }
    setIsSavingStatus(true);
    setStatusMutation.mutate(userStatus.trim());
  };

  // Load profile when settings dialog opens
  const loadMyProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const res = await fetch('/api/whatsapp/profile', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.profile) {
        setUserDisplayName(data.profile.pushname || '');
        setUserStatus(data.profile.about || '');
        setMyProfilePicUrl(data.profile.profilePicUrl);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Save display name
  const handleSaveDisplayName = async () => {
    if (!userDisplayName.trim()) {
      toast({ title: 'Error', description: 'Please enter a display name', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/whatsapp/profile/display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: userDisplayName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Display name updated' });
        setIsEditingDisplayName(false);
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to update display name', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update display name', variant: 'destructive' });
    }
  };

  // Handle profile picture upload
  const handleProfilePicUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/whatsapp/profile/picture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ media: base64 })
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: 'Success', description: 'Profile picture updated' });
          loadMyProfile(); // Reload to get new picture
        } else {
          toast({ title: 'Error', description: data.error || 'Failed to update profile picture', variant: 'destructive' });
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload profile picture', variant: 'destructive' });
    }
  };

  // Handle message input change with @mention detection
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1 && !textBeforeCursor.substring(lastAtSymbol).includes(' ')) {
      const filter = textBeforeCursor.substring(lastAtSymbol + 1);
      setMentionFilter(filter.toLowerCase());
      setMentionPosition(lastAtSymbol);
      if (selectedChat?.isGroup && selectedChat?.participants) {
        setShowMentionPicker(true);
      }
    } else {
      setShowMentionPicker(false);
    }
    
    setMessageInput(value);
  };

  // Insert selected mention into message
  const insertMention = (participant: { id: string; name: string }) => {
    const participantNumber = participant.id.split('@')[0];
    const beforeMention = messageInput.substring(0, mentionPosition);
    const afterMention = messageInput.substring(mentionPosition + mentionFilter.length + 1);
    const mention = `@${participantNumber} `;
    setMessageInput(beforeMention + mention + afterMention);
    setShowMentionPicker(false);
    messageInputRef.current?.focus();
  };

  // Select contact from list to start chat
  const handleSelectContact = (contactId: string) => {
    setSelectedChatId(contactId);
    setShowNewChatDialog(false);
    setNewChatPhoneNumber('');
    setValidatedWhatsAppId(null);
    setContactSearchQuery('');
    queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
  };

  // Filtered contacts based on search
  const filteredContacts = contacts.filter(contact => {
    const searchLower = contactSearchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(searchLower) ||
      contact.number?.includes(contactSearchQuery) ||
      contact.pushname?.toLowerCase().includes(searchLower)
    );
  });

  const handleMuteChat = (duration: number) => {
    if (!selectedChatId) return;
    muteMutation.mutate({ chatId: selectedChatId, duration });
  };

  // Handle search messages in chat
  const handleSearchMessages = async (query: string) => {
    if (!selectedChatId || !query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearchingMessages(true);
    try {
      const encodedChatId = encodeURIComponent(selectedChatId);
      const encodedQuery = encodeURIComponent(query.trim());
      const response = await apiRequest('GET', `/api/whatsapp/search?q=${encodedQuery}&chatId=${encodedChatId}`);
      
      if (response.success && response.results) {
        setSearchResults(response.results);
        if (response.results.length === 0) {
          toast({ title: 'No results', description: 'No messages found matching your search' });
        }
      } else {
        setSearchResults([]);
        toast({ title: 'Search failed', description: response.error || 'Could not search messages', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to search messages', variant: 'destructive' });
      setSearchResults([]);
    } finally {
      setIsSearchingMessages(false);
    }
  };

  // Handle file selection for media upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (16MB limit)
      if (file.size > 16 * 1024 * 1024) {
        toast({ title: 'Error', description: 'File size exceeds 16MB limit', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      setShowMediaPreview(true);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  // Handle sending the selected media file
  const handleSendMedia = () => {
    if (!selectedChatId || !selectedFile) return;
    
    const blobUrl = (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/'))
      ? URL.createObjectURL(selectedFile)
      : undefined;
    
    sendMediaMutation.mutate({
      chatId: selectedChatId,
      file: selectedFile,
      caption: mediaCaption || undefined,
      blobUrl
    });
  };

  // Cancel media preview
  const handleCancelMedia = () => {
    setSelectedFile(null);
    setMediaCaption('');
    setShowMediaPreview(false);
  };

  // Get preview URL for selected file
  const getFilePreviewUrl = () => {
    if (!selectedFile) return null;
    if (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/')) {
      return URL.createObjectURL(selectedFile);
    }
    return null;
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Send recording indicator to contact
      if (selectedChatId) {
        sendRecordingMutation.mutate({ chatId: selectedChatId });
      }
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
        
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Send as voice note
        if (selectedChatId) {
          sendMediaMutation.mutate({
            chatId: selectedChatId,
            file: audioFile,
            sendAsVoiceNote: true
          });
        }
        
        setRecordingTime(0);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
        // Keep sending recording indicator every 4 seconds while recording
        if (selectedChatId && recordingTime > 0 && recordingTime % 4 === 0) {
          sendRecordingMutation.mutate({ chatId: selectedChatId });
        }
      }, 1000);
    } catch (error) {
      toast({ title: 'Error', description: 'Could not access microphone', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);
  
  // Get filtered participants for mentions (must be after selectedChat declaration)
  const filteredParticipants = selectedChat?.participants?.filter(p => 
    p.name.toLowerCase().includes(mentionFilter) || 
    p.id.split('@')[0].includes(mentionFilter)
  ) || [];

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      activeFilter === 'all' ? !chat.isArchived :
      activeFilter === 'unread' ? chat.unreadCount > 0 && !chat.isArchived :
      activeFilter === 'groups' ? chat.isGroup && !chat.isArchived :
      activeFilter === 'archived' ? chat.isArchived :
      false;
    
    return matchesSearch && matchesFilter;
  });

  // =====================================================
  // RENDER: QR CODE VIEW (only if no saved session)
  // =====================================================

  if (!showInterface) {
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

  // Show reconnecting banner when we have a saved session but not fully connected
  const isReconnecting = hasSavedSession && !isAuthenticated;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[var(--whatsapp-bg-primary)]">
      {/* Reconnecting Banner */}
      {isReconnecting && (
        <div className="bg-[var(--whatsapp-green-primary)] text-white px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Reconectando a WhatsApp...</span>
        </div>
      )}
      
      <div className="flex-1 flex overflow-hidden">
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
            <span className="text-lg font-semibold text-[var(--whatsapp-text-primary)]">Chats</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
              onClick={() => {
                setIsNewChatMode(true);
                setSelectedChatId(null);
                setNewChatToNumber('+1');
                setNewChatMessage('');
              }}
              data-testid="button-new-chat"
              title="New Chat"
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
              onClick={() => setShowSettingsDialog(true)}
              data-testid="button-settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
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
        <div className="flex gap-4 px-4 py-2 bg-[var(--whatsapp-bg-secondary)] border-b border-[var(--whatsapp-border)]">
          {(['all', 'unread', 'favorites', 'groups', 'archived'] as FilterTab[]).map((tab) => (
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
          ) : filteredChats.length === 0 && !isNewChatMode ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50 text-[var(--whatsapp-text-tertiary)]" />
              <p className="text-[var(--whatsapp-text-secondary)]">No chats found</p>
            </div>
          ) : (
            <div>
              {/* New Message item - shown when in new chat mode (like iMessage) */}
              {isNewChatMode && (
                <div
                  className="group relative flex items-center gap-3 py-3 px-4 bg-[var(--whatsapp-green-primary)] text-white cursor-pointer border-b border-[var(--whatsapp-border)]"
                  data-testid="chat-new-message"
                >
                  <Avatar className="h-[52px] w-[52px]">
                    {newChatProfilePic ? (
                      <AvatarImage 
                        src={newChatProfilePic} 
                        alt="Contact"
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-white/20 text-white">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[15px]">
                        {newChatContactName || 'New Message'}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-white hover:bg-white/20 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNewChatMode(false);
                          setNewChatToNumber('');
                          setNewChatMessage('');
                          setNewChatValidationStatus('idle');
                          setNewChatProfilePic(null);
                          setNewChatContactName(null);
                          setNewChatError(null);
                        }}
                        data-testid="button-close-new-message"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {newChatToNumber && (
                      <p className="text-sm text-white/90 truncate">
                        {newChatToNumber}
                      </p>
                    )}
                  </div>
                </div>
              )}

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
                    {profilePictures[chat.id] && (
                      <AvatarImage 
                        src={profilePictures[chat.id]!} 
                        alt={chat.name}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback
                      className="text-white font-semibold"
                      style={{ backgroundColor: getAvatarColorFromString(chat.id) }}
                    >
                      {chat.isGroup ? <Users className="h-6 w-6" /> : getInitials(chat.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-medium text-[var(--whatsapp-text-primary)] truncate">{chat.name}</h3>
                        {chat.isMuted && <BellOff className="h-3.5 w-3.5 text-[var(--whatsapp-text-tertiary)] flex-shrink-0" />}
                      </div>
                      <span className="text-xs text-[var(--whatsapp-text-tertiary)] ml-2 flex-shrink-0">
                        {chat.lastMessage && formatTimestamp(chat.lastMessage.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[var(--whatsapp-text-secondary)] truncate">
                        {chat.lastMessage?.body || 'No messages yet'}
                      </p>
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        {chat.isPinned && (
                          <Pin className="h-4 w-4 text-[var(--whatsapp-text-secondary)]" style={{ transform: 'rotate(45deg)' }} />
                        )}
                        {chat.unreadCount > 0 && (
                          <Badge 
                            className="bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-primary)] text-white rounded-full h-5 min-w-[20px] px-1.5 text-xs"
                          >
                            {chat.unreadCount}
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
                  {profilePictures[selectedChat.id] && (
                    <AvatarImage 
                      src={profilePictures[selectedChat.id]!} 
                      alt={selectedChat.name}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback
                    className="text-white font-semibold"
                    style={{ backgroundColor: getAvatarColorFromString(selectedChat.id) }}
                  >
                    {selectedChat.isGroup ? <Users className="h-5 w-5" /> : getInitials(selectedChat.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-medium text-[var(--whatsapp-text-primary)]">{selectedChat.name}</h2>
                  <p className="text-xs truncate max-w-[200px]" data-testid="text-contact-status">
                    {contactIsRecording ? (
                      <span className="text-[#25D366] font-medium animate-pulse">grabando audio...</span>
                    ) : contactIsTyping ? (
                      <span className="text-[#25D366] font-medium animate-pulse">escribiendo...</span>
                    ) : contactLastSeen ? (
                      <span className="text-[var(--whatsapp-text-secondary)]">{contactLastSeen}</span>
                    ) : (
                      <span className="text-[var(--whatsapp-text-secondary)]">
                        {contactInfo?.about || (selectedChat.isGroup ? 'Grupo' : 'click here for contact info')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                    <DropdownMenuItem 
                      onClick={() => {
                        setSearchMessagesQuery('');
                        setSearchResults([]);
                        setShowSearchMessagesDialog(true);
                      }}
                      data-testid="menu-search"
                    >
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
                      onClick={() => setShowDeleteChatDialog(true)}
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
                backgroundColor: '#e5ddd5',
                backgroundImage: `url("https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
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
                  {messages.map((message, index) => {
                    const showDateSeparator = index === 0 || 
                      getMessageDateKey(message.timestamp) !== getMessageDateKey(messages[index - 1].timestamp);
                    
                    return (
                      <div key={message.id}>
                        {/* Date Separator */}
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4" data-testid={`date-separator-${getMessageDateKey(message.timestamp)}`}>
                            <div className="bg-[var(--whatsapp-bg-secondary)] text-[var(--whatsapp-text-secondary)] px-3 py-1 rounded-lg text-xs font-medium shadow-sm">
                              {formatDateSeparator(message.timestamp)}
                            </div>
                          </div>
                        )}
                        <MessageItem
                          message={message}
                          onReply={() => handleReply(message)}
                          onForward={() => handleForward(message)}
                          onStar={() => handleStar(message)}
                          onDelete={(deleteForEveryone) => handleDeleteDirect(message.id, deleteForEveryone)}
                          onReact={(emoji) => handleReact(message, emoji)}
                          onDownload={() => handleDownload(message)}
                          onInfo={() => handleMessageInfo(message)}
                          onCopy={() => handleCopy(message)}
                        />
                      </div>
                    );
                  })}
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
                      Replying to {formatContactName(replyingTo.from)}
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

            {/* Hidden file input for media uploads */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
              data-testid="input-file-upload"
            />

            {/* Message Input Footer */}
            <div className="px-4 py-2 bg-[var(--whatsapp-bg-panel-header)] border-t border-[var(--whatsapp-border)]">
              {/* Voice Recording UI */}
              {isRecording ? (
                <div className="flex items-center gap-4 justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelRecording}
                    className="h-10 w-10 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                    data-testid="button-cancel-recording"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-red-500">
                      Recording {formatRecordingTime(recordingTime)}
                    </span>
                  </div>
                  
                  <Button
                    onClick={stopRecording}
                    size="icon"
                    className="h-10 w-10 rounded-full bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)] text-white"
                    data-testid="button-stop-recording"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      data-testid="menu-attach-image"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'image/*';
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      <Image className="h-4 w-4 mr-2" />
                      Photos & Images
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      data-testid="menu-attach-video"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'video/*';
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Video
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      data-testid="menu-attach-document"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx';
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      <FileIconLucide className="h-4 w-4 mr-2" />
                      Document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <div className="flex-1 relative">
                  {/* Mentions Picker */}
                  {showMentionPicker && selectedChat?.isGroup && filteredParticipants.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--whatsapp-bg-secondary)] border border-[var(--whatsapp-border)] rounded-lg shadow-lg max-h-48 overflow-y-auto z-50" data-testid="mentions-picker">
                      <div className="p-2 text-xs text-[var(--whatsapp-text-secondary)] border-b border-[var(--whatsapp-border)] flex items-center gap-1">
                        <AtSign className="h-3 w-3" />
                        Mention a participant
                      </div>
                      {filteredParticipants.slice(0, 10).map((participant) => (
                        <button
                          key={participant.id}
                          onClick={() => insertMention(participant)}
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[var(--whatsapp-hover)] transition-colors text-left"
                          data-testid={`mention-item-${participant.id}`}
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarFallback 
                              className="text-white text-xs font-medium"
                              style={{ backgroundColor: getAvatarColorFromString(participant.id) }}
                            >
                              {getInitials(participant.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--whatsapp-text-primary)] truncate">
                              {participant.name}
                            </div>
                            <div className="text-xs text-[var(--whatsapp-text-secondary)] truncate">
                              {participant.id.split('@')[0]}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <Input
                    ref={messageInputRef}
                    placeholder={selectedChat?.isGroup ? "Type a message (use @ to mention)" : "Type a message"}
                    value={messageInput}
                    onChange={handleMessageInputChange}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !showMentionPicker) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="w-full bg-[var(--whatsapp-bg-secondary)] border-0 rounded-lg h-10 text-sm text-[var(--whatsapp-text-primary)]"
                    data-testid="input-message"
                  />
                </div>
                {messageInput.trim() ? (
                  <Button
                    onClick={handleSendMessage}
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
                    onClick={startRecording}
                    data-testid="button-voice"
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                )}
              </div>
              )}
            </div>
          </>
        ) : isNewChatMode ? (
          <div className="flex-1 flex flex-col bg-[var(--whatsapp-bg-primary)] border-l border-[var(--whatsapp-border)]">
            {/* New Message Header - To: input with profile preview (like iMessage) */}
            <div className="px-4 py-3 border-b border-[var(--whatsapp-border)] bg-[var(--whatsapp-bg-panel-header)]">
              {/* Show profile preview when validated */}
              {newChatValidationStatus === 'valid' && newChatToNumber.trim() && (
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    {newChatProfilePic ? (
                      <AvatarImage src={newChatProfilePic} alt="Contact" />
                    ) : (
                      <AvatarFallback className="bg-[var(--whatsapp-green-primary)] text-white">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--whatsapp-text-primary)] truncate">
                      {newChatContactName || newChatToNumber}
                    </p>
                    <p className="text-sm text-[var(--whatsapp-text-secondary)] truncate">
                      {newChatToNumber.replace(/\D/g, '')}
                    </p>
                  </div>
                </div>
              )}
              {/* To: input field */}
              <div className="flex items-center gap-3">
                <span className="text-[var(--whatsapp-text-secondary)] font-medium">To:</span>
                <input
                  type="tel"
                  placeholder="Name or Number"
                  value={newChatToNumber}
                  onChange={(e) => {
                    setNewChatToNumber(e.target.value);
                    setNewChatValidationStatus('idle');
                  }}
                  className="flex-1 bg-transparent border-0 outline-none text-[var(--whatsapp-text-primary)] placeholder:text-[var(--whatsapp-text-tertiary)]"
                  data-testid="input-new-chat-phone"
                  autoFocus
                />
              </div>
            </div>

            {/* Empty Messages Area (like iMessage) - show error if number not on WhatsApp */}
            <div className="flex-1 bg-[var(--whatsapp-bg-primary)] flex items-center justify-center">
              {newChatError && (
                <div className="flex flex-col items-center gap-3 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="text-red-500 font-medium">{newChatError}</p>
                  <p className="text-sm text-[var(--whatsapp-text-tertiary)]">
                    Please check the number and try again
                  </p>
                </div>
              )}
              {newChatValidationStatus === 'validating' && !newChatError && (
                <div className="flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--whatsapp-green-primary)]" />
                  <p className="text-sm text-[var(--whatsapp-text-secondary)]">Checking WhatsApp...</p>
                </div>
              )}
            </div>

            {/* Message Input (like iMessage) */}
            <div className="px-6 py-4 border-t border-[var(--whatsapp-border)]">
              <div className="flex items-center gap-2">
                {/* Attachment button */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-[var(--whatsapp-icon)] hover:text-[var(--whatsapp-text-primary)] flex-shrink-0"
                  data-testid="attach-button-new-chat"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>

                {/* Message input */}
                <Input
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && newChatToNumber.trim() && newChatMessage.trim()) {
                      e.preventDefault();
                      handleSendNewChatMessage();
                    }
                  }}
                  placeholder="WhatsApp"
                  className="flex-1 border-0 bg-[var(--whatsapp-bg-secondary)] rounded-full px-4 text-[var(--whatsapp-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--whatsapp-green-primary)]"
                  disabled={isSendingNewChatMessage}
                  data-testid="input-new-chat-message"
                />

                {/* Emoji button */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full text-[var(--whatsapp-icon)] hover:text-[var(--whatsapp-text-primary)] flex-shrink-0"
                  data-testid="emoji-button-new-chat"
                >
                  <Smile className="h-5 w-5" />
                </Button>

                {/* Send button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-[var(--whatsapp-green-primary)] hover:text-[var(--whatsapp-green-dark)] disabled:opacity-50"
                  onClick={handleSendNewChatMessage}
                  disabled={!newChatToNumber.trim() || !newChatMessage.trim() || isSendingNewChatMessage}
                  data-testid="button-send-new-chat"
                >
                  {isSendingNewChatMessage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
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
          inviteLink={groupInviteLink}
          isLoadingInviteLink={isLoadingInviteLink}
          onGetInviteLink={handleGetInviteLink}
          onCopyInviteLink={handleCopyInviteLink}
          onRevokeInviteLink={handleRevokeInviteLink}
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

      {/* Delete Chat Confirmation Dialog */}
      <AlertDialog open={showDeleteChatDialog} onOpenChange={setShowDeleteChatDialog}>
        <AlertDialogContent data-testid="dialog-delete-chat-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages in this conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-chat">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedChatId) {
                  deleteChatMutation.mutate({ chatId: selectedChatId });
                }
                setShowDeleteChatDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-chat"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Forward Message Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={(open) => {
        if (!open) {
          setShowForwardDialog(false);
          setForwardingMessage(null);
          setSelectedForwardChats([]);
        }
      }}>
        <DialogContent data-testid="dialog-forward" className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-5 w-5" />
              Forward Message
            </DialogTitle>
            <DialogDescription>
              Select one or more chats to forward this message to.
            </DialogDescription>
          </DialogHeader>
          
          {forwardingMessage && (
            <div className="p-3 bg-muted rounded-lg text-sm mb-4 max-h-20 overflow-y-auto">
              {forwardingMessage.body}
            </div>
          )}
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={forwardSearchQuery}
              onChange={(e) => setForwardSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-forward-search"
            />
          </div>
          
          <ScrollArea className="flex-1 max-h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {chats
                .filter(chat => 
                  chat.name.toLowerCase().includes(forwardSearchQuery.toLowerCase()) ||
                  chat.id.includes(forwardSearchQuery)
                )
                .map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => {
                      setSelectedForwardChats(prev => 
                        prev.includes(chat.id)
                          ? prev.filter(id => id !== chat.id)
                          : [...prev, chat.id]
                      );
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-colors",
                      selectedForwardChats.includes(chat.id)
                        ? "bg-[var(--whatsapp-green-primary)]/10 border border-[var(--whatsapp-green-primary)]"
                        : "hover:bg-muted"
                    )}
                    data-testid={`forward-chat-${chat.id}`}
                  >
                    <Avatar className="h-10 w-10">
                      {profilePictures[chat.id] && (
                        <AvatarImage src={profilePictures[chat.id]!} />
                      )}
                      <AvatarFallback
                        className="text-white text-sm"
                        style={{ backgroundColor: getAvatarColorFromString(chat.id) }}
                      >
                        {chat.isGroup ? <Users className="h-4 w-4" /> : getInitials(chat.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{chat.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatContactName(chat.id)}
                      </div>
                    </div>
                    {selectedForwardChats.includes(chat.id) && (
                      <div className="h-5 w-5 rounded-full bg-[var(--whatsapp-green-primary)] flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
            </div>
          </ScrollArea>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowForwardDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmForward}
              disabled={selectedForwardChats.length === 0}
              className="bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)]"
              data-testid="button-confirm-forward"
            >
              Forward to {selectedForwardChats.length} chat{selectedForwardChats.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={handleCloseNewChatDialog}>
        <DialogContent data-testid="dialog-new-chat" className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[var(--whatsapp-green-primary)]" />
              New Chat
            </DialogTitle>
            <DialogDescription>
              Start a new conversation or join a group.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={newChatTab} onValueChange={(v) => setNewChatTab(v as 'contacts' | 'join-group')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
              <TabsTrigger value="join-group" data-testid="tab-join-group">Join Group</TabsTrigger>
            </TabsList>
            
            <TabsContent value="contacts" className="flex-1 overflow-hidden flex flex-col mt-4 space-y-4">
              {/* Phone Number Input */}
              <div className="space-y-2">
                <Label htmlFor="phone-number">Phone Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="phone-number"
                    value={newChatPhoneNumber}
                    onChange={(e) => {
                      setNewChatPhoneNumber(e.target.value);
                      setValidatedWhatsAppId(null);
                    }}
                    placeholder="+1234567890"
                    className="flex-1"
                    data-testid="input-new-chat-phone"
                    disabled={isValidatingNumber}
                  />
                  <Button
                    onClick={handleValidateNumber}
                    disabled={isValidatingNumber || !newChatPhoneNumber.trim()}
                    variant="outline"
                    data-testid="button-validate-number"
                  >
                    {isValidatingNumber ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {newChatPhoneNumber.replace(/\D/g, '').length >= 10 && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">Number verified!</span>
                  </div>
                  <Button 
                    onClick={handleStartNewChat}
                    className="w-full mt-2 bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)] text-white"
                    data-testid="button-start-new-chat"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start Chat
                  </Button>
                </div>
              )}

              <Separator />

              {/* Contacts List */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <Label>WhatsApp Contacts</Label>
                  <span className="text-xs text-muted-foreground">
                    {contacts.length} contacts
                  </span>
                </div>
                
                {/* Contact Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-contacts"
                  />
                </div>
                
                {/* Contacts ScrollArea */}
                <ScrollArea className="flex-1 -mx-2 px-2">
                {contactsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {contactSearchQuery ? 'No contacts found' : 'No contacts available'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredContacts.slice(0, 50).map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleSelectContact(contact.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                        data-testid={`contact-item-${contact.id}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback 
                            className="text-white font-medium text-sm"
                            style={{ backgroundColor: getAvatarColorFromString(contact.id) }}
                          >
                            {getInitials(contact.name || contact.pushname || contact.number)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {contact.name || contact.pushname || 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            +{contact.number}
                          </div>
                        </div>
                        <MessageSquare className="h-4 w-4 text-[var(--whatsapp-green-primary)] opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                    {filteredContacts.length > 50 && (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        Showing first 50 of {filteredContacts.length} contacts
                      </p>
                    )}
                  </div>
                )}
              </ScrollArea>
              </div>
            </TabsContent>
            
            {/* Join Group Tab */}
            <TabsContent value="join-group" className="mt-4 space-y-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--whatsapp-green-primary)]/10 mb-3">
                  <Users className="h-8 w-8 text-[var(--whatsapp-green-primary)]" />
                </div>
                <h3 className="font-semibold text-[var(--whatsapp-text-primary)]">Join a Group</h3>
                <p className="text-sm text-[var(--whatsapp-text-secondary)]">
                  Enter an invitation link or code to join a WhatsApp group
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invite Link or Code</Label>
                <Input
                  id="invite-code"
                  value={joinGroupCode}
                  onChange={(e) => setJoinGroupCode(e.target.value)}
                  placeholder="https://chat.whatsapp.com/... or invite code"
                  data-testid="input-join-group-code"
                />
                <p className="text-xs text-muted-foreground">
                  Paste the full invitation link or just the code at the end
                </p>
              </div>
              
              <Button
                onClick={handleJoinGroup}
                disabled={!joinGroupCode.trim() || joinGroupMutation.isPending}
                className="w-full bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)] text-white"
                data-testid="button-join-group"
              >
                {joinGroupMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Join Group
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseNewChatDialog}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Preview Dialog */}
      <Dialog open={showMediaPreview} onOpenChange={(open) => {
        if (!open) handleCancelMedia();
      }}>
        <DialogContent data-testid="dialog-media-preview" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Send Media
            </DialogTitle>
            <DialogDescription>
              Preview your file before sending
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && (
              <div className="flex flex-col items-center">
                {selectedFile.type.startsWith('image/') && (
                  <img 
                    src={getFilePreviewUrl() || ''} 
                    alt="Preview" 
                    className="max-w-full max-h-64 rounded-lg object-contain"
                    data-testid="preview-image"
                  />
                )}
                {selectedFile.type.startsWith('video/') && (
                  <video 
                    src={getFilePreviewUrl() || ''} 
                    controls 
                    className="max-w-full max-h-64 rounded-lg"
                    data-testid="preview-video"
                  />
                )}
                {selectedFile.type.startsWith('audio/') && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-4 bg-[var(--whatsapp-bg-secondary)] rounded-full">
                      <Mic className="h-8 w-8 text-[var(--whatsapp-icon)]" />
                    </div>
                    <audio 
                      src={getFilePreviewUrl() || ''} 
                      controls 
                      className="w-full"
                      data-testid="preview-audio"
                    />
                  </div>
                )}
                {!selectedFile.type.startsWith('image/') && 
                 !selectedFile.type.startsWith('video/') && 
                 !selectedFile.type.startsWith('audio/') && (
                  <div className="flex flex-col items-center gap-2 p-8 bg-[var(--whatsapp-bg-secondary)] rounded-lg">
                    <FileIconLucide className="h-12 w-12 text-[var(--whatsapp-icon)]" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                )}
                <p className="text-sm text-center mt-2 text-muted-foreground">
                  {selectedFile.name} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="media-caption">Caption (optional)</Label>
              <Input
                id="media-caption"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="Add a caption..."
                data-testid="input-media-caption"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelMedia} data-testid="button-cancel-media">
              Cancel
            </Button>
            <Button 
              onClick={handleSendMedia}
              disabled={sendMediaMutation.isPending}
              className="bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)] text-white"
              data-testid="button-send-media"
            >
              {sendMediaMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Messages Dialog */}
      <Dialog open={showSearchMessagesDialog} onOpenChange={(open) => {
        setShowSearchMessagesDialog(open);
        if (!open) {
          setSearchMessagesQuery('');
          setSearchResults([]);
        }
      }}>
        <DialogContent data-testid="dialog-search-messages" className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-[var(--whatsapp-green-primary)]" />
              Search Messages
            </DialogTitle>
            <DialogDescription>
              Search within {selectedChat?.name || 'this chat'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex gap-2 mt-4">
            <Input
              placeholder="Search messages..."
              value={searchMessagesQuery}
              onChange={(e) => setSearchMessagesQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchMessages(searchMessagesQuery);
                }
              }}
              className="flex-1"
              data-testid="input-search-messages"
            />
            <Button 
              onClick={() => handleSearchMessages(searchMessagesQuery)}
              disabled={isSearchingMessages || !searchMessagesQuery.trim()}
              className="bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)] text-white"
              data-testid="button-search-messages"
            >
              {isSearchingMessages ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto mt-4 max-h-[400px]">
            {isSearchingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--whatsapp-green-primary)]" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchMessagesQuery ? 'No messages found' : 'Enter a search term to find messages'}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Found {searchResults.length} message{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((msg) => (
                  <div 
                    key={msg.id}
                    className="p-3 rounded-lg bg-[var(--whatsapp-bg-secondary)] hover:bg-[var(--whatsapp-hover)] cursor-pointer transition-colors"
                    onClick={() => {
                      setShowSearchMessagesDialog(false);
                    }}
                    data-testid={`search-result-${msg.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[var(--whatsapp-green-primary)]">
                        {formatContactName(msg.from)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--whatsapp-text-primary)] line-clamp-2">
                      {msg.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={(open) => {
        setShowSettingsDialog(open);
        if (open && isAuthenticated) {
          loadMyProfile();
        }
      }}>
        <DialogContent data-testid="dialog-settings" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[var(--whatsapp-green-primary)]" />
              Settings
            </DialogTitle>
            <DialogDescription>
              Manage your WhatsApp profile and preferences
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--whatsapp-green-primary)]" />
            </div>
          ) : (
            <div className="space-y-6 mt-4">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <Avatar className="h-24 w-24 cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
                    {myProfilePicUrl ? (
                      <AvatarImage src={myProfilePicUrl} alt="Profile" />
                    ) : null}
                    <AvatarFallback className="bg-[var(--whatsapp-green-primary)] text-white font-semibold text-2xl">
                      {userDisplayName ? getInitials(userDisplayName) : <User className="h-10 w-10" />}
                    </AvatarFallback>
                  </Avatar>
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => profilePicInputRef.current?.click()}
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                  <input
                    ref={profilePicInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePicUpload}
                    data-testid="input-profile-pic"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Click to change profile picture</p>
              </div>
              
              <Separator />
              
              {/* Display Name Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--whatsapp-text-secondary)]" />
                    <Label htmlFor="display-name">Display Name</Label>
                  </div>
                  {!isEditingDisplayName && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setIsEditingDisplayName(true)}
                      data-testid="button-edit-display-name"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isEditingDisplayName ? (
                  <div className="flex gap-2">
                    <Input
                      id="display-name"
                      value={userDisplayName}
                      onChange={(e) => setUserDisplayName(e.target.value)}
                      placeholder="Your display name"
                      className="flex-1"
                      data-testid="input-display-name"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveDisplayName}
                      className="bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)]"
                      data-testid="button-save-display-name"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setIsEditingDisplayName(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--whatsapp-text-primary)] py-2">
                    {userDisplayName || 'Not set'}
                  </p>
                )}
              </div>
              
              <Separator />
              
              {/* Status/About Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-[var(--whatsapp-text-secondary)]" />
                  <Label htmlFor="user-status">Status / About</Label>
                </div>
                <Textarea
                  id="user-status"
                  value={userStatus}
                  onChange={(e) => setUserStatus(e.target.value)}
                  placeholder="Hey there! I am using WhatsApp"
                  rows={3}
                  className="resize-none"
                  data-testid="input-user-status"
                />
                <p className="text-xs text-muted-foreground">
                  This will be visible to your contacts
                </p>
              </div>
              
              <Button
                onClick={handleSaveStatus}
                disabled={!userStatus.trim() || setStatusMutation.isPending}
                className="w-full bg-[var(--whatsapp-green-primary)] hover:bg-[var(--whatsapp-green-dark)] text-white"
                data-testid="button-save-status"
              >
                {setStatusMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Status
                  </>
                )}
              </Button>
              
              <Separator />
              
              {/* Logout Section */}
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setShowSettingsDialog(false);
                  logoutMutation.mutate();
                }}
                disabled={logoutMutation.isPending}
                data-testid="button-logout-settings"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
