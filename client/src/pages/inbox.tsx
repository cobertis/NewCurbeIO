import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatForDisplay } from "@shared/phone";
import { 
  Search, 
  Phone, 
  Plus, 
  Send, 
  Paperclip, 
  MoreVertical,
  MessageSquare,
  User,
  Mail,
  Calendar,
  Tag,
  ChevronRight,
  X,
  CheckCheck,
  Clock
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import type { User as UserType, UnifiedContact } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TelnyxConversation {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  companyPhoneNumber: string;
}

interface TelnyxMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  text: string;
  status: string;
  telnyxMessageId: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
}

type MobileView = "threads" | "messages" | "details";

export default function InboxPage() {
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("threads");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState("");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: userData, isSuccess: sessionLoaded } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });
  const userTimezone = userData?.user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userId = userData?.user?.id;

  const { data: contactsData } = useQuery<{ contacts: UnifiedContact[] }>({
    queryKey: ["/api/contacts/unified"],
    enabled: !!userId,
  });
  const contacts = contactsData?.contacts || [];

  const { data: phoneNumbersData } = useQuery<{ numbers: Array<{ phoneNumber: string; friendlyName?: string }> }>({
    queryKey: ["/api/telnyx/my-numbers"],
    enabled: !!userId,
  });
  const companyNumbers = phoneNumbersData?.numbers || [];

  const { data: conversationsData, isLoading: loadingConversations, error: conversationsError, isFetching: fetchingConversations } = useQuery<{ conversations: TelnyxConversation[] }>({
    queryKey: ["/api/inbox/conversations"],
    enabled: !!userId,
    staleTime: 30000,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        return false;
      }
      return failureCount < 2;
    },
  });
  const conversations = conversationsData?.conversations || [];

  const { data: messagesData, isLoading: loadingMessages } = useQuery<{ messages: TelnyxMessage[] }>({
    queryKey: ["/api/inbox/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });
  const messages = messagesData?.messages || [];

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const matchedContact = useMemo(() => {
    if (!selectedConversation) return null;
    return contacts.find(c => c.phone === selectedConversation.phoneNumber);
  }, [selectedConversation, contacts]);

  useWebSocket((message) => {
    const msg = message as any;
    if (msg.type === 'telnyx_message') {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      if (selectedConversationId === msg.conversationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/inbox/conversations", msg.conversationId, "messages"] 
        });
      }
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, text }: { conversationId: string; text: string }) => {
      return apiRequest("POST", `/api/inbox/conversations/${conversationId}/messages`, { text });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/inbox/conversations", selectedConversationId, "messages"] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async ({ phoneNumber, fromNumber, text }: { phoneNumber: string; fromNumber: string; text: string }) => {
      return apiRequest("POST", "/api/inbox/conversations", { phoneNumber, fromNumber, text });
    },
    onSuccess: (data: any) => {
      setShowNewConversation(false);
      setNewConversationPhone("");
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      if (data.conversationId) {
        setSelectedConversationId(data.conversationId);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (companyNumbers.length > 0 && !selectedFromNumber) {
      setSelectedFromNumber(companyNumbers[0].phoneNumber);
    }
  }, [companyNumbers, selectedFromNumber]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => 
      c.displayName?.toLowerCase().includes(query) ||
      c.phoneNumber.includes(query) ||
      c.lastMessage?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, "h:mm a");
    }
    if (isYesterday(date)) {
      return "Yesterday";
    }
    return format(date, "MMM d");
  };

  const getInitials = (name: string | null | undefined, phone: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversationId) return;
    sendMessageMutation.mutate({ 
      conversationId: selectedConversationId, 
      text: newMessage.trim() 
    });
  };

  const handleCreateConversation = () => {
    if (!newConversationPhone.trim() || !selectedFromNumber || !newMessage.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a phone number and message",
        variant: "destructive",
      });
      return;
    }
    createConversationMutation.mutate({
      phoneNumber: newConversationPhone.trim(),
      fromNumber: selectedFromNumber,
      text: newMessage.trim(),
    });
  };

  if (!userId || loadingConversations || (fetchingConversations && !conversationsData)) {
    return <LoadingSpinner message="Loading conversations..." />;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-gray-900 rounded-lg border overflow-hidden">
      {/* Left Panel - Conversation List */}
      <div className={cn(
        "w-80 border-r flex flex-col",
        mobileView !== "threads" && "hidden md:flex"
      )}>
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Open</h2>
              <Badge variant="secondary" className="text-xs">{conversations.length}</Badge>
            </div>
            <Button 
              size="sm" 
              onClick={() => setShowNewConversation(true)}
              data-testid="btn-new-conversation"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-conversations"
            />
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start a new conversation to begin messaging</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setSelectedConversationId(conversation.id);
                    setMobileView("messages");
                  }}
                  data-testid={`conversation-${conversation.id}`}
                  className={cn(
                    "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                    selectedConversationId === conversation.id && "bg-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-sky-100 text-sky-700 text-sm">
                        {getInitials(conversation.displayName, conversation.phoneNumber)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {conversation.displayName || formatForDisplay(conversation.phoneNumber)}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {conversation.lastMessageAt && formatMessageTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.lastMessage || "No messages yet"}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <Badge variant="default" className="shrink-0 h-5 min-w-[20px] flex items-center justify-center text-xs">
                            {conversation.unreadCount}
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

      {/* Center Panel - Chat */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        mobileView !== "messages" && "hidden md:flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileView("threads")}
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-sky-100 text-sky-700">
                    {getInitials(selectedConversation.displayName, selectedConversation.phoneNumber)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">
                    {selectedConversation.displayName || formatForDisplay(selectedConversation.phoneNumber)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {formatForDisplay(selectedConversation.phoneNumber)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileView("details")}
                  data-testid="btn-show-details"
                >
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner message="Loading messages..." fullScreen={false} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === "outbound" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2",
                          message.direction === "outbound"
                            ? "bg-sky-500 text-white rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        <div className={cn(
                          "flex items-center gap-1 mt-1",
                          message.direction === "outbound" ? "justify-end" : "justify-start"
                        )}>
                          <span className={cn(
                            "text-[10px]",
                            message.direction === "outbound" ? "text-sky-100" : "text-muted-foreground"
                          )}>
                            {format(new Date(message.createdAt), "h:mm a")}
                          </span>
                          {message.direction === "outbound" && (
                            <span className="text-sky-100">
                              {message.status === "delivered" ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : message.status === "sent" ? (
                                <CheckCheck className="h-3 w-3 opacity-50" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                            </span>
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
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[44px] max-h-32 resize-none"
                  data-testid="input-message"
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  data-testid="btn-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Select a conversation</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a conversation from the list or start a new one
            </p>
            <Button 
              className="mt-4"
              onClick={() => setShowNewConversation(true)}
              data-testid="btn-start-conversation"
            >
              <Plus className="h-4 w-4 mr-2" />
              Start New Conversation
            </Button>
          </div>
        )}
      </div>

      {/* Right Panel - Contact Details */}
      <div className={cn(
        "w-80 border-l flex flex-col bg-muted/30",
        mobileView !== "details" && "hidden lg:flex",
        !selectedConversation && "hidden"
      )}>
        {selectedConversation && (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">Details</h3>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileView("messages")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Contact Info */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Contact info</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Full name</p>
                        <p className="text-sm font-medium">
                          {matchedContact?.displayName || selectedConversation.displayName || "Unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">
                          {formatForDisplay(selectedConversation.phoneNumber)}
                        </p>
                      </div>
                    </div>
                    {matchedContact?.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-medium">{matchedContact.email}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Insights */}
                {matchedContact && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Insights</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Contact type</span>
                        <Badge variant="secondary">
                          {matchedContact.origin?.[0] || "Lead"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* New Conversation Sheet */}
      <Sheet open={showNewConversation} onOpenChange={setShowNewConversation}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New Conversation</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Number</label>
              <Select value={selectedFromNumber} onValueChange={setSelectedFromNumber}>
                <SelectTrigger data-testid="select-from-number">
                  <SelectValue placeholder="Select a number" />
                </SelectTrigger>
                <SelectContent>
                  {companyNumbers.map((num) => (
                    <SelectItem key={num.phoneNumber} value={num.phoneNumber}>
                      {formatForDisplay(num.phoneNumber)}
                      {num.friendlyName && ` (${num.friendlyName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To Phone Number</label>
              <Input
                placeholder="+1 (555) 123-4567"
                value={newConversationPhone}
                onChange={(e) => setNewConversationPhone(e.target.value)}
                data-testid="input-new-conversation-phone"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={4}
                data-testid="input-new-conversation-message"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreateConversation}
              disabled={createConversationMutation.isPending}
              data-testid="btn-create-conversation"
            >
              {createConversationMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
