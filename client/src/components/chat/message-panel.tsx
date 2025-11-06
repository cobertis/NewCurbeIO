import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, BellOff, BellRing, MoreVertical, Pin, PinOff, ChevronLeft, Info, Trash2 } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import type { BulkvsThread, BulkvsMessage } from "@shared/schema";

interface MessagePanelProps {
  thread: BulkvsThread | null;
  messages: BulkvsMessage[];
  onSendMessage: (message: string, mediaFile?: File) => void;
  onUpdateThread?: (updates: Partial<BulkvsThread>) => void;
  onDeleteThread?: () => void;
  onBack?: () => void;
  onShowDetails?: () => void;
  isLoading?: boolean;
}

export function MessagePanel({
  thread,
  messages,
  onSendMessage,
  onUpdateThread,
  onDeleteThread,
  onBack,
  onShowDetails,
  isLoading = false,
}: MessagePanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, autoScroll]);

  if (!thread) {
    return (
      <Card className="h-full flex items-center justify-center" data-testid="empty-state">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Select a conversation to start chatting
          </p>
        </div>
      </Card>
    );
  }

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const areaCode = cleaned.slice(1, 4);
      const prefix = cleaned.slice(4, 7);
      const line = cleaned.slice(7);
      return `+1 (${areaCode}) ${prefix}-${line}`;
    }
    return phone;
  };

  const renderDateDivider = (date: Date) => {
    let label = format(date, "MMMM d, yyyy");
    
    if (isToday(date)) {
      label = "Today";
    } else if (isYesterday(date)) {
      label = "Yesterday";
    }

    return (
      <div className="flex items-center gap-3 my-4" data-testid="date-divider">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
          {label}
        </span>
        <Separator className="flex-1" />
      </div>
    );
  };

  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.createdAt);
    const dateKey = format(date, "yyyy-MM-dd");
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    
    return groups;
  }, {} as Record<string, BulkvsMessage[]>);

  const handleTogglePinned = () => {
    if (!onUpdateThread) return;
    onUpdateThread({ isPinned: !thread.isPinned });
  };

  const handleToggleMuted = () => {
    if (!onUpdateThread) return;
    onUpdateThread({ isMuted: !thread.isMuted });
  };

  const handleArchive = () => {
    if (!onUpdateThread) return;
    onUpdateThread({ isArchived: !thread.isArchived });
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteDialog(false);
    if (onDeleteThread) {
      onDeleteThread();
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden" data-testid="message-panel">
      <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="md:hidden flex-shrink-0"
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold truncate" data-testid="header-contact-name">
              {thread.displayName ?? "Unknown Contact"}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="header-contact-phone">
              {formatPhone(thread.externalPhone)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {onShowDetails && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowDetails}
              className="md:hidden"
              data-testid="button-show-details"
            >
              <Info className="h-5 w-5" />
            </Button>
          )}

          {onUpdateThread && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-more">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleTogglePinned} data-testid="menu-pin">
                  {thread.isPinned ? (
                    <>
                      <PinOff className="h-4 w-4 mr-2" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4 mr-2" />
                      Pin
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleMuted} data-testid="menu-mute">
                  {thread.isMuted ? (
                    <>
                      <BellRing className="h-4 w-4 mr-2" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <BellOff className="h-4 w-4 mr-2" />
                      Mute
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive} data-testid="menu-archive">
                  <Archive className="h-4 w-4 mr-2" />
                  {thread.isArchived ? "Unarchive" : "Archive"}
                </DropdownMenuItem>
                {onDeleteThread && (
                  <DropdownMenuItem 
                    onClick={handleDeleteClick} 
                    data-testid="menu-delete"
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="delete-thread-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This will permanently delete all messages in this thread. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          Object.entries(groupedMessages)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([dateKey, dayMessages]) => (
              <div key={dateKey}>
                {renderDateDivider(new Date(dateKey))}
                {dayMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOutbound={message.direction === "outbound"}
                    contactName={thread.displayName ?? undefined}
                  />
                ))}
              </div>
            ))
        )}
      </ScrollArea>

      <MessageInput onSendMessage={onSendMessage} />
    </Card>
  );
}
