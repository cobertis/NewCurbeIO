import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { WhatsAppTemplatePreview, extractTemplateVariables, buildRenderedText } from "@/components/whatsapp-template-preview";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatForDisplay } from "@shared/phone";
import { MessengerLayout, type MessengerView, type LifecycleStage, useMessengerSidebar } from "@/components/messenger-layout";
import { Filter, PanelLeft } from "lucide-react";
import { 
  Search, 
  Phone,
  PhoneMissed,
  PhoneIncoming,
  PhoneOff,
  Plus, 
  Send, 
  Paperclip, 
  Trash2,
  Target,
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
  Settings,
  Gift,
  Heart,
  Lightbulb,
  AlertCircle,
  Check,
  Play,
  Mic,
  Square,
  Trash2 as TrashIcon,
  MoreVertical
} from "lucide-react";
import { Link } from "wouter";
import { SiFacebook, SiInstagram, SiTelegram, SiWhatsapp, SiImessage, SiGooglemessages, SiApple, SiMessenger } from "react-icons/si";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function ExpandSidebarButton() {
  const sidebarContext = useMessengerSidebar();
  if (!sidebarContext || !sidebarContext.sidebarHidden) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => sidebarContext.setSidebarHidden(false)}
            data-testid="btn-show-sidebar"
          >
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Show sidebar</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
  status?: "open" | "pending" | "solved" | "snoozed" | "archived" | "waiting";
  assignedTo?: string | null;
  tags?: string[] | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  autopilotEnabled?: boolean | null;
  copilotEnabled?: boolean | null;
  visitorIpAddress?: string | null;
  visitorCity?: string | null;
  visitorState?: string | null;
  visitorCountry?: string | null;
  visitorCurrentUrl?: string | null;
  visitorBrowser?: string | null;
  visitorOs?: string | null;
  conversationExpiresAt?: string | null;
}

const getChannelIcon = (channel?: string) => {
  switch (channel) {
    case "facebook":
      return <SiFacebook className="h-2.5 w-2.5 text-white" />;
    case "instagram":
      return <SiInstagram className="h-2.5 w-2.5 text-white" />;
    case "imessage":
      return <SiImessage className="h-2.5 w-2.5 text-white" />;
    case "telegram":
      return <SiTelegram className="h-2.5 w-2.5 text-white" />;
    case "rcs":
      return <SiGooglemessages className="h-2.5 w-2.5 text-white" />;
    case "sms":
      return <MessageSquare className="h-2.5 w-2.5 text-white" />;
    case "live_chat":
      return <Globe className="h-2.5 w-2.5 text-white" />;
    case "whatsapp":
      return <SiWhatsapp className="h-2.5 w-2.5 text-white" />;
    default:
      return <MessageSquare className="h-2.5 w-2.5 text-white" />;
  }
};

const getChannelColor = (channel?: string) => {
  switch (channel) {
    case "facebook":
      return "bg-blue-600";
    case "instagram":
      return "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600";
    case "imessage":
      return "bg-blue-500";
    case "telegram":
      return "bg-sky-500";
    case "rcs":
      return "bg-purple-500";
    case "sms":
      return "bg-gray-500";
    case "live_chat":
      return "bg-orange-400";
    case "whatsapp":
      return "bg-emerald-500";
    default:
      return "bg-gray-500";
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

export default function InboxPage() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<MessengerView>("open");
  const [activeLifecycle, setActiveLifecycle] = useState<LifecycleStage | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("threads");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState("");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [newConversationChannel, setNewConversationChannel] = useState<"sms" | "whatsapp">("sms");
  const [selectedWaConnection, setSelectedWaConnection] = useState<string>("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [chatInfoOpen, setChatInfoOpen] = useState(true);
  const [contactInfoOpen, setContactInfoOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [pulseAiSettingsOpen, setPulseAiSettingsOpen] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: "",
    email: "",
    jobTitle: "",
    organization: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [audioVolume, setAudioVolume] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [copilotDraft, setCopilotDraft] = useState<string | null>(null);
  const [copilotSource, setCopilotSource] = useState<"knowledge_base" | "general" | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"details" | "pulse-ai">("details");
  const [pulseAiMessages, setPulseAiMessages] = useState<Array<{role: "user" | "assistant", content: string, isLoading?: boolean}>>([]);
  const [pulseAiInput, setPulseAiInput] = useState("");
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionPopupPosition, setSelectionPopupPosition] = useState<{ x: number, y: number } | null>(null);
  const [threadSummaryOpen, setThreadSummaryOpen] = useState(false);
  const [threadSummaryData, setThreadSummaryData] = useState<{
    summary: string;
    suggestions: Array<{ type: string; text: string }>;
  } | null>(null);
  const [voiceCallDialogOpen, setVoiceCallDialogOpen] = useState(false);
  const [voiceCallText, setVoiceCallText] = useState("Need to talk? Press the button below to call us.");
  const [voiceCallButtonText, setVoiceCallButtonText] = useState("Call Now");
  const [voiceCallTtl, setVoiceCallTtl] = useState(60);
  
  // Emoji picker state
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  
  // Lifecycle options matching messenger-layout
  const lifecycleOptions = [
    { id: "new_lead", label: "New Lead", emoji: "🆕", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { id: "hot_lead", label: "Hot Lead", emoji: "🔥", color: "bg-orange-100 text-orange-700 border-orange-200" },
    { id: "payment", label: "Payment", emoji: "🤑", color: "bg-green-100 text-green-700 border-green-200" },
    { id: "customer", label: "Customer", emoji: "🤩", color: "bg-purple-100 text-purple-700 border-purple-200" },
  ];
  
  // Lifecycle popover state
  const [lifecyclePopoverOpen, setLifecyclePopoverOpen] = useState(false);
  
  // Filter state for sidebar
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filterShow, setFilterShow] = useState<"all" | "open" | "closed" | "snoozed">("open");
  const [filterSortBy, setFilterSortBy] = useState<"newest" | "oldest" | "longest_open" | "shortest_open">("newest");
  const [filterUnreplied, setFilterUnreplied] = useState(false);
  
  // WhatsApp Template Picker state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplateForSend, setSelectedTemplateForSend] = useState<any>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<number, string>>({});
  // New conversation WhatsApp template state
  const [newConvTemplate, setNewConvTemplate] = useState<any>(null);
  const [newConvVars, setNewConvVars] = useState<Record<string, string>>({});
  
  // WhatsApp 24-hour window countdown
  const [waWindowTimeLeft, setWaWindowTimeLeft] = useState<string | null>(null);
  const [waWindowExpired, setWaWindowExpired] = useState(false);
  
  // Typing indicator state for incoming typing signals
  const [contactTyping, setContactTyping] = useState<{ conversationId: string; isTyping: boolean } | null>(null);
  const contactTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pulseAiMessagesEndRef = useRef<HTMLDivElement>(null);
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

  // WhatsApp connection status for new conversation channel selection
  const { data: whatsappStatusData } = useQuery<{ 
    connected: boolean; 
    phoneNumber?: string; 
    displayName?: string;
  }>({
    queryKey: ["/api/integrations/whatsapp/status"],
    enabled: isAuthenticated,
  });
  const whatsappConnected = whatsappStatusData?.connected || false;
  const whatsappPhoneNumber = whatsappStatusData?.phoneNumber;
  const whatsappDisplayName = whatsappStatusData?.displayName;


  // Query to get all active WhatsApp connections for company
  const { data: waConnectionsData } = useQuery<{
    connections: Array<{
      id: string;
      phoneNumberE164: string;
      displayName: string;
      wabaId: string;
      phoneNumberId: string;
    }>;
  }>({
    queryKey: ["/api/integrations/whatsapp/connections"],
    enabled: isAuthenticated,
  });
  const waConnections = waConnectionsData?.connections || [];
  const { data: conversationsData, isLoading: loadingConversations } = useQuery<{ conversations: TelnyxConversation[] }>({
    queryKey: ["/api/inbox/conversations"],
    enabled: isAuthenticated,
    staleTime: 30000,
  });
  const conversations = conversationsData?.conversations || [];

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const { data: messagesData, isLoading: loadingMessages } = useQuery<{ messages: TelnyxMessage[] }>({
    queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`],
    enabled: !!selectedConversationId,
  });
  const messages = messagesData?.messages || [];

  const { data: pulseAiMessagesData } = useQuery<Array<{id: string, role: string, content: string, createdAt: string}>>({
    queryKey: ['/api/ai/conversations', selectedConversationId, 'chat-messages'],
    enabled: !!selectedConversationId,
  });

  // Query for pending AI autopilot approvals
  const { data: pendingApprovalsData } = useQuery<{ pending: Array<{
    id: string;
    conversationId: string;
    outputText: string;
    confidence: string;
    needsHuman: boolean;
    createdAt: string;
  }> }>({
    queryKey: ['/api/ai/autopilot/pending'],
    enabled: isAuthenticated,
    refetchInterval: 10000, // Poll every 10 seconds
  });
  const pendingApprovals = pendingApprovalsData?.pending || [];
  
  // Get pending approval for current conversation
  const currentConversationPendingApproval = useMemo(() => {
    return pendingApprovals.find(p => p.conversationId === selectedConversationId);
  }, [pendingApprovals, selectedConversationId]);

  const { data: companyUsersData } = useQuery<{ users: UserType[] }>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated,
  });
  const companyUsers = companyUsersData?.users || [];

  const getUserDisplayName = (userId: string | null | undefined): string => {
    if (!userId) return "Unknown";
    const foundUser = companyUsers.find(u => String(u.id) === userId);
    if (!foundUser) return "Unknown";
    const name = [foundUser.firstName, foundUser.lastName].filter(Boolean).join(" ");
    return name || foundUser.email || "Unknown";
  };

  const getUserInitial = (userId: string | null | undefined): string => {
    if (!userId) return "?";
    const foundUser = companyUsers.find(u => String(u.id) === userId);
    if (!foundUser) return "?";
    return foundUser.firstName?.charAt(0) || foundUser.lastName?.charAt(0) || foundUser.email?.charAt(0) || "?";
  };

  const getUserAvatar = (userId: string | null | undefined): string | null => {
    if (!userId) return null;
    const foundUser = companyUsers.find(u => String(u.id) === userId);
    return foundUser?.avatar || null;
  };

  const updateAiSettingsMutation = useMutation({
    mutationFn: async ({ conversationId, autopilotEnabled, copilotEnabled }: { 
      conversationId: string; 
      autopilotEnabled?: boolean; 
      copilotEnabled?: boolean 
    }) => {
      return apiRequest("PATCH", `/api/conversations/${conversationId}/ai-settings`, {
        autopilotEnabled,
        copilotEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      toast({
        title: "AI Settings Updated",
        description: "Conversation AI settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update AI settings",
        variant: "destructive",
      });
    },
  });

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
    if (msg.type === 'imessage_typing') {
      // Handle typing indicator from contact
      const conversationId = msg.conversationId;
      const isTyping = msg.type === 'imessage_typing' && msg.isTyping !== false;
      if (conversationId) {
        setContactTyping({ conversationId, isTyping });
        // Auto-clear typing after 5 seconds
        if (contactTypingTimeoutRef.current) {
          clearTimeout(contactTypingTimeoutRef.current);
        }
        contactTypingTimeoutRef.current = setTimeout(() => {
          setContactTyping(null);
        }, 5000);
      }
    } else if (msg.type === 'contact_updated') {
      // Refresh conversations to get updated contact info
      queryClient.refetchQueries({ queryKey: ["/api/inbox/conversations"] });
      if (selectedConversationId) {
        queryClient.refetchQueries({ 
          queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] 
        });
      }
    } else if (
      msg.type === 'telnyx_message' || 
      msg.type === 'new_message' || 
      msg.type === 'conversation_update' || 
      msg.type === 'imessage_message' ||
      msg.type === 'imessage_update' ||
      msg.type === 'whatsapp_message' ||
      msg.type === 'whatsapp_chat_update' ||
      msg.type === 'whatsapp_event' ||
      msg.type === 'inbox_message' ||
      msg.type === 'email_received'
    ) {
      // Force immediate refetch for real-time updates
      queryClient.refetchQueries({ queryKey: ["/api/inbox/conversations"] });
      // Always refresh messages for the selected conversation on any update
      if (selectedConversationId) {
        queryClient.refetchQueries({ 
          queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] 
        });
      }
    }
  });

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
    setPulseAiInput("");
  }, [selectedConversationId]);

  // Mark conversation as read when selected
  useEffect(() => {
    if (!selectedConversation || selectedConversation.unreadCount === 0) return;
    
    const markAsRead = async () => {
      try {
        // For iMessage, also send read receipt to BlueBubbles
        if (selectedConversation.channel === "imessage") {
          await fetch(`/api/imessage/conversations/${selectedConversation.id}/read`, {
            method: "POST",
            credentials: "include",
          }).catch(err => console.error("Failed to send iMessage read receipt:", err));
        }
        await apiRequest("PATCH", `/api/inbox/conversations/${selectedConversation.id}`, {
          unreadCount: 0
        });
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      } catch (error) {
        console.error("Failed to mark conversation as read:", error);
      }
    };
    
    markAsRead();
  }, [selectedConversation?.id, selectedConversation?.unreadCount]);

  // Sync local Pulse AI messages with database data
  useEffect(() => {
    if (pulseAiMessagesData) {
      setPulseAiMessages(
        pulseAiMessagesData.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        }))
      );
    } else {
      setPulseAiMessages([]);
    }
  }, [pulseAiMessagesData]);

  // WhatsApp 24-hour window countdown timer
  // Uses Meta's expiration_timestamp if available, otherwise calculates from last inbound message
  useEffect(() => {
    if (selectedConversation?.channel !== "whatsapp") {
      setWaWindowTimeLeft(null);
      setWaWindowExpired(false);
      return;
    }

    // Find the last inbound message timestamp to estimate window expiration
    const lastInboundMessage = messages
      .filter(m => m.direction === "inbound")
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];

    // Use Meta's exact expiration if available, otherwise estimate from last inbound message (+24h)
    let expiresAtTime: number | null = null;
    
    if (selectedConversation.conversationExpiresAt) {
      expiresAtTime = new Date(selectedConversation.conversationExpiresAt).getTime();
    } else if (lastInboundMessage?.createdAt) {
      // Estimate: 24 hours from last customer message
      expiresAtTime = new Date(lastInboundMessage.createdAt).getTime() + (24 * 60 * 60 * 1000);
    }

    if (!expiresAtTime) {
      // No inbound messages - window never opened
      setWaWindowExpired(true);
      setWaWindowTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = expiresAtTime! - now;

      if (diff <= 0) {
        setWaWindowExpired(true);
        setWaWindowTimeLeft(null);
        return;
      }

      setWaWindowExpired(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Always show hours:minutes:seconds format for real-time countdown
      const pad = (n: number) => n.toString().padStart(2, '0');
      setWaWindowTimeLeft(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [selectedConversation?.channel, selectedConversation?.conversationExpiresAt, messages]);

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
        title: "Send failed",
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
      setNewConversationChannel("sms");
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

  const createWhatsAppConversationMutation = useMutation({
    mutationFn: async ({ phoneNumber, text }: { phoneNumber: string; text: string }) => {
      return apiRequest("POST", "/api/inbox/conversations/whatsapp", { phoneNumber, text });
    },
    onSuccess: (data: any) => {
      setShowNewConversation(false);
      setNewConversationPhone("");
      setNewMessage("");
      setNewConversationChannel("sms");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      if (data.conversationId) {
        setSelectedConversationId(data.conversationId);
      }
      toast({
        title: "Message sent via WhatsApp",
        description: "Your conversation has been started",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start WhatsApp conversation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const createWhatsAppWithTemplateMutation = useMutation({
    mutationFn: async ({ phoneNumber, templateName, languageCode, components, renderedText }: {
      phoneNumber: string;
      templateName: string;
      languageCode: string;
      components?: Array<any>;
      renderedText: string;
    }) => {
      return apiRequest("POST", "/api/inbox/conversations/whatsapp/template", {
        phoneNumber,
        templateName,
        languageCode,
        components,
        renderedText,
      });
    },
    onSuccess: (data: any) => {
      setShowNewConversation(false);
      setNewConversationPhone("");
      setNewMessage("");
      setNewConversationChannel("sms");
      setNewConvTemplate(null);
      setNewConvVars({});
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      if (data.conversationId) {
        setSelectedConversationId(data.conversationId);
      }
      toast({
        title: "Template sent via WhatsApp",
        description: "Your conversation has been started",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send WhatsApp template",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateConversationMutation = useMutation({
    mutationFn: async ({ conversationId, displayName, email, jobTitle, organization, status }: { conversationId: string; displayName: string; email: string; jobTitle: string; organization: string; status?: string }) => {
      return apiRequest("PATCH", `/api/inbox/conversations/${conversationId}`, { displayName, email, jobTitle, organization, status });
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      setEditingField(null);
      if (variables.status) {
        toast({
          title: "Status updated",
          description: `Conversation marked as ${variables.status === "solved" ? "Solved" : "Open"}.`,
        });
        if (variables.status === "solved" && activeView !== "solved") {
          setSelectedConversationId(null);
        }
      } else {
        toast({
          title: "Contact updated",
          description: "Contact information has been saved successfully.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const assignConversationMutation = useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string | null }) => {
      return apiRequest("PATCH", `/api/inbox/conversations/${conversationId}`, { assignedTo: userId });
    },
    onMutate: async ({ conversationId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/conversations"] });
      const previousConversations = queryClient.getQueryData(["/api/inbox/conversations"]);
      queryClient.setQueryData(["/api/inbox/conversations"], (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((c: any) =>
            c.id === conversationId ? { ...c, assignedTo: userId } : c
          ),
        };
      });
      return { previousConversations };
    },
    onSuccess: async (_, variables) => {
      const assigneeName = variables.userId ? getUserDisplayName(variables.userId) : "Unassigned";
      toast({
        title: "Assignee updated",
        description: variables.userId ? `Conversation assigned to ${assigneeName}.` : "Conversation is now unassigned.",
      });
    },
    onError: (error: any, _, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(["/api/inbox/conversations"], context.previousConversations);
      }
      toast({
        title: "Failed to assign",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
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

  const sendVoiceCallButtonMutation = useMutation({
    mutationFn: async ({ conversationId, text, buttonText, ttlMinutes }: { 
      conversationId: string; 
      text?: string; 
      buttonText?: string; 
      ttlMinutes?: number 
    }) => {
      return apiRequest("POST", `/api/inbox/conversations/${conversationId}/voice-call-button`, {
        text,
        buttonText,
        ttlMinutes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      if (selectedConversationId) {
        queryClient.invalidateQueries({ queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] });
      }
      setVoiceCallDialogOpen(false);
      toast({ title: "Call button sent", description: "Voice call button has been sent to the customer." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send call button", description: error.message, variant: "destructive" });
    }
  });

  // Get wabaId from selected WhatsApp connection (for new conversation) or from existing conversation's connection
  const selectedWaConnectionData = waConnections.find(c => c.id === selectedWaConnection);
  const activeWabaId = selectedWaConnectionData?.wabaId || (waConnections.length > 0 ? waConnections[0]?.wabaId : null);

  // WhatsApp templates query - fetch approved templates for selected connection
  const { data: whatsappTemplatesData } = useQuery<{ templates: Array<{
    id: string;
    name: string;
    status: string;
    category: string;
    language: string;
    components: Array<{ type: string; text?: string; format?: string; buttons?: Array<{ type: string; text: string; url?: string }> }>;
  }> }>({
    queryKey: ["/api/whatsapp/meta/templates", activeWabaId],
    queryFn: () => fetch(`/api/whatsapp/meta/templates${activeWabaId ? `?wabaId=${activeWabaId}` : ""}`).then(r => r.json()),
    enabled: isAuthenticated && (selectedConversation?.channel === "whatsapp" || (newConversationChannel === "whatsapp" && !!activeWabaId)),
  });
  const approvedTemplates = (whatsappTemplatesData?.templates || []).filter(t => t.status === "APPROVED");

  // Send WhatsApp template mutation
  const sendTemplateMutation = useMutation({
    mutationFn: async ({ conversationId, templateName, languageCode, components, renderedText }: {
      conversationId: string;
      templateName: string;
      languageCode: string;
      components?: Array<{ type: string; parameters: Array<{ type: string; text: string }> }>;
      renderedText: string;
    }) => {
      return apiRequest("POST", "/api/whatsapp/meta/templates/send", {
        conversationId,
        templateName,
        languageCode,
        renderedText,
        components,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      if (selectedConversationId) {
        queryClient.invalidateQueries({ queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] });
      }
      setTemplatePickerOpen(false);
      setSelectedTemplateForSend(null);
      setTemplateVariables({});
      toast({ title: "Template sent", description: "WhatsApp template message sent successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send template", description: error.message || "Please try again", variant: "destructive" });
    }
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

  const updateLifecycleMutation = useMutation({
    mutationFn: async ({ conversationId, lifecycleStage }: { conversationId: string; lifecycleStage: string }) => {
      return apiRequest("PATCH", `/api/inbox/conversations/${conversationId}`, { lifecycleStage });
    },
    onMutate: async ({ conversationId, lifecycleStage }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/conversations"] });
      const previousData = queryClient.getQueryData(["/api/inbox/conversations"]);
      queryClient.setQueryData(["/api/inbox/conversations"], (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((conv: any) =>
            conv.id === conversationId ? { ...conv, lifecycleStage } : conv
          ),
        };
      });
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      setLifecyclePopoverOpen(false);
      toast({
        title: "Lifecycle updated",
        description: "Contact lifecycle stage has been updated.",
      });
    },
    onError: (error: any, _variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/inbox/conversations"], context.previousData);
      }
      toast({
        title: "Failed to update lifecycle",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const threadSummaryMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest("POST", "/api/ai/thread-summary", { conversationId });
      return res;
    },
    onSuccess: (data: { summary: string; suggestions: Array<{ type: string; text: string }> }) => {
      setThreadSummaryData(data);
      setThreadSummaryOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate summary",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Approve pending AI response
  const approveAiResponseMutation = useMutation({
    mutationFn: async (runId: string) => {
      return apiRequest("POST", `/api/ai/autopilot/approve/${runId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/autopilot/pending'] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/conversations"] });
      if (selectedConversationId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/inbox/conversations/${selectedConversationId}/messages`] 
        });
      }
      toast({
        title: "Response Approved",
        description: "The AI response has been sent to the customer.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Reject pending AI response
  const rejectAiResponseMutation = useMutation({
    mutationFn: async ({ runId, reason }: { runId: string; reason?: string }) => {
      return apiRequest("POST", `/api/ai/autopilot/reject/${runId}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/autopilot/pending'] });
      toast({
        title: "Response Rejected",
        description: "The AI response has been dismissed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject",
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

  const savePulseAiMessage = async (conversationId: string, role: "user" | "assistant", content: string) => {
    try {
      await apiRequest("POST", `/api/ai/conversations/${conversationId}/chat-messages`, { role, content });
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations', conversationId, 'chat-messages'] });
    } catch (error) {
      console.error("[PulseAI] Failed to persist message:", error);
    }
  };

  const clearPulseAiHistoryMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("DELETE", `/api/ai/conversations/${conversationId}/chat-messages`);
    },
    onSuccess: () => {
      if (selectedConversationId) {
        queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations', selectedConversationId, 'chat-messages'] });
      }
      setPulseAiMessages([]);
    }
  });

  const pulseAiAskMutation = useMutation({
    mutationFn: async ({ question, conversationId }: { question: string; conversationId: string }) => {
      savePulseAiMessage(conversationId, "user", question);
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
    onSuccess: async (data: any, variables) => {
      const assistantContent = data.draft || data.draftReply || "I couldn't find relevant information.";
      savePulseAiMessage(variables.conversationId, "assistant", assistantContent);
      setPulseAiMessages(prev => prev.map(m => 
        m.isLoading ? { role: "assistant" as const, content: assistantContent } : m
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
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  useEffect(() => {
    pulseAiMessagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [pulseAiMessages]);

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
    
    // Helper to check if a conversation is solved/archived
    const isSolvedOrArchived = (c: any) => c.status === "solved" || c.status === "archived";
    
    // If a lifecycle filter is active, show open conversations with that lifecycle (exclude solved/archived)
    if (activeLifecycle) {
      filtered = conversations.filter(c => {
        const stage = (c as any).lifecycleStage || "new_lead";
        const isSolved = c.status === "solved" || c.status === "archived";
        return stage === activeLifecycle && !isSolved;
      });
    } else {
      // Apply activeView filter only when no lifecycle is selected
      switch (activeView) {
        case "open":
          // All view: show all conversations except waiting and solved/archived
          filtered = conversations.filter(c => (c as any).status !== "waiting" && !isSolvedOrArchived(c));
          break;
        case "unread":
          filtered = conversations.filter(c => c.unreadCount > 0 && (c as any).status !== "waiting" && !isSolvedOrArchived(c));
          break;
        case "assigned":
          filtered = conversations.filter(c => c.assignedTo === user?.id && !isSolvedOrArchived(c));
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
          filtered = conversations.filter(c => isSolvedOrArchived(c));
          break;
        case "all":
          // Exclude solved/archived from "All chats" - they should only show in Solved view
          filtered = conversations.filter(c => !isSolvedOrArchived(c));
          break;
        case "sms":
          filtered = conversations.filter(c => (c.channel === "sms" || !c.channel) && !isSolvedOrArchived(c));
          break;
        case "live-chat":
          filtered = conversations.filter(c => (c.channel === "live_chat" || c.channel === "live-chat") && !isSolvedOrArchived(c));
          break;
        case "whatsapp":
          filtered = conversations.filter(c => c.channel === "whatsapp" && !isSolvedOrArchived(c));
          break;
        case "facebook":
          filtered = conversations.filter(c => c.channel === "facebook" && !isSolvedOrArchived(c));
          break;
        case "instagram":
          filtered = conversations.filter(c => c.channel === "instagram" && !isSolvedOrArchived(c));
          break;
        default:
          filtered = conversations.filter(c => !isSolvedOrArchived(c));
      }
    }
    
    // Apply sidebar filter: Show (all, open, closed, snoozed)
    // Skip this filter when viewing "solved" or when a lifecycle filter is active
    if (activeView !== "solved" && !activeLifecycle) {
      if (filterShow === "open") {
        filtered = filtered.filter(c => (c as any).status !== "solved" && (c as any).status !== "archived" && (c as any).status !== "snoozed");
      } else if (filterShow === "closed") {
        filtered = filtered.filter(c => (c as any).status === "solved" || (c as any).status === "archived");
      } else if (filterShow === "snoozed") {
        filtered = filtered.filter(c => (c as any).status === "snoozed");
      }
    }
    // "all" shows everything already filtered by activeView
    
    // Apply unreplied filter
    if (filterUnreplied) {
      filtered = filtered.filter(c => {
        // A conversation is "unreplied" if the last message was inbound (from customer)
        // We check if it has unread messages or if lastMessageDirection is inbound
        return c.unreadCount > 0 || (c as any).lastMessageDirection === "inbound";
      });
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.displayName?.toLowerCase().includes(query) ||
        c.phoneNumber.includes(query) ||
        c.lastMessage?.toLowerCase().includes(query)
      );
    }
    
    // Apply sort
    filtered = [...filtered].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      const aCreated = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : aTime;
      const bCreated = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : bTime;
      
      switch (filterSortBy) {
        case "newest":
          return bTime - aTime;
        case "oldest":
          return aTime - bTime;
        case "longest_open":
          // Oldest created first (longest open)
          return aCreated - bCreated;
        case "shortest_open":
          // Newest created first (shortest open)
          return bCreated - aCreated;
        default:
          return bTime - aTime;
      }
    });
    
    return filtered;
  }, [conversations, searchQuery, activeView, activeLifecycle, filterShow, filterSortBy, filterUnreplied]);

  const viewLabel = useMemo(() => {
    switch (activeView) {
      case "open": return "All";
      case "unread": return "Unread";
      case "assigned": return "Assigned to me";
      case "waiting": return "Waiting live chats";
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

  const sendTypingIndicator = (conversationId: string, isTyping: boolean, channel?: string) => {
    const endpoint = channel === "imessage" 
      ? "/api/imessage/typing" 
      : "/api/inbox/live-chat/typing";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ conversationId, isTyping }),
    }).catch(console.error);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    const channel = selectedConversation?.channel;
    if ((channel === "live_chat" || channel === "imessage") && value.length > 0 && !isInternalNote) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 2000) {
        sendTypingIndicator(selectedConversation!.id, true, channel);
        lastTypingSentRef.current = now;
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(selectedConversation!.id, false, channel);
      }, 3000);
    }
  };

  const handleSendMessage = () => {
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedConversationId) return;
    
    // Validate file sizes for WhatsApp before sending
    if (selectedConversation?.channel === "whatsapp" && selectedFiles.length > 0) {
      const WA_LIMITS: Record<string, number> = {
        image: 5 * 1024 * 1024,    // 5 MB
        video: 16 * 1024 * 1024,   // 16 MB
        audio: 16 * 1024 * 1024,   // 16 MB
        document: 100 * 1024 * 1024 // 100 MB
      };
      const typeNames: Record<string, string> = { image: "imágenes", video: "videos", audio: "audio", document: "documentos" };
      
      for (const file of selectedFiles) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const isAudio = file.type.startsWith("audio/");
        const mediaType = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "document";
        const maxSize = WA_LIMITS[mediaType];
        
        if (file.size > maxSize) {
          const maxSizeMB = Math.round(maxSize / (1024 * 1024));
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
          toast({
            title: "File too large",
            description: `${fileSizeMB}MB exceeds ${maxSizeMB}MB limit for ${mediaType}s`,
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    if (selectedConversation?.channel === "live_chat" || selectedConversation?.channel === "imessage") {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTypingIndicator(selectedConversation.id, false, selectedConversation.channel);
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

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Set up audio analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Get supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      setAudioVolume([]);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start volume visualization
      const updateVolume = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalizedVolume = Math.min(100, average * 1.5);
          setAudioVolume(prev => [...prev.slice(-30), normalizedVolume]);
        }
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    // Stop visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      mediaRecorderRef.current.onstop = () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Set audio preview instead of directly adding to files
        setAudioPreview({ blob: audioBlob, url: audioUrl });
        
        // Cleanup recording state
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        audioChunksRef.current = [];
      };
    }
  };

  const confirmAudioRecording = () => {
    if (audioPreview) {
      const extension = audioPreview.blob.type.includes('webm') ? 'webm' : 'mp4';
      const audioFile = new File([audioPreview.blob], `voice-message-${Date.now()}.${extension}`, { 
        type: audioPreview.blob.type 
      });
      setSelectedFiles(prev => [...prev, audioFile]);
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
      setRecordingTime(0);
      setAudioVolume([]);
    }
  };

  const cancelRecording = () => {
    // Stop visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clean up audio preview if exists
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
    }
    
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingTime(0);
    setAudioVolume([]);
    audioChunksRef.current = [];
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateConversation = () => {
    // For SMS, require message. For WhatsApp, require template
    if (newConversationChannel === "sms") {
      if (!newConversationPhone.trim() || !newMessage.trim()) {
        toast({
          title: "Missing information",
          description: "Please enter a phone number and message",
          variant: "destructive",
        });
        return;
      }
      if (!selectedFromNumber) {
        toast({
          title: "Missing information",
          description: "Please select a From Number for SMS",
          variant: "destructive",
        });
        return;
      }
      createConversationMutation.mutate({
        phoneNumber: newConversationPhone.trim(),
        fromNumber: selectedFromNumber,
        text: newMessage.trim(),
      });
    } else {
      // WhatsApp - requires template
      if (!newConversationPhone.trim()) {
        toast({
          title: "Missing phone number",
          description: "Please enter a phone number",
          variant: "destructive",
        });
        return;
      }
      if (!whatsappConnected) {
        toast({
          title: "WhatsApp not connected",
          description: "Please connect WhatsApp in Settings > Channels first",
          variant: "destructive",
        });
        return;
      }
      if (!newConvTemplate) {
        toast({
          title: "No template selected",
          description: "Please select a WhatsApp template to send",
          variant: "destructive",
        });
        return;
      }
      // Check all variables are filled
      const hasEmptyVars = Object.values(newConvVars).some(v => !v.trim());
      if (hasEmptyVars && Object.keys(newConvVars).length > 0) {
        toast({
          title: "Missing variable values",
          description: "Please fill in all template variables",
          variant: "destructive",
        });
        return;
      }
      // Build components for Meta API
      const components: Array<any> = [];
      const getParams = (prefix: string): Array<{ type: string; text: string }> => {
        const keys = Object.keys(newConvVars)
          .filter(k => k.startsWith(prefix))
          .sort((a, b) => {
            const numA = parseInt(a.split("_").pop() || "0");
            const numB = parseInt(b.split("_").pop() || "0");
            return numA - numB;
          });
        return keys.map(k => ({ type: "text", text: newConvVars[k] || "" }));
      };
      newConvTemplate.components?.forEach((comp: any) => {
        const compType = comp.type?.toUpperCase();
        if (compType === "HEADER") {
          const params = getParams("HEADER_");
          if (params.length > 0) components.push({ type: "header", parameters: params });
        } else if (compType === "BODY") {
          const params = getParams("BODY_");
          if (params.length > 0) components.push({ type: "body", parameters: params });
        } else if ((compType === "BUTTONS" || compType === "BUTTON") && comp.buttons) {
          comp.buttons.forEach((btn: any, btnIdx: number) => {
            if (btn.type?.toUpperCase() === "URL") {
              const params = getParams(`BUTTON_${btnIdx}_`);
              if (params.length > 0) {
                components.push({ type: "button", sub_type: "url", index: btnIdx, parameters: params });
              }
            }
          });
        }
      });
      // Build rendered text for display
      const renderedText = buildRenderedText(newConvTemplate, newConvVars);
      // Send via WhatsApp template endpoint
      createWhatsAppWithTemplateMutation.mutate({
        phoneNumber: newConversationPhone.trim(),
        templateName: newConvTemplate.name,
        languageCode: newConvTemplate.language,
        components: components.length > 0 ? components : undefined,
        renderedText,
      });
    }
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

  const startEditingField = (field: string) => {
    setEditForm({
      displayName: matchedContact?.displayName || selectedConversation?.displayName || "",
      email: selectedConversation?.email || matchedContact?.email || "",
      jobTitle: selectedConversation?.jobTitle || "",
      organization: selectedConversation?.organization || matchedContact?.companyName || "",
    });
    setEditingField(field);
  };

  const cancelEditing = () => {
    setEditingField(null);
  };

  const saveFieldEdit = (field: string) => {
    if (!selectedConversationId) return;
    updateConversationMutation.mutate({
      conversationId: selectedConversationId,
      displayName: editForm.displayName,
      email: editForm.email,
      jobTitle: editForm.jobTitle,
      organization: editForm.organization,
    });
    setEditingField(null);
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveFieldEdit(field);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
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
        open: conversations.filter(c => c.status !== "solved" && c.status !== "archived").length,
        assigned: conversations.filter(c => c.assignedTo === user?.id && c.status !== "solved" && c.status !== "archived").length,
        solved: conversations.filter(c => c.status === "solved" || c.status === "archived").length,
      }}
      lifecycleCounts={{
        new_lead: conversations.filter(c => c.status !== "solved" && c.status !== "archived" && ((c as any).lifecycleStage === "new_lead" || !(c as any).lifecycleStage)).length,
        hot_lead: conversations.filter(c => c.status !== "solved" && c.status !== "archived" && (c as any).lifecycleStage === "hot_lead").length,
        payment: conversations.filter(c => c.status !== "solved" && c.status !== "archived" && (c as any).lifecycleStage === "payment").length,
        customer: conversations.filter(c => c.status !== "solved" && c.status !== "archived" && (c as any).lifecycleStage === "customer").length,
      }}
      activeLifecycle={activeLifecycle}
      onLifecycleChange={setActiveLifecycle}
    >
      {/* Conversation List Panel */}
      <div className={cn(
        "w-80 border-r flex flex-col bg-white dark:bg-gray-900",
        mobileView !== "threads" && "hidden md:flex"
      )}>
        {/* Header */}
        <div className="h-[49px] px-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExpandSidebarButton />
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
            <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1 shrink-0"
                  data-testid="btn-filter-popover"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    {filterShow === "all" ? "All" : filterShow === "open" ? "Open" : filterShow === "closed" ? "Closed" : "Snoozed"}, {filterSortBy === "newest" ? "Newest" : filterSortBy === "oldest" ? "Oldest" : filterSortBy === "longest_open" ? "Longest Open" : "Shortest Open"}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {filterShow === "all" ? "All" : filterShow === "open" ? "Open" : filterShow === "closed" ? "Closed" : "Snoozed"}, {filterSortBy === "newest" ? "Newest" : filterSortBy === "oldest" ? "Oldest" : filterSortBy === "longest_open" ? "Longest" : "Shortest"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="unreplied"
                        checked={filterUnreplied}
                        onCheckedChange={setFilterUnreplied}
                        className="scale-75"
                        data-testid="switch-unreplied"
                      />
                      <Label htmlFor="unreplied" className="text-xs text-muted-foreground cursor-pointer">Unreplied</Label>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 border-b">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Show</p>
                  <RadioGroup value={filterShow} onValueChange={(v) => setFilterShow(v as any)} className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="show-all" data-testid="radio-show-all" />
                      <Label htmlFor="show-all" className="text-sm cursor-pointer">All conversations</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="open" id="show-open" data-testid="radio-show-open" />
                      <Label htmlFor="show-open" className="text-sm cursor-pointer">Open conversations</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="closed" id="show-closed" data-testid="radio-show-closed" />
                      <Label htmlFor="show-closed" className="text-sm cursor-pointer">Closed conversations</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="snoozed" id="show-snoozed" data-testid="radio-show-snoozed" />
                      <Label htmlFor="show-snoozed" className="text-sm cursor-pointer">Snoozed conversations</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Sort by</p>
                  <RadioGroup value={filterSortBy} onValueChange={(v) => setFilterSortBy(v as any)} className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="newest" id="sort-newest" data-testid="radio-sort-newest" />
                      <Label htmlFor="sort-newest" className="text-sm cursor-pointer">Newest</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="oldest" id="sort-oldest" data-testid="radio-sort-oldest" />
                      <Label htmlFor="sort-oldest" className="text-sm cursor-pointer">Oldest</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="longest_open" id="sort-longest" data-testid="radio-sort-longest" />
                      <Label htmlFor="sort-longest" className="text-sm cursor-pointer">Longest Open</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="shortest_open" id="sort-shortest" data-testid="radio-sort-shortest" />
                      <Label htmlFor="sort-shortest" className="text-sm cursor-pointer">Shortest Open</Label>
                    </div>
                  </RadioGroup>
                </div>
              </PopoverContent>
            </Popover>
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate">
                            {conversation.displayName || (conversation.channel === "live_chat" ? "Website Visitor" : formatForDisplay(conversation.phoneNumber))}
                          </span>
                          <span className="shrink-0 text-xs" title={lifecycleOptions.find(l => l.id === ((conversation as any).lifecycleStage || "new_lead"))?.label}>
                            {lifecycleOptions.find(l => l.id === ((conversation as any).lifecycleStage || "new_lead"))?.emoji}
                          </span>
                        </div>
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
                
                {/* Lifecycle Badge with Dropdown */}
                <Popover open={lifecyclePopoverOpen} onOpenChange={setLifecyclePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-7 gap-1.5 text-xs font-medium border",
                        lifecycleOptions.find(l => l.id === ((selectedConversation as any).lifecycleStage || "new_lead"))?.color || "bg-blue-100 text-blue-700 border-blue-200"
                      )}
                      data-testid="btn-lifecycle"
                    >
                      <span>{lifecycleOptions.find(l => l.id === ((selectedConversation as any).lifecycleStage || "new_lead"))?.emoji || "🆕"}</span>
                      <span>{lifecycleOptions.find(l => l.id === ((selectedConversation as any).lifecycleStage || "new_lead"))?.label || "New Lead"}</span>
                      <ChevronRight className="h-3 w-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    <div className="space-y-0.5">
                      {lifecycleOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            updateLifecycleMutation.mutate({
                              conversationId: selectedConversation.id,
                              lifecycleStage: option.id
                            });
                          }}
                          disabled={updateLifecycleMutation.isPending}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
                            (selectedConversation as any).lifecycleStage === option.id && "bg-gray-100 dark:bg-gray-800"
                          )}
                          data-testid={`lifecycle-option-${option.id}`}
                        >
                          <span>{option.emoji}</span>
                          <span>{option.label}</span>
                          {(selectedConversation as any).lifecycleStage === option.id && (
                            <Check className="h-4 w-4 ml-auto text-blue-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                  onClick={() => selectedConversation && threadSummaryMutation.mutate(selectedConversation.id)}
                  disabled={threadSummaryMutation.isPending || !selectedConversation}
                  data-testid="btn-thread-summary"
                >
                  <Sparkles className="h-4 w-4" />
                  {threadSummaryMutation.isPending ? "Summarizing..." : "Thread Summary"}
                </Button>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid="btn-more-options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem data-testid="menu-email">
                      <Mail className="h-4 w-4 mr-2" />
                      Send email
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="menu-audio">
                      <Volume2 className="h-4 w-4 mr-2" />
                      Audio
                    </DropdownMenuItem>
                    <DropdownMenuItem data-testid="menu-search">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setDeleteDialogOpen(true)}
                      data-testid="menu-delete"
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 pb-52 bg-[#efeae2] dark:bg-[#0b141a]" onMouseUp={handleTextSelection}>
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
                    const isSystemMessage = message.contentType === "system";
                    
                    // System messages (calls) are displayed centered
                    if (isSystemMessage) {
                      const isCallMessage = message.text?.toLowerCase().includes("call");
                      const isMissedCall = message.text?.toLowerCase().includes("missed");
                      const isIncomingCall = message.text?.toLowerCase().includes("incoming");
                      const isEndedCall = message.text?.toLowerCase().includes("ended") || message.text?.includes("(") && message.text?.includes("s)");
                      
                      // Determine call icon and color
                      let CallIcon = Phone;
                      let iconColorClass = "text-emerald-500";
                      let bgColorClass = "bg-gray-100 dark:bg-gray-800";
                      
                      if (isMissedCall) {
                        CallIcon = PhoneMissed;
                        iconColorClass = "text-red-500";
                        bgColorClass = "bg-red-50 dark:bg-red-900/30";
                      } else if (isEndedCall) {
                        CallIcon = PhoneOff;
                        iconColorClass = "text-gray-500";
                        bgColorClass = "bg-gray-100 dark:bg-gray-800";
                      } else if (isIncomingCall) {
                        CallIcon = PhoneIncoming;
                        iconColorClass = "text-blue-500";
                        bgColorClass = "bg-blue-50 dark:bg-blue-900/30";
                      }
                      
                      return (
                        <div key={message.id} className="flex justify-center my-2">
                          <div className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm text-gray-600 dark:text-gray-300",
                            bgColorClass
                          )}>
                            {isCallMessage ? (
                              <>
                                <CallIcon className={cn("h-4 w-4", iconColorClass)} />
                                <span>{message.text}</span>
                              </>
                            ) : (
                              <span>{message.text}</span>
                            )}
                            <span className="text-xs text-gray-400 ml-2">
                              {new Intl.DateTimeFormat('default', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    
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
                          
                          {/* Message text - hide placeholder text for media-only messages */}
                          {message.text && 
                           message.text !== "(MMS attachment)" && 
                           message.text !== "(attachment)" && 
                           message.text !== "[image]" && 
                           message.text !== "[video]" && 
                           message.text !== "[audio]" && 
                           message.text !== "[document]" && 
                           message.text !== "[sticker]" && 
                           !/^\(\d+ attachments?\)$/.test(message.text || '') && (
                            <p className={cn(
                              "text-sm whitespace-pre-wrap",
                              isNote ? "text-yellow-900" : "text-gray-900 dark:text-gray-100"
                            )}>{message.text}</p>
                          )}
                          
                          {/* Media attachments */}
                          {message.mediaUrls && message.mediaUrls.length > 0 && (
                            <div className="flex flex-col gap-2 mt-1">
                              {message.mediaUrls.map((url, idx) => {
                                // Check if this is WhatsApp media metadata (stored as JSON string with wa_media: prefix)
                                if (url.startsWith('wa_media:')) {
                                  try {
                                    const waMedia = JSON.parse(url.substring(9));
                                    const { mediaId, mediaType, mimeType, fileName, fileSize } = waMedia;
                                    const streamUrl = `/api/whatsapp/meta/media/${mediaId}/stream`;
                                    
                                    // Render based on media type
                                    if (mediaType === 'image' || mediaType === 'sticker') {
                                      return (
                                        <button 
                                          key={idx} 
                                          onClick={() => setPreviewImage(streamUrl)}
                                          className="block text-left"
                                          data-testid={`wa-image-${idx}`}
                                        >
                                          <img 
                                            src={streamUrl} 
                                            alt="WhatsApp Image" 
                                            className="max-w-[300px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.style.display = 'none';
                                              const parent = target.parentElement;
                                              if (parent) {
                                                const fallback = document.createElement('div');
                                                fallback.className = 'flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg';
                                                fallback.innerHTML = '<span class="text-sm text-gray-500">Image failed to load</span>';
                                                parent.appendChild(fallback);
                                              }
                                            }}
                                          />
                                        </button>
                                      );
                                    }
                                    
                                    if (mediaType === 'video') {
                                      return (
                                        <video 
                                          key={idx}
                                          src={streamUrl}
                                          controls
                                          className="max-w-[300px] max-h-[300px] rounded-lg"
                                          data-testid={`wa-video-${idx}`}
                                        >
                                          Your browser does not support the video tag.
                                        </video>
                                      );
                                    }
                                    
                                    if (mediaType === 'audio') {
                                      return (
                                        <audio 
                                          key={idx}
                                          src={streamUrl}
                                          controls
                                          className="max-w-[300px]"
                                          data-testid={`wa-audio-${idx}`}
                                        >
                                          Your browser does not support the audio tag.
                                        </audio>
                                      );
                                    }
                                    
                                    if (mediaType === 'document') {
                                      const isPdf = mimeType?.includes('pdf');
                                      return (
                                        <div 
                                          key={idx}
                                          className={cn(
                                            "flex items-center gap-3 p-3 border rounded-lg max-w-[280px]",
                                            isPdf 
                                              ? "bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800"
                                              : "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800"
                                          )}
                                          data-testid={`wa-document-${idx}`}
                                        >
                                          <div className={cn(
                                            "flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center",
                                            isPdf ? "bg-red-500" : "bg-blue-500"
                                          )}>
                                            <FileText className="h-6 w-6 text-white" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                              {fileName || 'Document'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {fileSize ? `${Math.round(fileSize / 1024)} KB` : 'Click to download'}
                                            </p>
                                          </div>
                                          <div className="flex gap-1">
                                            <a
                                              href={streamUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={cn(
                                                "p-2 rounded-lg transition-colors",
                                                isPdf ? "hover:bg-red-200 dark:hover:bg-red-700/50" : "hover:bg-blue-200 dark:hover:bg-blue-700/50"
                                              )}
                                              title="View"
                                            >
                                              <Eye className={cn("h-4 w-4", isPdf ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400")} />
                                            </a>
                                            <a
                                              href={streamUrl}
                                              download={fileName || 'document'}
                                              className={cn(
                                                "p-2 rounded-lg transition-colors",
                                                isPdf ? "hover:bg-red-200 dark:hover:bg-red-700/50" : "hover:bg-blue-200 dark:hover:bg-blue-700/50"
                                              )}
                                              title="Download"
                                            >
                                              <Download className={cn("h-4 w-4", isPdf ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400")} />
                                            </a>
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    // Fallback for unknown WhatsApp media types
                                    return (
                                      <a 
                                        key={idx}
                                        href={streamUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        data-testid={`wa-media-${idx}`}
                                      >
                                        <FileText className="h-5 w-5 text-gray-500" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Media Attachment</span>
                                        <Download className="h-4 w-4 text-gray-400" />
                                      </a>
                                    );
                                  } catch (e) {
                                    console.error('Failed to parse WhatsApp media metadata:', e);
                                    return null;
                                  }
                                }
                                
                                // Check if this is iMessage media metadata (stored as JSON string with im_media: prefix)
                                if (url.startsWith('im_media:')) {
                                  try {
                                    const imMedia = JSON.parse(url.substring(9));
                                    const { guid, mimeType, url: fileUrl } = imMedia;
                                    const streamUrl = `/api/imessage/attachments/${guid}`;
                                    
                                    // Render based on mime type
                                    if (mimeType?.startsWith('image/')) {
                                      return (
                                        <button 
                                          key={idx} 
                                          onClick={() => setPreviewImage(streamUrl)}
                                          className="block text-left"
                                          data-testid={`im-image-${idx}`}
                                        >
                                          <img 
                                            src={streamUrl} 
                                            alt="Image" 
                                            className="max-w-[300px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                          />
                                        </button>
                                      );
                                    }
                                    
                                    if (mimeType?.startsWith('video/')) {
                                      return (
                                        <button
                                          key={idx}
                                          onClick={() => setPreviewVideo(streamUrl)}
                                          className="block text-left relative group"
                                          data-testid={`im-video-${idx}`}
                                        >
                                          <video 
                                            src={streamUrl}
                                            preload="metadata"
                                            className="max-w-[300px] max-h-[300px] rounded-lg cursor-pointer"
                                          >
                                            Your browser does not support the video tag.
                                          </video>
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                              <Play className="h-6 w-6 text-gray-800 ml-1" />
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    }
                                    
                                    if (mimeType?.startsWith('audio/')) {
                                      return (
                                        <audio 
                                          key={idx}
                                          src={streamUrl}
                                          controls
                                          className="max-w-[300px]"
                                          data-testid={`im-audio-${idx}`}
                                        >
                                          Your browser does not support the audio tag.
                                        </audio>
                                      );
                                    }
                                    
                                    // Default: download link for other file types
                                    return (
                                      <a 
                                        key={idx}
                                        href={streamUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        data-testid={`im-file-${idx}`}
                                      >
                                        <FileText className="h-5 w-5 text-gray-500" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Attachment</span>
                                        <Download className="h-4 w-4 text-gray-400" />
                                      </a>
                                    );
                                  } catch (e) {
                                    console.error('Failed to parse iMessage media metadata:', e);
                                    return null;
                                  }
                                }
                                
                                // Regular URL handling (for non-WhatsApp media)
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
                              <span>
                                {message.status === "read" ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                                ) : message.status === "delivered" ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                                ) : message.status === "sent" ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-gray-400" />
                                ) : message.status === "sending" ? (
                                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                                ) : message.status === "failed" ? (
                                  <span className="text-red-500 text-[10px]">!</span>
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
                  
                  {/* Typing indicator when contact is typing */}
                  {contactTyping && contactTyping.conversationId === selectedConversationId && contactTyping.isTyping && (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span>Escribiendo...</span>
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
              "absolute bottom-4 left-4 right-4 rounded-lg border bg-white dark:bg-gray-900 shadow-lg min-h-[160px]",
              isInternalNote && "bg-yellow-50 dark:bg-yellow-900/20"
            )}>
              {/* WhatsApp 24-hour Window Banner */}
              {selectedConversation?.channel === "whatsapp" && (waWindowTimeLeft || waWindowExpired) && (
                <div 
                  className={cn(
                    "mx-4 mt-3 px-3 py-2 rounded-lg flex items-center justify-between",
                    waWindowExpired 
                      ? "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800" 
                      : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  )}
                  data-testid="whatsapp-window-banner"
                >
                  <div className="flex items-center gap-2">
                    <SiWhatsapp className={cn(
                      "h-4 w-4",
                      waWindowExpired ? "text-red-500" : "text-emerald-500"
                    )} />
                    <span className={cn(
                      "text-xs font-medium",
                      waWindowExpired ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                    )}>
                      {waWindowExpired ? "Conversation window closed" : "Conversation window open"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {waWindowExpired ? (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Use a template to re-open
                      </span>
                    ) : (
                      <>
                        <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-300">
                          {waWindowTimeLeft}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Pending AI Approval Banner */}
              {currentConversationPendingApproval && (
                <div 
                  className="mx-4 mt-4 mb-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg"
                  data-testid="pending-approval-banner"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                          AI Response Needs Approval
                        </span>
                        {currentConversationPendingApproval.needsHuman && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-300">
                            Human Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3" data-testid="text-pending-response">
                        {currentConversationPendingApproval.outputText || "Response pending..."}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveAiResponseMutation.mutate(currentConversationPendingApproval.id)}
                          disabled={approveAiResponseMutation.isPending || rejectAiResponseMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="btn-approve-ai"
                        >
                          {approveAiResponseMutation.isPending ? (
                            <LoadingSpinner fullScreen={false} className="h-4 w-4" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Approve & Send
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectAiResponseMutation.mutate({ runId: currentConversationPendingApproval.id })}
                          disabled={approveAiResponseMutation.isPending || rejectAiResponseMutation.isPending}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          data-testid="btn-reject-ai"
                        >
                          {rejectAiResponseMutation.isPending ? (
                            <LoadingSpinner fullScreen={false} className="h-4 w-4" />
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Dismiss
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                    "min-h-[90px] max-h-40 resize-none border-0 shadow-none focus-visible:ring-0 p-0",
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
              <div className="px-4 pb-2 flex items-center justify-between">
                {/* Left: Toolbar Icons */}
                <div className="flex items-center gap-0.5">
                  <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="btn-emoji">
                        <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-0" side="top" align="start">
                      <Picker 
                        data={data} 
                        onEmojiSelect={(emoji: any) => {
                          setNewMessage(prev => prev + emoji.native);
                          setEmojiPickerOpen(false);
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
                          className="h-7 w-7" 
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="btn-attachment"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Attach file</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {selectedConversation?.channel === "whatsapp" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={() => setTemplatePickerOpen(true)}
                            data-testid="btn-templates"
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>WhatsApp Templates</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7" 
                          onClick={insertVariable}
                          data-testid="btn-variables"
                        >
                          <Braces className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Insert variable</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="btn-calendar">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Schedule</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="btn-preview">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Preview</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Audio Recording Button */}
                  {!isRecording && !audioPreview && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={startRecording}
                            data-testid="btn-microphone"
                          >
                            <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Record voice message</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Recording UI with waveform */}
                  {isRecording && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-full px-3 py-1 border border-red-200 dark:border-red-800">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
                      <div className="flex items-center gap-0.5 h-5">
                        {audioVolume.slice(-15).map((vol, i) => (
                          <div
                            key={i}
                            className="w-1 bg-red-500 dark:bg-red-400 rounded-full transition-all duration-75"
                            style={{ height: `${Math.max(4, vol / 5)}px` }}
                          />
                        ))}
                        {audioVolume.length < 15 && Array(15 - audioVolume.length).fill(0).map((_, i) => (
                          <div key={`empty-${i}`} className="w-1 h-1 bg-red-300 dark:bg-red-600 rounded-full" />
                        ))}
                      </div>
                      <span className="text-xs font-mono font-medium text-red-600 dark:text-red-400 min-w-[32px]">
                        {formatRecordingTime(recordingTime)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full" 
                        onClick={cancelRecording}
                        data-testid="btn-cancel-recording"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 bg-green-500 hover:bg-green-600 text-white rounded-full" 
                        onClick={stopRecording}
                        data-testid="btn-stop-recording"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  
                  {/* Audio Preview UI */}
                  {audioPreview && !isRecording && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full px-3 py-1 border border-blue-200 dark:border-blue-800">
                      <audio src={audioPreview.url} controls className="h-6 max-w-[140px]" />
                      <span className="text-xs text-muted-foreground">
                        {formatRecordingTime(recordingTime)}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-gray-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full" 
                        onClick={cancelRecording}
                        data-testid="btn-discard-audio"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full" 
                        onClick={confirmAudioRecording}
                        data-testid="btn-confirm-audio"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-7 w-7", copilotDraft && "bg-purple-100 dark:bg-purple-900/30")}
                          onClick={handleAiCopilotClick}
                          disabled={copilotDraftMutation.isPending}
                          data-testid="btn-ai"
                        >
                          <Wand2 className={cn(
                            "h-3.5 w-3.5",
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
                  {selectedConversation?.channel === "whatsapp" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setVoiceCallDialogOpen(true)}
                            className="h-7 w-7"
                            data-testid="btn-voice-call-button"
                          >
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Request a Call</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Right: Internal Note Toggle + Send Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id="internal-note"
                      checked={isInternalNote}
                      onCheckedChange={setIsInternalNote}
                      className="scale-90"
                      data-testid="switch-internal-note"
                    />
                    <Label htmlFor="internal-note" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                      Internal note
                    </Label>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() && selectedFiles.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 h-7 px-3 text-xs"
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
                {/* Chat Info - Collapsible - For all channels */}
                <div className="space-y-4">
                  <button 
                    onClick={() => setChatInfoOpen(!chatInfoOpen)}
                    className="flex items-center justify-between w-full text-left"
                    data-testid="btn-toggle-chat-info"
                  >
                    <h4 className="text-sm font-medium text-muted-foreground">Chat info</h4>
                    {chatInfoOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {chatInfoOpen && (
                    <div className="space-y-3" data-testid="section-chat-info">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Status</span>
                        <Select
                          value={selectedConversation.status === "solved" ? "solved" : "open"}
                          onValueChange={(value) => {
                            updateConversationMutation.mutate({
                              conversationId: selectedConversation.id,
                              displayName: selectedConversation.displayName || "",
                              email: selectedConversation.email || "",
                              jobTitle: selectedConversation.jobTitle || "",
                              organization: selectedConversation.organization || "",
                              status: value,
                            });
                          }}
                        >
                          <SelectTrigger className="w-[100px] h-7 text-xs" data-testid="select-status">
                            <SelectValue placeholder="Open" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">
                              <span className="text-green-600 font-medium">Open</span>
                            </SelectItem>
                            <SelectItem value="solved">
                              <span className="text-gray-600 font-medium">Solved</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Assignee</span>
                        <Select
                          value={selectedConversation.assignedTo || "unassigned"}
                          onValueChange={(value) => {
                            assignConversationMutation.mutate({
                              conversationId: selectedConversation.id,
                              userId: value === "unassigned" ? null : value,
                            });
                          }}
                        >
                          <SelectTrigger className="w-[220px] h-7 text-xs" data-testid="select-assignee">
                            <SelectValue>
                              {selectedConversation.assignedTo ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    {getUserAvatar(selectedConversation.assignedTo) && (
                                      <AvatarImage src={getUserAvatar(selectedConversation.assignedTo) || undefined} />
                                    )}
                                    <AvatarFallback className="text-[10px] bg-primary/10">
                                      {getUserInitial(selectedConversation.assignedTo)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">
                                    {getUserDisplayName(selectedConversation.assignedTo)}
                                    {String(user?.id) === selectedConversation.assignedTo && " (You)"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="min-w-[220px]">
                            <SelectItem value="unassigned">
                              <span className="text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {companyUsers.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    {u.avatar && <AvatarImage src={u.avatar} />}
                                    <AvatarFallback className="text-[10px] bg-primary/10">
                                      {u.firstName?.charAt(0) || u.email?.charAt(0) || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>
                                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                                    {String(u.id) === String(user?.id) && " (You)"}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Channel</span>
                        <div className="flex items-center gap-2">
                          {selectedConversation.channel === "whatsapp" && <SiWhatsapp className="h-3.5 w-3.5 text-green-500" />}
                          {selectedConversation.channel === "sms" && <MessageSquare className="h-3.5 w-3.5 text-blue-500" />}
                          {selectedConversation.channel === "mms" && <MessageSquare className="h-3.5 w-3.5 text-blue-600" />}
                          {selectedConversation.channel === "imessage" && <SiApple className="h-3.5 w-3.5 text-gray-800 dark:text-gray-200" />}
                          {selectedConversation.channel === "messenger" && <SiMessenger className="h-3.5 w-3.5 text-blue-500" />}
                          {selectedConversation.channel === "telegram" && <SiTelegram className="h-3.5 w-3.5 text-sky-500" />}
                          {selectedConversation.channel === "instagram" && <SiInstagram className="h-3.5 w-3.5 text-pink-500" />}
                          {selectedConversation.channel === "live_chat" && <Globe className="h-3.5 w-3.5 text-orange-500" />}
                          {selectedConversation.channel === "email" && <Mail className="h-3.5 w-3.5 text-red-500" />}
                          {!["whatsapp", "sms", "mms", "imessage", "messenger", "telegram", "instagram", "live_chat", "email"].includes(selectedConversation.channel) && <MessageSquare className="h-3.5 w-3.5 text-gray-500" />}
                          <span className="text-sm font-medium">
                            {selectedConversation.channel === "whatsapp" && "WhatsApp"}
                            {selectedConversation.channel === "sms" && "SMS"}
                            {selectedConversation.channel === "mms" && "MMS"}
                            {selectedConversation.channel === "imessage" && "iMessage"}
                            {selectedConversation.channel === "messenger" && "Messenger"}
                            {selectedConversation.channel === "telegram" && "Telegram"}
                            {selectedConversation.channel === "instagram" && "Instagram"}
                            {selectedConversation.channel === "live_chat" && "Live Chat"}
                            {selectedConversation.channel === "email" && "Email"}
                            {!["whatsapp", "sms", "mms", "imessage", "messenger", "telegram", "instagram", "live_chat", "email"].includes(selectedConversation.channel) && (selectedConversation.channel?.charAt(0).toUpperCase() + selectedConversation.channel?.slice(1) || "Unknown")}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Tags</span>
                        <div className="flex items-center gap-1 flex-wrap justify-end max-w-[180px]">
                          {selectedConversation.tags && selectedConversation.tags.length > 0 ? (
                            selectedConversation.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <button className="text-xs text-blue-600 hover:underline">Add Tags</button>
                          )}
                        </div>
                      </div>
                      {selectedConversation.channel === "live_chat" && selectedConversation.visitorCity && (
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Location</span>
                          <span className="text-sm font-medium flex items-center gap-1">
                            {selectedConversation.visitorCountry === "United States" ? "🇺🇸 " : 
                             selectedConversation.visitorCountry === "Mexico" ? "🇲🇽 " :
                             selectedConversation.visitorCountry === "Canada" ? "🇨🇦 " :
                             selectedConversation.visitorCountry === "Spain" ? "🇪🇸 " :
                             selectedConversation.visitorCountry === "United Kingdom" ? "🇬🇧 " : ""}
                            {selectedConversation.visitorCity}
                            {selectedConversation.visitorCity && selectedConversation.visitorState && ", "}
                            {selectedConversation.visitorState || ""}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Chat ID</span>
                        <span className="text-sm font-medium font-mono">{selectedConversation.id.substring(0, 8)}</span>
                      </div>
                      {selectedConversation.createdAt && (
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Created</span>
                          <span className="text-sm font-medium">
                            {format(new Date(selectedConversation.createdAt), "d MMM yyyy, h:mm a")}
                          </span>
                        </div>
                      )}
                      {selectedConversation.updatedAt && (
                        <div className="flex justify-between">
                          <span className="text-xs text-muted-foreground">Last updated</span>
                          <span className="text-sm font-medium">
                            {format(new Date(selectedConversation.updatedAt), "d MMM yyyy, h:mm a")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pulse AI Controls - For live_chat and SMS/MMS channels */}
                {(selectedConversation.channel === "live_chat" || selectedConversation.channel === "sms" || selectedConversation.channel === "mms") && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setPulseAiSettingsOpen(!pulseAiSettingsOpen)}
                      className="flex items-center justify-between w-full text-left"
                      data-testid="btn-toggle-pulse-ai-settings"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-violet-500" />
                        <h4 className="text-sm font-medium text-muted-foreground">Pulse AI</h4>
                      </div>
                      {pulseAiSettingsOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {pulseAiSettingsOpen && (
                      <div className="space-y-4 pl-6" data-testid="section-pulse-ai-settings">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="autopilot-switch" className="text-sm font-medium">Autopilot</Label>
                            <p className="text-xs text-muted-foreground">Let AI respond automatically</p>
                          </div>
                          <Switch
                            id="autopilot-switch"
                            checked={selectedConversation.autopilotEnabled ?? false}
                            onCheckedChange={(checked) => {
                              updateAiSettingsMutation.mutate({
                                conversationId: selectedConversation.id,
                                autopilotEnabled: checked,
                              });
                            }}
                            disabled={updateAiSettingsMutation.isPending}
                            data-testid="switch-autopilot"
                          />
                        </div>
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
                          {editingField === "displayName" ? (
                            <Input
                              autoFocus
                              value={editForm.displayName}
                              onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                              onKeyDown={(e) => handleFieldKeyDown(e, "displayName")}
                              onBlur={() => saveFieldEdit("displayName")}
                              className="h-7 text-sm"
                              data-testid="input-fullname"
                            />
                          ) : (
                            <p 
                              className="text-sm font-medium cursor-pointer hover:text-primary transition-colors" 
                              onClick={() => startEditingField("displayName")}
                              data-testid="text-fullname"
                            >
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
                          {editingField === "email" ? (
                            <Input
                              autoFocus
                              value={editForm.email}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              onKeyDown={(e) => handleFieldKeyDown(e, "email")}
                              onBlur={() => saveFieldEdit("email")}
                              className="h-7 text-sm"
                              placeholder="email@example.com"
                              data-testid="input-email"
                            />
                          ) : (
                            <p 
                              className="text-sm font-medium cursor-pointer hover:text-primary transition-colors" 
                              onClick={() => startEditingField("email")}
                              data-testid="text-email"
                            >
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
                          {editingField === "jobTitle" ? (
                            <Input
                              autoFocus
                              value={editForm.jobTitle}
                              onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                              onKeyDown={(e) => handleFieldKeyDown(e, "jobTitle")}
                              onBlur={() => saveFieldEdit("jobTitle")}
                              className="h-7 text-sm"
                              placeholder="Enter job title"
                              data-testid="input-jobtitle"
                            />
                          ) : (
                            <p 
                              className="text-sm font-medium cursor-pointer hover:text-primary transition-colors" 
                              onClick={() => startEditingField("jobTitle")}
                              data-testid="text-jobtitle"
                            >
                              {selectedConversation.jobTitle || "—"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Organization</p>
                          {editingField === "organization" ? (
                            <Input
                              autoFocus
                              value={editForm.organization}
                              onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                              onKeyDown={(e) => handleFieldKeyDown(e, "organization")}
                              onBlur={() => saveFieldEdit("organization")}
                              className="h-7 text-sm"
                              placeholder="Enter organization"
                              data-testid="input-organization"
                            />
                          ) : (
                            <p 
                              className="text-sm font-medium cursor-pointer hover:text-primary transition-colors" 
                              onClick={() => startEditingField("organization")}
                              data-testid="text-organization"
                            >
                              {selectedConversation.organization || matchedContact?.companyName || "—"}
                            </p>
                          )}
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
              </div>
            </ScrollArea>
            )}

            {/* Pulse AI Tab Content */}
            {rightPanelTab === "pulse-ai" && (
              <div className="flex-1 flex flex-col overflow-hidden" data-testid="pulse-ai-panel">
                {/* Messages Area */}
                <ScrollArea className="flex-1 overflow-auto" data-testid="pulse-ai-messages">
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
                      <>
                        {pulseAiMessages.map((msg, idx) => (
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
                        ))}
                        <div ref={pulseAiMessagesEndRef} />
                      </>
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
                  
                  {/* Clear History Button */}
                  {pulseAiMessages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (selectedConversationId) {
                          clearPulseAiHistoryMutation.mutate(selectedConversationId);
                        }
                      }}
                      disabled={clearPulseAiHistoryMutation.isPending}
                      data-testid="btn-pulse-ai-clear-history"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Clear history
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
            {/* Channel Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <Select value={newConversationChannel} onValueChange={(v: "sms" | "whatsapp") => setNewConversationChannel(v)}>
                <SelectTrigger data-testid="select-channel">
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      <span>SMS / MMS</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp" disabled={!whatsappConnected}>
                    <div className="flex items-center gap-2">
                      <SiWhatsapp className="h-4 w-4 text-emerald-500" />
                      <span>WhatsApp {!whatsappConnected && "(Not Connected)"}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* From Number - SMS or WhatsApp */}
            {newConversationChannel === "sms" ? (
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
            ) : waConnections.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">From WhatsApp</label>
                <Select 
                  value={selectedWaConnection || waConnections[0]?.id || ""} 
                  onValueChange={(val) => {
                    setSelectedWaConnection(val);
                    setNewConvTemplate(null);
                    setNewConvVars({});
                  }}
                >
                  <SelectTrigger data-testid="select-whatsapp-from">
                    <SelectValue placeholder="Select WhatsApp account" />
                  </SelectTrigger>
                  <SelectContent>
                    {waConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex items-center gap-2">
                          <SiWhatsapp className="h-4 w-4 text-emerald-500" />
                          <span>{conn.displayName || formatForDisplay(conn.phoneNumberE164)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">No WhatsApp accounts connected</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Connect WhatsApp in Settings → Channels
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">To Phone Number</label>
              <Input
                placeholder="+1 (555) 123-4567"
                value={newConversationPhone}
                onChange={(e) => setNewConversationPhone(e.target.value)}
                data-testid="input-to-phone"
              />
            </div>
            {/* Message - SMS shows textarea, WhatsApp shows template picker */}
            {newConversationChannel === "sms" ? (
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
            ) : (
              <div className="space-y-3">
                <label className="text-sm font-medium">WhatsApp Template</label>
                {approvedTemplates.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">No templates available.</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Create templates in Settings → Channels → WhatsApp Templates
                    </p>
                  </div>
                ) : !newConvTemplate ? (
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <div className="p-2 space-y-2">
                      {approvedTemplates.map((template) => {
                        const bodyComp = template.components?.find((c: any) => c.type?.toUpperCase() === "BODY");
                        return (
                          <button
                            key={`${template.name}-${template.language}`}
                            className="w-full p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border rounded-lg transition-colors"
                            onClick={() => {
                              setNewConvTemplate(template);
                              setNewConvVars(extractTemplateVariables(template));
                            }}
                            data-testid={`btn-new-conv-tpl-${template.name}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{template.name.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {bodyComp?.text || "No body"}
                                </p>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs">{template.language}</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{newConvTemplate.name.replace(/_/g, ' ')}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setNewConvTemplate(null); setNewConvVars({}); }}
                      >
                        Change
                      </Button>
                    </div>
                    <div className="flex justify-center">
                      <WhatsAppTemplatePreview template={newConvTemplate} variables={newConvVars} />
                    </div>
                    {Object.keys(newConvVars).length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground">Fill variables:</p>
                        {Object.keys(newConvVars).sort().map((key) => {
                          const [type, ...rest] = key.split("_");
                          const varNum = rest.join("_");
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-xs w-20 text-muted-foreground">{type} {varNum}:</span>
                              <Input
                                value={newConvVars[key] || ""}
                                onChange={(e) => setNewConvVars(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder={`Value for {{${varNum}}}`}
                                className="h-8 text-sm flex-1"
                                data-testid={`input-new-var-${key}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleCreateConversation}
              disabled={createConversationMutation.isPending || createWhatsAppConversationMutation.isPending}
              data-testid="btn-send-new-conversation"
            >
              {(createConversationMutation.isPending || createWhatsAppConversationMutation.isPending) 
                ? "Sending..." 
                : newConversationChannel === "whatsapp" 
                  ? "Send via WhatsApp" 
                  : "Send Message"}
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

      {/* Video Preview Modal */}
      {previewVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewVideo(null)}
          data-testid="video-preview-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            onClick={() => setPreviewVideo(null)}
            data-testid="btn-close-video-preview"
          >
            <X className="h-6 w-6" />
          </button>
          <video 
            src={previewVideo} 
            controls
            autoPlay
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="video-preview"
          >
            Your browser does not support the video tag.
          </video>
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

      {/* Voice Call Button Dialog */}
      <Dialog open={voiceCallDialogOpen} onOpenChange={setVoiceCallDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-voice-call-button">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-emerald-600" />
              Send Voice Call Button
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice-call-text">Message Text</Label>
              <Textarea
                id="voice-call-text"
                value={voiceCallText}
                onChange={(e) => setVoiceCallText(e.target.value)}
                placeholder="Need to talk? Press the button below to call us."
                className="resize-none"
                rows={3}
                data-testid="input-voice-call-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-call-button-text">Button Text (max 20 characters)</Label>
              <Input
                id="voice-call-button-text"
                value={voiceCallButtonText}
                onChange={(e) => setVoiceCallButtonText(e.target.value.substring(0, 20))}
                placeholder="Call Now"
                maxLength={20}
                data-testid="input-voice-call-button-text"
              />
              <p className="text-xs text-muted-foreground">{voiceCallButtonText.length}/20 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-call-ttl">Link Expiry (minutes)</Label>
              <Input
                id="voice-call-ttl"
                type="number"
                value={voiceCallTtl}
                onChange={(e) => setVoiceCallTtl(Math.max(1, parseInt(e.target.value) || 60))}
                min={1}
                max={1440}
                data-testid="input-voice-call-ttl"
              />
              <p className="text-xs text-muted-foreground">The call button will expire after this time (1-1440 minutes)</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setVoiceCallDialogOpen(false)}
                data-testid="btn-cancel-voice-call"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedConversationId) {
                    sendVoiceCallButtonMutation.mutate({
                      conversationId: selectedConversationId,
                      text: voiceCallText,
                      buttonText: voiceCallButtonText,
                      ttlMinutes: voiceCallTtl,
                    });
                  }
                }}
                disabled={sendVoiceCallButtonMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="btn-send-voice-call"
              >
                {sendVoiceCallButtonMutation.isPending ? "Sending..." : "Send Call Button"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thread Summary Dialog */}
      <Dialog open={threadSummaryOpen} onOpenChange={setThreadSummaryOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-thread-summary">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Thread Summary
            </DialogTitle>
          </DialogHeader>
          
          {threadSummaryMutation.isPending ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner message="Generating summary..." fullScreen={false} />
            </div>
          ) : threadSummaryData ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Summary</h4>
                <p className="text-sm" data-testid="text-thread-summary">
                  {threadSummaryData.summary}
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Quick Responses</h4>
                {threadSummaryData.suggestions.map((suggestion, index) => {
                  const getSuggestionIcon = (type: string) => {
                    switch (type.toLowerCase()) {
                      case "offer":
                        return <Gift className="h-4 w-4 text-green-600" />;
                      case "encourage":
                        return <Heart className="h-4 w-4 text-pink-600" />;
                      case "suggest":
                        return <Lightbulb className="h-4 w-4 text-amber-600" />;
                      default:
                        return <MessageSquare className="h-4 w-4 text-blue-600" />;
                    }
                  };
                  
                  const getSuggestionLabel = (type: string) => {
                    switch (type.toLowerCase()) {
                      case "offer":
                        return "Offer";
                      case "encourage":
                        return "Encourage";
                      case "suggest":
                        return "Suggest";
                      default:
                        return type;
                    }
                  };
                  
                  const getSuggestionBgColor = (type: string) => {
                    switch (type.toLowerCase()) {
                      case "offer":
                        return "hover:bg-green-50 border-green-200";
                      case "encourage":
                        return "hover:bg-pink-50 border-pink-200";
                      case "suggest":
                        return "hover:bg-amber-50 border-amber-200";
                      default:
                        return "hover:bg-blue-50 border-blue-200";
                    }
                  };
                  
                  return (
                    <button
                      key={index}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        getSuggestionBgColor(suggestion.type)
                      )}
                      onClick={() => {
                        setNewMessage(suggestion.text);
                        setThreadSummaryOpen(false);
                        toast({
                          title: "Response added",
                          description: "The suggestion has been added to your message composer.",
                        });
                      }}
                      data-testid={`btn-suggestion-${suggestion.type}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          {getSuggestionIcon(suggestion.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {getSuggestionLabel(suggestion.type)}
                          </p>
                          <p className="text-sm line-clamp-2">
                            {suggestion.text}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Click a suggestion to add it to your message composer
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Template Picker Dialog */}
      <Dialog open={templatePickerOpen} onOpenChange={(open) => {
        setTemplatePickerOpen(open);
        if (!open) {
          setSelectedTemplateForSend(null);
          setTemplateVariables({});
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="dialog-template-picker">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiWhatsapp className="h-5 w-5 text-emerald-500" />
              Send WhatsApp Template
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {!selectedTemplateForSend ? (
              // Template Selection List
              <div className="space-y-2">
                {approvedTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No approved templates found</p>
                    <p className="text-sm mt-1">Create templates in Settings → Channels → WhatsApp Templates</p>
                  </div>
                ) : (
                  approvedTemplates.map((template) => {
                    const bodyComp = template.components.find(c => c.type === "BODY");
                    return (
                      <button
                        key={template.id}
                        className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedTemplateForSend(template);
                          // Extract variables from ALL component types (HEADER, BODY, BUTTONS)
                          const vars: Record<string, string> = {};
                          template.components.forEach((comp: any) => {
                            const compType = comp.type?.toUpperCase();
                            // Handle HEADER and BODY text variables
                            if (["HEADER", "BODY"].includes(compType)) {
                              const text = comp.text || "";
                              const matches = text.match(/\{\{(\d+)\}\}/g) || [];
                              matches.forEach((match: string) => {
                                const num = match.replace(/[{}]/g, '');
                                vars[`${compType}_${num}`] = "";
                              });
                            }
                            // Handle BUTTONS component with nested buttons array (Meta uses "BUTTONS" as component type)
                            if ((compType === "BUTTONS" || compType === "BUTTON") && comp.buttons) {
                              comp.buttons.forEach((btn: any, btnIdx: number) => {
                                // URL buttons can have dynamic variables in the URL
                                if (btn.type?.toUpperCase() === "URL" && btn.url) {
                                  const urlMatches = btn.url.match(/\{\{(\d+)\}\}/g) || [];
                                  urlMatches.forEach((match: string) => {
                                    const num = match.replace(/[{}]/g, '');
                                    vars[`BUTTON_${btnIdx}_${num}`] = "";
                                  });
                                }
                              });
                            }
                          });
                          setTemplateVariables(vars as any);
                        }}
                        data-testid={`btn-select-template-${template.name}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{template.name.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {bodyComp?.text || "No body text"}
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-2 shrink-0">
                            {template.language}
                          </Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              // Template Customization View
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTemplateForSend(null);
                    setTemplateVariables({});
                  }}
                  className="mb-2"
                  data-testid="btn-back-to-templates"
                >
                  ← Back to templates
                </Button>
                
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-medium">{selectedTemplateForSend.name.replace(/_/g, ' ')}</h4>
                  {/* Show HEADER if present */}
                  {(() => {
                    const headerComp = selectedTemplateForSend.components.find((c: any) => c.type === "HEADER");
                    if (!headerComp?.text) return null;
                    let text = headerComp.text;
                    Object.entries(templateVariables).forEach(([key, value]) => {
                      if (key.startsWith("HEADER_")) {
                        const num = key.split("_")[1];
                        text = text.replace(`{{${num}}}`, value || `[Header ${num}]`);
                      }
                    });
                    return <p className="text-sm font-medium">{text}</p>;
                  })()}
                  {/* Show BODY */}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {(() => {
                      const bodyComp = selectedTemplateForSend.components.find((c: any) => c.type === "BODY");
                      let text = bodyComp?.text || "";
                      Object.entries(templateVariables).forEach(([key, value]) => {
                        if (key.startsWith("BODY_")) {
                          const num = key.split("_")[1];
                          text = text.replace(`{{${num}}}`, value || `[Variable ${num}]`);
                        }
                      });
                      return text;
                    })()}
                  </p>
                </div>
                
                {Object.keys(templateVariables).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Fill in the variables:</h4>
                    {Object.keys(templateVariables).sort().map((key) => {
                      const [compType, ...rest] = key.split("_");
                      const varNum = rest.join("_");
                      const labelPrefix = compType === "HEADER" ? "Header" : compType === "BUTTON" ? "Button URL" : "Body";
                      return (
                        <div key={key} className="space-y-1">
                          <Label htmlFor={`var-${key}`} className="text-sm">
                            {labelPrefix} Variable {varNum}
                          </Label>
                          <Input
                            id={`var-${key}`}
                            value={(templateVariables as Record<string, string>)[key] || ""}
                            onChange={(e) => setTemplateVariables(prev => ({
                              ...prev,
                              [key]: e.target.value
                            }))}
                            placeholder={`Enter value for {{${varNum}}}`}
                            data-testid={`input-template-var-${key}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTemplatePickerOpen(false);
                      setSelectedTemplateForSend(null);
                      setTemplateVariables({});
                    }}
                    data-testid="btn-cancel-template"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedConversationId || !selectedTemplateForSend) return;
                      
                      // Build components array by iterating template components with lowercase types for Meta API
                      const components: Array<any> = [];
                      const varsRecord = templateVariables as Record<string, string>;
                      
                      // Helper to get sorted parameters for a component type
                      const getParams = (prefix: string): Array<{ type: string; text: string }> => {
                        const keys = Object.keys(varsRecord)
                          .filter(k => k.startsWith(prefix))
                          .sort((a, b) => {
                            // Sort numerically by extracting the variable number
                            const numA = parseInt(a.split("_").pop() || "0");
                            const numB = parseInt(b.split("_").pop() || "0");
                            return numA - numB;
                          });
                        return keys.map(k => ({ type: "text", text: varsRecord[k] || "" }));
                      };
                      
                      // Iterate original template components to preserve structure
                      selectedTemplateForSend.components.forEach((comp: any) => {
                        const compType = comp.type?.toUpperCase();
                        
                        if (compType === "HEADER") {
                          const params = getParams("HEADER_");
                          if (params.length > 0) {
                            components.push({ type: "header", parameters: params });
                          }
                        } else if (compType === "BODY") {
                          const params = getParams("BODY_");
                          if (params.length > 0) {
                            components.push({ type: "body", parameters: params });
                          }
                        } else if ((compType === "BUTTONS" || compType === "BUTTON") && comp.buttons) {
                          // Handle each button that has URL variables
                          comp.buttons.forEach((btn: any, btnIdx: number) => {
                            if (btn.type?.toUpperCase() === "URL") {
                              const params = getParams(`BUTTON_${btnIdx}_`);
                              if (params.length > 0) {
                                components.push({
                                  type: "button",
                                  sub_type: "url",
                                  index: btnIdx,
                                  parameters: params
                                });
                              }
                            }
                          });
                        }
                      });
                      

                      // Build rendered text for display in inbox
                      let renderedText = "";
                      selectedTemplateForSend.components.forEach((comp: any) => {
                        const compType = comp.type?.toUpperCase();
                        if (compType === "HEADER" && comp.text) {
                          let headerText = comp.text;
                          Object.keys(varsRecord).filter(k => k.startsWith("HEADER_")).forEach(key => {
                            const varNum = key.split("_")[1];
                            headerText = headerText.replace(`{{${varNum}}}`, varsRecord[key] || "");
                          });
                          renderedText += `*${headerText}*\n`;
                        }
                        if (compType === "BODY" && comp.text) {
                          let bodyText = comp.text;
                          Object.keys(varsRecord).filter(k => k.startsWith("BODY_")).forEach(key => {
                            const varNum = key.split("_")[1];
                            bodyText = bodyText.replace(`{{${varNum}}}`, varsRecord[key] || "");
                          });
                          renderedText += bodyText + "\n";
                        }
                        if (compType === "FOOTER" && comp.text) {
                          renderedText += `_${comp.text}_\n`;
                        }
                      });
                      renderedText = renderedText.trim();
                      
                      sendTemplateMutation.mutate({
                        conversationId: selectedConversationId,
                        templateName: selectedTemplateForSend.name,
                        languageCode: selectedTemplateForSend.language,
                        components: components.length > 0 ? components : undefined,
                        renderedText,
                      });
                    }}
                    disabled={sendTemplateMutation.isPending || Object.values(templateVariables).some(v => !(v as string)?.trim())}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="btn-send-template"
                  >
                    {sendTemplateMutation.isPending ? "Sending..." : "Send Template"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MessengerLayout>
  );
}
