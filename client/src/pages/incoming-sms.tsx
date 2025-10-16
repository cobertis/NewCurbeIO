import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, Send, MessageSquare, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { formatPhoneDisplay } from "@/lib/phone-formatter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/use-websocket";

interface Conversation {
  phoneNumber: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

interface Message {
  id: string;
  type: 'incoming' | 'outgoing';
  message: string;
  timestamp: Date;
  status?: string;
  sentBy?: string;
  sentByName?: string;
}

export default function IncomingSms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket for real-time updates
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'conversation_update') {
      // Refetch conversations when there's an update
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      
      // If a conversation is selected, also refetch messages
      if (selectedConversation) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation)}/messages`] 
        });
      }
    }
  }, [selectedConversation]);

  useWebSocket(handleWebSocketMessage);

  // Fetch conversations (no more polling - uses WebSocket for updates)
  const { data: conversationsData, isLoading: conversationsLoading, error: conversationsError } = useQuery({
    queryKey: ["/api/chat/conversations"],
  });

  const conversations = ((conversationsData as any)?.conversations || []) as Conversation[];
  
  // Check for authentication error
  const isAuthError = conversationsError && String(conversationsError).includes("401");

  // Fetch messages for selected conversation (no more polling - uses WebSocket for updates)
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation || '')}/messages`],
    enabled: !!selectedConversation,
  });

  const messages = ((messagesData as any)?.messages || []) as Message[];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ toPhone, message }: { toPhone: string; message: string }) => {
      return apiRequest("POST", "/api/chat/send", { toPhone, message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      if (selectedConversation) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation)}/messages`] 
        });
      }
      setMessageInput("");
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Mark conversation as read when selected
  const markAsReadMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return apiRequest("POST", `/api/chat/conversations/${encodeURIComponent(phoneNumber)}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversation) {
      const conv = conversations.find(c => c.phoneNumber === selectedConversation);
      if (conv && conv.unreadCount > 0) {
        markAsReadMutation.mutate(selectedConversation);
      }
    }
  }, [selectedConversation]);

  const handleSendMessage = () => {
    if (!selectedConversation || !messageInput.trim()) return;

    sendMessageMutation.mutate({
      toPhone: selectedConversation,
      message: messageInput.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const query = searchQuery.toLowerCase();
    return (
      conv.phoneNumber.toLowerCase().includes(query) ||
      conv.userName?.toLowerCase().includes(query) ||
      conv.userEmail?.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query)
    );
  });

  const selectedConv = conversations.find(c => c.phoneNumber === selectedConversation);

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <div className="p-8">
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Conversations List */}
        <Card className="w-96 flex flex-col">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Messages</h2>
              {totalUnread > 0 && (
                <Badge variant="destructive">{totalUnread}</Badge>
              )}
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                data-testid="input-search-conversations"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Separator />

          <ScrollArea className="flex-1">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isAuthError ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare className="h-12 w-12 text-destructive mb-3" />
                <p className="text-destructive font-medium mb-2">Access Denied</p>
                <p className="text-sm text-muted-foreground">
                  You need to be logged in as a superadmin to access SMS messages
                </p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No conversations found" : "No messages yet"}
                </p>
              </div>
            ) : (
              <div className="p-2">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.phoneNumber}
                    data-testid={`conversation-${conv.phoneNumber}`}
                    onClick={() => setSelectedConversation(conv.phoneNumber)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left hover-elevate active-elevate-2 transition-colors mb-1",
                      selectedConversation === conv.phoneNumber && "bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conv.userAvatar || undefined} />
                        <AvatarFallback>
                          {conv.userName
                            ? conv.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                            : formatPhoneDisplay(conv.phoneNumber).slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium truncate">
                            {conv.userName || formatPhoneDisplay(conv.phoneNumber)}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage}
                          </p>
                          {conv.unreadCount > 0 && (
                            <Badge variant="default" className="shrink-0">
                              {conv.unreadCount}
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
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConv?.userAvatar || undefined} />
                    <AvatarFallback>
                      {selectedConv?.userName
                        ? selectedConv.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                        : formatPhoneDisplay(selectedConversation).slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">
                      {selectedConv?.userName || formatPhoneDisplay(selectedConversation)}
                    </h3>
                    {selectedConv?.userEmail && (
                      <p className="text-sm text-muted-foreground">{selectedConv.userEmail}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No messages in this conversation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        data-testid={`message-${msg.id}`}
                        className={cn(
                          "flex",
                          msg.type === 'outgoing' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-4 py-2",
                            msg.type === 'outgoing'
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                          <div className={cn(
                            "flex items-center gap-2 mt-1 text-xs",
                            msg.type === 'outgoing' ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            <span>
                              {format(new Date(msg.timestamp), "h:mm a")}
                            </span>
                            {msg.type === 'outgoing' && msg.status && (
                              <Badge variant="secondary" className="text-xs py-0 px-1">
                                {msg.status}
                              </Badge>
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
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    data-testid="input-message"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    data-testid="button-send-message"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
              <p className="text-muted-foreground">
                Choose a conversation from the list to view and send messages
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
