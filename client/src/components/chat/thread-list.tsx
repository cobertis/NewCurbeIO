import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquarePlus, Pin, BellOff, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { formatForDisplay } from "@shared/phone";
import type { BulkvsThread, UnifiedContact } from "@shared/schema";
import defaultAvatar from "@assets/generated_images/Generic_user_avatar_icon_55b842ef.png";
import { NewMessageSheet } from "./new-message-sheet";

interface ThreadListProps {
  threads: BulkvsThread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewMessage?: () => void;
  onSettings?: () => void;
  userTimezone?: string;
  showNewMessageView?: boolean;
  contacts?: UnifiedContact[];
  onCreateNewThread?: (phoneNumber: string) => void;
  onCloseNewMessage?: () => void;
}

type FilterType = "all" | "unread" | "archived";

export function ThreadList({ 
  threads, 
  selectedThreadId, 
  onSelectThread,
  onNewMessage,
  onSettings,
  userTimezone,
  showNewMessageView = false,
  contacts = [],
  onCreateNewThread,
  onCloseNewMessage,
}: ThreadListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredThreads = useMemo(() => {
    let result = threads;

    if (filter === "unread") {
      result = result.filter(t => t.unreadCount > 0);
    } else if (filter === "archived") {
      result = result.filter(t => t.isArchived);
    } else {
      result = result.filter(t => !t.isArchived);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.displayName?.toLowerCase().includes(query) ||
        t.externalPhone.includes(query) ||
        t.lastMessagePreview?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [threads, filter, searchQuery]);

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isPhoneNumber = (text?: string) => {
    if (!text) return false;
    // Check if text is primarily digits (phone number)
    const digitsOnly = text.replace(/\D/g, "");
    return digitsOnly.length >= 10;
  };

  const formatTimestamp = (date: Date | string | null | undefined) => {
    if (!date) return "";
    
    // Parse timestamptz (from database) and convert to user's timezone
    const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dateStr = date instanceof Date ? date.toISOString() : date;
    const zonedDate = toZonedTime(parseISO(dateStr), tz);
    const now = toZonedTime(new Date(), tz);
    
    // Check if same day (in user's timezone)
    const isSameDay = format(zonedDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    
    // Check if yesterday (in user's timezone)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYest = format(zonedDate, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd");
    
    if (isSameDay) {
      return format(zonedDate, "h:mm a");
    } else if (isYest) {
      return "Yesterday";
    } else {
      return format(zonedDate, "M/d/yy");
    }
  };

  // Si está en modo "New Message", mostrar ese componente en su lugar
  if (showNewMessageView && onCreateNewThread && onCloseNewMessage) {
    return (
      <Card className="h-full flex flex-col border-r overflow-hidden" data-testid="thread-list">
        <NewMessageSheet
          threads={threads}
          contacts={contacts}
          onSelectThread={onSelectThread}
          onCreateNewThread={onCreateNewThread}
          onClose={onCloseNewMessage}
        />
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border-r overflow-hidden" data-testid="thread-list">
      <div className="p-4 border-b space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chat</h2>
          <div className="flex gap-1">
            {onSettings && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onSettings}
                data-testid="button-settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            {onNewMessage && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onNewMessage}
                data-testid="button-new-message"
              >
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
            <TabsTrigger value="unread" data-testid="filter-unread">Unread</TabsTrigger>
            <TabsTrigger value="archived" data-testid="filter-archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredThreads.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  "w-full p-3 rounded-lg flex items-start gap-3 hover:bg-accent transition-colors text-left",
                  selectedThreadId === thread.id && "bg-accent"
                )}
                data-testid={`thread-${thread.id}`}
              >
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarImage src={defaultAvatar} alt="Contact" />
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="font-medium truncate" data-testid={`thread-name-${thread.id}`}>
                        {thread.displayName || formatForDisplay(thread.externalPhone)}
                      </span>
                      {thread.isPinned && (
                        <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" data-testid="icon-pinned" />
                      )}
                      {thread.isMuted && (
                        <BellOff className="h-3 w-3 text-muted-foreground flex-shrink-0" data-testid="icon-muted" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2" data-testid={`thread-time-${thread.id}`}>
                      {formatTimestamp(thread.lastMessageAt ?? undefined)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground truncate flex-1" data-testid={`thread-preview-${thread.id}`}>
                      {thread.lastMessagePreview || "No messages yet"}
                    </p>
                    {thread.unreadCount > 0 && (
                      <Badge
                        variant="default"
                        className="rounded-full h-5 min-w-[20px] px-1.5 text-xs flex items-center justify-center flex-shrink-0"
                        data-testid={`unread-count-${thread.id}`}
                      >
                        {thread.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
