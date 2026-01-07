import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Send, MessageSquare, Loader2, Plus, Trash2, Building2, Users, StickyNote, X, Edit, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { formatForDisplay, formatPhoneInput, formatE164 } from "@shared/phone";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/use-websocket";
import { Link } from "wouter";

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

interface ChatNote {
  id: string;
  phoneNumber: string;
  note: string;
  companyId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber?: string | null;
  phone: string | null;
  avatar: string | null;
  companyId: string | null;
  companyName?: string | null;
  company?: {
    id: string;
    name: string;
    slug?: string | null;
    stripeCustomerId?: string | null;
    isActive?: boolean;
  };
  companyUsers?: CompanyUser[];
}

interface CompanyUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  avatar: string | null;
}

export default function IncomingSms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket for real-time updates
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'conversation_update') {
      // Refetch conversations when there's an update
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      
      // Update unread count in sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-count"] });
      
      // If a conversation is selected, also refetch messages
      if (selectedConversation) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation)}/messages`] 
        });
      }
    }
  }, [selectedConversation]);

  useWebSocket(handleWebSocketMessage);

  // Mark conversation as read when user opens it
  useEffect(() => {
    if (!selectedConversation) return;

    const markConversationAsRead = async () => {
      try {
        await fetch(`/api/chat/conversations/${encodeURIComponent(selectedConversation)}/read`, {
          method: "POST",
          credentials: "include",
        });
        // Invalidate queries to update UI
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-count"] });
      } catch (error) {
        console.error("Failed to mark conversation as read:", error);
      }
    };
    markConversationAsRead();
  }, [selectedConversation]); // Run when conversation changes

  // Fetch conversations (no more polling - uses WebSocket for updates)
  const { data: conversationsData, isLoading: conversationsLoading, error: conversationsError } = useQuery({
    queryKey: ["/api/chat/conversations"],
  });

  const conversations = ((conversationsData as any)?.conversations || []) as Conversation[];
  
  // Find selected conversation
  const selectedConv = conversations.find(c => c.phoneNumber === selectedConversation);
  
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

  // Fetch notes for selected conversation
  const { data: notesData } = useQuery({
    queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation || '')}/notes`],
    enabled: !!selectedConversation,
  });

  const notes = (notesData as ChatNote[]) || [];

  // Fetch contact info - try by userId first, then by phone number
  const { data: contactData } = useQuery({
    queryKey: [`/api/users/${selectedConv?.userId}`],
    enabled: !!selectedConv?.userId,
  });

  // If no userId but we have a selected conversation, try to find user by phone number
  const { data: contactDataByPhone } = useQuery({
    queryKey: [`/api/users/by-phone/${encodeURIComponent(selectedConversation || '')}`],
    enabled: !!selectedConversation && !selectedConv?.userId,
  });

  const contactInfo = ((contactData || contactDataByPhone) as any)?.user as ContactInfo | undefined;
  
  // If we have a selected conversation but it's not in the list (new chat without messages),
  // add it as a temporary conversation using contactInfo
  let displayConversations = conversations;
  if (selectedConversation && !selectedConv && contactInfo) {
    const tempConv: Conversation = {
      phoneNumber: selectedConversation,
      userId: contactInfo.id,
      userName: contactInfo.firstName && contactInfo.lastName 
        ? `${contactInfo.firstName} ${contactInfo.lastName}`
        : null,
      userEmail: contactInfo.email,
      userAvatar: contactInfo.avatar,
      lastMessage: "No messages yet",
      lastMessageAt: new Date(),
      unreadCount: 0,
    };
    displayConversations = [tempConv, ...conversations];
  }
  
  // Company users come directly with the contact info now
  const companyUsers = (contactInfo?.companyUsers as CompanyUser[]) || [];

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async ({ phoneNumber, note }: { phoneNumber: string; note: string }) => {
      return apiRequest("POST", `/api/chat/conversations/${encodeURIComponent(phoneNumber)}/notes`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation || '')}/notes`] });
      setNewNoteInput("");
      toast({
        title: "Note created",
        description: "Internal note has been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create note",
        variant: "destructive",
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      return apiRequest("PATCH", `/api/chat/notes/${id}`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation || '')}/notes`] });
      setEditingNoteId(null);
      setEditingNoteContent("");
      toast({
        title: "Note updated",
        description: "Internal note has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update note",
        variant: "destructive",
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/chat/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/chat/conversations/${encodeURIComponent(selectedConversation || '')}/notes`] });
      toast({
        title: "Note deleted",
        description: "Internal note has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return apiRequest("DELETE", `/api/chat/conversations/${encodeURIComponent(phoneNumber)}`);
    },
    onSuccess: () => {
      // Force refetch by invalidating and refetching immediately
      queryClient.invalidateQueries({ 
        queryKey: ["/api/chat/conversations"],
        refetchType: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: ["/api/chat/conversations"] 
      });
      setSelectedConversation(null);
      setDeleteDialogOpen(false);
      toast({
        title: "Conversation deleted",
        description: "The conversation has been permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  // Create new chat mutation
  const createChatMutation = useMutation({
    mutationFn: async ({ toPhone, message }: { toPhone: string; message: string }) => {
      return apiRequest("POST", "/api/chat/send", { toPhone, message });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setNewChatDialogOpen(false);
      setNewChatPhone("");
      setSelectedConversation(variables.toPhone);
      toast({
        title: "Chat started",
        description: "New conversation has been created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start chat",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversation) {
      const conv = displayConversations.find(c => c.phoneNumber === selectedConversation);
      if (conv && conv.unreadCount > 0) {
        markAsReadMutation.mutate(selectedConversation);
      }
    }
  }, [selectedConversation, displayConversations]);

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

  const filteredConversations = displayConversations.filter((conv) => {
    const query = searchQuery.toLowerCase();
    return (
      conv.phoneNumber.toLowerCase().includes(query) ||
      conv.userName?.toLowerCase().includes(query) ||
      conv.userEmail?.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-4">
      <div className="flex gap-4 h-[calc(100vh-6rem)] sm:h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)]">
        {/* Conversations List - Hidden on mobile when conversation selected */}
        <Card className={cn(
          "w-full sm:w-80 lg:w-96 flex flex-col",
          selectedConversation && "hidden sm:flex"
        )}>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Messages</h2>
              <Button
                data-testid="button-new-chat"
                size="icon"
                variant="outline"
                onClick={() => setNewChatDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
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
                            : formatForDisplay(conv.phoneNumber).slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium truncate">
                            {conv.userName || formatForDisplay(conv.phoneNumber)}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground line-clamp-1 flex-1 min-w-0 break-all">
                            {conv.lastMessage}
                          </p>
                          {conv.unreadCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="shrink-0 h-5 min-w-5 px-1.5 text-xs font-semibold"
                              data-testid={`badge-unread-${conv.phoneNumber}`}
                            >
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

        {/* Chat Area - Full width on mobile when conversation selected */}
        <Card className={cn(
          "flex-1 flex flex-col",
          !selectedConversation && "hidden sm:flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Back button for mobile */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="sm:hidden"
                      onClick={() => setSelectedConversation(null)}
                      data-testid="button-back-to-conversations"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={contactInfo?.avatar || selectedConv?.userAvatar || undefined} />
                      <AvatarFallback>
                        {contactInfo?.firstName && contactInfo?.lastName
                          ? `${contactInfo.firstName[0]}${contactInfo.lastName[0]}`.toUpperCase()
                          : selectedConv?.userName
                          ? selectedConv.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                          : formatForDisplay(selectedConversation).slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">
                        {contactInfo?.firstName && contactInfo?.lastName
                          ? `${contactInfo.firstName} ${contactInfo.lastName}`
                          : selectedConv?.userName || formatForDisplay(selectedConversation)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatForDisplay(selectedConversation)}
                      </p>
                    </div>
                  </div>
                  <Button
                    data-testid="button-delete-chat"
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
                          <p className="text-sm truncate">{msg.message}</p>
                          <div className={cn(
                            "flex items-center justify-end gap-2 mt-1 text-xs",
                            msg.type === 'outgoing' ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            <span>
                              {format(new Date(msg.timestamp), "h:mm a")}
                            </span>
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

        {/* Contact Info Panel - Hidden on mobile and tablet */}
        {selectedConversation && (
          <Card className="hidden xl:flex xl:w-96 flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Contact Details */}
                {contactInfo ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={contactInfo.avatar || undefined} />
                        <AvatarFallback>
                          {contactInfo.firstName && contactInfo.lastName
                            ? `${contactInfo.firstName[0]}${contactInfo.lastName[0]}`.toUpperCase()
                            : (contactInfo.email?.[0] || '?').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">
                          {contactInfo.firstName && contactInfo.lastName
                            ? `${contactInfo.firstName} ${contactInfo.lastName}`
                            : contactInfo.email}
                        </h3>
                        <p className="text-sm text-muted-foreground">{contactInfo.email}</p>
                      </div>
                    </div>
                    
                    {contactInfo.phone && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Phone</p>
                        <p className="text-sm">{formatForDisplay(contactInfo.phone)}</p>
                      </div>
                    )}
                    
                    {contactInfo.company && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Company Information</p>
                        </div>
                        <div className="pl-6 space-y-1">
                          <div>
                            <p className="text-xs text-muted-foreground">Name</p>
                            <p className="text-sm font-medium">{contactInfo.company.name}</p>
                          </div>
                          {contactInfo.company.slug && (
                            <div>
                              <p className="text-xs text-muted-foreground">Slug</p>
                              <p className="text-sm">{contactInfo.company.slug}</p>
                            </div>
                          )}
                          {contactInfo.company.stripeCustomerId && (
                            <div>
                              <p className="text-xs text-muted-foreground">Stripe Customer</p>
                              <p className="text-sm font-mono text-xs">{contactInfo.company.stripeCustomerId}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="text-sm capitalize">{contactInfo.company.isActive ? 'Active' : 'Inactive'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No contact information available</p>
                  </div>
                )}

                <Separator />

                {/* Company Users */}
                {companyUsers.length > 0 && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold">All Company Users ({companyUsers.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {companyUsers.map((user) => (
                          <Link 
                            key={user.id} 
                            href={`/users/${user.id}`}
                            className="flex items-center gap-2 p-2 rounded-lg hover-elevate active-elevate-2 cursor-pointer transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {user.firstName && user.lastName
                                  ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                                  : (user.email?.[0] || '?').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.email}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Internal Notes */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold">Internal Notes</h4>
                  </div>

                  {/* Add Note Form */}
                  <div className="space-y-2 mb-4">
                    <Textarea
                      data-testid="input-new-note"
                      placeholder="Add an internal note..."
                      value={newNoteInput}
                      onChange={(e) => setNewNoteInput(e.target.value)}
                      className="resize-none"
                      rows={3}
                    />
                    <Button
                      data-testid="button-create-note"
                      size="sm"
                      onClick={() => {
                        if (newNoteInput.trim() && selectedConversation) {
                          createNoteMutation.mutate({
                            phoneNumber: selectedConversation,
                            note: newNoteInput.trim()
                          });
                        }
                      }}
                      disabled={!newNoteInput.trim() || createNoteMutation.isPending}
                      className="w-full"
                    >
                      {createNoteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Add Note"
                      )}
                    </Button>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2">
                    {notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="p-3 rounded-lg bg-muted space-y-2">
                          {editingNoteId === note.id ? (
                            <>
                              <Textarea
                                data-testid={`input-edit-note-${note.id}`}
                                value={editingNoteContent}
                                onChange={(e) => setEditingNoteContent(e.target.value)}
                                className="resize-none"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button
                                  data-testid={`button-save-note-${note.id}`}
                                  size="sm"
                                  onClick={() => {
                                    if (editingNoteContent.trim()) {
                                      updateNoteMutation.mutate({
                                        id: note.id,
                                        note: editingNoteContent.trim()
                                      });
                                    }
                                  }}
                                  disabled={!editingNoteContent.trim() || updateNoteMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteContent("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  {note.createdAt ? format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a") : ''}
                                </p>
                                <div className="flex gap-1">
                                  <Button
                                    data-testid={`button-edit-note-${note.id}`}
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingNoteContent(note.note);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    data-testid={`button-delete-note-${note.id}`}
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => deleteNoteMutation.mutate(note.id)}
                                    disabled={deleteNoteMutation.isPending}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={newChatDialogOpen} onOpenChange={(open) => {
        setNewChatDialogOpen(open);
        if (!open) {
          setNewChatPhone("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Chat</DialogTitle>
            <DialogDescription>
              Enter a phone number to start a new SMS conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              data-testid="input-new-chat-phone"
              placeholder="Enter phone number"
              value={newChatPhone}
              onChange={(e) => setNewChatPhone(formatPhoneInput(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newChatPhone.trim()) {
                  const e164Phone = formatE164(newChatPhone);
                  setSelectedConversation(e164Phone);
                  setNewChatDialogOpen(false);
                  setNewChatPhone("");
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setNewChatDialogOpen(false);
                setNewChatPhone("");
              }}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-start-chat"
              onClick={() => {
                if (newChatPhone.trim()) {
                  const e164Phone = formatE164(newChatPhone);
                  setSelectedConversation(e164Phone);
                  setNewChatDialogOpen(false);
                  setNewChatPhone("");
                }
              }}
              disabled={!newChatPhone.trim()}
            >
              Start Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
              All messages and notes will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => {
                if (selectedConversation) {
                  deleteConversationMutation.mutate(selectedConversation);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteConversationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
