import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Send, Paperclip, Smile, X, Check, CheckCheck, Loader2, MessageSquare } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface WidgetConfig {
  id: string;
  websiteToken: string;
  name: string;
  widgetColor: string;
  position: string;
  welcomeTitle: string;
  welcomeTagline: string;
  preChatFormEnabled: boolean;
  preChatFormOptions: {
    preChatMessage?: string;
    requireEmail?: boolean;
    preChatFields?: {
      fieldType: string;
      label: string;
      name: string;
      type: string;
      placeholder?: string;
      required: boolean;
      enabled: boolean;
      values?: string[];
    }[];
  };
  replyTime: string;
  featureFlags: number;
  showBranding: boolean;
  customLogo?: string;
}

interface Message {
  id: string;
  messageType: "incoming" | "outgoing";
  content: string;
  contentType: string;
  senderType: string;
  createdAt: string;
  attachments?: any[];
  status?: string;
}

interface Conversation {
  id: string;
  displayId: number;
  status: string;
  lastActivityAt: string;
  contactLastSeenAt?: string;
  agentLastSeenAt?: string;
}

interface PreChatFormData {
  [key: string]: string;
}

const FEATURE_FLAGS = {
  ATTACHMENTS: 1,
  EMOJI: 2,
  END_CONVERSATION: 4,
  USE_INBOX_AVATAR: 8,
};

export default function WidgetFrame() {
  const [location] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showPreChatForm, setShowPreChatForm] = useState(false);
  const [preChatFormData, setPreChatFormData] = useState<PreChatFormData>({});
  const [isTyping, setIsTyping] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const hasFeature = (flag: number) => config && (config.featureFlags & flag) !== 0;

  const apiRequest = useCallback(async (method: string, endpoint: string, body?: any) => {
    if (!token) throw new Error("No token available");
    
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (response.status === 401) {
      setError("Session expired. Please refresh the page.");
      setToken(null);
      return null;
    }
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    
    return response.json();
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const websiteToken = params.get("website_token");
    const isDark = params.get("dark") === "true";
    
    setDarkMode(isDark);
    
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
    
    if (urlToken) {
      setToken(urlToken);
    } else if (websiteToken) {
      initSession(websiteToken);
    } else {
      setError("Missing authentication token");
      setIsLoading(false);
    }
  }, []);

  const initSession = async (websiteToken: string) => {
    try {
      const deviceId = localStorage.getItem("widget_device_id") || crypto.randomUUID();
      localStorage.setItem("widget_device_id", deviceId);
      
      const response = await fetch("/api/widget/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteToken,
          deviceId,
          referrer: document.referrer,
          initialPageUrl: window.location.href,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create session");
      }
      
      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      setError("Failed to initialize widget");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadConfig();
    }
  }, [token]);

  const loadConfig = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const websiteToken = params.get("website_token");
      
      if (websiteToken) {
        const response = await fetch(`/api/widget/config/${websiteToken}`);
        if (response.ok) {
          const configData = await response.json();
          setConfig(configData);
        }
      }
      
      await loadConversations();
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const data = await apiRequest("GET", "/api/widget/conversations");
      if (data?.conversations) {
        setConversations(data.conversations);
        
        const openConversation = data.conversations.find((c: Conversation) => c.status === "open");
        if (openConversation) {
          setActiveConversation(openConversation);
          await loadMessages(openConversation.id);
        } else if (data.conversations.length === 0 && config?.preChatFormEnabled) {
          setShowPreChatForm(true);
        }
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await apiRequest("GET", `/api/widget/conversations/${conversationId}/messages`);
      if (data?.messages) {
        setMessages(data.messages);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  useEffect(() => {
    if (activeConversation) {
      pollingRef.current = setInterval(async () => {
        await loadMessages(activeConversation.id);
      }, 5000);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [activeConversation?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handlePreChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowPreChatForm(false);
    
    if (inputValue.trim()) {
      await createConversation(inputValue.trim());
      setInputValue("");
    }
  };

  const createConversation = async (message?: string) => {
    try {
      const data = await apiRequest("POST", "/api/widget/conversations", {
        message,
        preChatFormData: Object.keys(preChatFormData).length > 0 ? preChatFormData : undefined,
      });
      
      if (data?.conversation) {
        setActiveConversation(data.conversation);
        setConversations(prev => [data.conversation, ...prev]);
        if (message) {
          await loadMessages(data.conversation.id);
        }
      }
    } catch (err) {
      console.error("Error creating conversation:", err);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    
    const content = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    
    try {
      if (!activeConversation) {
        if (config?.preChatFormEnabled && conversations.length === 0) {
          setShowPreChatForm(true);
          setInputValue(content);
          setIsSending(false);
          return;
        }
        await createConversation(content);
      } else {
        const echoId = crypto.randomUUID();
        
        const optimisticMessage: Message = {
          id: echoId,
          messageType: "incoming",
          content,
          contentType: "text",
          senderType: "Contact",
          createdAt: new Date().toISOString(),
          status: "sending",
        };
        
        setMessages(prev => [...prev, optimisticMessage]);
        scrollToBottom();
        
        await apiRequest("POST", `/api/widget/conversations/${activeConversation.id}/messages`, {
          content,
          contentType: "text",
          echoId,
        });
        
        await loadMessages(activeConversation.id);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setInputValue(prev => prev + emoji.native);
    inputRef.current?.focus();
  };

  const handleEndConversation = async () => {
    if (!activeConversation) return;
    
    try {
      await apiRequest("POST", `/api/widget/conversations/${activeConversation.id}/resolve`);
      setActiveConversation(null);
      setMessages([]);
      await loadConversations();
    } catch (err) {
      console.error("Error ending conversation:", err);
    }
  };

  const markAsRead = async () => {
    if (!activeConversation) return;
    
    try {
      await apiRequest("POST", `/api/widget/conversations/${activeConversation.id}/read`);
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  useEffect(() => {
    if (activeConversation && messages.length > 0) {
      markAsRead();
    }
  }, [messages.length, activeConversation?.id]);

  const getReplyTimeText = (replyTime: string) => {
    switch (replyTime) {
      case "in_a_few_minutes": return "Usually replies in a few minutes";
      case "in_a_few_hours": return "Usually replies in a few hours";
      case "in_a_day": return "Usually replies in a day";
      default: return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  const widgetColor = config?.widgetColor || "#2563eb";

  return (
    <div className={cn("flex flex-col h-screen bg-background", darkMode && "dark")}>
      <header 
        className="flex items-center justify-between px-4 py-3 text-white shrink-0"
        style={{ backgroundColor: widgetColor }}
        data-testid="widget-header"
      >
        <div className="flex items-center gap-3">
          {config?.customLogo ? (
            <img src={config.customLogo} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <Avatar className="h-8 w-8">
              <AvatarFallback style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                <MessageSquare className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <h1 className="font-semibold text-sm" data-testid="text-welcome-title">
              {config?.welcomeTitle || "Hi there!"}
            </h1>
            <p className="text-xs opacity-90" data-testid="text-welcome-tagline">
              {config?.welcomeTagline || getReplyTimeText(config?.replyTime || "")}
            </p>
          </div>
        </div>
        
        {hasFeature(FEATURE_FLAGS.END_CONVERSATION) && activeConversation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEndConversation}
            className="text-white hover:bg-white/20"
            data-testid="button-end-conversation"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </header>

      {showPreChatForm && config?.preChatFormEnabled ? (
        <div className="flex-1 overflow-auto p-4">
          <form onSubmit={handlePreChatSubmit} className="space-y-4" data-testid="form-prechat">
            {config.preChatFormOptions?.preChatMessage && (
              <p className="text-sm text-muted-foreground" data-testid="text-prechat-message">
                {config.preChatFormOptions.preChatMessage}
              </p>
            )}
            
            {config.preChatFormOptions?.preChatFields
              ?.filter(field => field.enabled)
              .map(field => (
                <div key={field.name} className="space-y-1">
                  <label className="text-sm font-medium" htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <Input
                    id={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    required={field.required}
                    value={preChatFormData[field.name] || ""}
                    onChange={(e) => setPreChatFormData(prev => ({
                      ...prev,
                      [field.name]: e.target.value
                    }))}
                    data-testid={`input-prechat-${field.name}`}
                  />
                </div>
              ))}
            
            <div className="space-y-1">
              <label className="text-sm font-medium">Your message</label>
              <Input
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                data-testid="input-prechat-message"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              style={{ backgroundColor: widgetColor }}
              disabled={!inputValue.trim()}
              data-testid="button-start-conversation"
            >
              Start Conversation
            </Button>
          </form>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 p-4" data-testid="message-list">
            <div className="space-y-4">
              {messages.length === 0 && !activeConversation && (
                <div className="text-center py-8">
                  <MessageSquare 
                    className="h-12 w-12 mx-auto mb-3" 
                    style={{ color: widgetColor }} 
                  />
                  <p className="text-muted-foreground text-sm">
                    Start a conversation with us
                  </p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.messageType === "incoming" ? "justify-end" : "justify-start"
                  )}
                  data-testid={`message-${message.id}`}
                >
                  {message.messageType === "outgoing" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback style={{ backgroundColor: widgetColor }} className="text-white text-xs">
                        A
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2",
                      message.messageType === "incoming"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                    style={message.messageType === "incoming" ? { backgroundColor: widgetColor } : undefined}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words" data-testid="text-message-content">
                      {message.content}
                    </p>
                    
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      message.messageType === "incoming" ? "justify-end" : "justify-start"
                    )}>
                      <span className="text-[10px] opacity-70" data-testid="text-message-time">
                        {format(new Date(message.createdAt), "h:mm a")}
                      </span>
                      
                      {message.messageType === "incoming" && (
                        <span className="opacity-70">
                          {message.status === "sending" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : activeConversation?.agentLastSeenAt && 
                              new Date(activeConversation.agentLastSeenAt) >= new Date(message.createdAt) ? (
                            <CheckCheck className="h-3 w-3" data-testid="icon-read-receipt" />
                          ) : (
                            <Check className="h-3 w-3" data-testid="icon-delivered" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {agentTyping && (
                <div className="flex gap-2 items-center" data-testid="typing-indicator">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback style={{ backgroundColor: widgetColor }} className="text-white text-xs">
                      A
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t bg-background p-3" data-testid="message-input-area">
            <div className="flex items-center gap-2">
              {hasFeature(FEATURE_FLAGS.ATTACHMENTS) && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={() => {}}
                    data-testid="input-file"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-attach"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                className="flex-1"
                data-testid="input-message"
              />
              
              {hasFeature(FEATURE_FLAGS.EMOJI) && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      data-testid="button-emoji"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Picker
                      data={data}
                      onEmojiSelect={handleEmojiSelect}
                      theme={darkMode ? "dark" : "light"}
                      previewPosition="none"
                      skinTonePosition="none"
                    />
                  </PopoverContent>
                </Popover>
              )}
              
              <Button
                type="button"
                size="icon"
                onClick={sendMessage}
                disabled={!inputValue.trim() || isSending}
                style={{ backgroundColor: widgetColor }}
                data-testid="button-send"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
      
      {config?.showBranding && (
        <div className="shrink-0 text-center py-2 text-xs text-muted-foreground border-t" data-testid="widget-branding">
          Powered by <span className="font-medium">Curbe</span>
        </div>
      )}
    </div>
  );
}
