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
import { cn } from "@/lib/utils";
import { 
  Search, Send, MoreVertical, Phone, Video, 
  CheckCheck, MessageSquare, RefreshCw, Smile, Paperclip, Lock, ArrowLeft
} from "lucide-react";

// Helper function to generate consistent color from string
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

// Helper function to get initials from name
function getInitials(name: string): string {
  if (!name || name.trim() === '') return '?';
  if (/^[\+\d\s\-\(\)]+$/.test(name.trim())) return '';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Format timestamp for chat list
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

// Format message time
function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return format(date, 'h:mm a');
}

// Filter tab type
type FilterTab = 'all' | 'unread' | 'favorites' | 'groups';

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
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Poll for status updates every 3 seconds
  const { data: statusData } = useQuery<{ success: boolean; status: WhatsAppStatus }>({
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
    queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`],
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
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chats/${selectedChatId}/messages`] });
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

  // Filter chats based on search and active filter
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      activeFilter === 'all' ? true :
      activeFilter === 'unread' ? chat.unreadCount > 0 :
      activeFilter === 'groups' ? chat.isGroup :
      false; // favorites not implemented
    
    return matchesSearch && matchesFilter;
  });

  const selectedChat = chats.find(c => c.id === selectedChatId);

  // QR Code Authentication View
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

  // Main Chat View
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
          ) : chatsData?.chats?.length === 0 || !chatsData?.success ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50 text-[var(--whatsapp-text-tertiary)]" />
              <p className="text-[var(--whatsapp-text-secondary)]">
                {!chatsData?.success ? 'Failed to load chats. Please try again.' : 'No chats found'}
              </p>
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
                      <h3 className="font-medium text-[var(--whatsapp-text-primary)] truncate">{chat.name}</h3>
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
                    click here for contact info
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
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                  data-testid="button-info"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Messages Area with Background Pattern */}
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
              ) : !messagesData?.success ? (
                <div className="flex items-center justify-center h-full text-[var(--whatsapp-text-secondary)]">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50 text-[var(--whatsapp-text-tertiary)]" />
                    <p className="text-[var(--whatsapp-text-secondary)]">Failed to load messages. Please try again.</p>
                  </div>
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
                          "max-w-[65%] rounded-lg px-3 py-2 shadow-sm",
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
                        <p className="text-sm text-[var(--whatsapp-text-primary)] break-words whitespace-pre-wrap">
                          {message.body}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          <span className="text-[11px] text-[var(--whatsapp-text-tertiary)]">
                            {formatMessageTime(message.timestamp)}
                          </span>
                          {message.isFromMe && (
                            <CheckCheck className="h-4 w-4 text-[var(--whatsapp-green-dark)]" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-[var(--whatsapp-icon)] hover:bg-[var(--whatsapp-hover)]"
                  data-testid="button-attach"
                >
                  <Paperclip className="h-6 w-6" />
                </Button>
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
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
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
    </div>
  );
}
