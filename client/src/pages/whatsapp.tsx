import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";
import { 
  Search, Send, MoreVertical, Phone, Video, RefreshCw, 
  QrCode, Wifi, WifiOff, MessageCircle, Check, CheckCheck,
  Smile, Paperclip, Mic, ArrowLeft
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

interface WhatsappInstance {
  id: string;
  instanceName: string;
  status: string;
  qrCode?: string;
  phoneNumber?: string;
  profileName?: string;
}

interface WhatsappConversation {
  id: string;
  remoteJid: string;
  unreadCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  isPinned: boolean;
  isArchived: boolean;
}

interface WhatsappMessage {
  id: string;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  content?: string;
  messageType: string;
  status: string;
  timestamp: string;
}

function formatJidToPhone(jid: string): string {
  if (!jid) return "";
  const phone = jid.split("@")[0];
  if (phone.length > 10) {
    return `+${phone.substring(0, 2)} (${phone.substring(2, 5)}) ${phone.substring(5, 8)}-${phone.substring(8)}`;
  }
  return phone;
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, "HH:mm");
  } else if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "dd/MM/yyyy");
}

function getInitials(jid: string): string {
  const phone = jid.split("@")[0];
  return phone.slice(-2);
}

export default function WhatsAppPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [newChatNumber, setNewChatNumber] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: instanceData, isLoading: loadingInstance, refetch: refetchInstance } = useQuery<{
    instance: WhatsappInstance | null;
    connected: boolean;
  }>({
    queryKey: ["/api/whatsapp/instance"],
    refetchInterval: 5000,
  });

  const { data: chats = [], isLoading: loadingChats } = useQuery<WhatsappConversation[]>({
    queryKey: ["/api/whatsapp/chats"],
    enabled: instanceData?.connected === true,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<WhatsappMessage[]>({
    queryKey: ["/api/whatsapp/chats", selectedChat, "messages"],
    enabled: !!selectedChat && instanceData?.connected === true,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/connect");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instance"] });
      if (data.qrCode) {
        toast({ title: "Scan QR Code", description: "Open WhatsApp on your phone and scan the code" });
      } else if (data.connected) {
        toast({ title: "Connected!", description: "WhatsApp is now connected" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instance"] });
      toast({ title: "Disconnected", description: "WhatsApp has been disconnected" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ number, text }: { number: string; text: string }) => {
      const res = await apiRequest("POST", "/api/whatsapp/send", { number, text });
      return res.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats", selectedChat, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
    },
    onError: (error: any) => {
      toast({ title: "Send Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncChatsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/sync-chats");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/chats"] });
      toast({ title: "Synced", description: `${data.synced} new chats synced` });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-connect only when instance doesn't exist or is explicitly disconnected
  useEffect(() => {
    const status = instanceData?.instance?.status;
    const shouldConnect = !loadingInstance && 
      !instanceData?.connected && 
      !instanceData?.instance?.qrCode && 
      !connectMutation.isPending &&
      (status === "disconnected" || status === undefined || !instanceData?.instance);
    
    if (shouldConnect) {
      connectMutation.mutate();
    }
  }, [loadingInstance, instanceData?.connected, instanceData?.instance?.qrCode, instanceData?.instance?.status]);

  const handleSend = () => {
    if (!messageText.trim() || !selectedChat) return;
    sendMessageMutation.mutate({ number: selectedChat, text: messageText });
  };

  const filteredChats = chats.filter((chat) =>
    chat.remoteJid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loadingInstance) {
    return <LoadingSpinner fullScreen message="Loading WhatsApp..." />;
  }

  const instance = instanceData?.instance;
  const isConnected = instanceData?.connected;

  // Show "Connecting..." screen when status is connecting (after QR scan)
  const isConnecting = instance?.status === "connecting" && !instance?.qrCode;
  
  // If disconnected or connecting, show appropriate screen
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center space-y-6 max-w-md">
          {isConnecting ? (
            <>
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <LoadingSpinner fullScreen={false} />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                Connecting to WhatsApp...
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                QR code scanned successfully. Establishing connection...
              </p>
            </>
          ) : instance?.qrCode ? (
            <>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl inline-block shadow-lg">
                <img 
                  src={instance.qrCode.startsWith('data:') ? instance.qrCode : `data:image/png;base64,${instance.qrCode}`} 
                  alt="QR Code" 
                  className="w-72 h-72"
                  data-testid="whatsapp-qr-code"
                />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Scan to Connect</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  1. Open WhatsApp on your phone<br />
                  2. Go to Settings &rarr; Linked Devices<br />
                  3. Tap "Link a Device" and scan this code
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => refetchInstance()}
                className="gap-2"
                data-testid="button-refresh-qr"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh QR
              </Button>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                {connectMutation.isPending ? (
                  <LoadingSpinner fullScreen={false} />
                ) : (
                  <QrCode className="w-12 h-12 text-primary" />
                )}
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                {connectMutation.isPending ? "Generating QR Code..." : "Connect WhatsApp"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Please wait while we prepare the connection
              </p>
              {!connectMutation.isPending && (
                <Button 
                  onClick={() => connectMutation.mutate()}
                  className="gap-2"
                  data-testid="button-connect-whatsapp"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Connection
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Connected - show chat interface
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      <div className={cn(
        "w-full md:w-[400px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col",
        selectedChat && "hidden md:flex"
      )}>
        <div className="p-3 bg-gray-100 dark:bg-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {instance?.profileName?.[0] || "W"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium dark:text-white">{instance?.profileName || "WhatsApp"}</p>
              <div className="flex items-center gap-1 text-xs text-green-600">
                <Wifi className="w-3 h-3" />
                Connected
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => syncChatsMutation.mutate()}
              disabled={syncChatsMutation.isPending}
              data-testid="button-sync-chats"
            >
              <RefreshCw className={cn("w-5 h-5", syncChatsMutation.isPending && "animate-spin")} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect"
            >
              <WifiOff className="w-5 h-5 text-red-500" />
            </Button>
          </div>
        </div>

        <div className="p-2 bg-white dark:bg-gray-950">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-100 dark:bg-gray-800 border-0"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        <div className="p-2 border-b dark:border-gray-800">
          <div className="flex gap-2">
            <Input
              placeholder="Phone number (e.g., 5511999999999)"
              value={newChatNumber}
              onChange={(e) => setNewChatNumber(e.target.value)}
              className="flex-1"
              data-testid="input-new-chat-number"
            />
            <Button
              size="sm"
              onClick={() => {
                if (newChatNumber.trim()) {
                  setSelectedChat(newChatNumber.replace(/\D/g, "") + "@s.whatsapp.net");
                  setNewChatNumber("");
                }
              }}
              data-testid="button-start-new-chat"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <MessageCircle className="w-10 h-10 mb-2" />
              <p>No chats yet</p>
              <p className="text-xs">Enter a number above to start chatting</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat.remoteJid)}
                className={cn(
                  "flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800",
                  selectedChat === chat.remoteJid && "bg-gray-100 dark:bg-gray-800"
                )}
                data-testid={`chat-item-${chat.id}`}
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gray-300 dark:bg-gray-600">
                    {getInitials(chat.remoteJid)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium truncate dark:text-white">
                      {formatJidToPhone(chat.remoteJid)}
                    </p>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {chat.lastMessageAt && formatMessageTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500 truncate">
                      {chat.lastMessagePreview || "No messages"}
                    </p>
                    {chat.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground rounded-full h-5 min-w-[20px] flex items-center justify-center">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      <div className={cn(
        "flex-1 flex flex-col",
        !selectedChat && "hidden md:flex"
      )}>
        {selectedChat ? (
          <>
            <div className="p-3 bg-gray-100 dark:bg-gray-900 flex items-center gap-3 border-b dark:border-gray-800">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSelectedChat(null)}
                data-testid="button-back-to-chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-gray-300 dark:bg-gray-600">
                  {getInitials(selectedChat)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium dark:text-white">{formatJidToPhone(selectedChat)}</p>
                <p className="text-xs text-gray-500">Online</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon">
                  <Video className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Phone className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <ScrollArea 
              className="flex-1 p-4 bg-gray-50 dark:bg-gray-900"
            >
              <div className="dark:opacity-80">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner fullScreen={false} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500 bg-white/50 dark:bg-black/20 rounded-lg p-4">
                    <MessageCircle className="w-10 h-10 mb-2" />
                    <p>No messages yet</p>
                    <p className="text-xs">Send a message to start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.fromMe ? "justify-end" : "justify-start"
                        )}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={cn(
                            "max-w-[65%] rounded-lg px-3 py-2 shadow-sm",
                            msg.fromMe
                              ? "bg-primary/10 dark:bg-primary/20"
                              : "bg-white dark:bg-gray-800"
                          )}
                        >
                          <p className="text-sm dark:text-white break-words">
                            {msg.content || `[${msg.messageType}]`}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-gray-500">
                              {format(new Date(msg.timestamp), "HH:mm")}
                            </span>
                            {msg.fromMe && (
                              msg.status === "read" ? (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                              ) : msg.status === "delivered" ? (
                                <CheckCheck className="w-3 h-3 text-gray-400" />
                              ) : (
                                <Check className="w-3 h-3 text-gray-400" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 bg-gray-100 dark:bg-gray-900 flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Smile className="w-6 h-6 text-gray-500" />
              </Button>
              <Button variant="ghost" size="icon">
                <Paperclip className="w-6 h-6 text-gray-500" />
              </Button>
              <Input
                placeholder="Type a message"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 bg-white dark:bg-gray-800 border-0 rounded-lg"
                data-testid="input-message"
              />
              {messageText.trim() ? (
                <Button 
                  size="icon"
                  onClick={handleSend}
                  disabled={sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="w-5 h-5" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon">
                  <Mic className="w-6 h-6 text-gray-500" />
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
            {!isConnected ? (
              <div className="text-center space-y-6 p-8">
                {instance?.qrCode ? (
                  <>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg inline-block shadow-lg">
                      <img 
                        src={instance.qrCode.startsWith('data:') ? instance.qrCode : `data:image/png;base64,${instance.qrCode}`} 
                        alt="QR Code" 
                        className="w-64 h-64"
                        data-testid="whatsapp-qr-code"
                      />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-medium text-gray-700 dark:text-gray-300">Scan to Connect</h2>
                      <p className="text-sm text-gray-500 max-w-sm">
                        1. Open WhatsApp on your phone<br />
                        2. Go to Settings &rarr; Linked Devices<br />
                        3. Tap "Link a Device" and scan this code
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => refetchInstance()}
                      className="gap-2"
                      data-testid="button-refresh-qr"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh QR
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      {connectMutation.isPending ? (
                        <LoadingSpinner fullScreen={false} />
                      ) : (
                        <QrCode className="w-10 h-10 text-primary" />
                      )}
                    </div>
                    <h2 className="text-xl font-medium text-gray-700 dark:text-gray-300">
                      {connectMutation.isPending ? "Generating QR Code..." : "Connecting..."}
                    </h2>
                    <p className="text-gray-500 max-w-sm">
                      Please wait while we connect to WhatsApp
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-light text-gray-700 dark:text-gray-300">WhatsApp</h2>
                <p className="text-gray-500 max-w-sm">
                  Select a chat from the list or enter a phone number to start a new conversation
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
