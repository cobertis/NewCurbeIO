import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Send,
  Search,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Check,
  CheckCheck,
  Clock,
  RefreshCw,
  LogOut,
} from "lucide-react";

interface WhatsAppConnectionStatus {
  companyId: string;
  isConnected: boolean;
  connectionState: "close" | "connecting" | "open";
  qrCode: string | null;
  lastError: string | null;
  phoneNumber: string | null;
}

interface WhatsAppContact {
  id: string;
  companyId: string;
  jid: string;
  name: string;
  businessName?: string;
  avatarUrl?: string;
  isBusiness: boolean;
  phone: string;
}

interface WhatsAppChat {
  id: string;
  companyId: string;
  jid: string;
  contactId?: string;
  title?: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessageId?: string;
  lastMessageTs?: number;
  archived: boolean;
  contact: WhatsAppContact | null;
  lastMessage: WhatsAppMessage | null;
}

interface WhatsAppMessage {
  id: string;
  companyId: string;
  chatId: string;
  messageKey: string;
  remoteJid: string;
  fromMe: boolean;
  content: string | null;
  messageData: any;
  messageType: string;
  status: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  timestamp: number;
  createdAt: string;
}

function getInitials(name: string): string {
  if (!name || name.trim() === "") return "?";
  if (/^[\+\d\s\-\(\)]+$/.test(name.trim())) {
    return "#";
  }
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "M/d/yyyy");
  return format(date, "M/d/yyyy");
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return "";
  return format(date, "h:mm a");
}

function formatDateSeparator(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return "TODAY";
  if (isToday(date)) return "TODAY";
  if (isYesterday(date)) return "YESTERDAY";
  return format(date, "M/d/yyyy").toUpperCase();
}

function getStatusIcon(status: string, fromMe: boolean) {
  if (!fromMe) return null;
  switch (status) {
    case "read":
      return <CheckCheck className="h-4 w-4 text-blue-500" />;
    case "delivered":
      return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
    case "sent":
      return <Check className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function WhatsAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const hasTriedAutoConnect = useRef(false);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatJid, setSelectedChatJid] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<WhatsAppConnectionStatus>({
    queryKey: ["/api/whatsapp-v2/status"],
    refetchInterval: 2000,
  });

  const { data: chats, isLoading: chatsLoading } = useQuery<WhatsAppChat[]>({
    queryKey: ["/api/whatsapp-v2/chats"],
    enabled: status?.connectionState === "open",
    refetchInterval: 10000,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<WhatsAppMessage[]>({
    queryKey: ["/api/whatsapp-v2/chats", selectedChatId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp-v2/chats/${selectedChatId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedChatId && status?.connectionState === "open",
    refetchInterval: 5000,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp-v2/connect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/status"] });
    },
    onError: (error: any) => {
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp-v2/disconnect");
    },
    onSuccess: () => {
      hasTriedAutoConnect.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/status"] });
      setSelectedChatId(null);
      setSelectedChatJid(null);
    },
    onError: (error: any) => {
      toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp-v2/logout");
    },
    onSuccess: () => {
      hasTriedAutoConnect.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/chats"] });
      setSelectedChatId(null);
      setSelectedChatJid(null);
      toast({ title: "Logged out", description: "WhatsApp session cleared" });
    },
    onError: (error: any) => {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ jid, text }: { jid: string; text: string }) => {
      return apiRequest("POST", `/api/whatsapp-v2/chats/${encodeURIComponent(jid)}/send`, { text });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/chats", selectedChatId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/chats"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (jid: string) => {
      return apiRequest("POST", `/api/whatsapp-v2/chats/${encodeURIComponent(jid)}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/chats"] });
    },
  });

  useEffect(() => {
    if (
      !statusLoading &&
      status &&
      status.connectionState === "close" &&
      !connectMutation.isPending &&
      !hasTriedAutoConnect.current
    ) {
      hasTriedAutoConnect.current = true;
      connectMutation.mutate();
    }
  }, [status, statusLoading, connectMutation]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSelectChat = useCallback((chat: WhatsAppChat) => {
    setSelectedChatId(chat.id);
    setSelectedChatJid(chat.jid);
    if (chat.unreadCount > 0) {
      markAsReadMutation.mutate(chat.jid);
    }
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
  }, [markAsReadMutation]);

  const handleSendMessage = useCallback(() => {
    if (!messageText.trim() || !selectedChatJid) return;
    sendMessageMutation.mutate({ jid: selectedChatJid, text: messageText.trim() });
  }, [messageText, selectedChatJid, sendMessageMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const isConnected = status?.connectionState === "open";
  const isConnecting = status?.connectionState === "connecting";
  const hasQrCode = !!status?.qrCode;
  const selectedChat = chats?.find((c) => c.id === selectedChatId);

  const filteredChats = chats?.filter((chat) => {
    if (!searchQuery) return true;
    const name = chat.contact?.name || chat.title || chat.jid;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const groupedMessages = messages?.reduce((groups, message) => {
    const dateKey = formatDateSeparator(message.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, WhatsAppMessage[]>);

  if (statusLoading) {
    return (
      <div className="h-[calc(100vh-6rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-muted-foreground animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading WhatsApp...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    if (isConnecting && hasQrCode) {
      const qrSrc = status.qrCode!.startsWith("data:") 
        ? status.qrCode 
        : `data:image/png;base64,${status.qrCode}`;
      
      return (
        <div className="h-[calc(100vh-6rem)] flex flex-col rounded-lg overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex flex-col items-center">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg mb-4 border">
                  <img
                    src={qrSrc}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                    data-testid="img-qr-code"
                  />
                </div>
              </div>
              <div className="text-center md:text-left max-w-sm">
                <h2 className="text-foreground text-2xl font-light mb-6">
                  Scan QR Code
                </h2>
                <ol className="text-muted-foreground space-y-4 list-decimal list-inside">
                  <li>Open WhatsApp on your phone</li>
                  <li>
                    Tap <span className="text-foreground font-medium">Menu</span> or{" "}
                    <span className="text-foreground font-medium">Settings</span> and select{" "}
                    <span className="text-foreground font-medium">Linked Devices</span>
                  </li>
                  <li>
                    Tap on <span className="text-foreground font-medium">Link a Device</span>
                  </li>
                  <li>Point your phone at this screen to capture the QR code</li>
                </ol>
              </div>
            </div>
          </div>
          {status?.lastError && (
            <div className="p-4 bg-destructive/10 border-t border-destructive/20 text-center">
              <p className="text-destructive text-sm">{status.lastError}</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col rounded-lg overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <RefreshCw className="h-16 w-16 text-muted-foreground animate-spin mb-6" />
          <h1 className="text-foreground text-2xl font-light mb-2">Connecting to WhatsApp</h1>
          <p className="text-muted-foreground text-center">
            Please wait while we generate the QR code...
          </p>
          {status?.lastError && (
            <p className="text-destructive text-sm mt-4">{status.lastError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex rounded-lg overflow-hidden border bg-card">
      {/* Left Panel - Chat List */}
      <div className="w-[400px] flex flex-col border-r">
        {/* Header */}
        <div className="h-[60px] bg-muted/50 flex items-center justify-between px-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 cursor-pointer">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {status?.phoneNumber ? status.phoneNumber.slice(-2) : "WA"}
              </AvatarFallback>
            </Avatar>
            {status?.phoneNumber && (
              <span className="text-sm text-muted-foreground">{status.phoneNumber}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-muted-foreground hover:text-foreground"
              title="Logout"
              data-testid="button-whatsapp-logout"
            >
              {logoutMutation.isPending ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {chatsLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
            </div>
          ) : !filteredChats || filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <p className="text-sm">No chats found</p>
              <p className="text-xs mt-1">Start a conversation from your phone</p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const displayName = chat.contact?.name || chat.title || chat.jid.split("@")[0];
              const lastMessageText = chat.lastMessage?.content || "";
              const lastMessageTime = chat.lastMessageTs ? formatTimestamp(chat.lastMessageTs) : "";
              const isSelected = selectedChatId === chat.id;

              return (
                <div
                  key={chat.id}
                  data-testid={`card-chat-${chat.id}`}
                  onClick={() => handleSelectChat(chat)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                    isSelected && "bg-muted"
                  )}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground font-normal text-base truncate">
                        {displayName}
                      </span>
                      <span className={cn(
                        "text-xs flex-shrink-0",
                        chat.unreadCount > 0 ? "text-primary font-medium" : "text-muted-foreground"
                      )}>
                        {lastMessageTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        {chat.lastMessage?.fromMe && getStatusIcon(chat.lastMessage.status, true)}
                        {lastMessageText || "No messages"}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChatId && selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-[60px] bg-muted/50 flex items-center justify-between px-4 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(selectedChat.contact?.name || selectedChat.title || selectedChat.jid.split("@")[0])}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-foreground font-medium">
                    {selectedChat.contact?.name || selectedChat.title || selectedChat.jid.split("@")[0]}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedChat.contact?.phone || "online"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                </div>
              ) : !messages || messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-muted px-3 py-1.5 rounded-lg">
                    <p className="text-muted-foreground text-sm">No messages yet</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedMessages || {}).map(([date, dateMessages]) => (
                    <div key={date}>
                      <div className="flex justify-center my-4">
                        <span className="bg-muted text-muted-foreground px-3 py-1 rounded-lg text-xs shadow-sm">
                          {date}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dateMessages.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              "flex",
                              message.fromMe ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[65%] rounded-lg px-3 py-2 shadow-sm relative",
                                message.fromMe
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card border"
                              )}
                              style={{
                                borderRadius: message.fromMe 
                                  ? '8px 8px 0 8px' 
                                  : '8px 8px 8px 0'
                              }}
                            >
                              {message.content && (
                                <p className="text-sm whitespace-pre-wrap break-words pr-12">
                                  {message.content}
                                </p>
                              )}
                              {message.messageType !== "text" && !message.content && (
                                <p className="text-sm italic opacity-70 pr-12">
                                  [{message.messageType}]
                                </p>
                              )}
                              <span className={cn(
                                "absolute bottom-1 right-2 flex items-center gap-1",
                                message.fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                <span className="text-[10px]">
                                  {formatMessageTime(message.timestamp)}
                                </span>
                                {message.fromMe && getStatusIcon(message.status, message.fromMe)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="h-[62px] bg-muted/50 flex items-center gap-2 px-4 border-t">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <Smile className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <Paperclip className="h-6 w-6" />
              </Button>
              <div className="flex-1">
                <Input
                  ref={messageInputRef}
                  placeholder="Type a message"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-10"
                  data-testid="input-message"
                />
              </div>
              {messageText.trim() ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending}
                  className="text-primary hover:text-primary/80 flex-shrink-0"
                  data-testid="button-send-message"
                >
                  <Send className="h-6 w-6" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <Mic className="h-6 w-6" />
                </Button>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center bg-muted/30">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <svg viewBox="0 0 212 212" width="48" height="48" className="text-muted-foreground">
                  <path fill="currentColor" d="M105.946.25C164.318.25 211.64 47.596 211.64 106c0 58.404-47.322 105.75-105.694 105.75C47.574 211.75.25 164.404.25 106 .25 47.596 47.574.25 105.946.25zm-.067 18.69c-48.176 0-87.346 39.169-87.346 87.346 0 16.263 4.469 31.501 12.218 44.525l-12.991 38.742 39.769-12.641c12.531 7.092 27.001 11.148 42.35 11.148 48.177 0 87.348-39.169 87.348-87.346 0-48.176-39.171-87.346-87.348-87.346zm-6.06 29.622c1.614 0 3.229.008 4.63.081 1.667.077 3.578.337 5.317 3.996 2.078 4.373 6.59 16.112 7.168 17.275.582 1.163 1.048 2.597.289 4.065-.758 1.468-1.163 2.401-2.284 3.681-1.12 1.279-2.377 2.866-3.384 3.852-1.123 1.099-2.281 2.322-1.004 4.53 1.277 2.207 5.682 9.429 12.24 15.298 8.425 7.545 15.511 9.937 17.768 11.063 2.258 1.124 3.576.964 4.924-.462 1.35-1.428 5.777-6.701 7.323-9.015 1.546-2.313 3.105-1.962 5.211-1.202 2.108.757 13.334 6.298 15.629 7.459 2.294 1.161 3.811 1.705 4.393 2.712.58 1.006.58 5.789-1.236 11.368-1.814 5.581-10.535 10.961-14.549 11.426-3.614.416-8.184.595-13.248-1.071-3.062-1.008-6.994-2.362-12.03-4.637-21.201-9.574-35.014-31.142-36.064-32.568-1.048-1.428-8.556-11.433-8.556-21.783 0-10.349 5.252-15.47 7.228-17.624 1.975-2.154 4.345-2.712 5.808-2.712z"></path>
                </svg>
              </div>
              <h1 className="text-foreground text-2xl font-light mb-2">WhatsApp</h1>
              <p className="text-muted-foreground">
                Select a conversation to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
