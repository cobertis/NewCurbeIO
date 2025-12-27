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
import { MessengerLayout, type MessengerView } from "@/components/messenger-layout";
import { Filter } from "lucide-react";
import { 
  Search, 
  Phone, 
  Plus, 
  Send, 
  Paperclip, 
  Trash2,
  MessageSquare,
  User,
  Mail,
  Calendar,
  Tag,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  CheckCheck,
  CheckCircle,
  Clock,
  Smile,
  FileText,
  Eye,
  Wand2,
  Volume2,
  CheckSquare,
  Braces,
  Pencil,
  List,
  Users,
  Building2,
  Briefcase,
  Download,
  Image,
  Globe,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  RotateCcw,
  Activity,
  Settings
} from "lucide-react";
import { Link } from "wouter";
import { SiFacebook, SiInstagram, SiTelegram } from "react-icons/si";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface TelnyxConversation {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  email: string | null;
  jobTitle: string | null;
  organization: string | null;
  lastMessage: string | null;
  lastMediaUrls: string[] | null;
  lastMessageAt: string | null;
  unreadCount: number;
  companyPhoneNumber: string;
  channel?: string;
  status?: "open" | "pending" | "solved" | "snoozed" | "archived";
  assignedTo?: string | null;
}

const getChannelIcon = (channel?: string) => {
  switch (channel) {
    case "imessage":
      return <MessageSquare className="h-2.5 w-2.5 text-white" />;
    case "telegram":
      return <SiTelegram className="h-2.5 w-2.5 text-white" />;
    case "rcs":
      return <MessageSquare className="h-2.5 w-2.5 text-white" />;
    case "sms":
      return <MessageSquare className="h-2.5 w-2.5 text-white" />;
    case "live_chat":
      return <Globe className="h-2.5 w-2.5 text-white" />;
    default:
      return <MessageSquare className="h-2.5 w-2.5 text-white" />;
  }
};

const getChannelColor = (channel?: string) => {
  switch (channel) {
    case "imessage":
      return "bg-blue-500";
    case "telegram":
      return "bg-sky-500";
    case "rcs":
      return "bg-purple-500";
    case "sms":
      return "bg-green-500";
    case "live_chat":
      return "bg-orange-500";
    default:
      return "bg-green-500";
  }
};

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
  mediaUrls?: string[] | null;
  isInternalNote?: boolean;
}

type MobileView = "threads" | "messages" | "details";

interface LiveVisitor {
  id: string;
  widgetId: string;
  visitorId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  ipAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  currentUrl: string | null;
  pageTitle: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export default function InboxPage() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<MessengerView>("open");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("threads");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState("");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [contactInfoOpen, setContactInfoOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    email: "",
    jobTitle: "",
    organization: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [visitorTypingPreview, setVisitorTypingPreview] = useState<string | null>(null);
  const [startChatDialogOpen, setStartChatDialogOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<LiveVisitor | null>(null);
  const [startChatMessage, setStartChatMessage] = useState("");
  const [copilotDraft, setCopilotDraft] = useState<string | null>(null);
  const [copilotSource, setCopilotSource] = useState<"knowledge_base" | "general" | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"details" | "pulse-ai">("details");
  const [pulseAiMessages, setPulseAiMessages] = useState<Array<{role: "user" | "assistant", content: string, isLoading?: boolean}>>([]);
  const [pulseAiInput, setPulseAiInput] = useState("");
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionPopupPosition, setSelectionPopupPosition] = useState<{ x: number, y: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const preserveSelectionRef = useRef<string | null>(null);

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

  const { data: visitorsData } = useQuery<{ visitors: LiveVisitor[] }>({
    queryKey: ["/api/live-visitors"],
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });
  const liveVisitors = visitorsData?.visitors || [];

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const { data: messagesData, isLoading: loadingMessages } = useQuery<{ messages: TelnyxMessage[] }>({
    queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`],
    enabled: !!selectedConversationId,
  });
  const messages = messagesData?.messages || [];

  const matchedContact = useMemo(() => {
    if (!selectedConversation) return null;
    return contacts.find(c => c.phone === selectedConversation.phoneNumber);
  }, [selectedConversation, contacts]);

  const lastInboundMessage = useMemo(() => {
    return messages.filter(m => m.direction === "inbound" && !m.isInternalNote).pop();
  }, [messages]);

  const lastOutboundMessage = useMemo(() => {
    return messages.filter(m => m.direction === "outbound" && !m.isInternalNote).pop();
  }, [messages]);

  const lastInteraction = useMemo(() => {
    const nonNotes = messages.filter(m => !m.isInternalNote);
    return nonNotes.length > 0 ? nonNotes[nonNotes.length - 1] : null;
  }, [messages]);

  useWebSocket((message) => {
    const msg = message as any;
    if (msg.type === 'telnyx_message' || msg.type === 'new_message' || msg.type === 'conversation_update') {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live-visitors"] });
      // Always refresh messages for the selected conversation on any update
      if (selectedConversationId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] 
        });
      }
    }
  });

  useEffect(() => {
    if (!selectedConversationId || selectedConversation?.channel !== "live_chat") {
      setVisitorTypingPreview(null);
      return;
    }
    
    const pollPreview = async () => {
      try {
        const res = await fetch(`/api/inbox/live-chat/preview/${selectedConversationId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const { isTyping, text } = await res.json();
          setVisitorTypingPreview(isTyping ? text : null);
        }
      } catch (error) {
        console.error('Preview poll error:', error);
      }
    };
    
    pollPreview();
    const interval = setInterval(pollPreview, 1000);
    return () => clearInterval(interval);
  }, [selectedConversationId, selectedConversation?.channel]);

  const previousViewRef = useRef<MessengerView>(activeView);
  
  useEffect(() => {
    if (preserveSelectionRef.current) {
      return;
    }
    // Only clear selection when user explicitly navigates to a different view
    // Don't clear if the view is the same (e.g., during re-renders)
    if (previousViewRef.current !== activeView) {
      previousViewRef.current = activeView;
      setSelectedConversationId(null);
      setMobileView("threads");
    }
  }, [activeView]);

  // Reset right panel tab to details when conversation changes
  useEffect(() => {
    setRightPanelTab("details");
    setPulseAiMessages([]);
    setPulseAiInput("");
  }, [selectedConversationId]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, text, isInternalNote, files, optimisticId }: { conversationId: string; text: string; isInternalNote?: boolean; files?: File[]; optimisticId: string }) => {
      const formData = new FormData();
      formData.append('text', text);
      if (isInternalNote) {
        formData.append('isInternalNote', 'true');
      }
      if (files && files.length > 0) {
        files.forEach((file) => {
          formData.append('files', file);
        });
      }
      const response = await fetch(`/api/inbox/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate to get the real message from server
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/inbox/conversations/${variables.conversationId}/messages`] 
      });
    },
    onError: (error: any, variables) => {
      // Remove optimistic message on error
      queryClient.setQueryData(
        [`/api/inbox/conversations/${variables.conversationId}/messages`],
        (old: any) => ({
          ...old,
          messages: old?.messages?.filter((m: any) => m.id !== variables.optimisticId) || []
        })
      );
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

  const updateConversationMutation = useMutation({
    mutationFn: async ({ conversationId, displayName, email, jobTitle, organization }: { conversationId: string; displayName: string; email: string; jobTitle: string; organization: string }) => {
      return apiRequest("PATCH", `/api/inbox/conversations/${conversationId}`, { displayName, email, jobTitle, organization });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      setIsEditingDetails(false);
      toast({
        title: "Contact updated",
        description: "Contact information has been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("DELETE", `/api/inbox/conversations/${conversationId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      setSelectedConversationId(null);
      setDeleteDialogOpen(false);
      toast({
        title: "Conversation deleted",
        description: "The conversation and all messages have been permanently deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const acceptChatMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/inbox/conversations/${conversationId}/accept`);
    },
    onMutate: async (conversationId: string) => {
      preserveSelectionRef.current = conversationId;
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/conversations"] });
      const previousData = queryClient.getQueryData(["/api/inbox/conversations"]);
      queryClient.setQueryData(["/api/inbox/conversations"], (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((conv: any) =>
            conv.id === conversationId ? { ...conv, status: "open" } : conv
          ),
        };
      });
      return { previousData, conversationId };
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      setActiveView("open");
      setSelectedConversationId(conversationId);
      setTimeout(() => {
        preserveSelectionRef.current = null;
      }, 100);
      toast({
        title: "Chat accepted",
        description: "You are now connected with the visitor.",
      });
    },
    onError: (error: any, _variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/inbox/conversations"], context.previousData);
      }
      toast({
        title: "Failed to accept chat",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const solveChatMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("PATCH", `/api/inbox/conversations/${conversationId}`, { status: "solved" });
    },
    onMutate: async (conversationId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/conversations"] });
      const previousData = queryClient.getQueryData(["/api/inbox/conversations"]);
      queryClient.setQueryData(["/api/inbox/conversations"], (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((conv: any) =>
            conv.id === conversationId ? { ...conv, status: "solved" } : conv
          ),
        };
      });
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      setSelectedConversationId(null);
      setMobileView("threads");
      setActiveView("solved");
      toast({
        title: "Conversation solved",
        description: "The conversation has been moved to Solved.",
      });
    },
    onError: (error: any, _variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/inbox/conversations"], context.previousData);
      }
      toast({
        title: "Failed to solve conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const startChatWithVisitorMutation = useMutation({
    mutationFn: async (data: { visitorId: string; message: string; widgetId?: string }) => {
      const res = await apiRequest("POST", "/api/inbox/start-chat-visitor", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live-visitors"] });
      setStartChatDialogOpen(false);
      setStartChatMessage("");
      setSelectedVisitor(null);
      if (data?.conversation?.id) {
        setSelectedConversationId(data.conversation.id);
        setActiveView("open");
      }
      toast({
        title: "Chat started",
        description: "Your message has been sent to the visitor.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start chat",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const copilotDraftMutation = useMutation({
    mutationFn: async ({ conversationId, lastMessages }: { conversationId: string; lastMessages: Array<{ direction: string; text: string }> }) => {
      return apiRequest("POST", "/api/ai/copilot/draft", { conversationId, lastMessages });
    },
    onSuccess: (data: any) => {
      if (data.success && data.draft) {
        setCopilotDraft(data.draft);
        setCopilotSource(data.source || null);
      } else if (data.draftReply) {
        setCopilotDraft(data.draftReply);
        setCopilotSource("knowledge_base");
      } else {
        toast({
          title: "No suggestion available",
          description: "AI couldn't generate a suggestion for this conversation.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate AI suggestion",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const pulseAiAskMutation = useMutation({
    mutationFn: async ({ question, conversationId }: { question: string; conversationId: string }) => {
      const lastMsgs = messages?.slice(-10).map(m => ({
        direction: m.direction,
        text: m.text,
        createdAt: m.createdAt
      })) || [];
      return apiRequest("POST", "/api/ai/copilot/draft", { 
        conversationId, 
        lastMessages: lastMsgs,
        question 
      });
    },
    onSuccess: (data: any) => {
      setPulseAiMessages(prev => prev.map(m => 
        m.isLoading ? { role: "assistant" as const, content: data.draft || data.draftReply || "I couldn't find relevant information." } : m
      ));
    },
    onError: () => {
      setPulseAiMessages(prev => prev.filter(m => !m.isLoading));
      toast({ title: "Error", description: "Failed to get AI response", variant: "destructive" });
    }
  });

  const handlePulseAiSubmit = () => {
    if (!pulseAiInput.trim() || !selectedConversationId) return;
    setPulseAiMessages(prev => [
      ...prev, 
      { role: "user", content: pulseAiInput },
      { role: "assistant", content: "", isLoading: true }
    ]);
    pulseAiAskMutation.mutate({ question: pulseAiInput, conversationId: selectedConversationId });
    setPulseAiInput("");
  };

  const handleInsertPulseAiMessage = (content: string) => {
    setNewMessage(content);
    setRightPanelTab("details");
    toast({ title: "Inserted", description: "AI response has been inserted into the message composer." });
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(selection.toString().trim());
      setSelectionPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    } else {
      setSelectedText(null);
      setSelectionPopupPosition(null);
    }
  };

  const handleAskPulseAI = () => {
    if (!selectedText || !selectedConversationId) return;
    const question = selectedText;
    setSelectedText(null);
    setSelectionPopupPosition(null);
    window.getSelection()?.removeAllRanges();
    setRightPanelTab("pulse-ai");
    setPulseAiMessages(prev => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", isLoading: true }
    ]);
    pulseAiAskMutation.mutate({ question, conversationId: selectedConversationId });
  };

  const handleAiCopilotClick = () => {
    if (copilotDraft) {
      setCopilotDraft(null);
      setCopilotSource(null);
      return;
    }
    
    if (!selectedConversationId || !messages.length) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation first.",
        variant: "destructive",
      });
      return;
    }
    
    const lastMessages = messages
      .filter(m => !m.isInternalNote)
      .slice(-5)
      .map(m => ({ direction: m.direction, text: m.text }));
    
    copilotDraftMutation.mutate({ conversationId: selectedConversationId, lastMessages });
  };

  const handleInsertDraft = () => {
    if (copilotDraft) {
      setNewMessage(copilotDraft);
      setCopilotDraft(null);
      setCopilotSource(null);
    }
  };

  const handleDismissDraft = () => {
    setCopilotDraft(null);
    setCopilotSource(null);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (companyNumbers.length > 0 && !selectedFromNumber) {
      setSelectedFromNumber(companyNumbers[0].phoneNumber);
    }
  }, [companyNumbers, selectedFromNumber]);

  // Click-away listener to clear text selection popup
  useEffect(() => {
    if (!selectedText) return;
    
    const handleClickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="ask-pulse-ai-popup"]')) {
        setSelectedText(null);
        setSelectionPopupPosition(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [selectedText]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    switch (activeView) {
      case "open":
        // Exclude waiting live chats from Open view
        filtered = conversations.filter(c => (c.status === "open" || c.status === "pending" || !c.status) && (c as any).status !== "waiting");
        break;
      case "unread":
        filtered = conversations.filter(c => c.unreadCount > 0 && (c as any).status !== "waiting");
        break;
      case "assigned":
        filtered = conversations.filter(c => c.assignedTo === user?.id);
        break;
      case "unassigned":
        filtered = conversations.filter(c => !c.assignedTo && (c as any).status !== "waiting");
        break;
      case "waiting":
        // Show all live chats with status "waiting" - visitors waiting for an agent to accept
        filtered = conversations.filter(c => {
          if (c.channel !== "live_chat" || (c as any).status !== "waiting") return false;
          // Show all waiting chats that have pending messages (visitor sent a message)
          return (c as any).hasPendingMessage;
        });
        break;
      case "solved":
        filtered = conversations.filter(c => c.status === "solved" || c.status === "archived");
        break;
      case "all":
        filtered = conversations;
        break;
      case "sms":
        filtered = conversations.filter(c => c.channel === "sms" || !c.channel);
        break;
      case "live-chat":
        filtered = conversations.filter(c => c.channel === "live_chat" || c.channel === "live-chat" || c.channel === "chat-widget");
        break;
      case "whatsapp":
        filtered = conversations.filter(c => c.channel === "whatsapp");
        break;
      case "facebook":
        filtered = conversations.filter(c => c.channel === "facebook");
        break;
      case "instagram":
        filtered = conversations.filter(c => c.channel === "instagram");
        break;
      default:
        filtered = conversations;
    }
    
    if (!searchQuery) return filtered;
    const query = searchQuery.toLowerCase();
    return filtered.filter(c => 
      c.displayName?.toLowerCase().includes(query) ||
      c.phoneNumber.includes(query) ||
      c.lastMessage?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery, activeView]);

  const viewLabel = useMemo(() => {
    switch (activeView) {
      case "open": return "Open";
      case "unread": return "Unread";
      case "assigned": return "Assigned to me";
      case "unassigned": return "Unassigned";
      case "waiting": return "Waiting live chats";
      case "visitors": return "Live visitors";
      case "solved": return "Solved";
      case "all": return "All chats";
      case "sms": return "SMS";
      case "live-chat": return "Live chat";
      case "whatsapp": return "WhatsApp";
      case "facebook": return "Facebook";
      case "instagram": return "Instagram";
      default: return "Open";
    }
  }, [activeView]);

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

  const sendTypingIndicator = (conversationId: string, isTyping: boolean) => {
    fetch("/api/inbox/live-chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ conversationId, isTyping }),
    }).catch(console.error);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    if (selectedConversation?.channel === "live_chat" && value.length > 0 && !isInternalNote) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 2000) {
        sendTypingIndicator(selectedConversation.id, true);
        lastTypingSentRef.current = now;
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(selectedConversation.id, false);
      }, 3000);
    }
  };

  const handleSendMessage = () => {
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedConversationId) return;
    
    if (selectedConversation?.channel === "live_chat") {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTypingIndicator(selectedConversation.id, false);
    }
    
    const messageText = newMessage.trim();
    const messageFiles = selectedFiles.length > 0 ? [...selectedFiles] : undefined;
    const messageIsNote = isInternalNote;
    const optimisticId = `optimistic-${Date.now()}`;
    
    // Create optimistic message
    const optimisticMessage = {
      id: optimisticId,
      conversationId: selectedConversationId,
      direction: "outbound" as const,
      messageType: messageIsNote ? "internal_note" : "outgoing",
      text: messageText,
      status: "pending",
      createdAt: new Date().toISOString(),
      isInternalNote: messageIsNote,
      mediaUrls: messageFiles?.map(f => URL.createObjectURL(f)) || null,
    };
    
    // Add optimistic message to cache immediately
    queryClient.setQueryData(
      [`/api/inbox/conversations/${selectedConversationId}/messages`],
      (old: any) => ({
        ...old,
        messages: [...(old?.messages || []), optimisticMessage]
      })
    );
    
    // Clear input immediately so user can continue typing
    setNewMessage("");
    setIsInternalNote(false);
    setSelectedFiles([]);
    
    // Send in background
    sendMessageMutation.mutate({ 
      conversationId: selectedConversationId, 
      text: messageText,
      isInternalNote: messageIsNote,
      files: messageFiles,
      optimisticId
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

  const startEditing = () => {
    setEditForm({
      displayName: matchedContact?.displayName || selectedConversation?.displayName || "",
      email: selectedConversation?.email || matchedContact?.email || "",
      jobTitle: selectedConversation?.jobTitle || "",
      organization: selectedConversation?.organization || matchedContact?.companyName || "",
    });
    setIsEditingDetails(true);
  };

  const cancelEditing = () => {
    setIsEditingDetails(false);
  };

  const saveContactEdit = () => {
    if (!selectedConversationId) return;
    updateConversationMutation.mutate({
      conversationId: selectedConversationId,
      displayName: editForm.displayName,
      email: editForm.email,
      jobTitle: editForm.jobTitle,
      organization: editForm.organization,
    });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveContactEdit();
    }
  };

  if (authLoading || !isAuthenticated || loadingConversations) {
    return <LoadingSpinner message="Loading conversations..." />;
  }

  return (
    <MessengerLayout 
      activeView={activeView} 
      onViewChange={setActiveView}
      counts={{
        open: conversations.filter(c => (c.status === "open" || c.status === "pending" || !c.status) && (c as any).status !== "waiting").length,
        unread: conversations.filter(c => c.unreadCount > 0 && (c as any).status !== "waiting").length,
        assigned: conversations.filter(c => c.assignedTo === user?.id).length,
        unassigned: conversations.filter(c => !c.assignedTo && (c as any).status !== "waiting").length,
        waiting: conversations.filter(c => {
          if (c.channel !== "live_chat" || (c as any).status !== "waiting") return false;
          return (c as any).isVisitorActive && (c as any).hasPendingMessage;
        }).length,
        visitors: liveVisitors.length,
        solved: conversations.filter(c => c.status === "solved" || c.status === "archived").length,
        all: conversations.length,
      }}
    >
      {/* Live Visitors Panel - shown when visitors view is active */}
      {activeView === "visitors" ? (
        (() => {
          const animalColors = ['Red', 'Blue', 'Golden', 'Silver', 'Purple', 'Green', 'Orange', 'Pink', 'White', 'Black', 'Brown', 'Gray', 'Coral', 'Teal', 'Crimson', 'Azure', 'Jade', 'Ruby', 'Amber', 'Ivory'];
          const animals = ['Dolphin', 'Fox', 'Eagle', 'Wolf', 'Owl', 'Tiger', 'Panda', 'Falcon', 'Hawk', 'Bear', 'Lion', 'Shark', 'Whale', 'Panther', 'Jaguar', 'Raven', 'Phoenix', 'Dragon', 'Lynx', 'Otter', 'Badger', 'Cobra', 'Viper', 'Crane', 'Heron'];
          
          const getAnimalName = (visitorId: string) => {
            let hash = 0;
            for (let i = 0; i < visitorId.length; i++) {
              hash = ((hash << 5) - hash) + visitorId.charCodeAt(i);
              hash = hash & hash;
            }
            const colorIndex = Math.abs(hash) % animalColors.length;
            const animalIndex = Math.abs(hash >> 8) % animals.length;
            return `${animalColors[colorIndex]} ${animals[animalIndex]}`;
          };
          
          const getAvatarColor = (visitorId: string) => {
            const colors = ['bg-red-100 text-red-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-purple-100 text-purple-600', 'bg-orange-100 text-orange-600', 'bg-pink-100 text-pink-600', 'bg-teal-100 text-teal-600', 'bg-amber-100 text-amber-600'];
            let hash = 0;
            for (let i = 0; i < visitorId.length; i++) {
              hash = ((hash << 5) - hash) + visitorId.charCodeAt(i);
            }
            return colors[Math.abs(hash) % colors.length];
          };
          
          return (
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
              <div className="h-[49px] px-6 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-lg">Live Visitors</h2>
                  <span className="text-muted-foreground text-sm">{liveVisitors.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    <span className="text-xs">Filter</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-xs">Search</span>
                  </Button>
                </div>
              </div>
              
              {liveVisitors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Eye className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <p className="text-base text-muted-foreground font-medium">No visitors online</p>
                  <p className="text-sm text-muted-foreground mt-1">Visitors will appear here when they view your chat widget</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Current URL</th>
                        <th className="px-6 py-3">Location</th>
                        <th className="px-6 py-3">Time on Site</th>
                        <th className="px-6 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {liveVisitors.map((visitor) => {
                        const timeOnSite = Math.round((Date.now() - new Date(visitor.firstSeenAt).getTime()) / 1000);
                        const minutes = Math.floor(timeOnSite / 60);
                        const seconds = timeOnSite % 60;
                        const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                        const realName = visitor.firstName 
                          ? `${visitor.firstName}${visitor.lastName ? ' ' + visitor.lastName : ''}`
                          : null;
                        const displayName = realName || getAnimalName(visitor.visitorId);
                        const avatarColors = getAvatarColor(visitor.visitorId);
                        const initials = displayName.split(' ').map(w => w[0]).join('');
                        
                        return (
                          <tr
                            key={visitor.id}
                            className="hover:bg-muted/30 transition-colors"
                            data-testid={`visitor-${visitor.id}`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-medium text-sm", avatarColors)}>
                                    {initials}
                                  </div>
                                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{displayName}</p>
                                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(visitor.firstSeenAt), { addSuffix: true })}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <a 
                                href={visitor.currentUrl || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline truncate block max-w-xs"
                                title={visitor.currentUrl || undefined}
                              >
                                {visitor.currentUrl || 'Unknown page'}
                              </a>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {visitor.country && (
                                  <span className="text-lg" title={visitor.country}>
                                    {visitor.country === 'United States' ? '🇺🇸' : 
                                     visitor.country === 'Mexico' ? '🇲🇽' : 
                                     visitor.country === 'Canada' ? '🇨🇦' : 
                                     visitor.country === 'United Kingdom' ? '🇬🇧' : 
                                     visitor.country === 'Spain' ? '🇪🇸' : 
                                     visitor.country === 'Local' ? '🏠' : '🌍'}
                                  </span>
                                )}
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {visitor.city || 'Unknown City'}{visitor.state ? `, ${visitor.state}` : ''}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {visitor.country || 'Unknown Country'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-green-600 font-medium">{duration}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button 
                                size="sm" 
                                className="h-8 gap-1.5"
                                data-testid={`btn-start-chat-${visitor.id}`}
                                onClick={() => {
                                  setSelectedVisitor(visitor);
                                  setStartChatDialogOpen(true);
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Start Chat
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <>
      {/* Conversation List Panel */}
      <div className={cn(
        "w-80 border-r flex flex-col bg-white dark:bg-gray-900",
        mobileView !== "threads" && "hidden md:flex"
      )}>
        {/* Header */}
        <div className="h-[49px] px-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{viewLabel}</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              data-testid="btn-filter"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowNewConversation(true)}
              data-testid="btn-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Search */}
        <div className="px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-search-conversations"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1 shrink-0">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs">Filter</span>
            </Button>
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
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-sky-100 text-sky-700 text-sm">
                          {getInitials(conversation.displayName, conversation.phoneNumber)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn("absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center border-2 border-background", getChannelColor(conversation.channel))}>
                        {getChannelIcon(conversation.channel)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {conversation.displayName || (conversation.channel === "live_chat" ? "Website Visitor" : formatForDisplay(conversation.phoneNumber))}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {conversation.lastMessageAt && formatMessageTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.lastMediaUrls && conversation.lastMediaUrls.length > 0 ? (
                              (() => {
                                const url = conversation.lastMediaUrls[0].toLowerCase();
                                if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp') || url.includes('.heic')) {
                                  return 'Image';
                                } else if (url.includes('.pdf')) {
                                  return 'PDF';
                                } else if (url.includes('.mp3') || url.includes('.m4a') || url.includes('.wav') || url.includes('.ogg') || url.includes('.aac') || url.includes('audio')) {
                                  return 'Voice note';
                                } else if (url.includes('.mp4') || url.includes('.mov') || url.includes('.avi') || url.includes('.webm') || url.includes('video')) {
                                  return 'Video';
                                } else if (url.includes('.doc') || url.includes('.docx')) {
                                  return 'Document';
                                } else if (url.includes('.xls') || url.includes('.xlsx')) {
                                  return 'Spreadsheet';
                                } else {
                                  return 'Attachment';
                                }
                              })()
                            ) : (
                              conversation.lastMessage || "No messages yet"
                            )}
                          </p>
                        </div>
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
        "flex-1 flex flex-col min-w-0 relative",
        mobileView !== "messages" && "hidden md:flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-[73px] px-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileView("threads")}
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-sky-100 text-sky-700">
                      {getInitials(selectedConversation.displayName, selectedConversation.phoneNumber)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center border-2 border-background", getChannelColor(selectedConversation.channel))}>
                    {getChannelIcon(selectedConversation.channel)}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">
                    {selectedConversation.displayName || formatForDisplay(selectedConversation.phoneNumber)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.channel === "live_chat" 
                      ? ((selectedConversation as any).email || "No email provided")
                      : formatForDisplay(selectedConversation.phoneNumber)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 text-blue-500 border-gray-300 hover:bg-gray-50 hover:text-blue-600"
                  onClick={() => solveChatMutation.mutate(selectedConversation.id)}
                  disabled={solveChatMutation.isPending || (selectedConversation as any).status === "solved"}
                  data-testid="btn-solve"
                >
                  <CheckCircle className="h-4 w-4" />
                  {solveChatMutation.isPending ? "Solving..." : "Solve"}
                </Button>
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
                        onClick={() => setDeleteDialogOpen(true)}
                        data-testid="btn-delete-conversation"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete conversation</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 pb-36 bg-[#efeae2] dark:bg-[#0b141a]" onMouseUp={handleTextSelection}>
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
                    const isInbound = message.direction === "inbound" && !isNote;
                    
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex group",
                          isOutbound || isNote ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2",
                            isNote
                              ? "bg-yellow-100 border border-yellow-200 rounded-tr-sm"
                              : isOutbound
                                ? "bg-[#d9e8fb] dark:bg-[#2a3942] rounded-tr-sm"
                                : "bg-white dark:bg-gray-800 shadow-sm rounded-tl-sm"
                          )}
                        >
                          {/* Sender name inside bubble for outbound and notes */}
                          {(isOutbound || isNote) && (
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-xs font-medium text-blue-600">
                                {user?.firstName && user?.lastName 
                                  ? `${user.firstName} ${user.lastName}` 
                                  : user?.email?.split('@')[0] || 'You'}
                              </span>
                              {isNote && (
                                <span className="text-xs text-gray-500">(internal note)</span>
                              )}
                            </div>
                          )}
                          
                          {/* Message text */}
                          {message.text && message.text !== "(MMS attachment)" && message.text !== "(attachment)" && (
                            <p className={cn(
                              "text-sm whitespace-pre-wrap",
                              isNote ? "text-yellow-900" : "text-gray-900 dark:text-gray-100"
                            )}>{message.text}</p>
                          )}
                          
                          {/* Media attachments */}
                          {message.mediaUrls && message.mediaUrls.length > 0 && (
                            <div className="flex flex-col gap-2 mt-1">
                              {message.mediaUrls.map((url, idx) => {
                                const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('application/pdf');
                                
                                if (isPdf) {
                                  return (
                                    <div 
                                      key={idx}
                                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800 rounded-lg max-w-[280px]"
                                      data-testid={`pdf-attachment-${idx}`}
                                    >
                                      <div className="flex-shrink-0 w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                                        <FileText className="h-6 w-6 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">PDF Document</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Click to view or download</p>
                                      </div>
                                      <div className="flex gap-1">
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-2 hover:bg-red-200 dark:hover:bg-red-700/50 rounded-lg transition-colors"
                                          title="View PDF"
                                        >
                                          <Eye className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        </a>
                                        <a
                                          href={url}
                                          download
                                          className="p-2 hover:bg-red-200 dark:hover:bg-red-700/50 rounded-lg transition-colors"
                                          title="Download PDF"
                                        >
                                          <Download className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        </a>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <button 
                                    key={idx} 
                                    onClick={() => setPreviewImage(url)}
                                    className="block text-left"
                                    data-testid={`media-attachment-${idx}`}
                                  >
                                    <img 
                                      src={url} 
                                      alt="Attachment" 
                                      className="max-w-[300px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = document.createElement('a');
                                        fallback.href = url;
                                        fallback.target = '_blank';
                                        fallback.rel = 'noopener noreferrer';
                                        fallback.className = 'flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
                                        fallback.innerHTML = `
                                          <svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                          </svg>
                                          <span class="text-sm text-gray-700 dark:text-gray-300">Attachment</span>
                                          <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                          </svg>
                                        `;
                                        target.parentElement!.appendChild(fallback);
                                      }}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Timestamp and status inside bubble at bottom right */}
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <span className="text-[11px] text-gray-500">
                              {new Intl.DateTimeFormat('default', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}
                            </span>
                            {isOutbound && !isNote && (
                              <span className="text-green-500">
                                {message.status === "delivered" ? (
                                  <CheckCheck className="h-3.5 w-3.5" />
                                ) : message.status === "sent" ? (
                                  <CheckCheck className="h-3.5 w-3.5 opacity-50" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Visitor typing preview for live_chat */}
                  {selectedConversation?.channel === "live_chat" && visitorTypingPreview && (
                    <div className="flex justify-start">
                      <div className="max-w-[70%] rounded-2xl px-4 py-2 bg-white dark:bg-gray-800 shadow-sm rounded-tl-sm border border-dashed border-gray-300 dark:border-gray-600">
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic whitespace-pre-wrap">
                          {visitorTypingPreview}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-gray-400">Typing...</span>
                          <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Satisfaction Rating Display for Solved Chats */}
                  {(selectedConversation as any).status === "solved" && (selectedConversation as any).satisfactionRating && (
                    <div className="flex justify-center my-4">
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border px-6 py-4 max-w-sm w-full">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-2">Customer Feedback</p>
                          <div className="flex items-center justify-center gap-2 mb-3">
                            {(selectedConversation as any).satisfactionRating >= 4 ? (
                              <>
                                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                  <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">Good</span>
                              </>
                            ) : (
                              <>
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                  <ThumbsDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <span className="text-sm font-medium text-red-600 dark:text-red-400">Bad</span>
                              </>
                            )}
                          </div>
                          {(selectedConversation as any).satisfactionFeedback && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                              <p className="text-sm italic text-gray-600 dark:text-gray-300">
                                "{(selectedConversation as any).satisfactionFeedback}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Text Selection Popup for Ask Pulse AI */}
            {selectedText && selectionPopupPosition && (
              <div
                className="fixed z-50 transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: selectionPopupPosition.x,
                  top: selectionPopupPosition.y,
                }}
                data-testid="ask-pulse-ai-popup"
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-gray-800 shadow-lg border rounded-full px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={handleAskPulseAI}
                  data-testid="btn-ask-pulse-ai"
                >
                  <Activity className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Ask Pulse AI</span>
                </Button>
              </div>
            )}

            {/* Message Input / Composer - Floating */}
            {/* Show Accept Chat button for waiting live chats */}
            {selectedConversation.channel === "live_chat" && (selectedConversation as any).status === "waiting" ? (
              <div className="absolute bottom-4 left-4 right-4 rounded-lg border bg-white dark:bg-gray-900 shadow-lg p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">New Live Chat Request</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedConversation.displayName || "A visitor"} is waiting for assistance
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 px-8"
                    onClick={() => acceptChatMutation.mutate(selectedConversation.id)}
                    disabled={acceptChatMutation.isPending}
                    data-testid="btn-accept-chat"
                  >
                    {acceptChatMutation.isPending ? (
                      <>
                        <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept Chat
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
            <div className={cn(
              "absolute bottom-4 left-4 right-4 rounded-lg border bg-white dark:bg-gray-900 shadow-lg",
              isInternalNote && "bg-yellow-50 dark:bg-yellow-900/20"
            )}>
              {/* AI Copilot Draft Banner */}
              {copilotDraft && (
                <div 
                  className="mx-4 mt-4 mb-2 p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg"
                  data-testid="copilot-draft-banner"
                >
                  <div className="flex items-start gap-3">
                    <Wand2 className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                          AI Suggestion
                        </span>
                        {copilotSource && (
                          <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300">
                            {copilotSource === "knowledge_base" ? "Knowledge Base" : "General"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap" data-testid="text-copilot-draft">
                        {copilotDraft}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 ml-7">
                    <Button
                      size="sm"
                      onClick={handleInsertDraft}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      data-testid="btn-insert-draft"
                    >
                      Insert
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDismissDraft}
                      className="text-muted-foreground hover:text-foreground"
                      data-testid="btn-dismiss-draft"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {/* Text Input at top */}
              <div className="p-4 pb-2">
                <Textarea
                  ref={textareaRef}
                  placeholder={isInternalNote ? "Add an internal note..." : "Type your text message here"}
                  value={newMessage}
                  onChange={handleMessageChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className={cn(
                    "min-h-[60px] max-h-32 resize-none border-0 shadow-none focus-visible:ring-0 p-0",
                    isInternalNote && "bg-yellow-50"
                  )}
                  data-testid="input-message"
                />
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="px-4 pb-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-md px-3 py-1.5 text-sm"
                        data-testid={`file-preview-${index}`}
                      >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[150px]" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          ({formatFileSize(file.size)})
                        </span>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`btn-remove-file-${index}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom toolbar row: icons | internal note toggle | send button */}
              <div className="px-4 pb-3 flex items-center justify-between">
                {/* Left: Toolbar Icons */}
                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-emoji">
                        <Smile className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-0" side="top" align="start">
                      <Picker 
                        data={data} 
                        onEmojiSelect={(emoji: any) => {
                          setNewMessage(prev => prev + emoji.native);
                        }}
                        theme="light"
                        previewPosition="none"
                        skinTonePosition="search"
                      />
                    </PopoverContent>
                  </Popover>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                    data-testid="input-file-attachment"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="btn-attachment"
                        >
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-8 w-8", copilotDraft && "bg-purple-100 dark:bg-purple-900/30")}
                          onClick={handleAiCopilotClick}
                          disabled={copilotDraftMutation.isPending}
                          data-testid="btn-ai"
                        >
                          <Wand2 className={cn(
                            "h-4 w-4",
                            copilotDraft ? "text-purple-600" : "text-muted-foreground",
                            copilotDraftMutation.isPending && "animate-spin"
                          )} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {copilotDraft ? "Clear AI Suggestion" : "AI Copilot"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Right: Internal Note Toggle + Send Button */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="internal-note"
                      checked={isInternalNote}
                      onCheckedChange={setIsInternalNote}
                      data-testid="switch-internal-note"
                    />
                    <Label htmlFor="internal-note" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                      Internal note
                    </Label>
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() && selectedFiles.length === 0}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="btn-send-message"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
            )}
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
        "w-[420px] border-l flex flex-col bg-muted/30",
        mobileView !== "details" && "hidden lg:flex",
        !selectedConversation && "hidden"
      )}>
        {selectedConversation && (
          <>
            <div className="h-[73px] px-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-8">
                <button 
                  className={cn(
                    "text-sm font-medium transition-colors pb-2 -mb-[1px] border-b-2",
                    rightPanelTab === "details" 
                      ? "text-foreground border-blue-500" 
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  )}
                  onClick={() => setRightPanelTab("details")}
                  data-testid="btn-tab-details"
                >
                  Details
                </button>
                <button 
                  className={cn(
                    "text-sm font-medium flex items-center gap-1.5 transition-colors pb-2 -mb-[1px] border-b-2",
                    rightPanelTab === "pulse-ai" 
                      ? "text-foreground border-blue-500" 
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  )}
                  onClick={() => setRightPanelTab("pulse-ai")}
                  data-testid="btn-tab-pulse-ai"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Pulse AI
                </button>
              </div>
              <div className="flex items-center gap-1">
                {rightPanelTab === "details" && (
                  <>
                    {isEditingDetails ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={cancelEditing} data-testid="btn-cancel-edit">
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveContactEdit} data-testid="btn-save-edit">
                          Save
                        </Button>
                      </>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditing} data-testid="btn-edit-details">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="btn-search-details">
                            <Search className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Search</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                  onClick={() => setMobileView("messages")}
                  data-testid="btn-close-details"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Details Tab Content */}
            {rightPanelTab === "details" && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Live Chat Info - Only for live_chat channel */}
                {selectedConversation.channel === "live_chat" && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setContactInfoOpen(!contactInfoOpen)}
                      className="flex items-center justify-between w-full text-left"
                      data-testid="btn-toggle-live-chat-info"
                    >
                      <h4 className="text-sm font-medium text-muted-foreground">Live chat</h4>
                      {contactInfoOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {contactInfoOpen && (
                      <div className="space-y-3" data-testid="section-live-chat-info">
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Status</span>
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs",
                              (selectedConversation as any).status === "waiting" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                              (selectedConversation as any).status === "open" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                              (selectedConversation as any).status === "solved" && "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            )}
                          >
                            {(selectedConversation as any).status === "waiting" ? "Waiting" : 
                             (selectedConversation as any).status === "open" ? "Open" : 
                             (selectedConversation as any).status?.charAt(0).toUpperCase() + (selectedConversation as any).status?.slice(1)}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Assignee</span>
                          <span className="text-sm font-medium">
                            {selectedConversation.assignedTo ? "Assigned" : "Unassigned"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Location</span>
                          <span className="text-sm font-medium flex items-center gap-1">
                            {(selectedConversation as any).visitorCountry === "United States" ? "🇺🇸 " : 
                             (selectedConversation as any).visitorCountry === "Mexico" ? "🇲🇽 " :
                             (selectedConversation as any).visitorCountry === "Canada" ? "🇨🇦 " :
                             (selectedConversation as any).visitorCountry === "Spain" ? "🇪🇸 " :
                             (selectedConversation as any).visitorCountry === "United Kingdom" ? "🇬🇧 " : ""}
                            {(selectedConversation as any).visitorCity || (selectedConversation as any).visitorState || (selectedConversation as any).visitorCountry ? (
                              <>
                                {(selectedConversation as any).visitorCity && `${(selectedConversation as any).visitorCity}, `}
                                {(selectedConversation as any).visitorState && `${(selectedConversation as any).visitorState}, `}
                                {(selectedConversation as any).visitorCountry || ""}
                              </>
                            ) : (
                              "Unknown"
                            )}
                          </span>
                        </div>
                        {(selectedConversation as any).visitorIpAddress && (
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">IP address</span>
                            <span className="text-sm font-medium font-mono text-xs">
                              {(selectedConversation as any).visitorIpAddress}
                            </span>
                          </div>
                        )}
                        {(selectedConversation as any).visitorCurrentUrl && (
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">URL</span>
                            <a 
                              href={(selectedConversation as any).visitorCurrentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline truncate max-w-[200px]"
                              title={(selectedConversation as any).visitorCurrentUrl}
                            >
                              {(selectedConversation as any).visitorCurrentUrl.replace(/^https?:\/\//, '').substring(0, 30)}...
                            </a>
                          </div>
                        )}
                        {(selectedConversation as any).visitorBrowser && (
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Browser</span>
                            <span className="text-sm font-medium">{(selectedConversation as any).visitorBrowser}</span>
                          </div>
                        )}
                        {(selectedConversation as any).visitorOs && (
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">OS</span>
                            <span className="text-sm font-medium">{(selectedConversation as any).visitorOs}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Chat ID</span>
                          <span className="text-sm font-medium font-mono">{selectedConversation.id.substring(0, 8)}</span>
                        </div>
                        {(selectedConversation as any).createdAt && (
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Created</span>
                            <span className="text-sm font-medium">
                              {format(new Date((selectedConversation as any).createdAt), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Contact Info - Collapsible */}
                <div className="space-y-4">
                  <button 
                    onClick={() => setContactInfoOpen(!contactInfoOpen)}
                    className="flex items-center justify-between w-full text-left"
                    data-testid="btn-toggle-contact-info"
                  >
                    <h4 className="text-sm font-medium text-muted-foreground">{selectedConversation.channel === "live_chat" ? "Contact" : "Contact info"}</h4>
                    {contactInfoOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {contactInfoOpen && (
                    <div className="space-y-3" data-testid="section-contact-info">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Full name</p>
                          {isEditingDetails ? (
                            <Input
                              value={editForm.displayName}
                              onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                              onKeyDown={handleEditKeyDown}
                              className="h-7 text-sm"
                              data-testid="input-fullname"
                            />
                          ) : (
                            <p className="text-sm font-medium" data-testid="text-fullname">
                              {matchedContact?.displayName || selectedConversation.displayName || "Unknown"}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedConversation.channel === "live_chat" ? (
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-orange-500 shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Channel</p>
                            <p className="text-sm font-medium" data-testid="text-phone">
                              Live Chat
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium" data-testid="text-phone">
                              {formatForDisplay(selectedConversation.phoneNumber)}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Email</p>
                          {isEditingDetails ? (
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              onKeyDown={handleEditKeyDown}
                              className="h-7 text-sm"
                              placeholder="email@example.com"
                              data-testid="input-email"
                            />
                          ) : (
                            <p className="text-sm font-medium" data-testid="text-email">
                              {selectedConversation.email || matchedContact?.email || "—"}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedConversation.channel !== "live_chat" && (
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">
                              {selectedConversation.channel === "imessage" ? "iMessage" : "SMS"}
                            </p>
                            <p className="text-sm font-medium" data-testid="text-channel-number">
                              {formatForDisplay(selectedConversation.phoneNumber)}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Job title</p>
                          {isEditingDetails ? (
                            <Input
                              value={editForm.jobTitle}
                              onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                              onKeyDown={handleEditKeyDown}
                              className="h-7 text-sm"
                              placeholder="Enter job title"
                              data-testid="input-jobtitle"
                            />
                          ) : (
                            <p className="text-sm font-medium" data-testid="text-jobtitle">
                              {selectedConversation.jobTitle || "—"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Organization</p>
                          {isEditingDetails ? (
                            <Input
                              value={editForm.organization}
                              onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                              onKeyDown={handleEditKeyDown}
                              className="h-7 text-sm"
                              placeholder="Enter organization"
                              data-testid="input-organization"
                            />
                          ) : (
                            <p className="text-sm font-medium" data-testid="text-organization">
                              {selectedConversation.organization || matchedContact?.companyName || "—"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <SiFacebook className="h-4 w-4 text-blue-600 cursor-pointer hover:opacity-80" data-testid="icon-facebook" />
                          <SiInstagram className="h-4 w-4 text-pink-600 cursor-pointer hover:opacity-80" data-testid="icon-instagram" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Social media</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-social">Not connected</p>
                        </div>
                      </div>
                      {!isEditingDetails && (
                        <button 
                          className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                          data-testid="btn-show-more-contact"
                        >
                          Show more
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Insights - Collapsible */}
                <div className="space-y-4">
                  <button 
                    onClick={() => setInsightsOpen(!insightsOpen)}
                    className="flex items-center justify-between w-full text-left"
                    data-testid="btn-toggle-insights"
                  >
                    <h4 className="text-sm font-medium text-muted-foreground">Insights</h4>
                    {insightsOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {insightsOpen && (
                    <div className="space-y-3" data-testid="section-insights">
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

                      {/* Contact Owner */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[8px] bg-gray-200">?</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs text-muted-foreground">Contact owner</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-contact-owner">Unassigned</p>
                        </div>
                      </div>

                      {/* Lists */}
                      <div className="flex items-center gap-3">
                        <List className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Lists</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-lists">—</p>
                        </div>
                      </div>

                      {/* Segments */}
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Segments</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-segments">—</p>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex items-center gap-3">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Tags</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-tags">—</p>
                        </div>
                      </div>

                      {/* Interactions */}
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Interactions</p>
                          <p className="text-sm font-medium" data-testid="text-interactions">
                            {messagesData?.messages?.length || 0}
                          </p>
                        </div>
                      </div>

                      {/* Last interaction */}
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Last interaction</p>
                          <p className="text-sm font-medium" data-testid="text-last-interaction">
                            {lastInteraction 
                              ? format(new Date(lastInteraction.createdAt), "MMM d, yyyy h:mm a")
                              : "—"
                            }
                          </p>
                        </div>
                      </div>

                      {/* Last outbound */}
                      <div className="flex items-center gap-3">
                        <Send className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Last outbound</p>
                          <p className="text-sm font-medium" data-testid="text-last-outbound">
                            {lastOutboundMessage 
                              ? format(new Date(lastOutboundMessage.createdAt), "MMM d, yyyy h:mm a")
                              : "—"
                            }
                          </p>
                        </div>
                      </div>

                      {/* Last inbound */}
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Last inbound</p>
                          <p className="text-sm font-medium" data-testid="text-last-inbound">
                            {lastInboundMessage 
                              ? format(new Date(lastInboundMessage.createdAt), "MMM d, yyyy h:mm a")
                              : "—"
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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
            )}

            {/* Pulse AI Tab Content */}
            {rightPanelTab === "pulse-ai" && (
              <div className="flex-1 flex flex-col" data-testid="pulse-ai-panel">
                {/* Messages Area */}
                <ScrollArea className="flex-1" data-testid="pulse-ai-messages">
                  <div className="p-4 space-y-4">
                    {pulseAiMessages.length === 0 ? (
                      <div className="flex flex-col items-center pt-16">
                        {/* Pulse Icon */}
                        <Activity className="h-10 w-10 text-violet-500 mb-4" />
                        
                        {/* Title */}
                        <h3 className="text-base font-semibold mb-1">Hi, I'm Pulse AI</h3>
                        <p className="text-sm text-muted-foreground mb-6">Ask me anything about this conversation.</p>
                        
                        {/* Instructions Card */}
                        <div className="bg-violet-50 dark:bg-violet-950/30 rounded-lg p-4 w-full max-w-[320px]">
                          <p className="text-sm text-muted-foreground mb-3">To start a conversation with a bot</p>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                              <span className="text-violet-500 mt-0.5">•</span>
                              <span><strong className="font-medium">Highlight any text</strong> you're interested in and click "Ask Pulse AI"</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-violet-500 mt-0.5">•</span>
                              <span>Or, just <strong className="font-medium">type your question</strong> in the field below and submit.</span>
                            </li>
                          </ul>
                        </div>
                        
                        {/* Manage Sources Link */}
                        <Link 
                          href="/settings/pulse-ai" 
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-6 inline-flex items-center gap-1.5"
                          data-testid="link-manage-sources"
                        >
                          <Settings className="h-4 w-4" />
                          Manage sources
                        </Link>
                      </div>
                    ) : (
                      pulseAiMessages.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "flex gap-2",
                            msg.role === "user" ? "justify-end" : "justify-start"
                          )}
                          data-testid={`pulse-ai-message-${idx}`}
                        >
                          {msg.role === "assistant" && (
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                              <Activity className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <div 
                            className={cn(
                              "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                              msg.role === "user" 
                                ? "bg-blue-600 text-white" 
                                : "bg-muted"
                            )}
                          >
                            {msg.isLoading ? (
                              <div className="flex items-center gap-2">
                                <LoadingSpinner fullScreen={false} />
                                <span className="text-muted-foreground text-xs">Thinking...</span>
                              </div>
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.role === "assistant" && msg.content && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 h-7 text-xs text-violet-600 hover:text-violet-700 px-2"
                                    onClick={() => handleInsertPulseAiMessage(msg.content)}
                                    data-testid={`btn-insert-message-${idx}`}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Insert and edit
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                
                {/* Input Area */}
                <div className="p-4 border-t space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask Pulse AI a question..."
                      value={pulseAiInput}
                      onChange={(e) => setPulseAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handlePulseAiSubmit();
                        }
                      }}
                      disabled={pulseAiAskMutation.isPending}
                      data-testid="input-pulse-ai"
                    />
                    <Button
                      onClick={handlePulseAiSubmit}
                      disabled={!pulseAiInput.trim() || pulseAiAskMutation.isPending}
                      className="bg-violet-600 hover:bg-violet-700"
                      data-testid="btn-pulse-ai-send"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Start New Conversation Button */}
                  {pulseAiMessages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setPulseAiMessages([]);
                        setPulseAiInput("");
                      }}
                      data-testid="btn-pulse-ai-new-conversation"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Start new conversation
                    </Button>
                  )}
                </div>
              </div>
            )}
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

      {/* Image Preview Modal - fits exactly to image size */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewImage(null)}
          data-testid="image-preview-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setPreviewImage(null)}
            data-testid="btn-close-preview"
          >
            <X className="h-6 w-6" />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="image-preview"
          />
        </div>
      )}

      {/* Delete Conversation Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedConversationId) {
                  deleteConversationMutation.mutate(selectedConversationId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete"
            >
              {deleteConversationMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Start Chat with Visitor Dialog */}
      <AlertDialog open={startChatDialogOpen} onOpenChange={setStartChatDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Start Chat with Visitor</AlertDialogTitle>
            <AlertDialogDescription>
              Send a proactive message to this visitor. They will see your message in the chat widget on their screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Type your message..."
              value={startChatMessage}
              onChange={(e) => setStartChatMessage(e.target.value)}
              className="min-h-[100px] resize-none"
              data-testid="input-start-chat-message"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              data-testid="btn-cancel-start-chat"
              onClick={() => {
                setStartChatMessage("");
                setSelectedVisitor(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={() => {
                if (selectedVisitor && startChatMessage.trim()) {
                  startChatWithVisitorMutation.mutate({
                    visitorId: selectedVisitor.visitorId,
                    message: startChatMessage.trim(),
                    widgetId: selectedVisitor.widgetId,
                  });
                }
              }}
              disabled={!startChatMessage.trim() || startChatWithVisitorMutation.isPending}
              data-testid="btn-confirm-start-chat"
            >
              {startChatWithVisitorMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
      )}
    </MessengerLayout>
  );
}
