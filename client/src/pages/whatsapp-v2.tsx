import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";
import {
  Send,
  Wifi,
  WifiOff,
  LogOut,
  RefreshCw,
  MessageSquare,
  Phone,
  Check,
  CheckCheck,
  Clock,
  Power,
  PowerOff,
} from "lucide-react";

interface WhatsAppV2ConnectionStatus {
  companyId: string;
  isConnected: boolean;
  connectionState: "close" | "connecting" | "open";
  qrCode: string | null;
  lastError: string | null;
  phoneNumber: string | null;
}

interface WhatsAppV2Contact {
  id: string;
  companyId: string;
  jid: string;
  name: string;
  businessName?: string;
  avatarUrl?: string;
  isBusiness: boolean;
  phone: string;
}

interface WhatsAppV2Chat {
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
  contact: WhatsAppV2Contact | null;
  lastMessage: WhatsAppV2Message | null;
}

interface WhatsAppV2Message {
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

function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return "";
  return format(date, "h:mm a");
}

function formatDateSeparator(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) return "Today";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "EEEE, MMMM d");
  return format(date, "EEEE, MMMM d, yyyy");
}

function getStatusIcon(status: string) {
  switch (status) {
    case "read":
      return { icon: CheckCheck, className: "text-blue-500" };
    case "delivered":
      return { icon: CheckCheck, className: "text-gray-400" };
    case "sent":
      return { icon: Check, className: "text-gray-400" };
    default:
      return { icon: Clock, className: "text-gray-400" };
  }
}

export default function WhatsAppV2Page() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatJid, setSelectedChatJid] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<WhatsAppV2ConnectionStatus>({
    queryKey: ["/api/whatsapp-v2/status"],
    refetchInterval: 3000,
  });

  const { data: chats, isLoading: chatsLoading } = useQuery<WhatsAppV2Chat[]>({
    queryKey: ["/api/whatsapp-v2/chats"],
    enabled: status?.isConnected === true,
    refetchInterval: 10000,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<WhatsAppV2Message[]>({
    queryKey: ["/api/whatsapp-v2/chats", selectedChatId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp-v2/chats/${selectedChatId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedChatId && status?.isConnected === true,
    refetchInterval: 5000,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/whatsapp-v2/connect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/status"] });
      toast({ title: "Connecting", description: "Scan the QR code with WhatsApp" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp-v2/status"] });
      setSelectedChatId(null);
      setSelectedChatJid(null);
      toast({ title: "Disconnected", description: "WhatsApp connection closed" });
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
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSelectChat = useCallback((chat: WhatsAppV2Chat) => {
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

  const isConnected = status?.isConnected === true;
  const isConnecting = status?.connectionState === "connecting";

  const selectedChat = chats?.find((c) => c.id === selectedChatId);

  const groupedMessages = messages?.reduce((groups, message) => {
    const dateKey = formatDateSeparator(message.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, WhatsAppV2Message[]>);

  if (statusLoading) {
    return <LoadingSpinner message="Loading WhatsApp..." />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background">
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              WhatsApp Connection
            </CardTitle>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="success" className="gap-1" data-testid="text-status">
                  <Wifi className="h-3 w-3" />
                  Connected
                </Badge>
              ) : isConnecting ? (
                <Badge variant="warning" className="gap-1" data-testid="text-status">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Connecting
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1" data-testid="text-status">
                  <WifiOff className="h-3 w-3" />
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {isConnected && status?.phoneNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span data-testid="text-phone-number">{formatPhoneForDisplay(status.phoneNumber)}</span>
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              {!isConnected && !isConnecting && (
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  data-testid="button-whatsapp-connect"
                >
                  {connectMutation.isPending ? (
                    <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                  ) : (
                    <Power className="h-4 w-4 mr-2" />
                  )}
                  Connect
                </Button>
              )}
              {(isConnected || isConnecting) && (
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-whatsapp-disconnect"
                >
                  {disconnectMutation.isPending ? (
                    <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              )}
              {(isConnected || status?.connectionState === "close") && (
                <Button
                  variant="destructive"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  data-testid="button-whatsapp-logout"
                >
                  {logoutMutation.isPending ? (
                    <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  Logout
                </Button>
              )}
            </div>
          </div>

          {isConnecting && status?.qrCode && (
            <div className="mt-4 flex flex-col items-center">
              <p className="text-sm text-muted-foreground mb-3">Scan this QR code with WhatsApp</p>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <img
                  src={`data:image/png;base64,${status.qrCode}`}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                  data-testid="img-qr-code"
                />
              </div>
            </div>
          )}

          {status?.lastError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{status.lastError}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
          <Card className="md:col-span-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="text-base font-medium">Chats</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0">
              {chatsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <LoadingSpinner fullScreen={false} className="h-6 w-6" />
                </div>
              ) : !chats || chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No chats yet</p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-2">
                    {chats.map((chat) => {
                      const displayName = chat.contact?.name || chat.title || chat.jid.split("@")[0];
                      const lastMessageText = chat.lastMessage?.content || "";
                      const lastMessageTime = chat.lastMessageTs ? formatTimestamp(chat.lastMessageTs) : "";
                      
                      return (
                        <div
                          key={chat.id}
                          data-testid={`card-chat-${chat.id}`}
                          onClick={() => handleSelectChat(chat)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                            selectedChatId === chat.id
                              ? "bg-primary/10"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium">
                              {getInitials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm truncate">{displayName}</span>
                              {lastMessageTime && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {lastMessageTime}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate">
                                {lastMessageText || "No messages"}
                              </p>
                              {chat.unreadCount > 0 && (
                                <Badge variant="default" className="h-5 min-w-5 text-xs flex-shrink-0">
                                  {chat.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 flex flex-col min-h-0">
            {selectedChatId ? (
              <>
                <CardHeader className="pb-2 flex-shrink-0 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium">
                        {getInitials(
                          selectedChat?.contact?.name || selectedChat?.title || selectedChat?.jid.split("@")[0] || "?"
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base font-medium">
                        {selectedChat?.contact?.name || selectedChat?.title || selectedChat?.jid.split("@")[0]}
                      </CardTitle>
                      {selectedChat?.contact?.phone && (
                        <p className="text-xs text-muted-foreground">
                          {formatPhoneForDisplay(selectedChat.contact.phone)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                  <ScrollArea className="flex-1 p-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <LoadingSpinner fullScreen={false} className="h-6 w-6" />
                      </div>
                    ) : !messages || messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No messages yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(groupedMessages || {}).map(([date, dateMessages]) => (
                          <div key={date}>
                            <div className="flex justify-center mb-4">
                              <span className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                                {date}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {dateMessages.map((message) => {
                                const statusInfo = getStatusIcon(message.status);
                                const StatusIcon = statusInfo.icon;
                                
                                return (
                                  <div
                                    key={message.id}
                                    className={cn(
                                      "flex",
                                      message.fromMe ? "justify-end" : "justify-start"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                                        message.fromMe
                                          ? "bg-primary text-primary-foreground rounded-br-md"
                                          : "bg-muted rounded-bl-md"
                                      )}
                                    >
                                      {message.content && (
                                        <p className="text-sm whitespace-pre-wrap break-words">
                                          {message.content}
                                        </p>
                                      )}
                                      {message.messageType !== "text" && !message.content && (
                                        <p className="text-sm italic opacity-70">
                                          [{message.messageType}]
                                        </p>
                                      )}
                                      <div
                                        className={cn(
                                          "flex items-center gap-1 mt-1",
                                          message.fromMe ? "justify-end" : "justify-start"
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "text-[10px]",
                                            message.fromMe
                                              ? "text-primary-foreground/70"
                                              : "text-muted-foreground"
                                          )}
                                        >
                                          {formatMessageTime(message.timestamp)}
                                        </span>
                                        {message.fromMe && (
                                          <StatusIcon className={cn("h-3 w-3", statusInfo.className)} />
                                        )}
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
                  <Separator />
                  <div className="p-4 flex-shrink-0">
                    <div className="flex gap-2">
                      <Input
                        ref={messageInputRef}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        disabled={!isConnected || sendMessageMutation.isPending}
                        className="flex-1"
                        data-testid="input-message"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim() || !isConnected || sendMessageMutation.isPending}
                        data-testid="button-send-message"
                      >
                        {sendMessageMutation.isPending ? (
                          <LoadingSpinner fullScreen={false} className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a chat</p>
                <p className="text-sm">Choose a conversation from the list</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {!isConnected && !isConnecting && (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <WifiOff className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">WhatsApp Not Connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click the Connect button to start using WhatsApp
            </p>
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              data-testid="button-whatsapp-connect-main"
            >
              {connectMutation.isPending ? (
                <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
              ) : (
                <Power className="h-4 w-4 mr-2" />
              )}
              Connect to WhatsApp
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
