import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
  Clock,
  Smile,
  FileText,
  Eye,
  Wand2,
  Volume2,
  CheckSquare,
  Braces
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  messageType?: "incoming" | "outgoing" | "internal_note";
  channel?: string;
  contentType?: string;
  isInternalNote?: boolean;
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
  const [isInternalNote, setIsInternalNote] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const userTimezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: contactsData } = useQuery<{ contacts: UnifiedContact[] }>({
    queryKey: ["/api/contacts/unified"],
    enabled: isAuthenticated,
  });
  const contacts = contactsData?.contacts || [];

  const { data: phoneNumbersData } = useQuery<{ numbers: Array<{ phoneNumber: string; friendlyName?: string }> }>({
    queryKey: ["/api/telnyx/my-numbers"],
    enabled: isAuthenticated,
  });
  const companyNumbers = phoneNumbersData?.numbers || [];

  const { data: conversationsData, isLoading: loadingConversations } = useQuery<{ conversations: TelnyxConversation[] }>({
    queryKey: ["/api/inbox/conversations"],
    enabled: isAuthenticated,
    staleTime: 30000,
  });
  const conversations = conversationsData?.conversations || [];

  const { data: messagesData, isLoading: loadingMessages } = useQuery<{ messages: TelnyxMessage[] }>({
    queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`],
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
    mutationFn: async ({ conversationId, text, isInternalNote }: { conversationId: string; text: string; isInternalNote?: boolean }) => {
      return apiRequest("POST", `/api/inbox/conversations/${conversationId}/messages`, { text, isInternalNote });
    },
    onSuccess: () => {
      setNewMessage("");
      setIsInternalNote(false);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] 
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
      text: newMessage.trim(),
      isInternalNote: isInternalNote
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

  const insertVariable = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newMessage;
    const variable = "{{first_name}}";
    
    const newText = text.substring(0, start) + variable + text.substring(end);
    setNewMessage(newText);
    
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const isMessageInternalNote = (message: TelnyxMessage) => {
    return message.isInternalNote || message.messageType === "internal_note";
  };

  if (authLoading || !isAuthenticated || loadingConversations) {
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
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex"
                  data-testid="btn-solve"
                >
                  Solve
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="btn-checkbox">
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark as done</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="btn-email">
                        <Mail className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send email</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="btn-audio">
                        <Volume2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Audio</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="btn-search-chat">
                        <Search className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Search</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileView("details")}
                        data-testid="btn-show-details"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>More options</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                  {messages.map((message) => {
                    const isNote = isMessageInternalNote(message);
                    const isOutbound = message.direction === "outbound";
                    
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isOutbound || isNote ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2",
                            isNote
                              ? "bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-br-sm"
                              : isOutbound
                                ? "bg-blue-600 text-white rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                          )}
                        >
                          {isNote && (
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-[10px] font-medium text-yellow-700">(internal note)</span>
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                          <div className={cn(
                            "flex items-center gap-1 mt-1",
                            isOutbound || isNote ? "justify-end" : "justify-start"
                          )}>
                            <span className={cn(
                              "text-[10px]",
                              isNote 
                                ? "text-yellow-600"
                                : isOutbound 
                                  ? "text-blue-100" 
                                  : "text-muted-foreground"
                            )}>
                              {format(new Date(message.createdAt), "h:mm a")}
                            </span>
                            {isOutbound && !isNote && (
                              <span className="text-blue-100">
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
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input / Composer */}
            <div className={cn(
              "p-4 border-t",
              isInternalNote && "bg-yellow-50"
            )}>
              {/* Toolbar Icons */}
              <div className="flex items-center gap-1 mb-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-emoji">
                        <Smile className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Emoji</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-attachment">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach file</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-templates">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Templates</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={insertVariable}
                        data-testid="btn-variables"
                      >
                        <Braces className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Insert variable</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-calendar">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Schedule</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-preview">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Preview</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-ai">
                        <Wand2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>AI Assistant</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Text Input */}
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  placeholder={isInternalNote ? "Add an internal note..." : "Type a message..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className={cn(
                    "min-h-[44px] max-h-32 resize-none",
                    isInternalNote && "bg-yellow-50 border-yellow-300 focus-visible:ring-yellow-400"
                  )}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className={cn(
                    isInternalNote 
                      ? "bg-yellow-500 hover:bg-yellow-600 text-yellow-900" 
                      : "bg-blue-600 hover:bg-blue-700"
                  )}
                  data-testid="btn-send-message"
                >
                  {isInternalNote ? (
                    <>Add Note</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </div>

              {/* Internal Note Toggle */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Switch
                  id="internal-note"
                  checked={isInternalNote}
                  onCheckedChange={setIsInternalNote}
                  data-testid="switch-internal-note"
                />
                <Label htmlFor="internal-note" className="text-sm text-muted-foreground cursor-pointer">
                  Internal note (only visible to your team)
                </Label>
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
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Insights</h4>
                  <div className="space-y-3">
                    {/* Contact Origins/Types */}
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">Source</span>
                      <div className="flex flex-wrap gap-1">
                        {matchedContact?.origin?.length ? (
                          matchedContact.origin.map((origin, idx) => (
                            <Badge 
                              key={idx} 
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                origin === "policy" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                                origin === "quote" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                                origin === "manual" && "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
                                origin === "sms" && "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                              )}
                              data-testid={`badge-origin-${origin}`}
                            >
                              {origin.charAt(0).toUpperCase() + origin.slice(1)}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs" data-testid="badge-origin-lead">Lead</Badge>
                        )}
                      </div>
                    </div>

                    {/* Status Badges */}
                    {matchedContact?.status && matchedContact.status.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground">Status</span>
                        <div className="flex flex-wrap gap-1">
                          {matchedContact.status.map((status, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline"
                              className="text-xs"
                              data-testid={`badge-status-${idx}`}
                            >
                              {status}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Product Types */}
                    {matchedContact?.productType && matchedContact.productType.filter(Boolean).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs text-muted-foreground">Products</span>
                        <div className="flex flex-wrap gap-1">
                          {matchedContact.productType.filter(Boolean).map((product, idx) => (
                            <Badge 
                              key={idx} 
                              className="text-xs bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                              data-testid={`badge-product-${idx}`}
                            >
                              {product}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Date of Birth */}
                    {matchedContact?.dateOfBirth && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Birthday</p>
                          <p className="text-sm font-medium" data-testid="text-dob">
                            {format(new Date(matchedContact.dateOfBirth), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Company */}
                    {matchedContact?.companyName && (
                      <div className="flex items-center gap-3">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Company</p>
                          <p className="text-sm font-medium" data-testid="text-company">
                            {matchedContact.companyName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Related Records */}
                {matchedContact?.sourceMetadata && matchedContact.sourceMetadata.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Related Records</h4>
                    <div className="space-y-2">
                      {matchedContact.sourceMetadata.slice(0, 5).map((source, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-2 rounded-md bg-background border text-sm"
                          data-testid={`record-${source.type}-${idx}`}
                        >
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                source.type === "policy" && "border-green-500 text-green-700",
                                source.type === "quote" && "border-blue-500 text-blue-700"
                              )}
                            >
                              {source.type.charAt(0).toUpperCase() + source.type.slice(1)}
                            </Badge>
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              #{source.id.slice(-8)}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Stats */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Conversation</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-md bg-background border text-center">
                      <p className="text-lg font-semibold" data-testid="text-message-count">
                        {messagesData?.messages?.length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Messages</p>
                    </div>
                    <div className="p-3 rounded-md bg-background border text-center">
                      <p className="text-lg font-semibold" data-testid="text-unread-count">
                        {selectedConversation.unreadCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Unread</p>
                    </div>
                  </div>
                </div>
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
                data-testid="input-to-phone"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-new-message"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreateConversation}
              disabled={createConversationMutation.isPending}
              data-testid="btn-send-new-conversation"
            >
              {createConversationMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
