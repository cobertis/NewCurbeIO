import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";
import { 
  Search, Send, MoreVertical, Phone, Video, Info,
  AlertCircle, CheckCheck, Check, Clock, X, MessageSquare,
  LogOut, RefreshCw, Wifi, WifiOff
} from "lucide-react";

// Helper function to generate consistent color from string
function getAvatarColorFromString(str: string): string {
  const colors = [
    '#6B7280', // gray-500 - default
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#14B8A6', // teal-500
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Helper function to get initials from name
function getInitials(name: string): string {
  if (!name || name.trim() === '') return '?';
  
  // If it's a phone number (starts with + or is all digits), don't show initials
  if (/^[\+\d\s\-\(\)]+$/.test(name.trim())) {
    return '';
  }
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Format timestamp
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d');
  }
}

// Format message time
function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return format(date, 'h:mm a');
}

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage?: {
    body: string;
    timestamp: number;
    from: string;
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
}

interface WhatsAppStatus {
  status: 'authenticated' | 'ready' | 'disconnected' | 'qr' | 'loading';
  qrCode?: string;
  message?: string;
}

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Poll for status updates every 3 seconds
  const { data: statusData, isLoading: statusLoading } = useQuery<{ success: boolean; status: WhatsAppStatus }>({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 3000,
  });

  const status = statusData?.status;
  const isAuthenticated = status?.status === 'authenticated' || status?.status === 'ready';

  // Fetch chats when authenticated
  const { data: chatsData, isLoading: chatsLoading } = useQuery<{ success: boolean; chats: WhatsAppChat[] }>({
    queryKey: ['/api/whatsapp/chats'],
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const chats = chatsData?.chats || [];

  // Fetch messages for selected chat
  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ success: boolean; messages: WhatsAppMessage[] }>({
    queryKey: ['/api/whatsapp/chats', selectedChatId, 'messages'],
    enabled: !!selectedChatId && isAuthenticated,
    refetchInterval: 3000,
  });

  const messages = messagesData?.messages || [];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ to, message }: { to: string; message: string }) => {
      return await apiRequest('/api/whatsapp/send', 'POST', { to, message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats', selectedChatId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setMessageInput('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/whatsapp/logout', 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChatId(null);
      toast({
        title: 'Success',
        description: 'Logged out of WhatsApp',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to logout',
        variant: 'destructive',
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChatId) return;
    sendMessageMutation.mutate({ to: selectedChatId, message: messageInput });
  };

  // Filter chats based on search
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedChat = chats.find(c => c.id === selectedChatId);

  // QR Code Authentication View
  if (!isAuthenticated) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md p-8">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 mx-auto">
              <MessageSquare className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold">WhatsApp Web</h2>
            
            {status?.qrCode ? (
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-400">
                  Scan the QR code below with your WhatsApp mobile app to connect
                </p>
                <div className="flex justify-center bg-white p-4 rounded-lg">
                  <img 
                    src={status.qrCode} 
                    alt="QR Code" 
                    className="w-64 h-64"
                    data-testid="img-qr-code"
                  />
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <p>1. Open WhatsApp on your phone</p>
                  <p>2. Tap Menu or Settings and select Linked Devices</p>
                  <p>3. Tap on Link a Device</p>
                  <p>4. Point your phone to this screen to scan the code</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <RefreshCw className="h-12 w-12 text-gray-400 animate-spin" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {status?.message || 'Initializing WhatsApp connection...'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Main Chat View
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Chat List */}
      <div className={cn(
        "w-full md:w-96 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col",
        selectedChatId ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              WhatsApp
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant={isAuthenticated ? "default" : "destructive"} className="gap-1">
                {isAuthenticated ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isAuthenticated ? 'Connected' : 'Disconnected'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {chatsLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No chats found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={cn(
                    "w-full p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left",
                    selectedChatId === chat.id && "bg-gray-100 dark:bg-gray-700"
                  )}
                  data-testid={`chat-item-${chat.id}`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className="text-white font-semibold"
                      style={{ backgroundColor: getAvatarColorFromString(chat.id) }}
                    >
                      {getInitials(chat.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm truncate">{chat.name}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {chat.lastMessage && formatTimestamp(chat.lastMessage.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {chat.lastMessage?.body || 'No messages yet'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <Badge variant="default" className="ml-2 bg-green-500">
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
        "flex-1 flex flex-col bg-gray-100 dark:bg-gray-900",
        !selectedChatId ? "hidden md:flex" : "flex"
      )}>
        {selectedChatId && selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setSelectedChatId(null)}
                  data-testid="button-back"
                >
                  <X className="h-4 w-4" />
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
                  <h2 className="font-semibold">{selectedChat.name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedChat.isGroup ? 'Group' : 'Contact'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" data-testid="button-call">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" data-testid="button-video">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" data-testid="button-info">
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                      <Skeleton className={cn("h-16 rounded-lg", i % 2 === 0 ? "w-64" : "w-48")} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start the conversation!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.isFromMe ? "justify-end" : "justify-start"
                      )}
                      data-testid={`message-${message.id}`}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg px-4 py-2",
                          message.isFromMe
                            ? "bg-green-500 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        )}
                      >
                        <p className="text-sm break-words">{message.body}</p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <span className={cn(
                            "text-xs",
                            message.isFromMe ? "text-green-100" : "text-gray-500 dark:text-gray-400"
                          )}>
                            {formatMessageTime(message.timestamp)}
                          </span>
                          {message.isFromMe && (
                            <CheckCheck className="h-3 w-3 text-green-100" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                <MessageSquare className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">WhatsApp on Bulk Solutions</h2>
              <p className="max-w-md mx-auto">
                Send and receive WhatsApp messages right from your dashboard. Select a conversation to start chatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
