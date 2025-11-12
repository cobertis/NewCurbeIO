import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageCircle, Send, ArrowLeft, Info } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow, format } from "date-fns";
import type { User } from "@shared/schema";
import { cn } from "@/lib/utils";

// iMessage conversation type
interface IMessageConversation {
  id: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isGroup: boolean;
}

// iMessage message type
interface IMessage {
  id: string;
  conversationId: string;
  text: string;
  isFromMe: boolean;
  messageType: "iMessage" | "SMS" | "RCS";
  timestamp: Date;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
}

type MobileView = "conversations" | "messages" | "details";

export default function IMessagePage() {
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("conversations");
  const [messageText, setMessageText] = useState("");

  // Get user data
  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  // Get iMessage conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery<{ conversations: IMessageConversation[] }>({
    queryKey: ["/api/imessage/conversations"],
  });

  const conversations = conversationsData?.conversations || [];

  // Get messages for selected conversation
  const { data: messagesData, isLoading: loadingMessages } = useQuery<{ messages: IMessage[] }>({
    queryKey: ["/api/imessage/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  const messages = messagesData?.messages || [];

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!selectedConversationId) throw new Error("No conversation selected");
      
      return apiRequest("POST", "/api/imessage/send", {
        conversationId: selectedConversationId,
        text,
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/conversations", selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/conversations"] });
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark conversation as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("PATCH", `/api/imessage/conversations/${conversationId}`, {
        markAsRead: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/conversations"] });
    },
  });

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedConversationId && selectedConversation?.unreadCount > 0) {
      markAsReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessageMutation.mutate({ text: messageText.trim() });
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMobileView("messages");
  };

  if (loadingConversations) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner data-testid="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* LEFT COLUMN: Conversations List */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-background",
          mobileView !== "conversations" && "hidden md:flex"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" data-testid="text-conversations-title">iMessage</h2>
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p data-testid="text-no-conversations">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-accent transition-colors flex items-start gap-3",
                    selectedConversationId === conversation.id && "bg-accent"
                  )}
                  data-testid={`button-conversation-${conversation.id}`}
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={conversation.contactAvatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {conversation.contactName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold truncate" data-testid={`text-contact-name-${conversation.id}`}>
                        {conversation.contactName}
                      </h3>
                      <span className="text-xs text-muted-foreground shrink-0" data-testid={`text-timestamp-${conversation.id}`}>
                        {formatDistanceToNow(new Date(conversation.lastMessageTime), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-last-message-${conversation.id}`}>
                        {conversation.lastMessage}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <Badge 
                          variant="default" 
                          className="shrink-0 h-5 min-w-5 px-1 text-xs rounded-full flex items-center justify-center"
                          data-testid={`badge-unread-${conversation.id}`}
                        >
                          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
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

      {/* CENTER COLUMN: Messages */}
      <div
        className={cn(
          "flex-1 flex flex-col bg-background",
          mobileView !== "messages" && "hidden md:flex"
        )}
      >
        {selectedConversation ? (
          <>
            {/* Messages Header */}
            <div className="p-4 border-b border-border bg-background flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setMobileView("conversations")}
                  data-testid="button-back-to-conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedConversation.contactAvatar} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {selectedConversation.contactName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold" data-testid="text-selected-contact-name">
                    {selectedConversation.contactName}
                  </h3>
                  <p className="text-xs text-muted-foreground" data-testid="text-selected-contact-phone">
                    {selectedConversation.contactPhone}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileView("details")}
                className="md:hidden"
                data-testid="button-show-details"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner data-testid="loading-messages-spinner" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p data-testid="text-no-messages">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
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
                          "max-w-[70%] rounded-2xl px-4 py-2",
                          message.isFromMe
                            ? message.messageType === "iMessage"
                              ? "bg-blue-500 text-white" // Blue bubble for iMessage
                              : "bg-green-500 text-white" // Green bubble for SMS/RCS
                            : "bg-muted text-foreground" // Gray bubble for received messages
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words" data-testid={`text-message-content-${message.id}`}>
                          {message.text}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span 
                            className={cn(
                              "text-xs",
                              message.isFromMe ? "text-white/70" : "text-muted-foreground"
                            )}
                            data-testid={`text-message-time-${message.id}`}
                          >
                            {format(new Date(message.timestamp), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-background">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="iMessage"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
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
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  size="icon"
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <LoadingSpinner className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p data-testid="text-select-conversation">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Contact Details */}
      <div
        className={cn(
          "w-full md:w-80 border-l border-border bg-background",
          mobileView !== "details" && "hidden lg:block"
        )}
      >
        {selectedConversation ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Contact Details</h3>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileView("messages")}
                data-testid="button-close-details"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col items-center text-center mb-6">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={selectedConversation.contactAvatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                  {selectedConversation.contactName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-semibold mb-1" data-testid="text-details-contact-name">
                {selectedConversation.contactName}
              </h2>
              <p className="text-sm text-muted-foreground" data-testid="text-details-contact-phone">
                {selectedConversation.contactPhone}
              </p>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Contact Information</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm" data-testid="text-details-phone-info">
                      {selectedConversation.contactPhone}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground p-8 text-center">
            <p data-testid="text-no-contact-selected">Select a conversation to view contact details</p>
          </div>
        )}
      </div>
    </div>
  );
}
