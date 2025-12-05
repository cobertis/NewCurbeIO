import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LoadingSpinner } from "@/components/loading-spinner";
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
  ArrowLeft,
  QrCode,
  Smartphone,
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
      return <CheckCheck className="h-4 w-4 text-[#53bdeb]" />;
    case "delivered":
      return <CheckCheck className="h-4 w-4 text-gray-400" />;
    case "sent":
      return <Check className="h-4 w-4 text-gray-400" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

export default function WhatsAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatJid, setSelectedChatJid] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: status, isLoading: statusLoading } = useQuery<WhatsAppConnectionStatus>({
    queryKey: ["/api/whatsapp-v2/status"],
    refetchInterval: 3000,
  });

  const { data: chats, isLoading: chatsLoading } = useQuery<WhatsAppChat[]>({
    queryKey: ["/api/whatsapp-v2/chats"],
    enabled: status?.isConnected === true,
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
    enabled: !!selectedChatId && status?.isConnected === true,
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

  const isConnected = status?.isConnected === true;
  const isConnecting = status?.connectionState === "connecting";
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
      <div className="h-[calc(100vh-6rem)] flex items-center justify-center bg-[#111b21]">
        <LoadingSpinner message="Loading WhatsApp..." />
      </div>
    );
  }

  if (!isConnected && !isConnecting) {
    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col bg-[#111b21] rounded-lg overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-[264px] h-[264px] mb-8 flex items-center justify-center">
            <QrCode className="w-48 h-48 text-[#00a884] opacity-20" />
          </div>
          <h1 className="text-[#e9edef] text-3xl font-light mb-4">WhatsApp Web</h1>
          <p className="text-[#8696a0] text-center max-w-md mb-8">
            Send and receive messages without keeping your phone online.
            <br />
            Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
          </p>
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="bg-[#00a884] hover:bg-[#06cf9c] text-white px-8 py-6 text-lg rounded-full"
            data-testid="button-whatsapp-connect"
          >
            {connectMutation.isPending ? (
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Smartphone className="h-5 w-5 mr-2" />
            )}
            Link with phone number
          </Button>
        </div>
        <div className="p-4 border-t border-[#222d34] flex items-center justify-center gap-2">
          <span className="text-[#8696a0] text-sm">End-to-end encrypted</span>
        </div>
      </div>
    );
  }

  if (isConnecting && status?.qrCode) {
    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col bg-[#111b21] rounded-lg overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-lg mb-4">
                <img
                  src={`data:image/png;base64,${status.qrCode}`}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                  data-testid="img-qr-code"
                />
              </div>
              <Button
                variant="ghost"
                onClick={() => disconnectMutation.mutate()}
                className="text-[#00a884] hover:text-[#06cf9c] hover:bg-transparent"
                data-testid="button-whatsapp-disconnect"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            <div className="text-center md:text-left max-w-sm">
              <h2 className="text-[#e9edef] text-2xl font-light mb-6">
                Link with QR code
              </h2>
              <ol className="text-[#8696a0] space-y-4 list-decimal list-inside">
                <li>Open WhatsApp on your phone</li>
                <li>
                  Tap <span className="text-[#e9edef]">Menu</span> or{" "}
                  <span className="text-[#e9edef]">Settings</span> and select{" "}
                  <span className="text-[#e9edef]">Linked Devices</span>
                </li>
                <li>
                  Tap on <span className="text-[#e9edef]">Link a Device</span>
                </li>
                <li>Point your phone at this screen to capture the QR code</li>
              </ol>
            </div>
          </div>
        </div>
        {status?.lastError && (
          <div className="p-4 bg-red-500/10 border-t border-red-500/20 text-center">
            <p className="text-red-400 text-sm">{status.lastError}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex bg-[#111b21] rounded-lg overflow-hidden">
      {/* Left Panel - Chat List */}
      <div className="w-[400px] flex flex-col border-r border-[#222d34]">
        {/* Header */}
        <div className="h-[60px] bg-[#202c33] flex items-center justify-between px-4">
          <Avatar className="h-10 w-10 cursor-pointer">
            <AvatarFallback className="bg-[#6b7c85] text-white text-sm">
              {status?.phoneNumber ? status.phoneNumber.slice(-2) : "WA"}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-[#aebac1] hover:text-white hover:bg-[#374045] rounded-full"
              title="Logout"
              data-testid="button-whatsapp-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#aebac1] hover:text-white hover:bg-[#374045] rounded-full"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-2 bg-[#111b21]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8696a0]" />
            <Input
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#202c33] border-0 text-[#e9edef] placeholder:text-[#8696a0] rounded-lg h-9 focus-visible:ring-0"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {chatsLoading ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner fullScreen={false} className="h-6 w-6" />
            </div>
          ) : !filteredChats || filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#8696a0]">
              <p className="text-sm">No chats found</p>
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
                    "flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[#202c33] transition-colors",
                    isSelected && "bg-[#2a3942]"
                  )}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-[#6b7c85] text-white text-sm font-medium">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 border-b border-[#222d34] py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#e9edef] font-normal text-base truncate">
                        {displayName}
                      </span>
                      <span className={cn(
                        "text-xs flex-shrink-0",
                        chat.unreadCount > 0 ? "text-[#00a884]" : "text-[#8696a0]"
                      )}>
                        {lastMessageTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-sm text-[#8696a0] truncate flex items-center gap-1">
                        {chat.lastMessage?.fromMe && getStatusIcon(chat.lastMessage.status, true)}
                        {lastMessageText || "No messages"}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="bg-[#00a884] text-[#111b21] text-xs font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
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
            <div className="h-[60px] bg-[#202c33] flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-[#6b7c85] text-white text-sm font-medium">
                    {getInitials(selectedChat.contact?.name || selectedChat.title || selectedChat.jid.split("@")[0])}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-[#e9edef] font-medium">
                    {selectedChat.contact?.name || selectedChat.title || selectedChat.jid.split("@")[0]}
                  </h3>
                  <p className="text-xs text-[#8696a0]">
                    {selectedChat.contact?.phone || "online"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#aebac1] hover:text-white hover:bg-[#374045] rounded-full"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#aebac1] hover:text-white hover:bg-[#374045] rounded-full"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              className="flex-1 overflow-y-auto p-4"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%231e2b30' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                backgroundColor: '#0b141a'
              }}
            >
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner fullScreen={false} className="h-8 w-8" />
                </div>
              ) : !messages || messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-[#1d282f] px-3 py-1.5 rounded-lg">
                    <p className="text-[#8696a0] text-sm">No messages yet</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedMessages || {}).map(([date, dateMessages]) => (
                    <div key={date}>
                      <div className="flex justify-center my-4">
                        <span className="bg-[#1d282f] text-[#8696a0] px-3 py-1 rounded-lg text-xs shadow">
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
                                "max-w-[65%] rounded-lg px-3 py-2 shadow relative",
                                message.fromMe
                                  ? "bg-[#005c4b] text-[#e9edef]"
                                  : "bg-[#202c33] text-[#e9edef]"
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
                              <span className="absolute bottom-1 right-2 flex items-center gap-1">
                                <span className="text-[10px] text-[#8696a0]">
                                  {formatMessageTime(message.timestamp)}
                                </span>
                                {getStatusIcon(message.status, message.fromMe)}
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
            <div className="h-[62px] bg-[#202c33] flex items-center gap-2 px-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-[#8696a0] hover:text-white hover:bg-[#374045] rounded-full flex-shrink-0"
              >
                <Smile className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#8696a0] hover:text-white hover:bg-[#374045] rounded-full flex-shrink-0"
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
                  className="bg-[#2a3942] border-0 text-[#e9edef] placeholder:text-[#8696a0] rounded-lg h-10 focus-visible:ring-0"
                  data-testid="input-message"
                />
              </div>
              {messageText.trim() ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending}
                  className="text-[#8696a0] hover:text-white hover:bg-[#374045] rounded-full flex-shrink-0"
                  data-testid="button-send-message"
                >
                  <Send className="h-6 w-6" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#8696a0] hover:text-white hover:bg-[#374045] rounded-full flex-shrink-0"
                >
                  <Mic className="h-6 w-6" />
                </Button>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div 
            className="flex-1 flex flex-col items-center justify-center"
            style={{ backgroundColor: '#222e35' }}
          >
            <div className="text-center max-w-md">
              <div className="w-[320px] h-[188px] mx-auto mb-8 flex items-center justify-center">
                <svg viewBox="0 0 303 172" width="250" preserveAspectRatio="xMidYMid meet" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M229.565 160.229c32.647-10.984 57.366-41.988 53.825-86.81-5.381-68.1-71.025-84.993-111.918-64.932C115.998-16.447 28.178 1.542 6.461 67.157c-24.204 73.118 64.608 97.378 116.203 96.027 40.534-.962 72.381-13.037 106.901-2.955z" fill="#364147"></path>
                  <path fillRule="evenodd" clipRule="evenodd" d="M131.589 68.942H85.095a7.093 7.093 0 00-7.093 7.093v46.495a7.093 7.093 0 007.093 7.093h46.494a7.093 7.093 0 007.093-7.093V76.035a7.093 7.093 0 00-7.093-7.093z" fill="#42CBA5"></path>
                  <path d="M105.102 90.48c-4.416 0-8 3.584-8 8s3.584 8 8 8 8-3.584 8-8-3.584-8-8-8z" fill="#0DA884"></path>
                  <path d="M111.342 122.53h-12.48a7.24 7.24 0 01-7.24-7.24 7.24 7.24 0 017.24-7.24h12.48a7.24 7.24 0 017.24 7.24 7.24 7.24 0 01-7.24 7.24z" fill="#0DA884"></path>
                  <path fillRule="evenodd" clipRule="evenodd" d="M217.905 68.942h-46.494a7.093 7.093 0 00-7.093 7.093v46.495a7.093 7.093 0 007.093 7.093h46.494a7.093 7.093 0 007.093-7.093V76.035a7.093 7.093 0 00-7.093-7.093z" fill="#42CBA5"></path>
                  <path d="M191.418 90.48c-4.416 0-8 3.584-8 8s3.584 8 8 8 8-3.584 8-8-3.584-8-8-8z" fill="#0DA884"></path>
                  <path d="M197.658 122.53h-12.48a7.24 7.24 0 01-7.24-7.24 7.24 7.24 0 017.24-7.24h12.48a7.24 7.24 0 017.24 7.24 7.24 7.24 0 01-7.24 7.24z" fill="#0DA884"></path>
                </svg>
              </div>
              <h1 className="text-[#e9edef] text-3xl font-light mb-4">WhatsApp Web</h1>
              <p className="text-[#8696a0] mb-8">
                Send and receive messages without keeping your phone online.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
